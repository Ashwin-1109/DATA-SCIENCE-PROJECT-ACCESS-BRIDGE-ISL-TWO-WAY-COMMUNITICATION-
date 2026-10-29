# AccessBridge - Comprehensive Current System Audit
**Course**: Data Science – 25AI306  
**Institution**: Karunya Institute of Technology and Sciences  
**Project**: AccessBridge: AI-Based Multimodal Assistive Communication and Environment Awareness System  
**Auditor**: Lead Software Engineer, Data Scientist, ML Engineer, Accessibility Engineer & Auditor  
**Date**: October 2026  

---

## Executive Summary

An exhaustive technical audit of the AccessBridge repository was conducted across all frontend components, backend endpoints, machine learning definitions, notebooks, documentation, and asset files. 

While the user interface design, accessibility theme, and component structure are visually well-architected, the system previously relied heavily on **simulated artificial intelligence behavior, synthetic confidence scores, deterministic trigonometric hashing, fake training timers, and hardcoded benchmark datasets**.

This document audits all twenty primary features against academic data science standards, identifies the exact simulated vs real mechanisms, specifies the required fixes, and defines the verification methods.

---

## Feature-by-Feature Audit Records

### Feature 1: Frontend Real-Time Sign Gesture Classification
- **FEATURE**: Frontend Real-Time Hand Gesture Detection & Sign Recognition
- **CURRENT IMPLEMENTATION**: Calculates anatomical finger extensions and checks hardcoded kinematic `if-else` branches (e.g., wrist height, thumb extension) mapped to 12 words, falling back to "Sign" or "Resting Hand".
- **REAL OR SIMULATED**: **SIMULATED** (Hand-crafted heuristic rules masquerading as a deep learning model)
- **FILES INVOLVED**: `src/services/realtimeHandTracker.ts`, `src/components/RealTimeSignSystem.tsx`
- **BACKEND DEPENDENCY**: None (Pure client-side heuristic)
- **MODEL DEPENDENCY**: None (Labels displayed claim "Compact Transformer Encoder (v1.0)")
- **PROBLEM**: Does not consume trained neural network weights or SVM/RF classifiers. Claims 92% confidence via hardcoded floating point numbers.
- **REQUIRED FIX**: Replace with real MediaPipe landmark extraction feeding genuine inference engine (local ONNX/WASM or backend FastAPI inference with trained PyTorch/Scikit-Learn checkpoint). If model is not loaded, state "Unavailable — required model/artifact not loaded."
- **VALIDATION METHOD**: Feed identical static posture and varying dynamic motion; verify logits vary with input tensor and model weights rather than static conditional code.
- **STATUS**: **REPAIR REQUIRED (Phase 1 & Phase 7)**

---

### Feature 2: Sign Tracking Live Landmark Generation
- **FEATURE**: Live Webcam Landmark Extraction in Sign Viewers
- **CURRENT IMPLEMENTATION**: Generates 21 synthetic hand keypoint coordinates using trigonometric oscillation: `Math.sin(t * 1.5)` and `Math.cos(t * 1.2)`.
- **REAL OR SIMULATED**: **SIMULATED** (Fabricated coordinates)
- **FILES INVOLVED**: `src/components/RealTimeSignSystem.tsx` (lines 120–136), `src/components/BiDirectionalSignTranslator.tsx` (lines 144–149)
- **BACKEND DEPENDENCY**: None
- **MODEL DEPENDENCY**: None
- **PROBLEM**: Synthetic coordinates generate artificial gestures regardless of user webcam presence or real hand gestures.
- **REQUIRED FIX**: Remove `Math.sin`/`Math.cos` landmark synthesizers. Bind real MediaPipe Hands/Pose detection or camera video feed. When no hand is observed, output `null` or explicit zero-observation mask.
- **VALIDATION METHOD**: Cover camera lens; verify landmark points disappear and no hand is reported.
- **STATUS**: **REPAIR REQUIRED (Phase 1 & Phase 4)**

---

### Feature 3: Frontend Sign Recognition Inference Pipeline
- **FEATURE**: Isolated Sign Recognition Inference (`SignService.predict`)
- **CURRENT IMPLEMENTATION**: Computes total hand displacement and right hand movements, computes a trigonometric hash `Math.abs(Math.sin(totalHandDisplacement * 12.34 + ...))` to pick an index from `INCLUDE_50_CLASSES`, and generates synthetic confidence `0.68 + Math.cos(...) * 0.22`.
- **REAL OR SIMULATED**: **SIMULATED** (Deterministic pseudo-random hashing)
- **FILES INVOLVED**: `src/services/signService.ts` (lines 227–235)
- **BACKEND DEPENDENCY**: None
- **MODEL DEPENDENCY**: None
- **PROBLEM**: Completely fabricates predictions and confidence intervals using trigonometry.
- **REQUIRED FIX**: Route landmark frames to genuine trained model checkpoint via backend `/api/sign/predict` or client-side exported weights. Return "Model Not Loaded" when no checkpoint exists.
- **VALIDATION METHOD**: Inspect network request and ensure backend PyTorch forward pass calculates true softmax probabilities.
- **STATUS**: **REPAIR REQUIRED (Phase 1 & Phase 7)**

---

### Feature 4: Two-Way Sign Translator Frame Collection
- **FEATURE**: Sign Capture in BiDirectionalSignTranslator
- **CURRENT IMPLEMENTATION**: Initializes an empty frame buffer `recordingFramesRef.current = []`, runs a timer from 0 to 100%, and sends the empty array to `signService.predict([])`.
- **REAL OR SIMULATED**: **SIMULATED** (No frames collected during capture)
- **FILES INVOLVED**: `src/components/BiDirectionalSignTranslator.tsx` (lines 252–273)
- **BACKEND DEPENDENCY**: None
- **MODEL DEPENDENCY**: None
- **PROBLEM**: Timer simulates progress while recording zero camera frames or landmarks.
- **REQUIRED FIX**: Buffer actual MediaPipe landmark frames into `recordingFramesRef` at every video frame during the active capture window.
- **VALIDATION METHOD**: Assert `recordingFramesRef.current.length > 0` before inference, with valid (x,y,z) coordinate arrays.
- **STATUS**: **REPAIR REQUIRED (Phase 1 & Phase 4)**

---

### Feature 5: Backend Sign Prediction Endpoint
- **FEATURE**: FastAPI `/api/sign/predict` Endpoint
- **CURRENT IMPLEMENTATION**: Selects predicted vocabulary word using `predicted_idx = (len(frames) * 7) % len(INCLUDE_VOCABULARY)` and returns hardcoded `confidence = 0.88`.
- **REAL OR SIMULATED**: **SIMULATED** (Modulo frame count class selection)
- **FILES INVOLVED**: `backend/app/api/sign.py` (lines 38–52)
- **BACKEND DEPENDENCY**: FastAPI `/api/sign/predict`
- **MODEL DEPENDENCY**: None
- **PROBLEM**: Any two completely different sign gestures with equal duration yield identical predicted classes and fake 0.88 confidence.
- **REQUIRED FIX**: Load real trained PyTorch checkpoint or Scikit-Learn pipeline from model registry. Execute real forward pass with preprocessing. Return HTTP 503 / descriptive unavailable error if no model checkpoint is active.
- **VALIDATION METHOD**: Pass two different gestures of equal frame length; verify different logits and true model inference.
- **STATUS**: **REPAIR REQUIRED (Phase 1 & Phase 5)**

---

### Feature 6: Environment Object Detection
- **FEATURE**: Spatial Object Detection for Blind / Low-Vision Assistance
- **CURRENT IMPLEMENTATION**: Samples an 8x6 canvas grid, computes pixel luminance differences, and triggers static bounding boxes for `'person'` if centre energy > 8, `'chair'` if left energy > 10, and `'laptop'` if right energy > 10.
- **REAL OR SIMULATED**: **SIMULATED** (Contrast threshold heuristics with hardcoded labels)
- **FILES INVOLVED**: `src/services/visionService.ts` (lines 43–122)
- **BACKEND DEPENDENCY**: None
- **MODEL DEPENDENCY**: None (UI falsely claims MobileNet / COCO-SSD)
- **PROBLEM**: A blank sheet with black marks triggers "Person near the centre" or "Chair on the left".
- **REQUIRED FIX**: Replace with genuine lightweight pretrained object detector (e.g. MediaPipe Tasks Object Detector / COCO-SSD) or server-side Gemini 2.5 Flash multimodal vision analysis. Return "No supported objects detected" if nothing found.
- **VALIDATION METHOD**: Point camera at blank wall vs actual object; verify genuine bounding boxes and classes.
- **STATUS**: **REPAIR REQUIRED (Phase 1 & Phase 2)**

---

### Feature 7: Printed Text OCR & Error Handling
- **FEATURE**: Camera / Document OCR
- **CURRENT IMPLEMENTATION**: Runs `tesseract.js` worker, but in `catch` block returns hardcoded fallback text: `"AccessBridge Multimodal Assistive System\nKarunya Institute of Technology and Sciences\nDepartment of Computer Science & Engineering\nRecognized text sample."` with fake confidence 0.82.
- **REAL OR SIMULATED**: **PARTIALLY REAL with FAKE FALLBACK**
- **FILES INVOLVED**: `src/services/visionService.ts` (lines 227–239)
- **BACKEND DEPENDENCY**: None
- **MODEL DEPENDENCY**: Tesseract.js engine
- **PROBLEM**: If OCR encounters any error or empty image, it claims to have read university text.
- **REQUIRED FIX**: Remove fake fallback text. Return explicit error state: `OCR FAILED` or `NO TEXT FOUND` with 0 confidence and empty text string.
- **VALIDATION METHOD**: Trigger OCR on blank dark image; verify no text is returned.
- **STATUS**: **REPAIR REQUIRED (Phase 1 & Phase 2)**

---

### Feature 8: Multimodal Vision Assistance (Gemini API)
- **FEATURE**: Assistive Multimodal Scene Understanding & Rich Environment Description
- **CURRENT IMPLEMENTATION**: Mentioned in `metadata.json` (`MAJOR_CAPABILITY_SERVER_SIDE_GEMINI_API`), but missing backend proxy implementation and API key configuration.
- **REAL OR SIMULATED**: **NOT IMPLEMENTED YET**
- **FILES INVOLVED**: `metadata.json`, `backend/app/main.py`
- **BACKEND DEPENDENCY**: Requires FastAPI endpoint `/api/gemini/describe`
- **MODEL DEPENDENCY**: `gemini-2.5-flash` (Verified working on user free plan keys)
- **PROBLEM**: Keys must be kept securely server-side and connected to assistive scene narration.
- **REQUIRED FIX**: Create backend Gemini vision service utilizing `gemini-2.5-flash`, managing user keys via server `.env` with automatic fallback.
- **VALIDATION METHOD**: Send captured frame to `/api/gemini/describe`; verify real multimodal scene description generated by Gemini 2.5 Flash.
- **STATUS**: **IMPLEMENT IN PHASE 1 & 2**

---

### Feature 9: Backend Training Job Scheduler
- **FEATURE**: Background Model Training Jobs
- **CURRENT IMPLEMENTATION**: `create_training_job` creates an in-memory dictionary. `get_job_status` returns hardcoded `status: "completed"`, `current_epoch: 30`, `val_accuracy: 0.851`, `artifact_path: "artifacts/models/{job_id}.pth"` whenever queried.
- **REAL OR SIMULATED**: **SIMULATED** (Fake immediate completion with 85.1% accuracy)
- **FILES INVOLVED**: `backend/app/api/training.py` (lines 18–51)
- **BACKEND DEPENDENCY**: FastAPI `/api/jobs/train`
- **MODEL DEPENDENCY**: None
- **PROBLEM**: No actual training process is spawned or monitored.
- **REQUIRED FIX**: Implement background execution using Python `multiprocessing` or `BackgroundTasks` running actual training pipeline scripts, updating genuine epochs, train/val loss, saving checkpoints, and reporting true status.
- **VALIDATION METHOD**: Inspect disk for generated `.pth` / `.joblib` checkpoint and verify real epoch loss numbers.
- **STATUS**: **REPAIR REQUIRED (Phase 1 & Phase 5)**

---

### Feature 10: CLI Training Script
- **FEATURE**: Model Training CLI (`scripts/train.py`)
- **CURRENT IMPLEMENTATION**: Contains 30 lines of dummy code that prints 4 lines of hardcoded strings: `print("[3/4] Fitting model on training split (2,394 samples)...")` and exits.
- **REAL OR SIMULATED**: **SIMULATED** (Mock print statements)
- **FILES INVOLVED**: `scripts/train.py`
- **BACKEND DEPENDENCY**: None
- **MODEL DEPENDENCY**: None
- **PROBLEM**: Does not import PyTorch or scikit-learn models, does not load data, does not save weights.
- **REQUIRED FIX**: Connect to `ml/models`, `ml/preprocessing`, and `ml/features`. Execute real dataset loading, feature transformation, training loops, evaluation, and checkpoint serialization.
- **VALIDATION METHOD**: Run `python scripts/train.py --model rf --smoke-test`; verify true model artifact is generated.
- **STATUS**: **REPAIR REQUIRED (Phase 1 & Phase 5)**

---

### Feature 11: Data Science Lab UI
- **FEATURE**: Interactive Experiment & Training Dashboard
- **CURRENT IMPLEMENTATION**: Training button runs a JavaScript `setInterval` advancing a progress counter from 0 to 100% with static log strings, then saves model name string to `localStorage`.
- **REAL OR SIMULATED**: **SIMULATED** (Client-side timer and mocked curves)
- **FILES INVOLVED**: `src/pages/DataScienceLab.tsx` (lines 74–140)
- **BACKEND DEPENDENCY**: None (Pure client timer)
- **MODEL DEPENDENCY**: None
- **PROBLEM**: Gives false impression that training is executing on CPU when it is only a timer.
- **REQUIRED FIX**: Connect to backend training endpoints `/api/jobs/train` and `/api/jobs/status/{id}`. Display real training status, real loss, and genuine metrics fetched from backend artifacts.
- **VALIDATION METHOD**: Start training job; inspect network dev tools to see HTTP polling of real job status.
- **STATUS**: **REPAIR REQUIRED (Phase 1 & Phase 5)**

---

### Feature 12: Subsystem Readiness Diagnostics
- **FEATURE**: System Readiness Health Check
- **CURRENT IMPLEMENTATION**: Hardcodes `sign_model` as `state: "ready"`, `stt_model` as `state: "ready"`, and `object_detector` as `state: "ready"`, even when no model weights exist.
- **REAL OR SIMULATED**: **SIMULATED** (Hardcoded "ready" states)
- **FILES INVOLVED**: `backend/app/api/readiness.py`, `src/services/readinessService.ts`
- **BACKEND DEPENDENCY**: FastAPI `/api/readiness/subsystems`
- **MODEL DEPENDENCY**: None
- **PROBLEM**: Misleads evaluators into believing AI models are loaded and verified.
- **REQUIRED FIX**: Check physical existence of model checkpoint files in `models/` or `artifacts/`. If missing, report `state: "unavailable"` or `"training_required"`.
- **VALIDATION METHOD**: Delete/move model checkpoint file; verify subsystem status dynamically switches to "unavailable".
- **STATUS**: **REPAIR REQUIRED (Phase 1)**

---

### Feature 13: 3D Signing Character Presentation (Avatar & VRM)
- **FEATURE**: Three.js Signing Avatar Viewer
- **CURRENT IMPLEMENTATION**: Generates procedural Three.js cylinders and boxes for arms and torso. When a sign is requested that is not found, it falls back to `ISL_ANIMATION_CATALOGUE[0]` (Hello). The file `public/models/avatar.gltf` is a 501-byte placeholder with no mesh data.
- **REAL OR SIMULATED**: **PROCEDURAL RIG with FALLBACK TO HELLO**
- **FILES INVOLVED**: `src/components/SigningAvatarViewer.tsx`, `src/data/islAnimationCatalogue.ts` (lines 486–494), `public/models/avatar.gltf`
- **BACKEND DEPENDENCY**: None
- **MODEL DEPENDENCY**: User supplied VRM `3477026897357566765.vrm` (18.9 MB)
- **PROBLEM**: Fallback reuses Hello for missing signs. Avatar does not load the supplied 18.9 MB humanoid VRM file.
- **REQUIRED FIX**: Mount user VRM file in `public/models/avatar.vrm`. Load and render VRM humanoid bone structure using Three.js / three-vrm. When an unsupported sign is requested, display "Sign animation unavailable for this word." Never substitute Hello.
- **VALIDATION METHOD**: Request non-existent word "Aeroplane"; verify viewer displays clear unavailable notification.
- **STATUS**: **REPAIR REQUIRED (Phase 1 & Phase 8)**

---

### Feature 14: Frontend-Backend API Proxy
- **FEATURE**: Frontend `/api` Communication to FastAPI Backend
- **CURRENT IMPLEMENTATION**: `vite.config.ts` has no server proxy configuration. `readinessService.ts` checks `/api/health` directly against Vite dev server port 3000, failing unless backend is proxied.
- **REAL OR SIMULATED**: **BROKEN INTEGRATION**
- **FILES INVOLVED**: `vite.config.ts`, `src/services/readinessService.ts`
- **BACKEND DEPENDENCY**: FastAPI port 8000
- **MODEL DEPENDENCY**: None
- **PROBLEM**: Frontend cannot communicate with FastAPI during local development.
- **REQUIRED FIX**: Add `/api` proxy target `http://127.0.0.1:8000` in `vite.config.ts`.
- **VALIDATION METHOD**: Run dev server and curl `http://localhost:3000/api/health`; verify 200 OK from FastAPI.
- **STATUS**: **REPAIR REQUIRED (Phase 1)**

---

### Feature 15: Dataset Manifest & Provenance
- **FEATURE**: INCLUDE-50 Dataset Audit & Manifest
- **CURRENT IMPLEMENTATION**: Contains hardcoded sample manifest in `src/data/include50.ts` and documentation in `docs/dataset_setup.md`. Physical `data/raw/` directory is not yet initialized.
- **REAL OR SIMULATED**: **DOCUMENTED BUT UNINSTANTIATED**
- **FILES INVOLVED**: `src/data/include50.ts`, `docs/dataset_setup.md`
- **BACKEND DEPENDENCY**: None
- **MODEL DEPENDENCY**: AI4Bharat INCLUDE-50
- **PROBLEM**: Manifest counts and class distributions must be generated from verifiable files, not static JavaScript arrays.
- **REQUIRED FIX**: Implement `scripts/build_manifest.py` and canonical `config/include50_labels.json`. Generate genuine `data/manifests/include50_manifest.csv` and audit reports.
- **VALIDATION METHOD**: Verify manifest CSV checksums and label mappings match across Python and TypeScript.
- **STATUS**: **REPAIR REQUIRED (Phase 1 & Phase 3)**

---

### Feature 16: Benchmark Evaluation Dashboard Data
- **FEATURE**: Model Comparison Metrics & Confusion Matrix
- **CURRENT IMPLEMENTATION**: `src/data/benchmarkResults.ts` hardcodes static floats for 6 architectures (e.g. 0.851 accuracy, confusion matrix pairs, loss curves).
- **REAL OR SIMULATED**: **STATIC MOCK DATA**
- **FILES INVOLVED**: `src/data/benchmarkResults.ts`, `src/pages/EvaluationDashboard.tsx`
- **BACKEND DEPENDENCY**: None
- **MODEL DEPENDENCY**: None
- **PROBLEM**: Metrics are hardcoded in source code rather than loaded from genuine experiment output files.
- **REQUIRED FIX**: Read experiment results dynamically from `artifacts/experiments/` or backend `/api/experiments` endpoint generated by real training runs.
- **VALIDATION METHOD**: Change training artifact JSON; verify dashboard charts update to reflect actual artifact numbers.
- **STATUS**: **REPAIR REQUIRED (Phase 1 & Phase 6)**

---

### Feature 17: Speech-to-Text Live Captioning
- **FEATURE**: Speech Recognition Engine
- **CURRENT IMPLEMENTATION**: Uses browser `webkitSpeechRecognition` with English and Tamil support. Correctly manages transcripts.
- **REAL OR SIMULATED**: **REAL BROWSER API**
- **FILES INVOLVED**: `src/services/captionService.ts`, `src/pages/LiveCaptions.tsx`, `src/pages/DeafInterface.tsx`
- **BACKEND DEPENDENCY**: Optional local faster-whisper claim
- **MODEL DEPENDENCY**: Web Speech API
- **PROBLEM**: Subsystem status claims local faster-whisper CPU adapter is ready when it is not loaded.
- **REQUIRED FIX**: Clearly report "Browser Speech API (Web Speech)" as the active engine. Only report Faster-Whisper if actually loaded in backend.
- **VALIDATION METHOD**: Speak into microphone; verify live interim and final speech recognition.
- **STATUS**: **REPAIR REQUIRED (Phase 1 & Phase 2)**

---

### Feature 18: Text-to-Speech Engine
- **FEATURE**: Web Speech Synthesis
- **CURRENT IMPLEMENTATION**: Uses browser `window.speechSynthesis` with voice enumeration, pitch, and rate control.
- **REAL OR SIMULATED**: **REAL BROWSER API**
- **FILES INVOLVED**: `src/services/ttsService.ts`
- **BACKEND DEPENDENCY**: None
- **MODEL DEPENDENCY**: System TTS voices
- **PROBLEM**: None in core speech synthesis.
- **REQUIRED FIX**: Preserve and centralize TTS settings (voice, speed, cancellation).
- **VALIDATION METHOD**: Call `ttsService.speak('AccessBridge testing')`; verify audible audio output.
- **STATUS**: **WORKING (Preserve in Phase 2)**

---

### Feature 19: Environmental Loud Sound Detection
- **FEATURE**: Visual Loud Sound Alerts for Deaf Users
- **CURRENT IMPLEMENTATION**: Uses Web Audio API `AudioContext` and `AnalyserNode` to compute RMS/frequency byte amplitude. Triggers visual screen flash and alert on sound spikes > 75%.
- **REAL OR SIMULATED**: **REAL BROWSER API**
- **FILES INVOLVED**: `src/pages/DeafInterface.tsx` (lines 60–98)
- **BACKEND DEPENDENCY**: None
- **MODEL DEPENDENCY**: None
- **PROBLEM**: Code truthfully identifies this as amplitude detection, but cooldown timer needed timestamp stabilization.
- **REQUIRED FIX**: Keep labeled as "Loud Sound Detection". Ensure numeric timestamp cooldowns prevent repeated alert triggers.
- **VALIDATION METHOD**: Clap near microphone; verify single alert card and screen flash trigger.
- **STATUS**: **WORKING (Refine in Phase 2)**

---

### Feature 20: Camera Architecture & Stream Lifecycle
- **FEATURE**: WebRTC Camera Stream Handling
- **CURRENT IMPLEMENTATION**: Individual pages (`SignCommunication.tsx`, `EnvironmentReader.tsx`, `BlindInterface.tsx`, `MuteInterface.tsx`, `BiDirectionalSignTranslator.tsx`) each implement independent `navigator.mediaDevices.getUserMedia` logic with fixed 640x480 constraints.
- **REAL OR SIMULATED**: **FRAGMENTED REAL IMPLEMENTATION**
- **FILES INVOLVED**: 5 separate frontend files
- **BACKEND DEPENDENCY**: None
- **MODEL DEPENDENCY**: None
- **PROBLEM**: Inconsistent stream cleanup, risk of camera device locking between tab navigations, fixed 640x480 resolution forcing.
- **REQUIRED FIX**: Implement centralized `CameraService` with unified track lifecycle, permission management, device switching, and resolution negotiation.
- **VALIDATION METHOD**: Switch rapidly between Blind, Deaf, and Sign tabs; verify video streams start and stop cleanly without hardware leaks.
- **STATUS**: **REPAIR REQUIRED (Phase 2)**

---

## Audit Summary Table

| # | Feature | Subsystem | Current State | Problem | Target Fix | Phase |
|---|---|---|---|---|---|---|
| 1 | Real-time Gesture Classifier | Frontend ML | Heuristic Rules | Fake model output | Real MediaPipe + Checkpoint Inference | Phase 1 & 7 |
| 2 | Sign Landmark Generator | Frontend Vision | `Math.sin`/`Math.cos` | Fake coordinates | Genuine MediaPipe landmarks or null | Phase 1 & 4 |
| 3 | Isolated Sign Prediction | Frontend ML | Trigonometric Hash | Fabricated prediction | Real Model forward pass | Phase 1 & 7 |
| 4 | Two-Way Sign Capture | Frontend Vision | Empty Buffer Timer | Collects 0 frames | Genuine frame buffering | Phase 1 & 4 |
| 5 | Backend Sign Predict API | Backend ML | Modulo frame count | Class = frame_count * 7 | PyTorch forward pass or 503 error | Phase 1 & 5 |
| 6 | Object Detection | Frontend Vision | Contrast Grid Energy | Fake object labels | Lightweight detector / Gemini Vision | Phase 1 & 2 |
| 7 | Document OCR | Frontend Vision | Fake Karunya text | Hardcoded fallback | Genuine error / No text found | Phase 1 & 2 |
| 8 | Assistive Scene Understanding | Backend AI | Missing | Keys not utilized | Server-side Gemini 2.5 Flash | Phase 1 & 2 |
| 9 | Training Job Scheduler | Backend API | Fake 85.1% return | No actual training | Real multiprocessing background job | Phase 1 & 5 |
| 10 | Training CLI Script | Backend ML | Mock print statements | No real training code | Real training script across 6 models | Phase 1 & 5 |
| 11 | Data Science Lab UI | Frontend UI | JavaScript timer | Fake training progress | Polling real backend training jobs | Phase 1 & 5 |
| 12 | Readiness Diagnostics | Backend & UI | Hardcoded "ready" | Falsely claims readiness | Check physical model files on disk | Phase 1 |
| 13 | Signing Avatar & VRM | Frontend 3D | Procedural cylinders | Hello fallback; VRM unused | Load user VRM file; show unavailable | Phase 1 & 8 |
| 14 | Dev Server API Proxy | Tooling / Vite | Missing `/api` proxy | Backend unreachable | Configure Vite proxy to :8000 | Phase 1 |
| 15 | Dataset Manifest | Data Science | Hardcoded sample | No verified CSV | Build real manifest & label mapping | Phase 3 |
| 16 | Benchmark Dashboard | Data Science UI | Static JSON in code | Hardcoded metrics | Load from experiment artifacts | Phase 6 |
| 17 | Speech-to-Text | Frontend Audio | Real Web Speech API | Falsely claims Whisper ready | Truthful labeling: Browser STT | Phase 1 & 2 |
| 18 | Text-to-Speech | Frontend Audio | Real Web Speech API | Working | Preserve and standardize settings | Phase 2 |
| 19 | Sound Radar Alert | Frontend Audio | Real AnalyserNode | Working | Timestamp debouncing | Phase 2 |
| 20 | Camera Architecture | Frontend Video | Fragmented across pages | Device locking risk | Centralized CameraService | Phase 2 |
