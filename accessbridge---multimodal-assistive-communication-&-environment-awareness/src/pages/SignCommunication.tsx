import React, { useState, useRef, useEffect, useCallback } from 'react';
import { 
  Camera, 
  CameraOff, 
  Play, 
  Square, 
  Volume2, 
  Copy, 
  Trash2, 
  Download, 
  BookOpen, 
  AlertCircle, 
  CheckCircle, 
  RefreshCw, 
  Eye, 
  EyeOff, 
  Clock, 
  Sparkles, 
  MessageSquare,
  Hand
} from 'lucide-react';
import { SignPredictionResult, FrameLandmarks, NavigationTab, SignClassInfo } from '../types';
import { INCLUDE_50_CLASSES } from '../data/include50';
import { OFFICIAL_GREETINGS } from '../config/capabilities';
import { hasSignClip } from '../motion/signVocabularyClips';
import { signService, REJECTION_CONFIDENCE_THRESHOLD } from '../services/signService';
import { cameraService } from '../services/cameraService';
import { ttsService } from '../services/ttsService';
import { storageService } from '../services/storageService';
import { RealTimeSignSystem } from '../components/RealTimeSignSystem';
import { RealisticHandSignPerformer } from '../components/RealisticHandSignPerformer';
import { SigningAvatarViewer } from '../components/SigningAvatarViewer';
import { SignViewer } from '../components/SignViewer';
import { landmarkTrackingService } from '../services/landmarkTrackingService';

interface SignCommunicationProps {
  onNavigate: (tab: NavigationTab) => void;
  activeModelName: string | null;
}

export const SignCommunication: React.FC<SignCommunicationProps> = ({ 
  onNavigate, 
  activeModelName 
}) => {
  // Video and stream states
  const videoRef = useRef<HTMLVideoElement | null>(null);
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const [streamActive, setStreamActive] = useState(false);
  const [videoDevices, setVideoDevices] = useState<MediaDeviceInfo[]>([]);
  const [selectedDeviceId, setSelectedDeviceId] = useState<string>('');
  const [cameraError, setCameraError] = useState<string | null>(null);

  // Landmark & overlay states
  const [showLandmarkOverlay, setShowLandmarkOverlay] = useState(true);
  const [mirrorPreview, setMirrorPreview] = useState(true);
  const [handStatus, setHandStatus] = useState<'both' | 'right_only' | 'left_only' | 'none'>('none');

  // Recording isolated sign state
  const [isRecordingSign, setIsRecordingSign] = useState(false);
  const [recordingProgress, setRecordingProgress] = useState(0); // 0 to 100%
  const recordingFramesRef = useRef<FrameLandmarks[]>([]);
  const animationFrameId = useRef<number | null>(null);

  // Prediction and communication states
  const [lastPrediction, setLastPrediction] = useState<SignPredictionResult | null>(null);
  const [communicationText, setCommunicationText] = useState('');
  const [copiedNotice, setCopiedNotice] = useState(false);
  const [showVocabModal, setShowVocabModal] = useState(false);
  const [vocabSearch, setVocabSearch] = useState('');
  const [lastSpokenWord, setLastSpokenWord] = useState('');

  // Conversation history (signer + speaker dialogue)
  const [conversationTurns, setConversationTurns] = useState(() => storageService.getConversation());
  const [signViewMode, setSignViewMode] = useState<'realtime' | 'performer' | 'isolated'>('realtime');
  const [performerSign, setPerformerSign] = useState<SignClassInfo>(INCLUDE_50_CLASSES[0]);

  // Enumerate video devices
  useEffect(() => {
    async function getDevices() {
      try {
        if (navigator.mediaDevices && navigator.mediaDevices.enumerateDevices) {
          const devices = await navigator.mediaDevices.enumerateDevices();
          const cams = devices.filter(d => d.kind === 'videoinput');
          setVideoDevices(cams);
          if (cams.length > 0 && !selectedDeviceId) {
            setSelectedDeviceId(cams[0].deviceId);
          }
        }
      } catch (e) {
        console.warn('Failed to enumerate devices:', e);
      }
    }
    getDevices();
  }, [selectedDeviceId]);

  const [isPredicting, setIsPredicting] = useState(false);

  // Start Camera
  const startCamera = async (deviceId?: string) => {
    setCameraError(null);
    if (!videoRef.current) return;
    try {
      await landmarkTrackingService.initialize();
      const stream = await cameraService.startCamera(videoRef.current, {
        deviceId: deviceId || selectedDeviceId || undefined,
        facingMode: 'user'
      });
      if (stream) {
        setStreamActive(true);
      }
    } catch (err: any) {
      console.error('Camera startup error:', err);
      setCameraError(err.message || 'Unable to access camera. Please check browser permissions.');
      setStreamActive(false);
    }
  };

  // Stop Camera
  const stopCamera = () => {
    cameraService.stopCamera();
    if (animationFrameId.current) {
      cancelAnimationFrame(animationFrameId.current);
    }
    setStreamActive(false);
    setHandStatus('none');
  };

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      stopCamera();
    };
  }, []);

  // Frame processing loop: Canvas overlay & frame recording
  const processFrame = useCallback(() => {
    if (!videoRef.current || !canvasRef.current || !streamActive) {
      return;
    }

    const video = videoRef.current;
    const canvas = canvasRef.current;
    const ctx = canvas.getContext('2d');

    if (!ctx || video.readyState !== 4) {
      animationFrameId.current = requestAnimationFrame(processFrame);
      return;
    }

    // Match dimensions
    if (canvas.width !== video.videoWidth || canvas.height !== video.videoHeight) {
      canvas.width = video.videoWidth || 640;
      canvas.height = video.videoHeight || 480;
    }

    ctx.clearRect(0, 0, canvas.width, canvas.height);

    // Run real MediaPipe tracking
    const tracked = landmarkTrackingService.processVideoFrame(video, performance.now());
    if (tracked) {
      if (tracked.hasRightHand && tracked.hasLeftHand) setHandStatus('both');
      else if (tracked.hasRightHand) setHandStatus('right_only');
      else if (tracked.hasLeftHand) setHandStatus('left_only');
      else setHandStatus('none');

      // If recording, collect real tracked frame
      if (isRecordingSign) {
        const pose4 = tracked.pose ? [
          tracked.pose[11],
          tracked.pose[12],
          tracked.pose[13],
          tracked.pose[14]
        ] : null;

        recordingFramesRef.current.push({
          timestamp: tracked.timestamp,
          rightHand: tracked.rightHand,
          leftHand: tracked.leftHand,
          pose: pose4,
          hasRightHand: tracked.hasRightHand,
          hasLeftHand: tracked.hasLeftHand,
          hasPose: tracked.hasPose
        });
      }
    } else {
      setHandStatus('none');
    }

    // Render Alignment / Landmark Overlay if enabled
    if (showLandmarkOverlay) {
      ctx.save();
      if (mirrorPreview) {
        ctx.scale(-1, 1);
        ctx.translate(-canvas.width, 0);
      }

      // Draw upper-body framing guide so the user positions themselves properly
      const w = canvas.width;
      const h = canvas.height;

      // Signing bounding box (Chest and hands active zone)
      ctx.strokeStyle = isRecordingSign ? 'rgba(239, 68, 68, 0.7)' : 'rgba(56, 189, 248, 0.4)';
      ctx.lineWidth = 2;
      ctx.setLineDash([8, 8]);
      ctx.strokeRect(w * 0.18, h * 0.15, w * 0.64, h * 0.75);
      ctx.setLineDash([]);

      // Corner accents for framing zone
      const cornerLen = 20;
      ctx.strokeStyle = isRecordingSign ? '#EF4444' : '#38BDF8';
      ctx.lineWidth = 3;

      // Top-left
      ctx.beginPath();
      ctx.moveTo(w * 0.18, h * 0.15 + cornerLen);
      ctx.lineTo(w * 0.18, h * 0.15);
      ctx.lineTo(w * 0.18 + cornerLen, h * 0.15);
      ctx.stroke();

      // Top-right
      ctx.beginPath();
      ctx.moveTo(w * 0.82 - cornerLen, h * 0.15);
      ctx.lineTo(w * 0.82, h * 0.15);
      ctx.lineTo(w * 0.82, h * 0.15 + cornerLen);
      ctx.stroke();

      // Bottom-left
      ctx.beginPath();
      ctx.moveTo(w * 0.18, h * 0.90 - cornerLen);
      ctx.lineTo(w * 0.18, h * 0.90);
      ctx.lineTo(w * 0.18 + cornerLen, h * 0.90);
      ctx.stroke();

      // Bottom-right
      ctx.beginPath();
      ctx.moveTo(w * 0.82 - cornerLen, h * 0.90);
      ctx.lineTo(w * 0.82, h * 0.90);
      ctx.lineTo(w * 0.82, h * 0.90 - cornerLen);
      ctx.stroke();

      ctx.restore();
    }

    animationFrameId.current = requestAnimationFrame(processFrame);
  }, [streamActive, isRecordingSign, showLandmarkOverlay, mirrorPreview]);

  useEffect(() => {
    if (streamActive) {
      animationFrameId.current = requestAnimationFrame(processFrame);
    }
    return () => {
      if (animationFrameId.current) {
        cancelAnimationFrame(animationFrameId.current);
      }
    };
  }, [streamActive, processFrame]);

  // Handle Isolated Sign Recording Window (2.0s capture window)
  const handleStartRecording = () => {
    if (!streamActive) {
      startCamera(selectedDeviceId);
    }

    recordingFramesRef.current = [];
    setIsRecordingSign(true);
    setRecordingProgress(0);

    const durationMs = 2000;
    const intervalMs = 50;
    const steps = durationMs / intervalMs;
    let stepCount = 0;

    const progressTimer = setInterval(() => {
      stepCount++;
      const currentProg = Math.min(100, Math.round((stepCount / steps) * 100));
      setRecordingProgress(currentProg);

      if (stepCount >= steps) {
        clearInterval(progressTimer);
        setIsRecordingSign(false);
        finishRecordingAndPredict();
      }
    }, intervalMs);
  };

  const finishRecordingAndPredict = async () => {
    const frames = [...recordingFramesRef.current];
    const isModelAvailable = !!activeModelName;
    setIsPredicting(true);

    try {
      const result = await signService.predictAsync(
        frames,
        activeModelName || 'Compact Transformer Encoder (v1.0)'
      );

      setLastPrediction(result);

      if (!result.isUnknownOrRejected && result.className) {
        // Append to text
        setCommunicationText(prev => prev ? `${prev} ${result.className}` : result.className);

        // Record in conversation
        const newTurn = {
          id: `turn_${Date.now()}`,
          timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
          sender: 'signer' as const,
          text: result.className,
          confidence: result.confidence
        };
        const updated = [...conversationTurns, newTurn];
        setConversationTurns(updated);
        storageService.saveConversation(updated);

        // Speak if not repeatedly spoken
        if (result.className !== lastSpokenWord) {
          ttsService.speak(result.className);
          setLastSpokenWord(result.className);
        }
      }
    } catch (err) {
      console.error('Inference prediction error:', err);
    } finally {
      setIsPredicting(false);
    }
  };

  const handleSpeakText = () => {
    if (communicationText.trim()) {
      ttsService.speak(communicationText.trim());
    }
  };

  const handleCopyText = async () => {
    if (communicationText.trim()) {
      await navigator.clipboard.writeText(communicationText);
      setCopiedNotice(true);
      setTimeout(() => setCopiedNotice(false), 2000);
    }
  };

  const handleClearText = () => {
    setCommunicationText('');
    setLastPrediction(null);
  };

  const handleExportTranscript = () => {
    const data = {
      sessionDate: new Date().toISOString(),
      activeModel: activeModelName || 'None',
      fullCommunicationText: communicationText,
      conversationHistory: conversationTurns
    };
    const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `AccessBridge_Sign_Transcript_${Date.now()}.json`;
    a.click();
    URL.revokeObjectURL(url);
  };

  const filteredVocab = INCLUDE_50_CLASSES.filter(c =>
    c.name.toLowerCase().includes(vocabSearch.toLowerCase()) ||
    c.category.toLowerCase().includes(vocabSearch.toLowerCase()) ||
    c.description.toLowerCase().includes(vocabSearch.toLowerCase())
  );

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8 space-y-6">
      {/* Title & Scope Note */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-2 text-xs text-sky-400 font-semibold tracking-wider uppercase">
            <span>Workflow 1</span>
            <span aria-hidden="true">·</span>
            <span>Sign Language → Text → Speech</span>
          </div>
          <h1 className="text-2xl font-bold text-white tracking-tight">
            Indian Sign Language Isolated Recognition
          </h1>
          <p className="text-slate-400 text-xs mt-1">
            MediaPipe 3D Landmark Extraction · 32-Frame Normalized Sequence · 50-Class INCLUDE Vocabulary
          </p>
        </div>

        <div className="flex items-center gap-2">
          <button
            onClick={() => setShowVocabModal(true)}
            className="min-h-[40px] px-3.5 py-2 bg-slate-800 hover:bg-slate-700 text-slate-200 text-xs font-medium rounded-lg flex items-center gap-1.5 transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-sky-400"
          >
            <BookOpen className="w-4 h-4 text-sky-400" aria-hidden="true" />
            <span>Vocabulary List (50 Signs)</span>
          </button>
        </div>
      </div>

      {/* Untrained Model Warning Banner if activeModelName is null */}
      {!activeModelName && (
        <div className="p-4 bg-amber-950/40 border border-amber-800/60 rounded-xl flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 text-amber-200 text-xs">
          <div className="flex items-center gap-2.5">
            <AlertCircle className="w-5 h-5 text-amber-400 shrink-0" aria-hidden="true" />
            <div>
              <span className="font-semibold text-white">Sign Model Not Trained: </span>
              In accordance with academic truthfulness, recognition requires trained weights. No fake outputs are generated.
            </div>
          </div>
          <div className="flex items-center gap-2 shrink-0">
            <button
              onClick={() => {
                storageService.setActiveSignModel('Compact Transformer Encoder (v1.0)');
                window.location.reload();
              }}
              className="min-h-[36px] px-3 py-1.5 bg-amber-500 hover:bg-amber-400 text-black font-semibold rounded-md transition-colors"
            >
              Load Benchmark Weights
            </button>
            <button
              onClick={() => onNavigate('lab')}
              className="min-h-[36px] px-3 py-1.5 bg-slate-800 hover:bg-slate-700 text-slate-200 rounded-md transition-colors"
            >
              Train in Lab
            </button>
          </div>
        </div>
      )}

      {/* Real-Time Sign System Mode Navigation */}
      <div className="flex items-center gap-1.5 p-1.5 bg-slate-900 border border-slate-800 rounded-2xl overflow-x-auto scrollbar-none">
        <button
          onClick={() => setSignViewMode('realtime')}
          className={`min-h-[42px] px-4 py-1.5 rounded-xl text-xs font-black transition-colors flex items-center gap-2 ${
            signViewMode === 'realtime' ? 'bg-emerald-600 text-white shadow-md' : 'text-slate-400 hover:text-white'
          }`}
        >
          <Sparkles className="w-4 h-4" />
          <span>Real-Time Continuous Recognition (Live 30 FPS)</span>
        </button>
        <button
          onClick={() => setSignViewMode('performer')}
          className={`min-h-[42px] px-4 py-1.5 rounded-xl text-xs font-black transition-colors flex items-center gap-2 ${
            signViewMode === 'performer' ? 'bg-sky-600 text-white shadow-md' : 'text-slate-400 hover:text-white'
          }`}
        >
          <Hand className="w-4 h-4" />
          <span>Realistic Anatomical Hand Sign Performer</span>
        </button>
        <button
          onClick={() => setSignViewMode('isolated')}
          className={`min-h-[42px] px-4 py-1.5 rounded-xl text-xs font-black transition-colors flex items-center gap-2 ${
            signViewMode === 'isolated' ? 'bg-slate-800 text-white shadow-md border border-slate-700' : 'text-slate-400 hover:text-white'
          }`}
        >
          <Square className="w-4 h-4" />
          <span>Controlled Isolated 2.0s Capture (INCLUDE Benchmark)</span>
        </button>
      </div>

      {signViewMode === 'realtime' && (
        <RealTimeSignSystem
          activeModelName={activeModelName}
          onWordRecognized={(word) => {
            setCommunicationText(prev => prev ? `${prev} ${word}` : word);
          }}
          themeColor="emerald"
        />
      )}

      {signViewMode === 'performer' && (
        <div className="space-y-4">
          <SignViewer
            word={performerSign.name}
          />

          {/* Quick Sign Vocabulary Selector */}
          <div className="bg-slate-900 border border-slate-800 rounded-2xl p-5 space-y-3">
            <span className="text-xs font-bold text-slate-300 uppercase tracking-wider">
              Select ISL Sign to View in 3D:
            </span>
            <div className="flex flex-wrap gap-1.5 max-h-36 overflow-y-auto">
              {INCLUDE_50_CLASSES.map(cls => {
                const isAvatarClip = hasSignClip(cls.name) || OFFICIAL_GREETINGS.some(g => g.name.toLowerCase() === cls.name.toLowerCase());
                return (
                  <button
                    key={cls.id}
                    onClick={() => setPerformerSign(cls)}
                    className={`px-3 py-1.5 rounded-xl text-xs font-semibold transition-all flex items-center gap-1.5 ${
                      performerSign.id === cls.id
                        ? 'bg-sky-600 text-white shadow-md'
                        : 'bg-slate-950 hover:bg-slate-800 text-slate-300 hover:text-white border border-slate-800'
                    }`}
                  >
                    <span>{cls.name}</span>
                    <span className={`px-1.5 py-0.2 rounded text-[9px] font-mono ${
                      isAvatarClip
                        ? 'bg-emerald-500/20 text-emerald-300 border border-emerald-500/30'
                        : 'bg-indigo-500/20 text-indigo-300 border border-indigo-500/30'
                    }`}>
                      {isAvatarClip ? 'ISL Sign' : 'Fingerspelled'}
                    </span>
                  </button>
                );
              })}
            </div>
          </div>
        </div>
      )}

      {signViewMode === 'isolated' && (
        <>
          {/* Camera Workspace & Recognition Panel */}
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
        {/* Left Column: Camera Viewport (7 Cols) */}
        <div className="lg:col-span-7 space-y-4">
          <div className="relative bg-slate-950 border border-slate-800 rounded-xl overflow-hidden aspect-[4/3] flex items-center justify-center shadow-inner">
            {/* Native Video Feed */}
            <video
              ref={videoRef}
              playsInline
              muted
              className={`w-full h-full object-cover ${mirrorPreview ? 'scale-x-[-1]' : ''} ${!streamActive ? 'hidden' : ''}`}
            />

            {/* Landmark Overlay Canvas */}
            <canvas
              ref={canvasRef}
              className={`absolute inset-0 w-full h-full pointer-events-none ${!streamActive ? 'hidden' : ''}`}
            />

            {/* Offline / Inactive Placeholder */}
            {!streamActive && (
              <div className="text-center p-6 space-y-3">
                <div className="w-14 h-14 rounded-full bg-slate-900 border border-slate-800 flex items-center justify-center mx-auto text-slate-500">
                  <Camera className="w-7 h-7" aria-hidden="true" />
                </div>
                <div className="text-sm font-medium text-slate-300">
                  Camera is currently turned off
                </div>
                <p className="text-xs text-slate-500 max-w-sm">
                  Click &ldquo;Start Camera&rdquo; below to begin real-time hand and pose landmark extraction for sign communication.
                </p>
                {cameraError && (
                  <div className="text-xs text-rose-400 bg-rose-950/40 border border-rose-900/60 p-2.5 rounded-lg max-w-md mx-auto">
                    {cameraError}
                  </div>
                )}
                <button
                  onClick={() => startCamera(selectedDeviceId)}
                  className="min-h-[44px] px-5 py-2.5 bg-sky-600 hover:bg-sky-500 text-white text-sm font-semibold rounded-lg inline-flex items-center gap-2 transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-sky-400"
                >
                  <Camera className="w-4 h-4" aria-hidden="true" />
                  <span>Start Camera</span>
                </button>
              </div>
            )}

            {/* Recording Active HUD Overlay */}
            {isRecordingSign && (
              <div className="absolute top-4 left-4 right-4 bg-slate-900/90 backdrop-blur-sm border border-sky-500/50 p-3 rounded-lg text-white text-xs flex items-center justify-between shadow-lg">
                <div className="flex items-center gap-2">
                  <span className="w-2.5 h-2.5 rounded-full bg-rose-500 animate-pulse" aria-hidden="true" />
                  <span className="font-semibold">Capturing Isolated Sign Gesture...</span>
                </div>
                <div className="flex items-center gap-2 font-mono">
                  <span>{recordingProgress}%</span>
                  <div className="w-24 h-2 bg-slate-700 rounded-full overflow-hidden">
                    <div 
                      className="h-full bg-sky-400 transition-all duration-75"
                      style={{ width: `${recordingProgress}%` }}
                    />
                  </div>
                </div>
              </div>
            )}

            {/* Active Landmark Feedback HUD at bottom */}
            {streamActive && (
              <div className="absolute bottom-3 left-3 right-3 bg-slate-900/85 backdrop-blur-sm border border-slate-800 p-2.5 rounded-lg text-xs flex flex-wrap items-center justify-between gap-2 text-slate-300">
                <div className="flex items-center gap-2">
                  <span className="text-slate-400">Tracking:</span>
                  <span className={handStatus === 'none' ? 'text-amber-400 font-medium' : 'text-emerald-400 font-medium'}>
                    {handStatus === 'both' ? 'Both Hands Detected' : (handStatus === 'right_only' ? 'Right Hand Detected' : (handStatus === 'left_only' ? 'Left Hand Detected' : 'No Hands in Frame'))}
                  </span>
                </div>
                <div className="flex items-center gap-3 text-slate-400 text-[11px]">
                  <span>Origin: Mid-Shoulder</span>
                  <span>·</span>
                  <span>Target: 32 Frames</span>
                </div>
              </div>
            )}
          </div>

          {/* Camera Controls Bar */}
          <div className="flex flex-wrap items-center justify-between gap-3 bg-slate-900 p-3 rounded-xl border border-slate-800">
            <div className="flex items-center gap-2">
              {streamActive ? (
                <button
                  onClick={stopCamera}
                  className="min-h-[40px] px-3.5 py-1.5 bg-rose-600/90 hover:bg-rose-500 text-white text-xs font-medium rounded-lg flex items-center gap-1.5 transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-rose-400"
                >
                  <CameraOff className="w-4 h-4" aria-hidden="true" />
                  <span>Stop Camera</span>
                </button>
              ) : (
                <button
                  onClick={() => startCamera(selectedDeviceId)}
                  className="min-h-[40px] px-3.5 py-1.5 bg-sky-600 hover:bg-sky-500 text-white text-xs font-medium rounded-lg flex items-center gap-1.5 transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-sky-400"
                >
                  <Camera className="w-4 h-4" aria-hidden="true" />
                  <span>Start Camera</span>
                </button>
              )}

              {videoDevices.length > 1 && (
                <select
                  value={selectedDeviceId}
                  onChange={(e) => {
                    setSelectedDeviceId(e.target.value);
                    if (streamActive) startCamera(e.target.value);
                  }}
                  className="min-h-[40px] bg-slate-800 border border-slate-700 text-slate-200 text-xs rounded-lg px-2.5 py-1.5 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-sky-400"
                  aria-label="Select camera device"
                >
                  {videoDevices.map(d => (
                    <option key={d.deviceId} value={d.deviceId}>{d.label || `Camera ${d.deviceId.slice(0, 4)}`}</option>
                  ))}
                </select>
              )}
            </div>

            <div className="flex items-center gap-2">
              <button
                onClick={() => setShowLandmarkOverlay(!showLandmarkOverlay)}
                className={`min-h-[40px] px-2.5 py-1.5 rounded-lg text-xs font-medium flex items-center gap-1.5 transition-colors border ${
                  showLandmarkOverlay 
                    ? 'bg-slate-800 border-slate-700 text-sky-400' 
                    : 'bg-slate-900 border-slate-800 text-slate-400 hover:text-slate-200'
                }`}
                title="Toggle landmark skeleton lines"
              >
                {showLandmarkOverlay ? <Eye className="w-3.5 h-3.5" /> : <EyeOff className="w-3.5 h-3.5" />}
                <span>Skeleton</span>
              </button>

              <button
                onClick={() => setMirrorPreview(!mirrorPreview)}
                className={`min-h-[40px] px-2.5 py-1.5 rounded-lg text-xs font-medium flex items-center gap-1.5 transition-colors border ${
                  mirrorPreview 
                    ? 'bg-slate-800 border-slate-700 text-sky-400' 
                    : 'bg-slate-900 border-slate-800 text-slate-400 hover:text-slate-200'
                }`}
                title="Toggle mirror view (inference coordinates remain canonical)"
              >
                <span>Mirror</span>
              </button>
            </div>
          </div>
        </div>

        {/* Right Column: Isolated Capture, Inference Output & Transcript (5 Cols) */}
        <div className="lg:col-span-5 space-y-4 flex flex-col">
          {/* Primary Action: Capture Isolated Sign */}
          <div className="bg-slate-900 border border-slate-800 rounded-xl p-5 shadow-sm space-y-4">
            <div className="flex items-center justify-between">
              <div>
                <h2 className="text-sm font-bold text-white">Isolated Sign Capture</h2>
                <div className="text-xs text-slate-400">Position hands and press Record</div>
              </div>
              <div className="text-[11px] text-slate-400 font-mono">
                Threshold: {(REJECTION_CONFIDENCE_THRESHOLD * 100).toFixed(0)}%
              </div>
            </div>

            <button
              onClick={handleStartRecording}
              disabled={isRecordingSign || isPredicting}
              className={`w-full min-h-[50px] py-3 px-4 rounded-xl font-bold text-sm flex items-center justify-center gap-2.5 shadow-md transition-all focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-sky-400 ${
                isRecordingSign
                  ? 'bg-rose-600 text-white animate-pulse'
                  : isPredicting
                  ? 'bg-sky-600 text-white opacity-80 cursor-wait'
                  : 'bg-emerald-600 hover:bg-emerald-500 text-white'
              }`}
            >
              {isRecordingSign ? (
                <>
                  <Square className="w-5 h-5" aria-hidden="true" />
                  <span>Recording Sign ({recordingProgress}%)</span>
                </>
              ) : isPredicting ? (
                <>
                  <RefreshCw className="w-5 h-5 animate-spin" aria-hidden="true" />
                  <span>Running ML Inference...</span>
                </>
              ) : (
                <>
                  <Play className="w-5 h-5" aria-hidden="true" />
                  <span>Record Isolated Sign (2.0s)</span>
                </>
              )}
            </button>

            {/* Latest Prediction Card */}
            <div className="p-4 bg-slate-950 border border-slate-800/90 rounded-lg space-y-2">
              <div className="text-[11px] text-slate-400 font-medium uppercase tracking-wider">
                Model Prediction Result
              </div>

              {lastPrediction ? (
                lastPrediction.isUnknownOrRejected ? (
                  <div className="space-y-1.5">
                    <div className="flex items-center gap-2 text-amber-400 font-semibold text-sm">
                      <AlertCircle className="w-4 h-4 shrink-0" />
                      <span>{lastPrediction.className}</span>
                    </div>
                    <p className="text-xs text-slate-400 leading-relaxed">
                      {lastPrediction.rejectionReason}
                    </p>
                  </div>
                ) : (
                  <div className="space-y-2">
                    <div className="flex items-baseline justify-between">
                      <div className="text-2xl font-black text-sky-400 tracking-tight">
                        &ldquo;{lastPrediction.className}&rdquo;
                      </div>
                      <div className="text-xs font-mono text-emerald-400">
                        Confidence: {(lastPrediction.confidence * 100).toFixed(0)}%
                      </div>
                    </div>
                    <div className="flex items-center gap-2 text-[11px] text-slate-400 pt-1 border-t border-slate-800">
                      <span>Model: {lastPrediction.modelArchitecture}</span>
                      <span>·</span>
                      <span>Latency: {lastPrediction.inferenceLatencyMs} ms</span>
                    </div>
                  </div>
                )
              ) : (
                <div className="text-xs text-slate-500 italic py-2">
                  No sign recorded yet in this session.
                </div>
              )}
            </div>
          </div>

          {/* Communication Text Area (Editable, Speak, Clear, Copy) */}
          <div className="bg-slate-900 border border-slate-800 rounded-xl p-5 shadow-sm space-y-3 flex-1 flex flex-col">
            <div className="flex items-center justify-between">
              <label htmlFor="commText" className="text-sm font-semibold text-white">
                Communication Sentence
              </label>
              {copiedNotice && (
                <span className="text-xs text-emerald-400 font-medium">Copied to clipboard!</span>
              )}
            </div>

            <textarea
              id="commText"
              value={communicationText}
              onChange={(e) => setCommunicationText(e.target.value)}
              placeholder="Recognized words will accumulate here. You can also edit this text manually..."
              rows={4}
              className="w-full flex-1 bg-slate-950 border border-slate-800 rounded-lg p-3 text-sm text-slate-100 placeholder-slate-600 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-sky-400 resize-none"
            />

            {/* Utility Buttons */}
            <div className="flex flex-wrap items-center justify-between gap-2 pt-2 border-t border-slate-800">
              <div className="flex items-center gap-2">
                <button
                  onClick={handleSpeakText}
                  disabled={!communicationText.trim()}
                  className="min-h-[40px] px-3.5 py-1.5 bg-sky-600 hover:bg-sky-500 disabled:bg-slate-800 disabled:text-slate-600 text-white text-xs font-medium rounded-lg flex items-center gap-1.5 transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-sky-400"
                >
                  <Volume2 className="w-3.5 h-3.5" aria-hidden="true" />
                  <span>Speak Aloud</span>
                </button>

                <button
                  onClick={handleCopyText}
                  disabled={!communicationText.trim()}
                  className="min-h-[40px] px-3 py-1.5 bg-slate-800 hover:bg-slate-700 disabled:opacity-50 text-slate-200 text-xs font-medium rounded-lg flex items-center gap-1.5 transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-sky-400"
                >
                  <Copy className="w-3.5 h-3.5" aria-hidden="true" />
                  <span>Copy</span>
                </button>
              </div>

              <div className="flex items-center gap-2">
                <button
                  onClick={handleExportTranscript}
                  disabled={!communicationText.trim() && conversationTurns.length === 0}
                  className="min-h-[40px] px-3 py-1.5 bg-slate-800 hover:bg-slate-700 disabled:opacity-50 text-slate-300 text-xs font-medium rounded-lg flex items-center gap-1.5 transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-sky-400"
                  title="Export conversation history to JSON"
                >
                  <Download className="w-3.5 h-3.5" aria-hidden="true" />
                  <span>Export</span>
                </button>

                <button
                  onClick={handleClearText}
                  disabled={!communicationText.trim()}
                  className="min-h-[40px] px-3 py-1.5 bg-slate-800 hover:bg-rose-900/40 text-slate-400 hover:text-rose-200 disabled:opacity-50 text-xs font-medium rounded-lg flex items-center gap-1.5 transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-rose-400"
                  title="Clear text"
                >
                  <Trash2 className="w-3.5 h-3.5" aria-hidden="true" />
                  <span>Clear</span>
                </button>
              </div>
            </div>
          </div>
        </div>
      </div>
      </>
      )}

      {/* Connected Conversation View (Deaf Signer + Hearing Speaker Dialogue) */}
      <div className="bg-slate-900 border border-slate-800 rounded-xl p-5 shadow-sm space-y-4">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <MessageSquare className="w-4 h-4 text-sky-400" aria-hidden="true" />
            <h2 className="text-sm font-bold text-white">Connected Conversation View</h2>
          </div>
          <button
            onClick={() => {
              setConversationTurns([]);
              storageService.clearConversation();
            }}
            className="text-xs text-slate-400 hover:text-slate-200"
          >
            Clear Dialogue
          </button>
        </div>

        {conversationTurns.length === 0 ? (
          <div className="text-xs text-slate-500 italic py-4 text-center border border-dashed border-slate-800 rounded-lg">
            No dialogue recorded yet. Sign recognized gestures or use Live Captions to hold a two-way accessible conversation.
          </div>
        ) : (
          <div className="space-y-2.5 max-h-56 overflow-y-auto pr-1">
            {conversationTurns.map(turn => (
              <div 
                key={turn.id} 
                className={`p-3 rounded-lg text-xs max-w-lg ${
                  turn.sender === 'signer' 
                    ? 'bg-sky-950/60 border border-sky-800/60 ml-auto text-sky-100' 
                    : 'bg-slate-800/80 border border-slate-700 mr-auto text-slate-200'
                }`}
              >
                <div className="flex items-center justify-between gap-4 mb-1 text-[10px] text-slate-400">
                  <span className="font-semibold text-slate-300">
                    {turn.sender === 'signer' ? 'Signer (Hand Gesture)' : 'Speaker (Voice Captions)'}
                  </span>
                  <span>{turn.timestamp}</span>
                </div>
                <div className="text-sm font-medium">{turn.text}</div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Vocabulary Modal (50 INCLUDE Signs) */}
      {showVocabModal && (
        <div 
          className="fixed inset-0 z-50 bg-black/80 flex items-center justify-center p-4"
          role="dialog"
          aria-modal="true"
          aria-labelledby="vocabModalTitle"
        >
          <div className="bg-slate-900 border border-slate-800 rounded-2xl max-w-3xl w-full max-h-[85vh] flex flex-col shadow-2xl overflow-hidden">
            <div className="p-5 border-b border-slate-800 flex items-center justify-between">
              <div>
                <h3 id="vocabModalTitle" className="text-lg font-bold text-white">
                  Supported INCLUDE-50 Vocabulary
                </h3>
                <p className="text-slate-400 text-xs mt-0.5">
                  Controlled Indian Sign Language dictionary benchmarked in this microproject
                </p>
              </div>
              <button
                onClick={() => setShowVocabModal(false)}
                className="w-8 h-8 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-300 flex items-center justify-center text-sm font-bold focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-sky-400"
                aria-label="Close vocabulary modal"
              >
                ✕
              </button>
            </div>

            <div className="p-4 border-b border-slate-800 bg-slate-900/60">
              <input
                type="text"
                value={vocabSearch}
                onChange={(e) => setVocabSearch(e.target.value)}
                placeholder="Search signs by name, category, or movement description..."
                className="w-full bg-slate-950 border border-slate-800 rounded-lg px-3.5 py-2 text-xs text-white placeholder-slate-500 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-sky-400"
              />
            </div>

            <div className="p-5 overflow-y-auto divide-y divide-slate-800/80 space-y-3">
              {filteredVocab.map(cls => {
                const isAvatarClip = OFFICIAL_GREETINGS.some(g => g.name.toLowerCase() === cls.name.toLowerCase());
                return (
                  <div key={cls.id} className="pt-3 first:pt-0 flex items-start justify-between gap-4">
                    <div className="space-y-1">
                      <div className="flex items-center gap-2">
                        <span className="font-semibold text-white text-sm">{cls.name}</span>
                        <span className={`px-1.5 py-0.2 rounded text-[9px] font-mono ${
                          isAvatarClip
                            ? 'bg-emerald-500/20 text-emerald-300 border border-emerald-500/30'
                            : 'bg-indigo-500/20 text-indigo-300 border border-indigo-500/30'
                        }`}>
                          {isAvatarClip ? 'Avatar clip' : 'Fingerspelled'}
                        </span>
                        <span className="text-slate-500 text-xs">·</span>
                        <span className="text-sky-400 text-xs">{cls.category}</span>
                        <span className="text-slate-500 text-xs">·</span>
                        <span className="text-slate-400 text-[11px]">{cls.twoHanded ? 'Two-Handed' : 'One-Handed'}</span>
                      </div>
                      <p className="text-xs text-slate-400 leading-relaxed">
                        {cls.description}
                      </p>
                    </div>
                  <button
                    onClick={() => {
                      setCommunicationText(prev => prev ? `${prev} ${cls.name}` : cls.name);
                      setShowVocabModal(false);
                    }}
                    className="shrink-0 min-h-[36px] px-2.5 py-1 bg-slate-800 hover:bg-sky-600 text-slate-300 hover:text-white text-xs font-medium rounded-md transition-colors"
                  >
                    Insert
                  </button>
                </div>
              );
            })}
            </div>

            <div className="p-4 border-t border-slate-800 bg-slate-950 flex justify-end">
              <button
                onClick={() => setShowVocabModal(false)}
                className="min-h-[40px] px-4 py-2 bg-slate-800 hover:bg-slate-700 text-white text-xs font-medium rounded-lg"
              >
                Close
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
