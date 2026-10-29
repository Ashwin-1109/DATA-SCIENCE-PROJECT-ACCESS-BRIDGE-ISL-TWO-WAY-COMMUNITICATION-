import React, { useState, useRef, useEffect, useCallback } from 'react';
import { 
  Eye, 
  EyeOff, 
  Volume2, 
  Camera, 
  CameraOff, 
  Scan, 
  FileText, 
  Upload, 
  RotateCw, 
  Sliders, 
  AlertTriangle, 
  CheckCircle2, 
  Compass, 
  Mic, 
  MicOff,
  Sparkles,
  Info,
  Radio
} from 'lucide-react';
import { DetectedObject, OcrResult, NavigationTab } from '../types';
import { visionService } from '../services/visionService';
import { ttsService } from '../services/ttsService';
import { cameraService } from '../services/cameraService';
import { soundEffectService } from '../services/soundEffectService';
import { BiDirectionalSignTranslator } from '../components/BiDirectionalSignTranslator';

interface BlindInterfaceProps {
  onNavigate: (tab: NavigationTab) => void;
}

export const BlindInterface: React.FC<BlindInterfaceProps> = ({ onNavigate }) => {
  const [activeTool, setActiveTool] = useState<'narrator' | 'ocr'>('narrator');

  // Camera & Stream states
  const videoRef = useRef<HTMLVideoElement | null>(null);
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const [streamActive, setStreamActive] = useState(false);

  // Narrator (Objects & Obstacles)
  const [narratorRunning, setNarratorRunning] = useState(false);
  const [detectedObjects, setDetectedObjects] = useState<DetectedObject[]>([]);
  const [currentDescription, setCurrentDescription] = useState('Camera inactive. Press "Start Audio Narrator" below.');
  const [announcementIntervalSec, setAnnouncementIntervalSec] = useState<number>(3);
  const scanIntervalRef = useRef<any>(null);

  // Printed Text Reader (OCR)
  const [ocrResultText, setOcrResultText] = useState<string>('');
  const [ocrLoading, setOcrLoading] = useState(false);
  const fileInputRef = useRef<HTMLInputElement | null>(null);

  // Voice Command Listener
  const [isVoiceCommandListening, setIsVoiceCommandListening] = useState(false);
  const [lastHeardCommand, setLastHeardCommand] = useState('');
  const speechRecRef = useRef<any>(null);

  // Announce helper
  const announceSpoken = (msg: string) => {
    ttsService.speak(msg);
  };

  // Start Camera via CameraService
  const startCamera = async () => {
    if (!videoRef.current) return;
    try {
      await cameraService.startCamera(videoRef.current, { facingMode: 'environment' });
      setStreamActive(true);
      soundEffectService.playSuccessChime();
      announceSpoken('Environment camera started successfully.');
    } catch (e: any) {
      announceSpoken('Camera access error: ' + (e.message || 'Permission denied'));
    }
  };

  const stopCamera = () => {
    cameraService.stopCamera();
    setStreamActive(false);
    setNarratorRunning(false);
    if (scanIntervalRef.current) clearInterval(scanIntervalRef.current);
    announceSpoken('Camera stopped.');
  };

  useEffect(() => {
    return () => {
      stopCamera();
      if (speechRecRef.current) speechRecRef.current.stop();
    };
  }, []);

  // Spatial Object Scan
  const performAudioScan = useCallback(async () => {
    if (!videoRef.current || !canvasRef.current || !streamActive) return;

    const video = videoRef.current;
    const canvas = canvasRef.current;
    canvas.width = video.videoWidth || 640;
    canvas.height = video.videoHeight || 480;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    ctx.drawImage(video, 0, 0, canvas.width, canvas.height);

    // Try Gemini multimodal scene description first
    const geminiRes = await visionService.describeSceneWithGemini(canvas);
    if (geminiRes.success && geminiRes.description) {
      setCurrentDescription(geminiRes.description);
      if (visionService.shouldAnnounce(geminiRes.description)) {
        announceSpoken(geminiRes.description);
      }
      return;
    }

    // Fallback to local detector
    const objects = await visionService.detectObjectsInCanvas(canvas);
    setDetectedObjects(objects);

    const description = visionService.generateSpatialDescription(objects);
    setCurrentDescription(description);

    if (objects.length > 0) {
      const first = objects[0];
      const pan = first.spatialLocation === 'left' ? -0.8 : (first.spatialLocation === 'right' ? 0.8 : 0.0);
      soundEffectService.playSpatialCue(pan);
    }

    if (visionService.shouldAnnounce(description)) {
      announceSpoken(description);
    }
  }, [streamActive]);

  // Continuous Narrator loop
  useEffect(() => {
    if (narratorRunning && streamActive) {
      performAudioScan();
      scanIntervalRef.current = setInterval(() => {
        performAudioScan();
      }, announcementIntervalSec * 1000);
    } else {
      if (scanIntervalRef.current) clearInterval(scanIntervalRef.current);
    }
    return () => {
      if (scanIntervalRef.current) clearInterval(scanIntervalRef.current);
    };
  }, [narratorRunning, streamActive, announcementIntervalSec, performAudioScan]);

  const toggleNarrator = async () => {
    if (!streamActive) {
      await startCamera();
      setNarratorRunning(true);
      announceSpoken('Audio narrator active. Scanning surroundings every ' + announcementIntervalSec + ' seconds.');
    } else {
      const nextState = !narratorRunning;
      setNarratorRunning(nextState);
      announceSpoken(nextState ? 'Audio narrator enabled.' : 'Audio narrator paused.');
    }
  };

  // OCR Read Snapshot
  const handleSnapAndReadOcr = async () => {
    if (!videoRef.current) {
      announceSpoken('Starting camera to capture printed document.');
      await startCamera();
    }
    soundEffectService.playAlertBeep(600);
    announceSpoken('Analyzing printed text lines, please hold still...');
    setOcrLoading(true);

    try {
      const video = videoRef.current!;
      const canvas = document.createElement('canvas');
      canvas.width = video.videoWidth || 640;
      canvas.height = video.videoHeight || 480;
      const ctx = canvas.getContext('2d');
      if (ctx) {
        ctx.drawImage(video, 0, 0, canvas.width, canvas.height);
        const preprocessed = visionService.preprocessImageForOcr(canvas, 0, true);
        const result = await visionService.extractText(preprocessed, 'eng');
        setOcrResultText(result.cleanedText);
        soundEffectService.playSuccessChime();
        announceSpoken('Text found: ' + (result.cleanedText || 'No clear text detected. Try moving closer.'));
      }
    } finally {
      setOcrLoading(false);
    }
  };

  // Voice Command Listener ("Describe scene", "Read text", "Where am I")
  const toggleVoiceCommands = () => {
    if (isVoiceCommandListening) {
      if (speechRecRef.current) speechRecRef.current.stop();
      setIsVoiceCommandListening(false);
      announceSpoken('Voice commands deactivated.');
    } else {
      const SpeechRec = (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition;
      if (!SpeechRec) {
        announceSpoken('Speech recognition not available on this browser.');
        return;
      }
      try {
        const rec = new SpeechRec();
        rec.continuous = true;
        rec.lang = 'en-US';
        rec.onstart = () => {
          setIsVoiceCommandListening(true);
          soundEffectService.playSuccessChime();
          announceSpoken('Listening for voice commands. Say: Describe scene, Read text, or Stop.');
        };
        rec.onresult = (evt: any) => {
          const phrase = evt.results[evt.results.length - 1][0].transcript.toLowerCase();
          setLastHeardCommand(phrase);

          if (phrase.includes('describe') || phrase.includes('look') || phrase.includes('around') || phrase.includes('what')) {
            performAudioScan();
          } else if (phrase.includes('read') || phrase.includes('text') || phrase.includes('label')) {
            handleSnapAndReadOcr();
          } else if (phrase.includes('stop')) {
            stopCamera();
          } else if (phrase.includes('status')) {
            announceSpoken('AccessBridge is running. Camera: ' + (streamActive ? 'on' : 'off'));
          }
        };
        rec.onerror = () => setIsVoiceCommandListening(false);
        rec.onend = () => setIsVoiceCommandListening(false);
        speechRecRef.current = rec;
        rec.start();
      } catch (e) {
        console.warn('Voice command start error:', e);
      }
    }
  };

  return (
    <div className="min-h-[85vh] py-6 px-4 sm:px-6 lg:px-8 max-w-7xl mx-auto space-y-6">
      {/* Top Banner: Mode Indicator */}
      <div className="bg-slate-900 border-2 border-amber-400 rounded-2xl p-5 shadow-lg flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div className="flex items-center gap-3.5">
          <div className="w-12 h-12 rounded-xl bg-amber-400 flex items-center justify-center text-black shrink-0 shadow-md">
            <Eye className="w-6 h-6" aria-hidden="true" />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <span className="text-xs font-bold uppercase tracking-wider text-amber-400">Accessible Mode 3</span>
              <span className="text-slate-500" aria-hidden="true">·</span>
              <span className="text-xs text-slate-300">Auditory & Tactile Navigation</span>
            </div>
            <h1 className="text-2xl font-black text-white tracking-tight">
              Blind & Low-Vision Audio Assist
            </h1>
            <p className="text-xs text-slate-400 mt-0.5">
              Auditory-first experience: Spatial scene narrator, voice commands, and audio label reader.
            </p>
          </div>
        </div>

        {/* Voice Command Button */}
        <button
          onClick={toggleVoiceCommands}
          className={`min-h-[48px] px-5 py-2.5 rounded-xl text-xs font-black flex items-center gap-2 transition-all shadow-md ${
            isVoiceCommandListening
              ? 'bg-rose-600 text-white animate-pulse'
              : 'bg-slate-800 hover:bg-slate-700 text-amber-400 border border-amber-400/50'
          }`}
          aria-label={isVoiceCommandListening ? 'Deactivate voice commands' : 'Activate hands-free voice commands'}
        >
          {isVoiceCommandListening ? <MicOff className="w-4 h-4" /> : <Mic className="w-4 h-4" />}
          <span>{isVoiceCommandListening ? 'Listening for Commands' : 'Voice Command Mic (Hands-Free)'}</span>
        </button>
      </div>

      {/* Safety Notice */}
      <div className="p-4 bg-amber-950/50 border-2 border-amber-500/80 rounded-2xl flex items-start gap-3.5 text-xs text-amber-100">
        <AlertTriangle className="w-5 h-5 text-amber-400 shrink-0 mt-0.5" />
        <div>
          <strong className="text-white font-bold text-sm">Auditory Assistive Notice: </strong>
          This system provides assistive descriptions of visible objects and text. It does not replace a white cane or guide dog, and is not certified for street navigation or obstacle hazard avoidance.
        </div>
      </div>

      {/* Two Huge Primary Action Touch Targets (Optimized for Touch & Screen Readers) */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        {/* Card 1: What's Around Me? (Spatial Audio Narrator) */}
        <div className="bg-slate-900 border-2 border-slate-700 rounded-3xl p-6 shadow-xl space-y-5 flex flex-col justify-between">
          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <span className="text-xs font-black uppercase tracking-wider text-amber-400">Primary Tool 1</span>
              {narratorRunning && (
                <span className="flex items-center gap-1.5 text-xs text-emerald-400 font-bold font-mono">
                  <span className="w-2.5 h-2.5 rounded-full bg-emerald-400 animate-ping" />
                  Active Audio Narrator
                </span>
              )}
            </div>
            <h2 className="text-xl font-black text-white tracking-tight">
              &ldquo;What is Around Me?&rdquo; Spatial Narrator
            </h2>
            <p className="text-xs text-slate-300 leading-relaxed">
              Continuously observes through camera and speaks out what is ahead with directional spatial cues (left, centre, right) and sonification audio pan.
            </p>
          </div>

          {/* Current Spoken Output Box */}
          <div className="p-4 bg-slate-950 border border-slate-800 rounded-2xl min-h-[90px] flex items-center">
            <p className="text-base font-bold text-amber-300 leading-snug">
              {currentDescription}
            </p>
          </div>

          {/* Huge Action Button */}
          <button
            onClick={toggleNarrator}
            className={`w-full min-h-[60px] rounded-2xl text-base font-black flex items-center justify-center gap-3 shadow-lg transition-all focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-amber-400 ${
              narratorRunning
                ? 'bg-rose-600 hover:bg-rose-500 text-white'
                : 'bg-amber-400 hover:bg-amber-300 text-black'
            }`}
            aria-label={narratorRunning ? 'Stop audio narrator' : 'Start audio narrator'}
          >
            {narratorRunning ? (
              <>
                <CameraOff className="w-6 h-6" />
                <span>Pause Audio Narrator</span>
              </>
            ) : (
              <>
                <Compass className="w-6 h-6" />
                <span>Start Audio Narrator</span>
              </>
            )}
          </button>

          {/* Announcement Frequency */}
          <div className="flex items-center justify-between text-xs text-slate-400 pt-2 border-t border-slate-800">
            <span>Announcement Cadence:</span>
            <div className="flex items-center gap-1.5">
              {[2, 3, 5].map(sec => (
                <button
                  key={sec}
                  onClick={() => {
                    setAnnouncementIntervalSec(sec);
                    announceSpoken(`Narrator cadence set to ${sec} seconds.`);
                  }}
                  className={`min-h-[36px] px-3 py-1 font-bold rounded-lg ${
                    announcementIntervalSec === sec ? 'bg-amber-400 text-black' : 'bg-slate-800 text-slate-300'
                  }`}
                >
                  {sec}s
                </button>
              ))}
            </div>
          </div>
        </div>

        {/* Card 2: Audio Document & Medicine Label Scanner */}
        <div className="bg-slate-900 border-2 border-slate-700 rounded-3xl p-6 shadow-xl space-y-5 flex flex-col justify-between">
          <div className="space-y-2">
            <span className="text-xs font-black uppercase tracking-wider text-amber-400">Primary Tool 2</span>
            <h2 className="text-xl font-black text-white tracking-tight">
              Read Printed Labels & Documents (OCR)
            </h2>
            <p className="text-xs text-slate-300 leading-relaxed">
              Points camera at prescription medicine boxes, door signs, printed paper, or food packaging and reads all text aloud automatically.
            </p>
          </div>

          {/* OCR Result Box */}
          <div className="p-4 bg-slate-950 border border-slate-800 rounded-2xl min-h-[90px] max-h-36 overflow-y-auto flex items-center">
            {ocrLoading ? (
              <span className="text-amber-400 font-bold animate-pulse text-sm">
                Scanning document lines...
              </span>
            ) : (
              <p className="text-sm font-semibold text-slate-200 leading-snug">
                {ocrResultText || 'No document scanned yet. Press "Snap & Read Aloud" below.'}
              </p>
            )}
          </div>

          {/* Huge Action Button */}
          <button
            onClick={handleSnapAndReadOcr}
            disabled={ocrLoading}
            className="w-full min-h-[60px] bg-sky-500 hover:bg-sky-400 disabled:opacity-50 text-black font-black text-base rounded-2xl flex items-center justify-center gap-3 shadow-lg transition-all focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-sky-400"
            aria-label="Capture snapshot and read printed text aloud"
          >
            <Scan className="w-6 h-6" />
            <span>{ocrLoading ? 'Reading Text Lines...' : 'Snap & Read Text Aloud'}</span>
          </button>

          {/* Repeat Button */}
          <div className="flex items-center justify-between text-xs text-slate-400 pt-2 border-t border-slate-800">
            <button
              onClick={() => {
                if (ocrResultText) announceSpoken(ocrResultText);
                else announceSpoken('No text has been scanned yet.');
              }}
              className="text-amber-400 hover:underline font-bold flex items-center gap-1.5"
            >
              <Volume2 className="w-4 h-4" />
              <span>Repeat Last Text</span>
            </button>
            <span className="text-[11px] text-slate-500">Tesseract OCR Engine</span>
          </div>
        </div>
      </div>

      {/* Hidden Hardware Camera Pipeline (Runs in background for narrator) */}
      <div className="bg-slate-950 p-4 border border-slate-800 rounded-2xl flex flex-col sm:flex-row sm:items-center justify-between gap-4 text-xs text-slate-400">
        <div className="flex items-center gap-3">
          <Radio className="w-4 h-4 text-emerald-400 animate-pulse" />
          <span>Camera stream: <strong className="text-white">{streamActive ? 'Active (640x480)' : 'Standby'}</strong></span>
          <span>·</span>
          <span>Detected objects in view: <strong className="text-amber-400">{detectedObjects.length}</strong></span>
        </div>
        <div className="text-[11px] font-mono text-slate-500">
          Last Voice Command: {lastHeardCommand || 'None'}
        </div>
      </div>

      {/* Two-Way Tactile & Auditory Sign Language Bridge (Deaf Companion <-> Blind User) */}
      <div className="space-y-2">
        <div className="flex items-center gap-2 text-xs font-bold text-amber-400 uppercase tracking-wider">
          <Volume2 className="w-4 h-4" />
          <span>Two-Way Sign Language Audio & Tactile Guide</span>
        </div>
        <BiDirectionalSignTranslator
          initialWord="Hello"
          themeColor="amber"
          auditoryVoiceGuide={true}
          onSignRecognized={(word) => {
            ttsService.speak(`Your companion signed: ${word}`);
            soundEffectService.playSuccessChime();
          }}
        />
      </div>

      {/* Hidden video element for live vision pipeline */}
      <video ref={videoRef} playsInline muted className="hidden" />
      <canvas ref={canvasRef} className="hidden" />
    </div>
  );
};
