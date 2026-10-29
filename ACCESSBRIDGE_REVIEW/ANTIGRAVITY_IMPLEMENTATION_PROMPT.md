# Antigravity implementation prompt: AccessBridge complete V1

You are implementing and verifying the existing AccessBridge application as a senior full-stack engineer with experience in Three.js/VRM animation, computer vision, ML deployment, and accessible interaction. Make the changes in the existing project and deliver a runnable application. Do not stop after a plan, visual redesign, scaffolding, or an avatar-only fix.

## Objective and workspace

Project root:
`D:\DS MICRO PROJECT\accessbridge---multimodal-assistive-communication-&-environment-awareness`

User's required avatar:
`D:\DS MICRO PROJECT\3477026897357566765.vrm`

Existing app copy:
`public/models/avatar.vrm`

Source video dataset:
`D:\DS MICRO PROJECT\Greetings_1of2\Greetings`

Read these audit files first, then verify the relevant current source yourself:
`D:\DS MICRO PROJECT\ACCESSBRIDGE_REVIEW\ANALYSIS.md`
`D:\DS MICRO PROJECT\ACCESSBRIDGE_REVIEW\evidence.json`

Build the best complete V1 that the actual data supports: the supplied VRM, real live body/hand tracking, coordinate-driven motion, five-greeting local recognition, text/speech-to-motion playback, Local/Gemini/Hybrid modes, working assistive workflows, and truthful research tooling. Expand beyond the five trained labels only when the required data, checkpoints, and motion assets actually exist. Preserve the original avatar, videos, current datasets, checkpoints, and user work; write changed datasets and training artifacts under new versioned paths.

## Verified starting facts

- Stack: React 19, TypeScript, Vite, Three.js, React Three Fiber, FastAPI, NumPy, PyTorch, scikit-learn, Tesseract.js.
- `@pixiv/three-vrm` is installed. The two avatar files are identical: SHA-256 `28e2d34c84856f09abd92672b5d0b83614cb5794a3421e5674e6e2daac4dd4a1`.
- The avatar is VRM 0.0, 18,900,420 bytes, 54 humanoid bone mappings, complete mapped finger chains, facial blend shapes, three meshes/skins, and no embedded animation clips.
- `SignViewer.tsx` renders a procedural character. It requests missing `/models/signs/*.glb` files and never mounts a loaded GLTF scene. `SigningAvatarViewer.tsx` is a separate procedural rig. `public/models/avatar.gltf` is a meshless placeholder.
- Frontend tracking is not wired to actual MediaPipe detectors. Several camera paths record null landmarks; MuteInterface still creates synthetic points.
- The real local dataset has 106 clips for Hello, How are you, Alright, Good Morning, Good afternoon. Splits: 75 train, 15 validation, 16 test. Do not confuse those class IDs with the separate 50-word demo vocabulary.
- Six checkpoint files exist. Active configuration selects five-class `cnn1d_best.pth`. Saved benchmark figures are not a substitute for evaluating the exact current artifact and live preprocessing.
- Stored sequence arrays are `(N,32,138)` and tabular arrays `(N,291)`. Existing hand normalization and live inference do not match. Hand and pose channels also use inconsistent coordinate conventions.
- Existing Gemini endpoints handle scene descriptions only. Gemini signing, text planning, local detector, and local Whisper flows are not fully implemented.
- Standard npm scripts fail in this Windows folder because of `&` in the path; direct Node entrypoints for TypeScript and Vite pass. Correct the scripts without requiring a project rename.

Inspect existing `AGENTS.md` instructions if present. Do not repeat outdated audit claims without checking the current code. Do not print, copy into reports, or expose environment secrets.

## 1. Establish the architecture and capability contracts

Create a short implementation checklist covering every existing navigation page and control. Preserve useful UI and replace disconnected implementations with shared services. Keep the current stack unless a demonstrated incompatibility requires a small, documented change.

Use one source of truth for:
- Active model ID, checkpoint hash, architecture parameters, ordered class labels, feature-schema version, preprocessing version, supported modalities, rejection policy, and run ID.
- Motion catalog: clip ID, language, phrase/gloss, source asset ID, duration, fps/timestamps, coordinate schema, checksum, review state, and source/license metadata that has actually been verified.
- Provider capability/status: local model loaded, tracker initialized, VRM loaded, cloud configured, service reachable, unsupported/unavailable/error states.

Keep classification, animation, and language planning separate. Recognition produces labels; a retargeter produces poses; a text planner selects existing motion IDs. Do not claim that a classifier generates animation.

Suggested boundaries, adapted to existing conventions:
`src/components/avatar/VrmAvatar.tsx`, `src/services/landmarkTrackingService.ts`, `src/motion/retargeter.ts`, `src/motion/coordinates.ts`, `src/motion/playbackController.ts`, `src/services/aiProviderService.ts`, shared settings/capability state, and a backend model registry/shared preprocessing module.

## 2. Load and animate the exact supplied VRM

Replace both visible procedural avatar implementations with one reusable renderer. Use `GLTFLoader` registered with `VRMLoaderPlugin`. Load `/models/avatar.vrm`, retrieve the VRM object, mount `vrm.scene`, apply `VRMUtils.rotateVRM0(vrm)` once as appropriate, and use normalized humanoid bones. Check the installed library types and official documentation for exact APIs and thumb-name remapping.

Maintain a single animation owner per avatar instance. Apply solved normalized poses before `vrm.update(delta)`. Do not also animate incompatible raw bones or let several effects fight over the same joints. Preserve materials, morph targets, skinning, and spring behavior unless a measured issue requires adjustment.

Add visible loading, progress, retry, and useful asset error states. Frame the upper body, face, and complete signing space with hands visible at supported aspect ratios. Provide front view, optional hand close-up, reset camera, and debug skeleton overlay. Do not replace a failed load with another character disguised as success. Dispose GPU resources and animation callbacks safely, including React Strict Mode mount/unmount cycles; do not dispose a shared cached asset while another view uses it.

Acceptance: the user's actual character renders on every applicable page. A failed `/models/signs/*.glb` request is no longer required for normal operation. Loading a VRM with zero clips succeeds. A controlled pose changes both arms, wrists, and all finger chains visibly.

## 3. Implement actual tracking and coordinate-to-bone retargeting

Use a compatible real MediaPipe Tasks Vision hand and pose pipeline, or a justified equivalent. Keep two hands, full body pose, timestamps, handedness scores, visibility/presence, image dimensions, preview mirror state, and both image/world coordinates when available. Serve necessary model/WASM assets predictably; document downloads and confirm local operation after assets are provisioned.

Use one shared camera/tracker service across SignCommunication, MuteInterface, RealTimeSignSystem, and BiDirectionalSignTranslator. Wait for video metadata and detector readiness. Process each video frame at most once using monotonic timestamps. Move synchronous inference off the main thread where feasible, cap work, and skip stale frames under load. Release streams, workers, detectors, listeners, timers, and pending callbacks when stopped or unmounted.

Never synthesize landmark detections, hand-presence flags, or model confidence. Missing observations must stay explicitly missing. Separate a mirrored preview from anatomical left/right and inference coordinates.

Implement a documented motion frame schema independent of the classifier tensor. Clearly distinguish:
- Image-normalized xy and relative depth.
- Hand-centered world landmarks.
- Hip-centered pose world landmarks.
- Avatar/model world and parent-local coordinates.

Register hand-local motion to the corresponding pose wrist with a calibrated transform and compatible scale; do not concatenate independent world spaces or blindly subtract shoulder z from hand-relative z. Prefer body pose for arm placement and hand-local structure for fingers. Retain quality flags for uncertain reconstruction. Validate mirrored and unmirrored input with visible anatomical left/right tests.

Retargeting requirements:
- Calibrate the subject's neutral pose and capture avatar normalized rest transforms and bone lengths.
- Solve torso/shoulder orientation, upper arm, forearm, and wrist from registered observations. Use elbow-plane constraints or two-bone IK to resolve twist and stabilize bends. Handle straight-arm singularities and degenerate vectors.
- Derive palm orientation from a consistent orthonormal basis, for example wrist plus index/middle/little MCP points; verify handedness-specific normals rather than using one sign convention for both hands.
- Drive three joints for each finger from adjacent landmark segments and joint angles, with thumb opposition/abduction and rest-axis differences handled explicitly.
- Convert desired orientations to parent-local rotations, including rest-basis corrections. `qLocal = inverse(qParentWorld) * qDesiredWorld` is only the coordinate conversion step; preserve the bind/rest transform conventions and verify multiplication order with tests.
- Use quaternions, time-aware filtering, plausible joint limits, bone-length preservation, and bounded tracking-loss recovery. Never stretch the avatar to raw landmark positions.
- Hold briefly on a short dropout, then relax affected joints toward neutral; do not snap, retain stale active signing indefinitely, or move an occluded hand to the origin.
- Add measured tracking FPS/latency, calibration/reset, mirroring toggle, and a source-landmark overlay for diagnosis.

Live mirror mode must work without a classifier or Gemini. Target smooth interactive rendering on the user's hardware; report measured performance rather than inventing a fixed 30/60 FPS badge.

## 4. Turn the existing coordinates and videos into motion assets

Inspect the available `.npy` sequences and handwritten `islAnimationCatalogue.ts` keyframes. Provide a diagnostic importer for the known legacy schema where useful, with explicit limits: 32-frame resampling, mixed hand/pose conventions, missing original timing/masks, and no face data. Do not apply those 138 values as bone rotations or interpret the 291 summary features as motion.

For the production motion catalog, re-extract available source videos at useful temporal resolution and preserve timestamps, raw observations, full pose including wrists, and observation quality. Choose representative training/reference clips with good tracking quality; keep held-out recognition evaluation material separate. Save raw motion and calibrated/retargeted clips in a versioned format with provenance. Do not overwrite old recognition tensors as a side effect of animation preparation.

Create playable assets for all five existing greetings, with source-video comparison. Preserve pauses and handshapes; trim only with a reproducible policy. Use gentle transitions without changing contact-sensitive portions of a sign. Record head/face motion where supported; do not claim full nonmanual linguistic fidelity without the necessary data and review.

Keep all generated or source-derived signs `unreviewed` until actual review evidence exists. Remove unsupported peer-reviewed labels, invented reviewers, and fabricated source sample IDs. Verify real dataset/avatar usage metadata before redistribution; do not assume a code repository's license covers every asset.

## 5. Repair real ML recognition and training

Create one versioned preprocessing implementation shared by video extraction, training, validation, and inference. Enforce exact landmark order, coordinate meaning, masks, normalization, missing-data policy, and resampling. Fix the current long-gap interpolation and absent-hand normalization bugs. Validate finite values, bounded payload size, landmark counts, increasing timestamps, minimum usable duration, and appropriate one-/two-hand coverage.

Do not silently change the meaning of `(32,138)` while continuing to use legacy weights. Either retain an explicit legacy-compatible path or regenerate data and train new versioned checkpoints after fixing the schema. Test training/live tensor equivalence using identical recorded observations. Store all preprocessing and architecture parameters with each checkpoint.

Load the actual CNN and other compatible saved models; verify output dimensions and class order. Add a registry and atomic activation API. Resolve models by known IDs, not arbitrary client-supplied filesystem paths. Build a new instance and smoke-test it before swapping; keep the previous instance if loading fails. Make status and vocabulary endpoints return the active model's five actual labels. Wire the processor selector and rejection control to effective backend state.

Fix the Transformer layer-count discrepancy between training and inference. Fix checkpoint naming and selection. Avoid overwriting historical weights on retraining; save run IDs, dataset hash, split IDs, class map, package versions, architecture config, seed, train/validation history, and checkpoint checksum. Smoke-test runs must not silently replace the active model or be presented as production benchmark results.

For recognition, return accepted/unknown/no-hands/poor-quality/unavailable as distinct outcomes with model ID and measured timing. Use proper class-index mapping for classical `predict_proba`; do not index probabilities by an arbitrary label value. Do not fabricate probability when unavailable.

Use validation data to select models and operating thresholds. Report confidence calibration limitations with this small dataset. Collect background/non-sign/unknown examples or explicitly report that rejection has not been validated on them. Avoid automatically accepting unsupported motions just because softmax is high. Benchmark the exact artifact being served. Use a consistent split protocol across model families, select on validation, and evaluate the held-out test after decisions are frozen. Do not use test accuracy to choose the champion or assert signer independence without signer metadata. If previous test results have already influenced selection, disclose that limitation and arrange a fresh holdout before making new generalization claims.

First make isolated capture reliable; then add a rolling-buffer mode with motion onset/offset, overlapping windows as appropriate, temporal stability, cooldown, and deliberate repeat handling. Do not claim unrestricted continuous ISL sentence translation from five isolated labels. The accepted result populates an editable sentence with undo, clear, copy, and optional speech.

## 6. Implement Local, Gemini, and Hybrid modes

All cloud calls go through FastAPI. Remove credential literals from source and remove the browser-key path in imageStudioService. Never expose or log credentials. Add the missing environment-loading dependency and a documented server `.env.example` with placeholders only. Rotate any real exposed key through the owner's authorized account process; do not invent a replacement key.

Use configurable model IDs and verify supported modalities/schema for the account. Do not guess a current model name or promise a free tier. Add timeouts, cancellation, request IDs, media-size/type checks, maximum duration, response validation, rate limits, bounded retries with backoff, and distinct missing-key/auth/quota/network/provider errors. Avoid parallel overlapping scene calls and key rotation as a substitute for respecting quota.

Provide visible modes:
- **Local ML:** no Gemini request. Real local recognition/motion/OCR/detection. Label browser speech recognition separately unless an actual local STT engine is selected. Do not claim offline operation until required assets and local STT are provisioned and tested.
- **Gemini:** optional cloud isolated-sign assessment using a short ordered frame sequence/video with timing, plus language assistance, OCR second opinion, and scene understanding. Clearly identify it as cloud-assisted and experimentally evaluated for sign recognition.
- **Hybrid:** local tracking and VRM rendering stay immediate. Local classification runs first; cloud assistance is optional for ambiguity or user-requested interpretation, not one API call per video frame.

Suggested APIs: `/api/capabilities`, `/api/models`, `/api/models/activate`, `/api/sign/predict`, `/api/gemini/sign`, `/api/gemini/plan-signs`, and the existing `/api/gemini/describe`. Adapt names consistently to current routes.

Gemini sign output must be schema validated and restricted to active supported class IDs plus `unknown`, with provider ID and brief observable evidence. Do not treat self-reported confidence as calibrated probability. Evaluate Local, Gemini, and Hybrid on the same appropriately held-out clips and record latency, errors, and abstention. Disagreement must be visible and user-correctable; do not combine scores by arbitrary averaging or silently let cloud text override observed signing.

For text/speech-to-sign, use deterministic longest-phrase matching first, preserving multiword greetings. Optionally ask Gemini for a schema-constrained plan of existing clip IDs plus unsupported spans. Supply the catalog allowlist and reject unknown IDs server-side. Handle any prompt injection in user text or scene content as data; it must not bypass catalog restrictions. Gemini must not output invented joint tracks presented as valid ISL. Display the planned sequence and unsupported words. Only offer fingerspelling if a correct, reviewed alphabet motion set actually exists.

For sentence cleanup, show the raw recognized words and a separate editable suggestion that preserves meaning. Never auto-speak an unconfirmed semantic rewrite. Cloud media transmission must be apparent to the user and governed by the selected mode. Default to ephemeral media handling.

## 7. Finish every existing user workflow

- **Shared playback:** reliable play/pause/replay, seek, speed, looping, next/previous clip, cancel queue, and exactly-once completion callbacks. Advance using accumulated playback delta so pausing truly freezes time. Reuse the loaded avatar while changing clips.
- **Deaf Assist / Live Captions:** real microphone permissions, interim/final caption handling, English/Tamil options with actual provider support, timestamped history, copy/export/clear, typing-to-speech replies, and visible errors. Avoid duplicates and restart loops after permission denial. Keep sound radar accurately labeled as microphone loudness/spike detection, not siren identity or directional localization without a separate validated model.
- **Mute Assist / SignCommunication:** real capture, provider selection, actual vocabulary, no-hand/unknown feedback, sentence editing, quick phrases, chosen TTS settings, and shared avatar playback/mirroring. Remove all synthetic observation generators.
- **Blind Assist / EnvironmentReader:** implement a real local object detector with actual labels and boxes, directional descriptions from detections, and optional Gemini scene narration. A missing detector is `unavailable`, not `no objects`. Use nonoverlapping request scheduling and prevent stale responses from speaking after Stop or page navigation. Keep observations separate from navigation-safety claims.
- **OCR:** actual English/Tamil assets, uploaded images and camera captures, rotation/contrast controls, original recognized text, spoken playback, worker cleanup, and distinct empty/error states. Cloud cleanup must not silently invent unreadable text.
- **Local speech:** implement the offered faster-whisper adapter and actual audio endpoint/model acquisition if local captions remain part of V1. Distinguish it from browser STT and Gemini audio modes; validate codecs, chunk ordering, duplicates, and stop cleanup. Do not advertise an unimplemented local service.
- **Settings:** propagate high contrast, font size, reduced motion, voice, rate, pitch, autospeak, camera direction, and announcement interval through shared state to actual services. Reduced motion should suppress decorative motion without disabling essential signing unless the user explicitly pauses it.
- **Processor / Readiness:** remove random telemetry. Probe initialization/loading and backend state. Show unsupported metrics as unavailable. Reflect real model activation, threshold, data provenance, and recovery actions.
- **Data Science Lab / Evaluation:** real training progress, cooperative cancellation, durable job status, isolated artifacts, truthful audit data, and reports loaded from measured run artifacts. Eliminate stale 50-class export metadata, invented curves, and false signer-independence claims. Ensure cancellation stops computation/artifact promotion instead of only changing the status string.
- **Image studio:** if retained as an exposed feature, implement a server-only endpoint with supported image model, errors, and visible generation state. Do not leave a browser credential client or a button that pretends to generate an image.
- **Resource ownership:** prevent competing camera/microphone instances across embedded components. Stopping, switching mode, navigating, or unmounting must cancel pending work and release resources. Guard late async completions with request/session IDs.
- **Accessibility:** keyboard operability, visible focus, status announcements, large targets, useful errors, appropriate contrast, and no reliance on color alone. Avoid unnecessary rapid screen flashing. Preserve editable text when changing tabs/providers.

## 8. Reproducible startup and performance

Fix Windows setup/start scripts to quote spaces and `&`, use the created virtual environment's Python explicitly, fail clearly when dependencies are missing, and avoid claiming success after failed installs. Prefer localhost binding by default and explicit permitted CORS origins. Add documented production API routing; a development Vite proxy alone is not a production configuration.

Make npm scripts robust in the existing directory, for example by using explicit Node entrypoints where appropriate. Avoid destructive cleanup of the project. Pin a compatible dependency set without unnecessary upgrades. Lazy-load heavy research/3D/provider functionality where it reduces the current large bundle. Do not initiate webcam/microphone access automatically on first load.

Measure initial avatar load, rendering and tracking rate, prediction latency, and cloud round-trip separately. Reuse vectors/quaternions and avoid high-rate React state churn. Report actual hardware/browser and test conditions.

## 9. Required validation and definition of done

Write focused unit/integration tests for the new contracts and the bugs identified here. Use recorded inputs for deterministic automated checks; simulated test data must never appear as real production inference.

Required checks:
1. TypeScript and production build pass using normal documented commands in this exact Windows path.
2. Backend starts from a clean documented environment, imports all declared dependencies, and loads the exact selected model.
3. The supplied VRM is visibly rendered, has the expected bone map, preserves proportions/materials, and survives repeated navigation/load/unload.
4. Known landmark fixtures exercise both sides, palm orientation, all finger chains, neutral pose, straight arms, mirroring, tracking loss, and invalid inputs without NaNs or exploding joints.
5. A recorded observation yields equivalent preprocessing in extraction and inference. Missing masks and gaps beyond the configured limit remain correctly represented.
6. All five greeting clips exist and play through the shared renderer. Playback controls and phrase-queue completion behave correctly. Compare generated motion side by side with source videos; label linguistic review status honestly.
7. Real camera capture sends real landmarks to the actual checkpoint. Covering the camera cannot append a word. Unsupported gestures return unknown or clearly uncertain output under the validated policy.
8. Model switching changes the backend artifact/hash and effective vocabulary; failure retains the prior working model. Retrained architecture metadata reloads correctly.
9. Local mode makes no Gemini request. Gemini/Hybrid modes exercise configured cloud endpoints with real authorized test media when available. Missing key, invalid key, quota error, timeout, malformed output, unsupported clip ID, disagreement, and Stop-during-request are covered.
10. Captions, TTS, OCR, local detection, optional cloud description, settings persistence, export, and deletion work on their actual routes. Settings affect ordinary use, not only a test button.
11. Stop/navigation/unmount closes tracks and prevents late speech/results. No duplicate listeners, workers, render loops, or accumulating GPU resources after repeated use.
12. Training cancellation stops work, status survives expected app restarts, and research reports identify the exact dataset/split/run/model. No invented metrics or hidden test-set model selection.
13. Test desktop and narrow layouts, keyboard-only use, permission denial, backend offline, absent optional model, unsupported speech provider, and missing/corrupt avatar.
14. Scan source and built client assets for hardcoded credentials without printing discovered values.

A passing build is necessary but not sufficient. Do not claim webcam, microphone, cloud, linguistic quality, or retraining tests passed unless actually performed. If hardware access, credentials, additional training data, or qualified ISL review is unavailable, finish all independent implementation and report precisely what remains unverified. An unavailable label is honest handling, not completion of the missing implementation.

Deliver the working code and assets, focused tests and measured results, updated setup/README, feature/provider capability matrix, known limitations, and a short demo checklist. Summarize changes by user-visible outcome and give exact launch commands. Continue through implementation and verification; ask only for genuinely blocking inputs or approvals.

## Official references to consult alongside installed versions

- VRM loading: https://pixiv.github.io/three-vrm/docs/classes/three-vrm.VRMLoaderPlugin.html
- Humanoid normalized bones: https://pixiv.github.io/three-vrm/docs/classes/three-vrm.VRMHumanoid.html
- VRM 0 orientation and disposal utilities: https://pixiv.github.io/three-vrm/docs/classes/three-vrm.VRMUtils.html
- MediaPipe Hand Landmarker: https://developers.google.com/edge/mediapipe/solutions/vision/hand_landmarker/web_js
- MediaPipe Pose Landmarker: https://developers.google.com/edge/mediapipe/solutions/vision/pose_landmarker/web_js
- Gemini structured outputs: https://ai.google.dev/gemini-api/docs/structured-output
- Gemini video understanding: https://ai.google.dev/gemini-api/docs/video-understanding
- Gemini API key handling: https://ai.google.dev/gemini-api/docs/api-key
