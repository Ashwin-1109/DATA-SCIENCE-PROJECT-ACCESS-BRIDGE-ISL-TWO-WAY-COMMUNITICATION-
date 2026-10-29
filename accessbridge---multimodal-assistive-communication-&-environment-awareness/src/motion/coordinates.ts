/**
 * AccessBridge - Motion Coordinates & Frame Schema
 * Clean mathematical foundations for 3D landmarks, coordinate spaces, and bone orientations.
 */

import * as THREE from 'three';
import { VRMHumanBoneName } from '@pixiv/three-vrm';

export interface Landmark3D {
  x: number;
  y: number;
  z: number;
  visibility?: number;
}

export interface HandObservation {
  landmarks: Landmark3D[]; // 21 landmarks in image-normalized space (0 to 1)
  worldLandmarks?: Landmark3D[]; // In meters, hand-centered
  score: number;
  handedness: 'Right' | 'Left';
}

export interface PoseObservation {
  landmarks: Landmark3D[]; // 33 pose landmarks in image-normalized space
  worldLandmarks?: Landmark3D[]; // In meters, hip-centered
  score: number;
}

export interface TrackedMotionFrame {
  timestamp: number;
  hasRightHand: boolean;
  hasLeftHand: boolean;
  hasPose: boolean;
  rightHand: Landmark3D[] | null;
  leftHand: Landmark3D[] | null;
  pose: Landmark3D[] | null;
  rightHandWorld: Landmark3D[] | null;
  leftHandWorld: Landmark3D[] | null;
  poseWorld: Landmark3D[] | null;
  quality: {
    rightHandScore: number;
    leftHandScore: number;
    poseScore: number;
  };
}

export type SolvedBoneRotations = Partial<Record<VRMHumanBoneName, THREE.Quaternion>>;

// MediaPipe Landmark Index Constants
export const MP_HAND = {
  WRIST: 0,
  THUMB_CMC: 1,
  THUMB_MCP: 2,
  THUMB_IP: 3,
  THUMB_TIP: 4,
  INDEX_MCP: 5,
  INDEX_PIP: 6,
  INDEX_DIP: 7,
  INDEX_TIP: 8,
  MIDDLE_MCP: 9,
  MIDDLE_PIP: 10,
  MIDDLE_DIP: 11,
  MIDDLE_TIP: 12,
  RING_MCP: 13,
  RING_PIP: 14,
  RING_DIP: 15,
  RING_TIP: 16,
  PINKY_MCP: 17,
  PINKY_PIP: 18,
  PINKY_DIP: 19,
  PINKY_TIP: 20
} as const;

export const MP_POSE = {
  NOSE: 0,
  LEFT_EYE_INNER: 1,
  LEFT_EYE: 2,
  LEFT_EYE_OUTER: 3,
  RIGHT_EYE_INNER: 4,
  RIGHT_EYE: 5,
  RIGHT_EYE_OUTER: 6,
  LEFT_EAR: 7,
  RIGHT_EAR: 8,
  MOUTH_LEFT: 9,
  MOUTH_RIGHT: 10,
  LEFT_SHOULDER: 11,
  RIGHT_SHOULDER: 12,
  LEFT_ELBOW: 13,
  RIGHT_ELBOW: 14,
  LEFT_WRIST: 15,
  RIGHT_WRIST: 16,
  LEFT_PINKY: 17,
  RIGHT_PINKY: 18,
  LEFT_INDEX: 19,
  RIGHT_INDEX: 20,
  LEFT_THUMB: 21,
  RIGHT_THUMB: 22,
  LEFT_HIP: 23,
  RIGHT_HIP: 24
} as const;

/**
 * Utility: Converts landmark point to Three.js Vector3
 */
export function lmToVector3(lm: Landmark3D, scale: number = 1.0): THREE.Vector3 {
  return new THREE.Vector3(lm.x * scale, lm.y * scale, lm.z * scale);
}

/**
 * Utility: Safe normalized direction from point A to point B
 */
export function safeDirection(a: THREE.Vector3, b: THREE.Vector3, fallback: THREE.Vector3 = new THREE.Vector3(0, 1, 0)): THREE.Vector3 {
  const dir = new THREE.Vector3().subVectors(b, a);
  const len = dir.length();
  if (len < 1e-5) return fallback.clone();
  return dir.divideScalar(len);
}

/**
 * Utility: Clamps angle between min and max radians
 */
export function clampAngle(val: number, min: number, max: number): number {
  return Math.max(min, Math.min(max, val));
}
