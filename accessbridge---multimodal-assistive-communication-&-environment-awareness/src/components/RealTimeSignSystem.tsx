import React, { useState, useRef, useEffect, useCallback } from 'react';
import { 
  Camera, 
  CameraOff, 
  Hand, 
  Volume2, 
  Sparkles, 
  CheckCircle2, 
  AlertCircle, 
  Play, 
  Pause, 
  RotateCcw, 
  Sliders, 
  Copy, 
  Trash2, 
  Layers,
  ArrowRight,
  Radio,
  Eye
} from 'lucide-react';
import { SignClassInfo, FrameLandmarks, LandmarkPoint } from '../types';
import { INCLUDE_50_CLASSES } from '../data/include50';
import { realtimeHandTracker, RealtimeGestureDetection } from '../services/realtimeHandTracker';
import { landmarkTrackingService } from '../services/landmarkTrackingService';
import { RealisticHandSignPerformer } from './RealisticHandSignPerformer';
import { SigningAvatarViewer } from './SigningAvatarViewer';
import { ttsService } from '../services/ttsService';

interface RealTimeSignSystemProps {
  onWordRecognized?: (word: string) => void;
  activeModelName?: string | null;
  themeColor?: 'sky' | 'emerald' | 'amber';
}

export const RealTimeSignSystem: React.FC<RealTimeSignSystemProps> = ({
  onWordRecognized,
  activeModelName = 'Compact Transformer Encoder (v1.0)',
  themeColor = 'sky'
}) => {
  const [activeTab, setActiveTab] = useState<'continuous_live' | 'practice_mirror'>('continuous_live');
  const [targetSign, setTargetSign] = useState<SignClassInfo>(INCLUDE_50_CLASSES[0]);

  // Video & Canvas refs for live webcam
  const videoRef = useRef<HTMLVideoElement | null>(null);
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const [isCameraActive, setIsCameraActive] = useState(false);
  const animFrameRef = useRef<number | null>(null);

  // Live detection state
  const [liveDetection, setLiveDetection] = useState<RealtimeGestureDetection>({
    predictedClass: 'Camera Standby',
    classId: -1,
    confidence: 0,
    isStableGesture: false,
    stabilityFrames: 0,
    rightHandState: null,
    leftHandState: null,
    twoHanded: false,
    latencyMs: 0,
    isGeometricHeuristic: true,
    method: 'Geometric Rule Heuristic (demo)'
  });

  // Real-time Sentence Builder
  const [accumulatedSentence, setAccumulatedSentence] = useState<string>('');
  const [autoSpeakEnabled, setAutoSpeakEnabled] = useState(true);
  const [copiedNotification, setCopiedNotification] = useState(false);

  // Camera start / stop
  const startCamera = async () => {
    try {
      await landmarkTrackingService.initialize();
      const stream = await navigator.mediaDevices.getUserMedia({
        video: { width: 640, height: 480, facingMode: 'user' },
        audio: false
      });
      if (videoRef.current) {
        videoRef.current.srcObject = stream;
        await videoRef.current.play();
        setIsCameraActive(true);
      }
    } catch (e) {
      console.warn('Camera startup notice:', e);
    }
  };

  const stopCamera = () => {
    if (videoRef.current && videoRef.current.srcObject) {
      const stream = videoRef.current.srcObject as MediaStream;
      stream.getTracks().forEach(t => t.stop());
      videoRef.current.srcObject = null;
    }
    if (animFrameRef.current) cancelAnimationFrame(animFrameRef.current);
    setIsCameraActive(false);
  };

  useEffect(() => {
    return () => stopCamera();
  }, []);

  // Continuous 30 FPS Live Landmark & Gesture Tracking Loop
  const processLiveStream = useCallback(() => {
    if (!videoRef.current || !canvasRef.current || !isCameraActive) return;

    const video = videoRef.current;
    const canvas = canvasRef.current;
    const ctx = canvas.getContext('2d');
    if (!ctx || video.readyState !== 4) {
      animFrameRef.current = requestAnimationFrame(processLiveStream);
      return;
    }

    if (canvas.width !== video.videoWidth || canvas.height !== video.videoHeight) {
      canvas.width = video.videoWidth || 640;
      canvas.height = video.videoHeight || 480;
    }

    ctx.clearRect(0, 0, canvas.width, canvas.height);

    const t = Date.now() / 1000;
    const w = canvas.width;
    const h = canvas.height;

    // Genuine landmark state from real MediaPipe Vision detector
    const tracked = landmarkTrackingService.processVideoFrame(video, performance.now());
    const frame: FrameLandmarks = tracked ? {
      timestamp: tracked.timestamp,
      rightHand: tracked.rightHand,
      leftHand: tracked.leftHand,
      pose: tracked.pose ? [
        tracked.pose[11],
        tracked.pose[12],
        tracked.pose[13],
        tracked.pose[14]
      ] : null,
      hasRightHand: tracked.hasRightHand,
      hasLeftHand: tracked.hasLeftHand,
      hasPose: tracked.hasPose
    } : {
      timestamp: Date.now(),
      rightHand: null,
      leftHand: null,
      pose: null,
      hasRightHand: false,
      hasLeftHand: false,
      hasPose: false
    };

    // Run Real-Time Classification
    const detection = realtimeHandTracker.processLiveFrame(frame, activeModelName || '1D-CNN (Convolutional)');
    setLiveDetection(detection);

    // Auto-accumulate sentence when sign is stable
    if (detection.isStableGesture && detection.predictedClass && detection.classId >= 0) {
      if (realtimeHandTracker.shouldAutoSpeak(detection.predictedClass)) {
        setAccumulatedSentence(prev => prev ? `${prev} ${detection.predictedClass}` : detection.predictedClass);
        onWordRecognized?.(detection.predictedClass);
        if (autoSpeakEnabled) {
          ttsService.speak(detection.predictedClass);
        }
      }
    }

    // Render Neon MediaPipe Hand Skeleton Overlay on Canvas
    ctx.save();
    ctx.scale(-1, 1);
    ctx.translate(-w, 0);

    const rhPoints = frame.rightHand || [];
    if (rhPoints.length > 0) {
      ctx.strokeStyle = detection.isStableGesture ? '#34D399' : '#38BDF8';
      ctx.lineWidth = 3;

      // Draw hand skeleton lines
      rhPoints.forEach((pt, idx) => {
        const px = pt.x * w;
        const py = pt.y * h;

        ctx.fillStyle = idx === 0 ? '#FACC15' : (detection.isStableGesture ? '#10B981' : '#0284C7');
        ctx.beginPath();
        ctx.arc(px, py, idx === 0 ? 6 : 4, 0, Math.PI * 2);
        ctx.fill();

        // Connect to wrist
        if (idx > 0 && idx % 4 === 1) {
          ctx.beginPath();
          ctx.moveTo(rhPoints[0].x * w, rhPoints[0].y * h);
          ctx.lineTo(px, py);
          ctx.stroke();
        }
      });
    }

    ctx.restore();

    animFrameRef.current = requestAnimationFrame(processLiveStream);
  }, [isCameraActive, activeModelName, autoSpeakEnabled, onWordRecognized]);

  useEffect(() => {
    if (isCameraActive) animFrameRef.current = requestAnimationFrame(processLiveStream);
    return () => {
      if (animFrameRef.current) cancelAnimationFrame(animFrameRef.current);
    };
  }, [isCameraActive, processLiveStream]);

  return (
    <div className="bg-slate-900 border-2 border-slate-800 rounded-3xl p-6 shadow-xl space-y-6">
      {/* Top Header Switcher */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-4 border-b border-slate-800">
        <div className="flex items-center gap-3">
          <div className="w-11 h-11 rounded-2xl bg-emerald-600/30 border border-emerald-500/50 flex items-center justify-center text-emerald-400">
            <Radio className="w-6 h-6 animate-pulse" />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <h2 className="text-lg font-black text-white">
                Real-Time Sign Language Engine
              </h2>
              <span className="text-xs text-emerald-400 font-mono font-bold bg-emerald-950/60 px-2 py-0.5 rounded-full border border-emerald-800/60">
                Live 30 FPS
              </span>
            </div>
            <p className="text-xs text-slate-400">
              Continuous hand tracking, real-time sign recognition, and realistic anatomical performers.
            </p>
          </div>
        </div>

        {/* Tab Switcher */}
        <div className="flex items-center gap-1 p-1 bg-slate-950 border border-slate-800 rounded-xl text-xs font-bold">
          <button
            onClick={() => setActiveTab('continuous_live')}
            className={`min-h-[38px] px-4 py-1.5 rounded-lg transition-colors ${
              activeTab === 'continuous_live' ? 'bg-emerald-600 text-white shadow-sm' : 'text-slate-400 hover:text-white'
            }`}
          >
            Live Webcam Recognition
          </button>
          <button
            onClick={() => setActiveTab('practice_mirror')}
            className={`min-h-[38px] px-4 py-1.5 rounded-lg transition-colors ${
              activeTab === 'practice_mirror' ? 'bg-sky-600 text-white shadow-sm' : 'text-slate-400 hover:text-white'
            }`}
          >
            Practice Mirror & Performer
          </button>
        </div>
      </div>

      {/* Tab 1: Continuous Live Real-Time Recognition */}
      {activeTab === 'continuous_live' && (
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
          {/* Live Webcam with Real-Time HUD (7 Cols) */}
          <div className="lg:col-span-7 space-y-4">
            <div className="relative bg-slate-950 border border-slate-800 rounded-3xl overflow-hidden aspect-[4/3] flex items-center justify-center shadow-inner">
              <video
                ref={videoRef}
                playsInline
                muted
                className={`w-full h-full object-cover scale-x-[-1] ${!isCameraActive ? 'hidden' : ''}`}
              />
              <canvas
                ref={canvasRef}
                className="absolute inset-0 w-full h-full pointer-events-none"
              />

              {!isCameraActive && (
                <div className="text-center p-8 space-y-3">
                  <Hand className="w-12 h-12 text-slate-600 mx-auto" />
                  <div className="text-sm font-bold text-white">Live Camera Inactive</div>
                  <p className="text-xs text-slate-400 max-w-sm">
                    Start camera to perform real hand signs. The system continuously tracks your fingers and translates in real-time.
                  </p>
                  <button
                    onClick={startCamera}
                    className="min-h-[44px] px-6 py-2 bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-bold rounded-xl inline-flex items-center gap-2 shadow-lg"
                  >
                    <Camera className="w-4 h-4" />
                    <span>Start Live Hand Tracker</span>
                  </button>
                </div>
              )}

              {/* Live HUD Banner: Predicted Sign */}
              {isCameraActive && (
                <div className="absolute top-4 left-4 right-4 bg-slate-900/90 backdrop-blur-xs border border-slate-800 p-3 rounded-2xl flex items-center justify-between shadow-xl">
                  <div className="flex items-center gap-3">
                    <span className={`w-3 h-3 rounded-full ${liveDetection.isStableGesture ? 'bg-emerald-400 animate-ping' : 'bg-sky-400'}`} />
                    <div>
                      <div className="flex items-center gap-2">
                        <span className="text-[10px] text-slate-400 uppercase font-mono">Live Recognized Sign</span>
                        <span className={`px-1.5 py-0.5 rounded text-[9px] font-mono border ${
                          liveDetection.isGeometricHeuristic 
                            ? 'bg-amber-500/20 text-amber-300 border-amber-500/30' 
                            : 'bg-emerald-500/20 text-emerald-300 border-emerald-500/30'
                        }`}>
                          {liveDetection.method || (liveDetection.isGeometricHeuristic ? 'Geometric Rule Heuristic (demo)' : 'PyTorch Backend')}
                        </span>
                      </div>
                      <div className="text-xl font-black text-white tracking-tight">
                        &ldquo;{liveDetection.predictedClass}&rdquo;
                      </div>
                    </div>
                  </div>

                  <div className="text-right font-mono">
                    <div className="text-xs font-bold text-emerald-400">
                      {(liveDetection.confidence * 100).toFixed(0)}% Conf
                    </div>
                    <div className="text-[10px] text-slate-500">
                      {liveDetection.latencyMs} ms Latency
                    </div>
                  </div>
                </div>
              )}

              {/* Live HUD Bottom: Hand Anatomy States */}
              {isCameraActive && liveDetection.rightHandState && (
                <div className="absolute bottom-4 left-4 right-4 bg-slate-900/85 backdrop-blur-xs border border-slate-800 p-2.5 rounded-2xl flex items-center justify-between text-[11px] text-slate-300">
                  <div className="flex items-center gap-2">
                    <span className="text-slate-400">Fingers:</span>
                    <span className={liveDetection.rightHandState.thumbExtended ? 'text-emerald-400' : 'text-slate-500'}>Thumb</span>
                    <span className={liveDetection.rightHandState.indexExtended ? 'text-emerald-400' : 'text-slate-500'}>Index</span>
                    <span className={liveDetection.rightHandState.middleExtended ? 'text-emerald-400' : 'text-slate-500'}>Middle</span>
                    <span className={liveDetection.rightHandState.ringExtended ? 'text-emerald-400' : 'text-slate-500'}>Ring</span>
                    <span className={liveDetection.rightHandState.pinkyExtended ? 'text-emerald-400' : 'text-slate-500'}>Pinky</span>
                  </div>

                  <span className="font-mono text-sky-400">Palm: {liveDetection.rightHandState.palmFacing}</span>
                </div>
              )}
            </div>

            {/* Camera Controls Bar */}
            <div className="flex items-center justify-between bg-slate-950 p-3 rounded-2xl border border-slate-800 text-xs">
              {isCameraActive ? (
                <button
                  onClick={stopCamera}
                  className="min-h-[38px] px-4 py-1.5 bg-rose-600/90 hover:bg-rose-500 text-white font-bold rounded-xl flex items-center gap-1.5"
                >
                  <CameraOff className="w-4 h-4" />
                  <span>Stop Tracking</span>
                </button>
              ) : (
                <button
                  onClick={startCamera}
                  className="min-h-[38px] px-4 py-1.5 bg-emerald-600 hover:bg-emerald-500 text-white font-bold rounded-xl flex items-center gap-1.5"
                >
                  <Camera className="w-4 h-4" />
                  <span>Start Tracking</span>
                </button>
              )}

              <label className="flex items-center gap-2 cursor-pointer text-slate-300">
                <input
                  type="checkbox"
                  checked={autoSpeakEnabled}
                  onChange={(e) => setAutoSpeakEnabled(e.target.checked)}
                  className="rounded bg-slate-800 text-emerald-500 focus:ring-emerald-400"
                />
                <span>Auto-Speak recognized sign aloud</span>
              </label>
            </div>
          </div>

          {/* Real-Time Sentence Builder (5 Cols) */}
          <div className="lg:col-span-5 space-y-4 flex flex-col justify-between">
            <div className="bg-slate-950 border border-slate-800 rounded-3xl p-5 space-y-3">
              <div className="flex items-center justify-between">
                <span className="text-xs font-bold text-slate-400 uppercase tracking-wider">
                  Continuous Sign Sentence Builder
                </span>
                {copiedNotification && <span className="text-xs text-emerald-400 font-bold">Copied!</span>}
              </div>

              <div className="p-4 bg-slate-900 border border-slate-800 rounded-2xl min-h-[120px] max-h-48 overflow-y-auto">
                <p className="text-lg font-bold text-white leading-relaxed">
                  {accumulatedSentence || 'Perform signs sequentially in front of the camera. Recognized words will accumulate here...'}
                </p>
              </div>

              {/* Utility Action Buttons */}
              <div className="flex items-center justify-between pt-2 border-t border-slate-800 text-xs">
                <div className="flex items-center gap-2">
                  <button
                    onClick={() => {
                      if (accumulatedSentence.trim()) ttsService.speak(accumulatedSentence.trim());
                    }}
                    disabled={!accumulatedSentence.trim()}
                    className="min-h-[38px] px-4 py-1.5 bg-emerald-600 hover:bg-emerald-500 disabled:opacity-50 text-white font-bold rounded-xl flex items-center gap-1.5"
                  >
                    <Volume2 className="w-3.5 h-3.5" />
                    <span>Speak All</span>
                  </button>

                  <button
                    onClick={() => {
                      if (accumulatedSentence.trim()) {
                        navigator.clipboard.writeText(accumulatedSentence.trim());
                        setCopiedNotification(true);
                        setTimeout(() => setCopiedNotification(false), 2000);
                      }
                    }}
                    disabled={!accumulatedSentence.trim()}
                    className="min-h-[38px] px-3 py-1.5 bg-slate-800 hover:bg-slate-700 disabled:opacity-50 text-slate-200 font-medium rounded-xl flex items-center gap-1.5"
                  >
                    <Copy className="w-3.5 h-3.5" />
                    <span>Copy</span>
                  </button>
                </div>

                <button
                  onClick={() => setAccumulatedSentence('')}
                  disabled={!accumulatedSentence.trim()}
                  className="min-h-[38px] px-3 py-1.5 bg-slate-800 hover:bg-rose-900/40 disabled:opacity-50 text-slate-400 hover:text-rose-200 font-medium rounded-xl flex items-center gap-1.5"
                >
                  <Trash2 className="w-3.5 h-3.5" />
                  <span>Clear</span>
                </button>
              </div>
            </div>

            {/* Sign Recognition Guide Card */}
            <div className="bg-slate-950/80 border border-slate-800 rounded-3xl p-5 space-y-2 text-xs text-slate-400">
              <div className="font-bold text-slate-200 flex items-center gap-2">
                <Sparkles className="w-4 h-4 text-emerald-400" />
                <span>Real-Time Gesture Recognition Tips:</span>
              </div>
              <ul className="space-y-1 list-disc pl-4 text-slate-400 text-[11px]">
                <li><strong>&ldquo;Hello&rdquo;</strong>: Open palm beside temple, wave slightly.</li>
                <li><strong>&ldquo;Water&rdquo;</strong>: 3 fingers up (W shape), touch corner of mouth.</li>
                <li><strong>&ldquo;Help&rdquo;</strong>: Closed fist with thumb up placed on open flat palm.</li>
                <li><strong>&ldquo;Yes&rdquo;</strong>: Closed fist nodding downward twice.</li>
                <li><strong>&ldquo;No&rdquo;</strong>: Index and middle fingers snapping down against thumb.</li>
              </ul>
            </div>
          </div>
        </div>
      )}

      {/* Tab 2: Side-by-Side Practice Mirror & Rigged 3D Performer */}
      {activeTab === 'practice_mirror' && (
        <div className="space-y-6">
          <SigningAvatarViewer
            word={targetSign.name}
            onWordChange={(newWord) => {
              const f = INCLUDE_50_CLASSES.find(c => c.name.toLowerCase() === newWord.toLowerCase());
              if (f) setTargetSign(f);
            }}
            themeColor={themeColor}
          />
        </div>
      )}
    </div>
  );
};
