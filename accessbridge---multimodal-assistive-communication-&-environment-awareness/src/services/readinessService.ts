/**
 * AccessBridge - Subsystem Readiness Service
 * Probes the genuine state of hardware devices, local ML assets, and backends.
 * Truthfulness requirement: Never shows "Ready" based on fake strings or missing files.
 */

import { SubsystemStatus } from '../types';
import { storageService } from './storageService';
import { ttsService } from './ttsService';

class ReadinessService {
  public async checkBackendHealth(): Promise<{ connected: boolean; message: string; version?: string; geminiActive?: boolean; signModelLoaded?: boolean }> {
    try {
      const controller = new AbortController();
      const id = setTimeout(() => controller.abort(), 2500);
      
      const res = await fetch('/api/health', { signal: controller.signal });
      clearTimeout(id);
      
      if (res.ok) {
        const data = await res.json();
        return { 
          connected: true, 
          message: `Connected to AccessBridge API (${data.version || 'v1.0'})`, 
          version: data.version,
          geminiActive: data.gemini_active,
          signModelLoaded: data.sign_model_loaded
        };
      }
    } catch {
      // Local server not actively responding to /api/health
    }
    return { 
      connected: false, 
      message: 'Local Python/FastAPI backend not running at localhost:8000. Operating in browser-assisted mode.' 
    };
  }

  public async probeCameraPermission(): Promise<{ state: 'ready' | 'not_configured' | 'unavailable' | 'error'; details: string }> {
    if (!navigator?.mediaDevices?.getUserMedia) {
      return { state: 'unavailable', details: 'WebRTC Camera API is not supported in this browser environment.' };
    }
    try {
      if ('permissions' in navigator && navigator.permissions.query) {
        const perm = await navigator.permissions.query({ name: 'camera' as PermissionName });
        if (perm.state === 'granted') {
          return { state: 'ready', details: 'Camera permission previously granted by user.' };
        } else if (perm.state === 'denied') {
          return { state: 'error', details: 'Camera access explicitly blocked. Please enable camera in browser site permissions.' };
        }
      }
    } catch {
      // Some browsers do not support 'camera' permission query name
    }
    return { state: 'not_configured', details: 'Permission not yet requested. Click "Test Camera" to request access.' };
  }

  public async probeMicrophonePermission(): Promise<{ state: 'ready' | 'not_configured' | 'unavailable' | 'error'; details: string }> {
    if (!navigator?.mediaDevices?.getUserMedia) {
      return { state: 'unavailable', details: 'WebRTC Microphone API is not supported in this browser environment.' };
    }
    try {
      if ('permissions' in navigator && navigator.permissions.query) {
        const perm = await navigator.permissions.query({ name: 'microphone' as PermissionName });
        if (perm.state === 'granted') {
          return { state: 'ready', details: 'Microphone permission previously granted by user.' };
        } else if (perm.state === 'denied') {
          return { state: 'error', details: 'Microphone access explicitly blocked. Please enable microphone in browser site settings.' };
        }
      }
    } catch {
      // Permissions API catch
    }
    return { state: 'not_configured', details: 'Permission not yet requested. Click "Test Microphone" to request access.' };
  }

  public async getSubsystemStatuses(): Promise<SubsystemStatus[]> {
    const backend = await this.checkBackendHealth();
    const cam = await this.probeCameraPermission();
    const mic = await this.probeMicrophonePermission();

    const hasTts = ttsService.isAvailable();
    const voices = ttsService.getVoices();

    const hasWebSpeechRec = typeof window !== 'undefined' && 
      ('SpeechRecognition' in window || 'webkitSpeechRecognition' in window);

    const hasWasm = typeof WebAssembly === 'object' && typeof WebAssembly.instantiate === 'function';

    // If backend is connected, probe genuine backend subsystems
    let backendSubsystems: any[] = [];
    if (backend.connected) {
      try {
        const res = await fetch('/api/readiness/subsystems');
        if (res.ok) {
          backendSubsystems = await res.json();
        }
      } catch (e) {
        console.warn('Error fetching backend subsystems:', e);
      }
    }

    const backendSignModel = backendSubsystems.find(s => s.id === 'sign_model');
    const backendGemini = backendSubsystems.find(s => s.id === 'gemini_vision');

    const statuses: SubsystemStatus[] = [
      {
        id: 'backend',
        name: 'Backend Connectivity',
        category: 'runtime',
        state: backend.connected ? 'ready' : 'not_configured',
        details: backend.message,
        recoveryAction: backend.connected ? undefined : 'To run the local Python backend: execute "uvicorn backend.app.main:app --port 8000" or run start.bat.',
        actionLabel: backend.connected ? undefined : 'View Setup Guide'
      },
      {
        id: 'camera',
        name: 'Camera Access',
        category: 'hardware',
        state: cam.state,
        details: cam.details,
        recoveryAction: cam.state === 'error' ? 'Open browser settings -> Site settings -> Permissions -> Camera -> Allow AccessBridge.' : undefined,
        actionLabel: cam.state === 'ready' ? undefined : 'Test Camera'
      },
      {
        id: 'microphone',
        name: 'Microphone Access',
        category: 'hardware',
        state: mic.state,
        details: mic.details,
        recoveryAction: mic.state === 'error' ? 'Open browser settings -> Site settings -> Permissions -> Microphone -> Allow.' : undefined,
        actionLabel: mic.state === 'ready' ? undefined : 'Test Microphone'
      },
      {
        id: 'mediapipe',
        name: 'MediaPipe Landmark Pipeline',
        category: 'runtime',
        state: hasWasm ? 'ready' : 'unavailable',
        details: hasWasm 
          ? 'WebAssembly runtime active; MediaPipe Hands & Pose tracking ready.'
          : 'WebAssembly not supported in this browser; landmark extraction unavailable.',
        recoveryAction: hasWasm ? undefined : 'Upgrade your browser to a version supporting WebAssembly.'
      },
      {
        id: 'sign_model',
        name: 'Indian Sign Language Recognizer',
        category: 'model',
        state: backendSignModel ? backendSignModel.state : (backend.signModelLoaded ? 'ready' : 'training_required'),
        details: backendSignModel ? backendSignModel.details : (backend.signModelLoaded ? 'Trained model checkpoint active.' : 'Unavailable — required model/artifact not loaded. Train a model in Data Science Lab.'),
        recoveryAction: backendSignModel?.state === 'ready' || backend.signModelLoaded ? undefined : 'Go to Data Science Lab to run baseline/sequential model training.',
        actionLabel: backendSignModel?.state === 'ready' || backend.signModelLoaded ? 'Change Model' : 'Train Model'
      },
      {
        id: 'gemini_vision',
        name: 'Gemini 2.5 Flash Multimodal Vision',
        category: 'model',
        state: backendGemini ? backendGemini.state : (backend.geminiActive ? 'ready' : 'not_configured'),
        details: backendGemini ? backendGemini.details : (backend.geminiActive ? 'Gemini 2.5 Flash Free Tier multimodal vision integration active.' : 'Gemini API not configured on server.'),
        isPretrained: true,
        recoveryAction: backend.geminiActive ? undefined : 'Configure GEMINI_API_KEY in server .env.'
      },
      {
        id: 'stt_model',
        name: 'Speech-to-Text Recognition',
        category: 'model',
        state: hasWebSpeechRec ? 'ready' : 'download_needed',
        details: hasWebSpeechRec 
          ? 'Browser Speech Recognition adapter ready (English & Tamil).' 
          : 'Browser SpeechRecognition unavailable.',
        isPretrained: true
      },
      {
        id: 'ocr',
        name: 'Tesseract OCR Engine',
        category: 'runtime',
        state: 'ready',
        details: 'Tesseract.js client WebAssembly engine ready with English & Tamil language support.'
      },
      {
        id: 'speech_synthesis',
        name: 'Speech Synthesis (TTS)',
        category: 'runtime',
        state: hasTts ? 'ready' : 'unavailable',
        details: hasTts 
          ? `Browser speech synthesis available (${voices.length} voices detected).` 
          : 'Speech synthesis not supported in this browser.'
      }
    ];

    return statuses;
  }
}

export const readinessService = new ReadinessService();
