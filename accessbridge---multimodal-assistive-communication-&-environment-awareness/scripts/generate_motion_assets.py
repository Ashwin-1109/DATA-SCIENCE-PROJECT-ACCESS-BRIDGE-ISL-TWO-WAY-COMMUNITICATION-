"""
AccessBridge - Phase 4 Motion Asset Generator
Extracts real MediaPipe landmarks from the 5 representative greeting videos in INCLUDE,
computes normalized VRM humanoid bone quaternions, and exports versioned JSON motion clips.
"""

import os
import cv2
import json
import math
import numpy as np
import pandas as pd
from pathlib import Path

import mediapipe as mp
from mediapipe.tasks import python
from mediapipe.tasks.python import vision

PROJECT_ROOT = Path(__file__).resolve().parent.parent
MANIFEST_PATH = PROJECT_ROOT / "data" / "manifests" / "include_greetings_manifest.csv"
OUTPUT_DIR = PROJECT_ROOT / "public" / "motion"
OUTPUT_DIR.mkdir(parents=True, exist_ok=True)

HAND_MODEL_PATH = PROJECT_ROOT / "ml" / "assets" / "hand_landmarker.task"
POSE_MODEL_PATH = PROJECT_ROOT / "ml" / "assets" / "pose_landmarker.task"

REPRESENTATIVE_CLIPS = {
    "Hello": "48. Hello/MVI_0029.MOV",
    "How are you": "49. How are you/MVI_0033.MOV",
    "Alright": "50. Alright/MVI_0037.MOV",
    "Good Morning": "51. Good Morning/MVI_0042.MOV",
    "Good afternoon": "52. Good afternoon/MVI_0046.MOV"
}

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

def safe_direction(p1, p2, fallback=np.array([0.0, 1.0, 0.0])):
    v = p2 - p1
    norm = np.linalg.norm(v)
    if norm < 1e-6:
        return fallback
    return v / norm

def quat_from_vectors(u, v):
    """Computes quaternion [x, y, z, w] rotating unit vector u to unit vector v."""
    u = u / (np.linalg.norm(u) + 1e-9)
    v = v / (np.linalg.norm(v) + 1e-9)
    cos_theta = np.dot(u, v)
    if cos_theta > 0.999999:
        return [0.0, 0.0, 0.0, 1.0]
    elif cos_theta < -0.999999:
        axis = np.cross(np.array([1.0, 0.0, 0.0]), u)
        if np.linalg.norm(axis) < 0.01:
            axis = np.cross(np.array([0.0, 1.0, 0.0]), u)
        axis = axis / np.linalg.norm(axis)
        return [round(float(axis[0]), 4), round(float(axis[1]), 4), round(float(axis[2]), 4), 0.0]
    
    axis = np.cross(u, v)
    w = 1.0 + cos_theta
    q = np.array([axis[0], axis[1], axis[2], w], dtype=np.float32)
    q = q / np.linalg.norm(q)
    return [round(float(x), 4) for x in q]

def quat_from_axis_angle(axis, angle):
    axis = axis / (np.linalg.norm(axis) + 1e-9)
    half = angle * 0.5
    s = math.sin(half)
    c = math.cos(half)
    return [round(float(axis[0] * s), 4), round(float(axis[1] * s), 4), round(float(axis[2] * s), 4), round(float(c), 4)]

def quat_multiply(q1, q2):
    """Multiplies two quaternions [x, y, z, w]."""
    x1, y1, z1, w1 = q1
    x2, y2, z2, w2 = q2
    return np.array([
        w1*x2 + x1*w2 + y1*z2 - z1*y2,
        w1*y2 - x1*z2 + y1*w2 + z1*x2,
        w1*z2 + x1*y2 - y1*x2 + z1*w2,
        w1*w2 - x1*x2 - y1*y2 - z1*z2
    ], dtype=np.float64)

def quat_invert(q):
    """Inverts a quaternion [x, y, z, w]."""
    return np.array([-q[0], -q[1], -q[2], q[3]], dtype=np.float64)

def solve_frame_bones(pose_landmarks, pose_world_landmarks, right_hand, left_hand, right_hand_world, left_hand_world):
    rotations = {}
    
    # 1. Torso roll
    if pose_landmarks is not None and len(pose_landmarks) > 12:
        l_sh = pose_landmarks[11]
        r_sh = pose_landmarks[12]
        dx = l_sh[0] - r_sh[0]
        dy = l_sh[1] - r_sh[1]
        roll = math.atan2(-dy, max(1e-4, abs(dx))) * 0.5
        roll = max(-0.25, min(0.25, roll))
        rotations["chest"] = quat_from_axis_angle(np.array([0.0, 0.0, 1.0]), roll)

    # 2. Arms (Right and Left)
    has_world_pose = pose_world_landmarks is not None and len(pose_world_landmarks) > 16
    has_norm_pose = pose_landmarks is not None and len(pose_landmarks) > 16

    q_rupper_world = None
    q_rlower_world = None
    q_lupper_world = None
    q_llower_world = None

    if has_world_pose or has_norm_pose:
        if has_world_pose:
            # MediaPipe World Landmarks: X is subject left (+), Y is down (+), Z is away (+)
            # Three.js VRM: X is subject left (+), Y is UP (+), Z is viewer (+)
            p_rsh = np.array([pose_world_landmarks[12][0], -pose_world_landmarks[12][1], -pose_world_landmarks[12][2]])
            p_rel = np.array([pose_world_landmarks[14][0], -pose_world_landmarks[14][1], -pose_world_landmarks[14][2]])
            p_rwr = np.array([pose_world_landmarks[16][0], -pose_world_landmarks[16][1], -pose_world_landmarks[16][2]])

            p_lsh = np.array([pose_world_landmarks[11][0], -pose_world_landmarks[11][1], -pose_world_landmarks[11][2]])
            p_lel = np.array([pose_world_landmarks[13][0], -pose_world_landmarks[13][1], -pose_world_landmarks[13][2]])
            p_lwr = np.array([pose_world_landmarks[15][0], -pose_world_landmarks[15][1], -pose_world_landmarks[15][2]])
        else:
            p_rsh = np.array([pose_landmarks[12][0] - 0.5, -(pose_landmarks[12][1] - 0.5), -pose_landmarks[12][2]])
            p_rel = np.array([pose_landmarks[14][0] - 0.5, -(pose_landmarks[14][1] - 0.5), -pose_landmarks[14][2]])
            p_rwr = np.array([pose_landmarks[16][0] - 0.5, -(pose_landmarks[16][1] - 0.5), -pose_landmarks[16][2]])

            p_lsh = np.array([pose_landmarks[11][0] - 0.5, -(pose_landmarks[11][1] - 0.5), -pose_landmarks[11][2]])
            p_lel = np.array([pose_landmarks[13][0] - 0.5, -(pose_landmarks[13][1] - 0.5), -pose_landmarks[13][2]])
            p_lwr = np.array([pose_landmarks[15][0] - 0.5, -(pose_landmarks[15][1] - 0.5), -pose_landmarks[15][2]])

        # Right Arm (T-Pose rest vector: [1, 0, 0])
        v_rest_r = np.array([1.0, 0.0, 0.0])
        dir_rupper = safe_direction(p_rsh, p_rel, np.array([1.0, -1.0, 0.0]))
        dir_rlower = safe_direction(p_rel, p_rwr, np.array([1.0, -1.0, 0.0]))
        
        q_rupper_world = quat_from_vectors(v_rest_r, dir_rupper)
        q_rlower_world = quat_from_vectors(v_rest_r, dir_rlower)
        # Forearm local rotation relative to upper arm: Inverse(q_upper) * q_lower
        q_rlower_local = quat_multiply(quat_invert(q_rupper_world), q_rlower_world)
        q_rlower_local = q_rlower_local / np.linalg.norm(q_rlower_local)

        rotations["rightUpperArm"] = [round(float(x), 4) for x in q_rupper_world]
        rotations["rightLowerArm"] = [round(float(x), 4) for x in q_rlower_local]

        # Left Arm (T-Pose rest vector: [-1, 0, 0])
        v_rest_l = np.array([-1.0, 0.0, 0.0])
        dir_lupper = safe_direction(p_lsh, p_lel, np.array([-1.0, -1.0, 0.0]))
        dir_llower = safe_direction(p_lel, p_lwr, np.array([-1.0, -1.0, 0.0]))

        q_lupper_world = quat_from_vectors(v_rest_l, dir_lupper)
        q_llower_world = quat_from_vectors(v_rest_l, dir_llower)
        # Forearm local rotation relative to upper arm: Inverse(q_upper) * q_lower
        q_llower_local = quat_multiply(quat_invert(q_lupper_world), q_llower_world)
        q_llower_local = q_llower_local / np.linalg.norm(q_llower_local)

        rotations["leftUpperArm"] = [round(float(x), 4) for x in q_lupper_world]
        rotations["leftLowerArm"] = [round(float(x), 4) for x in q_llower_local]

    # 3. Hands & Fingers
    for side, hand, hand_w in [("right", right_hand, right_hand_world), ("left", left_hand, left_hand_world)]:
        is_r = side == "right"
        v_rest = np.array([-1.0 if is_r else 1.0, 0.0, 0.0])
        q_parent_lower = q_rlower_world if is_r else q_llower_world

        if hand is not None and len(hand) >= 21:
            w_idx = 0
            m_mcp = 9
            
            # Use hand world landmarks if available
            if hand_w is not None and len(hand_w) >= 21:
                p_w = np.array([hand_w[w_idx][0], -hand_w[w_idx][1], -hand_w[w_idx][2]])
                p_m = np.array([hand_w[m_mcp][0], -hand_w[m_mcp][1], -hand_w[m_mcp][2]])
            else:
                p_w = np.array([hand[w_idx][0] - 0.5, -(hand[w_idx][1] - 0.5), -hand[w_idx][2]])
                p_m = np.array([hand[m_mcp][0] - 0.5, -(hand[m_mcp][1] - 0.5), -hand[m_mcp][2]])

            hand_fwd = safe_direction(p_w, p_m, v_rest)
            q_hand_world = quat_from_vectors(v_rest, hand_fwd)

            # Local wrist rotation relative to forearm:
            if q_parent_lower is not None:
                q_hand_local = quat_multiply(quat_invert(q_parent_lower), q_hand_world)
                q_hand_local = q_hand_local / np.linalg.norm(q_hand_local)
                # Dampen wrist extremes to avoid joint flipping
                angle = 2.0 * math.acos(max(-1.0, min(1.0, q_hand_local[3])))
                if angle > 0.8: # max 45 degrees
                    scale = 0.8 / angle
                    axis = q_hand_local[:3] / (math.sin(angle * 0.5) + 1e-9)
                    q_hand_local = quat_from_axis_angle(axis, 0.8)
                rotations[f"{side}Hand"] = [round(float(x), 4) for x in q_hand_local]
            else:
                rotations[f"{side}Hand"] = [round(float(x), 4) for x in q_hand_world]

            # Fingers: Thumb (1,2,3,4), Index (5,6,7,8), Middle (9,10,11,12), Ring (13,14,15,16), Little (17,18,19,20)
            finger_map = [
                ("Thumb", [1, 2, 3, 4]),
                ("Index", [5, 6, 7, 8]),
                ("Middle", [9, 10, 11, 12]),
                ("Ring", [13, 14, 15, 16]),
                ("Little", [17, 18, 19, 20]),
            ]
            for fname, idxs in finger_map:
                p0 = np.array(hand[idxs[0]])
                p1 = np.array(hand[idxs[1]])
                p2 = np.array(hand[idxs[2]])
                p3 = np.array(hand[idxs[3]])
                
                v1 = safe_direction(p0, p1)
                v2 = safe_direction(p1, p2)
                v3 = safe_direction(p2, p3)
                
                curl1 = math.acos(max(-1.0, min(1.0, np.dot(v1, v2))))
                curl2 = math.acos(max(-1.0, min(1.0, np.dot(v2, v3))))
                
                axis = np.array([0.0, 0.0, -1.0 if is_r else 1.0])
                q_prox = quat_from_axis_angle(axis, min(1.4, curl1 * 0.6))
                q_inter = quat_from_axis_angle(axis, min(1.5, curl1 * 0.8))
                q_dist = quat_from_axis_angle(axis, min(1.4, curl2 * 0.9))
                
                if fname == "Thumb":
                    rotations[f"{side}ThumbMetacarpal"] = q_prox
                    rotations[f"{side}ThumbProximal"] = q_inter
                    rotations[f"{side}ThumbDistal"] = q_dist
                else:
                    rotations[f"{side}{fname}Proximal"] = q_prox
                    rotations[f"{side}{fname}Intermediate"] = q_inter
                    rotations[f"{side}{fname}Distal"] = q_dist

    return rotations

def process_video_to_motion_clip(detector_hand, detector_pose, phrase, rel_path, full_path):
    print(f"Extracting motion for '{phrase}' from {rel_path}...")
    cap = cv2.VideoCapture(str(full_path))
    if not cap.isOpened():
        print(f"Failed to open video: {full_path}")
        return None

    fps = cap.get(cv2.CAP_PROP_FPS) or 25.0
    
    keyframes = []
    frame_idx = 0

    while True:
        ret, frame = cap.read()
        if not ret:
            break

        time_sec = round(frame_idx / fps, 3)
        rgb_frame = cv2.cvtColor(frame, cv2.COLOR_BGR2RGB)
        mp_image = mp.Image(image_format=mp.ImageFormat.SRGB, data=rgb_frame)

        pose_res = detector_pose.detect(mp_image)
        hand_res = detector_hand.detect(mp_image)

        pose_lms = None
        pose_world_lms = None
        if pose_res.pose_landmarks and len(pose_res.pose_landmarks) > 0:
            pose_lms = [[lm.x, lm.y, lm.z] for lm in pose_res.pose_landmarks[0]]
        if pose_res.pose_world_landmarks and len(pose_res.pose_world_landmarks) > 0:
            pose_world_lms = [[lm.x, lm.y, lm.z] for lm in pose_res.pose_world_landmarks[0]]

        right_h = None
        left_h = None
        right_h_w = None
        left_h_w = None
        if hand_res.hand_landmarks and hand_res.handedness:
            for idx, handedness_cat in enumerate(hand_res.handedness):
                hand_type = handedness_cat[0].category_name
                landmarks = hand_res.hand_landmarks[idx]
                h_pts = [[lm.x, lm.y, lm.z] for lm in landmarks]
                h_w_pts = None
                if hand_res.hand_world_landmarks and len(hand_res.hand_world_landmarks) > idx:
                    h_w_pts = [[lm.x, lm.y, lm.z] for lm in hand_res.hand_world_landmarks[idx]]
                if hand_type == "Right":
                    right_h = h_pts
                    right_h_w = h_w_pts
                else:
                    left_h = h_pts
                    left_h_w = h_w_pts

        bones = solve_frame_bones(pose_lms, pose_world_lms, right_h, left_h, right_h_w, left_h_w)
        if bones:
            keyframes.append({
                "timeSec": time_sec,
                "rotations": bones
            })

        frame_idx += 1

    cap.release()

    duration_sec = round(len(keyframes) / fps, 2)
    clip_id = f"motion_{phrase.lower().replace(' ', '_')}_01"

    clip_data = {
        "clipId": clip_id,
        "phrase": phrase,
        "durationSec": duration_sec,
        "fps": round(fps, 1),
        "frameCount": len(keyframes),
        "sourceAssetId": rel_path,
        "sourceDataset": "INCLUDE-GREETING-SUBSET-v1",
        "reviewStatus": "unreviewed",
        "license": "CC-BY 4.0 (AI4Bharat INCLUDE Benchmark)",
        "coordinateSchema": "VRM-HUMANOID-v1",
        "keyframes": keyframes
    }

    out_file = OUTPUT_DIR / f"{clip_id}.json"
    with open(out_file, "w") as f:
        json.dump(clip_data, f, indent=2)
    print(f"Saved {out_file} ({len(keyframes)} keyframes, {duration_sec}s)")
    return clip_data

def main():
    print("=== Generating Motion Clips from Real Source Videos ===")
    df = pd.read_csv(MANIFEST_PATH)
    path_map = dict(zip(df["relative_path"], df["video_path"]))

    detector_hand, detector_pose = init_landmarkers()
    index_data = []

    for phrase, rel_path in REPRESENTATIVE_CLIPS.items():
        # Match path
        full_path = Path(path_map.get(rel_path.replace("/", "\\"), str(PROJECT_ROOT / rel_path)))
        if not full_path.exists():
            full_path = Path(path_map.get(rel_path.replace("\\", "/"), str(PROJECT_ROOT / rel_path)))

        if not full_path.exists():
            print(f"Video file not found: {full_path}")
            continue

        clip = process_video_to_motion_clip(detector_hand, detector_pose, phrase, rel_path, full_path)
        if clip:
            index_data.append({
                "clipId": clip["clipId"],
                "phrase": clip["phrase"],
                "durationSec": clip["durationSec"],
                "frameCount": clip["frameCount"],
                "sourceAssetId": clip["sourceAssetId"],
                "reviewStatus": clip["reviewStatus"]
            })

    with open(OUTPUT_DIR / "motion_index.json", "w") as f:
        json.dump(index_data, f, indent=2)

    print(f"\nGenerated {len(index_data)} authentic motion clips in {OUTPUT_DIR}")

if __name__ == "__main__":
    main()
