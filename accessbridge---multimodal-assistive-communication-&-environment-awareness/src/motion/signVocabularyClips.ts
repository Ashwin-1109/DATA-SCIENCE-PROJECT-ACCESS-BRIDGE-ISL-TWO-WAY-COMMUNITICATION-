/**
 * AccessBridge - High-Fidelity Indian Sign Language (ISL) Motion Synthesis Engine
 * 
 * Synthesizes anatomically accurate, verified 3D VRM keyframe animation clips for:
 * 1. All 50 INCLUDE-50 Benchmark Sign Classes (AI4Bharat IIT Madras ISL Corpus)
 * 2. Official conversational greetings (Good Morning, Good afternoon, How are you, Alright)
 * 
 * Kinematic Architecture:
 * - Phase 1 (0.0s): Neutral rest posture (relaxed arms down along torso)
 * - Phase 2 (0.3s): Preparation & lift into signing box
 * - Phase 3 (0.4s - 1.6s): Distinctive anatomical gesture stroke & repetition
 * - Phase 4 (1.7s): Brief presentation hold
 * - Phase 5 (2.0s - 2.4s): Recovery lowering arms smoothly back to resting sides
 * 
 * Ensures the avatar NEVER stays stuck "lifting its hand up" and performs authentic ISL signs.
 */

import * as THREE from 'three';
import { MotionClipData, MotionKeyframe } from './playbackController';

// Helper: Convert degrees (Euler XYZ) to quaternion array [x, y, z, w]
export function eulerToQuat(xDeg: number, yDeg: number, zDeg: number): [number, number, number, number] {
  const euler = new THREE.Euler(
    THREE.MathUtils.DEG2RAD * xDeg,
    THREE.MathUtils.DEG2RAD * yDeg,
    THREE.MathUtils.DEG2RAD * zDeg,
    'XYZ'
  );
  const q = new THREE.Quaternion().setFromEuler(euler);
  return [
    Number(q.x.toFixed(4)),
    Number(q.y.toFixed(4)),
    Number(q.z.toFixed(4)),
    Number(q.w.toFixed(4))
  ];
}

// ============================================================================
// BASE ANATOMICAL POSTURES (VRM Normalized Humanoid Space)
// ============================================================================

// Relaxed neutral arms at sides (downward ~70 degrees along torso)
export const REST_ARM_RIGHT = {
  rightUpperArm: eulerToQuat(0, 0, -70),
  rightLowerArm: [0, 0, 0, 1] as [number, number, number, number],
  rightHand: [0, 0, 0, 1] as [number, number, number, number]
};

export const REST_ARM_LEFT = {
  leftUpperArm: eulerToQuat(0, 0, 70),
  leftLowerArm: [0, 0, 0, 1] as [number, number, number, number],
  leftHand: [0, 0, 0, 1] as [number, number, number, number]
};

// ============================================================================
// FINGER ARTICULATION HELPERS
// ============================================================================

// Right Hand: curl is negative Z, spread is Y
export function rFingerJoint(curlDeg: number, spreadDeg: number = 0): [number, number, number, number] {
  return eulerToQuat(0, spreadDeg, -curlDeg);
}

// Right Hand Thumb: curl is negative Z, opposition across palm is positive Y
export function rThumbJoint(curlDeg: number, opposeDeg: number = 0): [number, number, number, number] {
  return eulerToQuat(0, opposeDeg, -curlDeg);
}

// Left Hand: curl is positive Z, spread is negative Y
export function lFingerJoint(curlDeg: number, spreadDeg: number = 0): [number, number, number, number] {
  return eulerToQuat(0, -spreadDeg, curlDeg);
}

// Left Hand Thumb: curl is positive Z, opposition across palm is negative Y
export function lThumbJoint(curlDeg: number, opposeDeg: number = 0): [number, number, number, number] {
  return eulerToQuat(0, -opposeDeg, curlDeg);
}

// Neutral relaxed fingers (slight 12-degree natural curve)
export function getRelaxedFingersRight() {
  const q = rFingerJoint(12);
  const t = rThumbJoint(10, 10);
  return {
    rightThumbMetacarpal: t,
    rightThumbProximal: t,
    rightThumbDistal: t,
    rightIndexProximal: q,
    rightIndexIntermediate: q,
    rightIndexDistal: q,
    rightMiddleProximal: q,
    rightMiddleIntermediate: q,
    rightMiddleDistal: q,
    rightRingProximal: q,
    rightRingIntermediate: q,
    rightRingDistal: q,
    rightLittleProximal: q,
    rightLittleIntermediate: q,
    rightLittleDistal: q
  };
}

export function getRelaxedFingersLeft() {
  const q = lFingerJoint(12);
  const t = lThumbJoint(10, 10);
  return {
    leftThumbMetacarpal: t,
    leftThumbProximal: t,
    leftThumbDistal: t,
    leftIndexProximal: q,
    leftIndexIntermediate: q,
    leftIndexDistal: q,
    leftMiddleProximal: q,
    leftMiddleIntermediate: q,
    leftMiddleDistal: q,
    leftRingProximal: q,
    leftRingIntermediate: q,
    leftRingDistal: q,
    leftLittleProximal: q,
    leftLittleIntermediate: q,
    leftLittleDistal: q
  };
}

// Open Flat 5-Hand / B-Hand (flat palm, all fingers extended straight)
export function getFlatOpenFingersRight() {
  const open = [0, 0, 0, 1] as [number, number, number, number];
  const t = rThumbJoint(15, 15);
  return {
    rightThumbMetacarpal: t,
    rightThumbProximal: t,
    rightThumbDistal: open,
    rightIndexProximal: open,
    rightIndexIntermediate: open,
    rightIndexDistal: open,
    rightMiddleProximal: open,
    rightMiddleIntermediate: open,
    rightMiddleDistal: open,
    rightRingProximal: open,
    rightRingIntermediate: open,
    rightRingDistal: open,
    rightLittleProximal: open,
    rightLittleIntermediate: open,
    rightLittleDistal: open
  };
}

export function getFlatOpenFingersLeft() {
  const open = [0, 0, 0, 1] as [number, number, number, number];
  const t = lThumbJoint(15, 15);
  return {
    leftThumbMetacarpal: t,
    leftThumbProximal: t,
    leftThumbDistal: open,
    leftIndexProximal: open,
    leftIndexIntermediate: open,
    leftIndexDistal: open,
    leftMiddleProximal: open,
    leftMiddleIntermediate: open,
    leftMiddleDistal: open,
    leftRingProximal: open,
    leftRingIntermediate: open,
    leftRingDistal: open,
    leftLittleProximal: open,
    leftLittleIntermediate: open,
    leftLittleDistal: open
  };
}

// Fist / S-Hand / A-Hand (all fingers curled into palm)
export function getFistFingersRight(thumbUp: boolean = false) {
  const cP = rFingerJoint(75);
  const cI = rFingerJoint(80);
  const cD = rFingerJoint(70);
  const t = thumbUp ? rThumbJoint(0, 0) : rThumbJoint(45, 30);
  return {
    rightThumbMetacarpal: t,
    rightThumbProximal: t,
    rightThumbDistal: t,
    rightIndexProximal: cP,
    rightIndexIntermediate: cI,
    rightIndexDistal: cD,
    rightMiddleProximal: cP,
    rightMiddleIntermediate: cI,
    rightMiddleDistal: cD,
    rightRingProximal: cP,
    rightRingIntermediate: cI,
    rightRingDistal: cD,
    rightLittleProximal: cP,
    rightLittleIntermediate: cI,
    rightLittleDistal: cD
  };
}

export function getFistFingersLeft(thumbUp: boolean = false) {
  const cP = lFingerJoint(75);
  const cI = lFingerJoint(80);
  const cD = lFingerJoint(70);
  const t = thumbUp ? lThumbJoint(0, 0) : lThumbJoint(45, 30);
  return {
    leftThumbMetacarpal: t,
    leftThumbProximal: t,
    leftThumbDistal: t,
    leftIndexProximal: cP,
    leftIndexIntermediate: cI,
    leftIndexDistal: cD,
    leftMiddleProximal: cP,
    leftMiddleIntermediate: cI,
    leftMiddleDistal: cD,
    leftRingProximal: cP,
    leftRingIntermediate: cI,
    leftRingDistal: cD,
    leftLittleProximal: cP,
    leftLittleIntermediate: cI,
    leftLittleDistal: cD
  };
}

// W-Hand (Water): Index, Middle, Ring extended; Thumb holds Pinky down
export function getWHandFingersRight() {
  const open = [0, 0, 0, 1] as [number, number, number, number];
  const pinkyCurl = rFingerJoint(80);
  const thumbOver = rThumbJoint(50, 35);
  return {
    rightThumbMetacarpal: thumbOver,
    rightThumbProximal: thumbOver,
    rightThumbDistal: thumbOver,
    rightIndexProximal: rFingerJoint(0, 3),
    rightIndexIntermediate: open,
    rightIndexDistal: open,
    rightMiddleProximal: open,
    rightMiddleIntermediate: open,
    rightMiddleDistal: open,
    rightRingProximal: rFingerJoint(0, -3),
    rightRingIntermediate: open,
    rightRingDistal: open,
    rightLittleProximal: pinkyCurl,
    rightLittleIntermediate: pinkyCurl,
    rightLittleDistal: pinkyCurl
  };
}

// 1-Hand / Index Pointing (Where, Deaf, Time): Index straight, others curled
export function getPointingIndexFingersRight() {
  const open = [0, 0, 0, 1] as [number, number, number, number];
  const cP = rFingerJoint(75);
  const cI = rFingerJoint(80);
  const cD = rFingerJoint(70);
  const thumb = rThumbJoint(40, 25);
  return {
    rightThumbMetacarpal: thumb,
    rightThumbProximal: thumb,
    rightThumbDistal: thumb,
    rightIndexProximal: open,
    rightIndexIntermediate: open,
    rightIndexDistal: open,
    rightMiddleProximal: cP,
    rightMiddleIntermediate: cI,
    rightMiddleDistal: cD,
    rightRingProximal: cP,
    rightRingIntermediate: cI,
    rightRingDistal: cD,
    rightLittleProximal: cP,
    rightLittleIntermediate: cI,
    rightLittleDistal: cD
  };
}

// Bent-V Hand (Doctor): Index & Middle extended and bent at knuckles
export function getBentVFingersRight() {
  const bentP = rFingerJoint(45);
  const bentI = rFingerJoint(45);
  const open = [0, 0, 0, 1] as [number, number, number, number];
  const cP = rFingerJoint(75);
  const cI = rFingerJoint(80);
  const thumb = rThumbJoint(40, 25);
  return {
    rightThumbMetacarpal: thumb,
    rightThumbProximal: thumb,
    rightThumbDistal: thumb,
    rightIndexProximal: bentP,
    rightIndexIntermediate: bentI,
    rightIndexDistal: open,
    rightMiddleProximal: bentP,
    rightMiddleIntermediate: bentI,
    rightMiddleDistal: open,
    rightRingProximal: cP,
    rightRingIntermediate: cI,
    rightRingDistal: cP,
    rightLittleProximal: cP,
    rightLittleIntermediate: cI,
    rightLittleDistal: cP
  };
}

// Snapping / Pinch Hand (No): Index & Middle curled toward thumb
export function getSnappingFingersRight(isClosed: boolean) {
  const curl = isClosed ? 75 : 25;
  const c = rFingerJoint(curl);
  const t = rThumbJoint(isClosed ? 50 : 20, 30);
  const closedOther = rFingerJoint(75);
  return {
    rightThumbMetacarpal: t,
    rightThumbProximal: t,
    rightThumbDistal: t,
    rightIndexProximal: c,
    rightIndexIntermediate: c,
    rightIndexDistal: c,
    rightMiddleProximal: c,
    rightMiddleIntermediate: c,
    rightMiddleDistal: c,
    rightRingProximal: closedOther,
    rightRingIntermediate: closedOther,
    rightRingDistal: closedOther,
    rightLittleProximal: closedOther,
    rightLittleIntermediate: closedOther,
    rightLittleDistal: closedOther
  };
}

// Flattened O-Hand (Food, Eat): All fingertips touching thumb tip
export function getFlatOFingersRight() {
  const p = rFingerJoint(50);
  const i = rFingerJoint(60);
  const d = rFingerJoint(45);
  const t = rThumbJoint(40, 35);
  return {
    rightThumbMetacarpal: t,
    rightThumbProximal: t,
    rightThumbDistal: t,
    rightIndexProximal: p,
    rightIndexIntermediate: i,
    rightIndexDistal: d,
    rightMiddleProximal: p,
    rightMiddleIntermediate: i,
    rightMiddleDistal: d,
    rightRingProximal: p,
    rightRingIntermediate: i,
    rightRingDistal: d,
    rightLittleProximal: p,
    rightLittleIntermediate: i,
    rightLittleDistal: d
  };
}

// Complete Full-Body Rest Frame (t = 0 and t = end)
export function getCompleteRestFrame(timeSec: number): MotionKeyframe {
  return {
    timeSec,
    rotations: {
      ...REST_ARM_RIGHT,
      ...REST_ARM_LEFT,
      ...getRelaxedFingersRight(),
      ...getRelaxedFingersLeft(),
      chest: [0, 0, 0, 1],
      spine: [0, 0, 0, 1],
      neck: [0, 0, 0, 1],
      head: [0, 0, 0, 1]
    }
  };
}

// ============================================================================
// COMPREHENSIVE ISL SIGN BUILDER
// ============================================================================

type ClipGenerator = () => MotionClipData;

const SIGN_GENERATORS: Record<string, ClipGenerator> = {
  // --------------------------------------------------------------------------
  // 0. HELLO (Waved open palm beside right temple twice, then returns to rest)
  // --------------------------------------------------------------------------
  'hello': () => {
    const upBase = eulerToQuat(-5, 42, 28);
    const loBase = eulerToQuat(48, 12, -72);
    const fingers = getFlatOpenFingersRight();

    return {
      clipId: 'isl_hello',
      phrase: 'Hello',
      durationSec: 2.4,
      keyframes: [
        getCompleteRestFrame(0.0),
        // Rise to temple
        {
          timeSec: 0.35,
          rotations: {
            ...REST_ARM_LEFT,
            rightUpperArm: upBase,
            rightLowerArm: loBase,
            rightHand: eulerToQuat(0, 0, -10),
            ...fingers
          }
        },
        // Wave 1 right
        {
          timeSec: 0.65,
          rotations: {
            ...REST_ARM_LEFT,
            rightUpperArm: eulerToQuat(-5, 44, 25),
            rightLowerArm: loBase,
            rightHand: eulerToQuat(0, 0, 15),
            ...fingers
          }
        },
        // Wave 1 left
        {
          timeSec: 0.95,
          rotations: {
            ...REST_ARM_LEFT,
            rightUpperArm: upBase,
            rightLowerArm: loBase,
            rightHand: eulerToQuat(0, 0, -18),
            ...fingers
          }
        },
        // Wave 2 right
        {
          timeSec: 1.25,
          rotations: {
            ...REST_ARM_LEFT,
            rightUpperArm: eulerToQuat(-5, 44, 25),
            rightLowerArm: loBase,
            rightHand: eulerToQuat(0, 0, 15),
            ...fingers
          }
        },
        // Wave 2 center
        {
          timeSec: 1.55,
          rotations: {
            ...REST_ARM_LEFT,
            rightUpperArm: upBase,
            rightLowerArm: loBase,
            rightHand: eulerToQuat(0, 0, 0),
            ...fingers
          }
        },
        // Recovery: Return smoothly down to rest
        getCompleteRestFrame(2.1),
        getCompleteRestFrame(2.4)
      ]
    };
  },

  // --------------------------------------------------------------------------
  // 1. THANK YOU (B-hand touches chin, sweeps forward-down toward viewer, nod)
  // --------------------------------------------------------------------------
  'thank you': () => {
    const fingers = getFlatOpenFingersRight();
    return {
      clipId: 'isl_thank_you',
      phrase: 'Thank you',
      durationSec: 2.2,
      keyframes: [
        getCompleteRestFrame(0.0),
        // Hand rises to chin (palm facing signer)
        {
          timeSec: 0.4,
          rotations: {
            ...REST_ARM_LEFT,
            rightUpperArm: eulerToQuat(-18, 48, 32),
            rightLowerArm: eulerToQuat(55, 10, -82),
            rightHand: eulerToQuat(-15, 0, -10),
            head: eulerToQuat(0, 0, 0),
            ...fingers
          }
        },
        // Contact at chin
        {
          timeSec: 0.65,
          rotations: {
            ...REST_ARM_LEFT,
            rightUpperArm: eulerToQuat(-20, 50, 30),
            rightLowerArm: eulerToQuat(58, 12, -85),
            rightHand: eulerToQuat(-20, 0, -5),
            head: eulerToQuat(6, 0, 0),
            ...fingers
          }
        },
        // Sweeps forward & outward toward viewer in respectful arc
        {
          timeSec: 1.15,
          rotations: {
            ...REST_ARM_LEFT,
            rightUpperArm: eulerToQuat(-10, 30, 48),
            rightLowerArm: eulerToQuat(28, 15, -50),
            rightHand: eulerToQuat(15, 0, 10),
            head: eulerToQuat(12, 0, 0),
            ...fingers
          }
        },
        // Hold forward presentation
        {
          timeSec: 1.45,
          rotations: {
            ...REST_ARM_LEFT,
            rightUpperArm: eulerToQuat(-10, 30, 48),
            rightLowerArm: eulerToQuat(28, 15, -50),
            rightHand: eulerToQuat(15, 0, 10),
            head: eulerToQuat(8, 0, 0),
            ...fingers
          }
        },
        // Recovery: Return down to rest
        getCompleteRestFrame(2.0),
        getCompleteRestFrame(2.2)
      ]
    };
  },

  // --------------------------------------------------------------------------
  // 2. PLEASE (Flat right hand rubs gentle circle over upper chest twice)
  // --------------------------------------------------------------------------
  'please': () => {
    const fingers = getFlatOpenFingersRight();
    return {
      clipId: 'isl_please',
      phrase: 'Please',
      durationSec: 2.3,
      keyframes: [
        getCompleteRestFrame(0.0),
        // Rise to chest
        {
          timeSec: 0.35,
          rotations: {
            ...REST_ARM_LEFT,
            rightUpperArm: eulerToQuat(-12, 52, 48),
            rightLowerArm: eulerToQuat(42, 18, -75),
            rightHand: eulerToQuat(-10, 0, 0),
            ...fingers
          }
        },
        // Circle 1 top
        {
          timeSec: 0.65,
          rotations: {
            ...REST_ARM_LEFT,
            rightUpperArm: eulerToQuat(-16, 50, 44),
            rightLowerArm: eulerToQuat(46, 16, -78),
            rightHand: eulerToQuat(-5, 5, 0),
            ...fingers
          }
        },
        // Circle 1 bottom
        {
          timeSec: 0.95,
          rotations: {
            ...REST_ARM_LEFT,
            rightUpperArm: eulerToQuat(-8, 54, 52),
            rightLowerArm: eulerToQuat(38, 20, -70),
            rightHand: eulerToQuat(-15, -5, 0),
            ...fingers
          }
        },
        // Circle 2 top
        {
          timeSec: 1.25,
          rotations: {
            ...REST_ARM_LEFT,
            rightUpperArm: eulerToQuat(-16, 50, 44),
            rightLowerArm: eulerToQuat(46, 16, -78),
            rightHand: eulerToQuat(-5, 5, 0),
            ...fingers
          }
        },
        // Circle 2 center rest on heart
        {
          timeSec: 1.55,
          rotations: {
            ...REST_ARM_LEFT,
            rightUpperArm: eulerToQuat(-12, 52, 48),
            rightLowerArm: eulerToQuat(42, 18, -75),
            rightHand: eulerToQuat(-10, 0, 0),
            head: eulerToQuat(5, 0, 0),
            ...fingers
          }
        },
        getCompleteRestFrame(2.0),
        getCompleteRestFrame(2.3)
      ]
    };
  },

  // --------------------------------------------------------------------------
  // 3. HELP (Two-handed: Left horizontal palm-up base; Right A-fist lands on it, both lift!)
  // --------------------------------------------------------------------------
  'help': () => {
    const rFist = getFistFingersRight(true); // thumb pointing straight up
    const lPalm = getFlatOpenFingersLeft();
    return {
      clipId: 'isl_help',
      phrase: 'Help',
      durationSec: 2.4,
      keyframes: [
        getCompleteRestFrame(0.0),
        // Both hands rise: Left forms horizontal palm-up platform; Right A-fist enters above
        {
          timeSec: 0.4,
          rotations: {
            leftUpperArm: eulerToQuat(-12, -35, -42),
            leftLowerArm: eulerToQuat(40, -15, 68),
            leftHand: eulerToQuat(0, 0, -65), // Palm facing up
            rightUpperArm: eulerToQuat(-14, 45, 42),
            rightLowerArm: eulerToQuat(45, 15, -72),
            rightHand: eulerToQuat(0, 0, 0),
            ...lPalm,
            ...rFist
          }
        },
        // Right fist lands firmly on horizontal left palm at mid-chest
        {
          timeSec: 0.75,
          rotations: {
            leftUpperArm: eulerToQuat(-12, -38, -44),
            leftLowerArm: eulerToQuat(42, -12, 70),
            leftHand: eulerToQuat(0, 0, -65),
            rightUpperArm: eulerToQuat(-12, 48, 48),
            rightLowerArm: eulerToQuat(42, 16, -75),
            rightHand: eulerToQuat(0, 0, 0),
            head: eulerToQuat(-4, 0, 0),
            ...lPalm,
            ...rFist
          }
        },
        // BOTH hands lift together upward (~12 cm) in earnest lifting motion!
        {
          timeSec: 1.25,
          rotations: {
            leftUpperArm: eulerToQuat(-22, -32, -32),
            leftLowerArm: eulerToQuat(52, -10, 78),
            leftHand: eulerToQuat(0, 0, -65),
            rightUpperArm: eulerToQuat(-22, 42, 36),
            rightLowerArm: eulerToQuat(52, 14, -82),
            rightHand: eulerToQuat(0, 0, 0),
            head: eulerToQuat(6, 0, 0),
            ...lPalm,
            ...rFist
          }
        },
        // Hold elevated helpful presentation
        {
          timeSec: 1.55,
          rotations: {
            leftUpperArm: eulerToQuat(-22, -32, -32),
            leftLowerArm: eulerToQuat(52, -10, 78),
            leftHand: eulerToQuat(0, 0, -65),
            rightUpperArm: eulerToQuat(-22, 42, 36),
            rightLowerArm: eulerToQuat(52, 14, -82),
            rightHand: eulerToQuat(0, 0, 0),
            head: eulerToQuat(4, 0, 0),
            ...lPalm,
            ...rFist
          }
        },
        // Recovery: Both hands return smoothly to sides
        getCompleteRestFrame(2.1),
        getCompleteRestFrame(2.4)
      ]
    };
  },

  // --------------------------------------------------------------------------
  // 4. YES (Right S-fist in front of chest nods downward twice with head nod)
  // --------------------------------------------------------------------------
  'yes': () => {
    const fist = getFistFingersRight(false);
    const armUp = eulerToQuat(-12, 48, 48);
    const armLo = eulerToQuat(40, 18, -72);
    return {
      clipId: 'isl_yes',
      phrase: 'Yes',
      durationSec: 2.2,
      keyframes: [
        getCompleteRestFrame(0.0),
        // Rise to chest
        {
          timeSec: 0.35,
          rotations: {
            ...REST_ARM_LEFT,
            rightUpperArm: armUp,
            rightLowerArm: armLo,
            rightHand: eulerToQuat(0, 0, 0),
            head: eulerToQuat(0, 0, 0),
            ...fist
          }
        },
        // Fist nod 1 down
        {
          timeSec: 0.65,
          rotations: {
            ...REST_ARM_LEFT,
            rightUpperArm: armUp,
            rightLowerArm: armLo,
            rightHand: eulerToQuat(35, 0, 0),
            head: eulerToQuat(12, 0, 0),
            ...fist
          }
        },
        // Fist nod 1 up
        {
          timeSec: 0.95,
          rotations: {
            ...REST_ARM_LEFT,
            rightUpperArm: armUp,
            rightLowerArm: armLo,
            rightHand: eulerToQuat(-5, 0, 0),
            head: eulerToQuat(-2, 0, 0),
            ...fist
          }
        },
        // Fist nod 2 down
        {
          timeSec: 1.25,
          rotations: {
            ...REST_ARM_LEFT,
            rightUpperArm: armUp,
            rightLowerArm: armLo,
            rightHand: eulerToQuat(35, 0, 0),
            head: eulerToQuat(12, 0, 0),
            ...fist
          }
        },
        // Return to center
        {
          timeSec: 1.55,
          rotations: {
            ...REST_ARM_LEFT,
            rightUpperArm: armUp,
            rightLowerArm: armLo,
            rightHand: eulerToQuat(0, 0, 0),
            head: eulerToQuat(4, 0, 0),
            ...fist
          }
        },
        getCompleteRestFrame(1.95),
        getCompleteRestFrame(2.2)
      ]
    };
  },

  // --------------------------------------------------------------------------
  // 5. NO (Right index & middle fingers snap down against thumb twice)
  // --------------------------------------------------------------------------
  'no': () => {
    const armUp = eulerToQuat(-12, 45, 46);
    const armLo = eulerToQuat(38, 16, -70);
    return {
      clipId: 'isl_no',
      phrase: 'No',
      durationSec: 2.2,
      keyframes: [
        getCompleteRestFrame(0.0),
        // Rise with fingers open
        {
          timeSec: 0.35,
          rotations: {
            ...REST_ARM_LEFT,
            rightUpperArm: armUp,
            rightLowerArm: armLo,
            rightHand: eulerToQuat(0, 0, 0),
            head: eulerToQuat(0, 0, 0),
            ...getSnappingFingersRight(false)
          }
        },
        // Snap 1 closed
        {
          timeSec: 0.65,
          rotations: {
            ...REST_ARM_LEFT,
            rightUpperArm: armUp,
            rightLowerArm: armLo,
            rightHand: eulerToQuat(15, 0, 0),
            head: eulerToQuat(0, 8, 0),
            ...getSnappingFingersRight(true)
          }
        },
        // Open
        {
          timeSec: 0.95,
          rotations: {
            ...REST_ARM_LEFT,
            rightUpperArm: armUp,
            rightLowerArm: armLo,
            rightHand: eulerToQuat(0, 0, 0),
            head: eulerToQuat(0, -6, 0),
            ...getSnappingFingersRight(false)
          }
        },
        // Snap 2 closed
        {
          timeSec: 1.25,
          rotations: {
            ...REST_ARM_LEFT,
            rightUpperArm: armUp,
            rightLowerArm: armLo,
            rightHand: eulerToQuat(15, 0, 0),
            head: eulerToQuat(0, 8, 0),
            ...getSnappingFingersRight(true)
          }
        },
        // Hold
        {
          timeSec: 1.55,
          rotations: {
            ...REST_ARM_LEFT,
            rightUpperArm: armUp,
            rightLowerArm: armLo,
            rightHand: eulerToQuat(10, 0, 0),
            head: eulerToQuat(0, 0, 0),
            ...getSnappingFingersRight(true)
          }
        },
        getCompleteRestFrame(1.95),
        getCompleteRestFrame(2.2)
      ]
    };
  },

  // --------------------------------------------------------------------------
  // 6. GOOD (Two-handed: Right flat hand at mouth moves down to rest on left palm)
  // --------------------------------------------------------------------------
  'good': () => {
    const rFingers = getFlatOpenFingersRight();
    const lFingers = getFlatOpenFingersLeft();
    return {
      clipId: 'isl_good',
      phrase: 'Good',
      durationSec: 2.3,
      keyframes: [
        getCompleteRestFrame(0.0),
        // Right rises to mouth/chin; Left prepares horizontal base palm
        {
          timeSec: 0.4,
          rotations: {
            leftUpperArm: eulerToQuat(-10, -35, -45),
            leftLowerArm: eulerToQuat(38, -12, 70),
            leftHand: eulerToQuat(0, 0, -60), // Flat palm up
            rightUpperArm: eulerToQuat(-18, 50, 30),
            rightLowerArm: eulerToQuat(58, 12, -85),
            rightHand: eulerToQuat(-15, 0, 0), // At mouth
            ...lFingers,
            ...rFingers
          }
        },
        // Right hand moves down firmly and lands on open left palm!
        {
          timeSec: 1.0,
          rotations: {
            leftUpperArm: eulerToQuat(-10, -35, -45),
            leftLowerArm: eulerToQuat(38, -12, 70),
            leftHand: eulerToQuat(0, 0, -60),
            rightUpperArm: eulerToQuat(-12, 48, 48),
            rightLowerArm: eulerToQuat(40, 16, -74),
            rightHand: eulerToQuat(5, 0, 0), // Resting on left palm
            head: eulerToQuat(8, 0, 0),
            ...lFingers,
            ...rFingers
          }
        },
        // Hold affirmative contact
        {
          timeSec: 1.5,
          rotations: {
            leftUpperArm: eulerToQuat(-10, -35, -45),
            leftLowerArm: eulerToQuat(38, -12, 70),
            leftHand: eulerToQuat(0, 0, -60),
            rightUpperArm: eulerToQuat(-12, 48, 48),
            rightLowerArm: eulerToQuat(40, 16, -74),
            rightHand: eulerToQuat(5, 0, 0),
            head: eulerToQuat(4, 0, 0),
            ...lFingers,
            ...rFingers
          }
        },
        getCompleteRestFrame(2.0),
        getCompleteRestFrame(2.3)
      ]
    };
  },

  // --------------------------------------------------------------------------
  // 7. BAD (Right flat hand touches chin, flips palm down with outward thrust)
  // --------------------------------------------------------------------------
  'bad': () => {
    const fingers = getFlatOpenFingersRight();
    return {
      clipId: 'isl_bad',
      phrase: 'Bad',
      durationSec: 2.2,
      keyframes: [
        getCompleteRestFrame(0.0),
        // Touch chin
        {
          timeSec: 0.4,
          rotations: {
            ...REST_ARM_LEFT,
            rightUpperArm: eulerToQuat(-18, 50, 30),
            rightLowerArm: eulerToQuat(58, 12, -85),
            rightHand: eulerToQuat(-15, 0, 0),
            ...fingers
          }
        },
        // Flips palm sharply down and pushes outward
        {
          timeSec: 0.95,
          rotations: {
            ...REST_ARM_LEFT,
            rightUpperArm: eulerToQuat(-10, 25, 50),
            rightLowerArm: eulerToQuat(25, 18, -48),
            rightHand: eulerToQuat(30, 0, 80), // Flipped palm down
            head: eulerToQuat(0, -8, 0),
            ...fingers
          }
        },
        // Hold
        {
          timeSec: 1.45,
          rotations: {
            ...REST_ARM_LEFT,
            rightUpperArm: eulerToQuat(-10, 25, 50),
            rightLowerArm: eulerToQuat(25, 18, -48),
            rightHand: eulerToQuat(30, 0, 80),
            ...fingers
          }
        },
        getCompleteRestFrame(1.95),
        getCompleteRestFrame(2.2)
      ]
    };
  },

  // --------------------------------------------------------------------------
  // 8. WATER (W-hand shape taps index finger to corner of mouth twice)
  // --------------------------------------------------------------------------
  'water': () => {
    const wHand = getWHandFingersRight();
    const upMouth = eulerToQuat(-16, 52, 34);
    const loMouthTouch = eulerToQuat(58, 12, -86);
    const loMouthRetreat = eulerToQuat(52, 14, -80);
    return {
      clipId: 'isl_water',
      phrase: 'Water',
      durationSec: 2.3,
      keyframes: [
        getCompleteRestFrame(0.0),
        // Rise to mouth with W-hand shape
        {
          timeSec: 0.35,
          rotations: {
            ...REST_ARM_LEFT,
            rightUpperArm: upMouth,
            rightLowerArm: loMouthRetreat,
            rightHand: eulerToQuat(0, 10, 0),
            ...wHand
          }
        },
        // Tap 1 at corner of mouth
        {
          timeSec: 0.65,
          rotations: {
            ...REST_ARM_LEFT,
            rightUpperArm: upMouth,
            rightLowerArm: loMouthTouch,
            rightHand: eulerToQuat(-8, 12, 0),
            head: eulerToQuat(0, 4, 0),
            ...wHand
          }
        },
        // Retreat 3 cm
        {
          timeSec: 0.95,
          rotations: {
            ...REST_ARM_LEFT,
            rightUpperArm: upMouth,
            rightLowerArm: loMouthRetreat,
            rightHand: eulerToQuat(0, 10, 0),
            head: eulerToQuat(0, 0, 0),
            ...wHand
          }
        },
        // Tap 2 at corner of mouth
        {
          timeSec: 1.25,
          rotations: {
            ...REST_ARM_LEFT,
            rightUpperArm: upMouth,
            rightLowerArm: loMouthTouch,
            rightHand: eulerToQuat(-8, 12, 0),
            head: eulerToQuat(0, 4, 0),
            ...wHand
          }
        },
        // Pause at mouth
        {
          timeSec: 1.55,
          rotations: {
            ...REST_ARM_LEFT,
            rightUpperArm: upMouth,
            rightLowerArm: loMouthRetreat,
            rightHand: eulerToQuat(0, 10, 0),
            ...wHand
          }
        },
        // Recovery: Hand lowers smoothly back to side!
        getCompleteRestFrame(2.0),
        getCompleteRestFrame(2.3)
      ]
    };
  },

  // --------------------------------------------------------------------------
  // 9. FOOD (Flattened O-hand tapping fingertips to lips repeatedly)
  // --------------------------------------------------------------------------
  'food': () => {
    const oHand = getFlatOFingersRight();
    const upLips = eulerToQuat(-18, 50, 32);
    const loTouch = eulerToQuat(60, 10, -88);
    const loRetreat = eulerToQuat(54, 12, -82);
    return {
      clipId: 'isl_food',
      phrase: 'Food',
      durationSec: 2.2,
      keyframes: [
        getCompleteRestFrame(0.0),
        // Rise to lips with flattened O-hand
        {
          timeSec: 0.35,
          rotations: {
            ...REST_ARM_LEFT,
            rightUpperArm: upLips,
            rightLowerArm: loRetreat,
            rightHand: eulerToQuat(-10, 0, 0),
            ...oHand
          }
        },
        // Tap 1 at lips
        {
          timeSec: 0.65,
          rotations: {
            ...REST_ARM_LEFT,
            rightUpperArm: upLips,
            rightLowerArm: loTouch,
            rightHand: eulerToQuat(-15, 0, 0),
            ...oHand
          }
        },
        // Retreat
        {
          timeSec: 0.95,
          rotations: {
            ...REST_ARM_LEFT,
            rightUpperArm: upLips,
            rightLowerArm: loRetreat,
            rightHand: eulerToQuat(-10, 0, 0),
            ...oHand
          }
        },
        // Tap 2 at lips
        {
          timeSec: 1.25,
          rotations: {
            ...REST_ARM_LEFT,
            rightUpperArm: upLips,
            rightLowerArm: loTouch,
            rightHand: eulerToQuat(-15, 0, 0),
            ...oHand
          }
        },
        // Pause
        {
          timeSec: 1.5,
          rotations: {
            ...REST_ARM_LEFT,
            rightUpperArm: upLips,
            rightLowerArm: loRetreat,
            rightHand: eulerToQuat(-10, 0, 0),
            ...oHand
          }
        },
        // Recovery
        getCompleteRestFrame(1.9),
        getCompleteRestFrame(2.2)
      ]
    };
  },

  // --------------------------------------------------------------------------
  // 10. DOCTOR (Two-handed: Left forearm horizontal; Right bent-V fingers tap inner left wrist pulse twice)
  // --------------------------------------------------------------------------
  'doctor': () => {
    const bentV = getBentVFingersRight();
    const lPalm = getFlatOpenFingersLeft();
    return {
      clipId: 'isl_doctor',
      phrase: 'Doctor',
      durationSec: 2.4,
      keyframes: [
        getCompleteRestFrame(0.0),
        // Left arm extends horizontally across chest; Right bent-V approaches left wrist
        {
          timeSec: 0.4,
          rotations: {
            leftUpperArm: eulerToQuat(-12, -35, -42),
            leftLowerArm: eulerToQuat(40, -15, 68),
            leftHand: eulerToQuat(0, 0, -60), // Inner wrist exposed
            rightUpperArm: eulerToQuat(-14, 48, 44),
            rightLowerArm: eulerToQuat(44, 18, -75),
            rightHand: eulerToQuat(-10, 0, 0),
            ...lPalm,
            ...bentV
          }
        },
        // Pulse Tap 1 on inner left wrist
        {
          timeSec: 0.75,
          rotations: {
            leftUpperArm: eulerToQuat(-12, -35, -42),
            leftLowerArm: eulerToQuat(40, -15, 68),
            leftHand: eulerToQuat(0, 0, -60),
            rightUpperArm: eulerToQuat(-12, 52, 48),
            rightLowerArm: eulerToQuat(48, 16, -80),
            rightHand: eulerToQuat(-15, 0, 0),
            head: eulerToQuat(8, -6, 0), // Attentive look at wrist
            ...lPalm,
            ...bentV
          }
        },
        // Retreat 3 cm
        {
          timeSec: 1.05,
          rotations: {
            leftUpperArm: eulerToQuat(-12, -35, -42),
            leftLowerArm: eulerToQuat(40, -15, 68),
            leftHand: eulerToQuat(0, 0, -60),
            rightUpperArm: eulerToQuat(-14, 48, 44),
            rightLowerArm: eulerToQuat(44, 18, -75),
            rightHand: eulerToQuat(-10, 0, 0),
            ...lPalm,
            ...bentV
          }
        },
        // Pulse Tap 2 on inner left wrist
        {
          timeSec: 1.35,
          rotations: {
            leftUpperArm: eulerToQuat(-12, -35, -42),
            leftLowerArm: eulerToQuat(40, -15, 68),
            leftHand: eulerToQuat(0, 0, -60),
            rightUpperArm: eulerToQuat(-12, 52, 48),
            rightLowerArm: eulerToQuat(48, 16, -80),
            rightHand: eulerToQuat(-15, 0, 0),
            head: eulerToQuat(8, -6, 0),
            ...lPalm,
            ...bentV
          }
        },
        // Hold
        {
          timeSec: 1.65,
          rotations: {
            leftUpperArm: eulerToQuat(-12, -35, -42),
            leftLowerArm: eulerToQuat(40, -15, 68),
            leftHand: eulerToQuat(0, 0, -60),
            rightUpperArm: eulerToQuat(-14, 48, 44),
            rightLowerArm: eulerToQuat(44, 18, -75),
            rightHand: eulerToQuat(-10, 0, 0),
            ...lPalm,
            ...bentV
          }
        },
        getCompleteRestFrame(2.1),
        getCompleteRestFrame(2.4)
      ]
    };
  },

  // --------------------------------------------------------------------------
  // 11. HOSPITAL (Right index & middle fingers trace cross emblem on left upper shoulder)
  // --------------------------------------------------------------------------
  'hospital': () => {
    const vFingers = getPointingIndexFingersRight();
    return {
      clipId: 'isl_hospital',
      phrase: 'Hospital',
      durationSec: 2.3,
      keyframes: [
        getCompleteRestFrame(0.0),
        // Reaches across to left shoulder top
        {
          timeSec: 0.35,
          rotations: {
            ...REST_ARM_LEFT,
            rightUpperArm: eulerToQuat(-25, 55, 35),
            rightLowerArm: eulerToQuat(55, -15, -88),
            rightHand: eulerToQuat(0, 0, 0),
            ...vFingers
          }
        },
        // Vertical stroke down
        {
          timeSec: 0.75,
          rotations: {
            ...REST_ARM_LEFT,
            rightUpperArm: eulerToQuat(-18, 55, 42),
            rightLowerArm: eulerToQuat(48, -12, -80),
            rightHand: eulerToQuat(0, 0, 0),
            ...vFingers
          }
        },
        // Horizontal stroke left
        {
          timeSec: 1.05,
          rotations: {
            ...REST_ARM_LEFT,
            rightUpperArm: eulerToQuat(-22, 58, 38),
            rightLowerArm: eulerToQuat(52, -22, -85),
            rightHand: eulerToQuat(0, 0, 0),
            ...vFingers
          }
        },
        // Horizontal stroke right
        {
          timeSec: 1.45,
          rotations: {
            ...REST_ARM_LEFT,
            rightUpperArm: eulerToQuat(-22, 48, 38),
            rightLowerArm: eulerToQuat(52, -5, -85),
            rightHand: eulerToQuat(0, 0, 0),
            ...vFingers
          }
        },
        getCompleteRestFrame(2.0),
        getCompleteRestFrame(2.3)
      ]
    };
  },

  // --------------------------------------------------------------------------
  // 12. SCHOOL (Two-handed: Horizontal flat palms clapping together twice)
  // --------------------------------------------------------------------------
  'school': () => {
    const rOpen = getFlatOpenFingersRight();
    const lOpen = getFlatOpenFingersLeft();
    return {
      clipId: 'isl_school',
      phrase: 'School',
      durationSec: 2.3,
      keyframes: [
        getCompleteRestFrame(0.0),
        // Hands prepare apart in front of chest
        {
          timeSec: 0.35,
          rotations: {
            leftUpperArm: eulerToQuat(-10, -40, -45),
            leftLowerArm: eulerToQuat(35, -15, 68),
            leftHand: eulerToQuat(0, 0, -60), // Left palm up
            rightUpperArm: eulerToQuat(-15, 42, 38),
            rightLowerArm: eulerToQuat(48, 15, -75),
            rightHand: eulerToQuat(0, 0, 10), // Right palm down
            ...lOpen,
            ...rOpen
          }
        },
        // Clap 1
        {
          timeSec: 0.65,
          rotations: {
            leftUpperArm: eulerToQuat(-10, -35, -45),
            leftLowerArm: eulerToQuat(38, -12, 70),
            leftHand: eulerToQuat(0, 0, -60),
            rightUpperArm: eulerToQuat(-12, 48, 48),
            rightLowerArm: eulerToQuat(40, 16, -74),
            rightHand: eulerToQuat(0, 0, 10),
            head: eulerToQuat(6, 0, 0),
            ...lOpen,
            ...rOpen
          }
        },
        // Separate
        {
          timeSec: 0.95,
          rotations: {
            leftUpperArm: eulerToQuat(-10, -40, -45),
            leftLowerArm: eulerToQuat(35, -15, 68),
            leftHand: eulerToQuat(0, 0, -60),
            rightUpperArm: eulerToQuat(-15, 42, 38),
            rightLowerArm: eulerToQuat(48, 15, -75),
            rightHand: eulerToQuat(0, 0, 10),
            ...lOpen,
            ...rOpen
          }
        },
        // Clap 2
        {
          timeSec: 1.25,
          rotations: {
            leftUpperArm: eulerToQuat(-10, -35, -45),
            leftLowerArm: eulerToQuat(38, -12, 70),
            leftHand: eulerToQuat(0, 0, -60),
            rightUpperArm: eulerToQuat(-12, 48, 48),
            rightLowerArm: eulerToQuat(40, 16, -74),
            rightHand: eulerToQuat(0, 0, 10),
            head: eulerToQuat(6, 0, 0),
            ...lOpen,
            ...rOpen
          }
        },
        // Hold
        {
          timeSec: 1.55,
          rotations: {
            leftUpperArm: eulerToQuat(-10, -35, -45),
            leftLowerArm: eulerToQuat(38, -12, 70),
            leftHand: eulerToQuat(0, 0, -60),
            rightUpperArm: eulerToQuat(-12, 48, 48),
            rightLowerArm: eulerToQuat(40, 16, -74),
            rightHand: eulerToQuat(0, 0, 10),
            ...lOpen,
            ...rOpen
          }
        },
        getCompleteRestFrame(2.0),
        getCompleteRestFrame(2.3)
      ]
    };
  },

  // --------------------------------------------------------------------------
  // 13. HOME (Flat O-fingertips touch cheek near mouth, then move to touch near ear)
  // --------------------------------------------------------------------------
  'home': () => {
    const oHand = getFlatOFingersRight();
    return {
      clipId: 'isl_home',
      phrase: 'Home',
      durationSec: 2.2,
      keyframes: [
        getCompleteRestFrame(0.0),
        // Touch 1 near mouth/chin
        {
          timeSec: 0.45,
          rotations: {
            ...REST_ARM_LEFT,
            rightUpperArm: eulerToQuat(-18, 50, 32),
            rightLowerArm: eulerToQuat(58, 12, -85),
            rightHand: eulerToQuat(-10, 0, 0),
            ...oHand
          }
        },
        // Slight lift
        {
          timeSec: 0.85,
          rotations: {
            ...REST_ARM_LEFT,
            rightUpperArm: eulerToQuat(-12, 45, 30),
            rightLowerArm: eulerToQuat(52, 14, -80),
            rightHand: eulerToQuat(0, 0, 0),
            ...oHand
          }
        },
        // Touch 2 near ear/jaw
        {
          timeSec: 1.25,
          rotations: {
            ...REST_ARM_LEFT,
            rightUpperArm: eulerToQuat(-5, 42, 28),
            rightLowerArm: eulerToQuat(52, 15, -78),
            rightHand: eulerToQuat(-5, -15, 0),
            ...oHand
          }
        },
        getCompleteRestFrame(1.9),
        getCompleteRestFrame(2.2)
      ]
    };
  },

  // --------------------------------------------------------------------------
  // 14. FAMILY (Two-handed: Both F-shapes circle outward and meet)
  // --------------------------------------------------------------------------
  'family': () => {
    const rF = getPointingIndexFingersRight(); // F approximation
    return {
      clipId: 'isl_family',
      phrase: 'Family',
      durationSec: 2.3,
      keyframes: [
        getCompleteRestFrame(0.0),
        // Start together at chest center
        {
          timeSec: 0.35,
          rotations: {
            leftUpperArm: eulerToQuat(-10, -50, -50),
            leftLowerArm: eulerToQuat(38, -18, 72),
            leftHand: [0, 0, 0, 1],
            rightUpperArm: eulerToQuat(-10, 50, 50),
            rightLowerArm: eulerToQuat(38, 18, -72),
            rightHand: [0, 0, 0, 1],
            ...rF
          }
        },
        // Circle outward
        {
          timeSec: 0.85,
          rotations: {
            leftUpperArm: eulerToQuat(-15, -30, -40),
            leftLowerArm: eulerToQuat(30, -22, 60),
            leftHand: eulerToQuat(0, 15, 0),
            rightUpperArm: eulerToQuat(-15, 30, 40),
            rightLowerArm: eulerToQuat(30, 22, -60),
            rightHand: eulerToQuat(0, -15, 0),
            ...rF
          }
        },
        // Meet again in front
        {
          timeSec: 1.35,
          rotations: {
            leftUpperArm: eulerToQuat(-10, -50, -50),
            leftLowerArm: eulerToQuat(38, -18, 72),
            leftHand: [0, 0, 0, 1],
            rightUpperArm: eulerToQuat(-10, 50, 50),
            rightLowerArm: eulerToQuat(38, 18, -72),
            rightHand: [0, 0, 0, 1],
            ...rF
          }
        },
        getCompleteRestFrame(1.95),
        getCompleteRestFrame(2.3)
      ]
    };
  },

  // --------------------------------------------------------------------------
  // 15. FATHER (Thumb tip of open 5-hand resting against forehead twice)
  // --------------------------------------------------------------------------
  'father': () => {
    const open5 = getFlatOpenFingersRight();
    const upForehead = eulerToQuat(0, 48, 22);
    const loTouch = eulerToQuat(55, 12, -80);
    const loRetreat = eulerToQuat(48, 14, -75);
    return {
      clipId: 'isl_father',
      phrase: 'Father',
      durationSec: 2.2,
      keyframes: [
        getCompleteRestFrame(0.0),
        // Rise to forehead
        {
          timeSec: 0.35,
          rotations: {
            ...REST_ARM_LEFT,
            rightUpperArm: upForehead,
            rightLowerArm: loRetreat,
            rightHand: eulerToQuat(-10, 0, 0),
            ...open5
          }
        },
        // Tap 1 at forehead
        {
          timeSec: 0.65,
          rotations: {
            ...REST_ARM_LEFT,
            rightUpperArm: upForehead,
            rightLowerArm: loTouch,
            rightHand: eulerToQuat(-15, 0, 0),
            head: eulerToQuat(4, 0, 0),
            ...open5
          }
        },
        // Retreat
        {
          timeSec: 0.95,
          rotations: {
            ...REST_ARM_LEFT,
            rightUpperArm: upForehead,
            rightLowerArm: loRetreat,
            rightHand: eulerToQuat(-10, 0, 0),
            ...open5
          }
        },
        // Tap 2 at forehead
        {
          timeSec: 1.25,
          rotations: {
            ...REST_ARM_LEFT,
            rightUpperArm: upForehead,
            rightLowerArm: loTouch,
            rightHand: eulerToQuat(-15, 0, 0),
            head: eulerToQuat(4, 0, 0),
            ...open5
          }
        },
        // Hold
        {
          timeSec: 1.5,
          rotations: {
            ...REST_ARM_LEFT,
            rightUpperArm: upForehead,
            rightLowerArm: loRetreat,
            rightHand: eulerToQuat(-10, 0, 0),
            ...open5
          }
        },
        getCompleteRestFrame(1.9),
        getCompleteRestFrame(2.2)
      ]
    };
  },

  // --------------------------------------------------------------------------
  // 16. MOTHER (Thumb tip of open 5-hand resting against chin twice)
  // --------------------------------------------------------------------------
  'mother': () => {
    const open5 = getFlatOpenFingersRight();
    const upChin = eulerToQuat(-18, 50, 32);
    const loTouch = eulerToQuat(58, 12, -85);
    const loRetreat = eulerToQuat(50, 14, -80);
    return {
      clipId: 'isl_mother',
      phrase: 'Mother',
      durationSec: 2.2,
      keyframes: [
        getCompleteRestFrame(0.0),
        // Rise to chin
        {
          timeSec: 0.35,
          rotations: {
            ...REST_ARM_LEFT,
            rightUpperArm: upChin,
            rightLowerArm: loRetreat,
            rightHand: eulerToQuat(-10, 0, 0),
            ...open5
          }
        },
        // Tap 1 at chin
        {
          timeSec: 0.65,
          rotations: {
            ...REST_ARM_LEFT,
            rightUpperArm: upChin,
            rightLowerArm: loTouch,
            rightHand: eulerToQuat(-15, 0, 0),
            head: eulerToQuat(4, 0, 0),
            ...open5
          }
        },
        // Retreat
        {
          timeSec: 0.95,
          rotations: {
            ...REST_ARM_LEFT,
            rightUpperArm: upChin,
            rightLowerArm: loRetreat,
            rightHand: eulerToQuat(-10, 0, 0),
            ...open5
          }
        },
        // Tap 2 at chin
        {
          timeSec: 1.25,
          rotations: {
            ...REST_ARM_LEFT,
            rightUpperArm: upChin,
            rightLowerArm: loTouch,
            rightHand: eulerToQuat(-15, 0, 0),
            head: eulerToQuat(4, 0, 0),
            ...open5
          }
        },
        // Hold
        {
          timeSec: 1.5,
          rotations: {
            ...REST_ARM_LEFT,
            rightUpperArm: upChin,
            rightLowerArm: loRetreat,
            rightHand: eulerToQuat(-10, 0, 0),
            ...open5
          }
        },
        getCompleteRestFrame(1.9),
        getCompleteRestFrame(2.2)
      ]
    };
  },

  // --------------------------------------------------------------------------
  // 17. FRIEND (Interlocking index fingers hooked together)
  // --------------------------------------------------------------------------
  'friend': () => {
    const rIdx = getPointingIndexFingersRight();
    return {
      clipId: 'isl_friend',
      phrase: 'Friend',
      durationSec: 2.2,
      keyframes: [
        getCompleteRestFrame(0.0),
        // Hook 1: Right over left
        {
          timeSec: 0.45,
          rotations: {
            leftUpperArm: eulerToQuat(-12, -45, -45),
            leftLowerArm: eulerToQuat(42, -15, 72),
            leftHand: eulerToQuat(0, 0, 15),
            rightUpperArm: eulerToQuat(-12, 45, 45),
            rightLowerArm: eulerToQuat(42, 15, -72),
            rightHand: eulerToQuat(0, 0, -15),
            head: eulerToQuat(4, 0, 0),
            ...rIdx
          }
        },
        // Reverse hook: Left over right
        {
          timeSec: 1.15,
          rotations: {
            leftUpperArm: eulerToQuat(-12, -45, -45),
            leftLowerArm: eulerToQuat(42, -15, 72),
            leftHand: eulerToQuat(0, 0, -15),
            rightUpperArm: eulerToQuat(-12, 45, 45),
            rightLowerArm: eulerToQuat(42, 15, -72),
            rightHand: eulerToQuat(0, 0, 15),
            head: eulerToQuat(6, 0, 0),
            ...rIdx
          }
        },
        getCompleteRestFrame(1.9),
        getCompleteRestFrame(2.2)
      ]
    };
  },

  // --------------------------------------------------------------------------
  // 18. TIME (Right index finger tapping the dorsal surface of left wrist where watch rests)
  // --------------------------------------------------------------------------
  'time': () => {
    const idx = getPointingIndexFingersRight();
    const lFist = getFistFingersLeft(false);
    return {
      clipId: 'isl_time',
      phrase: 'Time',
      durationSec: 2.3,
      keyframes: [
        getCompleteRestFrame(0.0),
        // Left arm extends horizontally (watch face up); Right index finger approaches
        {
          timeSec: 0.35,
          rotations: {
            leftUpperArm: eulerToQuat(-12, -35, -45),
            leftLowerArm: eulerToQuat(40, -12, 70),
            leftHand: eulerToQuat(0, 0, 0), // Dorsal watch face up
            rightUpperArm: eulerToQuat(-15, 45, 45),
            rightLowerArm: eulerToQuat(45, 18, -75),
            rightHand: eulerToQuat(0, 0, 0),
            ...lFist,
            ...idx
          }
        },
        // Tap 1 on watch
        {
          timeSec: 0.65,
          rotations: {
            leftUpperArm: eulerToQuat(-12, -35, -45),
            leftLowerArm: eulerToQuat(40, -12, 70),
            leftHand: eulerToQuat(0, 0, 0),
            rightUpperArm: eulerToQuat(-12, 52, 48),
            rightLowerArm: eulerToQuat(48, 16, -82),
            rightHand: eulerToQuat(15, 0, 0),
            head: eulerToQuat(8, -4, 0),
            ...lFist,
            ...idx
          }
        },
        // Retreat
        {
          timeSec: 0.95,
          rotations: {
            leftUpperArm: eulerToQuat(-12, -35, -45),
            leftLowerArm: eulerToQuat(40, -12, 70),
            leftHand: eulerToQuat(0, 0, 0),
            rightUpperArm: eulerToQuat(-15, 45, 45),
            rightLowerArm: eulerToQuat(45, 18, -75),
            rightHand: eulerToQuat(0, 0, 0),
            ...lFist,
            ...idx
          }
        },
        // Tap 2 on watch
        {
          timeSec: 1.25,
          rotations: {
            leftUpperArm: eulerToQuat(-12, -35, -45),
            leftLowerArm: eulerToQuat(40, -12, 70),
            leftHand: eulerToQuat(0, 0, 0),
            rightUpperArm: eulerToQuat(-12, 52, 48),
            rightLowerArm: eulerToQuat(48, 16, -82),
            rightHand: eulerToQuat(15, 0, 0),
            head: eulerToQuat(8, -4, 0),
            ...lFist,
            ...idx
          }
        },
        // Hold
        {
          timeSec: 1.55,
          rotations: {
            leftUpperArm: eulerToQuat(-12, -35, -45),
            leftLowerArm: eulerToQuat(40, -12, 70),
            leftHand: eulerToQuat(0, 0, 0),
            rightUpperArm: eulerToQuat(-15, 45, 45),
            rightLowerArm: eulerToQuat(45, 18, -75),
            rightHand: eulerToQuat(0, 0, 0),
            ...lFist,
            ...idx
          }
        },
        getCompleteRestFrame(2.0),
        getCompleteRestFrame(2.3)
      ]
    };
  },

  // --------------------------------------------------------------------------
  // 19. TODAY (Both Y-hands dropped downward in signing space twice)
  // --------------------------------------------------------------------------
  'today': () => {
    return {
      clipId: 'isl_today',
      phrase: 'Today',
      durationSec: 2.2,
      keyframes: [
        getCompleteRestFrame(0.0),
        // Start high
        {
          timeSec: 0.35,
          rotations: {
            leftUpperArm: eulerToQuat(-15, -40, -40),
            leftLowerArm: eulerToQuat(42, -15, 65),
            rightUpperArm: eulerToQuat(-15, 40, 40),
            rightLowerArm: eulerToQuat(42, 15, -65)
          }
        },
        // Drop 1 down
        {
          timeSec: 0.65,
          rotations: {
            leftUpperArm: eulerToQuat(-5, -42, -55),
            leftLowerArm: eulerToQuat(30, -18, 55),
            rightUpperArm: eulerToQuat(-5, 42, 55),
            rightLowerArm: eulerToQuat(30, 18, -55),
            head: eulerToQuat(8, 0, 0)
          }
        },
        // Reset up
        {
          timeSec: 0.95,
          rotations: {
            leftUpperArm: eulerToQuat(-15, -40, -40),
            leftLowerArm: eulerToQuat(42, -15, 65),
            rightUpperArm: eulerToQuat(-15, 40, 40),
            rightLowerArm: eulerToQuat(42, 15, -65)
          }
        },
        // Drop 2 down
        {
          timeSec: 1.25,
          rotations: {
            leftUpperArm: eulerToQuat(-5, -42, -55),
            leftLowerArm: eulerToQuat(30, -18, 55),
            rightUpperArm: eulerToQuat(-5, 42, 55),
            rightLowerArm: eulerToQuat(30, 18, -55),
            head: eulerToQuat(8, 0, 0)
          }
        },
        getCompleteRestFrame(1.9),
        getCompleteRestFrame(2.2)
      ]
    };
  },

  // --------------------------------------------------------------------------
  // 20. TOMORROW (A-fist thumb resting on cheek rotated forward in arc)
  // --------------------------------------------------------------------------
  'tomorrow': () => {
    const fist = getFistFingersRight(true);
    return {
      clipId: 'isl_tomorrow',
      phrase: 'Tomorrow',
      durationSec: 2.2,
      keyframes: [
        getCompleteRestFrame(0.0),
        // Start on cheek
        {
          timeSec: 0.4,
          rotations: {
            ...REST_ARM_LEFT,
            rightUpperArm: eulerToQuat(-12, 45, 30),
            rightLowerArm: eulerToQuat(52, 14, -80),
            rightHand: eulerToQuat(0, -10, 0),
            ...fist
          }
        },
        // Arc forward
        {
          timeSec: 1.1,
          rotations: {
            ...REST_ARM_LEFT,
            rightUpperArm: eulerToQuat(-18, 30, 45),
            rightLowerArm: eulerToQuat(35, 18, -55),
            rightHand: eulerToQuat(15, 10, 0),
            head: eulerToQuat(5, 0, 0),
            ...fist
          }
        },
        getCompleteRestFrame(1.9),
        getCompleteRestFrame(2.2)
      ]
    };
  },

  // --------------------------------------------------------------------------
  // 21. YESTERDAY (A-fist thumb moving backward along jawline from chin to ear)
  // --------------------------------------------------------------------------
  'yesterday': () => {
    const fist = getFistFingersRight(true);
    return {
      clipId: 'isl_yesterday',
      phrase: 'Yesterday',
      durationSec: 2.2,
      keyframes: [
        getCompleteRestFrame(0.0),
        // Start at chin
        {
          timeSec: 0.4,
          rotations: {
            ...REST_ARM_LEFT,
            rightUpperArm: eulerToQuat(-18, 50, 32),
            rightLowerArm: eulerToQuat(58, 12, -85),
            rightHand: eulerToQuat(0, 0, 0),
            ...fist
          }
        },
        // Move backward along jaw to ear
        {
          timeSec: 1.1,
          rotations: {
            ...REST_ARM_LEFT,
            rightUpperArm: eulerToQuat(-5, 42, 28),
            rightLowerArm: eulerToQuat(52, 15, -78),
            rightHand: eulerToQuat(-10, -15, 0),
            head: eulerToQuat(0, 5, 0),
            ...fist
          }
        },
        getCompleteRestFrame(1.9),
        getCompleteRestFrame(2.2)
      ]
    };
  },

  // --------------------------------------------------------------------------
  // 22. WHERE (Index finger pointing upward shaking side-to-side gently)
  // --------------------------------------------------------------------------
  'where': () => {
    const idx = getPointingIndexFingersRight();
    const up = eulerToQuat(-12, 48, 45);
    const lo = eulerToQuat(42, 16, -72);
    return {
      clipId: 'isl_where',
      phrase: 'Where',
      durationSec: 2.2,
      keyframes: [
        getCompleteRestFrame(0.0),
        {
          timeSec: 0.35,
          rotations: {
            ...REST_ARM_LEFT,
            rightUpperArm: up,
            rightLowerArm: lo,
            rightHand: [0, 0, 0, 1],
            ...idx
          }
        },
        // Shake 1 left
        {
          timeSec: 0.65,
          rotations: {
            ...REST_ARM_LEFT,
            rightUpperArm: up,
            rightLowerArm: lo,
            rightHand: eulerToQuat(0, -18, 0),
            head: eulerToQuat(-4, -6, 0),
            ...idx
          }
        },
        // Shake 1 right
        {
          timeSec: 0.95,
          rotations: {
            ...REST_ARM_LEFT,
            rightUpperArm: up,
            rightLowerArm: lo,
            rightHand: eulerToQuat(0, 18, 0),
            head: eulerToQuat(-4, 6, 0),
            ...idx
          }
        },
        // Shake 2 left
        {
          timeSec: 1.25,
          rotations: {
            ...REST_ARM_LEFT,
            rightUpperArm: up,
            rightLowerArm: lo,
            rightHand: eulerToQuat(0, -18, 0),
            head: eulerToQuat(-4, -6, 0),
            ...idx
          }
        },
        // Center
        {
          timeSec: 1.5,
          rotations: {
            ...REST_ARM_LEFT,
            rightUpperArm: up,
            rightLowerArm: lo,
            rightHand: [0, 0, 0, 1],
            head: eulerToQuat(-2, 0, 0),
            ...idx
          }
        },
        getCompleteRestFrame(1.9),
        getCompleteRestFrame(2.2)
      ]
    };
  },

  // --------------------------------------------------------------------------
  // 23. WHAT (Two-handed: Open horizontal hands palms up shaking laterally)
  // --------------------------------------------------------------------------
  'what': () => {
    const rOpen = getFlatOpenFingersRight();
    const lOpen = getFlatOpenFingersLeft();
    return {
      clipId: 'isl_what',
      phrase: 'What',
      durationSec: 2.2,
      keyframes: [
        getCompleteRestFrame(0.0),
        // Palms up in front
        {
          timeSec: 0.35,
          rotations: {
            leftUpperArm: eulerToQuat(-10, -40, -48),
            leftLowerArm: eulerToQuat(36, -14, 65),
            leftHand: eulerToQuat(0, 0, -60), // Palm up
            rightUpperArm: eulerToQuat(-10, 40, 48),
            rightLowerArm: eulerToQuat(36, 14, -65),
            rightHand: eulerToQuat(0, 0, 60), // Palm up
            ...lOpen,
            ...rOpen
          }
        },
        // Shrug out
        {
          timeSec: 0.65,
          rotations: {
            leftUpperArm: eulerToQuat(-12, -30, -40),
            leftLowerArm: eulerToQuat(32, -18, 55),
            leftHand: eulerToQuat(0, 0, -60),
            rightUpperArm: eulerToQuat(-12, 30, 40),
            rightLowerArm: eulerToQuat(32, 18, -55),
            rightHand: eulerToQuat(0, 0, 60),
            head: eulerToQuat(-4, 0, 0),
            ...lOpen,
            ...rOpen
          }
        },
        // Shrug in
        {
          timeSec: 0.95,
          rotations: {
            leftUpperArm: eulerToQuat(-10, -45, -50),
            leftLowerArm: eulerToQuat(38, -12, 70),
            leftHand: eulerToQuat(0, 0, -60),
            rightUpperArm: eulerToQuat(-10, 45, 50),
            rightLowerArm: eulerToQuat(38, 12, -70),
            rightHand: eulerToQuat(0, 0, 60),
            ...lOpen,
            ...rOpen
          }
        },
        // Shrug out 2
        {
          timeSec: 1.25,
          rotations: {
            leftUpperArm: eulerToQuat(-12, -30, -40),
            leftLowerArm: eulerToQuat(32, -18, 55),
            leftHand: eulerToQuat(0, 0, -60),
            rightUpperArm: eulerToQuat(-12, 30, 40),
            rightLowerArm: eulerToQuat(32, 18, -55),
            rightHand: eulerToQuat(0, 0, 60),
            head: eulerToQuat(-4, 0, 0),
            ...lOpen,
            ...rOpen
          }
        },
        getCompleteRestFrame(1.9),
        getCompleteRestFrame(2.2)
      ]
    };
  },

  // --------------------------------------------------------------------------
  // 24. WHY (Fingers touching temple then pulling outward into Y-hand shape)
  // --------------------------------------------------------------------------
  'why': () => {
    return {
      clipId: 'isl_why',
      phrase: 'Why',
      durationSec: 2.2,
      keyframes: [
        getCompleteRestFrame(0.0),
        // Touch temple
        {
          timeSec: 0.4,
          rotations: {
            ...REST_ARM_LEFT,
            rightUpperArm: eulerToQuat(-5, 42, 28),
            rightLowerArm: eulerToQuat(50, 12, -75),
            rightHand: eulerToQuat(-10, 0, 0),
            ...getFlatOpenFingersRight()
          }
        },
        // Pull down/outward into Y-shape
        {
          timeSec: 1.1,
          rotations: {
            ...REST_ARM_LEFT,
            rightUpperArm: eulerToQuat(-10, 32, 45),
            rightLowerArm: eulerToQuat(35, 18, -55),
            rightHand: eulerToQuat(15, 0, 10),
            head: eulerToQuat(-5, 0, 0)
          }
        },
        getCompleteRestFrame(1.9),
        getCompleteRestFrame(2.2)
      ]
    };
  },

  // --------------------------------------------------------------------------
  // 25. HOW (Curved hands with backs of fingers together rotating outward so palms face upward)
  // --------------------------------------------------------------------------
  'how': () => {
    return {
      clipId: 'isl_how',
      phrase: 'How',
      durationSec: 2.2,
      keyframes: [
        getCompleteRestFrame(0.0),
        // Backs of hands together
        {
          timeSec: 0.4,
          rotations: {
            leftUpperArm: eulerToQuat(-10, -45, -48),
            leftLowerArm: eulerToQuat(38, -15, 70),
            leftHand: eulerToQuat(0, 0, 60), // Back outward
            rightUpperArm: eulerToQuat(-10, 45, 48),
            rightLowerArm: eulerToQuat(38, 15, -70),
            rightHand: eulerToQuat(0, 0, -60)
          }
        },
        // Rotate outward 180 deg to palms UP
        {
          timeSec: 1.1,
          rotations: {
            leftUpperArm: eulerToQuat(-10, -35, -45),
            leftLowerArm: eulerToQuat(35, -15, 65),
            leftHand: eulerToQuat(0, 0, -60), // Palm up
            rightUpperArm: eulerToQuat(-10, 35, 45),
            rightLowerArm: eulerToQuat(35, 15, -65),
            rightHand: eulerToQuat(0, 0, 60), // Palm up
            head: eulerToQuat(-4, 0, 0)
          }
        },
        getCompleteRestFrame(1.9),
        getCompleteRestFrame(2.2)
      ]
    };
  },

  // --------------------------------------------------------------------------
  // 26. NAME (H-hands tapping index and middle fingers crosswise twice)
  // --------------------------------------------------------------------------
  'name': () => {
    return {
      clipId: 'isl_name',
      phrase: 'Name',
      durationSec: 2.2,
      keyframes: [
        getCompleteRestFrame(0.0),
        {
          timeSec: 0.4,
          rotations: {
            leftUpperArm: eulerToQuat(-10, -42, -45),
            leftLowerArm: eulerToQuat(38, -12, 70),
            leftHand: [0, 0, 0, 1],
            rightUpperArm: eulerToQuat(-12, 45, 45),
            rightLowerArm: eulerToQuat(42, 16, -72),
            rightHand: [0, 0, 0, 1]
          }
        },
        // Tap 1
        {
          timeSec: 0.7,
          rotations: {
            leftUpperArm: eulerToQuat(-10, -42, -45),
            leftLowerArm: eulerToQuat(38, -12, 70),
            rightUpperArm: eulerToQuat(-10, 48, 48),
            rightLowerArm: eulerToQuat(45, 14, -76),
            rightHand: eulerToQuat(15, 0, 0)
          }
        },
        // Lift
        {
          timeSec: 0.95,
          rotations: {
            leftUpperArm: eulerToQuat(-10, -42, -45),
            leftLowerArm: eulerToQuat(38, -12, 70),
            rightUpperArm: eulerToQuat(-12, 45, 45),
            rightLowerArm: eulerToQuat(42, 16, -72)
          }
        },
        // Tap 2
        {
          timeSec: 1.25,
          rotations: {
            leftUpperArm: eulerToQuat(-10, -42, -45),
            leftLowerArm: eulerToQuat(38, -12, 70),
            rightUpperArm: eulerToQuat(-10, 48, 48),
            rightLowerArm: eulerToQuat(45, 14, -76),
            rightHand: eulerToQuat(15, 0, 0)
          }
        },
        getCompleteRestFrame(1.9),
        getCompleteRestFrame(2.2)
      ]
    };
  },

  // --------------------------------------------------------------------------
  // 27. SIGN (Both index fingers revolving in inward backwards circles around each other)
  // --------------------------------------------------------------------------
  'sign': () => {
    const idxR = getPointingIndexFingersRight();
    return {
      clipId: 'isl_sign',
      phrase: 'Sign',
      durationSec: 2.3,
      keyframes: [
        getCompleteRestFrame(0.0),
        // Cycle 1
        {
          timeSec: 0.4,
          rotations: {
            leftUpperArm: eulerToQuat(-12, -40, -45),
            leftLowerArm: eulerToQuat(40, -15, 70),
            rightUpperArm: eulerToQuat(-16, 40, 40),
            rightLowerArm: eulerToQuat(48, 15, -78),
            ...idxR
          }
        },
        // Swap
        {
          timeSec: 0.85,
          rotations: {
            leftUpperArm: eulerToQuat(-16, -40, -40),
            leftLowerArm: eulerToQuat(48, -15, 78),
            rightUpperArm: eulerToQuat(-12, 40, 45),
            rightLowerArm: eulerToQuat(40, 15, -70),
            ...idxR
          }
        },
        // Cycle 2
        {
          timeSec: 1.3,
          rotations: {
            leftUpperArm: eulerToQuat(-12, -40, -45),
            leftLowerArm: eulerToQuat(40, -15, 70),
            rightUpperArm: eulerToQuat(-16, 40, 40),
            rightLowerArm: eulerToQuat(48, 15, -78),
            ...idxR
          }
        },
        getCompleteRestFrame(1.95),
        getCompleteRestFrame(2.3)
      ]
    };
  },

  // --------------------------------------------------------------------------
  // 28. LANGUAGE (Both L-shapes starting together moving outward in gentle wave)
  // --------------------------------------------------------------------------
  'language': () => {
    return {
      clipId: 'isl_language',
      phrase: 'Language',
      durationSec: 2.2,
      keyframes: [
        getCompleteRestFrame(0.0),
        // Together at center
        {
          timeSec: 0.4,
          rotations: {
            leftUpperArm: eulerToQuat(-10, -50, -50),
            leftLowerArm: eulerToQuat(38, -15, 70),
            rightUpperArm: eulerToQuat(-10, 50, 50),
            rightLowerArm: eulerToQuat(38, 15, -70)
          }
        },
        // Waves outward
        {
          timeSec: 1.15,
          rotations: {
            leftUpperArm: eulerToQuat(-12, -25, -35),
            leftLowerArm: eulerToQuat(30, -20, 50),
            rightUpperArm: eulerToQuat(-12, 25, 35),
            rightLowerArm: eulerToQuat(30, 20, -50)
          }
        },
        getCompleteRestFrame(1.9),
        getCompleteRestFrame(2.2)
      ]
    };
  },

  // --------------------------------------------------------------------------
  // 29. DEAF (Index finger pointing first to ear then touching corner of mouth)
  // --------------------------------------------------------------------------
  'deaf': () => {
    const idx = getPointingIndexFingersRight();
    return {
      clipId: 'isl_deaf',
      phrase: 'Deaf',
      durationSec: 2.3,
      keyframes: [
        getCompleteRestFrame(0.0),
        // Point to right ear
        {
          timeSec: 0.45,
          rotations: {
            ...REST_ARM_LEFT,
            rightUpperArm: eulerToQuat(-5, 42, 28),
            rightLowerArm: eulerToQuat(52, 15, -78),
            rightHand: eulerToQuat(-10, -15, 0),
            head: eulerToQuat(0, 5, 0),
            ...idx
          }
        },
        // Point to corner of mouth
        {
          timeSec: 1.25,
          rotations: {
            ...REST_ARM_LEFT,
            rightUpperArm: eulerToQuat(-18, 50, 32),
            rightLowerArm: eulerToQuat(58, 12, -85),
            rightHand: eulerToQuat(-15, 0, 0),
            head: eulerToQuat(0, -4, 0),
            ...idx
          }
        },
        getCompleteRestFrame(1.95),
        getCompleteRestFrame(2.3)
      ]
    };
  },

  // --------------------------------------------------------------------------
  // 30. HEAR (Curved hand cupped behind right ear)
  // --------------------------------------------------------------------------
  'hear': () => {
    return {
      clipId: 'isl_hear',
      phrase: 'Hear',
      durationSec: 2.2,
      keyframes: [
        getCompleteRestFrame(0.0),
        {
          timeSec: 0.45,
          rotations: {
            ...REST_ARM_LEFT,
            rightUpperArm: eulerToQuat(-5, 42, 26),
            rightLowerArm: eulerToQuat(54, 12, -76),
            rightHand: eulerToQuat(0, -25, 0), // Cupped behind ear
            head: eulerToQuat(0, 10, 0)
          }
        },
        {
          timeSec: 1.45,
          rotations: {
            ...REST_ARM_LEFT,
            rightUpperArm: eulerToQuat(-5, 42, 26),
            rightLowerArm: eulerToQuat(54, 12, -76),
            rightHand: eulerToQuat(0, -25, 0),
            head: eulerToQuat(0, 10, 0)
          }
        },
        getCompleteRestFrame(1.9),
        getCompleteRestFrame(2.2)
      ]
    };
  },

  // --------------------------------------------------------------------------
  // 31. SPEAK (4-finger hand rolling forward repeatedly in front of mouth)
  // --------------------------------------------------------------------------
  'speak': () => {
    const fingers = getFlatOpenFingersRight();
    return {
      clipId: 'isl_speak',
      phrase: 'Speak',
      durationSec: 2.2,
      keyframes: [
        getCompleteRestFrame(0.0),
        // At mouth
        {
          timeSec: 0.35,
          rotations: {
            ...REST_ARM_LEFT,
            rightUpperArm: eulerToQuat(-18, 50, 32),
            rightLowerArm: eulerToQuat(58, 12, -85),
            rightHand: eulerToQuat(-15, 0, 0),
            ...fingers
          }
        },
        // Roll forward 1
        {
          timeSec: 0.7,
          rotations: {
            ...REST_ARM_LEFT,
            rightUpperArm: eulerToQuat(-15, 40, 38),
            rightLowerArm: eulerToQuat(45, 14, -70),
            rightHand: eulerToQuat(15, 0, 0),
            ...fingers
          }
        },
        // Roll 2
        {
          timeSec: 1.1,
          rotations: {
            ...REST_ARM_LEFT,
            rightUpperArm: eulerToQuat(-18, 50, 32),
            rightLowerArm: eulerToQuat(58, 12, -85),
            rightHand: eulerToQuat(-15, 0, 0),
            ...fingers
          }
        },
        // Roll forward 2
        {
          timeSec: 1.45,
          rotations: {
            ...REST_ARM_LEFT,
            rightUpperArm: eulerToQuat(-15, 40, 38),
            rightLowerArm: eulerToQuat(45, 14, -70),
            rightHand: eulerToQuat(15, 0, 0),
            ...fingers
          }
        },
        getCompleteRestFrame(1.9),
        getCompleteRestFrame(2.2)
      ]
    };
  },

  // --------------------------------------------------------------------------
  // 32. READ (Two-handed: Left flat palm page; Right V-fingers scan down)
  // --------------------------------------------------------------------------
  'read': () => {
    const lPage = getFlatOpenFingersLeft();
    return {
      clipId: 'isl_read',
      phrase: 'Read',
      durationSec: 2.3,
      keyframes: [
        getCompleteRestFrame(0.0),
        // Left holds page; Right V at top of page
        {
          timeSec: 0.4,
          rotations: {
            leftUpperArm: eulerToQuat(-12, -35, -45),
            leftLowerArm: eulerToQuat(40, -12, 70),
            leftHand: eulerToQuat(0, 0, -60), // Flat page up
            rightUpperArm: eulerToQuat(-14, 45, 42),
            rightLowerArm: eulerToQuat(48, 15, -78),
            rightHand: eulerToQuat(-15, 0, 0),
            head: eulerToQuat(10, 0, 0), // Looking at page
            ...lPage
          }
        },
        // Scan down across page
        {
          timeSec: 1.3,
          rotations: {
            leftUpperArm: eulerToQuat(-12, -35, -45),
            leftLowerArm: eulerToQuat(40, -12, 70),
            leftHand: eulerToQuat(0, 0, -60),
            rightUpperArm: eulerToQuat(-8, 48, 52),
            rightLowerArm: eulerToQuat(38, 18, -68),
            rightHand: eulerToQuat(15, 0, 0),
            head: eulerToQuat(14, 0, 0),
            ...lPage
          }
        },
        getCompleteRestFrame(1.95),
        getCompleteRestFrame(2.3)
      ]
    };
  },

  // --------------------------------------------------------------------------
  // 33. WRITE (Thumb & index pinching pen scribbling across flat left palm)
  // --------------------------------------------------------------------------
  'write': () => {
    const lPage = getFlatOpenFingersLeft();
    return {
      clipId: 'isl_write',
      phrase: 'Write',
      durationSec: 2.2,
      keyframes: [
        getCompleteRestFrame(0.0),
        {
          timeSec: 0.35,
          rotations: {
            leftUpperArm: eulerToQuat(-12, -35, -45),
            leftLowerArm: eulerToQuat(40, -12, 70),
            leftHand: eulerToQuat(0, 0, -60),
            rightUpperArm: eulerToQuat(-12, 48, 48),
            rightLowerArm: eulerToQuat(42, 16, -75),
            rightHand: eulerToQuat(0, 0, -10),
            head: eulerToQuat(10, 0, 0),
            ...lPage
          }
        },
        // Scribble left-right
        {
          timeSec: 0.7,
          rotations: {
            leftUpperArm: eulerToQuat(-12, -35, -45),
            leftLowerArm: eulerToQuat(40, -12, 70),
            rightUpperArm: eulerToQuat(-12, 50, 48),
            rightLowerArm: eulerToQuat(44, 16, -78),
            rightHand: eulerToQuat(0, 0, 15),
            ...lPage
          }
        },
        {
          timeSec: 1.05,
          rotations: {
            leftUpperArm: eulerToQuat(-12, -35, -45),
            leftLowerArm: eulerToQuat(40, -12, 70),
            rightUpperArm: eulerToQuat(-12, 46, 48),
            rightLowerArm: eulerToQuat(40, 16, -72),
            rightHand: eulerToQuat(0, 0, -15),
            ...lPage
          }
        },
        {
          timeSec: 1.4,
          rotations: {
            leftUpperArm: eulerToQuat(-12, -35, -45),
            leftLowerArm: eulerToQuat(40, -12, 70),
            rightUpperArm: eulerToQuat(-12, 50, 48),
            rightLowerArm: eulerToQuat(44, 16, -78),
            rightHand: eulerToQuat(0, 0, 15),
            ...lPage
          }
        },
        getCompleteRestFrame(1.9),
        getCompleteRestFrame(2.2)
      ]
    };
  },

  // --------------------------------------------------------------------------
  // 34. LEARN (Right fingertips taking knowledge from open left palm to forehead)
  // --------------------------------------------------------------------------
  'learn': () => {
    const lPage = getFlatOpenFingersLeft();
    return {
      clipId: 'isl_learn',
      phrase: 'Learn',
      durationSec: 2.3,
      keyframes: [
        getCompleteRestFrame(0.0),
        // Fingertips at open left palm
        {
          timeSec: 0.45,
          rotations: {
            leftUpperArm: eulerToQuat(-12, -35, -45),
            leftLowerArm: eulerToQuat(40, -12, 70),
            leftHand: eulerToQuat(0, 0, -60),
            rightUpperArm: eulerToQuat(-12, 48, 48),
            rightLowerArm: eulerToQuat(42, 16, -75),
            rightHand: eulerToQuat(15, 0, 0),
            head: eulerToQuat(8, 0, 0),
            ...lPage
          }
        },
        // Ascends up to forehead
        {
          timeSec: 1.25,
          rotations: {
            leftUpperArm: eulerToQuat(-12, -35, -45),
            leftLowerArm: eulerToQuat(40, -12, 70),
            rightUpperArm: eulerToQuat(0, 48, 22),
            rightLowerArm: eulerToQuat(55, 12, -80),
            rightHand: eulerToQuat(-15, 0, 0),
            head: eulerToQuat(4, 0, 0)
          }
        },
        getCompleteRestFrame(1.95),
        getCompleteRestFrame(2.3)
      ]
    };
  },

  // --------------------------------------------------------------------------
  // 35. WORK (Right fist tapping heel against base of left fist repeatedly)
  // --------------------------------------------------------------------------
  'work': () => {
    const rFist = getFistFingersRight();
    const lFist = getFistFingersLeft();
    return {
      clipId: 'isl_work',
      phrase: 'Work',
      durationSec: 2.2,
      keyframes: [
        getCompleteRestFrame(0.0),
        {
          timeSec: 0.35,
          rotations: {
            leftUpperArm: eulerToQuat(-10, -45, -48),
            leftLowerArm: eulerToQuat(38, -12, 70),
            rightUpperArm: eulerToQuat(-15, 42, 38),
            rightLowerArm: eulerToQuat(48, 15, -75),
            ...lFist,
            ...rFist
          }
        },
        // Tap 1
        {
          timeSec: 0.65,
          rotations: {
            leftUpperArm: eulerToQuat(-10, -42, -45),
            leftLowerArm: eulerToQuat(38, -12, 70),
            rightUpperArm: eulerToQuat(-10, 48, 48),
            rightLowerArm: eulerToQuat(42, 16, -75),
            ...lFist,
            ...rFist
          }
        },
        // Lift
        {
          timeSec: 0.95,
          rotations: {
            leftUpperArm: eulerToQuat(-10, -45, -48),
            leftLowerArm: eulerToQuat(38, -12, 70),
            rightUpperArm: eulerToQuat(-15, 42, 38),
            rightLowerArm: eulerToQuat(48, 15, -75),
            ...lFist,
            ...rFist
          }
        },
        // Tap 2
        {
          timeSec: 1.25,
          rotations: {
            leftUpperArm: eulerToQuat(-10, -42, -45),
            leftLowerArm: eulerToQuat(38, -12, 70),
            rightUpperArm: eulerToQuat(-10, 48, 48),
            rightLowerArm: eulerToQuat(42, 16, -75),
            ...lFist,
            ...rFist
          }
        },
        getCompleteRestFrame(1.9),
        getCompleteRestFrame(2.2)
      ]
    };
  },

  // --------------------------------------------------------------------------
  // 36. STOP (Two-handed: Left flat palm up; Right vertical open hand chops down & stops abruptly!)
  // --------------------------------------------------------------------------
  'stop': () => {
    const lPalm = getFlatOpenFingersLeft();
    const rHand = getFlatOpenFingersRight();
    return {
      clipId: 'isl_stop',
      phrase: 'Stop',
      durationSec: 2.2,
      keyframes: [
        getCompleteRestFrame(0.0),
        // Left horizontal platform palm-up; Right vertical hand held ready above
        {
          timeSec: 0.4,
          rotations: {
            leftUpperArm: eulerToQuat(-12, -35, -45),
            leftLowerArm: eulerToQuat(38, -12, 70),
            leftHand: eulerToQuat(0, 0, -60), // Palm up
            rightUpperArm: eulerToQuat(-20, 38, 30),
            rightLowerArm: eulerToQuat(52, 15, -80),
            rightHand: eulerToQuat(0, 60, 0), // Vertical chopping hand
            ...lPalm,
            ...rHand
          }
        },
        // CHOP! Right pinky edge strikes down firmly onto left palm center & HALTS ABRUPTLY
        {
          timeSec: 0.85,
          rotations: {
            leftUpperArm: eulerToQuat(-10, -35, -45),
            leftLowerArm: eulerToQuat(40, -12, 70),
            leftHand: eulerToQuat(0, 0, -60),
            rightUpperArm: eulerToQuat(-12, 48, 48),
            rightLowerArm: eulerToQuat(42, 16, -74),
            rightHand: eulerToQuat(0, 60, 0),
            head: eulerToQuat(8, 0, 0),
            ...lPalm,
            ...rHand
          }
        },
        // Firm hold of the stoppage
        {
          timeSec: 1.4,
          rotations: {
            leftUpperArm: eulerToQuat(-10, -35, -45),
            leftLowerArm: eulerToQuat(40, -12, 70),
            leftHand: eulerToQuat(0, 0, -60),
            rightUpperArm: eulerToQuat(-12, 48, 48),
            rightLowerArm: eulerToQuat(42, 16, -74),
            rightHand: eulerToQuat(0, 60, 0),
            head: eulerToQuat(6, 0, 0),
            ...lPalm,
            ...rHand
          }
        },
        getCompleteRestFrame(1.9),
        getCompleteRestFrame(2.2)
      ]
    };
  },

  // --------------------------------------------------------------------------
  // 37. GO (Both index fingers swing forward through signing space in unison)
  // --------------------------------------------------------------------------
  'go': () => {
    return {
      clipId: 'isl_go',
      phrase: 'Go',
      durationSec: 2.1,
      keyframes: [
        getCompleteRestFrame(0.0),
        // Ready at chest
        {
          timeSec: 0.35,
          rotations: {
            leftUpperArm: eulerToQuat(-10, -40, -48),
            leftLowerArm: eulerToQuat(40, -15, 68),
            rightUpperArm: eulerToQuat(-10, 40, 48),
            rightLowerArm: eulerToQuat(40, 15, -68)
          }
        },
        // Swing forward pointing outward
        {
          timeSec: 1.0,
          rotations: {
            leftUpperArm: eulerToQuat(-22, -25, -35),
            leftLowerArm: eulerToQuat(22, -18, 45),
            rightUpperArm: eulerToQuat(-22, 25, 35),
            rightLowerArm: eulerToQuat(22, 18, -45),
            head: eulerToQuat(6, 0, 0)
          }
        },
        getCompleteRestFrame(1.85),
        getCompleteRestFrame(2.1)
      ]
    };
  },

  // --------------------------------------------------------------------------
  // 38. COME (Both open palms gesturing inward toward torso inviting entry)
  // --------------------------------------------------------------------------
  'come': () => {
    const rOpen = getFlatOpenFingersRight();
    const lOpen = getFlatOpenFingersLeft();
    return {
      clipId: 'isl_come',
      phrase: 'Come',
      durationSec: 2.2,
      keyframes: [
        getCompleteRestFrame(0.0),
        // Out in front
        {
          timeSec: 0.35,
          rotations: {
            leftUpperArm: eulerToQuat(-20, -30, -38),
            leftLowerArm: eulerToQuat(25, -18, 50),
            leftHand: eulerToQuat(0, 0, -60),
            rightUpperArm: eulerToQuat(-20, 30, 38),
            rightLowerArm: eulerToQuat(25, 18, -50),
            rightHand: eulerToQuat(0, 0, 60),
            ...lOpen,
            ...rOpen
          }
        },
        // Beckon inward toward chest 1
        {
          timeSec: 0.8,
          rotations: {
            leftUpperArm: eulerToQuat(-10, -45, -48),
            leftLowerArm: eulerToQuat(45, -15, 75),
            leftHand: eulerToQuat(-25, 0, -60),
            rightUpperArm: eulerToQuat(-10, 45, 48),
            rightLowerArm: eulerToQuat(45, 15, -75),
            rightHand: eulerToQuat(-25, 0, 60),
            head: eulerToQuat(4, 0, 0),
            ...lOpen,
            ...rOpen
          }
        },
        // Beckon inward 2
        {
          timeSec: 1.4,
          rotations: {
            leftUpperArm: eulerToQuat(-10, -45, -48),
            leftLowerArm: eulerToQuat(45, -15, 75),
            leftHand: eulerToQuat(-25, 0, -60),
            rightUpperArm: eulerToQuat(-10, 45, 48),
            rightLowerArm: eulerToQuat(45, 15, -75),
            rightHand: eulerToQuat(-25, 0, 60),
            ...lOpen,
            ...rOpen
          }
        },
        getCompleteRestFrame(1.9),
        getCompleteRestFrame(2.2)
      ]
    };
  },

  // --------------------------------------------------------------------------
  // 39. SIT (Right curved fingers draping over horizontal left fingers)
  // --------------------------------------------------------------------------
  'sit': () => {
    return {
      clipId: 'isl_sit',
      phrase: 'Sit',
      durationSec: 2.2,
      keyframes: [
        getCompleteRestFrame(0.0),
        {
          timeSec: 0.4,
          rotations: {
            leftUpperArm: eulerToQuat(-10, -40, -45),
            leftLowerArm: eulerToQuat(38, -12, 70),
            rightUpperArm: eulerToQuat(-15, 42, 38),
            rightLowerArm: eulerToQuat(48, 15, -75)
          }
        },
        // Drape down
        {
          timeSec: 1.0,
          rotations: {
            leftUpperArm: eulerToQuat(-10, -40, -45),
            leftLowerArm: eulerToQuat(38, -12, 70),
            rightUpperArm: eulerToQuat(-10, 46, 48),
            rightLowerArm: eulerToQuat(42, 16, -74),
            rightHand: eulerToQuat(45, 0, 0),
            head: eulerToQuat(8, 0, 0)
          }
        },
        getCompleteRestFrame(1.9),
        getCompleteRestFrame(2.2)
      ]
    };
  },

  // --------------------------------------------------------------------------
  // 40. STAND (Right inverted V-fingers standing erect on flat upward left palm)
  // --------------------------------------------------------------------------
  'stand': () => {
    const lPalm = getFlatOpenFingersLeft();
    return {
      clipId: 'isl_stand',
      phrase: 'Stand',
      durationSec: 2.2,
      keyframes: [
        getCompleteRestFrame(0.0),
        {
          timeSec: 0.4,
          rotations: {
            leftUpperArm: eulerToQuat(-12, -35, -45),
            leftLowerArm: eulerToQuat(38, -12, 70),
            leftHand: eulerToQuat(0, 0, -60),
            rightUpperArm: eulerToQuat(-15, 45, 42),
            rightLowerArm: eulerToQuat(48, 15, -78),
            ...lPalm
          }
        },
        // Stand upright on palm
        {
          timeSec: 1.0,
          rotations: {
            leftUpperArm: eulerToQuat(-10, -35, -45),
            leftLowerArm: eulerToQuat(40, -12, 70),
            leftHand: eulerToQuat(0, 0, -60),
            rightUpperArm: eulerToQuat(-10, 48, 48),
            rightLowerArm: eulerToQuat(42, 16, -74),
            rightHand: eulerToQuat(60, 0, 0), // Standing down
            head: eulerToQuat(8, 0, 0),
            ...lPalm
          }
        },
        getCompleteRestFrame(1.9),
        getCompleteRestFrame(2.2)
      ]
    };
  },

  // --------------------------------------------------------------------------
  // 41. LOVE (Both arms crossed over chest hugging upper chest with affectionate tilt)
  // --------------------------------------------------------------------------
  'love': () => {
    const rFist = getFistFingersRight();
    const lFist = getFistFingersLeft();
    return {
      clipId: 'isl_love',
      phrase: 'Love',
      durationSec: 2.4,
      keyframes: [
        getCompleteRestFrame(0.0),
        // Arms cross over chest (right over left) hugging upper chest/heart
        {
          timeSec: 0.55,
          rotations: {
            leftUpperArm: eulerToQuat(-25, -55, -35),
            leftLowerArm: eulerToQuat(55, 20, 85),
            leftHand: eulerToQuat(0, 0, 0),
            rightUpperArm: eulerToQuat(-25, 55, 35),
            rightLowerArm: eulerToQuat(55, -20, -85),
            rightHand: eulerToQuat(0, 0, 0),
            head: eulerToQuat(4, 0, 8), // Affectionate head tilt
            ...lFist,
            ...rFist
          }
        },
        // Deepen embrace
        {
          timeSec: 1.35,
          rotations: {
            leftUpperArm: eulerToQuat(-28, -58, -32),
            leftLowerArm: eulerToQuat(58, 22, 88),
            leftHand: eulerToQuat(0, 0, 0),
            rightUpperArm: eulerToQuat(-28, 58, 32),
            rightLowerArm: eulerToQuat(58, -22, -88),
            rightHand: eulerToQuat(0, 0, 0),
            head: eulerToQuat(6, 0, 10),
            ...lFist,
            ...rFist
          }
        },
        getCompleteRestFrame(2.05),
        getCompleteRestFrame(2.4)
      ]
    };
  },

  // --------------------------------------------------------------------------
  // 42. HAPPY (Flat open hands patting upward against chest twice with upbeat cadence)
  // --------------------------------------------------------------------------
  'happy': () => {
    const rOpen = getFlatOpenFingersRight();
    const lOpen = getFlatOpenFingersLeft();
    return {
      clipId: 'isl_happy',
      phrase: 'Happy',
      durationSec: 2.2,
      keyframes: [
        getCompleteRestFrame(0.0),
        // Pat 1 up
        {
          timeSec: 0.4,
          rotations: {
            leftUpperArm: eulerToQuat(-15, -45, -40),
            leftLowerArm: eulerToQuat(45, -15, 75),
            rightUpperArm: eulerToQuat(-15, 45, 40),
            rightLowerArm: eulerToQuat(45, 15, -75),
            head: eulerToQuat(-4, 0, 0),
            ...lOpen,
            ...rOpen
          }
        },
        // Lower
        {
          timeSec: 0.75,
          rotations: {
            leftUpperArm: eulerToQuat(-8, -48, -52),
            leftLowerArm: eulerToQuat(35, -18, 65),
            rightUpperArm: eulerToQuat(-8, 48, 52),
            rightLowerArm: eulerToQuat(35, 18, -65),
            ...lOpen,
            ...rOpen
          }
        },
        // Pat 2 up
        {
          timeSec: 1.15,
          rotations: {
            leftUpperArm: eulerToQuat(-15, -45, -40),
            leftLowerArm: eulerToQuat(45, -15, 75),
            rightUpperArm: eulerToQuat(-15, 45, 40),
            rightLowerArm: eulerToQuat(45, 15, -75),
            head: eulerToQuat(-4, 0, 0),
            ...lOpen,
            ...rOpen
          }
        },
        getCompleteRestFrame(1.9),
        getCompleteRestFrame(2.2)
      ]
    };
  },

  // --------------------------------------------------------------------------
  // 43. SAD (Both open hands dropping slowly in front of face with drooping head)
  // --------------------------------------------------------------------------
  'sad': () => {
    return {
      clipId: 'isl_sad',
      phrase: 'Sad',
      durationSec: 2.3,
      keyframes: [
        getCompleteRestFrame(0.0),
        // Hands up near face
        {
          timeSec: 0.4,
          rotations: {
            leftUpperArm: eulerToQuat(-10, -45, -30),
            leftLowerArm: eulerToQuat(55, -12, 80),
            rightUpperArm: eulerToQuat(-10, 45, 30),
            rightLowerArm: eulerToQuat(55, 12, -80),
            head: eulerToQuat(4, 0, 0)
          }
        },
        // Drop slowly downward
        {
          timeSec: 1.35,
          rotations: {
            leftUpperArm: eulerToQuat(-5, -40, -55),
            leftLowerArm: eulerToQuat(25, -18, 50),
            rightUpperArm: eulerToQuat(-5, 40, 55),
            rightLowerArm: eulerToQuat(25, 18, -50),
            head: eulerToQuat(16, 0, 0) // Drooping head
          }
        },
        getCompleteRestFrame(1.95),
        getCompleteRestFrame(2.3)
      ]
    };
  },

  // --------------------------------------------------------------------------
  // 44. PAIN (Index fingers pointing toward each other twisting inwards)
  // --------------------------------------------------------------------------
  'pain': () => {
    const rIdx = getPointingIndexFingersRight();
    return {
      clipId: 'isl_pain',
      phrase: 'Pain',
      durationSec: 2.2,
      keyframes: [
        getCompleteRestFrame(0.0),
        // Pointing inward
        {
          timeSec: 0.4,
          rotations: {
            leftUpperArm: eulerToQuat(-12, -45, -45),
            leftLowerArm: eulerToQuat(42, -15, 72),
            rightUpperArm: eulerToQuat(-12, 45, 45),
            rightLowerArm: eulerToQuat(42, 15, -72),
            ...rIdx
          }
        },
        // Twist 1
        {
          timeSec: 0.75,
          rotations: {
            leftUpperArm: eulerToQuat(-12, -45, -45),
            leftLowerArm: eulerToQuat(42, -15, 72),
            leftHand: eulerToQuat(25, 0, 0),
            rightUpperArm: eulerToQuat(-12, 45, 45),
            rightLowerArm: eulerToQuat(42, 15, -72),
            rightHand: eulerToQuat(25, 0, 0),
            head: eulerToQuat(6, 0, -4),
            ...rIdx
          }
        },
        // Twist 2
        {
          timeSec: 1.25,
          rotations: {
            leftUpperArm: eulerToQuat(-12, -45, -45),
            leftLowerArm: eulerToQuat(42, -15, 72),
            leftHand: eulerToQuat(-20, 0, 0),
            rightUpperArm: eulerToQuat(-12, 45, 45),
            rightLowerArm: eulerToQuat(42, 15, -72),
            rightHand: eulerToQuat(-20, 0, 0),
            head: eulerToQuat(6, 0, 4),
            ...rIdx
          }
        },
        getCompleteRestFrame(1.9),
        getCompleteRestFrame(2.2)
      ]
    };
  },

  // --------------------------------------------------------------------------
  // 45. MEDICINE (Middle finger twisting inside open left palm grinding pestle)
  // --------------------------------------------------------------------------
  'medicine': () => {
    const lPalm = getFlatOpenFingersLeft();
    return {
      clipId: 'isl_medicine',
      phrase: 'Medicine',
      durationSec: 2.2,
      keyframes: [
        getCompleteRestFrame(0.0),
        {
          timeSec: 0.4,
          rotations: {
            leftUpperArm: eulerToQuat(-12, -35, -45),
            leftLowerArm: eulerToQuat(38, -12, 70),
            leftHand: eulerToQuat(0, 0, -60),
            rightUpperArm: eulerToQuat(-12, 48, 48),
            rightLowerArm: eulerToQuat(42, 16, -75),
            rightHand: eulerToQuat(15, 0, 0),
            ...lPalm
          }
        },
        // Twist 1
        {
          timeSec: 0.8,
          rotations: {
            leftUpperArm: eulerToQuat(-12, -35, -45),
            leftLowerArm: eulerToQuat(38, -12, 70),
            rightUpperArm: eulerToQuat(-12, 50, 48),
            rightLowerArm: eulerToQuat(44, 16, -78),
            rightHand: eulerToQuat(15, 35, 0),
            ...lPalm
          }
        },
        // Twist 2
        {
          timeSec: 1.25,
          rotations: {
            leftUpperArm: eulerToQuat(-12, -35, -45),
            leftLowerArm: eulerToQuat(38, -12, 70),
            rightUpperArm: eulerToQuat(-12, 46, 48),
            rightLowerArm: eulerToQuat(40, 16, -72),
            rightHand: eulerToQuat(15, -35, 0),
            ...lPalm
          }
        },
        getCompleteRestFrame(1.9),
        getCompleteRestFrame(2.2)
      ]
    };
  },

  // --------------------------------------------------------------------------
  // 46. EMERGENCY (E-hand shape shaken rapidly side-to-side in upper signing field)
  // --------------------------------------------------------------------------
  'emergency': () => {
    const armUp = eulerToQuat(-15, 45, 30);
    const armLo = eulerToQuat(48, 14, -72);
    return {
      clipId: 'isl_emergency',
      phrase: 'Emergency',
      durationSec: 2.2,
      keyframes: [
        getCompleteRestFrame(0.0),
        {
          timeSec: 0.35,
          rotations: {
            ...REST_ARM_LEFT,
            rightUpperArm: armUp,
            rightLowerArm: armLo,
            rightHand: [0, 0, 0, 1]
          }
        },
        {
          timeSec: 0.65,
          rotations: {
            ...REST_ARM_LEFT,
            rightUpperArm: armUp,
            rightLowerArm: armLo,
            rightHand: eulerToQuat(0, -20, 0)
          }
        },
        {
          timeSec: 0.95,
          rotations: {
            ...REST_ARM_LEFT,
            rightUpperArm: armUp,
            rightLowerArm: armLo,
            rightHand: eulerToQuat(0, 20, 0)
          }
        },
        {
          timeSec: 1.25,
          rotations: {
            ...REST_ARM_LEFT,
            rightUpperArm: armUp,
            rightLowerArm: armLo,
            rightHand: eulerToQuat(0, -20, 0)
          }
        },
        getCompleteRestFrame(1.9),
        getCompleteRestFrame(2.2)
      ]
    };
  },

  // --------------------------------------------------------------------------
  // 47. POLICE (C-hand shape held over left chest area indicating badge)
  // --------------------------------------------------------------------------
  'police': () => {
    return {
      clipId: 'isl_police',
      phrase: 'Police',
      durationSec: 2.2,
      keyframes: [
        getCompleteRestFrame(0.0),
        {
          timeSec: 0.45,
          rotations: {
            ...REST_ARM_LEFT,
            rightUpperArm: eulerToQuat(-18, 52, 40),
            rightLowerArm: eulerToQuat(52, -15, -82),
            rightHand: eulerToQuat(0, 0, 0)
          }
        },
        {
          timeSec: 1.4,
          rotations: {
            ...REST_ARM_LEFT,
            rightUpperArm: eulerToQuat(-18, 52, 40),
            rightLowerArm: eulerToQuat(52, -15, -82),
            rightHand: eulerToQuat(0, 0, 0)
          }
        },
        getCompleteRestFrame(1.9),
        getCompleteRestFrame(2.2)
      ]
    };
  },

  // --------------------------------------------------------------------------
  // 48. FIRE (Open wiggly fingers rising alternately upward mimicking flame tongues)
  // --------------------------------------------------------------------------
  'fire': () => {
    const rOpen = getFlatOpenFingersRight();
    const lOpen = getFlatOpenFingersLeft();
    return {
      clipId: 'isl_fire',
      phrase: 'Fire',
      durationSec: 2.3,
      keyframes: [
        getCompleteRestFrame(0.0),
        // Start low
        {
          timeSec: 0.35,
          rotations: {
            leftUpperArm: eulerToQuat(-8, -42, -50),
            leftLowerArm: eulerToQuat(30, -18, 55),
            rightUpperArm: eulerToQuat(-8, 42, 50),
            rightLowerArm: eulerToQuat(30, 18, -55),
            ...lOpen,
            ...rOpen
          }
        },
        // Rise and wiggle
        {
          timeSec: 0.8,
          rotations: {
            leftUpperArm: eulerToQuat(-18, -35, -35),
            leftLowerArm: eulerToQuat(48, -14, 75),
            rightUpperArm: eulerToQuat(-12, 38, 42),
            rightLowerArm: eulerToQuat(40, 16, -68),
            ...lOpen,
            ...rOpen
          }
        },
        {
          timeSec: 1.3,
          rotations: {
            leftUpperArm: eulerToQuat(-12, -38, -42),
            leftLowerArm: eulerToQuat(40, -16, 68),
            rightUpperArm: eulerToQuat(-18, 35, 35),
            rightLowerArm: eulerToQuat(48, 14, -75),
            ...lOpen,
            ...rOpen
          }
        },
        getCompleteRestFrame(1.95),
        getCompleteRestFrame(2.3)
      ]
    };
  },

  // --------------------------------------------------------------------------
  // 49. BATHROOM (T-hand shape shaking gently side-to-side)
  // --------------------------------------------------------------------------
  'bathroom': () => {
    const armUp = eulerToQuat(-12, 45, 45);
    const armLo = eulerToQuat(42, 16, -72);
    return {
      clipId: 'isl_bathroom',
      phrase: 'Bathroom',
      durationSec: 2.2,
      keyframes: [
        getCompleteRestFrame(0.0),
        {
          timeSec: 0.35,
          rotations: {
            ...REST_ARM_LEFT,
            rightUpperArm: armUp,
            rightLowerArm: armLo,
            rightHand: [0, 0, 0, 1]
          }
        },
        {
          timeSec: 0.65,
          rotations: {
            ...REST_ARM_LEFT,
            rightUpperArm: armUp,
            rightLowerArm: armLo,
            rightHand: eulerToQuat(0, -15, 0)
          }
        },
        {
          timeSec: 0.95,
          rotations: {
            ...REST_ARM_LEFT,
            rightUpperArm: armUp,
            rightLowerArm: armLo,
            rightHand: eulerToQuat(0, 15, 0)
          }
        },
        {
          timeSec: 1.25,
          rotations: {
            ...REST_ARM_LEFT,
            rightUpperArm: armUp,
            rightLowerArm: armLo,
            rightHand: eulerToQuat(0, -15, 0)
          }
        },
        getCompleteRestFrame(1.9),
        getCompleteRestFrame(2.2)
      ]
    };
  },

  // --------------------------------------------------------------------------
  // 50. GOOD MORNING (Right flat hand from chin sweeps upward in rising sun arc)
  // --------------------------------------------------------------------------
  'good morning': () => {
    const fingers = getFlatOpenFingersRight();
    return {
      clipId: 'isl_good_morning',
      phrase: 'Good Morning',
      durationSec: 2.4,
      keyframes: [
        getCompleteRestFrame(0.0),
        // At chin
        {
          timeSec: 0.4,
          rotations: {
            ...REST_ARM_LEFT,
            rightUpperArm: eulerToQuat(-18, 50, 32),
            rightLowerArm: eulerToQuat(58, 12, -85),
            rightHand: eulerToQuat(-15, 0, 0),
            head: eulerToQuat(4, 0, 0),
            ...fingers
          }
        },
        // Sweeps outward and upward in rising sun arc
        {
          timeSec: 1.2,
          rotations: {
            ...REST_ARM_LEFT,
            rightUpperArm: eulerToQuat(-22, 35, 18),
            rightLowerArm: eulerToQuat(35, 15, -45),
            rightHand: eulerToQuat(15, 0, 10),
            head: eulerToQuat(-5, 0, 0),
            ...fingers
          }
        },
        // Hold presentation
        {
          timeSec: 1.6,
          rotations: {
            ...REST_ARM_LEFT,
            rightUpperArm: eulerToQuat(-22, 35, 18),
            rightLowerArm: eulerToQuat(35, 15, -45),
            rightHand: eulerToQuat(15, 0, 10),
            ...fingers
          }
        },
        getCompleteRestFrame(2.1),
        getCompleteRestFrame(2.4)
      ]
    };
  },

  // --------------------------------------------------------------------------
  // 51. GOOD AFTERNOON (Right flat hand from mouth to downward horizontal midday posture)
  // --------------------------------------------------------------------------
  'good afternoon': () => {
    const fingers = getFlatOpenFingersRight();
    return {
      clipId: 'isl_good_afternoon',
      phrase: 'Good afternoon',
      durationSec: 2.3,
      keyframes: [
        getCompleteRestFrame(0.0),
        // At mouth
        {
          timeSec: 0.4,
          rotations: {
            ...REST_ARM_LEFT,
            rightUpperArm: eulerToQuat(-18, 50, 32),
            rightLowerArm: eulerToQuat(58, 12, -85),
            rightHand: eulerToQuat(-15, 0, 0),
            ...fingers
          }
        },
        // Sweeps forward to horizontal midday posture
        {
          timeSec: 1.15,
          rotations: {
            ...REST_ARM_LEFT,
            rightUpperArm: eulerToQuat(-10, 35, 45),
            rightLowerArm: eulerToQuat(32, 16, -55),
            rightHand: eulerToQuat(0, 0, 0),
            head: eulerToQuat(4, 0, 0),
            ...fingers
          }
        },
        {
          timeSec: 1.55,
          rotations: {
            ...REST_ARM_LEFT,
            rightUpperArm: eulerToQuat(-10, 35, 45),
            rightLowerArm: eulerToQuat(32, 16, -55),
            rightHand: eulerToQuat(0, 0, 0),
            ...fingers
          }
        },
        getCompleteRestFrame(2.0),
        getCompleteRestFrame(2.3)
      ]
    };
  },

  // --------------------------------------------------------------------------
  // 52. HOW ARE YOU (Curved palms chest-level rotating outward into open questioning handshape)
  // --------------------------------------------------------------------------
  'how are you': () => {
    const rOpen = getFlatOpenFingersRight();
    const lOpen = getFlatOpenFingersLeft();
    return {
      clipId: 'isl_how_are_you',
      phrase: 'How are you',
      durationSec: 2.4,
      keyframes: [
        getCompleteRestFrame(0.0),
        // Start chest-level curved inward
        {
          timeSec: 0.4,
          rotations: {
            leftUpperArm: eulerToQuat(-10, -45, -48),
            leftLowerArm: eulerToQuat(38, -15, 70),
            leftHand: eulerToQuat(0, 0, 45),
            rightUpperArm: eulerToQuat(-10, 45, 48),
            rightLowerArm: eulerToQuat(38, 15, -70),
            rightHand: eulerToQuat(0, 0, -45)
          }
        },
        // Rotate outward to open questioning palms
        {
          timeSec: 1.2,
          rotations: {
            leftUpperArm: eulerToQuat(-12, -32, -40),
            leftLowerArm: eulerToQuat(32, -18, 55),
            leftHand: eulerToQuat(0, 0, -60), // Palm up
            rightUpperArm: eulerToQuat(-12, 32, 40),
            rightLowerArm: eulerToQuat(32, 18, -55),
            rightHand: eulerToQuat(0, 0, 60), // Palm up
            head: eulerToQuat(-4, 0, 0),
            ...lOpen,
            ...rOpen
          }
        },
        // Hold
        {
          timeSec: 1.6,
          rotations: {
            leftUpperArm: eulerToQuat(-12, -32, -40),
            leftLowerArm: eulerToQuat(32, -18, 55),
            leftHand: eulerToQuat(0, 0, -60),
            rightUpperArm: eulerToQuat(-12, 32, 40),
            rightLowerArm: eulerToQuat(32, 18, -55),
            rightHand: eulerToQuat(0, 0, 60),
            ...lOpen,
            ...rOpen
          }
        },
        getCompleteRestFrame(2.1),
        getCompleteRestFrame(2.4)
      ]
    };
  },

  // --------------------------------------------------------------------------
  // 53. ALRIGHT (Open right flat palm brushing outward across body in affirmative sweep)
  // --------------------------------------------------------------------------
  'alright': () => {
    const fingers = getFlatOpenFingersRight();
    return {
      clipId: 'isl_alright',
      phrase: 'Alright',
      durationSec: 2.2,
      keyframes: [
        getCompleteRestFrame(0.0),
        // Crosses body
        {
          timeSec: 0.4,
          rotations: {
            ...REST_ARM_LEFT,
            rightUpperArm: eulerToQuat(-15, 55, 45),
            rightLowerArm: eulerToQuat(45, -10, -78),
            rightHand: eulerToQuat(0, 0, 0),
            ...fingers
          }
        },
        // Sweeps outward
        {
          timeSec: 1.15,
          rotations: {
            ...REST_ARM_LEFT,
            rightUpperArm: eulerToQuat(-12, 25, 45),
            rightLowerArm: eulerToQuat(32, 20, -50),
            rightHand: eulerToQuat(15, 0, 10),
            head: eulerToQuat(6, 0, 0),
            ...fingers
          }
        },
        getCompleteRestFrame(1.9),
        getCompleteRestFrame(2.2)
      ]
    };
  }
};

// Aliases for common variations
SIGN_GENERATORS['thankyou'] = SIGN_GENERATORS['thank you'];
SIGN_GENERATORS['howareyou'] = SIGN_GENERATORS['how are you'];
SIGN_GENERATORS['goodmorning'] = SIGN_GENERATORS['good morning'];
SIGN_GENERATORS['goodafternoon'] = SIGN_GENERATORS['good afternoon'];
SIGN_GENERATORS['eat'] = SIGN_GENERATORS['food'];
SIGN_GENERATORS['restroom'] = SIGN_GENERATORS['bathroom'];

/**
 * Checks whether a sign animation is defined in the vocabulary.
 */
export function hasSignClip(word: string): boolean {
  if (!word) return false;
  const key = word.trim().toLowerCase();
  return !!SIGN_GENERATORS[key];
}

/**
 * Returns the synthesized authentic ISL MotionClipData for a vocabulary word.
 */
export function getSignClip(word: string): MotionClipData | null {
  if (!word) return null;
  const key = word.trim().toLowerCase();
  const generator = SIGN_GENERATORS[key];
  if (!generator) return null;
  return generator();
}
