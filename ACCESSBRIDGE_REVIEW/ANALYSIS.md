# AccessBridge: current system analysis and first complete release

Audit date: 7 October 2026, Asia/Calcutta.

Project: `D:\DS MICRO PROJECT\accessbridge---multimodal-assistive-communication-&-environment-awareness`

**The supplied avatar is usable. The application does not currently load it into its visible sign viewers. The larger issue is an unfinished connection between camera tracking, recognition, motion data, and avatar playback.**

This is an analysis and implementation handoff, not a claim that the application has been repaired. No application source was changed. A verification build refreshed `dist/`. The review folder contains this report, the implementation prompt, a structural inspection script, and its evidence JSON.

## What was checked

Inspected the application architecture, routed pages, shared components, services, backend routes, model definitions, extraction/training pipelines, configurations, saved reports, launch scripts, and asset metadata. Indexed 99 project text/source/document/notebook files, excluding dependency trees, generated build output, environment-file contents, and lockfile bodies. Parsed Python source syntax, inspected notebook structure, checked all nine NumPy arrays, inspected VRM containers and PyTorch checkpoint container structure, and counted the dataset and archive contents.

Verification limits: no webcam/microphone interaction, complete video-by-video decoding, model retraining, checkpoint inference, or live Gemini requests were performed. The bundled Python runtime has NumPy but lacks the application's PyTorch/FastAPI/MediaPipe stack; `python` was not available through this shell's PATH. Saved accuracy figures below are artifact claims, not newly reproduced results. These distinctions matter because earlier repository documentation describes code that has since changed.

## 1. The avatar mismatch is explained by the code

Both of these files are identical:

- Original: `D:\DS MICRO PROJECT\3477026897357566765.vrm`
- App copy: `public/models/avatar.vrm`

| Property | Verified value |
| --- | --- |
| File size | 18,900,420 bytes |
| SHA-256 | `28e2d34c84856f09abd92672b5d0b83614cb5794a3421e5674e6e2daac4dd4a1` |
| Format | Binary glTF with VRM 0.0 extension |
| Humanoid bone mappings | 54 |
| Meshes / skins | 3 / 3 |
| Embedded animations | 0 |
| Finger rig | Both thumbs and all four fingers on each hand, three mapped joints each |
| Facial blend shapes | Neutral, vowel shapes, blinks, and several expressions |

The avatar has the structure needed for articulated upper-body and finger motion. Appearance and deformation quality still need a rendered test.

`src/components/SignViewer.tsx` is the viewer used by `BiDirectionalSignTranslator`, which appears in Deaf, Mute, and Blind interfaces. It builds a procedural character from Three.js geometry. Its loader asks for paths such as `/models/signs/hello.glb`; those files are absent. Even a successful GLTF load is never mounted as the visible character. Its procedural joint refs belong to the generated character, not the user's VRM.

`src/components/SigningAvatarViewer.tsx` is another independent procedural viewer. It constructs bones and geometry, does not use the VRM loader, and does not attach its `rootBone` to `characterGroup`. Its animation loop also captures initial playback state in an effect with empty dependencies. These are separate faults from the missing VRM connection.

`public/models/avatar.gltf` is only 501 bytes and contains three named nodes, with no mesh data or animation. It is not an alternative usable avatar. `@pixiv/three-vrm` is installed but is not imported in application source.

**Correct repair:** introduce one shared VRM renderer, load `/models/avatar.vrm` with `GLTFLoader` plus `VRMLoaderPlugin`, mount `vrm.scene`, apply the VRM 0 orientation helper once, resolve normalized humanoid bones, and update the VRM each render frame. The official [loader API](https://pixiv.github.io/three-vrm/docs/classes/three-vrm.VRMLoaderPlugin.html), [humanoid API](https://pixiv.github.io/three-vrm/docs/classes/three-vrm.VRMHumanoid.html), and [VRM utilities](https://pixiv.github.io/three-vrm/docs/classes/three-vrm.VRMUtils.html) support this approach.

## 2. The coordinates exist, but they are recognition features

The stored sequence arrays contain 32 frames with 138 numbers per frame:

| Slice | Meaning |
| --- | --- |
| `0:63` | Right hand: 21 × xyz |
| `63:126` | Left hand: 21 × xyz |
| `126:138` | Left shoulder, right shoulder, left elbow, right elbow: 4 × xyz |

All checked arrays contain finite values. Shapes and labels agree with a five-class dataset: 75 training, 15 validation, and 16 test examples. The 291-dimensional arrays are statistical recognition features; they cannot recover detailed motion trajectories.

The existing extraction code normalizes hand coordinates around the shoulder midpoint but leaves the pose coordinates in image space. It combines independently estimated hand and pose depth values. It discards original timestamps, full pose data, explicit observation masks, and original frame density from the saved recognition tensors. Those arrays must not be interpreted as a coherent metric skeleton.

There is a second important mismatch: backend live inference packs incoming coordinates and resamples them without calling the normalization used during extraction. Passing real browser landmarks through this endpoint would therefore still give the model a different input distribution.

Executed pure NumPy probes confirmed:

- `interpolate_short_gaps()` fills a five-frame missing span despite `max_gap=3`.
- Zero coordinates for an undetected hand become nonzero after subtracting the shoulder origin.
- The feature extractor outputs 291 values, but its six supposed presence features are zero ratios of the first six channels, not explicit hand/pose visibility masks.

The saved 32-frame arrays can support an explicitly approximate diagnostic playback adapter. The best motion source is re-extraction from the 106 available original videos, preserving timestamps, pose image/world landmarks, hand image/world landmarks, handedness, visibility, and missing observations. Keep this motion schema separate from the classifier's input schema.

Hand world landmarks and pose world landmarks have different origins; image-space depth origins also differ. They require registration before body-and-hand fusion. This follows the official [hand landmark output definitions](https://developers.google.com/edge/mediapipe/solutions/vision/hand_landmarker/web_js) and [pose landmark output definitions](https://developers.google.com/edge/mediapipe/solutions/vision/pose_landmarker/web_js).

## 3. What the dataset and models actually support

The available video folders contain:

| Model class ID | Greeting | Clips |
| --- | --- | --- |
| 0 | Hello | 21 |
| 1 | How are you | 21 |
| 2 | Alright | 21 |
| 3 | Good Morning | 21 |
| 4 | Good afternoon | 22 |

All 106 video paths in the manifest exist. Its 106 stored hashes are unique; this audit did not recompute full video hashes. The split is locally class-stratified, not evidence of an official or signer-independent split.

Six checkpoint files exist: SVM, Random Forest, Bi-LSTM, Bi-GRU, 1D-CNN, and Transformer. `active_model_config.json` selects `cnn1d_best.pth`, five classes, and validation accuracy 0.9333. The saved benchmark report lists CNN test accuracy 87.5% and macro-F1 0.8833 on only 16 samples. These files are evidence of saved experiments, not proof of equivalent live-camera performance or of traceability to the current overwritten checkpoint.

Several inconsistencies undermine the current benchmark presentation:

- README and evaluation export still claim 50 classes, 3,420 clips, and 684 test samples.
- Frontend vocabularies and `/api/sign/vocabulary` expose 50 words, while the active checkpoint's output has five classes.
- The processor model selector changes localStorage and UI text; it never switches the backend model. The prediction endpoint ignores the requested `model_name`.
- `scripts/train_models.py` selects the winner using test-set metrics. This is not validation-only model selection.
- That script trains classical models on train + validation, while neural models use training data with validation selection. The resulting comparison is not the uniform protocol advertised.
- The online training runner creates a two-layer Transformer, whereas the inference constructor defaults to three layers. The currently saved Transformer structurally has layers 0, 1, and 2; retraining through the UI would produce a potentially unloadable replacement.
- The benchmark script derives checkpoint filenames from display names. Some derived names differ from actual filenames, so winner selection can write an invalid active configuration.
- The dashboard uses static TypeScript benchmark data instead of current experiment artifacts, and some displayed training histories lack a linked saved run.

The first honest complete release should support these five greetings end to end. A 50-word release requires corresponding labeled data, compatible training, and validated animation assets. Gemini cannot supply missing training evidence or validated sign motions.

## 4. Feature audit

| Feature | Current state | Required V1 repair |
| --- | --- | --- |
| Supplied VRM display | Asset present; neither viewer uses it | Shared VRM renderer throughout the app |
| Hand/finger animation | Procedural demos and handwritten rotations | Coordinate retargeter with calibration, wrist orientation, finger joints, and missing-data handling |
| Live sign tracking | No frontend MediaPipe detector initialization found | One shared real Hands + Pose tracking service |
| Real-time sign panel | Feeds all-null hand/pose frames to rule classifier | Real observations and trained-model inference |
| Bidirectional camera capture | Records timestamps with null landmarks | Await camera readiness; capture actual tracker frames |
| SignCommunication capture | Also records null landmarks | Reuse the same capture/inference pipeline |
| Mute mode capture | Produces 3 fake right-hand and 2 fake left-hand points; calls synchronous service that cannot infer | Remove simulated points; use async inference |
| Recognition service | Real backend model code exists | Shared training/inference preprocessing, schema checks, calibrated rejection |
| Vocabulary | Five trained classes conflict with 50 UI labels | One authoritative capability/model manifest |
| Text/speech to sign | Word lookup and procedural playback | Phrase-aware queue over existing motion assets, with explicit unsupported phrases |
| Playback controls | Looping demo; completion callback unused; older viewer has stale state | Delta-based timeline, pause, seek, speed, replay, completion event |
| Gemini scene narration | Backend endpoint implemented | Validate configuration and inputs, bounded calls, actual error states |
| Gemini sign recognition | No corresponding endpoint | Optional temporal-video evaluation with allowlisted labels and abstention |
| Local object detection | `detectObjectsInCanvas()` always returns `[]` | Load an actual detector; distinguish unavailable from no detections |
| OCR | Real Tesseract.js call exists | Verify language assets, terminate replaced workers, distinguish failure from no text |
| Live captions | Browser SpeechRecognition implemented | Handle permissions/restarts/interim text; implement local Whisper if offered |
| Local Whisper | Dependency/type/help text only | Real audio endpoint and adapter, or visibly unavailable until supplied |
| TTS / phrase board | Real browser synthesis | Apply saved voice/rate/pitch to all calls and handle missing voices |
| Sound radar | Real microphone amplitude detector | Keep description as loud-noise detection; do not claim sound identity or direction |
| Training jobs | Actual worker runner exists | Cooperative cancellation, durable status, immutable run artifacts, safe promotion |
| Training cancellation | Changes status only; worker continues and can overwrite status/artifacts | Stop work cooperatively or in a managed process |
| Model administration | UI-only switching and threshold | Real registry/activation endpoints and effective threshold configuration |
| Telemetry | Randomized FPS, latency, memory | Measured values, or explicitly unavailable |
| Readiness | Several flags infer readiness from file existence or WASM support | Test actual initialization/model load and capability state |
| Accessibility settings | Some CSS applies; speech options mainly reach the test button | Shared settings context and runtime propagation |
| Session storage | localStorage implementation exists | Consistent retention, deletion, quota errors, and cloud disclosure |
| Image studio service | Unused browser Gemini client path; `process.env` can fail in browser | Backend-only optional image endpoint if retained |
| Windows setup | Environment/runtime and folder-name issues | Quoted paths, explicit venv interpreter, portable npm scripts |

The old `docs/CURRENT_SYSTEM_AUDIT.md` is useful historical context but is not current evidence. For example, it says Gemini endpoints are absent and some now-removed fallback predictions still exist. The new prompt asks the implementer to re-check code instead of blindly repeating that document.

## 5. How motion should drive this avatar

Use three distinct paths that share the same renderer:

1. **Live mirror:** camera → pose/hands → coordinate registration → retargeted bone rotations → user's VRM. Recognition and Gemini are not prerequisites for moving the avatar.
2. **Sign recognition:** a timestamped motion window → versioned classifier preprocessing → selected saved ML model → accepted/unknown result → editable text and optional speech.
3. **Sign playback:** typed text or final speech transcript → deterministic phrase lookup or optional Gemini language planner → existing motion clip IDs → retargeted pose timeline → user's VRM.

For retargeting, calibrate the subject's neutral pose and the avatar's normalized rest pose. Use shoulder–elbow and elbow–wrist directions for arms, with an elbow-plane or IK constraint to resolve twist. Use a palm basis for wrist orientation and adjacent hand-landmark segments for fingers. Convert desired world rotations into each parent's local space, apply the rest-basis correction, limit implausible joints, smooth with time-aware quaternion interpolation, and preserve avatar bone lengths. Handle thumb remapping through the VRM library's normalized bone names rather than raw model-node assumptions.

The existing handwritten Euler angles refer to another rig and are not transferable merely by changing bone names. Also, tracking a gesture accurately does not establish that it is linguistically correct ISL. Keep the source video next to the generated motion for review and label unreviewed motions honestly.

## 6. Best use of ML and Gemini together

Recommended design: Local, Gemini, and Hybrid modes, with visible provider and capability status.

- **Local:** actual landmark models, a validated local classifier, local motion retargeting, local OCR, and a real local object detector. Local speech recognition requires its own implementation/model. Browser SpeechRecognition should be separately labeled because local processing is not guaranteed.
- **Gemini:** backend-only language assistance, scene narration, optional OCR second opinion, and experimental isolated-sign assessment from a short temporal clip. Constrain sign output to the available labels plus `unknown`; do not treat model-written confidence as calibrated probability.
- **Hybrid:** use local motion and recognition first; optionally request cloud help for user-selected ambiguity or language/scene tasks. Display disagreement instead of silently replacing the user's intent. Never average unrelated ML probabilities and Gemini self-ratings.

Use Gemini to select existing clip IDs or improve an editable sentence, not to invent bone rotations and present them as verified signing. Structured JSON helps transport and validation but does not guarantee correct content; Google's [structured-output guidance](https://ai.google.dev/gemini-api/docs/structured-output) requires application-level value validation.

Credential-like literals are hardcoded in `backend/app/services/gemini_service.py`. Their validity was not tested and their values are intentionally omitted here. Remove them; rotate any real exposed credentials. Keep only environment-variable names in examples, never secrets in browser bundles, prompts, or source. Follow Google's [API key guidance](https://ai.google.dev/gemini-api/docs/api-key). The backend imports `dotenv`, but `python-dotenv` is missing from its requirements.

## 7. Build verification

| Check | Result |
| --- | --- |
| `npm run lint` | Fails through Windows command shims in this `&`-containing project path |
| `npm run build` | Same path/shim failure |
| `node ./node_modules/typescript/bin/tsc --noEmit` | Passes |
| `node ./node_modules/vite/bin/vite.js build` | Passes |
| Build size | Approximately 1.89 MB main JavaScript, 513 KB gzip; code splitting advised |
| VRM hash equality | Passes |
| NumPy array dimensions, labels, finite values | Passes structural checks |
| Preprocessing gap limit | Fails behavior promised by code comments |
| Missing-hand preservation | Fails without explicit mask handling |
| Backend inference / live camera / Gemini | Not executed in this audit |

The app currently compiles, but that does not establish that its advertised workflows work.

## 8. Recommended complete V1

Deliver one reliable five-greeting application with the supplied VRM visible everywhere, real camera mirroring, actual local recognition, text/speech-driven playback of available source-derived motions, optional Gemini and Hybrid assistance, working captions/TTS/OCR/object awareness, honest training/evaluation tools, propagated accessibility settings, and reproducible Windows startup.

Prioritize avatar loading and real tracking first, then model preprocessing parity and motion playback, then Gemini integration, then remaining workflows and end-to-end validation. Retain a clear capability matrix for unavailable models, missing credentials, unsupported languages, and unreviewed signs. Do not equate an honest unavailable state with an implemented feature.

Use `ANTIGRAVITY_IMPLEMENTATION_PROMPT.md` as the implementation brief. `evidence.json` provides reproducible structural facts from this audit.
