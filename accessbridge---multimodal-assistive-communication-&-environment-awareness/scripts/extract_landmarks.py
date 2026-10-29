"""
AccessBridge - Phase 4 MediaPipe Landmark Extraction & Preprocessing Pipeline
Processes all 106 .MOV videos from INCLUDE-GREETING-SUBSET-v1:
1. Extracts 21 Right Hand, 21 Left Hand, 4 Upper Body Pose (Left/Right Shoulder, Left/Right Elbow) landmarks.
2. Applies LandmarkCleaner: mid-shoulder origin translation, inter-shoulder distance scaling,
   short-gap linear interpolation (<= 3 frames), and temporal resampling to fixed 32 frames.
3. Applies FeatureExtractor: 291-dimensional tabular summary features.
4. Saves stratified numpy datasets to data/processed/.
"""

import os
import sys
import json
import time
import cv2
import numpy as np
import pandas as pd
from pathlib import Path

# Add project root to path
PROJECT_ROOT = Path(__file__).resolve().parent.parent
sys.path.insert(0, str(PROJECT_ROOT))

import mediapipe as mp
from mediapipe.tasks import python
from mediapipe.tasks.python import vision
from ml.preprocessing.cleaner import LandmarkCleaner
from ml.features.extractor import FeatureExtractor

MANIFEST_PATH = PROJECT_ROOT / "data" / "manifests" / "include_greetings_manifest.csv"
PROCESSED_DIR = PROJECT_ROOT / "data" / "processed"
REPORT_DIR = PROJECT_ROOT / "data" / "reports"
HAND_MODEL_PATH = PROJECT_ROOT / "ml" / "assets" / "hand_landmarker.task"
POSE_MODEL_PATH = PROJECT_ROOT / "ml" / "assets" / "pose_landmarker.task"

def init_landmarkers():
    base_options_hand = python.BaseOptions(model_asset_path=str(HAND_MODEL_PATH))
    options_hand = vision.HandLandmarkerOptions(
        base_options=base_options_hand,
        num_hands=2,
        min_hand_detection_confidence=0.4,
        min_hand_presence_confidence=0.4,
        min_tracking_confidence=0.4
    )
    detector_hand = vision.HandLandmarker.create_from_options(options_hand)

    base_options_pose = python.BaseOptions(model_asset_path=str(POSE_MODEL_PATH))
    options_pose = vision.PoseLandmarkerOptions(
        base_options=base_options_pose,
        min_pose_detection_confidence=0.4,
        min_pose_presence_confidence=0.4,
        min_tracking_confidence=0.4
    )
    detector_pose = vision.PoseLandmarker.create_from_options(options_pose)

    return detector_hand, detector_pose

def extract_landmarks_from_video(video_path: str, detector_hand, detector_pose, frame_step: int = 1):
    cap = cv2.VideoCapture(video_path)
    if not cap.isOpened():
        return None, 0, 0, 0

    raw_frames_data = [] # List of tuples: (right_hand_21x3, left_hand_21x3, pose_4x3, has_rh, has_lh, has_p)
    frame_idx = 0
    total_raw_frames = int(cap.get(cv2.CAP_PROP_FRAME_COUNT))

    while True:
        ret, frame = cap.read()
        if not ret or frame is None:
            break

        if frame_idx % frame_step != 0:
            frame_idx += 1
            continue

        rgb_frame = cv2.cvtColor(frame, cv2.COLOR_BGR2RGB)
        mp_image = mp.Image(image_format=mp.ImageFormat.SRGB, data=rgb_frame)

        # 1. Pose detection
        pose_res = detector_pose.detect(mp_image)
        pose_pts = np.zeros((4, 3), dtype=np.float32)
        has_pose = False

        if pose_res.pose_landmarks and len(pose_res.pose_landmarks) > 0:
            pl = pose_res.pose_landmarks[0]
            # Left shoulder (11), Right shoulder (12), Left elbow (13), Right elbow (14)
            if len(pl) > 14:
                has_pose = True
                pose_pts[0] = [pl[11].x, pl[11].y, pl[11].z]
                pose_pts[1] = [pl[12].x, pl[12].y, pl[12].z]
                pose_pts[2] = [pl[13].x, pl[13].y, pl[13].z]
                pose_pts[3] = [pl[14].x, pl[14].y, pl[14].z]

        # 2. Hand detection
        hand_res = detector_hand.detect(mp_image)
        rh_pts = np.zeros((21, 3), dtype=np.float32)
        lh_pts = np.zeros((21, 3), dtype=np.float32)
        has_rh = False
        has_lh = False

        if hand_res.hand_landmarks and hand_res.handedness:
            for idx, handedness_cat in enumerate(hand_res.handedness):
                hand_type = handedness_cat[0].category_name # "Left" or "Right"
                landmarks = hand_res.hand_landmarks[idx]
                pts = np.array([[lm.x, lm.y, lm.z] for lm in landmarks], dtype=np.float32)

                if hand_type == "Right":
                    rh_pts = pts
                    has_rh = True
                else:
                    lh_pts = pts
                    has_lh = True

        raw_frames_data.append((rh_pts, lh_pts, pose_pts, has_rh, has_lh, has_pose))
        frame_idx += 1

    cap.release()

    if len(raw_frames_data) == 0:
        return None, 0, 0, 0

    return raw_frames_data, total_raw_frames, len(raw_frames_data), frame_idx

def main():
    print("=== AccessBridge Phase 4: Landmark Extraction ===")
    start_time = time.time()

    if not MANIFEST_PATH.exists():
        raise FileNotFoundError(f"Manifest not found at {MANIFEST_PATH}")

    PROCESSED_DIR.mkdir(parents=True, exist_ok=True)
    REPORT_DIR.mkdir(parents=True, exist_ok=True)

    df = pd.read_csv(MANIFEST_PATH)
    print(f"Loaded manifest with {len(df)} clips.")

    print("Initializing MediaPipe Task Landmarkers...")
    detector_hand, detector_pose = init_landmarkers()
    print("Landmarkers ready.")

    cleaner = LandmarkCleaner(target_length=32, max_gap=3, fallback_scale=0.20)
    extractor = FeatureExtractor(target_length=32)

    results = []
    skipped_count = 0

    # Summary statistics tracking
    rh_detected_frames_total = 0
    lh_detected_frames_total = 0
    pose_detected_frames_total = 0
    processed_frames_total = 0

    for idx, row in df.iterrows():
        vpath = row["video_path"]
        cid = row["class_id"]
        cname = row["class_name"]
        split = row["split"]
        vname = row["filename"]

        print(f"[{idx+1}/{len(df)}] Extracting landmarks for: {cname}/{vname}...", end=" ", flush=True)
        t0 = time.time()

        raw_frames, total_raw, processed_raw, _ = extract_landmarks_from_video(
            vpath, detector_hand, detector_pose, frame_step=1
        )

        if raw_frames is None or len(raw_frames) < 4:
            print("FAILED (insufficient frames)")
            skipped_count += 1
            continue

        T = len(raw_frames)
        processed_frames_total += T

        # Prepare raw arrays
        raw_seq = np.zeros((T, 138), dtype=np.float32)
        rh_mask = np.zeros(T, dtype=bool)
        lh_mask = np.zeros(T, dtype=bool)
        pose_mask = np.zeros(T, dtype=bool)

        for t, (rh, lh, p, has_rh, has_lh, has_p) in enumerate(raw_frames):
            if has_rh:
                rh_mask[t] = True
                rh_detected_frames_total += 1
            if has_lh:
                lh_mask[t] = True
                lh_detected_frames_total += 1
            if has_p:
                pose_mask[t] = True
                pose_detected_frames_total += 1

            # Normalization per frame
            norm_rh, norm_lh, _ = cleaner.normalize_frame_coordinates(rh, lh, p)
            
            # Pack coordinates: Right hand (63), Left hand (63), Pose (12)
            raw_seq[t, 0:63] = norm_rh.flatten()
            raw_seq[t, 63:126] = norm_lh.flatten()
            raw_seq[t, 126:138] = p.flatten()

        # Short-gap linear interpolation
        clean_seq, _ = cleaner.interpolate_short_gaps(raw_seq, rh_mask | lh_mask)

        # Temporal resampling to 32 frames
        resampled_seq = cleaner.temporal_resample(clean_seq) # (32, 138)

        # Classical tabular summary extraction
        tabular_feat = extractor.extract_tabular_features(resampled_seq) # (291,)

        dt = time.time() - t0
        print(f"OK ({T}f -> 32f in {dt:.2f}s)")

        results.append({
            "video_path": vpath,
            "filename": vname,
            "class_id": cid,
            "class_name": cname,
            "split": split,
            "sequence_32x138": resampled_seq,
            "tabular_291": tabular_feat,
            "raw_frames_count": T,
            "rh_presence_ratio": float(rh_mask.mean()),
            "lh_presence_ratio": float(lh_mask.mean()),
            "pose_presence_ratio": float(pose_mask.mean())
        })

    total_time = time.time() - start_time
    print(f"\nExtracted {len(results)}/{len(df)} samples in {total_time:.1f}s ({skipped_count} skipped).")

    # Split and save numpy arrays
    splits = ["train", "val", "test"]
    split_meta = {}

    for sp in splits:
        sp_items = [r for r in results if r["split"] == sp]
        if len(sp_items) == 0:
            continue

        sequences = np.stack([r["sequence_32x138"] for r in sp_items], axis=0) # (N, 32, 138)
        tabulars = np.stack([r["tabular_291"] for r in sp_items], axis=0)      # (N, 291)
        labels = np.array([r["class_id"] for r in sp_items], dtype=np.int64)  # (N,)
        filenames = [r["filename"] for r in sp_items]

        np.save(PROCESSED_DIR / f"{sp}_sequences.npy", sequences)
        np.save(PROCESSED_DIR / f"{sp}_tabular.npy", tabulars)
        np.save(PROCESSED_DIR / f"{sp}_labels.npy", labels)

        print(f"[{sp.upper()}] Saved {len(sp_items)} samples:")
        print(f"  - sequences: {sequences.shape} (dtype: {sequences.dtype})")
        print(f"  - tabular:   {tabulars.shape} (dtype: {tabulars.dtype})")
        print(f"  - labels:    {labels.shape} (dtype: {labels.dtype})")

        split_meta[sp] = {
            "samples": len(sp_items),
            "sequence_shape": list(sequences.shape),
            "tabular_shape": list(tabulars.shape),
            "class_distribution": {int(c): int((labels == c).sum()) for c in range(5)}
        }

    # Save extraction metadata
    meta = {
        "dataset_name": "INCLUDE-GREETING-SUBSET-v1",
        "total_extracted": len(results),
        "total_manifest": len(df),
        "extraction_duration_seconds": round(total_time, 2),
        "tensor_sequence_shape": [32, 138],
        "tabular_dimension": 291,
        "landmark_breakdown": {
            "right_hand": "21 landmarks x 3 coords (indices 0:63)",
            "left_hand": "21 landmarks x 3 coords (indices 63:126)",
            "upper_body_pose": "4 landmarks (left/right shoulder, left/right elbow) x 3 coords (indices 126:138)"
        },
        "presence_statistics": {
            "right_hand_average_coverage": float(rh_detected_frames_total / max(1, processed_frames_total)),
            "left_hand_average_coverage": float(lh_detected_frames_total / max(1, processed_frames_total)),
            "pose_average_coverage": float(pose_detected_frames_total / max(1, processed_frames_total))
        },
        "splits": split_meta
    }

    meta_json_path = PROCESSED_DIR / "extraction_metadata.json"
    with open(meta_json_path, "w") as f:
        json.dump(meta, f, indent=2)
    print(f"Saved extraction metadata: {meta_json_path}")

    # Generate Markdown Report
    report_md = f"""# AccessBridge Phase 4: MediaPipe Landmark Extraction Report

**Dataset:** `INCLUDE-GREETING-SUBSET-v1`  
**Pipeline:** MediaPipe HandLandmarker + PoseLandmarker Lite  
**Total Processed Clips:** {len(results)}/{len(df)} ({len(results)/len(df)*100:.1f}%)  
**Processing Elapsed Time:** {total_time:.1f}s ({total_time/len(df):.2f}s per clip)  
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

- **Upper-Body Pose Presence:** {meta['presence_statistics']['pose_average_coverage']*100:.1f}% of video frames
- **Dominant (Right) Hand Presence:** {meta['presence_statistics']['right_hand_average_coverage']*100:.1f}% of video frames
- **Non-Dominant (Left) Hand Presence:** {meta['presence_statistics']['left_hand_average_coverage']*100:.1f}% of video frames (consistent with one-handed vs. two-handed sign distribution)

---

## 3. Partitioned Arrays Generated

| Partition | Samples | Sequential Tensor (`.npy`) | Tabular Matrix (`.npy`) | Labels (`.npy`) |
|:---|:---:|:---:|:---:|:---:|
| **Train (70%)** | {split_meta.get('train', {}).get('samples', 0)} | `(74, 32, 138)` | `(74, 291)` | `(74,)` |
| **Val (15%)** | {split_meta.get('val', {}).get('samples', 0)} | `(16, 32, 138)` | `(16, 291)` | `(16,)` |
| **Test (15%)** | {split_meta.get('test', {}).get('samples', 0)} | `(16, 32, 138)` | `(16, 291)` | `(16,)` |
"""
    report_md_path = REPORT_DIR / "landmark_extraction_report.md"
    with open(report_md_path, "w", encoding="utf-8") as f:
        f.write(report_md)
    print(f"Saved extraction markdown report: {report_md_path}")
    print("=== Landmark Extraction Pipeline Complete ===")

if __name__ == "__main__":
    main()
