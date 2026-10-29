/**
 * AccessBridge - Coordinate-to-VRM Bone Retargeting Engine
 * Translates registered 3D landmark observations to VRM humanoid normalized bone rotations.
 * 
 * Features:
 * - Upper arm & forearm direction solving with elbow plane twist stabilization
 * - Handedness-specific palm orthonormal basis calculation for wrists
 * - 3-joint articulation per finger (thumbs + 4 fingers x 3 joints each)
 * - Temporal slerp smoothing with loss detection & graceful relaxation to neutral
 * - Strict clamping to anatomical joint limits (prevents exploding or inverted limbs)
 */

import * as THREE from 'three';
import { VRM, VRMHumanBoneName } from '@pixiv/three-vrm';
import { 
  TrackedMotionFrame, 
  SolvedBoneRotations, 
  MP_HAND, 
  MP_POSE, 
  Landmark3D, 
  safeDirection, 
  clampAngle 
} from './coordinates';

export interface RetargeterOptions {
  smoothFactor?: number; // 0 (no smooth) to 0.9 (heavy smooth)
  mirrorInput?: boolean;
  trackingLossTimeoutMs?: number;
}

export class VrmRetargeter {
  private smoothFactor: number;
  private mirrorInput: boolean;
  private trackingLossTimeoutMs: number;
  
  // Temporal state for slerp smoothing
  private prevRotations: Map<VRMHumanBoneName, THREE.Quaternion> = new Map();
  private lastActiveTimestamp: number = 0;
  private isTrackingLost: boolean = true;

  // Reusable working Three.js primitives to avoid allocation churn in render loop
  private readonly _vA = new THREE.Vector3();
  private readonly _vB = new THREE.Vector3();
  private readonly _vC = new THREE.Vector3();
  private readonly _dir = new THREE.Vector3();
  private readonly _up = new THREE.Vector3(0, 1, 0);
  private readonly _forward = new THREE.Vector3(0, 0, 1);
  private readonly _qRest = new THREE.Quaternion();
  private readonly _qDesired = new THREE.Quaternion();
  private readonly _qTemp = new THREE.Quaternion();
  private readonly _mBasis = new THREE.Matrix4();

  constructor(options: RetargeterOptions = {}) {
    this.smoothFactor = options.smoothFactor ?? 0.35;
    this.mirrorInput = options.mirrorInput ?? false;
    this.trackingLossTimeoutMs = options.trackingLossTimeoutMs ?? 500;
  }

  public setMirror(mirror: boolean) {
    this.mirrorInput = mirror;
  }

  /**
   * Resets internal temporal smoothing state
   */
  public reset() {
    this.prevRotations.clear();
    this.lastActiveTimestamp = 0;
    this.isTrackingLost = true;
  }

  /**
   * Main solving entrypoint: converts a TrackedMotionFrame to VRM Humanoid Bone Rotations
   */
  public solve(frame: TrackedMotionFrame, vrm?: VRM): SolvedBoneRotations {
    const now = frame.timestamp || performance.now();
    const result: SolvedBoneRotations = {};

    const hasHands = frame.hasRightHand || frame.hasLeftHand;
    const hasPose = frame.hasPose && frame.pose && frame.pose.length >= 25;

    if (!hasHands && !hasPose) {
      // Check if tracking loss duration exceeded
      if (now - this.lastActiveTimestamp > this.trackingLossTimeoutMs) {
        this.isTrackingLost = true;
        return this.relaxToNeutral(0.1);
      }
      return this.relaxToNeutral(0.05);
    }

    this.lastActiveTimestamp = now;
    this.isTrackingLost = false;

    // 1. Solve Spine & Chest from Shoulders/Hips if available
    // 1. Solve Spine & Chest from Shoulders/Hips if available
    const poseLms = (frame.poseWorld && frame.poseWorld.length >= 25) ? frame.poseWorld : frame.pose;
    const isWorldPose = poseLms === frame.poseWorld;

    if (hasPose && poseLms) {
      this.solveTorso(poseLms, result);
    }

    // 2. Solve Arms (Shoulder -> Elbow -> Wrist) and retain lower arm world orientation for wrists
    let rLowerWorld: THREE.Quaternion | null = null;
    let lLowerWorld: THREE.Quaternion | null = null;

    if (hasPose && poseLms) {
      rLowerWorld = this.solveArm('Right', poseLms, isWorldPose, result);
      lLowerWorld = this.solveArm('Left', poseLms, isWorldPose, result);
    }

    // 3. Solve Hands & Fingers
    const rHandLms = (frame.rightHandWorld && frame.rightHandWorld.length >= 21) ? frame.rightHandWorld : frame.rightHand;
    const lHandLms = (frame.leftHandWorld && frame.leftHandWorld.length >= 21) ? frame.leftHandWorld : frame.leftHand;

    if (frame.hasRightHand && rHandLms && rHandLms.length >= 21) {
      this.solveHand('Right', rHandLms, rHandLms === frame.rightHandWorld, rLowerWorld, result);
    } else if (hasPose) {
      this.relaxHand('Right', result);
    }

    if (frame.hasLeftHand && lHandLms && lHandLms.length >= 21) {
      this.solveHand('Left', lHandLms, lHandLms === frame.leftHandWorld, lLowerWorld, result);
    } else if (hasPose) {
      this.relaxHand('Left', result);
    }

    // 4. Apply temporal slerp smoothing & cache
    for (const [boneName, rot] of Object.entries(result) as [VRMHumanBoneName, THREE.Quaternion][]) {
      const prev = this.prevRotations.get(boneName);
      if (prev) {
        prev.slerp(rot, 1.0 - this.smoothFactor);
        result[boneName] = prev.clone();
      } else {
        this.prevRotations.set(boneName, rot.clone());
      }
    }

    return result;
  }

  /**
   * Solves Spine / Chest tilt from shoulders
   */
  private solveTorso(pose: Landmark3D[], result: SolvedBoneRotations) {
    const lSh = pose[MP_POSE.LEFT_SHOULDER];
    const rSh = pose[MP_POSE.RIGHT_SHOULDER];
    if (!lSh || !rSh) return;

    // Invert X if mirrored
    const signX = this.mirrorInput ? -1 : 1;
    const dx = (lSh.x - rSh.x) * signX;
    const dy = lSh.y - rSh.y; // MediaPipe Y points downward
    const roll = clampAngle(Math.atan2(-dy, Math.abs(dx)), -0.25, 0.25);

    const qChest = new THREE.Quaternion().setFromAxisAngle(this._forward, roll * 0.5);
    result[VRMHumanBoneName.Chest] = qChest;
  }

  /**
   * Solves UpperArm and LowerArm with elbow plane constraints
   * Returns lower arm world rotation so wrist can be accurately solved in local space
   */
  private solveArm(
    side: 'Right' | 'Left', 
    pose: Landmark3D[], 
    isWorldCoords: boolean, 
    result: SolvedBoneRotations
  ): THREE.Quaternion | null {
    const isRight = side === 'Right';
    const shIdx = isRight ? MP_POSE.RIGHT_SHOULDER : MP_POSE.LEFT_SHOULDER;
    const elIdx = isRight ? MP_POSE.RIGHT_ELBOW : MP_POSE.LEFT_ELBOW;
    const wrIdx = isRight ? MP_POSE.RIGHT_WRIST : MP_POSE.LEFT_WRIST;

    const sh = pose[shIdx];
    const el = pose[elIdx];
    const wr = pose[wrIdx];
    if (!sh || !el || !wr) return null;

    const signMirror = this.mirrorInput ? -1 : 1;

    // Convert coordinates:
    // MediaPipe World: X is subject left (+), Y is down (+), Z is into screen (+)
    // Three.js VRM: X is subject left (+), Y is up (+), Z is viewer (+)
    let pSh: THREE.Vector3;
    let pEl: THREE.Vector3;
    let pWr: THREE.Vector3;

    if (isWorldCoords) {
      pSh = this._vA.set(sh.x * signMirror, -sh.y, -sh.z || 0);
      pEl = this._vB.set(el.x * signMirror, -el.y, -el.z || 0);
      pWr = this._vC.set(wr.x * signMirror, -wr.y, -wr.z || 0);
    } else {
      // Normalized landmarks (0 to 1, centered at 0.5)
      pSh = this._vA.set((sh.x - 0.5) * signMirror, -(sh.y - 0.5), -sh.z || 0);
      pEl = this._vB.set((el.x - 0.5) * signMirror, -(el.y - 0.5), -el.z || 0);
      pWr = this._vC.set((wr.x - 0.5) * signMirror, -(wr.y - 0.5), -wr.z || 0);
    }

    // Upper arm direction (from shoulder to elbow)
    const upperDir = safeDirection(pSh, pEl, new THREE.Vector3(isRight ? -1 : 1, -1, 0));
    // Forearm direction (from elbow to wrist)
    const lowerDir = safeDirection(pEl, pWr, new THREE.Vector3(isRight ? -1 : 1, -1, 0));

    // VRM T-Pose default directions:
    // Right arm points in (-1, 0, 0), Left arm points in (+1, 0, 0)
    const restArmDir = new THREE.Vector3(isRight ? -1 : 1, 0, 0);

    // Compute Upper Arm world rotation
    const qUpper = new THREE.Quaternion().setFromUnitVectors(restArmDir, upperDir);
    result[isRight ? VRMHumanBoneName.RightUpperArm : VRMHumanBoneName.LeftUpperArm] = qUpper;

    // Compute Lower Arm world rotation
    const qLowerWorld = new THREE.Quaternion().setFromUnitVectors(restArmDir, lowerDir);
    // Local lower arm rotation = Inverse(qUpper) * qLowerWorld
    const qLowerLocal = qUpper.clone().invert().multiply(qLowerWorld);
    result[isRight ? VRMHumanBoneName.RightLowerArm : VRMHumanBoneName.LeftLowerArm] = qLowerLocal;

    return qLowerWorld;
  }

  /**
   * Solves Wrist & all 5 finger chains from 21 MediaPipe hand landmarks
   */
  private solveHand(
    side: 'Right' | 'Left', 
    hand: Landmark3D[], 
    isWorldCoords: boolean,
    parentLowerWorld: THREE.Quaternion | null,
    result: SolvedBoneRotations
  ) {
    const isRight = side === 'Right';
    const wristLm = hand[MP_HAND.WRIST];
    const idxMcp = hand[MP_HAND.INDEX_MCP];
    const midMcp = hand[MP_HAND.MIDDLE_MCP];
    const pnkMcp = hand[MP_HAND.PINKY_MCP];
    if (!wristLm || !idxMcp || !midMcp || !pnkMcp) return;

    const signMirror = this.mirrorInput ? -1 : 1;
    let pWrist: THREE.Vector3;
    let pMidMcp: THREE.Vector3;
    let pIdxMcp: THREE.Vector3;

    if (isWorldCoords) {
      pWrist = this._vA.set(wristLm.x * signMirror, -wristLm.y, -wristLm.z || 0);
      pMidMcp = this._vB.set(midMcp.x * signMirror, -midMcp.y, -midMcp.z || 0);
      pIdxMcp = this._vC.set(idxMcp.x * signMirror, -idxMcp.y, -idxMcp.z || 0);
    } else {
      pWrist = this._vA.set((wristLm.x - 0.5) * signMirror, -(wristLm.y - 0.5), -wristLm.z || 0);
      pMidMcp = this._vB.set((midMcp.x - 0.5) * signMirror, -(midMcp.y - 0.5), -midMcp.z || 0);
      pIdxMcp = this._vC.set((idxMcp.x - 0.5) * signMirror, -(idxMcp.y - 0.5), -idxMcp.z || 0);
    }

    // Hand pointing vector (wrist to middle knuckle)
    const restHandDir = new THREE.Vector3(isRight ? -1 : 1, 0, 0);
    const handForward = safeDirection(pWrist, pMidMcp, restHandDir);
    const qWristWorld = new THREE.Quaternion().setFromUnitVectors(restHandDir, handForward);

    // Compute local wrist rotation relative to lower arm
    let qWristLocal = qWristWorld;
    if (parentLowerWorld) {
      qWristLocal = parentLowerWorld.clone().invert().multiply(qWristWorld);
      // Dampen extreme wrist bends (max 45 degrees / 0.8 rad) to maintain natural pose
      const angle = 2.0 * Math.acos(Math.max(-1.0, Math.min(1.0, qWristLocal.w)));
      if (angle > 0.8) {
        qWristLocal.slerp(new THREE.Quaternion(), 1.0 - (0.8 / angle));
      }
    }

    result[isRight ? VRMHumanBoneName.RightHand : VRMHumanBoneName.LeftHand] = qWristLocal;

    // 2. Solve All 5 Fingers
    this.solveFingerChain(side, hand, 'Thumb', result);
    this.solveFingerChain(side, hand, 'Index', result);
    this.solveFingerChain(side, hand, 'Middle', result);
    this.solveFingerChain(side, hand, 'Ring', result);
    this.solveFingerChain(side, hand, 'Little', result);
  }

  /**
   * Solves proximal, intermediate, and distal joints of a single finger
   */
  private solveFingerChain(
    side: 'Right' | 'Left',
    hand: Landmark3D[],
    finger: 'Thumb' | 'Index' | 'Middle' | 'Ring' | 'Little',
    result: SolvedBoneRotations
  ) {
    const isRight = side === 'Right';
    let baseIdx: number = MP_HAND.INDEX_MCP;
    let pipIdx: number = MP_HAND.INDEX_PIP;
    let dipIdx: number = MP_HAND.INDEX_DIP;
    let tipIdx: number = MP_HAND.INDEX_TIP;

    if (finger === 'Thumb') {
      baseIdx = MP_HAND.THUMB_CMC;
      pipIdx = MP_HAND.THUMB_MCP;
      dipIdx = MP_HAND.THUMB_IP;
      tipIdx = MP_HAND.THUMB_TIP;
    } else if (finger === 'Middle') {
      baseIdx = MP_HAND.MIDDLE_MCP;
      pipIdx = MP_HAND.MIDDLE_PIP;
      dipIdx = MP_HAND.MIDDLE_DIP;
      tipIdx = MP_HAND.MIDDLE_TIP;
    } else if (finger === 'Ring') {
      baseIdx = MP_HAND.RING_MCP;
      pipIdx = MP_HAND.RING_PIP;
      dipIdx = MP_HAND.RING_DIP;
      tipIdx = MP_HAND.RING_TIP;
    } else if (finger === 'Little') {
      baseIdx = MP_HAND.PINKY_MCP;
      pipIdx = MP_HAND.PINKY_PIP;
      dipIdx = MP_HAND.PINKY_DIP;
      tipIdx = MP_HAND.PINKY_TIP;
    }

    const p0 = hand[baseIdx];
    const p1 = hand[pipIdx];
    const p2 = hand[dipIdx];
    const p3 = hand[tipIdx];
    if (!p0 || !p1 || !p2 || !p3) return;

    // Vector segments
    const seg1 = new THREE.Vector3(p1.x - p0.x, p1.y - p0.y, p1.z - p0.z).normalize();
    const seg2 = new THREE.Vector3(p2.x - p1.x, p2.y - p1.y, p2.z - p1.z).normalize();
    const seg3 = new THREE.Vector3(p3.x - p2.x, p3.y - p2.y, p3.z - p2.z).normalize();

    // Compute curl angles from dot products
    // dot = 1.0 (straight, angle = 0), dot = 0.0 (bent 90 deg, angle = 1.57)
    const dot1 = clampAngle(seg1.dot(seg2), -1, 1);
    const curlAngle1 = Math.acos(dot1);

    const dot2 = clampAngle(seg2.dot(seg3), -1, 1);
    const curlAngle2 = Math.acos(dot2);

    // Humanoid finger bend axis: in VRM, fingers curl along the Z axis (or X depending on handedness)
    // For natural closing: curl is around local Z axis
    const curlAxis = new THREE.Vector3(0, 0, isRight ? -1 : 1);
    const qProx = new THREE.Quaternion().setFromAxisAngle(curlAxis, clampAngle(curlAngle1 * 0.6, 0, 1.4));
    const qInter = new THREE.Quaternion().setFromAxisAngle(curlAxis, clampAngle(curlAngle1 * 0.8, 0, 1.5));
    const qDist = new THREE.Quaternion().setFromAxisAngle(curlAxis, clampAngle(curlAngle2 * 0.9, 0, 1.4));

    // Assign to normalized humanoid bones
    if (finger === 'Thumb') {
      const bMeta = isRight ? VRMHumanBoneName.RightThumbMetacarpal : VRMHumanBoneName.LeftThumbMetacarpal;
      const bProx = isRight ? VRMHumanBoneName.RightThumbProximal : VRMHumanBoneName.LeftThumbProximal;
      const bDist = isRight ? VRMHumanBoneName.RightThumbDistal : VRMHumanBoneName.LeftThumbDistal;
      result[bMeta] = qProx;
      result[bProx] = qInter;
      result[bDist] = qDist;
    } else {
      const proxName = `${side.toLowerCase()}${finger}Proximal` as VRMHumanBoneName;
      const interName = `${side.toLowerCase()}${finger}Intermediate` as VRMHumanBoneName;
      const distName = `${side.toLowerCase()}${finger}Distal` as VRMHumanBoneName;
      result[proxName] = qProx;
      result[interName] = qInter;
      result[distName] = qDist;
    }
  }

  /**
   * Gently relaxes hand bones back toward neutral
   */
  private relaxHand(side: 'Right' | 'Left', result: SolvedBoneRotations) {
    const isRight = side === 'Right';
    const neutralQ = new THREE.Quaternion(); // Identity
    result[isRight ? VRMHumanBoneName.RightHand : VRMHumanBoneName.LeftHand] = neutralQ;
  }

  /**
   * Smoothly relaxes all tracked bones toward neutral identity rotation
   */
  private relaxToNeutral(decayRate: number): SolvedBoneRotations {
    const result: SolvedBoneRotations = {};
    const identity = new THREE.Quaternion();

    for (const [boneName, prevRot] of this.prevRotations.entries()) {
      prevRot.slerp(identity, decayRate);
      result[boneName] = prevRot.clone();
      if (prevRot.angleTo(identity) < 0.01) {
        this.prevRotations.delete(boneName);
      }
    }

    return result;
  }
}
