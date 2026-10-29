/**
 * AccessBridge - Manual Alphabet Fingerspelling Engine & Sign Planner
 * Phase 6 Architecture:
 * - 26 ISL/ASL manual alphabet handshape poses (A-Z)
 * - 0.4s hold duration per letter with natural transitions
 * - Dynamic synthetic MotionClipData generator for any word/string
 * - Longest-match sign planning pipeline with automatic fingerspelling fallback
 * - Explicit badges: "Avatar clip" vs "Fingerspelled" (Never silently substitute "Hello")
 */

import * as THREE from 'three';
import { MotionClipData, MotionKeyframe } from './playbackController';
import { OFFICIAL_MOTION_CLIPS } from '../config/capabilities';

export type SignBadgeType = 'Avatar clip' | 'Fingerspelled';

export interface PlannedSignItem {
  id: string;
  text: string;
  type: 'clip' | 'fingerspell';
  badge: SignBadgeType;
  durationSec: number;
  reviewed: boolean;
  sourceClipPath?: string;
  syntheticClip?: MotionClipData;
}

// Helper: Convert degrees (Euler XYZ) to quaternion array [x, y, z, w]
function eulerToQuat(xDeg: number, yDeg: number, zDeg: number): [number, number, number, number] {
  const euler = new THREE.Euler(
    THREE.MathUtils.DEG2RAD * xDeg,
    THREE.MathUtils.DEG2RAD * yDeg,
    THREE.MathUtils.DEG2RAD * zDeg,
    'XYZ'
  );
  const q = new THREE.Quaternion().setFromEuler(euler);
  return [q.x, q.y, q.z, q.w];
}

// Standard base elevation arm pose for fingerspelling:
// Right arm in comfortable chest-level signing box (not temple/head)
// Left arm resting naturally downwards along torso
const BASE_ARM_ROTATIONS: Record<string, [number, number, number, number]> = {
  rightUpperArm: eulerToQuat(25, -20, -45),
  rightLowerArm: eulerToQuat(0, 80, -30),
  rightHand: [0.0, 0.0, 0.0, 1.0],
  leftUpperArm: [0.0, 0.0, 0.5736, 0.8192],
  leftLowerArm: [0.0, 0.0, 0.0, 1.0],
  leftHand: [0.0, 0.0, 0.0, 1.0]
};

// Finger joint helper in VRM normalized humanoid for Right Hand:
// Flexion / curl into palm is around local Z axis (negative angle)
// Finger abduction (spread) is around local Y axis
function fingerJoint(curlDeg: number, spreadDeg: number = 0): [number, number, number, number] {
  return eulerToQuat(0, spreadDeg, -curlDeg);
}

// Thumb joint helper in VRM normalized humanoid for Right Hand:
// Flexion / curl is negative Z, opposition across palm is positive Y
function thumbJoint(curlDeg: number, opposeDeg: number = 0): [number, number, number, number] {
  return eulerToQuat(0, opposeDeg, -curlDeg);
}

// Finger joint presets
const FINGER_OPEN: [number, number, number, number] = [0, 0, 0, 1];
const FINGER_BENT_MID: [number, number, number, number] = fingerJoint(45);
const FINGER_CLOSED_PROX: [number, number, number, number] = fingerJoint(75);
const FINGER_CLOSED_INTER: [number, number, number, number] = fingerJoint(80);
const FINGER_CLOSED_DIST: [number, number, number, number] = fingerJoint(70);

// Helper for curled finger
function curledFinger(spreadDeg: number = 0) {
  return {
    prox: fingerJoint(75, spreadDeg),
    inter: FINGER_CLOSED_INTER,
    dist: FINGER_CLOSED_DIST
  };
}

// Helper for straight finger
function straightFinger(spreadDeg: number = 0) {
  return {
    prox: fingerJoint(0, spreadDeg),
    inter: FINGER_OPEN,
    dist: FINGER_OPEN
  };
}

// Helper for half-curled / hook finger
function hookFinger(spreadDeg: number = 0) {
  return {
    prox: fingerJoint(35, spreadDeg),
    inter: fingerJoint(55),
    dist: fingerJoint(50)
  };
}

/**
 * 26 Alphabet Keyframe Handshape Definitions (A-Z)
 */
export const ALPHABET_HANDSHAPES: Record<string, Record<string, [number, number, number, number]>> = {
  // A: Fist with upright thumb along index side
  A: {
    ...BASE_ARM_ROTATIONS,
    rightThumbMetacarpal: [0, 0, 0, 1],
    rightThumbProximal: [0, 0, 0, 1],
    rightThumbDistal: [0, 0, 0, 1],
    rightIndexProximal: curledFinger().prox,
    rightIndexIntermediate: curledFinger().inter,
    rightIndexDistal: curledFinger().dist,
    rightMiddleProximal: curledFinger().prox,
    rightMiddleIntermediate: curledFinger().inter,
    rightMiddleDistal: curledFinger().dist,
    rightRingProximal: curledFinger().prox,
    rightRingIntermediate: curledFinger().inter,
    rightRingDistal: curledFinger().dist,
    rightLittleProximal: curledFinger().prox,
    rightLittleIntermediate: curledFinger().inter,
    rightLittleDistal: curledFinger().dist
  },

  // B: Open 4 fingers upright together, thumb folded across palm
  B: {
    ...BASE_ARM_ROTATIONS,
    rightThumbMetacarpal: thumbJoint(45, 30),
    rightThumbProximal: thumbJoint(25),
    rightThumbDistal: thumbJoint(15),
    rightIndexProximal: straightFinger(2).prox,
    rightIndexIntermediate: straightFinger().inter,
    rightIndexDistal: straightFinger().dist,
    rightMiddleProximal: straightFinger(0).prox,
    rightMiddleIntermediate: straightFinger().inter,
    rightMiddleDistal: straightFinger().dist,
    rightRingProximal: straightFinger(-2).prox,
    rightRingIntermediate: straightFinger().inter,
    rightRingDistal: straightFinger().dist,
    rightLittleProximal: straightFinger(-4).prox,
    rightLittleIntermediate: straightFinger().inter,
    rightLittleDistal: straightFinger().dist
  },

  // C: Curved fingers and thumb forming arc
  C: {
    ...BASE_ARM_ROTATIONS,
    rightThumbMetacarpal: thumbJoint(30, 15),
    rightThumbProximal: thumbJoint(20),
    rightThumbDistal: thumbJoint(15),
    rightIndexProximal: hookFinger(2).prox,
    rightIndexIntermediate: hookFinger().inter,
    rightIndexDistal: hookFinger().dist,
    rightMiddleProximal: hookFinger(0).prox,
    rightMiddleIntermediate: hookFinger().inter,
    rightMiddleDistal: hookFinger().dist,
    rightRingProximal: hookFinger(-2).prox,
    rightRingIntermediate: hookFinger().inter,
    rightRingDistal: hookFinger().dist,
    rightLittleProximal: hookFinger(-4).prox,
    rightLittleIntermediate: hookFinger().inter,
    rightLittleDistal: hookFinger().dist
  },

  // D: Index straight up, others touch thumb in circle
  D: {
    ...BASE_ARM_ROTATIONS,
    rightThumbMetacarpal: thumbJoint(40, 20),
    rightThumbProximal: thumbJoint(25),
    rightThumbDistal: thumbJoint(15),
    rightIndexProximal: straightFinger().prox,
    rightIndexIntermediate: straightFinger().inter,
    rightIndexDistal: straightFinger().dist,
    rightMiddleProximal: curledFinger().prox,
    rightMiddleIntermediate: curledFinger().inter,
    rightMiddleDistal: curledFinger().dist,
    rightRingProximal: curledFinger().prox,
    rightRingIntermediate: curledFinger().inter,
    rightRingDistal: curledFinger().dist,
    rightLittleProximal: curledFinger().prox,
    rightLittleIntermediate: curledFinger().inter,
    rightLittleDistal: curledFinger().dist
  },

  // E: Claw fingers curled tightly touching tucked thumb
  E: {
    ...BASE_ARM_ROTATIONS,
    rightThumbMetacarpal: thumbJoint(45, 25),
    rightThumbProximal: thumbJoint(30),
    rightThumbDistal: thumbJoint(20),
    rightIndexProximal: fingerJoint(55),
    rightIndexIntermediate: fingerJoint(75),
    rightIndexDistal: fingerJoint(60),
    rightMiddleProximal: fingerJoint(55),
    rightMiddleIntermediate: fingerJoint(75),
    rightMiddleDistal: fingerJoint(60),
    rightRingProximal: fingerJoint(55),
    rightRingIntermediate: fingerJoint(75),
    rightRingDistal: fingerJoint(60),
    rightLittleProximal: fingerJoint(55),
    rightLittleIntermediate: fingerJoint(75),
    rightLittleDistal: fingerJoint(60)
  },

  // F: Index touches thumb, middle/ring/little upright
  F: {
    ...BASE_ARM_ROTATIONS,
    rightThumbMetacarpal: thumbJoint(35, 15),
    rightThumbProximal: thumbJoint(20),
    rightThumbDistal: thumbJoint(15),
    rightIndexProximal: fingerJoint(50),
    rightIndexIntermediate: fingerJoint(60),
    rightIndexDistal: fingerJoint(40),
    rightMiddleProximal: straightFinger(3).prox,
    rightMiddleIntermediate: straightFinger().inter,
    rightMiddleDistal: straightFinger().dist,
    rightRingProximal: straightFinger(-1).prox,
    rightRingIntermediate: straightFinger().inter,
    rightRingDistal: straightFinger().dist,
    rightLittleProximal: straightFinger(-4).prox,
    rightLittleIntermediate: straightFinger().inter,
    rightLittleDistal: straightFinger().dist
  },

  // G: Index pointing forward, thumb parallel
  G: {
    ...BASE_ARM_ROTATIONS,
    rightHand: [0.15, 0.35, -0.20, 0.90],
    rightThumbMetacarpal: [0, 0, 0, 1],
    rightThumbProximal: [0, 0, 0, 1],
    rightThumbDistal: [0, 0, 0, 1],
    rightIndexProximal: straightFinger().prox,
    rightIndexIntermediate: straightFinger().inter,
    rightIndexDistal: straightFinger().dist,
    rightMiddleProximal: curledFinger().prox,
    rightMiddleIntermediate: curledFinger().inter,
    rightMiddleDistal: curledFinger().dist,
    rightRingProximal: curledFinger().prox,
    rightRingIntermediate: curledFinger().inter,
    rightRingDistal: curledFinger().dist,
    rightLittleProximal: curledFinger().prox,
    rightLittleIntermediate: curledFinger().inter,
    rightLittleDistal: curledFinger().dist
  },

  // H: Index and middle pointing together forward
  H: {
    ...BASE_ARM_ROTATIONS,
    rightHand: [0.15, 0.35, -0.20, 0.90],
    rightThumbMetacarpal: thumbJoint(20, 15),
    rightThumbProximal: thumbJoint(15),
    rightThumbDistal: [0, 0, 0, 1],
    rightIndexProximal: straightFinger(1).prox,
    rightIndexIntermediate: straightFinger().inter,
    rightIndexDistal: straightFinger().dist,
    rightMiddleProximal: straightFinger(-1).prox,
    rightMiddleIntermediate: straightFinger().inter,
    rightMiddleDistal: straightFinger().dist,
    rightRingProximal: curledFinger().prox,
    rightRingIntermediate: curledFinger().inter,
    rightRingDistal: curledFinger().dist,
    rightLittleProximal: curledFinger().prox,
    rightLittleIntermediate: curledFinger().inter,
    rightLittleDistal: curledFinger().dist
  },

  // I: Little finger straight up, fist for others
  I: {
    ...BASE_ARM_ROTATIONS,
    rightThumbMetacarpal: thumbJoint(40, 25),
    rightThumbProximal: thumbJoint(30),
    rightThumbDistal: thumbJoint(20),
    rightIndexProximal: curledFinger().prox,
    rightIndexIntermediate: curledFinger().inter,
    rightIndexDistal: curledFinger().dist,
    rightMiddleProximal: curledFinger().prox,
    rightMiddleIntermediate: curledFinger().inter,
    rightMiddleDistal: curledFinger().dist,
    rightRingProximal: curledFinger().prox,
    rightRingIntermediate: curledFinger().inter,
    rightRingDistal: curledFinger().dist,
    rightLittleProximal: straightFinger().prox,
    rightLittleIntermediate: straightFinger().inter,
    rightLittleDistal: straightFinger().dist
  },

  // J: Little finger up, wrist rotated
  J: {
    ...BASE_ARM_ROTATIONS,
    rightHand: [0.20, -0.15, -0.10, 0.96],
    rightThumbMetacarpal: thumbJoint(40, 25),
    rightThumbProximal: thumbJoint(30),
    rightThumbDistal: thumbJoint(20),
    rightIndexProximal: curledFinger().prox,
    rightIndexIntermediate: curledFinger().inter,
    rightIndexDistal: curledFinger().dist,
    rightMiddleProximal: curledFinger().prox,
    rightMiddleIntermediate: curledFinger().inter,
    rightMiddleDistal: curledFinger().dist,
    rightRingProximal: curledFinger().prox,
    rightRingIntermediate: curledFinger().inter,
    rightRingDistal: curledFinger().dist,
    rightLittleProximal: straightFinger().prox,
    rightLittleIntermediate: straightFinger().inter,
    rightLittleDistal: straightFinger().dist
  },

  // K: Index up, middle forward, thumb between
  K: {
    ...BASE_ARM_ROTATIONS,
    rightThumbMetacarpal: thumbJoint(20, -10),
    rightThumbProximal: [0, 0, 0, 1],
    rightThumbDistal: [0, 0, 0, 1],
    rightIndexProximal: straightFinger().prox,
    rightIndexIntermediate: straightFinger().inter,
    rightIndexDistal: straightFinger().dist,
    rightMiddleProximal: fingerJoint(45),
    rightMiddleIntermediate: straightFinger().inter,
    rightMiddleDistal: straightFinger().dist,
    rightRingProximal: curledFinger().prox,
    rightRingIntermediate: curledFinger().inter,
    rightRingDistal: curledFinger().dist,
    rightLittleProximal: curledFinger().prox,
    rightLittleIntermediate: curledFinger().inter,
    rightLittleDistal: curledFinger().dist
  },

  // L: L-shape: Index straight up, thumb out 90 deg
  L: {
    ...BASE_ARM_ROTATIONS,
    rightThumbMetacarpal: thumbJoint(0, -50),
    rightThumbProximal: [0, 0, 0, 1],
    rightThumbDistal: [0, 0, 0, 1],
    rightIndexProximal: straightFinger().prox,
    rightIndexIntermediate: straightFinger().inter,
    rightIndexDistal: straightFinger().dist,
    rightMiddleProximal: curledFinger().prox,
    rightMiddleIntermediate: curledFinger().inter,
    rightMiddleDistal: curledFinger().dist,
    rightRingProximal: curledFinger().prox,
    rightRingIntermediate: curledFinger().inter,
    rightRingDistal: curledFinger().dist,
    rightLittleProximal: curledFinger().prox,
    rightLittleIntermediate: curledFinger().inter,
    rightLittleDistal: curledFinger().dist
  },

  // M: Three fingers folded over thumb
  M: {
    ...BASE_ARM_ROTATIONS,
    rightThumbMetacarpal: thumbJoint(45, 25),
    rightThumbProximal: thumbJoint(30),
    rightThumbDistal: thumbJoint(20),
    rightIndexProximal: fingerJoint(65),
    rightIndexIntermediate: fingerJoint(75),
    rightIndexDistal: fingerJoint(70),
    rightMiddleProximal: fingerJoint(65),
    rightMiddleIntermediate: fingerJoint(75),
    rightMiddleDistal: fingerJoint(70),
    rightRingProximal: fingerJoint(65),
    rightRingIntermediate: fingerJoint(75),
    rightRingDistal: fingerJoint(70),
    rightLittleProximal: curledFinger().prox,
    rightLittleIntermediate: curledFinger().inter,
    rightLittleDistal: curledFinger().dist
  },

  // N: Two fingers folded over thumb
  N: {
    ...BASE_ARM_ROTATIONS,
    rightThumbMetacarpal: thumbJoint(45, 20),
    rightThumbProximal: thumbJoint(30),
    rightThumbDistal: thumbJoint(20),
    rightIndexProximal: fingerJoint(65),
    rightIndexIntermediate: fingerJoint(75),
    rightIndexDistal: fingerJoint(70),
    rightMiddleProximal: fingerJoint(65),
    rightMiddleIntermediate: fingerJoint(75),
    rightMiddleDistal: fingerJoint(70),
    rightRingProximal: curledFinger().prox,
    rightRingIntermediate: curledFinger().inter,
    rightRingDistal: curledFinger().dist,
    rightLittleProximal: curledFinger().prox,
    rightLittleIntermediate: curledFinger().inter,
    rightLittleDistal: curledFinger().dist
  },

  // O: All fingers curved to touch thumb in O
  O: {
    ...BASE_ARM_ROTATIONS,
    rightThumbMetacarpal: thumbJoint(35, 20),
    rightThumbProximal: thumbJoint(25),
    rightThumbDistal: thumbJoint(20),
    rightIndexProximal: hookFinger(2).prox,
    rightIndexIntermediate: hookFinger().inter,
    rightIndexDistal: hookFinger().dist,
    rightMiddleProximal: hookFinger(0).prox,
    rightMiddleIntermediate: hookFinger().inter,
    rightMiddleDistal: hookFinger().dist,
    rightRingProximal: hookFinger(-2).prox,
    rightRingIntermediate: hookFinger().inter,
    rightRingDistal: hookFinger(-2).dist,
    rightLittleProximal: hookFinger(-4).prox,
    rightLittleIntermediate: hookFinger().inter,
    rightLittleDistal: hookFinger().dist
  },

  // P: K-hand directed downward
  P: {
    ...BASE_ARM_ROTATIONS,
    rightHand: [0.45, 0.10, -0.10, 0.88],
    rightThumbMetacarpal: thumbJoint(20, -10),
    rightThumbProximal: [0, 0, 0, 1],
    rightThumbDistal: [0, 0, 0, 1],
    rightIndexProximal: straightFinger().prox,
    rightIndexIntermediate: straightFinger().inter,
    rightIndexDistal: straightFinger().dist,
    rightMiddleProximal: fingerJoint(45),
    rightMiddleIntermediate: straightFinger().inter,
    rightMiddleDistal: straightFinger().dist,
    rightRingProximal: curledFinger().prox,
    rightRingIntermediate: curledFinger().inter,
    rightRingDistal: curledFinger().dist,
    rightLittleProximal: curledFinger().prox,
    rightLittleIntermediate: curledFinger().inter,
    rightLittleDistal: curledFinger().dist
  },

  // Q: G-hand directed downward
  Q: {
    ...BASE_ARM_ROTATIONS,
    rightHand: [0.45, 0.10, -0.10, 0.88],
    rightThumbMetacarpal: thumbJoint(10, 0),
    rightThumbProximal: [0, 0, 0, 1],
    rightThumbDistal: [0, 0, 0, 1],
    rightIndexProximal: straightFinger().prox,
    rightIndexIntermediate: straightFinger().inter,
    rightIndexDistal: straightFinger().dist,
    rightMiddleProximal: curledFinger().prox,
    rightMiddleIntermediate: curledFinger().inter,
    rightMiddleDistal: curledFinger().dist,
    rightRingProximal: curledFinger().prox,
    rightRingIntermediate: curledFinger().inter,
    rightRingDistal: curledFinger().dist,
    rightLittleProximal: curledFinger().prox,
    rightLittleIntermediate: curledFinger().inter,
    rightLittleDistal: curledFinger().dist
  },

  // R: Index and middle crossed
  R: {
    ...BASE_ARM_ROTATIONS,
    rightThumbMetacarpal: thumbJoint(40, 25),
    rightThumbProximal: thumbJoint(30),
    rightThumbDistal: thumbJoint(20),
    rightIndexProximal: fingerJoint(0, -4),
    rightIndexIntermediate: straightFinger().inter,
    rightIndexDistal: straightFinger().dist,
    rightMiddleProximal: fingerJoint(0, 4),
    rightMiddleIntermediate: straightFinger().inter,
    rightMiddleDistal: straightFinger().dist,
    rightRingProximal: curledFinger().prox,
    rightRingIntermediate: curledFinger().inter,
    rightRingDistal: curledFinger().dist,
    rightLittleProximal: curledFinger().prox,
    rightLittleIntermediate: curledFinger().inter,
    rightLittleDistal: curledFinger().dist
  },

  // S: Fist with thumb folded over front of fingers
  S: {
    ...BASE_ARM_ROTATIONS,
    rightThumbMetacarpal: thumbJoint(35, 30),
    rightThumbProximal: thumbJoint(25),
    rightThumbDistal: thumbJoint(20),
    rightIndexProximal: curledFinger().prox,
    rightIndexIntermediate: curledFinger().inter,
    rightIndexDistal: curledFinger().dist,
    rightMiddleProximal: curledFinger().prox,
    rightMiddleIntermediate: curledFinger().inter,
    rightMiddleDistal: curledFinger().dist,
    rightRingProximal: curledFinger().prox,
    rightRingIntermediate: curledFinger().inter,
    rightRingDistal: curledFinger().dist,
    rightLittleProximal: curledFinger().prox,
    rightLittleIntermediate: curledFinger().inter,
    rightLittleDistal: curledFinger().dist
  },

  // T: Index folded over tucked thumb
  T: {
    ...BASE_ARM_ROTATIONS,
    rightThumbMetacarpal: thumbJoint(25, 15),
    rightThumbProximal: thumbJoint(15),
    rightThumbDistal: thumbJoint(10),
    rightIndexProximal: fingerJoint(65),
    rightIndexIntermediate: fingerJoint(75),
    rightIndexDistal: fingerJoint(70),
    rightMiddleProximal: curledFinger().prox,
    rightMiddleIntermediate: curledFinger().inter,
    rightMiddleDistal: curledFinger().dist,
    rightRingProximal: curledFinger().prox,
    rightRingIntermediate: curledFinger().inter,
    rightRingDistal: curledFinger().dist,
    rightLittleProximal: curledFinger().prox,
    rightLittleIntermediate: curledFinger().inter,
    rightLittleDistal: curledFinger().dist
  },

  // U: Index and middle straight up together
  U: {
    ...BASE_ARM_ROTATIONS,
    rightThumbMetacarpal: thumbJoint(40, 25),
    rightThumbProximal: thumbJoint(30),
    rightThumbDistal: thumbJoint(20),
    rightIndexProximal: straightFinger(1).prox,
    rightIndexIntermediate: straightFinger().inter,
    rightIndexDistal: straightFinger().dist,
    rightMiddleProximal: straightFinger(-1).prox,
    rightMiddleIntermediate: straightFinger().inter,
    rightMiddleDistal: straightFinger().dist,
    rightRingProximal: curledFinger().prox,
    rightRingIntermediate: curledFinger().inter,
    rightRingDistal: curledFinger().dist,
    rightLittleProximal: curledFinger().prox,
    rightLittleIntermediate: curledFinger().inter,
    rightLittleDistal: curledFinger().dist
  },

  // V: Peace sign (Index and middle spread)
  V: {
    ...BASE_ARM_ROTATIONS,
    rightThumbMetacarpal: thumbJoint(40, 25),
    rightThumbProximal: thumbJoint(30),
    rightThumbDistal: thumbJoint(20),
    rightIndexProximal: straightFinger(6).prox,
    rightIndexIntermediate: straightFinger().inter,
    rightIndexDistal: straightFinger().dist,
    rightMiddleProximal: straightFinger(-6).prox,
    rightMiddleIntermediate: straightFinger().inter,
    rightMiddleDistal: straightFinger().dist,
    rightRingProximal: curledFinger().prox,
    rightRingIntermediate: curledFinger().inter,
    rightRingDistal: curledFinger().dist,
    rightLittleProximal: curledFinger().prox,
    rightLittleIntermediate: curledFinger().inter,
    rightLittleDistal: curledFinger().dist
  },

  // W: Three fingers (Index, Middle, Ring) spread upright
  W: {
    ...BASE_ARM_ROTATIONS,
    rightThumbMetacarpal: thumbJoint(45, 25),
    rightThumbProximal: thumbJoint(30),
    rightThumbDistal: thumbJoint(20),
    rightIndexProximal: straightFinger(6).prox,
    rightIndexIntermediate: straightFinger().inter,
    rightIndexDistal: straightFinger().dist,
    rightMiddleProximal: straightFinger(0).prox,
    rightMiddleIntermediate: straightFinger().inter,
    rightMiddleDistal: straightFinger().dist,
    rightRingProximal: straightFinger(-6).prox,
    rightRingIntermediate: straightFinger().inter,
    rightRingDistal: straightFinger().dist,
    rightLittleProximal: curledFinger().prox,
    rightLittleIntermediate: curledFinger().inter,
    rightLittleDistal: curledFinger().dist
  },

  // X: Index finger hooked
  X: {
    ...BASE_ARM_ROTATIONS,
    rightThumbMetacarpal: thumbJoint(40, 25),
    rightThumbProximal: thumbJoint(30),
    rightThumbDistal: thumbJoint(20),
    rightIndexProximal: hookFinger().prox,
    rightIndexIntermediate: hookFinger().inter,
    rightIndexDistal: hookFinger().dist,
    rightMiddleProximal: curledFinger().prox,
    rightMiddleIntermediate: curledFinger().inter,
    rightMiddleDistal: curledFinger().dist,
    rightRingProximal: curledFinger().prox,
    rightRingIntermediate: curledFinger().inter,
    rightRingDistal: curledFinger().dist,
    rightLittleProximal: curledFinger().prox,
    rightLittleIntermediate: curledFinger().inter,
    rightLittleDistal: curledFinger().dist
  },

  // Y: Thumb and little finger extended ('hang loose')
  Y: {
    ...BASE_ARM_ROTATIONS,
    rightThumbMetacarpal: thumbJoint(0, -50),
    rightThumbProximal: [0, 0, 0, 1],
    rightThumbDistal: [0, 0, 0, 1],
    rightIndexProximal: curledFinger().prox,
    rightIndexIntermediate: curledFinger().inter,
    rightIndexDistal: curledFinger().dist,
    rightMiddleProximal: curledFinger().prox,
    rightMiddleIntermediate: curledFinger().inter,
    rightMiddleDistal: curledFinger().dist,
    rightRingProximal: curledFinger().prox,
    rightRingIntermediate: curledFinger().inter,
    rightRingDistal: curledFinger().dist,
    rightLittleProximal: straightFinger(-8).prox,
    rightLittleIntermediate: straightFinger().inter,
    rightLittleDistal: straightFinger().dist
  },

  // Z: Index finger extended forward
  Z: {
    ...BASE_ARM_ROTATIONS,
    rightHand: [0.20, 0.25, -0.15, 0.93],
    rightThumbMetacarpal: thumbJoint(40, 25),
    rightThumbProximal: thumbJoint(30),
    rightThumbDistal: thumbJoint(20),
    rightIndexProximal: straightFinger().prox,
    rightIndexIntermediate: straightFinger().inter,
    rightIndexDistal: straightFinger().dist,
    rightMiddleProximal: curledFinger().prox,
    rightMiddleIntermediate: curledFinger().inter,
    rightMiddleDistal: curledFinger().dist,
    rightRingProximal: curledFinger().prox,
    rightRingIntermediate: curledFinger().inter,
    rightRingDistal: curledFinger().dist,
    rightLittleProximal: curledFinger().prox,
    rightLittleIntermediate: curledFinger().inter,
    rightLittleDistal: curledFinger().dist
  }
};

/**
 * Generate a synthetic MotionClipData for fingerspelling a word or text
 * Each letter is held for 0.4s with smooth transitions
 */
export function generateFingerspellingClip(text: string): MotionClipData {
  const letters = text.toUpperCase().replace(/[^A-Z]/g, '').split('');
  if (letters.length === 0) {
    letters.push('A');
  }

  const HOLD_DURATION_SEC = 0.35;
  const TRANSITION_DURATION_SEC = 0.12;
  const keyframes: MotionKeyframe[] = [];

  const REST_POSE: Partial<Record<string, [number, number, number, number]>> = {
    rightUpperArm: [0.0, 0.0, -0.5736, 0.8192],
    leftUpperArm: [0.0, 0.0, 0.5736, 0.8192],
    rightLowerArm: [0, 0, 0, 1],
    leftLowerArm: [0, 0, 0, 1],
    rightHand: [0, 0, 0, 1],
    leftHand: [0, 0, 0, 1],
    rightThumbProximal: [0, 0, 0, 1],
    rightThumbDistal: [0, 0, 0, 1],
    rightIndexProximal: [0, 0, 0, 1],
    rightMiddleProximal: [0, 0, 0, 1],
    rightRingProximal: [0, 0, 0, 1],
    rightLittleProximal: [0, 0, 0, 1]
  };

  // 1. Initial true rest pose at t = 0 (arms down along sides)
  keyframes.push({
    timeSec: 0,
    rotations: { ...REST_POSE }
  });

  // 2. Smooth rise to chest signing space
  let currentTime = 0.3;
  const firstShape = ALPHABET_HANDSHAPES[letters[0]] || ALPHABET_HANDSHAPES['A'];
  keyframes.push({
    timeSec: currentTime,
    rotations: { ...firstShape }
  });

  letters.forEach((char, index) => {
    const shape = ALPHABET_HANDSHAPES[char] || ALPHABET_HANDSHAPES['A'];

    // Transition into letter
    if (index > 0) {
      currentTime += TRANSITION_DURATION_SEC;
      keyframes.push({
        timeSec: Number(currentTime.toFixed(3)),
        rotations: { ...shape }
      });
    }

    // Hold shape for clarity
    currentTime += HOLD_DURATION_SEC;
    keyframes.push({
      timeSec: Number(currentTime.toFixed(3)),
      rotations: { ...shape }
    });
  });

  // 3. Smooth recovery lowering arm back down to rest!
  currentTime += 0.35;
  keyframes.push({
    timeSec: Number(currentTime.toFixed(3)),
    rotations: { ...REST_POSE }
  });

  return {
    clipId: `fingerspell_${text.toLowerCase()}_${Date.now()}`,
    phrase: text,
    durationSec: Number(currentTime.toFixed(2)),
    keyframes
  };
}

/**
 * Known motion clips in the library (5 real checkpoints)
 */
const KNOWN_PHRASES: { phrase: string; key: keyof typeof OFFICIAL_MOTION_CLIPS }[] = [
  { phrase: 'good morning', key: 'Good Morning' },
  { phrase: 'good afternoon', key: 'Good afternoon' },
  { phrase: 'how are you', key: 'How are you' },
  { phrase: 'alright', key: 'Alright' },
  { phrase: 'hello', key: 'Hello' }
];

/**
 * Longest-match phrase planner with fingerspelling fallback
 * Returns an ordered array of PlannedSignItem
 */
export function planSigns(input: string): PlannedSignItem[] {
  const text = input.trim().toLowerCase();
  if (!text) return [];

  const results: PlannedSignItem[] = [];
  let remaining = text;

  while (remaining.length > 0) {
    remaining = remaining.trim();
    if (!remaining) break;

    // Check longest phrase match first
    let matched = false;
    for (const { phrase, key } of KNOWN_PHRASES) {
      if (remaining === phrase || remaining.startsWith(phrase + ' ')) {
        const meta = OFFICIAL_MOTION_CLIPS[key];
        results.push({
          id: `clip_${key}_${results.length}`,
          text: key,
          type: 'clip',
          badge: 'Avatar clip',
          durationSec: meta ? meta.durationSec : 1.5,
          reviewed: false, // Honest flag: pending review by ISL signer
          sourceClipPath: meta ? meta.filePath : undefined
        });

        remaining = remaining.slice(phrase.length).trim();
        matched = true;
        break;
      }
    }

    if (matched) continue;

    // Next token: single word
    const nextSpace = remaining.indexOf(' ');
    const word = nextSpace === -1 ? remaining : remaining.slice(0, nextSpace);
    remaining = nextSpace === -1 ? '' : remaining.slice(nextSpace).trim();

    if (word) {
      // Check single word against known clips
      const directMatch = KNOWN_PHRASES.find(k => k.phrase === word);
      if (directMatch) {
        const meta = OFFICIAL_MOTION_CLIPS[directMatch.key];
        results.push({
          id: `clip_${directMatch.key}_${results.length}`,
          text: directMatch.key,
          type: 'clip',
          badge: 'Avatar clip',
          durationSec: meta ? meta.durationSec : 1.5,
          reviewed: false,
          sourceClipPath: meta ? meta.filePath : undefined
        });
      } else {
        // Unsupported word -> FINGERSPELL!
        const synthetic = generateFingerspellingClip(word);
        results.push({
          id: `fs_${word}_${results.length}`,
          text: word.toUpperCase(),
          type: 'fingerspell',
          badge: 'Fingerspelled',
          durationSec: synthetic.durationSec,
          reviewed: true,
          syntheticClip: synthetic
        });
      }
    }
  }

  return results;
}
