import React, { useState, useEffect, useRef } from 'react';
import { 
  Play, 
  Pause, 
  RotateCcw, 
  Sliders, 
  Volume2, 
  Layers, 
  Eye, 
  Sparkles, 
  Info,
  ChevronLeft,
  ChevronRight,
  Hand
} from 'lucide-react';
import { SignClassInfo } from '../types';
import { INCLUDE_50_CLASSES } from '../data/include50';
import { ttsService } from '../services/ttsService';

interface RealisticHandSignPerformerProps {
  selectedSign: SignClassInfo;
  onSignSelected?: (sign: SignClassInfo) => void;
  themeColor?: 'sky' | 'emerald' | 'amber';
  compact?: boolean;
}

export const RealisticHandSignPerformer: React.FC<RealisticHandSignPerformerProps> = ({
  selectedSign,
  onSignSelected,
  themeColor = 'sky',
  compact = false
}) => {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);

  // Performer controls
  const [isPlaying, setIsPlaying] = useState(true);
  const [renderMode, setRenderMode] = useState<'anatomical' | 'skeleton' | 'xray'>('anatomical');
  const [skinTone, setSkinTone] = useState<'warm' | 'fair' | 'tan' | 'deep'>('warm');
  const [playbackSpeed, setPlaybackSpeed] = useState<number>(1.0);
  const [currentFrame, setCurrentFrame] = useState<number>(0);
  const [viewAngleDeg, setViewAngleDeg] = useState<number>(0); // 3D yaw perspective

  // Total frames in the standardized gesture cycle
  const totalFrames = 32;

  // Skin tone color palettes
  const skinColors = {
    warm: { base: '#E0A97A', shadow: '#C08552', highlight: '#F3D5B5', palm: '#ECC8AF', nail: '#FCE7D2' },
    fair: { base: '#F3C5A8', shadow: '#DFA385', highlight: '#FFE5D4', palm: '#FCDCC7', nail: '#FFF0E5' },
    tan:  { base: '#B57A4C', shadow: '#8C562C', highlight: '#D89F73', palm: '#C9936B', nail: '#E5BF9E' },
    deep: { base: '#6B4226', shadow: '#4D2A12', highlight: '#8C5B39', palm: '#7F5234', nail: '#A3734D' }
  }[skinTone];

  useEffect(() => {
    if (!canvasRef.current) return;
    const canvas = canvasRef.current;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    let animId: number;
    let localFrame = currentFrame;

    const render = () => {
      ctx.clearRect(0, 0, canvas.width, canvas.height);

      if (isPlaying) {
        localFrame = (localFrame + 0.5 * playbackSpeed) % totalFrames;
        setCurrentFrame(Math.round(localFrame));
      }

      const w = canvas.width;
      const h = canvas.height;
      const t = (localFrame / totalFrames) * Math.PI * 2;

      ctx.save();
      // Apply 3D perspective rotation around center
      ctx.translate(w / 2, h / 2);
      ctx.scale(Math.cos((viewAngleDeg * Math.PI) / 180), 1);
      ctx.translate(-w / 2, -h / 2);

      // Determine sign movement amplitude & trajectory from selectedSign
      const isTwoHanded = selectedSign.twoHanded;
      const handWaveOffset = Math.sin(t) * 28;
      const handVertOffset = Math.cos(t) * 18;

      // Finger curls for different signs:
      // Values: 0 = fully extended, 1 = fully closed fist
      let thumbCurl = 0.2;
      let indexCurl = 0.1;
      let middleCurl = 0.1;
      let ringCurl = 0.1;
      let pinkyCurl = 0.1;

      if (selectedSign.name === 'Help' || selectedSign.name === 'Yes') {
        thumbCurl = 0.0;
        indexCurl = 0.9;
        middleCurl = 0.9;
        ringCurl = 0.9;
        pinkyCurl = 0.9; // Fist with thumb out
      } else if (selectedSign.name === 'Water') {
        thumbCurl = 0.8;
        indexCurl = 0.0;
        middleCurl = 0.0;
        ringCurl = 0.0;
        pinkyCurl = 0.9; // W-hand
      } else if (selectedSign.name === 'No') {
        thumbCurl = 0.7;
        indexCurl = 0.7 + Math.sin(t * 2) * 0.2;
        middleCurl = 0.7 + Math.sin(t * 2) * 0.2;
        ringCurl = 0.9;
        pinkyCurl = 0.9; // Snapping fingers
      } else if (selectedSign.name === 'Love') {
        indexCurl = 0.9;
        middleCurl = 0.9;
        ringCurl = 0.9;
        pinkyCurl = 0.9;
      }

      // Draw Main Right Hand (and Left Hand if two-handed)
      const drawArticulatedHand = (
        wristX: number,
        wristY: number,
        isLeft: boolean
      ) => {
        const signMultiplier = isLeft ? -1 : 1;

        if (renderMode === 'skeleton') {
          // --- SKELETON MODE: Glowing MediaPipe 21 Keypoints & Bones ---
          ctx.strokeStyle = isLeft ? '#F472B6' : '#38BDF8';
          ctx.lineWidth = 3;
          ctx.shadowBlur = 8;
          ctx.shadowColor = isLeft ? '#F472B6' : '#38BDF8';

          // Wrist point
          ctx.fillStyle = '#FFFFFF';
          ctx.beginPath();
          ctx.arc(wristX, wristY, 5, 0, Math.PI * 2);
          ctx.fill();

          // 5 Finger Rays
          const fingerBases = [-24, -12, 0, 12, 24];
          const fingerCurls = [thumbCurl, indexCurl, middleCurl, ringCurl, pinkyCurl];

          fingerBases.forEach((baseOffset, fIdx) => {
            const curl = fingerCurls[fIdx];
            const fingerLen = (fIdx === 0 ? 32 : (fIdx === 2 ? 55 : (fIdx === 1 ? 50 : (fIdx === 3 ? 48 : 38)))) * (1 - curl * 0.6);
            
            const mcpX = wristX + baseOffset * signMultiplier;
            const mcpY = wristY - 35;
            const pipX = mcpX + (baseOffset * 0.4) * signMultiplier;
            const pipY = mcpY - fingerLen * 0.5;
            const tipX = pipX + (baseOffset * 0.2) * signMultiplier;
            const tipY = pipY - fingerLen * 0.5 + (curl * 18);

            // Connect Bone Segments
            ctx.beginPath();
            ctx.moveTo(wristX, wristY);
            ctx.lineTo(mcpX, mcpY);
            ctx.lineTo(pipX, pipY);
            ctx.lineTo(tipX, tipY);
            ctx.stroke();

            // Draw Landmark Spheres
            [mcpX, pipX, tipX].forEach((x, idx) => {
              const y = [mcpY, pipY, tipY][idx];
              ctx.beginPath();
              ctx.arc(x, y, 4, 0, Math.PI * 2);
              ctx.fill();
            });
          });

          ctx.shadowBlur = 0;
        } else if (renderMode === 'xray') {
          // --- X-RAY BIOMECHANICAL MODE ---
          ctx.strokeStyle = '#34D399';
          ctx.lineWidth = 2;
          ctx.strokeRect(wristX - 35, wristY - 80, 70, 110);
          ctx.fillStyle = 'rgba(52, 211, 153, 0.15)';
          ctx.fillRect(wristX - 35, wristY - 80, 70, 110);

          ctx.strokeStyle = '#FACC15';
          ctx.beginPath();
          ctx.arc(wristX, wristY, 20, 0, Math.PI * 2);
          ctx.stroke();

          ctx.fillStyle = '#FFFFFF';
          ctx.font = '10px monospace';
          ctx.fillText(`YAW: ${viewAngleDeg}°`, wristX - 25, wristY + 45);
          ctx.fillText(`FRAME: ${currentFrame}/32`, wristX - 30, wristY + 60);
        } else {
          // --- ANATOMICAL REALISTIC HAND MODE ---
          // 1. Forearm & Wrist Shading
          ctx.fillStyle = skinColors.shadow;
          ctx.beginPath();
          ctx.moveTo(wristX - 22 * signMultiplier, wristY + 50);
          ctx.lineTo(wristX + 22 * signMultiplier, wristY + 50);
          ctx.lineTo(wristX + 24 * signMultiplier, wristY);
          ctx.lineTo(wristX - 24 * signMultiplier, wristY);
          ctx.closePath();
          ctx.fill();

          ctx.fillStyle = skinColors.base;
          ctx.beginPath();
          ctx.moveTo(wristX - 20 * signMultiplier, wristY + 50);
          ctx.lineTo(wristX + 20 * signMultiplier, wristY + 50);
          ctx.lineTo(wristX + 22 * signMultiplier, wristY);
          ctx.lineTo(wristX - 22 * signMultiplier, wristY);
          ctx.closePath();
          ctx.fill();

          // 2. Anatomical Palm Body
          ctx.fillStyle = skinColors.shadow;
          ctx.beginPath();
          ctx.roundRect(wristX - 34, wristY - 44, 68, 50, 14);
          ctx.fill();

          ctx.fillStyle = skinColors.palm;
          ctx.beginPath();
          ctx.roundRect(wristX - 32, wristY - 42, 64, 46, 12);
          ctx.fill();

          // 3. Four Articulated Fingers (Pinky to Index)
          const fingers = [
            { name: 'pinky', offset: 22 * signMultiplier, len: 42, curl: pinkyCurl, w: 9 },
            { name: 'ring', offset: 9 * signMultiplier, len: 54, curl: ringCurl, w: 10 },
            { name: 'middle', offset: -4 * signMultiplier, len: 62, curl: middleCurl, w: 11 },
            { name: 'index', offset: -18 * signMultiplier, len: 55, curl: indexCurl, w: 10 }
          ];

          fingers.forEach(f => {
            const fX = wristX + f.offset;
            const fY = wristY - 42;
            const effectiveLen = f.len * (1 - f.curl * 0.65);

            // Finger Phalanx Shadow
            ctx.fillStyle = skinColors.shadow;
            ctx.beginPath();
            ctx.roundRect(fX - f.w / 2 - 1, fY - effectiveLen - 1, f.w + 2, effectiveLen + 6, f.w / 2);
            ctx.fill();

            // Main Finger Phalanx
            ctx.fillStyle = skinColors.base;
            ctx.beginPath();
            ctx.roundRect(fX - f.w / 2, fY - effectiveLen, f.w, effectiveLen + 4, f.w / 2);
            ctx.fill();

            // Knuckle Line & Shading
            ctx.strokeStyle = skinColors.shadow;
            ctx.lineWidth = 1.5;
            ctx.beginPath();
            ctx.arc(fX, fY - effectiveLen * 0.45, f.w * 0.4, 0, Math.PI);
            ctx.stroke();

            // Fingernail
            ctx.fillStyle = skinColors.nail;
            ctx.beginPath();
            ctx.roundRect(fX - (f.w - 4) / 2, fY - effectiveLen + 2, f.w - 4, 7, 3);
            ctx.fill();
          });

          // 4. Opposable Thumb
          const thumbRootX = wristX - 28 * signMultiplier;
          const thumbRootY = wristY - 18;
          const thumbEffectiveLen = 38 * (1 - thumbCurl * 0.5);
          const thumbAngle = isLeft ? (0.6 + thumbCurl * 0.4) : (-0.6 - thumbCurl * 0.4);

          ctx.save();
          ctx.translate(thumbRootX, thumbRootY);
          ctx.rotate(thumbAngle);

          ctx.fillStyle = skinColors.shadow;
          ctx.beginPath();
          ctx.roundRect(-7, -thumbEffectiveLen - 1, 14, thumbEffectiveLen + 4, 7);
          ctx.fill();

          ctx.fillStyle = skinColors.base;
          ctx.beginPath();
          ctx.roundRect(-6, -thumbEffectiveLen, 12, thumbEffectiveLen + 2, 6);
          ctx.fill();

          // Thumb nail
          ctx.fillStyle = skinColors.nail;
          ctx.beginPath();
          ctx.roundRect(-4, -thumbEffectiveLen + 2, 8, 6, 3);
          ctx.fill();

          ctx.restore();
        }
      };

      // Right Hand Position with dynamic sign trajectory
      const rightX = w / 2 + 50 + handWaveOffset;
      const rightY = h / 2 + 30 + handVertOffset;
      drawArticulatedHand(rightX, rightY, false);

      // Left Hand Position if sign is two-handed
      if (isTwoHanded) {
        const leftX = w / 2 - 50 - handWaveOffset;
        const leftY = h / 2 + 30 + handVertOffset;
        drawArticulatedHand(leftX, leftY, true);
      }

      ctx.restore();

      animId = requestAnimationFrame(render);
    };

    render();
    return () => cancelAnimationFrame(animId);
  }, [selectedSign, isPlaying, renderMode, skinTone, playbackSpeed, viewAngleDeg, totalFrames]);

  return (
    <div className="bg-slate-900 border border-slate-800 rounded-3xl p-6 shadow-xl space-y-5">
      {/* Performer Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-4 border-b border-slate-800">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-2xl bg-sky-600/30 border border-sky-500/50 flex items-center justify-center text-sky-400">
            <Hand className="w-5 h-5" />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <h3 className="text-base font-black text-white">
                2D Schematic Hand (Diagram)
              </h3>
              <span className="text-[10px] text-amber-300 font-mono font-bold bg-amber-950/60 px-2 py-0.5 rounded-full border border-amber-800/60">
                Geometric Rule Heuristic (demo)
              </span>
              <span className="text-xs text-sky-400 font-mono font-bold bg-sky-950/60 px-2 py-0.5 rounded-full border border-sky-800/60">
                {selectedSign.twoHanded ? 'Two-Handed Sign' : 'One-Handed Sign'}
              </span>
            </div>
            <p className="text-xs text-slate-400">
              2D articulated kinematics diagram · Heuristic visual aid (pending ISL signer review)
            </p>
          </div>
        </div>

        {/* Render Mode Switcher */}
        <div className="flex items-center gap-1 p-1 bg-slate-950 border border-slate-800 rounded-xl text-xs">
          <button
            onClick={() => setRenderMode('anatomical')}
            className={`min-h-[34px] px-3 py-1 font-bold rounded-lg transition-colors ${
              renderMode === 'anatomical' ? 'bg-sky-600 text-white' : 'text-slate-400 hover:text-white'
            }`}
          >
            Anatomical Skin
          </button>
          <button
            onClick={() => setRenderMode('skeleton')}
            className={`min-h-[34px] px-3 py-1 font-bold rounded-lg transition-colors ${
              renderMode === 'skeleton' ? 'bg-sky-600 text-white' : 'text-slate-400 hover:text-white'
            }`}
          >
            MediaPipe Skeleton
          </button>
          <button
            onClick={() => setRenderMode('xray')}
            className={`min-h-[34px] px-3 py-1 font-bold rounded-lg transition-colors ${
              renderMode === 'xray' ? 'bg-sky-600 text-white' : 'text-slate-400 hover:text-white'
            }`}
          >
            Biomechanical X-Ray
          </button>
        </div>
      </div>

      {/* Main Performer Viewport */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
        {/* Canvas Display View (7 Cols) */}
        <div className="lg:col-span-7 space-y-4">
          <div className="relative bg-slate-950 border border-slate-800 rounded-3xl overflow-hidden aspect-[4/3] flex items-center justify-center shadow-inner">
            <canvas
              ref={canvasRef}
              width={480}
              height={360}
              className="w-full h-full object-contain"
            />

            {/* Top HUD: Current Sign Title */}
            <div className="absolute top-4 left-4 bg-slate-900/90 backdrop-blur-xs border border-slate-800 p-2.5 rounded-2xl flex items-center gap-2">
              <span className="text-lg font-black text-white">&ldquo;{selectedSign.name}&rdquo;</span>
              <span className="text-slate-500">·</span>
              <span className="text-xs text-sky-400 font-semibold">{selectedSign.category}</span>
            </div>

            {/* Bottom HUD: Playback & Scrub Bar */}
            <div className="absolute bottom-4 left-4 right-4 bg-slate-900/90 backdrop-blur-xs border border-slate-800 p-3 rounded-2xl flex flex-wrap items-center justify-between gap-3 text-xs">
              <div className="flex items-center gap-2">
                <button
                  onClick={() => setIsPlaying(!isPlaying)}
                  className="w-8 h-8 rounded-xl bg-sky-600 hover:bg-sky-500 text-white flex items-center justify-center shadow transition-colors"
                  title={isPlaying ? 'Pause kinetic playback' : 'Play kinetic playback'}
                >
                  {isPlaying ? <Pause className="w-4 h-4" /> : <Play className="w-4 h-4" />}
                </button>
                <span className="font-mono text-slate-300 text-[11px]">
                  Frame: {currentFrame}/{totalFrames}
                </span>
              </div>

              {/* Speed Buttons */}
              <div className="flex items-center gap-1 font-mono text-[11px]">
                <span className="text-slate-400 pr-1">Speed:</span>
                {[0.5, 1.0, 1.5].map(spd => (
                  <button
                    key={spd}
                    onClick={() => setPlaybackSpeed(spd)}
                    className={`px-2 py-0.5 rounded font-bold ${
                      playbackSpeed === spd ? 'bg-sky-600 text-white' : 'bg-slate-800 text-slate-400 hover:text-white'
                    }`}
                  >
                    {spd}x
                  </button>
                ))}
              </div>

              {/* 3D Perspective Rotation Slider */}
              <div className="flex items-center gap-2 text-[11px] text-slate-400">
                <span>Angle:</span>
                <input
                  type="range"
                  min="-45"
                  max="45"
                  value={viewAngleDeg}
                  onChange={(e) => setViewAngleDeg(parseInt(e.target.value))}
                  className="w-20 accent-sky-500"
                  title="Rotate perspective angle"
                />
              </div>
            </div>
          </div>

          {/* Skin Tone Selector (If anatomical mode) */}
          {renderMode === 'anatomical' && (
            <div className="flex items-center justify-between bg-slate-950 p-3 rounded-2xl border border-slate-800 text-xs text-slate-400">
              <span className="font-semibold text-slate-300">Skin Tone Texture:</span>
              <div className="flex items-center gap-2">
                {[
                  { id: 'fair', bg: '#F3C5A8', label: 'Fair' },
                  { id: 'warm', bg: '#E0A97A', label: 'Warm' },
                  { id: 'tan',  bg: '#B57A4C', label: 'Tan' },
                  { id: 'deep', bg: '#6B4226', label: 'Deep' }
                ].map(tone => (
                  <button
                    key={tone.id}
                    onClick={() => setSkinTone(tone.id as any)}
                    className={`flex items-center gap-1.5 px-2.5 py-1 rounded-lg border transition-all ${
                      skinTone === tone.id ? 'border-sky-400 bg-slate-800 text-white font-bold' : 'border-transparent text-slate-400'
                    }`}
                  >
                    <span className="w-3.5 h-3.5 rounded-full" style={{ backgroundColor: tone.bg }} />
                    <span className="text-[11px]">{tone.label}</span>
                  </button>
                ))}
              </div>
            </div>
          )}
        </div>

        {/* Right Column: Step-by-Step Signing Guide & Word Picker (5 Cols) */}
        <div className="lg:col-span-5 space-y-4 flex flex-col justify-between">
          {/* Kinetic Signing Verbal Instructions */}
          <div className="bg-slate-950 border border-slate-800 rounded-3xl p-5 space-y-3">
            <div className="flex items-center justify-between">
              <span className="text-xs font-bold text-slate-400 uppercase tracking-wider">
                Kinetic Movement Instructions
              </span>
              <button
                onClick={() => ttsService.speak(`Sign for ${selectedSign.name}: ${selectedSign.description}`)}
                className="min-h-[34px] px-3 py-1 bg-sky-600 hover:bg-sky-500 text-white text-xs font-bold rounded-xl flex items-center gap-1.5 transition-colors"
              >
                <Volume2 className="w-3.5 h-3.5" />
                <span>Audio Guide</span>
              </button>
            </div>

            <p className="text-sm font-semibold text-slate-100 leading-relaxed bg-slate-900 p-4 rounded-2xl border border-slate-800/80">
              {selectedSign.description}
            </p>

            <div className="pt-2 border-t border-slate-800 flex items-center justify-between text-xs text-slate-400">
              <span>Category: <strong className="text-sky-400">{selectedSign.category}</strong></span>
              <span>Hands: <strong className="text-emerald-400">{selectedSign.twoHanded ? 'Both Hands' : 'Right Hand'}</strong></span>
            </div>
          </div>

          {/* Quick Word Switcher Grid */}
          <div className="bg-slate-950 border border-slate-800 rounded-3xl p-5 space-y-3">
            <div className="flex items-center justify-between">
              <span className="text-xs font-bold text-slate-300 uppercase tracking-wider">
                Select Sign to Perform
              </span>
              <span className="text-[11px] text-slate-500 font-mono">50 Vocabulary Signs</span>
            </div>

            <div className="flex flex-wrap gap-1.5 max-h-48 overflow-y-auto pr-1">
              {INCLUDE_50_CLASSES.map(cls => (
                <button
                  key={cls.id}
                  onClick={() => onSignSelected?.(cls)}
                  className={`px-3 py-1.5 rounded-xl text-xs font-semibold transition-all ${
                    selectedSign.id === cls.id
                      ? 'bg-sky-600 text-white shadow-md'
                      : 'bg-slate-900 hover:bg-slate-800 text-slate-300 hover:text-white border border-slate-800'
                  }`}
                >
                  {cls.name}
                </button>
              ))}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};
