import React, { useState, useEffect, useRef, useCallback } from 'react';
import { 
  Camera, 
  CameraOff, 
  Volume2, 
  ArrowLeftRight, 
  Hand, 
  Sparkles,
  CheckCircle2,
  Clock,
  Layers,
  ShieldCheck,
  RotateCcw
} from 'lucide-react';
import { FrameLandmarks, SignPredictionResult } from '../types';
import { OFFICIAL_GREETINGS, GreetingClassName } from '../config/capabilities';
import { signService } from '../services/signService';
import { ttsService } from '../services/ttsService';
import { landmarkTrackingService } from '../services/landmarkTrackingService';
import { SigningAvatarViewer } from './SigningAvatarViewer';

interface BiDirectionalSignTranslatorProps {
  initialWord?: string;
  themeColor?: 'sky' | 'emerald' | 'amber';
  onSignRecognized?: (word: string) => void;
  showCameraInput?: boolean;
  auditoryVoiceGuide?: boolean;
  compact?: boolean;
}

export const BiDirectionalSignTranslator: React.FC<BiDirectionalSignTranslatorProps> = ({
  initialWord = 'Hello',
  themeColor = 'sky',
  onSignRecognized,
  showCameraInput = true,
  auditoryVoiceGuide = false,
  compact = false
}) => {
  // Mode: 'speech_to_sign' (Text/Speech -> VRM Sign Avatar) vs 'sign_to_speech' (Camera -> Recognition)
  const [direction, setDirection] = useState<'speech_to_sign' | 'sign_to_speech'>('speech_to_sign');

  // Direction 1 state: VRM Sign Avatar
  const [inputQuery, setInputQuery] = useState(initialWord);

  // Direction 2 state: Real Camera Sign Recognition
  const videoRef = useRef<HTMLVideoElement | null>(null);
  const camCanvasRef = useRef<HTMLCanvasElement | null>(null);
  const [isCameraActive, setIsCameraActive] = useState(false);
  const [isCapturingSign, setIsCapturingSign] = useState(false);
  const [captureProgress, setCaptureProgress] = useState(0);
  const [recognizedResult, setRecognizedResult] = useState<SignPredictionResult | null>(null);
  const [trackingFps, setTrackingFps] = useState(0);
  const [handsDetected, setHandsDetected] = useState(false);

  const recordingFramesRef = useRef<FrameLandmarks[]>([]);
  const camAnimRef = useRef<number | null>(null);

  // Theme styling
  const colors = {
    sky: {
      accent: 'text-sky-400',
      bg: 'bg-sky-600 hover:bg-sky-500',
      border: 'border-sky-500/50',
      activeTab: 'bg-sky-600 text-white shadow-md'
    },
    emerald: {
      accent: 'text-emerald-400',
      bg: 'bg-emerald-600 hover:bg-emerald-500',
      border: 'border-emerald-500/50',
      activeTab: 'bg-emerald-600 text-white shadow-md'
    },
    amber: {
      accent: 'text-amber-400',
      bg: 'bg-amber-500 hover:bg-amber-400 text-black',
      border: 'border-amber-400/50',
      activeTab: 'bg-amber-400 text-black font-bold shadow-md'
    }
  }[themeColor];

  // Stop camera stream cleanly
  const stopCamera = useCallback(() => {
    if (videoRef.current && videoRef.current.srcObject) {
      const stream = videoRef.current.srcObject as MediaStream;
      stream.getTracks().forEach(t => t.stop());
      videoRef.current.srcObject = null;
    }
    if (camAnimRef.current) {
      cancelAnimationFrame(camAnimRef.current);
      camAnimRef.current = null;
    }
    setIsCameraActive(false);
  }, []);

  // Continuous tracking loop with real MediaPipe HandLandmarker + PoseLandmarker
  const runCameraTrackingLoop = useCallback(() => {
    if (!videoRef.current || !camCanvasRef.current || !isCameraActive) return;

    const video = videoRef.current;
    const canvas = camCanvasRef.current;
    const ctx = canvas.getContext('2d');

    if (!ctx || video.readyState < 2) {
      camAnimRef.current = requestAnimationFrame(runCameraTrackingLoop);
      return;
    }

    if (canvas.width !== video.videoWidth || canvas.height !== video.videoHeight) {
      canvas.width = video.videoWidth || 640;
      canvas.height = video.videoHeight || 480;
    }

    ctx.clearRect(0, 0, canvas.width, canvas.height);

    // Process real frame
    const trackedFrame = landmarkTrackingService.processVideoFrame(video, performance.now());
    const status = landmarkTrackingService.getStatus();
    setTrackingFps(status.measuredFps);

    if (trackedFrame) {
      const hasHands = trackedFrame.hasRightHand || trackedFrame.hasLeftHand;
      setHandsDetected(hasHands);

      const w = canvas.width;
      const h = canvas.height;

      // Draw real skeleton on canvas (mirrored)
      ctx.save();
      ctx.scale(-1, 1);
      ctx.translate(-w, 0);

      // Draw Right Hand
      if (trackedFrame.rightHand) {
        ctx.fillStyle = '#34D399';
        ctx.strokeStyle = '#34D399';
        ctx.lineWidth = 2;
        trackedFrame.rightHand.forEach((pt) => {
          ctx.beginPath();
          ctx.arc(pt.x * w, pt.y * h, 4, 0, Math.PI * 2);
          ctx.fill();
        });
      }

      // Draw Left Hand
      if (trackedFrame.leftHand) {
        ctx.fillStyle = '#F472B6';
        ctx.strokeStyle = '#F472B6';
        ctx.lineWidth = 2;
        trackedFrame.leftHand.forEach((pt) => {
          ctx.beginPath();
          ctx.arc(pt.x * w, pt.y * h, 4, 0, Math.PI * 2);
          ctx.fill();
        });
      }

      // Draw Torso & Shoulders
      if (trackedFrame.pose) {
        ctx.fillStyle = '#38BDF8';
        const keyPoseIndices = [11, 12, 13, 14]; // Shoulders & elbows
        keyPoseIndices.forEach((idx) => {
          const pt = trackedFrame.pose?.[idx];
          if (pt) {
            ctx.beginPath();
            ctx.arc(pt.x * w, pt.y * h, 5, 0, Math.PI * 2);
            ctx.fill();
          }
        });
      }

      ctx.restore();

      // If recording, collect genuine tracked frame
      if (isCapturingSign) {
        const pose4 = trackedFrame.pose ? [
          trackedFrame.pose[11],
          trackedFrame.pose[12],
          trackedFrame.pose[13],
          trackedFrame.pose[14]
        ] : null;

        recordingFramesRef.current.push({
          timestamp: trackedFrame.timestamp,
          rightHand: trackedFrame.rightHand,
          leftHand: trackedFrame.leftHand,
          pose: pose4,
          hasRightHand: trackedFrame.hasRightHand,
          hasLeftHand: trackedFrame.hasLeftHand,
          hasPose: trackedFrame.hasPose
        });
      }
    } else {
      setHandsDetected(false);
    }

    camAnimRef.current = requestAnimationFrame(runCameraTrackingLoop);
  }, [isCameraActive, isCapturingSign]);

  // Start Camera
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
      console.warn('[BiDirectionalSignTranslator] Camera start error:', e);
    }
  };

  useEffect(() => {
    if (isCameraActive && direction === 'sign_to_speech') {
      camAnimRef.current = requestAnimationFrame(runCameraTrackingLoop);
    }
    return () => {
      if (camAnimRef.current) cancelAnimationFrame(camAnimRef.current);
    };
  }, [isCameraActive, direction, runCameraTrackingLoop]);

  useEffect(() => {
    return () => stopCamera();
  }, [stopCamera]);

  // Handle Sign Capture & Prediction
  const handleCaptureSign = async () => {
    if (!isCameraActive) await startCamera();
    recordingFramesRef.current = [];
    setIsCapturingSign(true);
    setCaptureProgress(0);
    setRecognizedResult(null);

    let progress = 0;
    const interval = setInterval(async () => {
      progress += 4;
      setCaptureProgress(Math.min(100, progress));

      if (progress >= 100) {
        clearInterval(interval);
        setIsCapturingSign(false);

        const frames = recordingFramesRef.current;
        const result = await signService.predictAsync(frames, '1D-CNN (Convolutional)');
        setRecognizedResult(result);

        if (!result.isUnknownOrRejected) {
          onSignRecognized?.(result.className);
          ttsService.speak(result.className);
        }
      }
    }, 100);
  };

  const handleSelectWord = (greetingName: string) => {
    setInputQuery(greetingName);
    if (auditoryVoiceGuide) {
      ttsService.speak(`Sign demonstrating: ${greetingName}`);
    }
  };

  return (
    <div className={`bg-slate-900 border border-slate-800 rounded-2xl shadow-xl space-y-4 ${compact ? 'p-3' : 'p-5'}`}>
      {/* Bidirectional Header Switcher */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-3 border-b border-slate-800">
        <div className="flex items-center gap-2.5">
          <div className="w-8 h-8 rounded-lg bg-sky-500/10 border border-sky-500/20 flex items-center justify-center text-sky-400">
            <ArrowLeftRight className="w-4 h-4" />
          </div>
          <div>
            <h3 className="text-sm font-bold text-white flex items-center gap-1.5">
              <span>Two-Way Sign Language Bridge</span>
              <span className="text-[10px] text-sky-400 font-mono">VRM + MediaPipe</span>
            </h3>
            <p className="text-[11px] text-slate-400">
              Bidirectional: Speech/Text $\rightleftharpoons$ Indian Sign Language (5 Checkpoint Classes)
            </p>
          </div>
        </div>

        {/* Direction Switcher Toggle */}
        <div className="flex items-center gap-1 p-1 bg-slate-950 border border-slate-800 rounded-xl text-xs font-semibold">
          <button
            onClick={() => {
              setDirection('speech_to_sign');
              stopCamera();
            }}
            className={`px-3 py-1.5 rounded-lg transition-colors ${
              direction === 'speech_to_sign' ? colors.activeTab : 'text-slate-400 hover:text-white'
            }`}
          >
            Speech / Text → Sign Avatar
          </button>
          {showCameraInput && (
            <button
              onClick={() => {
                setDirection('sign_to_speech');
                startCamera();
              }}
              className={`px-3 py-1.5 rounded-lg transition-colors ${
                direction === 'sign_to_speech' ? colors.activeTab : 'text-slate-400 hover:text-white'
              }`}
            >
              Camera Sign → Speech
            </button>
          )}
        </div>
      </div>

      {/* Direction 1: Speech / Text -> Official VRM Avatar */}
      {direction === 'speech_to_sign' && (
        <div className="space-y-4">
          <SigningAvatarViewer
            word={inputQuery}
            themeColor={themeColor}
            onWordChange={(newW) => setInputQuery(newW)}
          />

          {/* Quick Word Buttons */}
          <div className="bg-slate-950 p-3 rounded-xl border border-slate-800 space-y-2">
            <div className="flex items-center justify-between">
              <span className="text-xs font-bold text-slate-400 uppercase tracking-wider">
                Select Sign Greeting:
              </span>
              <span className="text-xs text-sky-400 font-mono">Active Model: 1D-CNN</span>
            </div>
            <div className="flex flex-wrap gap-2">
              {OFFICIAL_GREETINGS.map((g) => (
                <button
                  key={g.id}
                  onClick={() => handleSelectWord(g.name)}
                  className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition-all ${
                    inputQuery.toLowerCase() === g.name.toLowerCase()
                      ? 'bg-sky-500 text-white shadow'
                      : 'bg-slate-900 hover:bg-slate-800 text-slate-300 border border-slate-800'
                  }`}
                >
                  {g.name}
                </button>
              ))}
            </div>
          </div>
        </div>
      )}

      {/* Direction 2: Camera Sign -> Speech Recognition */}
      {direction === 'sign_to_speech' && (
        <div className="grid grid-cols-1 md:grid-cols-12 gap-5">
          <div className="md:col-span-7 space-y-3">
            <div className="relative bg-slate-950 border border-slate-800 rounded-2xl overflow-hidden aspect-[4/3] flex items-center justify-center">
              <video
                ref={videoRef}
                playsInline
                muted
                className={`w-full h-full object-cover scale-x-[-1] ${!isCameraActive ? 'hidden' : ''}`}
              />
              <canvas
                ref={camCanvasRef}
                className="absolute inset-0 w-full h-full pointer-events-none"
              />

              {!isCameraActive && (
                <div className="text-center p-6 space-y-2">
                  <Hand className="w-10 h-10 text-slate-600 mx-auto" />
                  <div className="text-xs font-bold text-white">Camera Standby</div>
                  <button
                    onClick={startCamera}
                    className={`min-h-[38px] px-4 py-1.5 text-xs font-bold rounded-lg ${colors.bg}`}
                  >
                    Start Real Camera
                  </button>
                </div>
              )}

              {/* Real Telemetry Bar */}
              {isCameraActive && (
                <div className="absolute top-3 left-3 flex items-center gap-2 px-2.5 py-1 rounded-md bg-slate-900/80 backdrop-blur-md text-[11px] font-mono text-slate-300 border border-slate-700/50">
                  <span className={`w-2 h-2 rounded-full ${handsDetected ? 'bg-emerald-400' : 'bg-amber-400'}`} />
                  <span>{trackingFps} FPS</span>
                  <span>|</span>
                  <span>{handsDetected ? 'Hands Tracked' : 'Searching Hands'}</span>
                </div>
              )}

              {isCapturingSign && (
                <div className="absolute top-3 right-3 bg-slate-900/90 border border-sky-400 px-3 py-1.5 rounded-lg text-xs font-bold text-white flex items-center gap-2">
                  <span className="w-2 h-2 rounded-full bg-sky-400 animate-ping" />
                  <span>Recording: {captureProgress}%</span>
                </div>
              )}
            </div>

            {/* Action Bar */}
            <div className="flex items-center gap-3">
              <button
                onClick={handleCaptureSign}
                disabled={isCapturingSign}
                className={`flex-1 py-2.5 px-4 rounded-xl font-bold text-xs flex items-center justify-center gap-2 transition-all ${
                  isCapturingSign
                    ? 'bg-slate-800 text-slate-500 cursor-not-allowed'
                    : `${colors.bg} text-white shadow-lg`
                }`}
              >
                <Camera className="w-4 h-4" />
                <span>{isCapturingSign ? `Capturing... (${captureProgress}%)` : 'Capture & Recognize Sign'}</span>
              </button>

              <button
                onClick={isCameraActive ? stopCamera : startCamera}
                className="p-2.5 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-300 border border-slate-700 transition-all"
                title={isCameraActive ? 'Turn off camera' : 'Turn on camera'}
              >
                {isCameraActive ? <CameraOff className="w-4 h-4" /> : <Camera className="w-4 h-4" />}
              </button>
            </div>
          </div>

          {/* Results Side Panel */}
          <div className="md:col-span-5 flex flex-col justify-between space-y-4 bg-slate-950 p-4 rounded-2xl border border-slate-800">
            <div>
              <div className="flex items-center justify-between pb-2 border-b border-slate-800 mb-3">
                <span className="text-xs font-bold text-slate-400 uppercase tracking-wider">
                  Model Prediction
                </span>
                <span className="text-xs text-emerald-400 font-mono font-semibold">
                  Local 1D-CNN
                </span>
              </div>

              {recognizedResult ? (
                <div className="space-y-3">
                  <div className="p-4 rounded-xl bg-slate-900 border border-slate-800 space-y-1">
                    <span className="text-xs text-slate-400">Class Recognized:</span>
                    <h4 className="text-2xl font-bold text-white tracking-wide">
                      {recognizedResult.className}
                    </h4>
                    <div className="flex items-center gap-2 text-xs font-mono text-slate-400 pt-1">
                      <span>Confidence: {(recognizedResult.confidence * 100).toFixed(1)}%</span>
                      <span>•</span>
                      <span>Latency: {recognizedResult.inferenceLatencyMs}ms</span>
                    </div>
                  </div>

                  {recognizedResult.isUnknownOrRejected && (
                    <div className="p-3 rounded-lg bg-amber-500/10 border border-amber-500/20 text-xs text-amber-300">
                      {recognizedResult.rejectionReason || 'Sign was rejected or confidence was below threshold.'}
                    </div>
                  )}
                </div>
              ) : (
                <div className="text-center py-10 text-slate-500 text-xs">
                  <Sparkles className="w-8 h-8 mx-auto mb-2 opacity-40 text-sky-400" />
                  <p>Hold your hand sign in the camera frame and click &ldquo;Capture & Recognize Sign&rdquo;.</p>
                </div>
              )}
            </div>

            <div className="p-3 rounded-xl bg-slate-900/60 border border-slate-800 text-[11px] text-slate-400 space-y-1">
              <div className="flex items-center gap-1.5 text-slate-300 font-semibold">
                <ShieldCheck className="w-3.5 h-3.5 text-emerald-400" />
                <span>Truthful Recognition Pipeline</span>
              </div>
              <p>
                Uses MediaPipe on-device WASM keypoint extraction + PyTorch 1D-CNN trained on ISL dataset.
              </p>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
