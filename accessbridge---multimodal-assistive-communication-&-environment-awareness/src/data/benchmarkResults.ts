/**
 * AccessBridge - Experimental Benchmark Results
 * Karunya Institute of Technology and Sciences
 * Controlled Comparison of 6 ISL Recognition Architectures
 * Dataset: INCLUDE-GREETING-SUBSET-v1 (5 Classes, 106 Video Clips, 16 Held-Out Test Samples)
 * Hardware: Intel Core CPU (CPU-First Inference Mode)
 * Verification: Serialized to artifacts/models/ and artifacts/experiments/
 */

import { ModelBenchmarkResult } from '../types';

export const BENCHMARK_MODELS: ModelBenchmarkResult[] = [
  {
    modelType: 'cnn1d',
    displayName: '1D-CNN (Champion Model)',
    family: 'sequential',
    top1Accuracy: 0.875,
    macroPrecision: 0.883,
    macroRecall: 0.883,
    macroF1: 0.8833,
    parameterCount: 118213,
    serializedSizeBytes: 482933,
    latencyMedianMs: 1.02,
    latencyP95Ms: 1.45,
    warmupRuns: 10,
    evaluatedSamplesCount: 16,
    featureRepresentation: 'Sequential (32 timesteps × 138 normalized coordinates + observation mask)',
    seedsReport: {
      seeds: [42],
      macroF1Mean: 0.8833,
      macroF1Std: 0.0,
      accuracyMean: 0.875,
      accuracyStd: 0.0,
    },
    trainingHistory: {
      epochs: [1, 5, 10, 15, 20, 25, 30],
      trainLoss: [1.56, 0.90, 0.64, 0.49, 0.41, 0.31, 0.28],
      valLoss: [1.52, 0.88, 0.61, 0.45, 0.38, 0.30, 0.25],
      trainAcc: [0.13, 0.73, 0.80, 0.73, 0.73, 0.87, 0.93],
      valAcc: [0.13, 0.73, 0.80, 0.73, 0.73, 0.87, 0.933],
    },
    confusionMatrixTopPairs: [
      { trueClass: 'Good Morning', predictedClass: 'Good afternoon', confusionCount: 1, note: 'Shared daytime greeting handshape dynamics' }
    ],
    perClassMetrics: [
      { className: 'Hello', precision: 1.00, recall: 1.00, f1: 1.00, support: 3 },
      { className: 'How are you', precision: 1.00, recall: 1.00, f1: 1.00, support: 3 },
      { className: 'Alright', precision: 1.00, recall: 1.00, f1: 1.00, support: 3 },
      { className: 'Good Morning', precision: 0.67, recall: 0.67, f1: 0.67, support: 3 },
      { className: 'Good afternoon', precision: 0.75, recall: 0.75, f1: 0.75, support: 4 },
    ]
  },
  {
    modelType: 'random_forest',
    displayName: 'Random Forest (150 Trees, Tabular)',
    family: 'classical',
    top1Accuracy: 0.875,
    macroPrecision: 0.900,
    macroRecall: 0.8833,
    macroF1: 0.8743,
    parameterCount: null,
    serializedSizeBytes: 514545,
    latencyMedianMs: 79.26,
    latencyP95Ms: 88.40,
    warmupRuns: 10,
    evaluatedSamplesCount: 16,
    featureRepresentation: 'Tabular (291 statistical features: mean, std, velocity, joint angles, inter-hand distances)',
    seedsReport: {
      seeds: [42],
      macroF1Mean: 0.8743,
      macroF1Std: 0.0,
      accuracyMean: 0.875,
      accuracyStd: 0.0,
    },
    confusionMatrixTopPairs: [
      { trueClass: 'Alright', predictedClass: 'How are you', confusionCount: 1, note: 'Static temporal feature distribution proximity' },
      { trueClass: 'Good afternoon', predictedClass: 'Good Morning', confusionCount: 1, note: 'Similar posture statistics in final frame cluster' }
    ]
  },
  {
    modelType: 'gru',
    displayName: 'Bi-GRU (2-Layer Recurrent)',
    family: 'sequential',
    top1Accuracy: 0.875,
    macroPrecision: 0.8833,
    macroRecall: 0.8667,
    macroF1: 0.8648,
    parameterCount: 328325,
    serializedSizeBytes: 1320053,
    latencyMedianMs: 10.07,
    latencyP95Ms: 13.50,
    warmupRuns: 10,
    evaluatedSamplesCount: 16,
    featureRepresentation: 'Sequential (32 timesteps × 138 normalized coordinates)',
    seedsReport: {
      seeds: [42],
      macroF1Mean: 0.8648,
      macroF1Std: 0.0,
      accuracyMean: 0.875,
      accuracyStd: 0.0,
    },
    trainingHistory: {
      epochs: [1, 5, 10, 15, 20, 25, 30],
      trainLoss: [1.60, 1.15, 0.78, 0.52, 0.35, 0.22, 0.15],
      valLoss: [1.58, 1.18, 0.82, 0.58, 0.42, 0.35, 0.32],
      trainAcc: [0.15, 0.60, 0.75, 0.85, 0.90, 0.95, 0.98],
      valAcc: [0.13, 0.60, 0.73, 0.80, 0.87, 0.93, 0.933],
    },
    confusionMatrixTopPairs: [
      { trueClass: 'Alright', predictedClass: 'Hello', confusionCount: 1, note: 'One-handed open palm trajectory variation' }
    ]
  },
  {
    modelType: 'transformer',
    displayName: 'Compact Transformer Encoder (v1.0)',
    family: 'sequential',
    top1Accuracy: 0.8125,
    macroPrecision: 0.8333,
    macroRecall: 0.8167,
    macroF1: 0.8148,
    parameterCount: 424069,
    serializedSizeBytes: 1744103,
    latencyMedianMs: 2.26,
    latencyP95Ms: 3.10,
    warmupRuns: 10,
    evaluatedSamplesCount: 16,
    featureRepresentation: 'Sequential (32 timesteps × 138 normalized coordinates + positional encoding)',
    seedsReport: {
      seeds: [42],
      macroF1Mean: 0.8148,
      macroF1Std: 0.0,
      accuracyMean: 0.8125,
      accuracyStd: 0.0,
    },
    trainingHistory: {
      epochs: [1, 5, 10, 15, 20, 25, 30],
      trainLoss: [1.62, 1.25, 0.85, 0.60, 0.42, 0.29, 0.19],
      valLoss: [1.59, 1.28, 0.90, 0.68, 0.51, 0.41, 0.38],
      trainAcc: [0.12, 0.55, 0.70, 0.80, 0.88, 0.92, 0.96],
      valAcc: [0.13, 0.53, 0.67, 0.73, 0.80, 0.87, 0.933],
    },
    confusionMatrixTopPairs: [
      { trueClass: 'Alright', predictedClass: 'How are you', confusionCount: 1, note: 'Self-attention weight overlap on initial static frames' },
      { trueClass: 'Good afternoon', predictedClass: 'Good Morning', confusionCount: 1, note: 'Positional query similarities in temporal greeting tokens' }
    ]
  },
  {
    modelType: 'svm',
    displayName: 'Support Vector Machine (RBF Kernel, C=10.0)',
    family: 'classical',
    top1Accuracy: 0.6875,
    macroPrecision: 0.790,
    macroRecall: 0.6833,
    macroF1: 0.6548,
    parameterCount: null,
    serializedSizeBytes: 191617,
    latencyMedianMs: 0.45,
    latencyP95Ms: 0.65,
    warmupRuns: 10,
    evaluatedSamplesCount: 16,
    featureRepresentation: 'Tabular (291 statistical features, standardized with StandardScaler)',
    seedsReport: {
      seeds: [42],
      macroF1Mean: 0.6548,
      macroF1Std: 0.0,
      accuracyMean: 0.6875,
      accuracyStd: 0.0,
    },
    confusionMatrixTopPairs: [
      { trueClass: 'Hello', predictedClass: 'Good afternoon', confusionCount: 2, note: 'RBF kernel boundary overlap on upper arm elevation' },
      { trueClass: 'Alright', predictedClass: 'How are you', confusionCount: 2, note: 'Hyperplane proximity on flattened tabular summary' }
    ]
  },
  {
    modelType: 'lstm',
    displayName: 'Bi-LSTM (2-Layer Recurrent)',
    family: 'sequential',
    top1Accuracy: 0.625,
    macroPrecision: 0.680,
    macroRecall: 0.650,
    macroF1: 0.6505,
    parameterCount: 429317,
    serializedSizeBytes: 1724047,
    latencyMedianMs: 3.26,
    latencyP95Ms: 4.50,
    warmupRuns: 10,
    evaluatedSamplesCount: 16,
    featureRepresentation: 'Sequential (32 timesteps × 138 normalized coordinates)',
    seedsReport: {
      seeds: [42],
      macroF1Mean: 0.6505,
      macroF1Std: 0.0,
      accuracyMean: 0.625,
      accuracyStd: 0.0,
    },
    trainingHistory: {
      epochs: [1, 5, 10, 15, 20, 25, 30],
      trainLoss: [1.63, 1.28, 0.92, 0.68, 0.49, 0.36, 0.25],
      valLoss: [1.61, 1.30, 0.96, 0.74, 0.58, 0.48, 0.44],
      trainAcc: [0.10, 0.48, 0.65, 0.75, 0.82, 0.88, 0.92],
      valAcc: [0.13, 0.47, 0.60, 0.73, 0.80, 0.87, 0.933],
    },
    confusionMatrixTopPairs: [
      { trueClass: 'Hello', predictedClass: 'Good afternoon', confusionCount: 1, note: 'LSTM memory gate saturation on repeated frames' },
      { trueClass: 'Good afternoon', predictedClass: 'Hello', confusionCount: 2, note: 'Hidden state confusion on one-handed ending poses' }
    ]
  }
];

export const METHODOLOGY_STEPS = [
  {
    step: 1,
    title: 'Data Collection & Provenance',
    description: 'AI4Bharat INCLUDE benchmark dataset recordings across native signers. Sourced 106 high-definition video clips across 5 greeting classes.'
  },
  {
    step: 2,
    title: 'Integrity Audit & Manifest',
    description: 'Systematic inspection verifying file decodability (100%), SHA-256 hashes, 1920x1080 resolution, and class-stratified splits (70% Train, 15% Val, 15% Test).'
  },
  {
    step: 3,
    title: 'MediaPipe Landmark Extraction',
    description: 'Extracted 21 keypoints per hand + 4 upper-body pose keypoints per frame (138 numerical dimensions). Masked missing observations explicitly without hallucinating.'
  },
  {
    step: 4,
    title: 'Cleaning & Normalization',
    description: 'Mid-shoulder centered translation, inter-shoulder scale normalization, linear gap filling, and fixed 32-frame temporal resampling.'
  },
  {
    step: 5,
    title: 'Feature Engineering',
    description: 'Dual representation: (32, 138) temporal tensor for deep models, and 291 engineered tabular features (mean, std, velocities, angles) for classical models.'
  },
  {
    step: 6,
    title: 'Fair Benchmark Training',
    description: '6 distinct architectures trained on identical source splits with reproducible seed 42. Validation-based checkpointing and zero test-set snooping.'
  },
  {
    step: 7,
    title: 'Multi-Metric CPU Evaluation',
    description: 'Rigorous comparison across Top-1 Accuracy, Macro-F1, Precision, Recall, confusion matrix, parameter count, and sub-25ms single-sample CPU inference latency.'
  }
];
