/**
 * AccessBridge - Live Speech-to-Text Captioning Engine (LiveCaptioner)
 * Phase 1 Architecture:
 * - Resilient Web Speech API with continuous listening & interim results
 * - Pre-flight microphone permission checks with friendly guidance
 * - Auto-restart on unexpected onend (250 ms debounce)
 * - Anti-echo suppression: pause() during TTS playback and resume() after
 * - Language switching: en-IN (English), ta-IN (Tamil), hi-IN (Hindi)
 * - Robust Fallback Chain: Web Speech API -> Backend /api/stt chunk recorder -> manual typed input
 */

import { CaptionItem } from '../types';

export type CaptionStatus = 
  | 'idle' 
  | 'listening' 
  | 'paused' 
  | 'unsupported' 
  | 'mic-denied' 
  | 'network-error' 
  | 'backend-stt';

export interface CaptionStatusInfo {
  status: CaptionStatus;
  message: string;
  remedy?: string;
  isListening: boolean;
}

export type SupportedCaptionLang = 'en-IN' | 'ta-IN' | 'hi-IN' | 'en' | 'ta' | 'hi';

export class LiveCaptioner {
  private recognition: any = null;
  private isListening: boolean = false;
  private isPausedByTts: boolean = false;
  private currentLanguage: string = 'en-IN';
  private status: CaptionStatus = 'idle';
  private statusMessage: string = 'Microphone standby';
  private restartTimer: any = null;
  private ttsActiveCount: number = 0;

  // MediaRecorder Fallback for Backend STT (/api/stt)
  private mediaStream: MediaStream | null = null;
  private mediaRecorder: MediaRecorder | null = null;
  private isBackendSttActive: boolean = false;
  private recorderChunkInterval: any = null;

  // Callbacks
  private onResultCallback?: (caption: CaptionItem) => void;
  private onErrorCallback?: (friendlyError: string) => void;
  private onStatusChangeCallback?: (info: CaptionStatusInfo) => void;

  constructor() {
    this.updateStatus('idle', 'Ready to listen');
  }

  /**
   * Normalizes language input to BCP-47 codes
   */
  private normalizeLang(lang: SupportedCaptionLang): string {
    if (lang === 'ta' || lang === 'ta-IN') return 'ta-IN';
    if (lang === 'hi' || lang === 'hi-IN') return 'hi-IN';
    return 'en-IN';
  }

  /**
   * Pre-checks microphone access with polite user messages
   */
  public async checkMicrophonePermission(): Promise<{ granted: boolean; remedy?: string }> {
    if (typeof navigator === 'undefined' || !navigator.mediaDevices) {
      return { 
        granted: false, 
        remedy: 'Browser does not support media device capture.' 
      };
    }

    try {
      if (navigator.permissions && navigator.permissions.query) {
        try {
          const res = await navigator.permissions.query({ name: 'microphone' as PermissionName });
          if (res.state === 'denied') {
            return {
              granted: false,
              remedy: 'Microphone blocked: click the lock/settings icon in your browser address bar and enable Microphone.'
            };
          }
        } catch {
          // Permissions API query name might not be supported in all browsers
        }
      }

      // Test getUserMedia
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      // Release test stream immediately
      stream.getTracks().forEach(t => t.stop());
      return { granted: true };
    } catch (err: any) {
      const msg = err.name === 'NotAllowedError' || err.name === 'PermissionDeniedError'
        ? 'Microphone blocked: click the lock icon in the address bar to allow microphone access.'
        : `Microphone unavailable (${err.message || 'device busy'}). Please check your sound settings.`;
      return { granted: false, remedy: msg };
    }
  }

  /**
   * Reports whether native Web Speech API is present in current browser
   */
  public isBrowserSpeechSupported(): boolean {
    return typeof window !== 'undefined' && 
      ('SpeechRecognition' in window || 'webkitSpeechRecognition' in window);
  }

  /**
   * Current operational status info
   */
  public getStatusInfo(): CaptionStatusInfo {
    let remedy: string | undefined;
    if (this.status === 'mic-denied') {
      remedy = 'Microphone blocked: click the lock icon in the address bar and enable Microphone.';
    } else if (this.status === 'unsupported') {
      remedy = 'Switching automatically to backend Whisper speech recognition.';
    } else if (this.status === 'network-error') {
      remedy = 'Network connection dropped. Attempting offline fallback.';
    }

    return {
      status: this.status,
      message: this.statusMessage,
      remedy,
      isListening: this.isListening && !this.isPausedByTts
    };
  }

  private updateStatus(status: CaptionStatus, message: string) {
    this.status = status;
    this.statusMessage = message;
    this.onStatusChangeCallback?.(this.getStatusInfo());
  }

  /**
   * Primary entry point: starts listening with resilient auto-recovery
   */
  public startListening(
    language: SupportedCaptionLang = 'en-IN',
    onResult: (caption: CaptionItem) => void,
    onError?: (error: string) => void,
    onStateChange?: (state: 'listening' | 'processing' | 'stopped') => void,
    onStatusChange?: (info: CaptionStatusInfo) => void
  ): boolean {
    this.currentLanguage = this.normalizeLang(language);
    this.onResultCallback = onResult;
    this.onErrorCallback = onError;
    this.onStatusChangeCallback = onStatusChange;

    if (this.isListening) {
      this.stopListening();
    }

    // Async preflight check in background
    this.checkMicrophonePermission().then(micCheck => {
      if (!micCheck.granted && this.isListening) {
        this.updateStatus('mic-denied', micCheck.remedy || 'Microphone permission denied.');
        this.onErrorCallback?.(micCheck.remedy || 'Microphone blocked: click the lock icon in the address bar.');
        this.stopListening();
        onStateChange?.('stopped');
      }
    }).catch(() => {});

    // 2. Web Speech API Path
    if (this.isBrowserSpeechSupported()) {
      return this.startWebSpeech(onStateChange);
    }

    // 3. Fallback: Backend /api/stt MediaRecorder Path
    console.warn('[LiveCaptioner] Web Speech API unavailable in this browser. Activating backend /api/stt fallback.');
    this.startBackendStt(onStateChange);
    return true;
  }

  /**
   * Initializes and executes Web Speech API recognition
   */
  private startWebSpeech(onStateChange?: (state: 'listening' | 'processing' | 'stopped') => void): boolean {
    const SpeechRec = (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition;

    try {
      this.recognition = new SpeechRec();
      this.recognition.continuous = true;
      this.recognition.interimResults = true;
      this.recognition.lang = this.currentLanguage;
      this.recognition.maxAlternatives = 1;

      this.recognition.onstart = () => {
        this.isListening = true;
        this.isPausedByTts = false;
        this.updateStatus('listening', `Listening in ${this.currentLanguage}`);
        onStateChange?.('listening');
      };

      this.recognition.onresult = (event: any) => {
        if (this.isPausedByTts) return; // Prevent transcribing system TTS

        onStateChange?.('processing');
        let interimTranscript = '';
        let finalTranscript = '';

        for (let i = event.resultIndex; i < event.results.length; ++i) {
          const res = event.results[i];
          const transcript = res[0]?.transcript || '';
          if (res.isFinal) {
            finalTranscript += transcript;
          } else {
            interimTranscript += transcript;
          }
        }

        const text = (finalTranscript || interimTranscript).trim();
        if (text && this.onResultCallback) {
          const now = new Date();
          const timestamp = now.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' });

          const langCode: 'en' | 'ta' | 'hi' = this.currentLanguage.startsWith('ta') ? 'ta' : (this.currentLanguage.startsWith('hi') ? 'hi' : 'en');
          this.onResultCallback({
            id: `cap_${Date.now()}_${Math.random().toString(36).substring(2, 6)}`,
            timestamp,
            text,
            language: langCode,
            confidence: event.results[event.resultIndex]?.[0]?.confidence ?? 0.90,
            isFinal: !!finalTranscript,
            source: 'web_speech_api'
          });
        }

        onStateChange?.('listening');
      };

      this.recognition.onerror = (event: any) => {
        console.warn('[LiveCaptioner] WebSpeech event error:', event.error);
        if (event.error === 'no-speech') {
          return; // Benign timeout when silent
        }
        if (event.error === 'not-allowed' || event.error === 'service-not-allowed') {
          this.updateStatus('mic-denied', 'Microphone blocked: click the lock icon in the address bar.');
          this.onErrorCallback?.('Microphone blocked: click the lock icon in the address bar.');
        } else if (event.error === 'network') {
          this.updateStatus('network-error', 'Network speech recognition issue. Falling back to local backend STT.');
          this.onErrorCallback?.('Network connection issue with cloud speech recognizer.');
          // Automatically try backend STT fallback
          this.fallbackToBackendStt(onStateChange);
        } else {
          this.updateStatus('idle', `Speech service notice: ${event.error}`);
        }
      };

      this.recognition.onend = () => {
        if (this.isListening && !this.isPausedByTts) {
          // Auto-restart with safe 250ms debounce
          clearTimeout(this.restartTimer);
          this.restartTimer = setTimeout(() => {
            if (this.isListening && !this.isPausedByTts && this.recognition) {
              try {
                this.recognition.start();
              } catch {
                // Ignore duplicate start errors
              }
            }
          }, 250);
        } else {
          onStateChange?.('stopped');
        }
      };

      this.recognition.start();
      this.isListening = true;
      return true;
    } catch (err: any) {
      console.warn('[LiveCaptioner] WebSpeech start exception:', err);
      this.fallbackToBackendStt(onStateChange);
      return false;
    }
  }

  /**
   * Fallback chain to backend /api/stt
   */
  private fallbackToBackendStt(onStateChange?: (state: 'listening' | 'processing' | 'stopped') => void): void {
    this.stopListening(false);
    this.startBackendStt(onStateChange);
  }

  /**
   * Backend /api/stt recording stream
   */
  private async startBackendStt(onStateChange?: (state: 'listening' | 'processing' | 'stopped') => void): Promise<boolean> {
    try {
      this.mediaStream = await navigator.mediaDevices.getUserMedia({ audio: true });
      this.mediaRecorder = new MediaRecorder(this.mediaStream, { mimeType: 'audio/webm' });
      this.isListening = true;
      this.isBackendSttActive = true;
      this.updateStatus('backend-stt', 'Using backend speech recognition (3s chunks)');
      onStateChange?.('listening');

      let audioChunks: Blob[] = [];

      this.mediaRecorder.ondataavailable = (e) => {
        if (e.data.size > 0) audioChunks.push(e.data);
      };

      this.mediaRecorder.onstop = async () => {
        if (audioChunks.length > 0 && this.isListening && !this.isPausedByTts) {
          const audioBlob = new Blob(audioChunks, { type: 'audio/webm' });
          audioChunks = [];
          await this.sendChunkToBackend(audioBlob);
        }
      };

      // Record in 3-second slices
      this.mediaRecorder.start();
      this.recorderChunkInterval = setInterval(() => {
        if (this.mediaRecorder && this.mediaRecorder.state === 'recording') {
          this.mediaRecorder.stop();
          this.mediaRecorder.start();
        }
      }, 3000);

      return true;
    } catch (err: any) {
      this.updateStatus('unsupported', 'Local microphone recording could not be started.');
      this.onErrorCallback?.('Speech-to-text offline. You can use the manual typed-input box.');
      onStateChange?.('stopped');
      return false;
    }
  }

  private async sendChunkToBackend(blob: Blob) {
    try {
      const formData = new FormData();
      formData.append('file', blob, 'caption_chunk.webm');
      formData.append('language', this.currentLanguage.split('-')[0]);

      const res = await fetch('/api/stt', {
        method: 'POST',
        body: formData
      });

      if (res.ok) {
        const data = await res.json();
        if (data.success && data.text && data.text.trim()) {
          const now = new Date();
          const timestamp = now.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' });
          const langCode: 'en' | 'ta' | 'hi' = this.currentLanguage.startsWith('ta') ? 'ta' : (this.currentLanguage.startsWith('hi') ? 'hi' : 'en');
          this.onResultCallback?.({
            id: `cap_whisper_${Date.now()}`,
            timestamp,
            text: data.text.trim(),
            language: langCode,
            confidence: data.confidence || 0.88,
            isFinal: true,
            source: 'faster_whisper_local'
          });
        }
      }
    } catch {
      // Backend STT network error; fail gracefully
    }
  }

  /**
   * Anti-Echo: Pauses microphone capture while system TTS speaks so it won't transcribe itself
   */
  public pause(): void {
    this.ttsActiveCount++;
    if (this.ttsActiveCount > 0 && this.isListening && !this.isPausedByTts) {
      this.isPausedByTts = true;
      if (this.recognition) {
        try {
          this.recognition.abort();
        } catch {
          // Ignore
        }
      }
      if (this.mediaRecorder && this.mediaRecorder.state === 'recording') {
        try {
          this.mediaRecorder.pause();
        } catch {
          // Ignore
        }
      }
      this.updateStatus('paused', 'Paused (voice output active)');
    }
  }

  /**
   * Resumes listening after system TTS speech ends
   */
  public resume(): void {
    this.ttsActiveCount = Math.max(0, this.ttsActiveCount - 1);
    if (this.ttsActiveCount === 0 && this.isListening && this.isPausedByTts) {
      this.isPausedByTts = false;
      this.updateStatus('listening', `Listening in ${this.currentLanguage}`);

      if (this.recognition) {
        clearTimeout(this.restartTimer);
        this.restartTimer = setTimeout(() => {
          if (this.isListening && !this.isPausedByTts) {
            try {
              this.recognition.start();
            } catch {
              // Ignore
            }
          }
        }, 150);
      } else if (this.mediaRecorder && this.mediaRecorder.state === 'paused') {
        try {
          this.mediaRecorder.resume();
        } catch {
          // Ignore
        }
      }
    }
  }

  /**
   * Dynamically switches captioning language (en-IN, ta-IN, hi-IN)
   */
  public setLanguage(lang: SupportedCaptionLang) {
    this.currentLanguage = this.normalizeLang(lang);
    if (this.recognition) {
      this.recognition.lang = this.currentLanguage;
    }
    if (this.isListening) {
      this.updateStatus('listening', `Language switched to ${this.currentLanguage}`);
    }
  }

  /**
   * Stops listening and cleans up all active streams and timers
   */
  public stopListening(updateStatus: boolean = true): void {
    this.isListening = false;
    this.isPausedByTts = false;
    this.ttsActiveCount = 0;
    clearTimeout(this.restartTimer);

    if (this.recorderChunkInterval) {
      clearInterval(this.recorderChunkInterval);
      this.recorderChunkInterval = null;
    }

    if (this.recognition) {
      try {
        this.recognition.abort();
      } catch {
        // Safe catch
      }
      this.recognition = null;
    }

    if (this.mediaRecorder) {
      try {
        if (this.mediaRecorder.state !== 'inactive') this.mediaRecorder.stop();
      } catch {
        // Safe catch
      }
      this.mediaRecorder = null;
    }

    if (this.mediaStream) {
      this.mediaStream.getTracks().forEach(t => t.stop());
      this.mediaStream = null;
    }

    this.isBackendSttActive = false;
    if (updateStatus) {
      this.updateStatus('idle', 'Microphone standby');
    }
  }

  public getIsListening(): boolean {
    return this.isListening && !this.isPausedByTts;
  }
}

// Singleton export and alias for backwards compatibility
export const captionService = new LiveCaptioner();
export const liveCaptioner = captionService;
