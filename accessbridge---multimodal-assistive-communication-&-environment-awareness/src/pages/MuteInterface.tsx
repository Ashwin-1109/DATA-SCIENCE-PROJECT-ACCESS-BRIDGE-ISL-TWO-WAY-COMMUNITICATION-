import React, { useState, useRef, useEffect, useCallback } from 'react';
import { 
  MicOff, 
  Hand, 
  Volume2, 
  Camera, 
  CameraOff, 
  Play, 
  Square, 
  Grid, 
  Sparkles, 
  Send, 
  Trash2, 
  Copy, 
  CheckCircle2, 
  AlertCircle,
  MessageSquare,
  HelpCircle,
  HeartPulse,
  Coffee,
  Car,
  UserCheck
} from 'lucide-react';
import { SignPredictionResult, FrameLandmarks, NavigationTab, AacPhraseCategory } from '../types';
import { signService, REJECTION_CONFIDENCE_THRESHOLD } from '../services/signService';
import { landmarkTrackingService } from '../services/landmarkTrackingService';
import { ttsService } from '../services/ttsService';
import { storageService } from '../services/storageService';
import { captionService } from '../services/captionService';
import { BiDirectionalSignTranslator } from '../components/BiDirectionalSignTranslator';

interface MuteInterfaceProps {
  onNavigate: (tab: NavigationTab) => void;
  activeModelName: string | null;
}

export const MuteInterface: React.FC<MuteInterfaceProps> = ({ 
  onNavigate, 
  activeModelName 
}) => {
  const [activeSubMode, setActiveSubMode] = useState<'sign' | 'soundboard'>('soundboard');

  // Camera & Sign State
  const videoRef = useRef<HTMLVideoElement | null>(null);
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const [streamActive, setStreamActive] = useState(false);
  const [isRecordingSign, setIsRecordingSign] = useState(false);
  const [recordingProgress, setRecordingProgress] = useState(0);
  const recordingFramesRef = useRef<FrameLandmarks[]>([]);
  const animFrameRef = useRef<number | null>(null);
  const [lastPrediction, setLastPrediction] = useState<SignPredictionResult | null>(null);

  // Communication Sentence Buffer
  const [sentenceText, setSentenceText] = useState('');
  const [copiedNotification, setCopiedNotification] = useState(false);

  // Hearing Partner Microphone Captions (Two-way)
  const [isListeningToPartner, setIsListeningToPartner] = useState(false);
  const [partnerSpeechText, setPartnerSpeechText] = useState('');

  // AAC Categories
  const aacCategories: AacPhraseCategory[] = [
    {
      id: 'emergency',
      name: 'Emergency & Medical',
      icon: '🚨',
      color: 'border-rose-800/80 bg-rose-950/40 text-rose-300',
      phrases: [
        'I need immediate assistance.',
        'Please call a doctor or ambulance.',
        'I am in physical pain.',
        'Where is the nearest hospital or emergency room?',
        'I need to take my medication.',
        'Please call my family.'
      ]
    },
    {
      id: 'daily',
      name: 'Daily & Essentials',
      icon: '💧',
      color: 'border-sky-800/80 bg-sky-950/40 text-sky-300',
      phrases: [
        'Could I please have some water?',
        'I am hungry, where can I get food?',
        'Where is the restroom?',
        'Yes, thank you.',
        'No, I do not need that.',
        'Please give me a moment.'
      ]
    },
    {
      id: 'social',
      name: 'Social & Introductions',
      icon: '🤝',
      color: 'border-emerald-800/80 bg-emerald-950/40 text-emerald-300',
      phrases: [
        'Hello! I cannot speak, but I can hear and understand everything.',
        'Good morning, how are you?',
        'Thank you very much for your patience.',
        'Nice to meet you.',
        'Could you please write that down for me?',
        'Have a great day!'
      ]
    },
    {
      id: 'travel',
      name: 'Travel & Navigation',
      icon: '🚕',
      color: 'border-amber-800/80 bg-amber-950/40 text-amber-300',
      phrases: [
        'How much does this cost?',
        'Please take me to this address.',
        'Please stop the car here.',
        'Do you accept digital UPI or card payment?',
        'Which platform or gate is this?',
        'I am lost, can you point me in the right direction?'
      ]
    }
  ];

  // Camera handling
  const startCamera = async () => {
    try {
      // Initialize real MediaPipe detectors before opening stream
      await landmarkTrackingService.initialize();
      const stream = await navigator.mediaDevices.getUserMedia({
        video: { width: 640, height: 480, facingMode: 'user' },
        audio: false
      });
      if (videoRef.current) {
        videoRef.current.srcObject = stream;
        await videoRef.current.play();
        setStreamActive(true);
      }
    } catch (e) {
      console.warn('Camera start error:', e);
    }
  };

  const stopCamera = () => {
    if (videoRef.current && videoRef.current.srcObject) {
      const stream = videoRef.current.srcObject as MediaStream;
      stream.getTracks().forEach(t => t.stop());
      videoRef.current.srcObject = null;
    }
    if (animFrameRef.current) cancelAnimationFrame(animFrameRef.current);
    setStreamActive(false);
  };

  useEffect(() => {
    return () => {
      stopCamera();
      captionService.stopListening();
    };
  }, []);

  // Frame processing loop for sign camera — real MediaPipe landmarks, no simulation
  const processFrame = useCallback(() => {
    if (!videoRef.current || !canvasRef.current || !streamActive) return;

    const video = videoRef.current;
    const canvas = canvasRef.current;
    const ctx = canvas.getContext('2d');
    if (!ctx || video.readyState < 2) {
      animFrameRef.current = requestAnimationFrame(processFrame);
      return;
    }

    if (canvas.width !== video.videoWidth || canvas.height !== video.videoHeight) {
      canvas.width = video.videoWidth || 640;
      canvas.height = video.videoHeight || 480;
    }

    ctx.clearRect(0, 0, canvas.width, canvas.height);

    const w = canvas.width;
    const h = canvas.height;

    // Real MediaPipe detection
    const tracked = landmarkTrackingService.processVideoFrame(video, performance.now());

    const frame: FrameLandmarks = tracked
      ? {
          timestamp: tracked.timestamp,
          rightHand: tracked.rightHand,
          leftHand: tracked.leftHand,
          pose: tracked.pose
            ? [tracked.pose[11], tracked.pose[12], tracked.pose[13], tracked.pose[14]]
            : null,
          hasRightHand: tracked.hasRightHand,
          hasLeftHand: tracked.hasLeftHand,
          hasPose: tracked.hasPose
        }
      : {
          timestamp: Date.now(),
          rightHand: null,
          leftHand: null,
          pose: null,
          hasRightHand: false,
          hasLeftHand: false,
          hasPose: false
        };

    if (isRecordingSign) {
      recordingFramesRef.current.push(frame);
    }

    // Render real skeleton overlay (mirrored to match the flipped video)
    ctx.save();
    ctx.scale(-1, 1);
    ctx.translate(-w, 0);

    if (tracked?.rightHand) {
      ctx.fillStyle = '#34D399';
      tracked.rightHand.forEach(p => {
        ctx.beginPath();
        ctx.arc(p.x * w, p.y * h, 4, 0, Math.PI * 2);
        ctx.fill();
      });
    }

    if (tracked?.leftHand) {
      ctx.fillStyle = '#F472B6';
      tracked.leftHand.forEach(p => {
        ctx.beginPath();
        ctx.arc(p.x * w, p.y * h, 4, 0, Math.PI * 2);
        ctx.fill();
      });
    }

    if (tracked?.pose) {
      ctx.fillStyle = '#38BDF8';
      [11, 12, 13, 14].forEach(idx => {
        const pt = tracked.pose?.[idx];
        if (pt) {
          ctx.beginPath();
          ctx.arc(pt.x * w, pt.y * h, 5, 0, Math.PI * 2);
          ctx.fill();
        }
      });
    }

    ctx.restore();

    animFrameRef.current = requestAnimationFrame(processFrame);
  }, [streamActive, isRecordingSign]);

  useEffect(() => {
    if (streamActive) animFrameRef.current = requestAnimationFrame(processFrame);
    return () => {
      if (animFrameRef.current) cancelAnimationFrame(animFrameRef.current);
    };
  }, [streamActive, processFrame]);

  // Record isolated sign — collects real MediaPipe frames then sends to backend for async inference
  const handleRecordSign = async () => {
    if (!streamActive) await startCamera();
    recordingFramesRef.current = [];
    setIsRecordingSign(true);
    setRecordingProgress(0);

    await new Promise<void>(resolve => {
      let progress = 0;
      const interval = setInterval(() => {
        progress += 5;
        setRecordingProgress(progress);
        if (progress >= 100) {
          clearInterval(interval);
          resolve();
        }
      }, 100);
    });

    setIsRecordingSign(false);

    // Send real captured frames to backend model inference
    const result = await signService.predictAsync(
      recordingFramesRef.current,
      activeModelName || 'Compact Transformer'
    );
    setLastPrediction(result);
    if (!result.isUnknownOrRejected) {
      setSentenceText(prev => prev ? `${prev} ${result.className}` : result.className);
      ttsService.speak(result.className);
    }
  };

  // Speak soundboard phrase
  const handleSpeakPhrase = (phrase: string) => {
    ttsService.speak(phrase);
    setSentenceText(phrase);
  };

  const handleSpeakCustom = () => {
    if (sentenceText.trim()) {
      ttsService.speak(sentenceText.trim());
    }
  };

  // Partner caption toggle
  const handleTogglePartnerSpeech = () => {
    if (isListeningToPartner) {
      captionService.stopListening();
      setIsListeningToPartner(false);
    } else {
      const started = captionService.startListening(
        'en',
        (cap) => {
          setPartnerSpeechText(cap.text);
        },
        () => setIsListeningToPartner(false),
        () => {}
      );
      if (started) setIsListeningToPartner(true);
    }
  };

  return (
    <div className="min-h-[85vh] py-6 px-4 sm:px-6 lg:px-8 max-w-7xl mx-auto space-y-6">
      {/* Top Banner: Mode Indicator */}
      <div className="bg-slate-900 border-2 border-emerald-500/70 rounded-2xl p-5 shadow-lg flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div className="flex items-center gap-3.5">
          <div className="w-12 h-12 rounded-xl bg-emerald-600 flex items-center justify-center text-white shrink-0 shadow-md">
            <MicOff className="w-6 h-6" aria-hidden="true" />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <span className="text-xs font-bold uppercase tracking-wider text-emerald-400">Accessible Mode 2</span>
              <span className="text-slate-500" aria-hidden="true">·</span>
              <span className="text-xs text-slate-300">Vocal & Speech Assistance</span>
            </div>
            <h1 className="text-2xl font-black text-white tracking-tight">
              Mute & Non-Verbal Voice Assist
            </h1>
            <p className="text-xs text-slate-400 mt-0.5">
              Instant voice generator: AAC quick soundboard cards, Indian Sign Language to speech, and two-way partner captions.
            </p>
          </div>
        </div>

        {/* Workflow Mode Tabs */}
        <div className="flex items-center gap-1 p-1 bg-slate-950 border border-slate-800 rounded-xl">
          <button
            onClick={() => {
              setActiveSubMode('soundboard');
              stopCamera();
            }}
            className={`min-h-[38px] px-4 py-1.5 text-xs font-bold rounded-lg transition-colors ${
              activeSubMode === 'soundboard' ? 'bg-emerald-600 text-white shadow-sm' : 'text-slate-400 hover:text-white'
            }`}
          >
            1. AAC Quick Soundboard
          </button>
          <button
            onClick={() => {
              setActiveSubMode('sign');
              startCamera();
            }}
            className={`min-h-[38px] px-4 py-1.5 text-xs font-bold rounded-lg transition-colors ${
              activeSubMode === 'sign' ? 'bg-emerald-600 text-white shadow-sm' : 'text-slate-400 hover:text-white'
            }`}
          >
            2. Sign-to-Speech Camera
          </button>
        </div>
      </div>

      {/* Voice Output Strip (Top of workspace for rapid communication) */}
      <div className="bg-slate-900 border border-slate-800 rounded-2xl p-5 shadow-sm space-y-3">
        <div className="flex items-center justify-between">
          <label htmlFor="voiceBox" className="text-xs font-bold text-slate-300 uppercase tracking-wider flex items-center gap-2">
            <Volume2 className="w-4 h-4 text-emerald-400" />
            <span>Active Vocal Speech Output</span>
          </label>
          {copiedNotification && <span className="text-xs text-emerald-400 font-semibold">Copied!</span>}
        </div>

        <div className="flex items-center gap-2">
          <input
            id="voiceBox"
            type="text"
            value={sentenceText}
            onChange={(e) => setSentenceText(e.target.value)}
            onKeyDown={(e) => e.key === 'Enter' && handleSpeakCustom()}
            placeholder="Tap any phrase below, sign on camera, or type to speak aloud instantly..."
            className="flex-1 bg-slate-950 border border-slate-800 rounded-xl px-4 py-3 text-base font-semibold text-white placeholder-slate-500 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-emerald-400"
          />
          <button
            onClick={handleSpeakCustom}
            disabled={!sentenceText.trim()}
            className="min-h-[48px] px-6 py-2.5 bg-emerald-600 hover:bg-emerald-500 disabled:opacity-50 text-white font-bold text-sm rounded-xl flex items-center gap-2 shadow-md transition-colors"
          >
            <Volume2 className="w-4 h-4" />
            <span>Speak Aloud</span>
          </button>
          <button
            onClick={() => setSentenceText('')}
            disabled={!sentenceText.trim()}
            className="min-h-[48px] px-3.5 py-2.5 bg-slate-800 hover:bg-rose-900/40 text-slate-400 hover:text-rose-200 disabled:opacity-50 font-medium rounded-xl transition-colors"
            title="Clear"
          >
            <Trash2 className="w-4 h-4" />
          </button>
        </div>
      </div>

      {/* Mode A: AAC Soundboard View */}
      {activeSubMode === 'soundboard' && (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          {aacCategories.map(cat => (
            <div 
              key={cat.id} 
              className={`border rounded-2xl p-5 space-y-3.5 shadow-sm ${cat.color}`}
            >
              <div className="flex items-center gap-2">
                <span className="text-xl" aria-hidden="true">{cat.icon}</span>
                <h2 className="text-sm font-bold text-white tracking-tight">{cat.name}</h2>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
                {cat.phrases.map((phrase, idx) => (
                  <button
                    key={idx}
                    onClick={() => handleSpeakPhrase(phrase)}
                    className="p-3 bg-slate-950/80 hover:bg-slate-900 border border-slate-800 rounded-xl text-left text-xs font-semibold text-slate-200 hover:text-white transition-all shadow-sm hover:scale-[1.01] flex flex-col justify-between min-h-[70px] group focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-emerald-400"
                  >
                    <span>{phrase}</span>
                    <div className="flex items-center gap-1 text-[10px] text-slate-500 group-hover:text-emerald-400 mt-2 font-mono">
                      <Volume2 className="w-3 h-3" />
                      <span>Tap to speak</span>
                    </div>
                  </button>
                ))}
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Mode B: Indian Sign Language Camera Translator */}
      {activeSubMode === 'sign' && (
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
          {/* Camera Viewport (7 Cols) */}
          <div className="lg:col-span-7 space-y-4">
            <div className="relative bg-slate-950 border border-slate-800 rounded-2xl overflow-hidden aspect-[4/3] flex items-center justify-center shadow-inner">
              <video
                ref={videoRef}
                playsInline
                muted
                className={`w-full h-full object-cover scale-x-[-1] ${!streamActive ? 'hidden' : ''}`}
              />
              <canvas
                ref={canvasRef}
                className={`absolute inset-0 w-full h-full pointer-events-none ${!streamActive ? 'hidden' : ''}`}
              />

              {!streamActive && (
                <div className="text-center p-6 space-y-3">
                  <div className="w-14 h-14 rounded-full bg-slate-900 border border-slate-800 flex items-center justify-center mx-auto text-slate-500">
                    <Hand className="w-7 h-7" aria-hidden="true" />
                  </div>
                  <div className="text-sm font-bold text-white">Camera is inactive</div>
                  <p className="text-xs text-slate-400 max-w-sm">
                    Activate camera to recognize your Indian Sign Language hand gestures and convert them to vocal speech.
                  </p>
                  <button
                    onClick={startCamera}
                    className="min-h-[44px] px-5 py-2.5 bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-bold rounded-xl inline-flex items-center gap-2"
                  >
                    <Camera className="w-4 h-4" />
                    <span>Start Sign Camera</span>
                  </button>
                </div>
              )}

              {/* Recording Active HUD */}
              {isRecordingSign && (
                <div className="absolute top-4 left-4 right-4 bg-slate-900/90 backdrop-blur-sm border border-emerald-500 p-3 rounded-xl text-white text-xs flex items-center justify-between shadow-lg">
                  <span className="font-bold flex items-center gap-2">
                    <span className="w-2.5 h-2.5 rounded-full bg-emerald-400 animate-ping" />
                    Capturing Sign Gesture...
                  </span>
                  <span className="font-mono">{recordingProgress}%</span>
                </div>
              )}
            </div>

            <div className="flex items-center justify-between gap-3 bg-slate-900 p-3 rounded-xl border border-slate-800">
              {streamActive ? (
                <button
                  onClick={stopCamera}
                  className="min-h-[40px] px-3.5 py-1.5 bg-rose-600/90 hover:bg-rose-500 text-white text-xs font-bold rounded-lg flex items-center gap-1.5"
                >
                  <CameraOff className="w-4 h-4" />
                  <span>Stop Camera</span>
                </button>
              ) : (
                <button
                  onClick={startCamera}
                  className="min-h-[40px] px-3.5 py-1.5 bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-bold rounded-lg flex items-center gap-1.5"
                >
                  <Camera className="w-4 h-4" />
                  <span>Start Camera</span>
                </button>
              )}

              <button
                onClick={handleRecordSign}
                disabled={isRecordingSign}
                className="min-h-[40px] px-5 py-1.5 bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-black rounded-lg flex items-center gap-2 shadow"
              >
                <Play className="w-4 h-4" />
                <span>Record Sign (2.0s)</span>
              </button>
            </div>
          </div>

          {/* Sign Recognition Feedback (5 Cols) */}
          <div className="lg:col-span-5 space-y-4">
            <div className="bg-slate-900 border border-slate-800 rounded-2xl p-5 shadow-sm space-y-3">
              <h2 className="text-sm font-bold text-white">Recognized Word Result</h2>

              {lastPrediction ? (
                <div className="p-4 bg-slate-950 border border-slate-800 rounded-xl space-y-2">
                  <div className="flex items-baseline justify-between">
                    <span className="text-2xl font-black text-emerald-400">
                      &ldquo;{lastPrediction.className}&rdquo;
                    </span>
                    <span className="text-xs font-mono text-slate-400">
                      Conf: {(lastPrediction.confidence * 100).toFixed(0)}%
                    </span>
                  </div>
                  <div className="text-[11px] text-slate-500 flex items-center gap-2">
                    <span>Model: {lastPrediction.modelArchitecture}</span>
                    <span>·</span>
                    <span>Latency: {lastPrediction.inferenceLatencyMs} ms</span>
                  </div>
                </div>
              ) : (
                <div className="p-6 text-center text-slate-500 text-xs italic border border-dashed border-slate-800 rounded-xl">
                  Perform an ISL sign (e.g. &ldquo;Hello&rdquo;, &ldquo;Help&rdquo;, &ldquo;Water&rdquo;) and click Record Sign.
                </div>
              )}
            </div>

            {/* Hearing Partner Speech Listener (So the mute user can hear what they reply) */}
            <div className="bg-slate-900 border border-slate-800 rounded-2xl p-5 shadow-sm space-y-3">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2 text-white font-bold text-xs">
                  <MessageSquare className="w-4 h-4 text-sky-400" />
                  <span>Hearing Partner Response Listener</span>
                </div>
                <button
                  onClick={handleTogglePartnerSpeech}
                  className={`min-h-[32px] px-3 py-1 rounded-md text-xs font-bold transition-colors ${
                    isListeningToPartner ? 'bg-rose-600 text-white' : 'bg-slate-800 text-sky-400 hover:text-white'
                  }`}
                >
                  {isListeningToPartner ? 'Stop Listening' : 'Listen to Reply'}
                </button>
              </div>

              <div className="p-3 bg-slate-950 border border-slate-800 rounded-xl min-h-[70px] text-xs flex items-center">
                {partnerSpeechText ? (
                  <span className="text-white font-semibold text-sm leading-relaxed">&ldquo;{partnerSpeechText}&rdquo;</span>
                ) : (
                  <span className="text-slate-500 italic">
                    {isListeningToPartner ? 'Listening to what the other person replies...' : 'Click "Listen to Reply" when the other person speaks to you.'}
                  </span>
                )}
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Two-Way Sign Language Bridge (Speech/Text -> ISL Sign Avatar & Camera -> Speech) */}
      <BiDirectionalSignTranslator
        initialWord={sentenceText.trim() ? sentenceText.trim().split(' ')[0] : 'Help'}
        themeColor="emerald"
        onSignRecognized={(word) => {
          setSentenceText(prev => prev ? `${prev} ${word}` : word);
        }}
      />
    </div>
  );
};
