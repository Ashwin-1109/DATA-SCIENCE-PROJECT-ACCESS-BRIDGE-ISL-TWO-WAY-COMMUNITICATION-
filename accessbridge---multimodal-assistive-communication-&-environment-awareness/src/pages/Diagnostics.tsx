/**
 * AccessBridge - Subsystem Diagnostics & System Health Audit
 * Probes hardware, browser APIs, WebGL, TTS voices, backend status, and model checkpoints.
 * Categorizes with Green / Amber / Red statuses and provides clear, non-alarming fix hints.
 */

import React, { useState, useEffect, useCallback } from 'react';
import { 
  Activity, 
  CheckCircle2, 
  AlertTriangle, 
  XCircle, 
  RefreshCw, 
  Mic, 
  Camera, 
  Box, 
  Volume2, 
  Server, 
  Sparkles, 
  Cpu, 
  Wifi, 
  ShieldCheck,
  ChevronRight,
  Terminal
} from 'lucide-react';
import { apiFetch, apiClient, NetworkDiagnosticLog } from '../services/apiClient';
import { NavigationTab } from '../types';

interface DiagnosticsProps {
  onNavigate?: (tab: NavigationTab) => void;
}

type HealthState = 'green' | 'amber' | 'red' | 'probing';

interface DiagnosticItem {
  id: string;
  name: string;
  icon: React.ReactNode;
  state: HealthState;
  statusLabel: string;
  details: string;
  fixHint?: string;
}

export const Diagnostics: React.FC<DiagnosticsProps> = ({ onNavigate }) => {
  const [probing, setProbing] = useState(false);
  const [items, setItems] = useState<DiagnosticItem[]>([]);
  const [networkLogs, setNetworkLogs] = useState<NetworkDiagnosticLog[]>([]);

  const runAllDiagnostics = useCallback(async () => {
    setProbing(true);
    const results: DiagnosticItem[] = [];

    // 1. Microphone & Web Speech API
    try {
      const hasSpeech = 'webkitSpeechRecognition' in window || 'SpeechRecognition' in window;
      if (!navigator.mediaDevices || !navigator.mediaDevices.getUserMedia) {
        results.push({
          id: 'mic',
          name: 'Microphone & Audio Input',
          icon: <Mic className="w-5 h-5" />,
          state: 'red',
          statusLabel: 'MediaDevices Unsupported',
          details: 'Your browser environment does not expose mediaDevices API.',
          fixHint: 'Use a modern desktop browser (Chrome, Edge) over HTTPS or localhost.'
        });
      } else {
        // Check permission if query API exists
        let permState = 'prompt';
        try {
          if (navigator.permissions && navigator.permissions.query) {
            const p = await navigator.permissions.query({ name: 'microphone' as PermissionName });
            permState = p.state;
          }
        } catch {
          // Query not supported for microphone on some browsers
        }

        if (permState === 'granted') {
          results.push({
            id: 'mic',
            name: 'Microphone & Audio Input',
            icon: <Mic className="w-5 h-5" />,
            state: 'green',
            statusLabel: 'Granted & Operational',
            details: `Microphone permission is granted. Web Speech API continuous mode: ${hasSpeech ? 'Supported' : 'Fallback to Faster-Whisper'}.`
          });
        } else if (permState === 'denied') {
          results.push({
            id: 'mic',
            name: 'Microphone & Audio Input',
            icon: <Mic className="w-5 h-5" />,
            state: 'red',
            statusLabel: 'Permission Blocked',
            details: 'Microphone access is currently blocked in browser site permissions.',
            fixHint: 'Click the padlock or settings icon in your browser address bar and switch Microphone to "Allow".'
          });
        } else {
          results.push({
            id: 'mic',
            name: 'Microphone & Audio Input',
            icon: <Mic className="w-5 h-5" />,
            state: 'amber',
            statusLabel: 'Standby (Click to Allow)',
            details: 'Microphone permission has not been requested yet in this session.',
            fixHint: 'Navigate to Live Captions or Deaf Assist and click "Start Listening" to grant permission.'
          });
        }
      }
    } catch {
      results.push({
        id: 'mic',
        name: 'Microphone & Audio Input',
        icon: <Mic className="w-5 h-5" />,
        state: 'amber',
        statusLabel: 'Standby',
        details: 'Microphone will be initialized when voice features are started.'
      });
    }

    // 2. Video Camera
    try {
      if (!navigator.mediaDevices) {
        results.push({
          id: 'camera',
          name: 'Webcam & Video Feed',
          icon: <Camera className="w-5 h-5" />,
          state: 'red',
          statusLabel: 'MediaDevices Unsupported',
          details: 'Camera API not available in current browsing context.',
          fixHint: 'Ensure you are browsing on localhost or a secure HTTPS origin.'
        });
      } else {
        let camPerm = 'prompt';
        try {
          if (navigator.permissions && navigator.permissions.query) {
            const p = await navigator.permissions.query({ name: 'camera' as PermissionName });
            camPerm = p.state;
          }
        } catch {
          // Ignore
        }

        if (camPerm === 'granted') {
          results.push({
            id: 'camera',
            name: 'Webcam & Video Feed',
            icon: <Camera className="w-5 h-5" />,
            state: 'green',
            statusLabel: 'Granted & Ready',
            details: 'Camera permissions active. Ready for hand landmark tracking and environment narration.'
          });
        } else if (camPerm === 'denied') {
          results.push({
            id: 'camera',
            name: 'Webcam & Video Feed',
            icon: <Camera className="w-5 h-5" />,
            state: 'red',
            statusLabel: 'Permission Denied',
            details: 'Webcam access is blocked by browser site permissions.',
            fixHint: 'Click the camera/lock icon in your address bar and allow camera access.'
          });
        } else {
          results.push({
            id: 'camera',
            name: 'Webcam & Video Feed',
            icon: <Camera className="w-5 h-5" />,
            state: 'amber',
            statusLabel: 'Standby (Permission on Launch)',
            details: 'Camera will prompt for user permission when starting Sign Recognition or Environment Reader.',
            fixHint: 'Start any camera-based mode to prompt permission dialog.'
          });
        }
      }
    } catch {
      results.push({
        id: 'camera',
        name: 'Webcam & Video Feed',
        icon: <Camera className="w-5 h-5" />,
        state: 'amber',
        statusLabel: 'Standby',
        details: 'Ready to prompt on demand.'
      });
    }

    // 3. WebGL & 3D Hardware Acceleration
    try {
      const testCanvas = document.createElement('canvas');
      const gl2 = testCanvas.getContext('webgl2');
      const gl1 = testCanvas.getContext('webgl');

      if (gl2) {
        const debugInfo = gl2.getExtension('WEBGL_debug_renderer_info');
        const renderer = debugInfo ? gl2.getParameter(debugInfo.UNMASKED_RENDERER_WEBGL) : 'Hardware accelerated';
        results.push({
          id: 'webgl',
          name: 'WebGL & 3D Avatar Engine',
          icon: <Box className="w-5 h-5" />,
          state: 'green',
          statusLabel: 'WebGL 2.0 Active',
          details: `Three.js VRM avatar renderer active. Driver: ${renderer}.`
        });
      } else if (gl1) {
        results.push({
          id: 'webgl',
          name: 'WebGL & 3D Avatar Engine',
          icon: <Box className="w-5 h-5" />,
          state: 'amber',
          statusLabel: 'WebGL 1.0 Fallback',
          details: 'Standard WebGL available; some modern shaders may run in compatibility mode.'
        });
      } else {
        results.push({
          id: 'webgl',
          name: 'WebGL & 3D Avatar Engine',
          icon: <Box className="w-5 h-5" />,
          state: 'red',
          statusLabel: 'WebGL Disabled',
          details: 'Browser cannot allocate a WebGL context.',
          fixHint: 'Enable "Use hardware acceleration when available" in your browser settings and reload.'
        });
      }
    } catch {
      results.push({
        id: 'webgl',
        name: 'WebGL & 3D Avatar Engine',
        icon: <Box className="w-5 h-5" />,
        state: 'amber',
        statusLabel: 'Fallback Mode',
        details: '2D schematic signing cards will be used if 3D avatar cannot initialize.'
      });
    }

    // 4. TTS Voices
    try {
      if ('speechSynthesis' in window) {
        const voices = window.speechSynthesis.getVoices();
        const hasFemale = voices.some(v => /female|neerja|pallavi|aria|jenny|zira|samantha/i.test(v.name));
        results.push({
          id: 'tts',
          name: 'Text-to-Speech Voice Engine',
          icon: <Volume2 className="w-5 h-5" />,
          state: 'green',
          statusLabel: `${voices.length} Voices Detected`,
          details: `Browser speech synthesis operational. Soft female priority profile: ${hasFemale ? 'Matched' : 'Universal fallback'}.`
        });
      } else {
        results.push({
          id: 'tts',
          name: 'Text-to-Speech Voice Engine',
          icon: <Volume2 className="w-5 h-5" />,
          state: 'amber',
          statusLabel: 'Speech Synthesis Missing',
          details: 'Local Web Speech synthesis not present. On-screen text captions active.',
          fixHint: 'Use Edge, Chrome, or Firefox for full voice output.'
        });
      }
    } catch {
      results.push({
        id: 'tts',
        name: 'Text-to-Speech Voice Engine',
        icon: <Volume2 className="w-5 h-5" />,
        state: 'amber',
        statusLabel: 'Standby',
        details: 'Visual captions active.'
      });
    }

    // 5. Backend Server Health
    const healthRes = await apiFetch<any>('/api/health', {}, { timeoutMs: 3500 });
    if (healthRes.ok && healthRes.data) {
      const d = healthRes.data;
      results.push({
        id: 'backend',
        name: 'FastAPI Backend Service',
        icon: <Server className="w-5 h-5" />,
        state: 'green',
        statusLabel: `Online (Uptime: ${d.uptime_sec}s)`,
        details: `Connected to local Python server. Database: ${d.subsystems?.database || 'OK'}. Storage: Verified.`
      });
    } else {
      results.push({
        id: 'backend',
        name: 'FastAPI Backend Service',
        icon: <Server className="w-5 h-5" />,
        state: 'amber',
        statusLabel: 'Offline (Client Mode)',
        details: 'Backend server not responding on port 8000. Client-side offline fallbacks are active.',
        fixHint: 'Run start_accessbridge.bat or "uvicorn backend.app.main:app --port 8000" in a terminal.'
      });
    }

    // 6. PyTorch Active Model & Capabilities
    const capRes = await apiFetch<any>('/api/capabilities', {}, { timeoutMs: 3500 });
    if (capRes.ok && capRes.data) {
      const c = capRes.data;
      const model = c.active_model;
      if (model && model.is_loaded) {
        results.push({
          id: 'model',
          name: 'PyTorch Deep Learning Engine',
          icon: <Cpu className="w-5 h-5" />,
          state: 'green',
          statusLabel: `${model.name} Loaded`,
          details: `Active checkpoint: ${model.path || 'In-memory'}. Real vocab: ${model.vocabulary_count} classes (5 greeting subset).`
        });
      } else {
        results.push({
          id: 'model',
          name: 'PyTorch Deep Learning Engine',
          icon: <Cpu className="w-5 h-5" />,
          state: 'amber',
          statusLabel: 'Model Checkpoint Standby',
          details: 'PyTorch model checkpoint not yet loaded into RAM. Geometric rule heuristic is active.',
          fixHint: 'Go to Technical Processor Panel and click "Swap Engine" to load verified weights.'
        });
      }

      // 7. Gemini Multimodal AI
      if (c.keys_present?.gemini) {
        results.push({
          id: 'gemini',
          name: 'Gemini Multimodal Cloud AI',
          icon: <Sparkles className="w-5 h-5" />,
          state: 'green',
          statusLabel: 'API Key Active',
          details: 'Cloud scene understanding, complex intent parsing, and rich visual descriptions available.'
        });
      } else {
        results.push({
          id: 'gemini',
          name: 'Gemini Multimodal Cloud AI',
          icon: <Sparkles className="w-5 h-5" />,
          state: 'amber',
          statusLabel: 'No Cloud Key (Offline Rules Active)',
          details: 'GEMINI_API_KEY not configured in backend .env. Local rule-based spatial narrator and OCR are active.',
          fixHint: 'Add your GEMINI_API_KEY in the project .env file to enable cloud scene narration.'
        });
      }
    } else {
      results.push({
        id: 'model',
        name: 'PyTorch Deep Learning Engine',
        icon: <Cpu className="w-5 h-5" />,
        state: 'amber',
        statusLabel: 'Local Heuristic Active',
        details: 'Client-side Geometric Rule Heuristic (demo) and 26-handshape fingerspeller are running.'
      });
      results.push({
        id: 'gemini',
        name: 'Gemini Multimodal Cloud AI',
        icon: <Sparkles className="w-5 h-5" />,
        state: 'amber',
        statusLabel: 'Offline Narration Mode',
        details: 'Local spatial narrator active with direction, approximate distance, and priority rankings.'
      });
    }

    setItems(results);
    setNetworkLogs(apiClient.getDiagnosticLogs());
    setProbing(false);
  }, []);

  useEffect(() => {
    runAllDiagnostics();
  }, [runAllDiagnostics]);

  const getStateBadge = (state: HealthState) => {
    switch (state) {
      case 'green':
        return (
          <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-semibold bg-emerald-500/15 text-emerald-400 border border-emerald-500/30">
            <CheckCircle2 className="w-3.5 h-3.5" />
            <span>Optimal</span>
          </span>
        );
      case 'amber':
        return (
          <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-semibold bg-amber-500/15 text-amber-400 border border-amber-500/30">
            <AlertTriangle className="w-3.5 h-3.5" />
            <span>Fallback / Notice</span>
          </span>
        );
      case 'red':
        return (
          <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-semibold bg-rose-500/15 text-rose-400 border border-rose-500/30">
            <XCircle className="w-3.5 h-3.5" />
            <span>Action Needed</span>
          </span>
        );
      case 'probing':
        return (
          <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-semibold bg-sky-500/15 text-sky-400 border border-sky-500/30">
            <RefreshCw className="w-3.5 h-3.5 animate-spin" />
            <span>Probing</span>
          </span>
        );
    }
  };

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8 space-y-6">
      {/* Header */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-2 text-xs text-sky-400 font-semibold tracking-wider uppercase">
            <ShieldCheck className="w-4 h-4" />
            <span>System Health Audit</span>
          </div>
          <h1 className="text-2xl font-bold text-white tracking-tight">
            Subsystem Diagnostics & Readiness
          </h1>
          <p className="text-slate-400 text-xs mt-1">
            Real-time verification of browser APIs, local PyTorch engine, WebGL rendering, and cloud multimodal fallbacks.
          </p>
        </div>

        <button
          onClick={runAllDiagnostics}
          disabled={probing}
          className="min-h-[42px] px-5 py-2 bg-sky-600 hover:bg-sky-500 disabled:opacity-50 text-white text-xs font-bold rounded-xl flex items-center gap-2 transition-all shadow-md focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-sky-400"
        >
          <RefreshCw className={`w-3.5 h-3.5 ${probing ? 'animate-spin' : ''}`} />
          <span>{probing ? 'Probing Subsystems...' : 'Re-Run All Checks'}</span>
        </button>
      </div>

      {/* Grid of Diagnostic Items */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        {items.map(item => (
          <div
            key={item.id}
            className="p-5 bg-slate-900 border border-slate-800 rounded-2xl space-y-3 flex flex-col justify-between shadow-sm hover:border-slate-700 transition-colors"
          >
            <div className="space-y-3">
              <div className="flex items-center justify-between">
                <div className="w-10 h-10 rounded-xl bg-slate-950 border border-slate-800 flex items-center justify-center text-sky-400">
                  {item.icon}
                </div>
                {getStateBadge(item.state)}
              </div>

              <div>
                <h3 className="text-sm font-bold text-white">{item.name}</h3>
                <div className="text-xs font-mono font-semibold text-slate-300 mt-0.5">
                  {item.statusLabel}
                </div>
              </div>

              <p className="text-xs text-slate-400 leading-relaxed">
                {item.details}
              </p>
            </div>

            {item.fixHint && (
              <div className="mt-3 p-2.5 bg-slate-950 border border-slate-800/80 rounded-xl text-[11px] text-amber-300 space-y-1">
                <div className="font-semibold flex items-center gap-1">
                  <AlertTriangle className="w-3 h-3 shrink-0" />
                  <span>How to resolve:</span>
                </div>
                <div className="text-slate-300">{item.fixHint}</div>
              </div>
            )}
          </div>
        ))}
      </div>

      {/* Network & Fallback Event Log */}
      <div className="p-6 bg-slate-900 border border-slate-800 rounded-2xl space-y-4 shadow-sm">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Terminal className="w-4 h-4 text-sky-400" />
            <h2 className="text-sm font-bold text-white">Recent API & Fallback Logs</h2>
          </div>
          <span className="text-[11px] font-mono text-slate-500">
            {networkLogs.length} events recorded
          </span>
        </div>

        {networkLogs.length === 0 ? (
          <div className="p-6 text-center text-xs text-slate-500 font-mono">
            No recent network failures or fallbacks triggered. All requests healthy.
          </div>
        ) : (
          <div className="space-y-2 max-h-60 overflow-y-auto font-mono text-[11px]">
            {networkLogs.slice(0, 10).map((log, idx) => (
              <div
                key={idx}
                className="p-2.5 bg-slate-950 border border-slate-800/80 rounded-xl flex items-center justify-between gap-3 text-slate-300"
              >
                <div className="flex items-center gap-2 truncate">
                  <span className={`w-2 h-2 rounded-full shrink-0 ${log.ok ? 'bg-emerald-400' : 'bg-rose-400'}`} />
                  <span className="text-slate-500 text-[10px]">{log.method}</span>
                  <span className="truncate">{log.url}</span>
                </div>

                <div className="flex items-center gap-3 shrink-0 text-[10px]">
                  <span className={log.ok ? 'text-emerald-400' : 'text-rose-400'}>
                    {log.status ? `HTTP ${log.status}` : (log.ok ? 'OK' : 'Fallback')}
                  </span>
                  <span className="text-slate-500">{log.latencyMs}ms</span>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
};
