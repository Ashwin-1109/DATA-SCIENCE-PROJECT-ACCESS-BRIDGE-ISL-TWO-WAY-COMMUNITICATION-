/**
 * AccessBridge - Storage & Privacy Service
 * Handles user sessions, conversation transcripts, accessibility settings
 * Strict privacy: zero tracking, all data retained only on user device in LocalStorage
 */

import { AccessibilitySettings, CaptionItem, ConversationTurn } from '../types';

const SETTINGS_KEY = 'accessbridge_settings_v1';
const CONVERSATION_KEY = 'accessbridge_conversation_v1';
const CAPTION_HISTORY_KEY = 'accessbridge_captions_v1';
const ACTIVE_SIGN_MODEL_KEY = 'accessbridge_active_sign_model';

export const DEFAULT_SETTINGS: AccessibilitySettings = {
  highContrast: false,
  fontSize: 'normal',
  reducedMotion: false,
  speechRate: 1.0,
  speechPitch: 1.0,
  speechVoiceUri: '',
  announcementFrequencySec: 3.0,
  autoSpeakSign: true,
  cameraFacingMode: 'user',
};

class StorageService {
  public getSettings(): AccessibilitySettings {
    try {
      const raw = localStorage.getItem(SETTINGS_KEY);
      if (!raw) return DEFAULT_SETTINGS;
      return { ...DEFAULT_SETTINGS, ...JSON.parse(raw) };
    } catch {
      return DEFAULT_SETTINGS;
    }
  }

  public saveSettings(settings: AccessibilitySettings): void {
    try {
      localStorage.setItem(SETTINGS_KEY, JSON.stringify(settings));
    } catch (e) {
      console.error('Failed to save settings:', e);
    }
  }

  public getConversation(): ConversationTurn[] {
    try {
      const raw = localStorage.getItem(CONVERSATION_KEY);
      return raw ? JSON.parse(raw) : [];
    } catch {
      return [];
    }
  }

  public saveConversation(turns: ConversationTurn[]): void {
    try {
      localStorage.setItem(CONVERSATION_KEY, JSON.stringify(turns));
    } catch (e) {
      console.error('Failed to save conversation:', e);
    }
  }

  public clearConversation(): void {
    try {
      localStorage.removeItem(CONVERSATION_KEY);
    } catch (e) {
      console.error('Failed to clear conversation:', e);
    }
  }

  public getCaptionHistory(): CaptionItem[] {
    try {
      const raw = localStorage.getItem(CAPTION_HISTORY_KEY);
      return raw ? JSON.parse(raw) : [];
    } catch {
      return [];
    }
  }

  public saveCaptionHistory(items: CaptionItem[]): void {
    try {
      localStorage.setItem(CAPTION_HISTORY_KEY, JSON.stringify(items));
    } catch (e) {
      console.error('Failed to save captions:', e);
    }
  }

  public clearCaptionHistory(): void {
    try {
      localStorage.removeItem(CAPTION_HISTORY_KEY);
    } catch (e) {
      console.error('Failed to clear captions:', e);
    }
  }

  public getActiveSignModel(): string | null {
    try {
      return localStorage.getItem(ACTIVE_SIGN_MODEL_KEY);
    } catch {
      return null;
    }
  }

  public setActiveSignModel(modelId: string | null): void {
    try {
      if (modelId) {
        localStorage.setItem(ACTIVE_SIGN_MODEL_KEY, modelId);
      } else {
        localStorage.removeItem(ACTIVE_SIGN_MODEL_KEY);
      }
    } catch (e) {
      console.error('Failed to set active sign model:', e);
    }
  }

  public wipeAllData(): void {
    try {
      localStorage.removeItem(CONVERSATION_KEY);
      localStorage.removeItem(CAPTION_HISTORY_KEY);
      localStorage.removeItem(ACTIVE_SIGN_MODEL_KEY);
    } catch (e) {
      console.error('Failed to wipe data:', e);
    }
  }
}

export const storageService = new StorageService();
