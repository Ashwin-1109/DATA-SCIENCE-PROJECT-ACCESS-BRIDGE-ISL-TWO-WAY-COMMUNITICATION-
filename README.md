# AccessBridge: Multimodal Assistive Communication & Environment Awareness System
### Indian Sign Language (ISL) Two-Way Communication & Assistive Perception

**B.Tech CSE (Artificial Intelligence & Machine Learning) — Data Science Micro Project**  
**Karunya Institute of Technology and Sciences**

[![Repository](https://img.shields.io/badge/GitHub-AccessBridge-blue?logo=github)](https://github.com/Ashwin-1109/DATA-SCIENCE-PROJECT-ACCESS-BRIDGE-ISL-TWO-WAY-COMMUNITICATION-)
[![Python](https://img.shields.io/badge/Python-3.10%20%7C%203.11-green?logo=python)](https://python.org)
[![FastAPI](https://img.shields.io/badge/FastAPI-0.110+-009688?logo=fastapi)](https://fastapi.tiangolo.com)
[![React](https://img.shields.io/badge/React-19-61DAFB?logo=react)](https://react.dev)
[![Vite](https://img.shields.io/badge/Vite-6.x-646CFF?logo=vite)](https://vitejs.dev)
[![PyTorch](https://img.shields.io/badge/PyTorch-2.x-EE4C2C?logo=pytorch)](https://pytorch.org)

---

## 1. Project Overview

**AccessBridge** is an open-source, full-stack, multimodal assistive communication and physical environment awareness application. It addresses communication and awareness barriers for Deaf, Mute, and Blind individuals by integrating:
- **Two-way Sign Language Communication:**
  - Real-time **Sign-to-Speech** (ISL gesture recognition via MediaPipe hand tracking & PyTorch deep learning models).
  - High-fidelity **Text-to-Sign** synthesis with 3D VRM avatar playback (54 bones) and 26-handshape manual alphabet fingerspelling.
- **Multimodal Environmental Awareness:**
  - Live speech captioning with multi-lingual transcription (`en-IN`, `ta-IN`, `hi-IN`).
  - Spatial audio obstacle narration (MediaPipe ObjectDetector + rule-based directional narrator).
  - Camera-based printed document reading powered by Tesseract OCR (English & Tamil).
  - Cloud Gemini multimodal scene narration with failover safety mechanisms.

---

## 2. Repository Structure & Deliverables

```text
DATA-SCIENCE-PROJECT-ACCESS-BRIDGE-ISL-TWO-WAY-COMMUNITICATION-/
├── accessbridge---multimodal-assistive-communication-&-environment-awareness/
│   ├── backend/                     # FastAPI backend (sign inference, Gemini API, job queue)
│   ├── src/                         # React 19 + TypeScript frontend with Tailwind CSS
│   ├── ml/                          # Feature extraction, preprocessing, training pipelines
│   ├── artifacts/                   # Saved model checkpoints (.pth, .joblib) & benchmark plots
│   ├── data/                        # Processed dataset matrices (.npy) and manifests
│   ├── docs/                        # Architecture guides, methodology, audit reports
│   ├── notebooks/                   # Jupyter notebooks (EDA, extraction, training, evaluation)
│   ├── public/                      # Static assets, 3D avatar (.vrm), MediaPipe WASM & models
│   ├── package.json                 # Node dependencies & build scripts
│   ├── setup.bat / setup.sh         # Environment setup scripts
│   └── start.bat / start.sh         # Local application launch scripts
├── ACCESSBRIDGE_REVIEW/             # Comprehensive technical audit & evidence analysis
├── DS - Micro Project E-Report.docx # Official Academic E-Report
├── ppt phase 2 (1).pptx             # Phase 2 Review Presentation
├── PROJECT_FILE.md                  # Comprehensive architectural audit & system analysis
├── start_accessbridge.bat           # Root launcher shortcut
└── README.md                        # Project root documentation (this file)
```

---

## 3. Core Assistive Capabilities

1. **Deaf Assist (Visual-First):**
   - High-contrast live speech captions with multi-language transcription (`en-IN`, `ta-IN`, `hi-IN`).
   - Environmental sound alert indicators (speech, alarm, doorbell, loud sounds).
   - Bi-directional text-to-sign translation with 3D VRM avatar playback and 26-handshape fingerspelling.
2. **Mute Assist (Sign-to-Speech & AAC):**
   - Real-time Indian Sign Language (ISL) recognition with continuous live 21-keypoint hand tracking.
   - 32-frame sliding inference window paired with PyTorch deep learning models.
   - Augmentative and Alternative Communication (AAC) phrase soundboard with soft natural speech.
3. **Blind Assist (Spatial Audio & OCR):**
   - 3-tier environment perception: Local MediaPipe ObjectDetector (~8 FPS), rule-based spatial narrator (`left`, `ahead`, `right`, distance, priority), and cloud Gemini scene descriptions.
   - Camera-based printed document reader powered by Tesseract OCR (English & Tamil).
   - Strict safety standard: Explicitly announces *"No obstacles detected in view"*, never *"Path is clear"*.

---

## 4. Machine Learning & Benchmark Results

The models are trained and evaluated on the curated **`INCLUDE-GREETING-SUBSET-v1`** dataset (5 classes: *Hello*, *How are you*, *Alright*, *Good Morning*, *Good afternoon*) comprising 106 video clips evaluated on CPU:

| Architecture | Input Representation | Test Accuracy | Macro-F1 | Macro Precision | Macro Recall | Inference Latency | Parameters |
| :--- | :---: | :---: | :---: | :---: | :---: | :---: | :---: |
| **1D-CNN (Champion)** | Sequential `(32, 138)` | **87.5%** | **0.883** | 0.883 | 0.883 | **1.02 ms** | 118,213 |
| **Random Forest** | Classical `(291,)` Tabular | **87.5%** | 0.874 | 0.900 | 0.883 | 79.26 ms | N/A (150 Trees) |
| **Bi-GRU** | Sequential `(32, 138)` | **87.5%** | 0.865 | 0.883 | 0.867 | 10.07 ms | 328,325 |
| **Compact Transformer** | Sequential `(32, 138)` | **81.2%** | 0.815 | 0.833 | 0.817 | 2.26 ms | 424,069 |
| **SVM (RBF Kernel)** | Classical `(291,)` Tabular | **68.8%** | 0.655 | 0.790 | 0.683 | 0.45 ms | N/A |
| **Bi-LSTM** | Sequential `(32, 138)` | **62.5%** | 0.650 | 0.680 | 0.650 | 3.26 ms | 429,317 |

---

## 5. Quick Start & Execution

### Prerequisites
- **Node.js**: v18+ (v20+ recommended)
- **Python**: v3.10 or v3.11 with PyTorch, FastAPI, and MediaPipe

### Setup & Launch

1. **Clone the repository:**
   ```bash
   git clone https://github.com/Ashwin-1109/DATA-SCIENCE-PROJECT-ACCESS-BRIDGE-ISL-TWO-WAY-COMMUNITICATION-.git
   cd DATA-SCIENCE-PROJECT-ACCESS-BRIDGE-ISL-TWO-WAY-COMMUNITICATION-
   ```

2. **One-Click Launch (Windows):**
   Simply run the root launch script:
   ```cmd
   start_accessbridge.bat
   ```

3. **Manual Setup & Run:**
   ```bash
   cd accessbridge---multimodal-assistive-communication-&-environment-awareness
   
   # Frontend
   npm install
   npm run dev
   
   # Backend (in a separate terminal)
   pip install -r backend/requirements.txt
   uvicorn backend.app.main:app --host 0.0.0.0 --port 8000
   ```

---

## 6. Academic Deliverables & Course Details

- **Program:** B.Tech Computer Science & Engineering (Artificial Intelligence & Machine Learning)
- **Course:** Data Science Micro Project (Semester 3)
- **Institution:** Karunya Institute of Technology and Sciences
- **Author:** Ashwin ([@Ashwin-1109](https://github.com/Ashwin-1109))
- **Included Files:**
  - `DS - Micro Project E-Report.docx`: Complete project documentation and academic report.
  - `ppt phase 2 (1).pptx`: Review presentation slide deck.
  - `PROJECT_FILE.md`: Technical and architectural audit findings.

