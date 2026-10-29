/**
 * AccessBridge - Types Definition
 * Karunya Institute of Technology and Sciences - Data Science Microproject
 */

export type NavigationTab = 
  | 'deaf'         // 1. Dedicated Deaf Mode (Visual-First Captions & Sound Flasher)
  | 'mute'         // 2. Dedicated Mute Mode (ISL Sign-to-Speech & AAC Quick Soundboard)
  | 'blind'        // 3. Dedicated Blind Mode (Audio-First Narrator, Voice Navigation & OCR)
  | 'processor'    // 4. Separated Technical Processor & Admin Panel
  | 'home' 
  | 'sign' 
  | 'record'       // In-app Sign Recording for dataset building
  | 'captions' 
  | 'environment' 
  | 'lab' 
  | 'evaluation' 
  | 'diagnostics'  // System health & diagnostics audit
  | 'settings';

export interface AacPhraseCategory {
  id: string;
  name: string;
  icon: string;
  color: string;
  phrases: string[];
}

export interface EnvironmentalSoundAlert {
  id: string;
  label: string;
  timestamp: string;
  intensity: number; // 0-100
  type: 'speech' | 'alarm' | 'doorbell' | 'clapping' | 'loud_noise';
}

export interface ProcessorTelemetry {
  fps: number;
  cpuInferenceLatencyMs: number;
  audioSampleRateHz: number;
  videoResolution: string;
  memoryUsageMb: number;
  activeModelName: string;
  wasmStatus: string;
}

export type ReadinessState = 
  | 'ready' 
  | 'download_needed' 
  | 'training_required' 
  | 'not_configured' 
  | 'unavailable' 
  | 'error';

export interface SubsystemStatus {
  id: string;
  name: string;
  category: 'hardware' | 'runtime' | 'model';
  state: ReadinessState;
  details: string;
  recoveryAction?: string;
  actionLabel?: string;
  isPretrained?: boolean;
}

export interface SignClassInfo {
  id: number;
  name: string;
  category: 'Greetings' | 'Emergency' | 'Daily' | 'Question' | 'Family' | 'Action' | 'State';
  description: string;
  twoHanded: boolean;
}

export interface LandmarkPoint {
  x: number;
  y: number;
  z: number;
  visibility?: number;
}

export interface FrameLandmarks {
  timestamp: number;
  rightHand: LandmarkPoint[] | null;
  leftHand: LandmarkPoint[] | null;
  pose: LandmarkPoint[] | null; // Key upper-body joints
  hasRightHand: boolean;
  hasLeftHand: boolean;
  hasPose: boolean;
}

export interface SignPredictionResult {
  className: string;
  classId: number;
  confidence: number;
  isUnknownOrRejected: boolean;
  rejectionReason?: string;
  extractedFrameCount: number;
  modelArchitecture: string;
  inferenceLatencyMs: number;
  landmarksQualityScore: number;
}

export interface CaptionItem {
  id: string;
  timestamp: string;
  text: string;
  language: 'en' | 'ta' | 'hi';
  confidence?: number;
  isFinal: boolean;
  source: 'web_speech_api' | 'faster_whisper_local';
}

export interface DetectedObject {
  id: string;
  label: string;
  confidence: number;
  bbox: [number, number, number, number]; // [x, y, width, height] normalized (0-1)
  spatialLocation: 'left' | 'centre' | 'right';
  verticalLocation: 'top' | 'centre' | 'bottom';
  relativeSize: 'small' | 'medium' | 'large';
}

export interface OcrResult {
  rawText: string;
  cleanedText: string;
  language: 'eng' | 'tam';
  confidence: number;
  processingTimeMs: number;
  rotationAppliedDegrees: number;
  linesCount: number;
}

export interface DatasetSample {
  sample_id: string;
  video_path: string;
  class_id: number;
  class_name: string;
  official_split: 'train' | 'val' | 'test';
  signer_id?: string;
  source: string;
  usable: boolean;
  extraction_status: 'pending' | 'success' | 'failed' | 'corrupt';
  exclusion_reason?: string;
  frame_count?: number;
  duration_sec?: number;
}

export interface DatasetAuditReport {
  timestamp: string;
  datasetName: string;
  totalSamples: number;
  classesCount: number;
  splitCounts: {
    train: number;
    val: number;
    test: number;
  };
  missingFilesCount: number;
  corruptVideosCount: number;
  duplicateHashCount: number;
  missingLabelsCount: number;
  averageFrameCount: number;
  averageDurationSec: number;
  signerIndependenceStatus: string;
  usableSampleCoveragePercent: number;
  classDistribution: { className: string; count: number }[];
}

export type ModelType = 
  | 'svm' 
  | 'random_forest' 
  | 'lstm' 
  | 'gru' 
  | 'cnn1d' 
  | 'transformer';

export interface ModelBenchmarkResult {
  modelType: ModelType;
  displayName: string;
  family: 'classical' | 'sequential';
  top1Accuracy: number;
  macroPrecision: number;
  macroRecall: number;
  macroF1: number;
  parameterCount: number | null;
  serializedSizeBytes: number;
  latencyMedianMs: number;
  latencyP95Ms: number;
  warmupRuns: number;
  evaluatedSamplesCount: number;
  featureRepresentation: string;
  seedsReport?: {
    seeds: number[];
    macroF1Mean: number;
    macroF1Std: number;
    accuracyMean: number;
    accuracyStd: number;
  };
  trainingHistory?: {
    epochs: number[];
    trainLoss: number[];
    valLoss: number[];
    trainAcc: number[];
    valAcc: number[];
  };
  perClassMetrics?: {
    className: string;
    precision: number;
    recall: number;
    f1: number;
    support: number;
  }[];
  confusionMatrixTopPairs?: {
    trueClass: string;
    predictedClass: string;
    confusionCount: number;
    note: string;
  }[];
}

export interface ConversationTurn {
  id: string;
  timestamp: string;
  sender: 'signer' | 'speaker';
  text: string;
  confidence?: number;
}

export interface AccessibilitySettings {
  highContrast: boolean;
  fontSize: 'normal' | 'large' | 'extralarge';
  reducedMotion: boolean;
  speechRate: number; // 0.8 to 1.5
  speechPitch: number; // 0.8 to 1.2
  speechVoiceUri: string;
  announcementFrequencySec: number;
  autoSpeakSign: boolean;
  cameraFacingMode: 'user' | 'environment';
}
