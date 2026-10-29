# AccessBridge Model Benchmark Report (6 Architectures)

**Dataset:** `INCLUDE-GREETING-SUBSET-v1` (5 Classes, 106 Video Clips)  
**Evaluation Set:** 16 Held-Out Test Samples (Class-Stratified, Fixed Seed 42)  
**Keypoint Input Pipeline:** 32 Frames $\times$ 138 Normalized Landmark Coordinates (MediaPipe)  

---

## 1. Comparative Performance Matrix

| Model Architecture | Input Pipeline | Test Accuracy | Macro F1 | Macro Precision | Macro Recall | Inference Latency | Trainable Parameters |
|:---|:---:|:---:|:---:|:---:|:---:|:---:|:---:|
| **SVM (RBF Kernel)** | Classical (Tabular 291-dim) | **68.8%** | **0.655** | 0.790 | 0.683 | 0.45 ms | N/A (Scikit-Learn) |
| **Random Forest** | Classical (Tabular 291-dim) | **87.5%** | **0.874** | 0.900 | 0.883 | 79.26 ms | N/A (Scikit-Learn) |
| **Bi-LSTM** | Deep Sequential (32x138) | **62.5%** | **0.650** | 0.680 | 0.650 | 3.26 ms | 429,317 |
| **Bi-GRU** | Deep Sequential (32x138) | **87.5%** | **0.865** | 0.883 | 0.867 | 10.07 ms | 328,325 |
| **1D-CNN** | Deep Sequential (32x138) | **87.5%** | **0.883** | 0.883 | 0.883 | 1.02 ms | 118,213 |
| **Compact Transformer** | Deep Sequential (32x138) | **81.2%** | **0.815** | 0.833 | 0.817 | 2.26 ms | 424,069 |

---

## 2. Champion Model Selection

- **Champion Architecture:** `1D-CNN`
- **Test Set Accuracy:** 87.50%
- **Macro F1 Score:** 0.8833
- **Single-Sample Inference Latency:** 1.02 ms (sub-25ms target met)
- **Active Checkpoint File:** Saved to `artifacts/models/` and registered in `active_model_config.json`.
