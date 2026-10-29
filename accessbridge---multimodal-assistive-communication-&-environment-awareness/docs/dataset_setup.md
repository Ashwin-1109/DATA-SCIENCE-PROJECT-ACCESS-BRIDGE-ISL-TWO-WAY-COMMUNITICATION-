# INCLUDE-50 Dataset Setup & Acquisition Guide

## 1. Dataset Origin & Provenance
- **Dataset**: INCLUDE (Indian Sign Language Dataset)
- **Institution**: AI4Bharat & Indian Institute of Technology Madras (IITM)
- **Official Repository**: [https://github.com/AI4Bharat/INCLUDE](https://github.com/AI4Bharat/INCLUDE)
- **Citation**: Sridhar, A., et al. "INCLUDE: A Large Scale Dataset for Indian Sign Language Recognition." *ACM Multimedia 2020*.

## 2. Benchmark Subset (INCLUDE-50)
The standard INCLUDE-50 benchmark selects 50 everyday sign classes with balanced sample distributions:
- **Total Clips**: 3,420 MP4 video files
- **Train Split**: 2,394 clips (70%)
- **Validation Split**: 342 clips (10%)
- **Test Split**: 684 clips (20%)
- **Average Duration**: 1.62 seconds per clip (approx 48.6 frames at 30 fps)

## 3. Directory Layout
Place downloaded videos in the following local directory structure:
```
data/
  raw/
    INCLUDE50/
      Hello/
        Hello_01.mp4
        ...
      Thank_You/
      Water/
  manifests/
    include50_manifest.csv
  landmarks/
    train_landmarks.npy
    val_landmarks.npy
    test_landmarks.npy
```

## 4. Building the Dataset Manifest
Run the manifest builder to index samples and verify file integrity:
```bash
python scripts/build_manifest.py --data-dir data/raw/INCLUDE50 --output data/manifests/include50_manifest.csv
```
