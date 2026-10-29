# AccessBridge: Multimodal Assistive Communication & Environment Awareness System

**B.Tech CSE (Artificial Intelligence & Machine Learning) Data Science Project**  
**Karunya Institute of Technology and Sciences**

AccessBridge is an open-source, accessible, multimodal assistive communication and physical environment awareness application. It bridges communication gaps for Deaf, Mute, and Blind individuals through real-time sign language synthesis and recognition, live speech captioning, obstacle narration, and printed text reading.

---

## 1. Core Assistive Interfaces

1. **Deaf Assist (Visual-First)**:
   - High-contrast live speech captions with multi-language transcription (`en-IN`, `ta-IN`, `hi-IN`).
   - Environmental sound alert indicators (speech, alarm, doorbell, loud sounds).
   - Bi-directional text-to-sign translation with 3D VRM avatar playback and 26-handshape manual alphabet fingerspelling.
2. **Mute Assist (Sign-to-Speech & AAC)**:
   - Real-time ISL sign translation with continuous live hand tracking.
   - 32-frame sliding inference window paired with PyTorch deep learning models (1D-CNN Champion Model, Compact Transformer, Bi-GRU, Bi-LSTM).
   - Augmentative and Alternative Communication (AAC) phrase soundboard with soft natural female speech.
   - In-app sign sample recording interface for continuous dataset expansion.
3. **Blind Assist (Spatial Audio & OCR)**:
   - 3-tier environment perception: Local MediaPipe ObjectDetector (~8 FPS), rule-based spatial narrator (`left`, `ahead`, `right`, distance, priority), and cloud Gemini scene descriptions.
   - Built-in Voice Command System (18 commands, fuzzy matching, optional wake word `"bridge"`).
   - Camera-based printed document reader powered by Tesseract OCR (English & Tamil).
   - Safety Standard: Explicitly says *"No obstacles detected in view"*, NEVER *"Path is clear"*.
4. **Technical Processor & Research Lab**:
   - Live hardware telemetry: measured FPS via `performance.now()`, timed inference latency, and heap memory usage.
   - Dynamic Model Swapper: atomically activates and smoke-tests checkpoints with instant rollback on failure.
   - Model Evaluation Dashboard and Data Science training pipeline with signer-wise splitting.

---

## 2. Research Benchmark: Controlled Greeting Subset (Real Data)

The models in this repository are trained on the curated **`INCLUDE-GREETING-SUBSET-v1`** dataset (5 classes: *Hello*, *How are you*, *Alright*, *Good Morning*, *Good afternoon*) comprising **106 video clips** (75 train, 15 validation, 16 held-out test). Evaluated on an Intel Core CPU (single-core inference mode, 10 warmup runs):

| Architecture | Input Representation | Test Accuracy | Macro-F1 | Macro Precision | Macro Recall | Inference Latency | Parameters |
| :--- | :---: | :---: | :---: | :---: | :---: | :---: | :---: |
| **1D-CNN (Champion)** | Sequential `(32, 138)` | **87.5%** | **0.883** | 0.883 | 0.883 | **1.02 ms** | 118,213 |
| **Random Forest** | Classical `(291,)` Tabular | **87.5%** | 0.874 | 0.900 | 0.883 | 79.26 ms | N/A (150 Trees) |
| **Bi-GRU** | Sequential `(32, 138)` | **87.5%** | 0.865 | 0.883 | 0.867 | 10.07 ms | 328,325 |
| **Compact Transformer** | Sequential `(32, 138)` | **81.2%** | 0.815 | 0.833 | 0.817 | 2.26 ms | 424,069 |
| **SVM (RBF Kernel)** | Classical `(291,)` Tabular | **68.8%** | 0.655 | 0.790 | 0.683 | 0.45 ms | N/A (Scikit-Learn) |
| **Bi-LSTM** | Sequential `(32, 138)` | **62.5%** | 0.650 | 0.680 | 0.650 | 3.26 ms | 429,317 |

### Target Benchmark: AI4Bharat INCLUDE-50 (Roadmap Milestone, Not Achieved Locally)
The full AI4Bharat INCLUDE-50 benchmark represents 50 distinct sign classes (~3,420 clips, 684 test clips). Achieving real deep learning weights across all 50 vocabulary items is an ongoing project roadmap milestone and is **not yet achieved** in local checkpoints. Words outside the 5 trained greeting classes automatically fall back to the 26-handshape manual alphabet fingerspelling engine.

---

## 3. Quick Start & Setup Guide

### Prerequisites
- **Node.js**: v18.0.0 or later (v20+ recommended)
- **Python**: v3.10, v3.11, or v3.12
- Modern desktop browser with WebGL 2.0 and Web Audio API enabled.

### Installation

1. **Clone the repository**:
   ```bash
   git clone https://github.com/your-username/accessbridge.git
   cd accessbridge
   ```

2. **Configure Environment Secrets**:
   Copy the `.env.example` file to `.env`:
   ```bash
   cp .env.example .env
   ```
   Edit `.env` to configure your keys:
   ```env
   # Google Gemini API Keys (supports comma-separated keys for auto-rotation and cooldown on 429/quota limits)
   GEMINI_API_KEY="AIzaSyA...,AIzaSyB..."

   # Optional Premium TTS (Leave empty to use client browser speech synthesis)
   ELEVENLABS_API_KEY=""
   GOOGLE_TTS_API_KEY=""
   ```

3. **Install Dependencies**:
   ```bash
   # Frontend dependencies
   npm install

   # Backend Python dependencies
   pip install -r backend/requirements.txt
   ```

### Running the Application

- **One-Click Startup (Windows)**:
   Double-click `start_accessbridge.bat` or execute:
   ```cmd
   .\start_accessbridge.bat
   ```

- **Manual Terminal Startup**:
   - **Terminal 1 (Backend)**:
     ```bash
     uvicorn backend.app.main:app --host 0.0.0.0 --port 8000 --reload
     ```
   - **Terminal 2 (Frontend)**:
     ```bash
     npm run dev
     ```
   Open [http://localhost:3000](http://localhost:3000) or [http://localhost:5173](http://localhost:5173) in your browser.

---

## 4. Supported Browsers & Permissions

| Browser | OS | Web Speech API | Camera & Mic | WebGL 2.0 (3D Avatar) | Offline Mode |
| :--- | :--- | :---: | :---: | :---: | :---: |
| **Google Chrome** | Windows, macOS, Linux, Android | Full (Native) | Full | Full | Yes |
| **Microsoft Edge** | Windows, macOS, Android | Full (Natural Voices) | Full | Full | Yes |
| **Mozilla Firefox** | Windows, macOS, Linux | Backend STT Fallback | Full | Full | Yes |
| **Brave** | Windows, macOS, Android | Full (Allow Mic Shield) | Full | Full | Yes |

*Note: For camera and microphone access, the application must be served over `localhost` or an `https://` origin.*

---

## 5. Keyboard Navigation & Accessibility Shortcuts

- **`Alt + 1`**: Navigate to Deaf Assist (Captions & Sound Flasher)
- **`Alt + 2`**: Navigate to Mute Assist (Sign-to-Speech & Soundboard)
- **`Alt + 3`**: Navigate to Blind Assist (Spatial Narrator & OCR)
- **`Alt + 4`**: Navigate to Technical Processor Panel
- **`Alt + 5`**: Open Data Science Lab
- **`Alt + 6`**: Open Evaluation Benchmarks Dashboard
- **`Alt + 7`**: Open Accessibility Settings
- **`Alt + 8`**: Open Subsystem Diagnostics Audit

---

## 6. Known Limitations & Honest Disclosures

1. **Sign Recognition Scope**:
   - Real PyTorch inference models are currently trained on the 5-class greeting subset (*Hello*, *How are you*, *Alright*, *Good Morning*, *Good afternoon*).
   - Real-time camera gesture detection in `realtimeHandTracker.ts` operates via a **Geometric Rule Heuristic (demo)** when full 32-frame sequential windows are not yet confirmed by the backend.
   - All unsupported sign vocabulary items automatically fall back to the 26-handshape manual alphabet fingerspelling engine (0.4 s hold per letter).
2. **Avatar Motion Review Status**:
   - 3D motion clips are extracted from video demonstrations and smoothed with One-Euro filters. Every clip is marked as *"pending review by an ISL signer"*.
3. **Internet & Offline Behavior**:
   - **Offline Capable (Wi-Fi off)**: 3D avatar playback, manual fingerspelling, local browser TTS, Web Speech captions (where cached by browser), MediaPipe object detection, and rule-based spatial narration operate completely offline without internet.
   - **Cloud Dependent**: Gemini scene descriptions, complex NLP voice command fallbacks, and ElevenLabs voices require internet connectivity and an active API key. When offline, all features degrade gracefully without crashing.

---

## 7. Final Verification Checklist

| Subsystem / Feature | Test Procedure | Expected Behavior | Status |
| :--- | :--- | :--- | :---: |
| **Live Captions** | Click "Start Listening" in Deaf Assist | Continuous transcription with 250ms auto-restart; anti-echo pauses when TTS speaks | **PASS** |
| **Soft Female Voice** | Click "Test voice" in Settings | Speaks in soft natural female voice (Neerja/Pallavi/Aria); rate 0.92, pitch 1.12 | **PASS** |
| **Voice Commands** | Say "describe", "read this", "sign hello" | Evaluates utterance via fuzzy Levenshtein; spoken & visual confirmation shown | **PASS** |
| **Environment Narrator** | Point webcam at objects in Blind Assist | Tier 1 MediaPipe detections; Tier 2 direction & distance narration; urgent/normal cooldowns | **PASS** |
| **Safety Standard** | Clear camera view in Blind Assist | Announces *"No obstacles detected in view."*, NEVER *"Path is clear"* | **PASS** |
| **Avatar Smoothness** | Play sign in Sign Communication | Single render loop in VrmAvatar; dt <= 0.05; 0.25s slerp blend; lip-sync visemes | **PASS** |
| **Fingerspelling** | Enter unsupported word e.g. "Hospital" | Generates 26-handshape manual alphabet sequence (0.4s/letter); honest badge shown | **PASS** |
| **Model Swapper & Rollback** | Swap engine in Processor Panel | Calls `POST /api/models/activate`; invalid checkpoint triggers automatic rollback | **PASS** |
| **Diagnostics Page** | Open `Alt + 8` Diagnostics | Probes mic, camera, WebGL, TTS, backend, and keys; shows green/amber/red with fix hints | **PASS** |
| **Error Boundaries** | Trigger error or WebGL failure | Shows friendly "Component temporarily unavailable" card with "Try again" button | **PASS** |
| **Offline Mode** | Turn Wi-Fi off or block cloud endpoints | Graceful fallback to local spatial narrator, browser TTS, and offline manual fingerspelling | **PASS** |
| **Denied Permissions** | Block camera/mic in browser settings | Clear, non-alarming instructions (*"Microphone blocked: click lock icon to allow"*) | **PASS** |
| **Missing API Keys** | Clear `GEMINI_API_KEY` in `.env` | Seamless fallback to local rule-based narrator without raw 404/500 errors | **PASS** |
| **TypeScript / Build** | Run `tsc --noEmit` & `npm run build` | 0 type errors; production bundle built cleanly in Vite | **PASS** |
