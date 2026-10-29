/**
 * AccessBridge - Central Capability & Architecture Contracts
 * Single source of truth for:
 * 1. Trained dataset classes (INCLUDE-GREETING-SUBSET-v1: 5 classes)
 * 2. Active Model registry and inference policies
 * 3. Provider operational modes (Local, Gemini, Hybrid)
 * 4. Motion catalog metadata schema
 */

export const OFFICIAL_GREETING_CLASSES = [
  "Hello",
  "How are you",
  "Alright",
  "Good Morning",
  "Good afternoon"
] as const;

export type GreetingClassName = typeof OFFICIAL_GREETING_CLASSES[number];

export const OFFICIAL_GREETINGS = [
  {
    id: 0,
    name: "Hello" as GreetingClassName,
    category: "Greetings" as const,
    description: "Open right palm waved beside right temple with gentle lateral oscillation",
    twoHanded: false
  },
  {
    id: 1,
    name: "How are you" as GreetingClassName,
    category: "Greetings" as const,
    description: "Curved palms chest-level rotating outward into open questioning handshape",
    twoHanded: true
  },
  {
    id: 2,
    name: "Alright" as GreetingClassName,
    category: "Greetings" as const,
    description: "Open right flat palm brushing outward across body in affirmative sweeping motion",
    twoHanded: false
  },
  {
    id: 3,
    name: "Good Morning" as GreetingClassName,
    category: "Greetings" as const,
    description: "Right flat hand touching chin transitioning to rising sun elevation gesture",
    twoHanded: false
  },
  {
    id: 4,
    name: "Good afternoon" as GreetingClassName,
    category: "Greetings" as const,
    description: "Right flat hand from mouth transitioning to downward horizontal midday sun posture",
    twoHanded: false
  }
];

export const GREETING_CLASS_METADATA: Record<GreetingClassName, {
  id: number;
  label: GreetingClassName;
  category: 'Greetings';
  description: string;
  twoHanded: boolean;
  sampleCount: number;
}> = {
  "Hello": {
    id: 0,
    label: "Hello",
    category: "Greetings",
    description: "Open right palm waved beside right temple with gentle lateral oscillation",
    twoHanded: false,
    sampleCount: 21
  },
  "How are you": {
    id: 1,
    label: "How are you",
    category: "Greetings",
    description: "Curved palms chest-level rotating outward into open questioning handshape",
    twoHanded: true,
    sampleCount: 21
  },
  "Alright": {
    id: 2,
    label: "Alright",
    category: "Greetings",
    description: "Open right flat palm brushing outward across body in affirmative sweeping motion",
    twoHanded: false,
    sampleCount: 21
  },
  "Good Morning": {
    id: 3,
    label: "Good Morning",
    category: "Greetings",
    description: "Right flat hand touching chin transitioning to rising sun elevation gesture",
    twoHanded: false,
    sampleCount: 21
  },
  "Good afternoon": {
    id: 4,
    label: "Good afternoon",
    category: "Greetings",
    description: "Right flat hand from mouth transitioning to downward horizontal midday sun posture",
    twoHanded: false,
    sampleCount: 22
  }
};

export type ProviderMode = 'local' | 'gemini' | 'hybrid';

export interface SystemCapabilities {
  localModelLoaded: boolean;
  activeModelId: string;
  activeModelType: string;
  classesCount: number;
  classes: string[];
  trackerReady: boolean;
  vrmLoaded: boolean;
  geminiAvailable: boolean;
  activeMode: ProviderMode;
  rejectionThreshold: number;
}

export interface MotionClipMetadata {
  clipId: string;
  phrase: GreetingClassName;
  filePath: string;
  sourceVideo: string;
  durationSec: number;
  fps: number;
  frameCount: number;
  twoHanded: boolean;
  reviewStatus: 'unreviewed';
  sourceAssetId: string;
  sourceDataset: 'INCLUDE-GREETING-SUBSET-v1';
  license: 'CC-BY 4.0 (AI4Bharat INCLUDE Benchmark)';
  coordinateSchema: 'VRM-HUMANOID-v1';
}

export const OFFICIAL_MOTION_CLIPS: Record<GreetingClassName, MotionClipMetadata> = {
  "Hello": {
    clipId: "motion_hello_01",
    phrase: "Hello",
    filePath: "/motion/motion_hello_01.json",
    sourceVideo: "MVI_0029.MOV",
    durationSec: 2.52,
    fps: 30,
    frameCount: 63,
    twoHanded: false,
    reviewStatus: "unreviewed",
    sourceAssetId: "48. Hello/MVI_0029.MOV",
    sourceDataset: "INCLUDE-GREETING-SUBSET-v1",
    license: "CC-BY 4.0 (AI4Bharat INCLUDE Benchmark)",
    coordinateSchema: "VRM-HUMANOID-v1"
  },
  "How are you": {
    clipId: "motion_how_are_you_01",
    phrase: "How are you",
    filePath: "/motion/motion_how_are_you_01.json",
    sourceVideo: "MVI_0030.MOV",
    durationSec: 3.24,
    fps: 30,
    frameCount: 81,
    twoHanded: true,
    reviewStatus: "unreviewed",
    sourceAssetId: "53. How are you/MVI_0093.MOV",
    sourceDataset: "INCLUDE-GREETING-SUBSET-v1",
    license: "CC-BY 4.0 (AI4Bharat INCLUDE Benchmark)",
    coordinateSchema: "VRM-HUMANOID-v1"
  },
  "Alright": {
    clipId: "motion_alright_01",
    phrase: "Alright",
    filePath: "/motion/motion_alright_01.json",
    sourceVideo: "MVI_0029.MOV",
    durationSec: 2.92,
    fps: 30,
    frameCount: 73,
    twoHanded: false,
    reviewStatus: "unreviewed",
    sourceAssetId: "08. Alright/MVI_0001.MOV",
    sourceDataset: "INCLUDE-GREETING-SUBSET-v1",
    license: "CC-BY 4.0 (AI4Bharat INCLUDE Benchmark)",
    coordinateSchema: "VRM-HUMANOID-v1"
  },
  "Good Morning": {
    clipId: "motion_good_morning_01",
    phrase: "Good Morning",
    filePath: "/motion/motion_good_morning_01.json",
    sourceVideo: "MVI_0030.MOV",
    durationSec: 3.40,
    fps: 30,
    frameCount: 85,
    twoHanded: false,
    reviewStatus: "unreviewed",
    sourceAssetId: "44. Good Morning/MVI_0019.MOV",
    sourceDataset: "INCLUDE-GREETING-SUBSET-v1",
    license: "CC-BY 4.0 (AI4Bharat INCLUDE Benchmark)",
    coordinateSchema: "VRM-HUMANOID-v1"
  },
  "Good afternoon": {
    clipId: "motion_good_afternoon_01",
    phrase: "Good afternoon",
    filePath: "/motion/motion_good_afternoon_01.json",
    sourceVideo: "MVI_0030.MOV",
    durationSec: 3.64,
    fps: 30,
    frameCount: 91,
    twoHanded: false,
    reviewStatus: "unreviewed",
    sourceAssetId: "43. Good afternoon/MVI_0045.MOV",
    sourceDataset: "INCLUDE-GREETING-SUBSET-v1",
    license: "CC-BY 4.0 (AI4Bharat INCLUDE Benchmark)",
    coordinateSchema: "VRM-HUMANOID-v1"
  }
};

export const OFFICIAL_MOTION_CLIPS_LIST: MotionClipMetadata[] = Object.values(OFFICIAL_MOTION_CLIPS);
