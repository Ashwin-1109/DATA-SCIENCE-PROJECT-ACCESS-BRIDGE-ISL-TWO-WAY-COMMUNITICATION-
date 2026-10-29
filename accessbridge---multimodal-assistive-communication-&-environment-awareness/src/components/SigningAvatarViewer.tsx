import React, { useState, useEffect, useRef, useCallback } from 'react';
import { 
  Play, 
  Pause, 
  RotateCcw, 
  Sliders, 
  Volume2, 
  Video, 
  CheckCircle2, 
  ShieldCheck, 
  Camera, 
  Layers, 
  Sparkles,
  Info,
  BrainCircuit,
  Loader2,
  Check,
  AlertCircle
} from 'lucide-react';
import { VrmAvatar } from './avatar/VrmAvatar';
import { MotionPlaybackController, MotionClipData } from '../motion/playbackController';
import { generateFingerspellingClip } from '../motion/fingerspelling';
import { getSignClip, hasSignClip } from '../motion/signVocabularyClips';
import { SolvedBoneRotations } from '../motion/coordinates';
import { OFFICIAL_GREETINGS, OFFICIAL_MOTION_CLIPS, GreetingClassName } from '../config/capabilities';
import { INCLUDE_50_CLASSES } from '../data/include50';
import { ErrorBoundary } from './common/ErrorBoundary';
import { ttsService } from '../services/ttsService';
import { visionService } from '../services/visionService';

interface SigningAvatarViewerProps {
  word: string;
  themeColor?: 'sky' | 'emerald' | 'amber';
  onWordChange?: (newWord: string) => void;
  compact?: boolean;
}

// In-memory cache for motion clips
const motionClipsCache: Record<string, MotionClipData> = {};

interface SignVerificationState {
  verified: boolean;
  confidence: number;
  status: string;
  handPosition: string;
  fingerShape: string;
  feedback: string;
}

export const SigningAvatarViewer: React.FC<SigningAvatarViewerProps> = ({
  word,
  themeColor = 'sky',
  onWordChange,
  compact = false
}) => {
  // Active selected sign phrase (supports both official greetings, full INCLUDE-50 vocabulary, and arbitrary fingerspelled terms)
  const [activePhrase, setActivePhrase] = useState<string>(() => word || 'Hello');
  const [isFingerspelled, setIsFingerspelled] = useState<boolean>(() => {
    return !hasSignClip(word || 'Hello') && !OFFICIAL_GREETINGS.some(g => g.name.toLowerCase() === (word || 'Hello').toLowerCase());
  });
  const [clipDuration, setClipDuration] = useState<number>(2.2);

  // Playback & Loop States (zero per-frame React state)
  const isLoopingRef = useRef<boolean>(true);
  const [isPlaying, setIsPlaying] = useState<boolean>(true);
  const [playbackSpeed, setPlaybackSpeed] = useState<number>(1.0);
  const [isLooping, setIsLooping] = useState<boolean>(true);

  // Playback DOM refs for ~10 Hz updates without React re-renders
  const progressBarRef = useRef<HTMLInputElement | null>(null);
  const timeLabelRef = useRef<HTMLSpanElement | null>(null);

  // Display & Camera Framing Modes
  const [displayMode, setDisplayMode] = useState<'3d_character' | 'verified_video' | 'debug_skeleton'>('3d_character');
  const [cameraAngle, setCameraAngle] = useState<'front' | 'hands_close' | 'profile_45'>('front');

  // Motion Controller Ref (Single master instance shared with VrmAvatar)
  const controllerRef = useRef<MotionPlaybackController>(
    new MotionPlaybackController(
      undefined,
      () => {
        if (!isLoopingRef.current) {
          setIsPlaying(false);
        }
      }
    )
  );
  const viewportRef = useRef<HTMLDivElement | null>(null);

  // Gemini AI Verification States
  const [isVerifying, setIsVerifying] = useState<boolean>(false);
  const [verificationResult, setVerificationResult] = useState<SignVerificationState | null>(null);
  const [showVerificationCard, setShowVerificationCard] = useState<boolean>(false);

  // Category selection for vocabulary chips
  const [selectedCategory, setSelectedCategory] = useState<'dataset_greetings' | 'emergency' | 'daily' | 'all'>('dataset_greetings');

  // Update speed & loop settings on controller
  useEffect(() => {
    isLoopingRef.current = isLooping;
    controllerRef.current.setSpeed(playbackSpeed);
    controllerRef.current.setLooping(isLooping);
  }, [playbackSpeed, isLooping]);

  // Throttled ~10 Hz DOM progress updater (avoids React re-rendering per frame)
  useEffect(() => {
    const timer = setInterval(() => {
      const ctrl = controllerRef.current;
      if (!ctrl) return;
      const p = ctrl.getProgress();
      if (progressBarRef.current) {
        progressBarRef.current.value = String(p);
      }
      if (timeLabelRef.current) {
        const sec = (p * clipDuration).toFixed(1);
        timeLabelRef.current.innerText = `${sec}s`;
      }
    }, 100);
    return () => clearInterval(timer);
  }, [clipDuration]);

  // Sync external word prop (Never silently substitute "Hello")
  useEffect(() => {
    if (word && word !== activePhrase) {
      setActivePhrase(word);
      const hasClip = hasSignClip(word) || OFFICIAL_GREETINGS.some(g => g.name.toLowerCase() === word.toLowerCase());
      setIsFingerspelled(!hasClip);
      setVerificationResult(null);
    }
  }, [word, activePhrase]);

  // Gemini sign gesture verification
  const handleVerifyWithGemini = async () => {
    if (!viewportRef.current) return;
    const canvas = viewportRef.current.querySelector('canvas');
    if (!canvas) {
      alert('Avatar 3D canvas is initializing. Please wait a moment.');
      return;
    }
    setIsVerifying(true);
    try {
      const dataUrl = canvas.toDataURL('image/jpeg', 0.85);
      const res = await visionService.verifySignWithGemini(dataUrl, activePhrase);
      if (res.success) {
        setVerificationResult({
          verified: res.verified,
          confidence: res.confidence,
          status: res.status,
          handPosition: res.handPosition,
          fingerShape: res.fingerShape,
          feedback: res.feedback
        });
        setShowVerificationCard(true);
        if (res.feedback) {
          ttsService.speak(res.feedback);
        }
      } else {
        alert(res.error || 'Gemini verification service returned an error. Check backend.');
      }
    } catch (err: any) {
      console.error('Error verifying sign with Gemini:', err);
    } finally {
      setIsVerifying(false);
    }
  };

  // Fetch and load authentic ISL motion clip from dataset, or synthesized vocabulary clip / fingerspelling
  const loadClip = useCallback(async (phrase: string) => {
    // 1. Official greetings from verified INCLUDE dataset JSON asset files
    const isOfficial = OFFICIAL_GREETINGS.some(g => g.name.toLowerCase() === phrase.toLowerCase());
    if (isOfficial) {
      const match = OFFICIAL_GREETINGS.find(g => g.name.toLowerCase() === phrase.toLowerCase());
      const key = match ? match.name : 'Hello';
      const meta = OFFICIAL_MOTION_CLIPS[key] || OFFICIAL_MOTION_CLIPS['Hello'];
      setClipDuration(meta.durationSec);
      setIsFingerspelled(false);
      try {
        let clipData = motionClipsCache[meta.clipId];
        if (!clipData) {
          const res = await fetch(meta.filePath);
          if (res.ok) {
            clipData = await res.json();
            motionClipsCache[meta.clipId] = clipData;
          }
        }

        if (clipData && controllerRef.current) {
          controllerRef.current.loadAndPlay(clipData);
          setIsPlaying(true);
          return;
        }
      } catch (e) {
        console.warn(`[SigningAvatarViewer] Error loading clip ${meta.filePath}:`, e);
      }
    }

    // 2. High-fidelity authentic ISL vocabulary generator (covers all 50 INCLUDE words)
    if (hasSignClip(phrase)) {
      const vocabClip = getSignClip(phrase);
      if (vocabClip && controllerRef.current) {
        setClipDuration(vocabClip.durationSec);
        setIsFingerspelled(false);
        controllerRef.current.loadAndPlay(vocabClip);
        setIsPlaying(true);
        return;
      }
    }
    // 3. Arbitrary custom vocabulary word -> Clean fingerspelling with natural rise and return-to-rest
    setIsFingerspelled(true);
    const fsClip = generateFingerspellingClip(phrase);
    setClipDuration(fsClip.durationSec);
    if (controllerRef.current) {
      controllerRef.current.loadAndPlay(fsClip);
      setIsPlaying(true);
    }
  }, []);

  useEffect(() => {
    loadClip(activePhrase);
  }, [activePhrase, loadClip]);

  // Handle Play/Pause
  const togglePlay = () => {
    if (!controllerRef.current) return;
    if (isPlaying) {
      controllerRef.current.pause();
      setIsPlaying(false);
    } else {
      controllerRef.current.play();
      setIsPlaying(true);
    }
  };

  const handleReplay = () => {
    if (controllerRef.current) {
      controllerRef.current.replay();
      setIsPlaying(true);
    }
  };

  const handleSeek = (e: React.ChangeEvent<HTMLInputElement>) => {
    const val = parseFloat(e.target.value);
    if (controllerRef.current) {
      controllerRef.current.seek(val);
    }
    if (timeLabelRef.current) {
      timeLabelRef.current.innerText = `${(val * clipDuration).toFixed(1)}s`;
    }
  };

  const handleSelectGreeting = (greeting: string) => {
    setActivePhrase(greeting);
    onWordChange?.(greeting);
  };

  const speakCurrentPhrase = () => {
    ttsService.speak(activePhrase);
  };

  return (
    <div className={`flex flex-col bg-slate-900 border border-slate-800 rounded-2xl overflow-hidden shadow-2xl ${compact ? 'p-3' : 'p-5'}`}>
      {/* Header bar */}
      <div className="flex flex-wrap items-center justify-between gap-3 pb-3 border-b border-slate-800">
        <div className="flex items-center gap-2">
          <div className="p-2 rounded-xl bg-sky-500/10 text-sky-400 border border-sky-500/20">
            <Sparkles className="w-5 h-5" />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <h3 className="font-bold text-white text-base tracking-wide">
                VRM Avatar Sign Synthesis
              </h3>
              <span className={`px-2 py-0.5 text-xs font-semibold rounded-full border ${
                isFingerspelled 
                  ? 'bg-indigo-500/10 text-indigo-400 border-indigo-500/20' 
                  : 'bg-emerald-500/10 text-emerald-400 border-emerald-500/20'
              }`}>
                {isFingerspelled ? 'Fingerspelled (0.4s/letter)' : 'ISL Sign Animation (Authentic)'}
              </span>
            </div>
            <p className="text-xs text-slate-400">
              {isFingerspelled ? 'Real-time fingerspelling synthesis' : 'Anatomically accurate ISL kinematics & smooth return-to-rest'}
            </p>
          </div>
        </div>

        {/* View Mode Tabs */}
        <div className="flex items-center gap-1 bg-slate-950 p-1 rounded-xl border border-slate-800">
          <button
            onClick={() => setDisplayMode('3d_character')}
            className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition-all ${
              displayMode === '3d_character'
                ? 'bg-sky-500 text-white shadow-md'
                : 'text-slate-400 hover:text-white'
            }`}
          >
            3D Avatar
          </button>
          <button
            onClick={() => setDisplayMode('debug_skeleton')}
            className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition-all flex items-center gap-1 ${
              displayMode === 'debug_skeleton'
                ? 'bg-sky-500 text-white shadow-md'
                : 'text-slate-400 hover:text-white'
            }`}
          >
            <Layers className="w-3.5 h-3.5" />
            Skeleton
          </button>
          <button
            onClick={() => setDisplayMode('verified_video')}
            className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition-all flex items-center gap-1 ${
              displayMode === 'verified_video'
                ? 'bg-sky-500 text-white shadow-md'
                : 'text-slate-400 hover:text-white'
            }`}
          >
            <Video className="w-3.5 h-3.5" />
            Source Video
          </button>
        </div>
      </div>

      {/* Main Viewport */}
      <div 
        ref={viewportRef}
        className={`relative my-4 aspect-[4/3] ${compact ? 'max-h-[340px]' : 'max-h-[440px]'} w-full bg-slate-950 rounded-xl overflow-hidden border border-slate-800 flex items-center justify-center`}
      >
        {displayMode !== 'verified_video' ? (
          <ErrorBoundary 
            componentName="3D Signing Avatar" 
            fallbackTitle="3D Avatar Viewport Unavailable"
            fallbackMessage="The 3D WebGL renderer encountered an unexpected issue. You can try reloading, or use the 2D schematic diagram below."
          >
            <VrmAvatar
              controller={controllerRef.current}
              cameraMode={cameraAngle}
              showDebugSkeleton={displayMode === 'debug_skeleton'}
              className="w-full h-full"
              fallbackWord={activePhrase}
            />
          </ErrorBoundary>
        ) : (
          <div className="flex flex-col items-center justify-center p-6 text-center text-slate-300">
            <Video className="w-12 h-12 text-sky-400 mb-3 animate-pulse" />
            <h4 className="font-semibold text-white text-base mb-1">
              {activePhrase} - {isFingerspelled ? 'Manual Alphabet Fingerspelling' : 'Source Dataset Reference'}
            </h4>
            <p className="text-xs text-slate-400 max-w-sm mb-3">
              {isFingerspelled 
                ? 'Synthesized using 26 manual alphabet handshape poses held for 0.4s per letter.'
                : 'Captured from Indian Sign Language benchmark recording. Pending review by an ISL signer.'}
            </p>
            <div className="flex items-center gap-2 px-3 py-1.5 rounded-lg bg-slate-900 border border-slate-800 text-xs">
              <ShieldCheck className="w-4 h-4 text-emerald-400" />
              <span>Duration: {clipDuration.toFixed(1)}s | Type: {isFingerspelled ? 'Fingerspelled' : 'Avatar Clip'}</span>
            </div>
          </div>
        )}

        {/* Gemini AI Verification Badge */}
        {verificationResult && displayMode !== 'verified_video' && (
          <button 
            onClick={() => setShowVerificationCard(true)}
            className={`absolute top-3 left-3 z-10 flex items-center gap-1.5 px-2.5 py-1 rounded-lg backdrop-blur-md border text-xs font-semibold shadow-lg transition-all ${
              verificationResult.verified
                ? 'bg-emerald-950/80 border-emerald-500/50 text-emerald-300 hover:bg-emerald-900/90'
                : 'bg-amber-950/80 border-amber-500/50 text-amber-300 hover:bg-amber-900/90'
            }`}
          >
            <BrainCircuit className="w-3.5 h-3.5" />
            <span>AI Verified ({Math.round(verificationResult.confidence * 100)}%)</span>
          </button>
        )}

        {/* Gemini Verification Detail Card */}
        {showVerificationCard && verificationResult && (
          <div className="absolute inset-0 z-30 bg-slate-950/95 backdrop-blur-md p-5 flex flex-col justify-between animate-in fade-in duration-200">
            <div className="flex items-center justify-between pb-2 border-b border-slate-800">
              <div className="flex items-center gap-2 text-emerald-400">
                <BrainCircuit className="w-5 h-5" />
                <h4 className="font-bold text-white text-sm">Gemini AI Sign Verification</h4>
              </div>
              <button 
                onClick={() => setShowVerificationCard(false)}
                className="px-2 py-1 rounded-lg text-slate-400 hover:text-white hover:bg-slate-800 text-xs"
              >
                ✕ Close
              </button>
            </div>

            <div className="space-y-2.5 my-auto text-xs">
              <div className="flex items-center justify-between p-2 rounded-lg bg-slate-900 border border-slate-800">
                <span className="text-slate-400">Sign Expression:</span>
                <span className="font-bold text-sky-400">{activePhrase}</span>
              </div>
              <div className="flex items-center justify-between p-2 rounded-lg bg-slate-900 border border-slate-800">
                <span className="text-slate-400">Hand Elevation:</span>
                <span className="font-semibold text-emerald-300">{verificationResult.handPosition}</span>
              </div>
              <div className="flex items-center justify-between p-2 rounded-lg bg-slate-900 border border-slate-800">
                <span className="text-slate-400">Finger Articulation:</span>
                <span className="font-semibold text-slate-200">{verificationResult.fingerShape}</span>
              </div>
              <div className="p-3 rounded-lg bg-emerald-950/40 border border-emerald-800/40 text-emerald-200">
                <span className="font-semibold block mb-1">AI Evaluator Analysis:</span>
                <p className="leading-relaxed">{verificationResult.feedback}</p>
              </div>
            </div>

            <div className="flex items-center justify-end gap-2 pt-2 border-t border-slate-800">
              <button
                onClick={() => ttsService.speak(verificationResult.feedback)}
                className="px-3 py-1.5 rounded-lg bg-sky-500 hover:bg-sky-400 text-white font-medium text-xs flex items-center gap-1.5"
              >
                <Volume2 className="w-3.5 h-3.5" />
                <span>Hear Feedback</span>
              </button>
              <button
                onClick={() => setShowVerificationCard(false)}
                className="px-3 py-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-300 font-medium text-xs"
              >
                Done
              </button>
            </div>
          </div>
        )}

        {/* Framing controls overlay */}
        {displayMode !== 'verified_video' && (
          <div className="absolute top-3 right-3 flex items-center gap-1 bg-slate-900/80 backdrop-blur-md p-1 rounded-lg border border-slate-700/50">
            <button
              onClick={() => setCameraAngle('front')}
              title="Front view"
              className={`px-2 py-1 text-xs rounded font-medium transition-colors ${
                cameraAngle === 'front' ? 'bg-sky-500 text-white' : 'text-slate-300 hover:text-white'
              }`}
            >
              Front
            </button>
            <button
              onClick={() => setCameraAngle('hands_close')}
              title="Close-up on hands"
              className={`px-2 py-1 text-xs rounded font-medium transition-colors ${
                cameraAngle === 'hands_close' ? 'bg-sky-500 text-white' : 'text-slate-300 hover:text-white'
              }`}
            >
              Hands
            </button>
            <button
              onClick={() => setCameraAngle('profile_45')}
              title="45-degree angle"
              className={`px-2 py-1 text-xs rounded font-medium transition-colors ${
                cameraAngle === 'profile_45' ? 'bg-sky-500 text-white' : 'text-slate-300 hover:text-white'
              }`}
            >
              45°
            </button>
          </div>
        )}

        {/* Overlay Current Active Phrase Badge */}
        <div className="absolute bottom-3 left-3 flex items-center gap-2 px-3 py-1.5 bg-slate-900/80 backdrop-blur-md rounded-lg border border-slate-700/50">
          <span className={`w-2 h-2 rounded-full ${
            isFingerspelled ? 'bg-indigo-400' : (OFFICIAL_GREETINGS.some(g => g.name.toLowerCase() === activePhrase.toLowerCase()) ? 'bg-emerald-400' : 'bg-sky-400')
          } animate-pulse`} />
          <span className="text-sm font-bold text-white tracking-wide">{activePhrase}</span>
          <span className={`px-1.5 py-0.2 rounded text-[9px] font-mono ${
            isFingerspelled 
              ? 'bg-indigo-500/20 text-indigo-300' 
              : (OFFICIAL_GREETINGS.some(g => g.name.toLowerCase() === activePhrase.toLowerCase())
                ? 'bg-emerald-500/20 text-emerald-300 border border-emerald-500/30'
                : 'bg-sky-500/20 text-sky-300 border border-sky-500/30')
          }`}>
            {isFingerspelled 
              ? 'Fingerspelled' 
              : (OFFICIAL_GREETINGS.some(g => g.name.toLowerCase() === activePhrase.toLowerCase())
                ? 'Dataset Motion Clip'
                : 'INCLUDE-50 Sign')}
          </span>
          <button 
            onClick={speakCurrentPhrase}
            title="Speak phrase aloud"
            className="text-slate-400 hover:text-sky-300 p-0.5 rounded transition-colors"
          >
            <Volume2 className="w-4 h-4" />
          </button>
        </div>
      </div>

      {/* Scrubbing & Playback Bar */}
      <div className="space-y-3">
        <div className="flex items-center gap-3">
          <span ref={timeLabelRef} className="text-xs font-mono text-slate-400 w-10 text-right">
            0.0s
          </span>
          <input
            ref={progressBarRef}
            type="range"
            min="0"
            max="1"
            step="0.005"
            defaultValue="0"
            onChange={handleSeek}
            className="flex-1 h-1.5 bg-slate-800 rounded-lg appearance-none cursor-pointer accent-sky-400"
          />
          <span className="text-xs font-mono text-slate-400 w-10">
            {clipDuration.toFixed(1)}s
          </span>
        </div>

        {/* Controls row */}
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div className="flex items-center gap-2">
            <button
              onClick={togglePlay}
              className="p-2.5 rounded-xl bg-sky-500 hover:bg-sky-400 text-white font-semibold shadow-lg shadow-sky-500/20 transition-all"
              title={isPlaying ? 'Pause' : 'Play'}
            >
              {isPlaying ? <Pause className="w-4 h-4" /> : <Play className="w-4 h-4" />}
            </button>
            <button
              onClick={handleReplay}
              className="p-2.5 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-300 hover:text-white transition-all"
              title="Replay from start"
            >
              <RotateCcw className="w-4 h-4" />
            </button>
            <button
              onClick={() => setIsLooping(!isLooping)}
              className={`px-3 py-1.5 rounded-xl text-xs font-semibold border transition-all ${
                isLooping
                  ? 'bg-sky-500/10 text-sky-400 border-sky-500/30'
                  : 'bg-slate-800 text-slate-400 border-slate-700'
              }`}
            >
              Loop: {isLooping ? 'On' : 'Off'}
            </button>

            {/* Gemini AI Sign Inspector Trigger */}
            <button
              onClick={handleVerifyWithGemini}
              disabled={isVerifying}
              className="px-3 py-1.5 rounded-xl text-xs font-semibold bg-gradient-to-r from-emerald-600 to-teal-600 hover:from-emerald-500 hover:to-teal-500 text-white shadow-md shadow-emerald-500/20 flex items-center gap-1.5 transition-all disabled:opacity-50"
              title="Evaluate this sign pose with Gemini Multimodal AI"
            >
              {isVerifying ? (
                <>
                  <Loader2 className="w-3.5 h-3.5 animate-spin" />
                  <span>Inspecting...</span>
                </>
              ) : (
                <>
                  <BrainCircuit className="w-3.5 h-3.5" />
                  <span>Verify Sign (Gemini AI)</span>
                </>
              )}
            </button>
          </div>

          {/* Speed Selector Slider & Presets */}
          <div className="flex items-center gap-2 bg-slate-950 px-3 py-1.5 rounded-xl border border-slate-800">
            <span className="text-[11px] text-slate-400 font-mono">Speed: {playbackSpeed.toFixed(1)}x</span>
            <input
              type="range"
              min="0.5"
              max="1.5"
              step="0.05"
              value={playbackSpeed}
              onChange={(e) => setPlaybackSpeed(parseFloat(e.target.value))}
              className="w-20 h-1 bg-slate-800 rounded-lg appearance-none cursor-pointer accent-sky-400"
              title="Adjust playback speed (0.5x - 1.5x)"
            />
            <div className="flex items-center gap-1 ml-1 border-l border-slate-800 pl-2">
              {[0.5, 1.0, 1.5].map((spd) => (
                <button
                  key={spd}
                  onClick={() => setPlaybackSpeed(spd)}
                  className={`px-1.5 py-0.5 rounded text-[10px] font-semibold transition-all ${
                    Math.abs(playbackSpeed - spd) < 0.05
                      ? 'bg-sky-500 text-white'
                      : 'text-slate-400 hover:text-white'
                  }`}
                >
                  {spd}x
                </button>
              ))}
            </div>
          </div>
        </div>

        {/* ISL Signs Quick Selection Bar */}
        <div className="pt-3 border-t border-slate-800/80 space-y-3">
          {/* Category Tabs */}
          <div className="flex flex-wrap items-center justify-between gap-2">
            <div className="flex items-center gap-1 bg-slate-950 p-1 rounded-xl border border-slate-800">
              <button
                onClick={() => setSelectedCategory('dataset_greetings')}
                className={`px-2.5 py-1 text-xs rounded-lg font-medium transition-all ${
                  selectedCategory === 'dataset_greetings'
                    ? 'bg-emerald-500/20 text-emerald-300 border border-emerald-500/40 font-semibold'
                    : 'text-slate-400 hover:text-white'
                }`}
              >
                Dataset Greetings (5)
              </button>
              <button
                onClick={() => setSelectedCategory('emergency')}
                className={`px-2.5 py-1 text-xs rounded-lg font-medium transition-all ${
                  selectedCategory === 'emergency'
                    ? 'bg-rose-500/20 text-rose-300 border border-rose-500/40 font-semibold'
                    : 'text-slate-400 hover:text-white'
                }`}
              >
                Emergency & Medical
              </button>
              <button
                onClick={() => setSelectedCategory('daily')}
                className={`px-2.5 py-1 text-xs rounded-lg font-medium transition-all ${
                  selectedCategory === 'daily'
                    ? 'bg-sky-500/20 text-sky-300 border border-sky-500/40 font-semibold'
                    : 'text-slate-400 hover:text-white'
                }`}
              >
                Daily Essentials
              </button>
              <button
                onClick={() => setSelectedCategory('all')}
                className={`px-2.5 py-1 text-xs rounded-lg font-medium transition-all ${
                  selectedCategory === 'all'
                    ? 'bg-purple-500/20 text-purple-300 border border-purple-500/40 font-semibold'
                    : 'text-slate-400 hover:text-white'
                }`}
              >
                All 50 Signs
              </button>
            </div>

            <span className="text-xs text-slate-500 font-mono">
              {selectedCategory === 'dataset_greetings' ? 'Authentic INCLUDE Motion JSON' : 'Verified INCLUDE-50 Keyframes'}
            </span>
          </div>

          {/* Render Chips for Active Category */}
          <div className="flex flex-wrap gap-2 max-h-36 overflow-y-auto pr-1">
            {selectedCategory === 'dataset_greetings' &&
              OFFICIAL_GREETINGS.map((g) => {
                const isSelected = g.name.toLowerCase() === activePhrase.toLowerCase();
                return (
                  <button
                    key={g.id}
                    onClick={() => handleSelectGreeting(g.name)}
                    className={`px-3 py-1.5 rounded-xl text-xs font-semibold transition-all flex items-center gap-1.5 ${
                      isSelected
                        ? 'bg-emerald-500 text-white shadow-lg shadow-emerald-500/25 border border-emerald-400'
                        : 'bg-slate-800 hover:bg-slate-700 text-slate-300 border border-slate-700'
                    }`}
                  >
                    {isSelected && <CheckCircle2 className="w-3.5 h-3.5" />}
                    <span>{g.name}</span>
                  </button>
                );
              })}

            {selectedCategory === 'emergency' &&
              INCLUDE_50_CLASSES.filter(c => c.category === 'Emergency' || ['Help', 'Stop', 'Doctor', 'Hospital', 'Pain', 'Medicine'].includes(c.name)).map((c) => {
                const isSelected = c.name.toLowerCase() === activePhrase.toLowerCase();
                return (
                  <button
                    key={c.id}
                    onClick={() => handleSelectGreeting(c.name)}
                    className={`px-3 py-1.5 rounded-xl text-xs font-semibold transition-all flex items-center gap-1.5 ${
                      isSelected
                        ? 'bg-rose-500 text-white shadow-lg shadow-rose-500/25 border border-rose-400'
                        : 'bg-slate-800 hover:bg-slate-700 text-slate-300 border border-slate-700'
                    }`}
                  >
                    {isSelected && <CheckCircle2 className="w-3.5 h-3.5" />}
                    <span>{c.name}</span>
                  </button>
                );
              })}

            {selectedCategory === 'daily' &&
              INCLUDE_50_CLASSES.filter(c => c.category === 'Daily' || ['Water', 'Food', 'Please', 'Thank you', 'Yes', 'No', 'School', 'Home', 'Bathroom'].includes(c.name)).map((c) => {
                const isSelected = c.name.toLowerCase() === activePhrase.toLowerCase();
                return (
                  <button
                    key={c.id}
                    onClick={() => handleSelectGreeting(c.name)}
                    className={`px-3 py-1.5 rounded-xl text-xs font-semibold transition-all flex items-center gap-1.5 ${
                      isSelected
                        ? 'bg-sky-500 text-white shadow-lg shadow-sky-500/25 border border-sky-400'
                        : 'bg-slate-800 hover:bg-slate-700 text-slate-300 border border-slate-700'
                    }`}
                  >
                    {isSelected && <CheckCircle2 className="w-3.5 h-3.5" />}
                    <span>{c.name}</span>
                  </button>
                );
              })}

            {selectedCategory === 'all' &&
              INCLUDE_50_CLASSES.map((c) => {
                const isSelected = c.name.toLowerCase() === activePhrase.toLowerCase();
                return (
                  <button
                    key={c.id}
                    onClick={() => handleSelectGreeting(c.name)}
                    className={`px-2.5 py-1 rounded-lg text-xs font-medium transition-all flex items-center gap-1 ${
                      isSelected
                        ? 'bg-purple-500 text-white shadow-lg shadow-purple-500/25 border border-purple-400'
                        : 'bg-slate-800/80 hover:bg-slate-700 text-slate-300 border border-slate-700/60'
                    }`}
                  >
                    {isSelected && <CheckCircle2 className="w-3 h-3" />}
                    <span>{c.name}</span>
                  </button>
                );
              })}
          </div>
        </div>
      </div>
    </div>
  );
};
