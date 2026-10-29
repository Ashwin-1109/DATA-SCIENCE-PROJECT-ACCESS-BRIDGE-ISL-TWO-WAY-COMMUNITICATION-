import React, { useState, useEffect } from 'react';
import { 
  Settings as SettingsIcon, 
  Volume2, 
  Eye, 
  Sliders, 
  Trash2, 
  Download, 
  Database, 
  CheckCircle2, 
  AlertTriangle,
  RotateCcw,
  Sparkles,
  ShieldCheck,
  Server
} from 'lucide-react';
import { AccessibilitySettings, NavigationTab } from '../types';
import { ttsService, SpeechVoiceOption } from '../services/ttsService';
import { storageService, DEFAULT_SETTINGS } from '../services/storageService';

interface SettingsProps {
  settings: AccessibilitySettings;
  onUpdateSettings: (newSettings: Partial<AccessibilitySettings>) => void;
  onNavigate: (tab: NavigationTab) => void;
}

export const Settings: React.FC<SettingsProps> = ({
  settings,
  onUpdateSettings,
  onNavigate
}) => {
  const [voices, setVoices] = useState<SpeechVoiceOption[]>([]);
  const [backendUrl, setBackendUrl] = useState<string>('http://localhost:8000');
  const [saveNotice, setSaveNotice] = useState(false);

  useEffect(() => {
    const available = ttsService.getVoices();
    setVoices(available);
  }, []);

  const handleTestVoice = () => {
    ttsService.speak('This is a test of the AccessBridge accessibility speech synthesizer.', {
      voiceURI: settings.speechVoiceUri,
      rate: settings.speechRate,
      pitch: settings.speechPitch
    });
  };

  const handleResetDefaults = () => {
    onUpdateSettings(DEFAULT_SETTINGS);
    storageService.saveSettings(DEFAULT_SETTINGS);
    setSaveNotice(true);
    setTimeout(() => setSaveNotice(false), 2000);
  };

  const handleWipeAllData = () => {
    if (window.confirm('Are you sure you want to wipe all local transcripts, conversations, and settings? This cannot be undone.')) {
      storageService.wipeAllData();
      onUpdateSettings(DEFAULT_SETTINGS);
      alert('All local user data has been securely cleared.');
    }
  };

  return (
    <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 py-8 space-y-6">
      {/* Title */}
      <div className="flex items-center justify-between">
        <div>
          <div className="flex items-center gap-2 text-xs text-sky-400 font-semibold tracking-wider uppercase">
            <span>Preferences</span>
            <span aria-hidden="true">·</span>
            <span>Accessibility & Privacy</span>
          </div>
          <h1 className="text-2xl font-bold text-white tracking-tight">
            Settings & Configurations
          </h1>
        </div>

        {saveNotice && (
          <span className="text-xs text-emerald-400 font-medium flex items-center gap-1">
            <CheckCircle2 className="w-4 h-4" />
            <span>Settings updated</span>
          </span>
        )}
      </div>

      {/* Section 1: Accessibility & Display */}
      <div className="bg-slate-900 border border-slate-800 rounded-xl p-5 shadow-sm space-y-4">
        <div className="flex items-center gap-2 text-white font-semibold text-sm">
          <Eye className="w-4 h-4 text-sky-400" />
          <span>Visual Accessibility & Theme</span>
        </div>

        <div className="space-y-4 divide-y divide-slate-800/80 text-xs">
          {/* High Contrast */}
          <div className="pt-3 first:pt-0 flex items-center justify-between">
            <div>
              <div className="font-semibold text-slate-200">High Contrast Mode</div>
              <div className="text-slate-400 mt-0.5">Increases surface and border contrast for maximum legibility.</div>
            </div>
            <button
              onClick={() => onUpdateSettings({ highContrast: !settings.highContrast })}
              className={`min-h-[40px] px-4 py-2 rounded-lg font-semibold transition-colors ${
                settings.highContrast 
                  ? 'bg-amber-400 text-black' 
                  : 'bg-slate-800 text-slate-300 hover:text-white'
              }`}
              aria-pressed={settings.highContrast}
            >
              {settings.highContrast ? 'Enabled' : 'Disabled'}
            </button>
          </div>

          {/* Font Size */}
          <div className="pt-3 flex items-center justify-between">
            <div>
              <div className="font-semibold text-slate-200">Application Text Size</div>
              <div className="text-slate-400 mt-0.5">Scales typography throughout all workflows up to 130%.</div>
            </div>
            <div className="flex items-center gap-1 bg-slate-950 p-1 rounded-lg border border-slate-800">
              <button
                onClick={() => onUpdateSettings({ fontSize: 'normal' })}
                className={`min-h-[36px] px-3 py-1 font-medium rounded ${
                  settings.fontSize === 'normal' ? 'bg-sky-600 text-white' : 'text-slate-400 hover:text-slate-200'
                }`}
              >
                100%
              </button>
              <button
                onClick={() => onUpdateSettings({ fontSize: 'large' })}
                className={`min-h-[36px] px-3 py-1 font-medium rounded ${
                  settings.fontSize === 'large' ? 'bg-sky-600 text-white' : 'text-slate-400 hover:text-slate-200'
                }`}
              >
                115%
              </button>
              <button
                onClick={() => onUpdateSettings({ fontSize: 'extralarge' })}
                className={`min-h-[36px] px-3 py-1 font-medium rounded ${
                  settings.fontSize === 'extralarge' ? 'bg-sky-600 text-white' : 'text-slate-400 hover:text-slate-200'
                }`}
              >
                130%
              </button>
            </div>
          </div>

          {/* Reduced Motion */}
          <div className="pt-3 flex items-center justify-between">
            <div>
              <div className="font-semibold text-slate-200">Reduced Motion</div>
              <div className="text-slate-400 mt-0.5">Minimizes animated transitions and blinking cursors.</div>
            </div>
            <button
              onClick={() => onUpdateSettings({ reducedMotion: !settings.reducedMotion })}
              className={`min-h-[40px] px-4 py-2 rounded-lg font-semibold transition-colors ${
                settings.reducedMotion 
                  ? 'bg-sky-600 text-white' 
                  : 'bg-slate-800 text-slate-300 hover:text-white'
              }`}
            >
              {settings.reducedMotion ? 'Enabled' : 'Disabled'}
            </button>
          </div>
        </div>
      </div>

      {/* Section 2: Audio & Speech Synthesis Feedback */}
      <div className="bg-slate-900 border border-slate-800 rounded-xl p-5 shadow-sm space-y-4">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2 text-white font-semibold text-sm">
            <Volume2 className="w-4 h-4 text-sky-400" />
            <span>Audio & Speech Synthesis (TTS)</span>
          </div>
          <button
            onClick={handleTestVoice}
            className="min-h-[36px] px-3 py-1 bg-slate-800 hover:bg-slate-700 text-slate-200 text-xs font-medium rounded-lg flex items-center gap-1.5 transition-colors"
          >
            <Volume2 className="w-3.5 h-3.5 text-sky-400" />
            <span>Test Voice</span>
          </button>
        </div>

        <div className="space-y-4 text-xs">
          {/* Voice Selector */}
          <div className="space-y-1.5">
            <label className="text-slate-300 font-medium">Text-to-Speech Voice</label>
            <select
              value={settings.speechVoiceUri}
              onChange={(e) => onUpdateSettings({ speechVoiceUri: e.target.value })}
              className="w-full min-h-[42px] bg-slate-950 border border-slate-800 rounded-lg px-3 py-2 text-slate-200"
            >
              <option value="">Default System Voice</option>
              {voices.map(v => (
                <option key={v.voiceURI} value={v.voiceURI}>
                  {v.name} ({v.lang})
                </option>
              ))}
            </select>
          </div>

          {/* Rate and Pitch Sliders */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div className="space-y-1.5">
              <div className="flex items-center justify-between text-slate-300">
                <span>Speech Rate ({settings.speechRate.toFixed(1)}x)</span>
              </div>
              <input
                type="range"
                min="0.7"
                max="1.5"
                step="0.1"
                value={settings.speechRate}
                onChange={(e) => onUpdateSettings({ speechRate: parseFloat(e.target.value) })}
                className="w-full accent-sky-500"
              />
            </div>

            <div className="space-y-1.5">
              <div className="flex items-center justify-between text-slate-300">
                <span>Speech Pitch ({settings.speechPitch.toFixed(1)})</span>
              </div>
              <input
                type="range"
                min="0.8"
                max="1.3"
                step="0.1"
                value={settings.speechPitch}
                onChange={(e) => onUpdateSettings({ speechPitch: parseFloat(e.target.value) })}
                className="w-full accent-sky-500"
              />
            </div>
          </div>
        </div>
      </div>

      {/* Section 3: Local Backend Endpoint Configuration */}
      <div className="bg-slate-900 border border-slate-800 rounded-xl p-5 shadow-sm space-y-4">
        <div className="flex items-center gap-2 text-white font-semibold text-sm">
          <Server className="w-4 h-4 text-sky-400" />
          <span>Python Backend Server Endpoint</span>
        </div>

        <div className="space-y-2 text-xs">
          <label className="text-slate-300">FastAPI Server URL</label>
          <div className="flex items-center gap-2">
            <input
              type="text"
              value={backendUrl}
              onChange={(e) => setBackendUrl(e.target.value)}
              className="flex-1 bg-slate-950 border border-slate-800 rounded-lg px-3 py-2 text-slate-200 font-mono"
            />
            <button
              onClick={() => {
                alert(`Backend target set to ${backendUrl}. Ensure local uvicorn process is listening on this port.`);
              }}
              className="min-h-[40px] px-4 py-2 bg-slate-800 hover:bg-slate-700 text-slate-200 font-medium rounded-lg"
            >
              Verify
            </button>
          </div>
          <p className="text-slate-500 text-[11px]">
            Default: <code className="text-slate-400">http://localhost:8000</code>. To launch local backend, run <code className="text-sky-400">start.bat</code> (Windows) or <code className="text-sky-400">./start.sh</code> (Linux).
          </p>
        </div>
      </div>

      {/* Section 4: Privacy & Data Hygiene */}
      <div className="bg-slate-900 border border-slate-800 rounded-xl p-5 shadow-sm space-y-4">
        <div className="flex items-center gap-2 text-white font-semibold text-sm">
          <ShieldCheck className="w-4 h-4 text-emerald-400" />
          <span>Local Storage & Privacy Assurance</span>
        </div>

        <p className="text-slate-400 text-xs leading-relaxed">
          AccessBridge is designed with privacy-first principles. Camera video frames and microphone audio streams are processed locally in real-time memory and never uploaded to remote cloud servers. Conversation logs and caption transcripts remain exclusively on your local device.
        </p>

        <div className="pt-2 flex flex-wrap items-center gap-3">
          <button
            onClick={handleResetDefaults}
            className="min-h-[40px] px-3.5 py-2 bg-slate-800 hover:bg-slate-700 text-slate-200 text-xs font-medium rounded-lg flex items-center gap-1.5 transition-colors"
          >
            <RotateCcw className="w-3.5 h-3.5" />
            <span>Reset Settings to Default</span>
          </button>

          <button
            onClick={handleWipeAllData}
            className="min-h-[40px] px-3.5 py-2 bg-rose-950/40 hover:bg-rose-900/60 border border-rose-900/80 text-rose-300 text-xs font-medium rounded-lg flex items-center gap-1.5 transition-colors"
          >
            <Trash2 className="w-3.5 h-3.5 text-rose-400" />
            <span>Wipe All Local Session Data</span>
          </button>
        </div>
      </div>
    </div>
  );
};
