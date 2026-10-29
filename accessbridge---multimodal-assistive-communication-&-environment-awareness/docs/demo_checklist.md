# Microproject Viva & Demonstration Checklist

Follow this sequence for academic presentations, vivas, and project demonstrations:

- [ ] **1. Readiness Diagnostic (Tab 1)**
  - Open AccessBridge at `http://localhost:3000`.
  - Demonstrate real diagnostic probes for Camera, Microphone, and Audio Synthesis.
  - Highlight the truthful model status: shows "Training Required" or loaded benchmark model.
- [ ] **2. Sign Communication Workflow (Tab 2)**
  - Start the camera feed; point out the mirrored view and unmirrored coordinate tracking.
  - Toggle landmark skeleton overlay; demonstrate MediaPipe hand and pose tracking.
  - Perform an isolated sign gesture (e.g. "Hello" or "Help") with the 2.0s capture window.
  - Demonstrate confidence score, latency metric, and text-to-speech output.
  - Show the 50-word INCLUDE vocabulary modal.
  - Demonstrate rejection feedback when hands are occluded or missing.
- [ ] **3. Live Captions Workflow (Tab 3)**
  - Start microphone listening in English or Tamil.
  - Speak a sentence and show real-time chunked captioning with timestamps.
  - Demonstrate font size scaling (Standard, Large, XL) for accessibility.
  - Show transcript copy and JSON export.
- [ ] **4. Connected Conversation Dialogue**
  - Show the two-way dialogue view connecting signed inputs with live spoken captions.
- [ ] **5. Environment Reader (Tab 4)**
  - Sub-mode A: Demonstrate object detection and directional announcement ("Person near the centre").
  - Sub-mode B: Capture or upload an image and extract printed text via Tesseract OCR with rotation/contrast controls.
- [ ] **6. Data Science Lab (Tab 5)**
  - Show INCLUDE-50 dataset provenance and sample manifest.
  - Run the dataset integrity audit report and explain the signer independence disclosure.
  - Launch a model training job with live epoch loss and accuracy curves.
- [ ] **7. Evaluation Dashboard (Tab 6)**
  - Present the 6-model comparison table (Macro-F1, Accuracy, Parameters, Latency).
  - Walk through the Latency vs. Macro-F1 scatter plot and training loss curves.
  - Explain the kinematic root causes of confused sign pairs (e.g. Doctor vs Hospital).
