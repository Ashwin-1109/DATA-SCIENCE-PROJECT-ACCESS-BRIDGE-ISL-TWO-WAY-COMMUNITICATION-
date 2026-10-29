# AccessBridge System Architecture
**Karunya Institute of Technology and Sciences**  
*Department of Computer Science & Engineering (AI & ML)*

## 1. High-Level System Overview
AccessBridge integrates three assistive workflows into a single unified local platform:

```
[Webcam Feed]      ---> [MediaPipe Hands/Pose] ---> [Feature Resampling] ---> [Compact Transformer] ---> [Spoken Output (TTS)]
[Microphone Audio] ---> [Speech Recognition]   ---> [Chunk Processing]   ---> [Live Text Captions]   ---> [Conversation Log]
[Environment Cam]  ---> [Spatial Detector/OCR] ---> [Directional Cues]   ---> [Text-to-Speech]       ---> [Screen Reader Access]
```

## 2. Frontend Subsystem
- **Framework**: React 19, TypeScript, Vite.
- **Styling**: Tailwind CSS with intentional high-contrast accessibility theme (`#070B14` deep navy, clear blue `#38BDF8`).
- **Visualizations**: Recharts for confusion matrix, latency vs F1 scatter, and loss/accuracy curves.
- **Audio Output**: Web Speech Synthesis API with voice discovery and rate/pitch controls.
- **Privacy**: LocalStorage for session transcripts; raw camera/microphone streams remain in volatile memory.

## 3. Backend Subsystem
- **Framework**: Python 3.10+, FastAPI.
- **Data Persistence**: SQLite for session metadata, experiment records, and job tracking.
- **Inference Target**: Optimized for standard laptop CPUs (Intel Core i5/i7, 16 GB RAM).
- **APIs**: REST endpoints for readiness diagnostics, sign prediction, dataset audit, and model training.

## 4. Machine Learning & Vision Architecture
- **Landmark Extractor**: MediaPipe Hands (21 3D points per hand) + Upper-Body Pose (4 points).
- **Canonical Normalization**: Origin translated to mid-shoulder; scale normalized by inter-shoulder distance.
- **Sequence Length**: Fixed 32 frames via uniform linear temporal interpolation.
- **Dual Representation**:
  1. Sequential Tensor `(32, 138)` for deep neural networks.
  2. Tabular Vector `(291 dimensions)` for classical classifiers.
