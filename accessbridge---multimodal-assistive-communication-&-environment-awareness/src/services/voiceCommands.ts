/**
 * AccessBridge - Voice Command System (voiceCommands.ts)
 * Phase 3 Architecture:
 * - Robust Command Registry with exact & fuzzy Levenshtein distance matching
 * - Configurable Wake Word ("bridge") and mode (Always-Listening vs Push-to-Talk)
 * - Supported Commands: describe, read this, start/stop detection, more/less detail,
 *   sign <word>, fingerspell <word>, start/stop captions, emergency, slower/faster/repeat,
 *   switch to Tamil/English/Hindi, go to <page>, what can I say.
 * - Cloud Fallback: Unmatched speech routes to Gemini with {intent, args} JSON schema.
 * - Always provides spoken voice confirmation and visual UI status.
 */

import { ttsService } from './ttsService';
import { liveCaptioner } from './captionService';
import { NavigationTab } from '../types';

export interface VoiceCommandDef {
  id: string;
  category: 'vision' | 'sign' | 'speech' | 'navigation' | 'emergency' | 'system';
  primaryPhrase: string;
  aliases: string[];
  description: string;
  example: string;
}

export interface MatchedCommand {
  commandId: string;
  args?: Record<string, string>;
  confidence: number;
  rawTranscript: string;
  confirmationText: string;
}

export type CommandActionHandlers = {
  onDescribe?: () => void;
  onReadDocument?: () => void;
  onToggleDetection?: (active: boolean) => void;
  onAdjustDetail?: (moreDetail: boolean) => void;
  onSignWord?: (word: string) => void;
  onFingerspell?: (word: string) => void;
  onToggleCaptions?: (active: boolean) => void;
  onEmergency?: () => void;
  onAdjustSpeed?: (delta: number) => void;
  onRepeatLast?: () => void;
  onSwitchLanguage?: (lang: 'en' | 'ta' | 'hi') => void;
  onNavigate?: (tab: NavigationTab) => void;
  onShowHelp?: () => void;
};

// Levenshtein distance for fuzzy matching
export function computeLevenshtein(a: string, b: string): number {
  const an = a.length;
  const bn = b.length;
  if (an === 0) return bn;
  if (bn === 0) return an;

  const matrix = Array.from({ length: bn + 1 }, () => Array(an + 1).fill(0));
  for (let i = 0; i <= an; i++) matrix[0][i] = i;
  for (let j = 0; j <= bn; j++) matrix[j][0] = j;

  for (let j = 1; j <= bn; j++) {
    for (let i = 1; i <= an; i++) {
      const cost = a[i - 1] === b[j - 1] ? 0 : 1;
      matrix[j][i] = Math.min(
        matrix[j - 1][i] + 1,       // deletion
        matrix[j][i - 1] + 1,       // insertion
        matrix[j - 1][i - 1] + cost // substitution
      );
    }
  }
  return matrix[bn][an];
}

export function computeSimilarity(a: string, b: string): number {
  const aNorm = a.toLowerCase().trim();
  const bNorm = b.toLowerCase().trim();
  if (aNorm === bNorm) return 1.0;
  const maxLen = Math.max(aNorm.length, bNorm.length);
  if (maxLen === 0) return 1.0;
  const dist = computeLevenshtein(aNorm, bNorm);
  return Math.max(0, 1.0 - dist / maxLen);
}

export const REGISTERED_COMMANDS: VoiceCommandDef[] = [
  {
    id: 'describe_scene',
    category: 'vision',
    primaryPhrase: 'describe',
    aliases: ["what's around me", 'whats around me', 'describe scene', 'look around', 'tell me what you see'],
    description: 'Describes prominent objects and physical environment for blind navigation',
    example: '"describe" or "what\'s around me"'
  },
  {
    id: 'read_text',
    category: 'vision',
    primaryPhrase: 'read this',
    aliases: ['read document', 'scan text', 'read page', 'ocr', 'read text'],
    description: 'Extracts and speaks printed text or documents via OCR',
    example: '"read this" or "scan text"'
  },
  {
    id: 'start_detection',
    category: 'vision',
    primaryPhrase: 'start detection',
    aliases: ['start scanner', 'turn on camera', 'start narrator', 'watch surroundings'],
    description: 'Starts continuous obstacle and object detection',
    example: '"start detection"'
  },
  {
    id: 'stop_detection',
    category: 'vision',
    primaryPhrase: 'stop detection',
    aliases: ['stop scanner', 'turn off camera', 'stop narrator', 'pause vision'],
    description: 'Pauses continuous obstacle narrator',
    example: '"stop detection"'
  },
  {
    id: 'more_detail',
    category: 'vision',
    primaryPhrase: 'more detail',
    aliases: ['elaborate', 'full description', 'tell me more'],
    description: 'Requests a richer, comprehensive scene breakdown',
    example: '"more detail"'
  },
  {
    id: 'less_detail',
    category: 'vision',
    primaryPhrase: 'less detail',
    aliases: ['brief', 'short description', 'keep it brief'],
    description: 'Summarizes scene in one rapid obstacle sentence',
    example: '"less detail"'
  },
  {
    id: 'sign_word',
    category: 'sign',
    primaryPhrase: 'sign',
    aliases: ['show sign', 'demonstrate', 'avatar sign'],
    description: 'Performs a word on the 3D ISL signing avatar',
    example: '"sign hello" or "sign water"'
  },
  {
    id: 'fingerspell_word',
    category: 'sign',
    primaryPhrase: 'fingerspell',
    aliases: ['spell out', 'spell', 'finger spell'],
    description: 'Fingerspells any name or word letter-by-letter in ISL',
    example: '"fingerspell hospital"'
  },
  {
    id: 'start_captions',
    category: 'speech',
    primaryPhrase: 'start captions',
    aliases: ['listen', 'transcribe', 'turn on mic', 'start listening'],
    description: 'Enables live continuous speech-to-text captions',
    example: '"start captions"'
  },
  {
    id: 'stop_captions',
    category: 'speech',
    primaryPhrase: 'stop captions',
    aliases: ['stop listening', 'turn off mic', 'mute mic'],
    description: 'Pauses live speech captioning',
    example: '"stop captions"'
  },
  {
    id: 'emergency',
    category: 'emergency',
    primaryPhrase: 'emergency',
    aliases: ['help me', 'call for help', 'sos', 'medical emergency'],
    description: 'Triggers urgent assistance alert and emergency phraseboard',
    example: '"emergency" or "help me"'
  },
  {
    id: 'slower',
    category: 'system',
    primaryPhrase: 'slower',
    aliases: ['speak slower', 'slow down', 'reduce speed'],
    description: 'Reduces speech and avatar animation speed',
    example: '"slower"'
  },
  {
    id: 'faster',
    category: 'system',
    primaryPhrase: 'faster',
    aliases: ['speak faster', 'speed up', 'faster speech'],
    description: 'Increases speech and avatar speed',
    example: '"faster"'
  },
  {
    id: 'repeat',
    category: 'system',
    primaryPhrase: 'repeat',
    aliases: ['say that again', 'pardon', 'one more time'],
    description: 'Repeats the last spoken or recognized message',
    example: '"repeat"'
  },
  {
    id: 'switch_tamil',
    category: 'system',
    primaryPhrase: 'switch to Tamil',
    aliases: ['tamil language', 'change to tamil', 'tamil'],
    description: 'Switches captions and voice language to Tamil (ta-IN)',
    example: '"switch to Tamil"'
  },
  {
    id: 'switch_english',
    category: 'system',
    primaryPhrase: 'switch to English',
    aliases: ['english language', 'change to english', 'english'],
    description: 'Switches captions and voice language to English (en-IN)',
    example: '"switch to English"'
  },
  {
    id: 'switch_hindi',
    category: 'system',
    primaryPhrase: 'switch to Hindi',
    aliases: ['hindi language', 'change to hindi', 'hindi'],
    description: 'Switches captions and voice language to Hindi (hi-IN)',
    example: '"switch to Hindi"'
  },
  {
    id: 'navigate_page',
    category: 'navigation',
    primaryPhrase: 'go to',
    aliases: ['open', 'navigate to', 'switch to mode'],
    description: 'Navigates directly to any assistive interface (Deaf, Mute, Blind, Settings, Lab)',
    example: '"go to blind" or "go to mute"'
  },
  {
    id: 'help_commands',
    category: 'system',
    primaryPhrase: 'what can I say',
    aliases: ['help', 'voice help', 'list commands', 'what commands'],
    description: 'Announces and displays all available voice commands',
    example: '"what can I say"'
  }
];

export class VoiceCommandSystem {
  private wakeWord: string = 'bridge';
  private requireWakeWord: boolean = false;
  private alwaysListening: boolean = false;
  private isListeningForCommands: boolean = false;
  private recognition: any = null;
  private lastAnnouncedText: string = '';
  private lastConfirmationMessage: string = '';
  private handlers: CommandActionHandlers = {};

  // Status & Event listeners
  private statusListeners: Set<(active: boolean, message: string) => void> = new Set();
  private commandMatchListeners: Set<(match: MatchedCommand) => void> = new Set();

  constructor() {
    this.loadConfig();
  }

  private loadConfig() {
    try {
      const stored = localStorage.getItem('accessbridge_voice_cmd_config');
      if (stored) {
        const parsed = JSON.parse(stored);
        this.requireWakeWord = !!parsed.requireWakeWord;
        this.alwaysListening = !!parsed.alwaysListening;
        this.wakeWord = parsed.wakeWord || 'bridge';
      }
    } catch {
      // Default fallback
    }
  }

  public saveConfig(config: { requireWakeWord?: boolean; alwaysListening?: boolean; wakeWord?: string }) {
    if (config.requireWakeWord !== undefined) this.requireWakeWord = config.requireWakeWord;
    if (config.alwaysListening !== undefined) this.alwaysListening = config.alwaysListening;
    if (config.wakeWord !== undefined) this.wakeWord = config.wakeWord.toLowerCase().trim();

    try {
      localStorage.setItem('accessbridge_voice_cmd_config', JSON.stringify({
        requireWakeWord: this.requireWakeWord,
        alwaysListening: this.alwaysListening,
        wakeWord: this.wakeWord
      }));
    } catch {
      // Ignore
    }
  }

  public setWakeWordRequirement(req: boolean) {
    this.requireWakeWord = req;
  }

  public getConfig() {
    return {
      requireWakeWord: this.requireWakeWord,
      alwaysListening: this.alwaysListening,
      wakeWord: this.wakeWord
    };
  }

  public setHandlers(handlers: CommandActionHandlers) {
    this.handlers = { ...this.handlers, ...handlers };
  }

  public addStatusListener(cb: (active: boolean, message: string) => void): () => void {
    this.statusListeners.add(cb);
    return () => this.statusListeners.delete(cb);
  }

  public addCommandMatchListener(cb: (match: MatchedCommand) => void): () => void {
    this.commandMatchListeners.add(cb);
    return () => this.commandMatchListeners.delete(cb);
  }

  private emitStatus(active: boolean, message: string) {
    this.statusListeners.forEach(cb => cb(active, message));
  }

  private emitMatch(match: MatchedCommand) {
    this.commandMatchListeners.forEach(cb => cb(match));
  }

  /**
   * Evaluates text against the command registry using exact + fuzzy Levenshtein distance
   */
  public evaluateUtterance(rawTranscript: string): MatchedCommand | null {
    let text = rawTranscript.toLowerCase().trim();
    if (!text) return null;

    // Check optional wake word prefix
    if (this.requireWakeWord) {
      const wakeIdx = text.indexOf(this.wakeWord);
      if (wakeIdx === -1) {
        return null; // Wake word missing
      }
      text = text.substring(wakeIdx + this.wakeWord.length).trim();
      if (!text) return null;
    }

    // 1. Direct Pattern & Argument Extraction
    // a. "sign <word>"
    const signMatch = text.match(/^(?:sign|show sign|demonstrate)\s+([a-z\s]+)$/i);
    if (signMatch) {
      const word = signMatch[1].trim();
      return {
        commandId: 'sign_word',
        args: { word },
        confidence: 0.95,
        rawTranscript,
        confirmationText: `Signing: ${word}`
      };
    }

    // b. "fingerspell <word>"
    const spellMatch = text.match(/^(?:fingerspell|spell out|spell)\s+([a-z\s]+)$/i);
    if (spellMatch) {
      const word = spellMatch[1].trim();
      return {
        commandId: 'fingerspell_word',
        args: { word },
        confidence: 0.95,
        rawTranscript,
        confirmationText: `Fingerspelling: ${word}`
      };
    }

    // c. "go to <page>"
    const navMatch = text.match(/^(?:go to|open|navigate to)\s+([a-z\s]+)$/i);
    if (navMatch) {
      const target = navMatch[1].trim();
      return {
        commandId: 'navigate_page',
        args: { target },
        confidence: 0.92,
        rawTranscript,
        confirmationText: `Opening ${target} interface`
      };
    }

    // 2. Fuzzy Match against all static command phrases
    let bestCmd: VoiceCommandDef | null = null;
    let highestScore = 0;

    for (const cmd of REGISTERED_COMMANDS) {
      const candidates = [cmd.primaryPhrase, ...cmd.aliases];
      for (const phrase of candidates) {
        // Direct substring check
        if (text === phrase || text.startsWith(phrase)) {
          return {
            commandId: cmd.id,
            confidence: 0.98,
            rawTranscript,
            confirmationText: cmd.description
          };
        }

        const sim = computeSimilarity(text, phrase);
        if (sim > highestScore) {
          highestScore = sim;
          bestCmd = cmd;
        }
      }
    }

    // Match threshold: > 0.72 similarity required for fuzzy match
    if (bestCmd && highestScore >= 0.72) {
      return {
        commandId: bestCmd.id,
        confidence: highestScore,
        rawTranscript,
        confirmationText: bestCmd.description
      };
    }

    return null;
  }

  /**
   * Executes a matched command with spoken & visual confirmation
   */
  public async executeCommand(match: MatchedCommand): Promise<boolean> {
    this.emitMatch(match);
    this.lastConfirmationMessage = match.confirmationText;

    // Spoken confirmation
    ttsService.speak(match.confirmationText);

    switch (match.commandId) {
      case 'describe_scene':
        this.handlers.onDescribe?.();
        return true;
      case 'read_text':
        this.handlers.onReadDocument?.();
        return true;
      case 'start_detection':
        this.handlers.onToggleDetection?.(true);
        return true;
      case 'stop_detection':
        this.handlers.onToggleDetection?.(false);
        return true;
      case 'more_detail':
        this.handlers.onAdjustDetail?.(true);
        return true;
      case 'less_detail':
        this.handlers.onAdjustDetail?.(false);
        return true;
      case 'sign_word':
        if (match.args?.word) {
          this.handlers.onSignWord?.(match.args.word);
        }
        return true;
      case 'fingerspell_word':
        if (match.args?.word) {
          this.handlers.onFingerspell?.(match.args.word);
        }
        return true;
      case 'start_captions':
        this.handlers.onToggleCaptions?.(true);
        return true;
      case 'stop_captions':
        this.handlers.onToggleCaptions?.(false);
        return true;
      case 'emergency':
        this.handlers.onEmergency?.();
        return true;
      case 'slower':
        this.handlers.onAdjustSpeed?.(-0.15);
        return true;
      case 'faster':
        this.handlers.onAdjustSpeed?.(+0.15);
        return true;
      case 'repeat':
        this.handlers.onRepeatLast?.();
        return true;
      case 'switch_tamil':
        this.handlers.onSwitchLanguage?.('ta');
        return true;
      case 'switch_english':
        this.handlers.onSwitchLanguage?.('en');
        return true;
      case 'switch_hindi':
        this.handlers.onSwitchLanguage?.('hi');
        return true;
      case 'navigate_page':
        const target = (match.args?.target || '').toLowerCase();
        let tab: NavigationTab = 'deaf';
        if (target.includes('mute') || target.includes('sign')) tab = 'mute';
        else if (target.includes('blind') || target.includes('vision')) tab = 'blind';
        else if (target.includes('lab') || target.includes('train')) tab = 'lab';
        else if (target.includes('eval') || target.includes('metric')) tab = 'evaluation';
        else if (target.includes('setting')) tab = 'settings';
        else if (target.includes('processor')) tab = 'processor';
        this.handlers.onNavigate?.(tab);
        return true;
      case 'help_commands':
        this.handlers.onShowHelp?.();
        return true;
      default:
        return false;
    }
  }

  /**
   * Handles unmatched commands by routing to Gemini {intent, args} or speaking polite fallback
   */
  public async handleUnmatchedSpeech(rawTranscript: string) {
    try {
      const res = await fetch('/api/gemini/command', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ speech: rawTranscript })
      });

      if (res.ok) {
        const data = await res.json();
        if (data.intent && data.intent !== 'unknown') {
          await this.executeCommand({
            commandId: data.intent,
            args: data.args || {},
            confidence: 0.85,
            rawTranscript,
            confirmationText: data.confirmation || `Executing ${data.intent}`
          });
          return;
        }
      }
    } catch {
      // Backend Gemini route unavailable
    }

    // Friendly spoken fallback with 3 helpful example commands
    const fallbackMsg = "Sorry, I didn't catch that. You can say 'describe', 'read this', or 'what can I say'.";
    ttsService.speak(fallbackMsg);
    this.emitStatus(true, fallbackMsg);
  }

  /**
   * Starts hands-free voice command listener
   */
  public startListening(): boolean {
    if (this.isListeningForCommands) return true;

    const SpeechRec = (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition;
    if (!SpeechRec) {
      ttsService.speak("Speech recognition is not supported in this browser.");
      return false;
    }

    try {
      this.recognition = new SpeechRec();
      this.recognition.continuous = true;
      this.recognition.interimResults = false;
      this.recognition.lang = 'en-IN';

      this.recognition.onstart = () => {
        this.isListeningForCommands = true;
        this.emitStatus(true, this.requireWakeWord ? `Say "${this.wakeWord} [command]"` : 'Listening for voice commands...');
      };

      this.recognition.onresult = async (event: any) => {
        const last = event.results[event.results.length - 1];
        if (!last || !last[0]) return;
        const transcript = last[0].transcript.trim();

        const match = this.evaluateUtterance(transcript);
        if (match) {
          await this.executeCommand(match);
        } else {
          await this.handleUnmatchedSpeech(transcript);
        }
      };

      this.recognition.onerror = (e: any) => {
        if (e.error !== 'no-speech') {
          console.warn('[VoiceCommandSystem] Error:', e.error);
        }
      };

      this.recognition.onend = () => {
        if (this.isListeningForCommands) {
          setTimeout(() => {
            if (this.isListeningForCommands && this.recognition) {
              try {
                this.recognition.start();
              } catch {
                // Ignore
              }
            }
          }, 300);
        } else {
          this.emitStatus(false, 'Voice commands paused');
        }
      };

      this.recognition.start();
      this.isListeningForCommands = true;
      ttsService.speak("Voice command system active. Say what can I say for help.");
      return true;
    } catch (err: any) {
      console.warn('[VoiceCommandSystem] Start exception:', err);
      this.isListeningForCommands = false;
      return false;
    }
  }

  public stopListening() {
    this.isListeningForCommands = false;
    if (this.recognition) {
      try {
        this.recognition.abort();
      } catch {
        // Safe catch
      }
      this.recognition = null;
    }
    this.emitStatus(false, 'Voice commands stopped');
  }

  public getIsListening(): boolean {
    return this.isListeningForCommands;
  }
}

export const voiceCommandSystem = new VoiceCommandSystem();
