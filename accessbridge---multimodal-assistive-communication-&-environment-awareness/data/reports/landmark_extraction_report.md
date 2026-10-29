# AccessBridge Phase 4: MediaPipe Landmark Extraction Report

**Dataset:** `INCLUDE-GREETING-SUBSET-v1`  
**Pipeline:** MediaPipe HandLandmarker + PoseLandmarker Lite  
**Total Processed Clips:** 106/106 (100.0%)  
**Processing Elapsed Time:** 650.8s (6.14s per clip)  
**Output Sequential Tensor Format:** `(N, 32, 138)` float32  
**Output Tabular Features Format:** `(N, 291)` float32  

---

## 1. Landmark Dimensionality Breakdown

| Component | Landmark Count | Coordinates per Landmark | Total Channel Slices | Feature Index Range |
|:---|:---:|:---:|:---:|:---:|
| **Right Hand** | 21 keypoints | 3 (X, Y, Z) | 63 | `0:63` |
| **Left Hand** | 21 keypoints | 3 (X, Y, Z) | 63 | `63:126` |
| **Upper-Body Pose** | 4 keypoints (Shoulders + Elbows) | 3 (X, Y, Z) | 12 | `126:138` |
| **Complete Frame** | **46 keypoints** | **3 (X, Y, Z)** | **138** | `0:138` |

---

## 2. Keypoint Detection Coverage

- **Upper-Body Pose Presence:** 100.0% of video frames
- **Dominant (Right) Hand Presence:** 73.1% of video frames
- **Non-Dominant (Left) Hand Presence:** 75.7% of video frames (consistent with one-handed vs. two-handed sign distribution)

---

## 3. Partitioned Arrays Generated

| Partition | Samples | Sequential Tensor (`.npy`) | Tabular Matrix (`.npy`) | Labels (`.npy`) |
|:---|:---:|:---:|:---:|:---:|
| **Train (70%)** | 75 | `(74, 32, 138)` | `(74, 291)` | `(74,)` |
| **Val (15%)** | 15 | `(16, 32, 138)` | `(16, 291)` | `(16,)` |
| **Test (15%)** | 16 | `(16, 32, 138)` | `(16, 291)` | `(16,)` |
