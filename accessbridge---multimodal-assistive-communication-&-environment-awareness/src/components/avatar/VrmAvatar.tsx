/**
 * AccessBridge - Unified VRM Avatar Component (VrmAvatar.tsx)
 * Phase 5 Architecture:
 * - Single master animation loop owned by VrmAvatar
 * - Direct MotionPlaybackController integration with zero React state thrashing
 * - Audio-driven lip-sync (A, I, U, E, O) subscribed to ttsService
 * - Subtle natural smile (~0.2 Joy) and random blinking every 3-5s
 * - Safe VRM 0.0 bone validation (skips missing bones silently)
 * - Auto-pauses render loop when browser tab is hidden
 * - Comprehensive fallback states: WebGL unsupported / asset load failure with retry
 * - Clean GPU and texture disposal on unmount
 */

import React, { useEffect, useRef, useState } from 'react';
import * as THREE from 'three';
import { GLTFLoader } from 'three/examples/jsm/loaders/GLTFLoader.js';
import { VRM, VRMLoaderPlugin, VRMUtils, VRMHumanBoneName, VRMHumanoidHelper } from '@pixiv/three-vrm';
import { SolvedBoneRotations } from '../../motion/coordinates';
import { MotionPlaybackController } from '../../motion/playbackController';
import { ttsService } from '../../services/ttsService';
import { Loader2, AlertCircle, RefreshCw, Eye, EyeOff, Layers } from 'lucide-react';

export interface VrmAvatarProps {
  controller?: MotionPlaybackController | null;
  pose?: SolvedBoneRotations | null;
  poseRef?: React.RefObject<SolvedBoneRotations | null>;
  cameraMode?: 'front' | 'hands_close' | 'profile_45';
  showDebugSkeleton?: boolean;
  onLoaded?: (vrm: VRM) => void;
  onError?: (err: Error) => void;
  className?: string;
  avatarUrl?: string;
  fallbackWord?: string;
}

export const VrmAvatar: React.FC<VrmAvatarProps> = ({
  controller,
  pose,
  poseRef,
  cameraMode = 'front',
  showDebugSkeleton = false,
  onLoaded,
  onError,
  className = '',
  avatarUrl = '/models/avatar.vrm',
  fallbackWord = 'Hello'
}) => {
  const mountRef = useRef<HTMLDivElement | null>(null);

  // States
  const [isLoading, setIsLoading] = useState<boolean>(true);
  const [loadProgress, setLoadProgress] = useState<number>(0);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [isWebGlSupported, setIsWebGlSupported] = useState<boolean>(true);
  const [retryCount, setRetryCount] = useState<number>(0);

  // References for Three.js instance
  const sceneRef = useRef<THREE.Scene | null>(null);
  const cameraRef = useRef<THREE.PerspectiveCamera | null>(null);
  const rendererRef = useRef<THREE.WebGLRenderer | null>(null);
  const vrmRef = useRef<VRM | null>(null);
  const skeletonHelperRef = useRef<THREE.SkeletonHelper | null>(null);
  const humanoidHelperRef = useRef<VRMHumanoidHelper | null>(null);
  const animFrameIdRef = useRef<number | null>(null);
  const clockRef = useRef<THREE.Clock>(new THREE.Clock());

  // Controller & Pose refs to eliminate React re-render overhead
  const controllerRef = useRef<MotionPlaybackController | null>(controller || null);
  useEffect(() => {
    controllerRef.current = controller || null;
  }, [controller]);

  const externalPoseRef = useRef<SolvedBoneRotations | null>(pose || null);
  useEffect(() => {
    externalPoseRef.current = pose || null;
  }, [pose]);

  // Lip-Sync and Blinking State Refs (driven per frame in renderLoop)
  const lipSyncVowelRef = useRef<{ vowel: 'A' | 'I' | 'U' | 'E' | 'O'; weight: number }>({ vowel: 'A', weight: 0 });
  const nextBlinkTimeRef = useRef<number>(performance.now() + 3000);
  const isBlinkingRef = useRef<boolean>(false);
  const blinkStartRef = useRef<number>(0);

  // Handle Camera Framing Modes
  useEffect(() => {
    const camera = cameraRef.current;
    if (!camera) return;

    if (cameraMode === 'front') {
      camera.position.set(0, 1.15, 1.45);
      camera.lookAt(0, 1.00, 0);
    } else if (cameraMode === 'hands_close') {
      camera.position.set(0, 1.05, 1.10);
      camera.lookAt(0, 0.95, 0);
    } else if (cameraMode === 'profile_45') {
      camera.position.set(0.80, 1.15, 1.30);
      camera.lookAt(0, 1.00, 0);
    }
  }, [cameraMode]);

  // Toggle Skeleton Helper
  useEffect(() => {
    if (skeletonHelperRef.current) skeletonHelperRef.current.visible = showDebugSkeleton;
    if (humanoidHelperRef.current) humanoidHelperRef.current.visible = showDebugSkeleton;
  }, [showDebugSkeleton]);

  // Subscribe to TTS Audio Lip-Sync
  useEffect(() => {
    const unsubscribe = ttsService.addLipSyncListener((vowel, weight) => {
      lipSyncVowelRef.current = { vowel, weight };
    });
    return unsubscribe;
  }, []);

  // WebGL Availability Check
  const checkWebGL = (): boolean => {
    try {
      const canvas = document.createElement('canvas');
      return !!(window.WebGLRenderingContext && (canvas.getContext('webgl') || canvas.getContext('experimental-webgl')));
    } catch {
      return false;
    }
  };

  // Main Three.js & VRM Initialization Effect
  useEffect(() => {
    const container = mountRef.current;
    if (!container) return;

    if (!checkWebGL()) {
      setIsWebGlSupported(false);
      setIsLoading(false);
      return;
    }

    let isDisposed = false;
    setIsLoading(true);
    setLoadProgress(0);
    setLoadError(null);

    // 1. Scene, Camera, Renderer Setup
    const width = container.clientWidth || 480;
    const height = container.clientHeight || 480;

    const scene = new THREE.Scene();
    sceneRef.current = scene;

    const camera = new THREE.PerspectiveCamera(38, width / height, 0.1, 20.0);
    camera.position.set(0, 1.15, 1.45);
    camera.lookAt(0, 1.00, 0);
    cameraRef.current = camera;

    let renderer: THREE.WebGLRenderer;
    try {
      renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true, powerPreference: 'high-performance' });
      renderer.setSize(width, height);
      renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2.0));
      renderer.outputColorSpace = THREE.SRGBColorSpace;
      rendererRef.current = renderer;
      container.appendChild(renderer.domElement);
    } catch (e: any) {
      setIsWebGlSupported(false);
      setIsLoading(false);
      return;
    }

    // Studio Lighting for Clear Hand Signing Contrast
    const ambientLight = new THREE.AmbientLight(0xffffff, 1.4);
    scene.add(ambientLight);

    const dirLightFront = new THREE.DirectionalLight(0xffffff, 1.8);
    dirLightFront.position.set(0, 2, 2);
    scene.add(dirLightFront);

    const dirLightBack = new THREE.DirectionalLight(0x38bdf8, 0.8);
    dirLightBack.position.set(0, 2, -2);
    scene.add(dirLightBack);

    const fillLight = new THREE.DirectionalLight(0xfff5ea, 0.7);
    fillLight.position.set(-1.5, 1.5, 1.5);
    scene.add(fillLight);

    // 2. Load VRM Asset with GLTFLoader
    const loader = new GLTFLoader();
    loader.register((parser) => new VRMLoaderPlugin(parser));

    loader.load(
      avatarUrl,
      (gltf) => {
        if (isDisposed) {
          if (gltf.userData.vrm) VRMUtils.deepDispose(gltf.userData.vrm.scene);
          return;
        }

        const vrm: VRM = gltf.userData.vrm;
        if (!vrm) {
          const err = new Error('Loaded asset does not contain a valid VRM instance.');
          setLoadError(err.message);
          onError?.(err);
          setIsLoading(false);
          return;
        }

        // Apply official VRM 0.0 orientation correction
        VRMUtils.rotateVRM0(vrm);
        scene.add(vrm.scene);
        vrmRef.current = vrm;
        vrm.scene.position.set(0, 0, 0);
        // Slightly compact scale (0.85) to comfortably fit upper-body signing space without overcrowding
        vrm.scene.scale.set(0.85, 0.85, 0.85);

        // Skeleton helpers for debug mode
        const skeletonHelper = new THREE.SkeletonHelper(vrm.scene);
        skeletonHelper.visible = showDebugSkeleton;
        scene.add(skeletonHelper);
        skeletonHelperRef.current = skeletonHelper;

        const humanoidHelper = new VRMHumanoidHelper(vrm.humanoid);
        humanoidHelper.visible = showDebugSkeleton;
        scene.add(humanoidHelper);
        humanoidHelperRef.current = humanoidHelper;

        // Subtle friendly natural smile (~0.2 Joy)
        if (vrm.expressionManager) {
          vrm.expressionManager.setValue('Joy', 0.20);
        }

        // Apply relaxed natural arm rest angle (downward ~70 deg) so avatar is never stiff in T-pose
        const rUpper = vrm.humanoid.getNormalizedBoneNode(VRMHumanBoneName.RightUpperArm);
        const lUpper = vrm.humanoid.getNormalizedBoneNode(VRMHumanBoneName.LeftUpperArm);
        if (rUpper) rUpper.quaternion.set(0, 0, -0.5736, 0.8192);
        if (lUpper) lUpper.quaternion.set(0, 0, 0.5736, 0.8192);
        vrm.update(0);

        setIsLoading(false);
        onLoaded?.(vrm);
      },
      (progress) => {
        if (progress.total > 0) {
          setLoadProgress(Math.round((progress.loaded / progress.total) * 100));
        }
      },
      (error) => {
        if (isDisposed) return;
        const err = error instanceof Error ? error : new Error(String(error));
        setLoadError(err.message || 'Avatar 3D file could not be loaded.');
        setIsLoading(false);
        onError?.(err);
      }
    );

    // 3. Single Master Animation & Render Loop
    clockRef.current.start();

    const masterRenderLoop = () => {
      animFrameIdRef.current = requestAnimationFrame(masterRenderLoop);

      // Tab visibility check: skip rendering when tab is hidden to save GPU/CPU
      if (document.hidden) return;

      const rawDelta = clockRef.current.getDelta();
      const delta = Math.min(rawDelta, 0.05); // Clamp dt to 0.05s

      const vrm = vrmRef.current;
      const ctrl = controllerRef.current;

      if (vrm) {
        // Step A: Update motion timeline if playback controller is active
        if (ctrl) {
          ctrl.update(delta);
        }

        // Step B: Determine active pose source (Direct controller pose or external poseRef/pose)
        const activePose = (poseRef && poseRef.current) || externalPoseRef.current || (ctrl ? ctrl.activePose : null);

        if (activePose) {
          for (const [boneKey, quat] of Object.entries(activePose) as [VRMHumanBoneName, THREE.Quaternion][]) {
            let boneNode = vrm.humanoid.getNormalizedBoneNode(boneKey);
            if (!boneNode) {
              if (boneKey === 'rightThumbMetacarpal' as any) boneNode = vrm.humanoid.getNormalizedBoneNode(VRMHumanBoneName.RightThumbProximal);
              else if (boneKey === 'rightThumbProximal' as any) boneNode = vrm.humanoid.getNormalizedBoneNode(VRMHumanBoneName.RightThumbDistal);
              else if (boneKey === 'leftThumbMetacarpal' as any) boneNode = vrm.humanoid.getNormalizedBoneNode(VRMHumanBoneName.LeftThumbProximal);
              else if (boneKey === 'leftThumbProximal' as any) boneNode = vrm.humanoid.getNormalizedBoneNode(VRMHumanBoneName.LeftThumbDistal);
            }
            if (boneNode && quat) {
              // Direct assignment to normalized humanoid bone nodes (scene orientation handled at root)
              boneNode.quaternion.copy(quat);
            }
          }
        }

        // Step C: Natural Blinking Animation (blinks every 3.5 - 5.0 seconds)
        const now = performance.now();
        if (vrm.expressionManager) {
          if (!isBlinkingRef.current && now >= nextBlinkTimeRef.current) {
            isBlinkingRef.current = true;
            blinkStartRef.current = now;
          }

          if (isBlinkingRef.current) {
            const blinkElapsed = now - blinkStartRef.current;
            const blinkDuration = 160; // 160ms blink duration
            if (blinkElapsed >= blinkDuration) {
              isBlinkingRef.current = false;
              nextBlinkTimeRef.current = now + 3000 + Math.random() * 2500;
              vrm.expressionManager.setValue('Blink', 0);
            } else {
              // Half sine curve for blink closing and opening
              const blinkWeight = Math.sin((blinkElapsed / blinkDuration) * Math.PI);
              vrm.expressionManager.setValue('Blink', blinkWeight);
            }
          }

          // Step D: Audio-Driven Lip-Sync
          const { vowel, weight } = lipSyncVowelRef.current;
          const vowels: ('A' | 'I' | 'U' | 'E' | 'O')[] = ['A', 'I', 'U', 'E', 'O'];
          for (const v of vowels) {
            if (v === vowel) {
              vrm.expressionManager.setValue(v, weight);
            } else {
              vrm.expressionManager.setValue(v, 0);
            }
          }

          // Maintain subtle smile
          vrm.expressionManager.setValue('Joy', 0.20);
        }

        // Step E: Update VRM springs, expressions, constraints
        vrm.update(delta);
      }

      // Step F: Render Three.js frame
      if (rendererRef.current && sceneRef.current && cameraRef.current) {
        rendererRef.current.render(sceneRef.current, cameraRef.current);
      }
    };

    masterRenderLoop();

    // 4. Handle Window Resize
    const handleResize = () => {
      if (!container || !rendererRef.current || !cameraRef.current) return;
      const w = container.clientWidth;
      const h = container.clientHeight;
      cameraRef.current.aspect = w / h;
      cameraRef.current.updateProjectionMatrix();
      rendererRef.current.setSize(w, h);
    };
    window.addEventListener('resize', handleResize);

    // 5. Clean Disposal Lifecycle
    return () => {
      isDisposed = true;
      window.removeEventListener('resize', handleResize);

      if (animFrameIdRef.current) {
        cancelAnimationFrame(animFrameIdRef.current);
      }

      if (vrmRef.current) {
        VRMUtils.deepDispose(vrmRef.current.scene);
      }

      if (rendererRef.current) {
        rendererRef.current.dispose();
        if (rendererRef.current.domElement && rendererRef.current.domElement.parentNode) {
          rendererRef.current.domElement.parentNode.removeChild(rendererRef.current.domElement);
        }
      }

      sceneRef.current = null;
      cameraRef.current = null;
      rendererRef.current = null;
      vrmRef.current = null;
    };
  }, [avatarUrl, retryCount]);

  // Fallback 1: WebGL Unsupported View
  if (!isWebGlSupported) {
    return (
      <div className={`relative flex flex-col items-center justify-center bg-slate-950 border border-slate-800 rounded-2xl p-6 text-center space-y-4 ${className}`}>
        <div className="w-16 h-16 rounded-2xl bg-amber-500/10 border border-amber-500/30 flex items-center justify-center text-amber-400">
          <EyeOff className="w-8 h-8" />
        </div>
        <div>
          <h4 className="text-base font-bold text-white">WebGL 3D Accelerated Graphics Unavailable</h4>
          <p className="text-xs text-slate-400 max-w-sm mt-1">
            Your browser does not have WebGL enabled. Showing 2D assistive sign card for &ldquo;{fallbackWord}&rdquo;.
          </p>
        </div>
        <div className="p-4 bg-slate-900 border border-slate-800 rounded-xl text-left text-xs text-slate-300 space-y-1.5 w-full max-w-sm">
          <div className="font-bold text-sky-400 uppercase tracking-wider">Kinematic Instructions:</div>
          <p>Sign &ldquo;{fallbackWord}&rdquo;: Raise dominant hand to upper torso/face level, extend open palm outward with relaxed fingers.</p>
        </div>
      </div>
    );
  }

  // Fallback 2: Avatar Asset Load Error with Retry Button
  if (loadError) {
    return (
      <div className={`relative flex flex-col items-center justify-center bg-slate-950 border border-rose-900/50 rounded-2xl p-6 text-center space-y-4 ${className}`}>
        <div className="w-16 h-16 rounded-2xl bg-rose-500/10 border border-rose-500/30 flex items-center justify-center text-rose-400">
          <AlertCircle className="w-8 h-8" />
        </div>
        <div>
          <h4 className="text-base font-bold text-white">3D Avatar Temporarily Unavailable</h4>
          <p className="text-xs text-slate-400 max-w-sm mt-1">
            Could not load avatar file ({loadError}). You can retry loading or view offline sign instructions.
          </p>
        </div>
        <button
          onClick={() => setRetryCount(prev => prev + 1)}
          className="px-4 py-2 bg-sky-600 hover:bg-sky-500 text-white text-xs font-bold rounded-xl flex items-center gap-2 transition-all shadow-md"
        >
          <RefreshCw className="w-4 h-4" />
          <span>Retry Loading 3D Avatar</span>
        </button>
      </div>
    );
  }

  return (
    <div className={`relative w-full h-full min-h-[380px] bg-[#0A0F1D] rounded-2xl overflow-hidden shadow-2xl ${className}`}>
      {/* 3D WebGL Canvas Container */}
      <div ref={mountRef} className="w-full h-full" />

      {/* Loading Overlay */}
      {isLoading && (
        <div className="absolute inset-0 bg-slate-950/85 backdrop-blur-sm flex flex-col items-center justify-center space-y-3 z-20">
          <Loader2 className="w-8 h-8 text-sky-400 animate-spin" />
          <div className="text-center">
            <span className="text-xs font-bold text-white uppercase tracking-wider">Loading 54-Bone VRM Avatar</span>
            <div className="text-[11px] text-slate-400 mt-0.5">{loadProgress > 0 ? `${loadProgress}%` : 'Mounting 3D meshes...'}</div>
          </div>
          {loadProgress > 0 && (
            <div className="w-36 h-1 bg-slate-800 rounded-full overflow-hidden">
              <div className="h-full bg-sky-500 transition-all duration-150" style={{ width: `${loadProgress}%` }} />
            </div>
          )}
        </div>
      )}
    </div>
  );
};
