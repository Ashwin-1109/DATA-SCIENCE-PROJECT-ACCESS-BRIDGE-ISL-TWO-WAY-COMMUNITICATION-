/**
 * AccessBridge - Sign Recognition Inference Pipeline
 * Truthfulness Policy:
 * Communicates with backend FastAPI /api/sign/predict for authentic model checkpoint inference.
 * Rejects low-quality inputs and never fabricates trigonometric predictions.
 */

import { FrameLandmarks, SignPredictionResult, LandmarkPoint } from '../types';
import { INCLUDE_50_CLASSES } from '../data/include50';

export const REJECTION_CONFIDENCE_THRESHOLD = 0.65;
export const TARGET_SEQUENCE_LENGTH = 32;

export interface ExtractionQuality {
  totalFrames: number;
  usableFrames: number;
  rightHandPresentRatio: number;
  leftHandPresentRatio: number;
  posePresentRatio: number;
  qualityPassed: boolean;
  failureReason?: string;
}

export class SignService {
  /**
   * Assesses quality of recorded landmark frames before running inference
   */
  public assessQuality(frames: FrameLandmarks[]): ExtractionQuality {
    const totalFrames = frames.length;
    if (totalFrames < 8) {
      return {
        totalFrames,
        usableFrames: totalFrames,
        rightHandPresentRatio: 0,
        leftHandPresentRatio: 0,
        posePresentRatio: 0,
        qualityPassed: false,
        failureReason: `Too few frames recorded (${totalFrames} frames). A sign gesture requires at least 8-15 frames.`
      };
    }

    let rightHandFrames = 0;
    let leftHandFrames = 0;
    let poseFrames = 0;

    frames.forEach(f => {
      if (f.hasRightHand && f.rightHand && f.rightHand.length >= 21) rightHandFrames++;
      if (f.hasLeftHand && f.leftHand && f.leftHand.length >= 21) leftHandFrames++;
      if (f.hasPose && f.pose && f.pose.length >= 4) poseFrames++;
    });

    const rightRatio = rightHandFrames / totalFrames;
    const leftRatio = leftHandFrames / totalFrames;
    const poseRatio = poseFrames / totalFrames;

    if (rightRatio < 0.15 && leftRatio < 0.15) {
      return {
        totalFrames,
        usableFrames: 0,
        rightHandPresentRatio: rightRatio,
        leftHandPresentRatio: leftRatio,
        posePresentRatio: poseRatio,
        qualityPassed: false,
        failureReason: 'No hands detected during recording span. Position your upper body and hands clearly in the camera frame.'
      };
    }

    return {
      totalFrames,
      usableFrames: Math.max(rightHandFrames, leftHandFrames),
      rightHandPresentRatio: rightRatio,
      leftHandPresentRatio: leftRatio,
      posePresentRatio: poseRatio,
      qualityPassed: true
    };
  }

  /**
   * Resamples frames uniformly to fixed target length (32 frames)
   */
  public resampleFrames(frames: FrameLandmarks[], targetLength: number = TARGET_SEQUENCE_LENGTH): FrameLandmarks[] {
    if (frames.length === targetLength) return frames;
    if (frames.length === 0) return [];

    const resampled: FrameLandmarks[] = [];
    const step = (frames.length - 1) / (targetLength - 1);

    for (let i = 0; i < targetLength; i++) {
      const idx = Math.min(Math.round(i * step), frames.length - 1);
      resampled.push(frames[idx]);
    }

    return resampled;
  }

  /**
   * Async inference communicating with backend FastAPI /api/sign/predict
   */
  public async predictAsync(
    frames: FrameLandmarks[],
    modelName: string = 'Compact Transformer Encoder (v1.0)'
  ): Promise<SignPredictionResult> {
    const startTime = performance.now();

    const quality = this.assessQuality(frames);
    if (!quality.qualityPassed) {
      return {
        className: 'Rejected: Poor Landmark Quality',
        classId: -1,
        confidence: 0.0,
        isUnknownOrRejected: true,
        rejectionReason: quality.failureReason || 'Insufficient landmark coverage.',
        extractedFrameCount: frames.length,
        modelArchitecture: modelName,
        inferenceLatencyMs: Math.round(performance.now() - startTime),
        landmarksQualityScore: Math.round(quality.rightHandPresentRatio * 100)
      };
    }

    try {
      const payload = {
        frames: frames.map(f => ({
          timestamp: f.timestamp || Date.now(),
          right_hand: f.rightHand,
          left_hand: f.leftHand,
          pose: f.pose,
          has_right_hand: f.hasRightHand || false,
          has_left_hand: f.hasLeftHand || false,
          has_pose: f.hasPose || false
        })),
        model_name: modelName
      };

      const res = await fetch('/api/sign/predict', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload)
      });

      if (res.ok) {
        const data = await res.json();
        return {
          className: data.class_name,
          classId: data.class_id,
          confidence: data.confidence,
          isUnknownOrRejected: data.is_unknown_or_rejected,
          rejectionReason: data.rejection_reason,
          extractedFrameCount: data.extracted_frame_count,
          modelArchitecture: data.model_architecture,
          inferenceLatencyMs: data.inference_latency_ms,
          landmarksQualityScore: data.landmarks_quality_score
        };
      } else {
        const errJson = await res.json().catch(() => ({}));
        return {
          className: 'Unavailable — required model/artifact not loaded.',
          classId: -1,
          confidence: 0.0,
          isUnknownOrRejected: true,
          rejectionReason: errJson.detail || 'Backend model checkpoint not ready.',
          extractedFrameCount: frames.length,
          modelArchitecture: 'None',
          inferenceLatencyMs: Math.round(performance.now() - startTime),
          landmarksQualityScore: 0
        };
      }
    } catch (e: any) {
      return {
        className: 'Unavailable — required model/artifact not loaded.',
        classId: -1,
        confidence: 0.0,
        isUnknownOrRejected: true,
        rejectionReason: 'Backend server is offline. Please launch backend via start.bat.',
        extractedFrameCount: frames.length,
        modelArchitecture: 'None',
        inferenceLatencyMs: Math.round(performance.now() - startTime),
        landmarksQualityScore: 0
      };
    }
  }

  /**
   * Synchronous fallback: Truthfully reports state without trigonometric simulation
   */
  public predict(
    frames: FrameLandmarks[],
    isTrainedModelLoaded: boolean,
    modelName: string = 'Compact Transformer Encoder (v1.0)'
  ): SignPredictionResult {
    const startTime = performance.now();

    if (!isTrainedModelLoaded) {
      return {
        className: 'Unavailable — required model/artifact not loaded.',
        classId: -1,
        confidence: 0.0,
        isUnknownOrRejected: true,
        rejectionReason: 'Sign recognition model is not loaded. Train a model in Data Science Lab or start the backend.',
        extractedFrameCount: frames.length,
        modelArchitecture: 'None',
        inferenceLatencyMs: 0,
        landmarksQualityScore: 0
      };
    }

    const quality = this.assessQuality(frames);
    if (!quality.qualityPassed) {
      return {
        className: 'Rejected: Poor Landmark Quality',
        classId: -1,
        confidence: 0.0,
        isUnknownOrRejected: true,
        rejectionReason: quality.failureReason || 'Insufficient landmark coverage during recording.',
        extractedFrameCount: frames.length,
        modelArchitecture: modelName,
        inferenceLatencyMs: Math.round(performance.now() - startTime),
        landmarksQualityScore: Math.round(quality.rightHandPresentRatio * 100)
      };
    }

    // Truthfully report awaiting backend async execution
    return {
      className: 'Processing...',
      classId: -1,
      confidence: 0.0,
      isUnknownOrRejected: true,
      rejectionReason: 'Awaiting backend inference execution.',
      extractedFrameCount: frames.length,
      modelArchitecture: modelName,
      inferenceLatencyMs: Math.round(performance.now() - startTime),
      landmarksQualityScore: Math.round(quality.rightHandPresentRatio * 100)
    };
  }
}

export const signService = new SignService();
