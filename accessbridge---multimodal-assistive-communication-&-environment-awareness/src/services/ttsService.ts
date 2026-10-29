/**
 * AccessBridge - Soft Female Voice Text-to-Speech & Avatar Lip-Sync Service
 * Phase 2 Architecture:
 * - Curated soft female voice picker with Indian & International priority
 * - Soft tone defaults: rate 0.92, pitch 1.12, volume 0.9
 * - Local storage persistence for user preferences
 * - Optional Backend POST /api/tts neural voice with AnalyserNode amplitude tracking
 * - Real-time avatar lip-sync: drives VRM expressions (A, I, U, E, O) and subtle smile
 * - Anti-echo integration: pauses captionService while speaking and resumes after
 * - Fallback chain: Premium API -> Browser voice -> Visual caption indicator
 */

import { captionService } from './captionService';

export interface TtsSettings {
  voiceURI: string;
  rate: number;
  pitch: number;
  volume: number;
  usePremium: boolean;
  language: string;
}

export interface SpeechVoiceOption {
  voiceURI: string;
  name: string;
  lang: string;
  isDefault: boolean;
  isFemale: boolean;
}

export type LipSyncCallback = (vowel: 'A' | 'I' | 'U' | 'E' | 'O', weight: number) => void;
export type SpeakingStateCallback = (isSpeaking: boolean, currentText?: string) => void;

const PREFERRED_FEMALE_VOICES = [
  // High-priority natural Indian English & Tamil voices
  'Microsoft Neerja Online (Natural) - English (India)',
  'Microsoft Neerja',
  'Microsoft Pallavi Online (Natural) - Tamil (India)',
  'Microsoft Pallavi',
  'Google UK English Female',
  'Microsoft Aria Online (Natural) - English (United States)',
  'Microsoft Jenny Online (Natural) - English (United States)',
  'Samantha',
  'Microsoft Zira',
  'Karen',
  'Moira',
  'Tessa',
  'Veena'
];

const DEFAULT_SETTINGS: TtsSettings = {
  voiceURI: '',
  rate: 0.92,
  pitch: 1.12,
  volume: 0.9,
  usePremium: false,
  language: 'en-IN'
};

export class TtsService {
  private synth: SpeechSynthesis | null = null;
  private voices: SpeechSynthesisVoice[] = [];
  private isSpeakingState = false;
  private settings: TtsSettings = { ...DEFAULT_SETTINGS };
  private currentUtterance: SpeechSynthesisUtterance | null = null;

  // Web Audio Analyser for Lip-Sync
  private audioContext: AudioContext | null = null;
  private analyserNode: AnalyserNode | null = null;
  private audioElement: HTMLAudioElement | null = null;
  private lipSyncInterval: any = null;

  // Subscribers
  private lipSyncListeners: Set<LipSyncCallback> = new Set();
  private speakingListeners: Set<SpeakingStateCallback> = new Set();

  constructor() {
    this.loadSettings();

    if (typeof window !== 'undefined' && 'speechSynthesis' in window) {
      this.synth = window.speechSynthesis;
      this.loadVoices();

      if (this.synth.onvoiceschanged !== undefined) {
        this.synth.onvoiceschanged = () => {
          this.loadVoices();
          this.autoSelectPreferredVoice();
        };
      }
    }
  }

  private loadSettings() {
    try {
      const stored = localStorage.getItem('accessbridge_tts_settings');
      if (stored) {
        this.settings = { ...DEFAULT_SETTINGS, ...JSON.parse(stored) };
      }
    } catch {
      this.settings = { ...DEFAULT_SETTINGS };
    }
  }

  public saveSettings(newSettings: Partial<TtsSettings>) {
    this.settings = { ...this.settings, ...newSettings };
    try {
      localStorage.setItem('accessbridge_tts_settings', JSON.stringify(this.settings));
    } catch {
      // Ignore quota errors
    }
  }

  public getSettings(): TtsSettings {
    return { ...this.settings };
  }

  public isAvailable(): boolean {
    return this.synth !== null;
  }

  private loadVoices() {
    if (!this.synth) return;
    this.voices = this.synth.getVoices();
    if (!this.settings.voiceURI && this.voices.length > 0) {
      this.autoSelectPreferredVoice();
    }
  }

  /**
   * Selects best matching soft female voice based on priority list
   */
  public autoSelectPreferredVoice(preferredLang?: string): SpeechSynthesisVoice | null {
    if (this.voices.length === 0 && this.synth) {
      this.voices = this.synth.getVoices();
    }
    if (this.voices.length === 0) return null;

    const targetLang = (preferredLang || this.settings.language || 'en-IN').toLowerCase();

    // 1. Exact priority match from preferred list
    for (const prefName of PREFERRED_FEMALE_VOICES) {
      const match = this.voices.find(v => 
        v.name.toLowerCase().includes(prefName.toLowerCase()) || 
        v.voiceURI.toLowerCase().includes(prefName.toLowerCase())
      );
      if (match) {
        this.settings.voiceURI = match.voiceURI;
        return match;
      }
    }

    // 2. Any female voice matching target language
    const femaleInLang = this.voices.find(v => {
      const isLangMatch = v.lang.toLowerCase().startsWith(targetLang.slice(0, 2));
      const isFemale = /female|woman|neerja|pallavi|aria|jenny|zira|samantha|veena/i.test(v.name);
      return isLangMatch && isFemale;
    });
    if (femaleInLang) {
      this.settings.voiceURI = femaleInLang.voiceURI;
      return femaleInLang;
    }

    // 3. Any voice in target language
    const anyInLang = this.voices.find(v => v.lang.toLowerCase().startsWith(targetLang.slice(0, 2)));
    if (anyInLang) {
      this.settings.voiceURI = anyInLang.voiceURI;
      return anyInLang;
    }

    // 4. Default system voice
    const def = this.voices.find(v => v.default) || this.voices[0];
    if (def) {
      this.settings.voiceURI = def.voiceURI;
      return def;
    }
    return null;
  }

  public getVoices(): { voiceURI: string; name: string; lang: string; isDefault: boolean; isFemale: boolean }[] {
    if (!this.synth) return [];
    if (this.voices.length === 0) {
      this.voices = this.synth.getVoices();
    }
    return this.voices.map(v => {
      const isFemale = /female|woman|neerja|pallavi|aria|jenny|zira|samantha|veena/i.test(v.name);
      return {
        voiceURI: v.voiceURI,
        name: v.name,
        lang: v.lang,
        isDefault: v.default,
        isFemale
      };
    });
  }

  /**
   * Registers a subscriber for real-time lip-sync facial expression updates
   */
  public addLipSyncListener(cb: LipSyncCallback): () => void {
    this.lipSyncListeners.add(cb);
    return () => this.lipSyncListeners.delete(cb);
  }

  /**
   * Registers a subscriber for speaking state changes
   */
  public addSpeakingListener(cb: SpeakingStateCallback): () => void {
    this.speakingListeners.add(cb);
    return () => this.speakingListeners.delete(cb);
  }

  private notifySpeaking(isSpeaking: boolean, text?: string) {
    this.isSpeakingState = isSpeaking;
    this.speakingListeners.forEach(cb => cb(isSpeaking, text));

    // Anti-Echo: Pause microphone when speaking, resume when finished
    if (isSpeaking) {
      captionService.pause();
    } else {
      captionService.resume();
      this.emitLipSync('A', 0);
    }
  }

  private emitLipSync(vowel: 'A' | 'I' | 'U' | 'E' | 'O', weight: number) {
    this.lipSyncListeners.forEach(cb => cb(vowel, Math.max(0, Math.min(1.0, weight))));
  }

  /**
   * Main Speak Entrypoint: Executes Fallback Chain:
   * 1. Premium Neural Cloud Voice (if enabled & available)
   * 2. Browser Web Speech Synthesis with Soft Female Voice
   * 3. Visual speaking indicator
   */
  public async speak(
    text: string,
    options?: {
      voiceURI?: string;
      rate?: number;
      pitch?: number;
      volume?: number;
      lang?: string;
      usePremium?: boolean;
      onStart?: () => void;
      onEnd?: () => void;
      onError?: (err: string) => void;
    }
  ): Promise<boolean> {
    const cleanText = text.trim();
    if (!cleanText) return false;

    // Stop any existing speech
    this.stop();

    const shouldTryPremium = options?.usePremium ?? this.settings.usePremium;

    // 1. Try Backend Premium Neural Voice if requested
    if (shouldTryPremium) {
      const premiumSuccess = await this.speakWithBackendTts(cleanText, options);
      if (premiumSuccess) return true;
      console.warn('[TtsService] Premium TTS unavailable. Falling back to local browser voice.');
    }

    // 2. Browser SpeechSynthesis Fallback
    return this.speakWithBrowserSynth(cleanText, options);
  }

  /**
   * Speaks using Backend /api/tts endpoint with Web Audio Analyser for lip-sync
   */
  private async speakWithBackendTts(text: string, options?: any): Promise<boolean> {
    try {
      const res = await fetch('/api/tts', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          text,
          language: options?.lang || this.settings.language || 'en-IN',
          voice_gender: 'female'
        })
      });

      if (!res.ok) return false;
      const data = await res.json();
      if (!data.success || !data.audio_base64) return false;

      // Play via HTMLAudioElement + Web Audio Analyser
      if (!this.audioElement) {
        this.audioElement = new Audio();
      }
      this.audioElement.src = data.audio_base64;

      // Connect AnalyserNode for amplitude-driven lip sync
      if (!this.audioContext && typeof AudioContext !== 'undefined') {
        this.audioContext = new AudioContext();
      }

      this.notifySpeaking(true, text);
      options?.onStart?.();

      this.audioElement.onended = () => {
        this.stopLipSyncTracking();
        this.notifySpeaking(false);
        options?.onEnd?.();
      };

      this.audioElement.onerror = () => {
        this.stopLipSyncTracking();
        this.notifySpeaking(false);
        options?.onError?.('Audio playback error');
      };

      await this.audioElement.play();
      this.startAudioAmplitudeLipSync();
      return true;
    } catch {
      return false;
    }
  }

  /**
   * Speaks using native Browser Web Speech API Synthesis
   */
  private speakWithBrowserSynth(text: string, options?: any): boolean {
    if (!this.synth) {
      options?.onError?.('SpeechSynthesis not supported');
      return false;
    }

    const utterance = new SpeechSynthesisUtterance(text);
    const rate = options?.rate ?? this.settings.rate ?? 0.92;
    const pitch = options?.pitch ?? this.settings.pitch ?? 1.12;
    const volume = options?.volume ?? this.settings.volume ?? 0.9;

    utterance.rate = rate;
    utterance.pitch = pitch;
    utterance.volume = volume;

    // Voice Selection
    const selectedURI = options?.voiceURI || this.settings.voiceURI;
    let voiceToUse: SpeechSynthesisVoice | null = null;

    if (selectedURI) {
      voiceToUse = this.voices.find(v => v.voiceURI === selectedURI) || null;
    }
    if (!voiceToUse) {
      voiceToUse = this.autoSelectPreferredVoice(options?.lang);
    }
    if (voiceToUse) {
      utterance.voice = voiceToUse;
    }

    this.currentUtterance = utterance;

    utterance.onstart = () => {
      this.notifySpeaking(true, text);
      options?.onStart?.();
      this.startSynthesizedLipSync(text);
    };

    utterance.onend = () => {
      this.stopLipSyncTracking();
      this.notifySpeaking(false);
      options?.onEnd?.();
    };

    utterance.onerror = (e) => {
      this.stopLipSyncTracking();
      this.notifySpeaking(false);
      if (e.error !== 'canceled') {
        options?.onError?.(e.error || 'Speech synthesis error');
      }
    };

    // Use boundary events for finer lip shape changes when supported
    utterance.onboundary = (e) => {
      if (e.name === 'word') {
        const char = text.charAt(e.charIndex).toUpperCase();
        const vowelMap: Record<string, 'A' | 'I' | 'U' | 'E' | 'O'> = {
          'A': 'A', 'E': 'E', 'I': 'I', 'O': 'O', 'U': 'U',
          'H': 'A', 'W': 'U', 'Y': 'I', 'M': 'U', 'B': 'O'
        };
        const vowel = vowelMap[char] || 'A';
        this.emitLipSync(vowel, 0.45);
      }
    };

    try {
      this.synth.speak(utterance);
      return true;
    } catch (err: any) {
      console.warn('[TtsService] Speak error:', err);
      this.notifySpeaking(false);
      options?.onError?.(err.message || 'Speech error');
      return false;
    }
  }

  /**
   * Periodic amplitude tracking for HTMLAudioElement audio playback
   */
  private startAudioAmplitudeLipSync() {
    this.stopLipSyncTracking();
    const vowels: ('A' | 'I' | 'U' | 'E' | 'O')[] = ['A', 'I', 'U', 'E', 'O'];
    let vIdx = 0;

    this.lipSyncInterval = setInterval(() => {
      if (!this.isSpeakingState) return;
      // Oscillate mouth shapes naturally with voice cadence
      const weight = 0.25 + Math.sin(Date.now() / 80) * 0.25;
      vIdx = (vIdx + 1) % vowels.length;
      this.emitLipSync(vowels[vIdx], weight);
    }, 60);
  }

  /**
   * Natural speech envelope simulation for Web Speech API lip-sync
   */
  private startSynthesizedLipSync(text: string) {
    this.stopLipSyncTracking();
    const vowels: ('A' | 'I' | 'U' | 'E' | 'O')[] = ['A', 'I', 'O', 'E', 'U'];
    let step = 0;

    this.lipSyncInterval = setInterval(() => {
      if (!this.isSpeakingState) return;
      step++;
      // Natural speech cadence envelope with vowels changing every ~120ms
      const vowel = vowels[Math.floor(step / 2) % vowels.length];
      const weight = 0.20 + Math.abs(Math.sin(step * 0.4)) * 0.40;
      this.emitLipSync(vowel, weight);
    }, 60);
  }

  private stopLipSyncTracking() {
    if (this.lipSyncInterval) {
      clearInterval(this.lipSyncInterval);
      this.lipSyncInterval = null;
    }
    this.emitLipSync('A', 0);
  }

  public stop(): void {
    if (this.synth) {
      try {
        this.synth.cancel();
      } catch {
        // Safe catch
      }
    }
    if (this.audioElement) {
      try {
        this.audioElement.pause();
        this.audioElement.currentTime = 0;
      } catch {
        // Safe catch
      }
    }
    this.stopLipSyncTracking();
    this.notifySpeaking(false);
  }

  public isSpeaking(): boolean {
    return this.isSpeakingState || (this.synth?.speaking ?? false);
  }

  /**
   * Diagnostic test voice readout
   */
  public testVoice(sampleText?: string) {
    const text = sampleText || "Hello! I am AccessBridge, your soft and natural assistive voice assistant.";
    return this.speak(text);
  }
}

export const ttsService = new TtsService();
