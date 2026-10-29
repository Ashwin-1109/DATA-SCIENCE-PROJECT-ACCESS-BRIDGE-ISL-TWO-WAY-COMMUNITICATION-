"""
AccessBridge - Standard Landmark Preprocessing & Cleaning Pipeline (AB-LM-v1)
Unified implementation shared across video extraction, training, and live inference.

Guarantees:
1. Mid-shoulder coordinate origin translation & inter-shoulder distance scaling
2. Absent-hand preservation (absent hands remain exact zeros; no fake subtraction offset)
3. Strict short-gap linear interpolation (only gaps <= max_gap frames are interpolated; long gaps remain zero)
4. Temporal linear resampling to canonical target_length (32 frames)
"""

import numpy as np
from typing import Tuple, List, Dict, Any, Optional

class LandmarkCleaner:
    def __init__(self, target_length: int = 32, max_gap: int = 3, fallback_scale: float = 0.20):
        self.target_length = target_length
        self.max_gap = max_gap
        self.fallback_scale = fallback_scale

    def normalize_frame_coordinates(
        self,
        right_hand: np.ndarray,      # (21, 3)
        left_hand: np.ndarray,       # (21, 3)
        pose: np.ndarray,            # (4, 3): [left_sh, right_sh, left_el, right_el]
        has_right: bool = True,
        has_left: bool = True,
        has_pose: bool = True
    ) -> Tuple[np.ndarray, np.ndarray, np.ndarray, float]:
        """
        Translates coordinates relative to mid-shoulder and scales by inter-shoulder distance.
        Absent hands remain exact zeros.
        """
        if has_pose and len(pose) >= 2:
            left_shoulder = pose[0]
            right_shoulder = pose[1]
            origin = (left_shoulder + right_shoulder) / 2.0
            shoulder_dist = float(np.linalg.norm(left_shoulder - right_shoulder))
            scale = shoulder_dist if shoulder_dist > 0.05 else self.fallback_scale
            norm_pose = (pose - origin) / scale
        else:
            origin = np.array([0.5, 0.5, 0.0], dtype=np.float32)
            scale = self.fallback_scale
            norm_pose = np.zeros_like(pose)

        # Right Hand: translate only if present
        if has_right and right_hand is not None and np.any(right_hand != 0):
            norm_right = (right_hand - origin) / scale
        else:
            norm_right = np.zeros_like(right_hand)

        # Left Hand: translate only if present
        if has_left and left_hand is not None and np.any(left_hand != 0):
            norm_left = (left_hand - origin) / scale
        else:
            norm_left = np.zeros_like(left_hand)

        return norm_right, norm_left, norm_pose, scale

    def interpolate_short_gaps(self, sequence: np.ndarray, mask: np.ndarray) -> Tuple[np.ndarray, np.ndarray]:
        """
        Interpolates ONLY short gaps (gap_length <= max_gap).
        Gaps longer than max_gap remain zero and unmasked.
        sequence: (T, D)
        mask: (T,) boolean
        """
        T, D = sequence.shape
        clean_seq = sequence.copy()
        clean_mask = mask.copy()

        if T <= 1 or np.all(mask) or not np.any(mask):
            return clean_seq, clean_mask

        # Identify contiguous missing spans
        i = 0
        while i < T:
            if not clean_mask[i]:
                gap_start = i
                while i < T and not clean_mask[i]:
                    i += 1
                gap_end = i # exclusive
                gap_len = gap_end - gap_start

                # Only interpolate if bounded on both sides and gap_len <= max_gap
                if gap_len <= self.max_gap and gap_start > 0 and gap_end < T:
                    prev_idx = gap_start - 1
                    next_idx = gap_end
                    prev_val = clean_seq[prev_idx]
                    next_val = clean_seq[next_idx]

                    for g in range(gap_len):
                        alpha = (g + 1) / (gap_len + 1)
                        clean_seq[gap_start + g] = (1.0 - alpha) * prev_val + alpha * next_val
                        clean_mask[gap_start + g] = True
            else:
                i += 1

        return clean_seq, clean_mask

    def temporal_resample(self, sequence: np.ndarray) -> np.ndarray:
        """
        Resamples variable length sequence (T, D) to fixed (target_length, D) via linear interpolation
        """
        T, D = sequence.shape
        if T == self.target_length:
            return sequence.astype(np.float32)

        if T == 0:
            return np.zeros((self.target_length, D), dtype=np.float32)

        orig_time = np.linspace(0.0, 1.0, T)
        target_time = np.linspace(0.0, 1.0, self.target_length)
        
        resampled = np.zeros((self.target_length, D), dtype=np.float32)
        for d in range(D):
            resampled[:, d] = np.interp(target_time, orig_time, sequence[:, d])

        return resampled

    def process_raw_frames(
        self,
        raw_frames: Any,
        return_metadata: bool = False
    ) -> Any:
        """
        Unified standardized processing pipeline:
        Takes either:
          - (T, 138) ndarray
          - list of (right_hand(21,3), left_hand(21,3), pose(4,3), has_rh, has_lh, has_p)
        Returns (32, 138) normalized tensor (and optionally metadata).
        """
        T = len(raw_frames)
        if T == 0:
            empty = np.zeros((self.target_length, 138), dtype=np.float32)
            return (empty, {"usable_frames": 0}) if return_metadata else empty

        norm_seq = np.zeros((T, 138), dtype=np.float32)
        rh_mask = np.zeros(T, dtype=bool)
        lh_mask = np.zeros(T, dtype=bool)

        if isinstance(raw_frames, np.ndarray) and raw_frames.ndim == 2 and raw_frames.shape[1] == 138:
            for t in range(T):
                rh = raw_frames[t, 0:63].reshape(21, 3)
                lh = raw_frames[t, 63:126].reshape(21, 3)
                pose = raw_frames[t, 126:138].reshape(4, 3)
                has_rh = bool(np.any(rh != 0.0))
                has_lh = bool(np.any(lh != 0.0))
                has_p = bool(np.any(pose != 0.0))

                n_rh, n_lh, n_p, _ = self.normalize_frame_coordinates(
                    rh, lh, pose, has_right=has_rh, has_left=has_lh, has_pose=has_p
                )
                norm_seq[t, 0:63] = n_rh.flatten()
                norm_seq[t, 63:126] = n_lh.flatten()
                norm_seq[t, 126:138] = n_p.flatten()
                rh_mask[t] = has_rh
                lh_mask[t] = has_lh
        else:
            for t, item in enumerate(raw_frames):
                if len(item) == 6:
                    rh, lh, pose, has_rh, has_lh, has_p = item
                else:
                    rh = item[0]
                    lh = item[1]
                    pose = item[2]
                    has_rh = True
                    has_lh = True
                    has_p = True

                n_rh, n_lh, n_p, _ = self.normalize_frame_coordinates(
                    rh, lh, pose, has_right=has_rh, has_left=has_lh, has_pose=has_p
                )
                norm_seq[t, 0:63] = n_rh.flatten()
                norm_seq[t, 63:126] = n_lh.flatten()
                norm_seq[t, 126:138] = n_p.flatten()
                rh_mask[t] = has_rh
                lh_mask[t] = has_lh

        # Interpolate short gaps per hand channel block
        norm_seq[:, 0:63], _ = self.interpolate_short_gaps(norm_seq[:, 0:63], rh_mask)
        norm_seq[:, 63:126], _ = self.interpolate_short_gaps(norm_seq[:, 63:126], lh_mask)

        # Resample to 32 frames
        final_tensor = self.temporal_resample(norm_seq)

        metadata = {
            "original_frames": T,
            "target_frames": self.target_length,
            "right_hand_presence": float(np.mean(rh_mask)),
            "left_hand_presence": float(np.mean(lh_mask)),
            "usable_frames": int(np.sum(rh_mask | lh_mask))
        }

        if return_metadata:
            return final_tensor, metadata
        return final_tensor
