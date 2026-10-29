import React, { useState, useEffect, useRef } from 'react';
import { 
  Ear, 
  Mic, 
  MicOff, 
  Volume2, 
  Bell, 
  AlertTriangle, 
  Copy, 
  Trash2, 
  Download, 
  Send, 
  Sparkles,
  Info,
  Clock,
  Eye,
  Type
} from 'lucide-react';
import { CaptionItem, EnvironmentalSoundAlert, NavigationTab } from '../types';
import { captionService } from '../services/captionService';
import { ttsService } from '../services/ttsService';
import { storageService } from '../services/storageService';
import { BiDirectionalSignTranslator } from '../components/BiDirectionalSignTranslator';

interface DeafInterfaceProps {
  onNavigate: (tab: NavigationTab) => void;
}

export const DeafInterface: React.FC<DeafInterfaceProps> = ({ onNavigate }) => {
  // Speech Captioning state
  const [isListening, setIsListening] = useState(false);
  const [captionLang, setCaptionLang] = useState<'en' | 'ta'>('en');
  const [currentInterimText, setCurrentInterimText] = useState('');
  const [captions, setCaptions] = useState<CaptionItem[]>(() => storageService.getCaptionHistory());
  const [captionSize, setCaptionSize] = useState<'text-xl' | 'text-3xl' | 'text-4xl'>('text-3xl');

  // Visual Environmental Sound Radar
  const [soundIntensity, setSoundIntensity] = useState<number>(15);
  const [soundAlerts, setSoundAlerts] = useState<EnvironmentalSoundAlert[]>([]);
  const [screenFlash, setScreenFlash] = useState<boolean>(false);
  const audioContextRef = useRef<AudioContext | null>(null);
  const analyserRef = useRef<AnalyserNode | null>(null);
  const micStreamRef = useRef<MediaStream | null>(null);
  const animFrameRef = useRef<number | null>(null);

  // Quick Reply Text-to-Speech
  const [replyText, setReplyText] = useState('');
  const [lastSpokenReply, setLastSpokenReply] = useState('');

  const captionScrollRef = useRef<HTMLDivElement | null>(null);

  // Auto-scroll captions
  useEffect(() => {
    if (captionScrollRef.current) {
      captionScrollRef.current.scrollTop = captionScrollRef.current.scrollHeight;
    }
  }, [captions, currentInterimText]);

  // Audio level analyzer for visual sound radar
  const startSoundRadar = async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      micStreamRef.current = stream;

      const AudioCtx = window.AudioContext || (window as any).webkitAudioContext;
      const ctx = new AudioCtx();
      audioContextRef.current = ctx;

      const source = ctx.createMediaStreamSource(stream);
      const analyser = ctx.createAnalyser();
      analyser.fftSize = 256;
      source.connect(analyser);
      analyserRef.current = analyser;

      const dataArray = new Uint8Array(analyser.frequencyBinCount);

      const checkVolume = () => {
        analyser.getByteFrequencyData(dataArray);
        let sum = 0;
        for (let i = 0; i < dataArray.length; i++) {
          sum += dataArray[i];
        }
        const avg = sum / dataArray.length;
        const normalized = Math.min(100, Math.round((avg / 128) * 100));
        setSoundIntensity(normalized);

        // Sound spike detection
        if (normalized > 75) {
          triggerSoundAlert('Loud sound spike detected in room!', 'loud_noise', normalized);
        }

        animFrameRef.current = requestAnimationFrame(checkVolume);
      };

      checkVolume();
    } catch (e) {
      console.warn('Audio radar microphone notice:', e);
    }
  };

  const stopSoundRadar = () => {
    if (animFrameRef.current) cancelAnimationFrame(animFrameRef.current);
    if (micStreamRef.current) {
      micStreamRef.current.getTracks().forEach(t => t.stop());
      micStreamRef.current = null;
    }
    if (audioContextRef.current && audioContextRef.current.state !== 'closed') {
      audioContextRef.current.close();
      audioContextRef.current = null;
    }
  };

  const lastSoundAlertTimeRef = useRef<number>(0);

  const triggerSoundAlert = (label: string, type: EnvironmentalSoundAlert['type'], intensity: number) => {
    const now = Date.now();
    // Debounce alerts to prevent spam (minimum 4 seconds between triggers)
    if (now - lastSoundAlertTimeRef.current < 4000) {
      return;
    }
    lastSoundAlertTimeRef.current = now;

    // Flash screen for visual warning
    setScreenFlash(true);
    setTimeout(() => setScreenFlash(false), 500);

    const newAlert: EnvironmentalSoundAlert = {
      id: `alert_${now}`,
      label,
      timestamp: new Date().toLocaleTimeString(),
      intensity,
      type
    };

    setSoundAlerts(prev => [newAlert, ...prev.slice(0, 4)]);
  };

  // Toggle Live Speech Captions
  const handleToggleListening = () => {
    if (isListening) {
      captionService.stopListening();
      stopSoundRadar();
      setIsListening(false);
      setCurrentInterimText('');
    } else {
      startSoundRadar();
      const started = captionService.startListening(
        captionLang,
        (cap) => {
          if (cap.isFinal) {
            setCaptions(prev => {
              const updated = [...prev, cap];
              storageService.saveCaptionHistory(updated);
              return updated;
            });
            setCurrentInterimText('');
          } else {
            setCurrentInterimText(cap.text);
          }
        },
        (err) => {
          console.error(err);
          setIsListening(false);
        },
        () => {}
      );
      if (started) setIsListening(true);
    }
  };

  useEffect(() => {
    return () => {
      captionService.stopListening();
      stopSoundRadar();
    };
  }, []);

  // Quick reply speak
  const handleSendReply = (textToSpeak?: string) => {
    const text = (textToSpeak || replyText).trim();
    if (!text) return;

    ttsService.speak(text);
    setLastSpokenReply(text);

    // Save turn to conversation
    const conv = storageService.getConversation();
    storageService.saveConversation([
      ...conv,
      {
        id: `turn_${Date.now()}`,
        timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
        sender: 'signer',
        text
      }
    ]);

    if (!textToSpeak) setReplyText('');
  };

  const quickResponses = [
    'I am deaf / hard of hearing. Please speak clearly or write here.',
    'Yes, I understand.',
    'No, thank you.',
    'Could you please repeat that?',
    'Please give me one minute.',
    'Thank you so much for your assistance.'
  ];

  return (
    <div className={`min-h-[85vh] py-6 px-4 sm:px-6 lg:px-8 max-w-7xl mx-auto space-y-6 transition-colors duration-200 ${screenFlash ? 'bg-amber-950/30' : ''}`}>
      {/* Top Banner: Mode Indicator */}
      <div className="bg-slate-900 border-2 border-sky-500/70 rounded-2xl p-5 shadow-lg flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div className="flex items-center gap-3.5">
          <div className="w-12 h-12 rounded-xl bg-sky-600 flex items-center justify-center text-white shrink-0 shadow-md">
            <Ear className="w-6 h-6" aria-hidden="true" />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <span className="text-xs font-bold uppercase tracking-wider text-sky-400">Accessible Mode 1</span>
              <span className="text-slate-500" aria-hidden="true">·</span>
              <span className="text-xs text-slate-300">Zero Audio Dependency</span>
            </div>
            <h1 className="text-2xl font-black text-white tracking-tight">
              Deaf & Hard-of-Hearing Assist
            </h1>
            <p className="text-xs text-slate-400 mt-0.5">
              Real-time high-legibility speech captions, visual sound radar alerts, and quick visual-to-speech bridge.
            </p>
          </div>
        </div>

        {/* Captions Language Toggle */}
        <div className="flex items-center gap-2">
          <div className="flex items-center p-1 bg-slate-950 border border-slate-800 rounded-xl">
            <button
              onClick={() => {
                if (isListening) handleToggleListening();
                setCaptionLang('en');
              }}
              className={`min-h-[38px] px-3.5 py-1.5 text-xs font-bold rounded-lg transition-colors ${
                captionLang === 'en' ? 'bg-sky-600 text-white' : 'text-slate-400 hover:text-white'
              }`}
            >
              English
            </button>
            <button
              onClick={() => {
                if (isListening) handleToggleListening();
                setCaptionLang('ta');
              }}
              className={`min-h-[38px] px-3.5 py-1.5 text-xs font-bold rounded-lg transition-colors ${
                captionLang === 'ta' ? 'bg-sky-600 text-white' : 'text-slate-400 hover:text-white'
              }`}
            >
              Tamil (தமிழ்)
            </button>
          </div>
        </div>
      </div>

      {/* Main Grid: Live Captions (Left 8 Cols) + Sound Radar & Quick Reply (Right 4 Cols) */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
        {/* Left Column: Visual Speech Caption Screen (8 Cols) */}
        <div className="lg:col-span-8 flex flex-col space-y-4">
          <div className="bg-slate-900 border border-slate-800 rounded-2xl overflow-hidden shadow-xl flex-1 flex flex-col">
            {/* Caption Header Bar */}
            <div className="p-4 bg-slate-950 border-b border-slate-800 flex flex-wrap items-center justify-between gap-3">
              <div className="flex items-center gap-3">
                <button
                  onClick={handleToggleListening}
                  className={`min-h-[48px] px-6 py-2.5 rounded-xl text-sm font-black flex items-center gap-2.5 shadow-md transition-all focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-sky-400 ${
                    isListening
                      ? 'bg-rose-600 hover:bg-rose-500 text-white animate-pulse'
                      : 'bg-emerald-600 hover:bg-emerald-500 text-white'
                  }`}
                >
                  {isListening ? (
                    <>
                      <MicOff className="w-5 h-5" aria-hidden="true" />
                      <span>Stop Listening</span>
                    </>
                  ) : (
                    <>
                      <Mic className="w-5 h-5" aria-hidden="true" />
                      <span>Start Listening to Voice</span>
                    </>
                  )}
                </button>

                <div className="flex items-center gap-2 text-xs">
                  <span className={`w-3 h-3 rounded-full ${isListening ? 'bg-emerald-400 animate-ping' : 'bg-slate-600'}`} />
                  <span className={isListening ? 'text-emerald-400 font-bold' : 'text-slate-500'}>
                    {isListening ? 'Active Speech Captions' : 'Microphone Paused'}
                  </span>
                </div>
              </div>

              {/* Text Size Scale */}
              <div className="flex items-center gap-1 bg-slate-900 p-1 rounded-lg border border-slate-800 text-xs">
                <button
                  onClick={() => setCaptionSize('text-xl')}
                  className={`min-h-[34px] px-2.5 rounded ${captionSize === 'text-xl' ? 'bg-slate-800 text-white font-bold' : 'text-slate-400'}`}
                >
                  Standard
                </button>
                <button
                  onClick={() => setCaptionSize('text-3xl')}
                  className={`min-h-[34px] px-2.5 rounded ${captionSize === 'text-3xl' ? 'bg-slate-800 text-white font-bold' : 'text-slate-400'}`}
                >
                  Large
                </button>
                <button
                  onClick={() => setCaptionSize('text-4xl')}
                  className={`min-h-[34px] px-2.5 rounded ${captionSize === 'text-4xl' ? 'bg-slate-800 text-white font-bold' : 'text-slate-400'}`}
                >
                  XL
                </button>
              </div>
            </div>

            {/* Captions Scroll Area */}
            <div 
              ref={captionScrollRef}
              className="p-6 min-h-[380px] max-h-[500px] overflow-y-auto space-y-4 bg-slate-950/90"
              aria-live="polite"
            >
              {captions.length === 0 && !currentInterimText && (
                <div className="h-full flex flex-col items-center justify-center text-center py-20 text-slate-500 space-y-3">
                  <Ear className="w-12 h-12 stroke-1 text-slate-700" />
                  <div className="text-base font-bold text-slate-400">Live spoken text will appear here</div>
                  <p className="text-xs max-w-md text-slate-500">
                    Press &ldquo;Start Listening to Voice&rdquo; when someone is talking to you. Their words will be transcribed continuously in large, clear text.
                  </p>
                </div>
              )}

              {captions.map(item => (
                <div 
                  key={item.id}
                  className="p-4 rounded-xl bg-slate-900 border border-slate-800/80 shadow-sm space-y-1"
                >
                  <div className="flex items-center justify-between text-xs text-slate-500">
                    <span className="font-mono">{item.timestamp}</span>
                    <span className="uppercase text-[10px] text-sky-400 font-bold">{item.language}</span>
                  </div>
                  <div className={`font-black text-white tracking-tight leading-snug ${captionSize}`}>
                    {item.text}
                  </div>
                </div>
              ))}

              {currentInterimText && (
                <div className="p-4 rounded-xl bg-sky-950/50 border-2 border-sky-500/60 animate-pulse space-y-1">
                  <div className="text-[11px] text-sky-400 font-bold uppercase tracking-wider flex items-center gap-1.5">
                    <span className="w-2 h-2 rounded-full bg-sky-400 animate-ping" />
                    <span>Speaking now...</span>
                  </div>
                  <div className={`font-black text-sky-100 tracking-tight leading-snug ${captionSize}`}>
                    {currentInterimText}
                  </div>
                </div>
              )}
            </div>

            {/* Captions Utility Footer */}
            <div className="p-3.5 bg-slate-950 border-t border-slate-800 flex items-center justify-between text-xs">
              <div className="flex items-center gap-2">
                <button
                  onClick={() => {
                    const full = captions.map(c => `[${c.timestamp}] ${c.text}`).join('\n');
                    navigator.clipboard.writeText(full);
                  }}
                  disabled={captions.length === 0}
                  className="min-h-[38px] px-3 py-1.5 bg-slate-800 hover:bg-slate-700 text-slate-200 font-medium rounded-lg flex items-center gap-1.5"
                >
                  <Copy className="w-3.5 h-3.5" />
                  <span>Copy All</span>
                </button>
                <button
                  onClick={() => {
                    const blob = new Blob([JSON.stringify(captions, null, 2)], { type: 'application/json' });
                    const url = URL.createObjectURL(blob);
                    const a = document.createElement('a');
                    a.href = url;
                    a.download = `Deaf_Captions_${Date.now()}.json`;
                    a.click();
                  }}
                  disabled={captions.length === 0}
                  className="min-h-[38px] px-3 py-1.5 bg-slate-800 hover:bg-slate-700 text-slate-200 font-medium rounded-lg flex items-center gap-1.5"
                >
                  <Download className="w-3.5 h-3.5" />
                  <span>Export</span>
                </button>
              </div>

              <button
                onClick={() => {
                  setCaptions([]);
                  storageService.clearCaptionHistory();
                }}
                disabled={captions.length === 0}
                className="min-h-[38px] px-3 py-1.5 bg-slate-800 hover:bg-rose-900/40 text-slate-400 hover:text-rose-200 font-medium rounded-lg"
              >
                Clear Screen
              </button>
            </div>
          </div>
        </div>

        {/* Right Column: Visual Sound Radar & Quick Reply Soundboard (4 Cols) */}
        <div className="lg:col-span-4 space-y-4 flex flex-col">
          {/* Visual Sound Radar / Decibel Alert */}
          <div className="bg-slate-900 border border-slate-800 rounded-2xl p-5 shadow-sm space-y-3">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2 text-white font-bold text-sm">
                <Bell className="w-4 h-4 text-amber-400" />
                <span>Visual Sound Radar</span>
              </div>
              <span className="text-[11px] font-mono text-slate-400">
                {soundIntensity}% intensity
              </span>
            </div>

            {/* Visual Equalizer Bar */}
            <div className="space-y-1.5">
              <div className="w-full h-3.5 bg-slate-950 rounded-full overflow-hidden border border-slate-800 p-0.5">
                <div 
                  className={`h-full rounded-full transition-all duration-75 ${
                    soundIntensity > 70 ? 'bg-rose-500' : (soundIntensity > 40 ? 'bg-amber-400' : 'bg-emerald-400')
                  }`}
                  style={{ width: `${soundIntensity}%` }}
                />
              </div>
              <div className="flex justify-between text-[10px] text-slate-500">
                <span>Quiet</span>
                <span>Speech Range</span>
                <span className="text-rose-400 font-semibold">Alarm / Alert</span>
              </div>
            </div>

            {/* Alert Event Chips */}
            {soundAlerts.length > 0 ? (
              <div className="space-y-1.5 pt-1">
                {soundAlerts.map(alert => (
                  <div key={alert.id} className="p-2.5 rounded-lg bg-rose-950/50 border border-rose-800/60 text-xs text-rose-200 flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <AlertTriangle className="w-3.5 h-3.5 text-rose-400 shrink-0" />
                      <span className="font-semibold">{alert.label}</span>
                    </div>
                    <span className="text-[10px] text-slate-400 font-mono">{alert.timestamp}</span>
                  </div>
                ))}
              </div>
            ) : (
              <div className="text-xs text-slate-500 italic py-1">
                {isListening ? 'Monitoring ambient sounds for alarms or doorbells...' : 'Start listening above to activate sound radar.'}
              </div>
            )}
          </div>

          {/* Quick Reply Voice Bridge (Deaf user types or clicks, computer speaks aloud) */}
          <div className="bg-slate-900 border border-slate-800 rounded-2xl p-5 shadow-sm space-y-3 flex-1 flex flex-col">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2 text-white font-bold text-sm">
                <Volume2 className="w-4 h-4 text-emerald-400" />
                <span>Quick Speak-Back (TTS)</span>
              </div>
              {lastSpokenReply && (
                <span className="text-[10px] text-emerald-400 font-mono">Spoken aloud</span>
              )}
            </div>

            <p className="text-xs text-slate-400 leading-relaxed">
              Tap a phrase below or type your answer. The app will speak it out loud for the hearing person:
            </p>

            {/* One-Tap Quick Replies */}
            <div className="space-y-1.5 max-h-48 overflow-y-auto pr-1">
              {quickResponses.map((phrase, i) => (
                <button
                  key={i}
                  onClick={() => handleSendReply(phrase)}
                  className="w-full text-left p-2 rounded-lg bg-slate-950 hover:bg-slate-800 border border-slate-800/80 text-xs text-slate-200 hover:text-white transition-colors flex items-center justify-between group"
                >
                  <span className="truncate pr-2">{phrase}</span>
                  <Volume2 className="w-3.5 h-3.5 text-slate-500 group-hover:text-emerald-400 shrink-0" />
                </button>
              ))}
            </div>

            {/* Custom Reply Input */}
            <div className="mt-auto pt-2 space-y-2">
              <div className="flex items-center gap-2">
                <input
                  type="text"
                  value={replyText}
                  onChange={(e) => setReplyText(e.target.value)}
                  onKeyDown={(e) => e.key === 'Enter' && handleSendReply()}
                  placeholder="Type anything to speak aloud..."
                  className="flex-1 bg-slate-950 border border-slate-800 rounded-xl px-3.5 py-2.5 text-xs text-white placeholder-slate-500 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-sky-400"
                />
                <button
                  onClick={() => handleSendReply()}
                  disabled={!replyText.trim()}
                  className="min-h-[42px] px-4 py-2 bg-emerald-600 hover:bg-emerald-500 disabled:opacity-50 text-white font-bold text-xs rounded-xl flex items-center gap-1.5 shadow transition-colors"
                >
                  <Send className="w-3.5 h-3.5" />
                  <span>Speak</span>
                </button>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Two-Way Sign Language Bridge (Speech -> Sign Avatar & Sign -> Speech) */}
      <BiDirectionalSignTranslator
        initialWord={captions.length > 0 ? captions[captions.length - 1].text.split(' ')[0] : 'Hello'}
        themeColor="sky"
        onSignRecognized={(word) => {
          setReplyText(word);
        }}
      />
    </div>
  );
};
