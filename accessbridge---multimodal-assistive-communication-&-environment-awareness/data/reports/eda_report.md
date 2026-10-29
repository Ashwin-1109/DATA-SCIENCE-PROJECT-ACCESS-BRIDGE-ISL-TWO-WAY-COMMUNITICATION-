# AccessBridge Exploratory Data Analysis (EDA) Report

**Target Dataset:** `INCLUDE-GREETING-SUBSET-v1`  
**Total Clips:** 106  
**Number of Classes:** 5  
**Classes:** Alright, Good Morning, Good afternoon, Hello, How are you  

---

## 1. Summary Statistics

| Metric | Duration (s) | Raw Frame Count | File Size (MB) |
|:---|:---:|:---:|:---:|
| **Mean** | 2.75s | 68.7 | 14.48 MB |
| **Standard Deviation** | 0.56s | 14.1 | 2.90 MB |
| **Median** | 2.68s | 67.0 | 14.27 MB |
| **Minimum** | 1.64s | 41 | 8.59 MB |
| **Maximum** | 4.00s | 100 | 21.42 MB |

---

## 2. Partition Strategy

The dataset is partitioned using class-stratified splits (seed 42) into:
- **Train (70%):** 75 samples
- **Validation (15%):** 15 samples
- **Test (15%):** 16 samples

---

## 3. Preprocessing Implications for Feature Pipeline

1. **Variable Length to Fixed Length (32 frames):**
   Videos range from 1.64s (41 frames) to 4.00s (100 frames).
   Temporal linear resampling to a canonical 32 frames is mandatory to provide invariant tensor dimensions (32, 138) for sequence models.

2. **Spatial Normalization:**
   Mid-shoulder translation and inter-shoulder distance scaling normalize for signer distance and frame positioning across recordings.

3. **Hand Presence & Observation Masks:**
   One-handed signs (e.g. *Hello*, *Alright*) have missing non-dominant hand landmarks.
   Explicit observation masks ensure the neural network learns to recognize absent hands rather than confusing zero-coordinates with hands at the origin.
