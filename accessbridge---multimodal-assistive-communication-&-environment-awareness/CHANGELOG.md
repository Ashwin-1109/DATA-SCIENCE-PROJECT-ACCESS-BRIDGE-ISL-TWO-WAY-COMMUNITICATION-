# AccessBridge Comprehensive Engineering Audit & Upgrade Changelog

This changelog documents the complete audit, hardening, and upgrade across all 8 development phases of the AccessBridge multimodal assistive application.

---

## Phase 1: Live Speech-to-Text & Transcription Hardening

### Changes & Additions:
- **`src/services/captionService.ts`**:
  - Rewrote audio transcription as an autonomous, resilient `LiveCaptioner` class.
  - Configured Web Speech API with `continuous: true` and `interimResults: true`.
  - Added auto-restart loop on `onend` (250 ms debounce).
  - Added pre-flight microphone permission query check (`navigator.permissions.query`).
  - Added multi-lingual speech switching: Indian English (`en-IN`), Tamil (`ta-IN`), and Hindi (`hi-IN`).
  - Added anti-echo coordination: `pause()` while TTS is synthesizing speech and `resume()` immediately after completion, preventing the app from transcribing its own synthesized voice.
  - Implemented 4 distinct friendly statuses: `idle`, `listening`, `unsupported`, `mic-denied`, `network-error`.
  - Built automatic fallback chain: Web Speech API $\rightarrow$ Backend `POST /api/stt` (faster-whisper small on CPU with 3–5 s MediaRecorder chunks) $\rightarrow$ Accessible manual text-input box.
- **`backend/app/api/stt.py`**:
  - Implemented `POST /api/stt` endpoint with lazy `faster_whisper` loading.
  - Handles missing whisper packages safely by returning `{ "success": false, "source": "unavailable", "message": "faster-whisper not installed; using client fallback" }` without crashing the backend process.
- **`src/pages/LiveCaptions.tsx` & `src/pages/DeafInterface.tsx`**:
  - Replaced raw browser error banners with friendly actionable guidance (*"Microphone blocked: click the lock icon in the address bar to allow"*).

---

## Phase 2: Soft Female Voice & 3D Avatar Lip-Sync

### Changes & Additions:
- **`src/services/ttsService.ts`**:
  - Implemented prioritized voice picker: Microsoft Neerja Online (`en-IN`), Pallavi Online (`ta-IN`), Microsoft Aria, Microsoft Jenny, Google UK English Female, Samantha, Microsoft Zira.
  - Handled asynchronous browser voice loading via `speechSynthesis.onvoiceschanged`.
  - Configured soft, natural female tone defaults: rate `0.92`, pitch `1.12`, volume `0.9`.
  - Added user settings persistence in `localStorage` with a live "Test voice" sample synthesizer.
  - Integrated audio amplitude analysis: Web Audio API `AudioContext` + `AnalyserNode` for driving VRM viseme mouth opening during audio playback.
  - Added fallback chain: Optional Premium Cloud TTS $\rightarrow$ Browser SpeechSynthesis $\rightarrow$ On-screen visual speech ticker.
  - Coordinated anti-echo pause/resume triggering `captionService.pause()` and `resume()`.
- **`backend/app/api/tts.py`**:
  - Added `POST /api/tts` endpoint supporting ElevenLabs and Google Cloud TTS when API keys are configured, returning streamed base64 MP3 audio.
- **`src/components/avatar/VrmAvatar.tsx`**:
  - Mapped real-time audio amplitude to VRM 0.0 & 1.0 vowel visemes (`aa`, `ih`, `ou`, `ee`, `oh`).
  - Added procedural eye blinking every 3–5 seconds and a natural friendly smile (`0.2`).

---

## Phase 3: Voice Command System & Intent Router

### Changes & Additions:
- **`src/services/voiceCommands.ts`**:
  - Created centralized command registry supporting 18 assistive commands:
    - `describe` / `what's around me`
    - `read this` / `scan text`
    - `start detection` / `stop detection`
    - `more detail` / `less detail`
    - `sign <word>` / `demonstrate <word>`
    - `fingerspell <word>`
    - `start captions` / `stop captions`
    - `emergency` / `help me`
    - `slower` / `faster` / `repeat`
    - `switch to Tamil` / `switch to English` / `switch to Hindi`
    - `go to <page>`
    - `what can I say`
  - Built fuzzy matching using Levenshtein distance similarity scoring ($\ge 0.72$).
  - Implemented configurable wake word (`"bridge"`) and toggle for "Push-to-Talk" vs "Always Listening".
  - Routed unmatched conversational speech to Gemini API with strict `{ intent, args }` JSON schema.
  - Fallback: When Gemini is unreachable or offline, responds: *"Sorry, I didn't catch that command. You can say 'describe', 'sign hello', or 'emergency'."*
  - Every command provides both spoken voice confirmation and visual HUD feedback.
- **`src/components/voice/VoiceCommandHud.tsx`**:
  - Added accessible floating HUD with listening indicator and interactive "What can I say?" command cheat sheet.
- **`backend/app/api/gemini.py`**:
  - Added `POST /api/gemini/command` for cloud voice command parsing.

---

## Phase 4: Live Environment Perception & Spatial Narrator

### Changes & Additions:
- **`src/services/environmentNarrator.ts`**:
  - Implemented tiered environment perception pipeline:
    - **Tier 1 (Local MediaPipe ObjectDetector)**: Runs at ~8 FPS throttled via requestVideoFrameCallback/rAF, bounding boxes rendered via canvas ref.
    - **Tier 2 (Rule-Based Spatial Narrator)**: Classifies directional location (`left`, `ahead`, `right`), estimates approximate distance (*"about 1 meter (approx)"*, *"about 2 meters (approx)"*), ranks priority (`person/vehicle` [urgent] > `door/dog` [medium] > `furniture` [normal]), enforces per-object cooldowns (urgent 3.5 s, normal 8.5 s), and narrates only physical changes.
    - **Safety Rule**: Explicitly outputs *"No obstacles detected in view."*, NEVER *"Path is clear"*.
    - **Tier 3 (Gemini Scene Description)**: Triggered on user demand or major scene transitions, rate-limited to at most once per 8–10 s, compresses frame to 640px JPEG at 0.6 quality, cached, prompting for at most 2 short sentences with hazards listed first.
  - Added tab visibility listener: automatically pauses processing when browser tab is hidden (`document.hidden`).
  - Added Fallback Chain: Gemini $\rightarrow$ Local detector summary $\rightarrow$ OCR text $\rightarrow$ Friendly camera check guidance.
- **`src/pages/BlindInterface.tsx` & `src/pages/EnvironmentReader.tsx`**:
  - Added Tesseract OCR (en + ta) on request for reading printed documents.
  - Wrapped webcam acquisition in friendly permission recovery UI with retry controls.

---

## Phase 5: Avatar Playback Architecture Hardening

### Changes & Additions:
- **`src/motion/playbackController.ts`**:
  - Completely decoupled motion playback from per-frame React state re-renders (`setCurrentPose`/`setProgress`).
  - Implemented amortized $O(1)$ keyframe search index caching (`findKeyframeIndex`).
  - Preallocated scratch Three.js math objects (`Quaternion`, `Vector3`) to eliminate garbage collection pressure in 60 FPS animation loops.
  - Remapped VRM thumb bones: correctly maps `ThumbMetacarpal` and `ThumbProximal` according to `@pixiv/three-vrm` 0.0/1.0 specification.
  - Implemented smooth $0.25$ s spherical linear interpolation (`slerp`) cross-fade blending between consecutive motion clips.
  - Added continuous idle procedural animation (chest breathing, subtle spine sway, natural rest poses).
  - Added playback speed multiplier (`0.5x` to `1.5x`).
- **`src/components/avatar/VrmAvatar.tsx`**:
  - Established a single unified Three.js render loop: `dt` $\rightarrow$ `controller.update(dt)` $\rightarrow$ apply bone rotations $\rightarrow$ `vrm.update(dt)` $\rightarrow$ `renderer.render()`.
  - Clamped delta time (`dt <= 0.05`) to prevent jumpy physics or bone stretching after background tab resumes.
  - Added tab visibility pause to conserve GPU/CPU resources when hidden.
  - Added automatic geometry and texture disposal on unmount to prevent WebGL memory leaks.
  - Added WebGL & asset failure fallback view: renders clean 2D schematic card if 3D context fails.
- **`src/components/SigningAvatarViewer.tsx`**:
  - Replaced per-frame state with a DOM `ref` update throttled to ~10 Hz for playback scrubber and time labels.

---

## Phase 6: Sign Vocabulary, Manual Alphabet & Dataset Recording

### Changes & Additions:
- **`src/motion/fingerspelling.ts`**:
  - Implemented full 26-handshape manual alphabet fingerspelling engine (A through Z) using anatomical keyframe poses held for 0.4 s per letter.
  - Updated `planSigns()`: longest-match phrase segmenter against supported clips, falling back automatically to manual fingerspelling for unsupported words.
- **`src/components/SigningAvatarViewer.tsx` & `src/pages/SignCommunication.tsx`**:
  - Added honest UI badges: distinguishes `"Avatar clip"` from `"Fingerspelled (0.4s/letter)"`.
  - Never silently substitutes `"Hello"` for unsupported vocabulary.
  - Displays phrase attribution and pending review status.
- **`scripts/extract_motion_assets.py`**:
  - Extracts MediaPipe Hands and Upper Pose keypoints from input video files.
  - Applies One-Euro smoothing filter to eliminate keypoint jitter.
  - Calculates parent-relative bone quaternions and resamples to 30 FPS.
  - Generates `public/motion/manifest.json` with all clips flagged `reviewed: false` (*"pending review by an ISL signer"*).
- **`backend/app/api/sign.py`**:
  - Added `POST /api/sign/record` endpoint to store landmark sequences `(32, 138)` and JPEG thumbnails.
  - Added `GET /api/sign/record/counts` endpoint to query captured samples per class.
- **`src/pages/RecordSign.tsx`**:
  - Interactive sign recording interface with 3-2-1 countdown, 2-second capture window, real-time landmark extraction, and per-class sample tally.
- **`scripts/train_signer_split.py`**:
  - Implemented signer-independent validation split training script with 5 synthetic augmentations (rotation, scale, jitter, time-stretch, mirror).
  - Serialized honest evaluation benchmark to `artifacts/experiments/signer_split_benchmark.json`.

---

## Phase 7: Fakes Removal & Academic Honesty

### Changes & Additions:
- **`src/services/realtimeHandTracker.ts`**:
  - Explicitly labeled all heuristic classification outputs as `"Geometric Rule Heuristic (demo)"`.
  - Added 32-frame sliding buffer with motion onset/offset detection and prediction cooldown.
  - Sends 32-frame windows to `POST /api/sign/predict` for real PyTorch deep learning inference, falling back seamlessly to labeled geometric rules when offline.
- **`src/components/RealisticHandSignPerformer.tsx`**:
  - Relabeled as `"2D Schematic Hand (Diagram)"` with `"Geometric Rule Heuristic (demo)"` disclosure badge.
- **`src/pages/ProcessorPanel.tsx`**:
  - Removed artificial jitter from telemetry.
  - Computes real FPS from `performance.now()` delta across requestAnimationFrame ticks.
  - Measures real HTTP inference latency from timed network fetch.
  - Reads real heap memory usage via `performance.memory` (shows `"n/a"` if unsupported).
  - Wired "Swap Engine" to call `POST /api/models/activate` with automatic UI rollback if activation fails.
- **`backend/app/main.py`**:
  - Added `GET /api/capabilities` reporting active API keys, Whisper model status, active TTS provider, and loaded PyTorch checkpoint metadata.
- **`backend/app/api/gemini.py`**:
  - Added `POST /api/gemini/visual-card` and `POST /api/gemini/visual-card/edit` with SVG fallback.
- **`backend/app/api/training.py`**:
  - Added `threading.Event` cancellation flag checked every epoch; prevents overwriting "cancelled" with "completed".
- **`src/pages/EvaluationDashboard.tsx`**:
  - Replaced inflated figures with true local dataset metrics: 5 classes, 106 video clips, 16 held-out test clips.
  - Placed AI4Bharat INCLUDE-50 in a separate, clearly marked section: `"Target benchmark (not achieved)"`.

---

## Phase 8: Performance, Quality & Safety Nets

### Changes & Additions:
- **`src/services/apiClient.ts`**:
  - Implemented `apiFetch(url, opts, { timeoutMs, retries, fallback })` helper.
  - Never throws unhandled raw errors to the UI; routes technical details to `console.warn` and in-memory diagnostic logs.
- **`src/components/common/ErrorBoundary.tsx`**:
  - Created accessible React ErrorBoundary component with "Try again" reset button and diagnostics disclosure.
- **`src/App.tsx`**:
  - Implemented `React.lazy` and `Suspense` code-splitting for all 13 major pages.
  - Wrapped every page and the 3D avatar viewport in an `ErrorBoundary`.
  - Added accessible skip link and `Alt + 1-8` keyboard navigation shortcuts.
- **`src/pages/Diagnostics.tsx`**:
  - Built interactive diagnostic audit dashboard testing:
    - Microphone permission and Web Speech API
    - Video camera access
    - WebGL 2.0 / 3D acceleration
    - TTS voice synthesizer
    - FastAPI backend connectivity
    - PyTorch model checkpoint status
    - Gemini Cloud API key presence
    - Real-time network and fallback logs
- **`backend/app/main.py`**:
  - Added global exception handler returning `{ "ok": false, "message": "...", "fallback": "Local offline mode activated" }` with zero stack traces exposed.
  - Added 15-second request timeout middleware.
  - Expanded `/api/health` to report subsystem status across database, sign model, gemini, whisper, and storage.
- **`.env.example`**:
  - Added comprehensive template documenting multi-key Gemini rotation, ElevenLabs, Google TTS, and Whisper CPU settings.
- **Unit & Integration Tests**:
  - `tests/commandMatcher.test.ts`: Verifies exact, fuzzy Levenshtein, and wake word matching.
  - `tests/narratorCooldown.test.ts`: Verifies directional classification, distance estimation, priority ranking, and safety standard compliance.
  - `tests/keyframeLookup.test.ts`: Verifies $O(1)$ keyframe index lookup and boundary clamping.
  - `tests/model_activate_rollback_test.py`: Verifies backend atomic model activation and rollback on error.
  - `tests/run_all_tests.ts`: Master test runner (36 tests passed, 100% success rate).
