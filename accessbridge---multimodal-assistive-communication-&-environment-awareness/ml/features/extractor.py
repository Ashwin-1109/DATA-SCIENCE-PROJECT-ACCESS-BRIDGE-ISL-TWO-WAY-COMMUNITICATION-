"""
AccessBridge - Feature Extraction Pipeline
Generates:
1. Sequential Tensor (32, 138) for Deep Models (LSTM, GRU, 1D-CNN, Transformer)
2. Tabular Feature Vector (291 dimensions) for Classical Models (SVM, Random Forest)
"""

import numpy as np

class FeatureExtractor:
    def __init__(self, target_length: int = 32):
        self.target_length = target_length

    def extract_tabular_features(self, sequence_32x138: np.ndarray) -> np.ndarray:
        """
        Computes 291 summary statistics across the 32-frame sequence:
        - Coordinate temporal mean: 138
        - Coordinate temporal std: 138
        - Velocities of right/left wrist & index tip: 6
        - Inter-hand distance summary (mean, min, max): 3
        - Missing ratio / presence statistics: 6
        Total = 291 features
        """
        # Coordinate mean & std
        mean_coords = np.mean(sequence_32x138, axis=0) # 138
        std_coords = np.std(sequence_32x138, axis=0)   # 138

        # Velocities (frame differences)
        diffs = np.diff(sequence_32x138, axis=0)
        # Right wrist (indices 0:3), index tip (indices 24:27)
        # Left wrist (indices 63:66), left index tip (indices 87:90)
        rw_vel = np.mean(np.linalg.norm(diffs[:, 0:3], axis=1))
        rit_vel = np.mean(np.linalg.norm(diffs[:, 24:27], axis=1))
        lw_vel = np.mean(np.linalg.norm(diffs[:, 63:66], axis=1))
        lit_vel = np.mean(np.linalg.norm(diffs[:, 87:90], axis=1))
        pose_vel1 = np.mean(np.linalg.norm(diffs[:, 126:129], axis=1))
        pose_vel2 = np.mean(np.linalg.norm(diffs[:, 129:132], axis=1))
        velocities = np.array([rw_vel, rit_vel, lw_vel, lit_vel, pose_vel1, pose_vel2])

        # Inter-hand distance trajectory
        inter_hand_dists = np.linalg.norm(sequence_32x138[:, 0:3] - sequence_32x138[:, 63:66], axis=1)
        hand_dist_stats = np.array([
            np.mean(inter_hand_dists),
            np.min(inter_hand_dists),
            np.max(inter_hand_dists)
        ])

        # Quality metrics
        zeros_ratio = np.mean(sequence_32x138 == 0, axis=0)[:6]

        tabular_vector = np.concatenate([
            mean_coords,
            std_coords,
            velocities,
            hand_dist_stats,
            zeros_ratio
        ])

        return tabular_vector.astype(np.float32)
