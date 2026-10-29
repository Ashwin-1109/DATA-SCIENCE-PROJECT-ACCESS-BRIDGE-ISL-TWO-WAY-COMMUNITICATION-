# Data Science Lifecycle & Methodology

## 1. End-to-End Pipeline
```
[1. Acquisition] ---> [2. Data Audit] ---> [3. Extraction] ---> [4. Cleaning] ---> [5. Features] ---> [6. Benchmarking] ---> [7. Deployment]
```

### Stage 1: Data Collection & Provenance
Benchmark clips obtained from AI4Bharat INCLUDE-50. Data includes variability across lighting conditions, backgrounds, and native signers.

### Stage 2: Integrity Audit & Manifest Creation
- Verified file decodability using OpenCV.
- Detected and excluded 2 truncated clips lacking H.264 moov atom headers.
- Verified MD5 hashes to prevent duplicate sample leakage.
- Confirmed zero missing labels across all 50 vocabulary classes.

### Stage 3: MediaPipe 3D Landmark Extraction
- Extracted 21 keypoints per hand (x, y, z) + 4 upper-body pose keypoints.
- Recorded observation masks explicitly; no hallucinated points.

### Stage 4: Cleaning & Normalization
- **Translation**: Origin set to mid-shoulder: $((x_{ls}+x_{rs})/2, (y_{ls}+y_{rs})/2)$.
- **Scale Normalization**: Coordinates divided by inter-shoulder distance $\text{dist}(ls, rs)$. Fallback scale of 0.2 applied if distance $< 0.05$.
- **Gap Handling**: Linear interpolation for gaps $\le 3$ frames; longer gaps left masked.
- **Resampling**: Linear temporal interpolation to 32 uniform frames.

### Stage 5: Feature Engineering
- **Sequential Tensor**: `(32, 138)` preserving trajectory and velocity.
- **Tabular Vector**: 291 statistical features (mean, std, velocities, joint angles, inter-hand distance) for fair classical baseline comparison.

### Stage 6: Fair Model Benchmarking
- Multi-seed validation (seeds 42, 123, 999) to evaluate variance.
- Validation-based early stopping (patience = 10 epochs).
- Held-out test evaluation on identical 684 unseen samples.

### Stage 7: CPU Deployment & Latency Profiling
- Models profiled for single-sample inference latency on CPU with 10 warmup iterations.
- Validation-based rejection threshold (0.65) implemented to detect unknown or out-of-vocabulary gestures.
