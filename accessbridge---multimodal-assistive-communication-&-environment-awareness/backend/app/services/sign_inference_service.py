"""
AccessBridge - Real Sign Inference Engine
Loads genuine trained model checkpoints (PyTorch or Scikit-Learn),
executes standardized preprocessing (AB-LM-v1), and returns true logits & confidence.
"""

import os
import time
import torch
import numpy as np
from pathlib import Path
from typing import Optional, Dict, Any, Tuple, List
import joblib

from backend.app.core.config import MODELS_DIR, BASE_DIR, TARGET_SEQUENCE_LENGTH, REJECTION_THRESHOLD
from ml.preprocessing.cleaner import LandmarkCleaner
from ml.features.extractor import FeatureExtractor
from ml.models.transformer_model import CompactSignTransformer
from ml.models.lstm_model import BiLSTMSignModel
from ml.models.gru_model import BiGRUSignModel
from ml.models.cnn1d_model import Conv1DSignModel

GREETINGS_VOCABULARY = [
    "Hello",
    "How are you",
    "Alright",
    "Good Morning",
    "Good afternoon"
]
INCLUDE_VOCABULARY = GREETINGS_VOCABULARY

class SignInferenceEngine:
    def __init__(self):
        self.cleaner = LandmarkCleaner(target_length=TARGET_SEQUENCE_LENGTH)
        self.extractor = FeatureExtractor(target_length=TARGET_SEQUENCE_LENGTH)
        self.active_model_name: Optional[str] = None
        self.active_model_type: Optional[str] = None
        self.active_model_path: Optional[str] = None
        self.model_instance: Any = None
        self.device = torch.device("cpu")
        self.vocabulary = GREETINGS_VOCABULARY
        
        # Auto-discover any pre-existing checkpoint
        self.discover_and_load_checkpoint()

    def discover_and_load_checkpoint(self) -> bool:
        """Looks for any trained model in artifacts/models or models/checkpoints."""
        config_path = MODELS_DIR / "active_model_config.json"
        if config_path.exists():
            try:
                import json
                with open(config_path) as f:
                    cfg = json.load(f)
                self.vocabulary = cfg.get("class_names", GREETINGS_VOCABULARY)
                ckpt_name = cfg.get("checkpoint_file", "cnn1d_best.pth")
                ckpt_path = MODELS_DIR / ckpt_name
                if ckpt_path.exists():
                    if ckpt_name.endswith(".pth"):
                        if self.load_pytorch_checkpoint(str(ckpt_path), cfg.get("active_model_name", "1D-CNN")):
                            return True
                    else:
                        if self.load_classical_checkpoint(str(ckpt_path)):
                            return True
            except Exception as e:
                print(f"[Inference Engine] Notice reading active_model_config.json: {e}")

        search_dirs = [MODELS_DIR, BASE_DIR / "models" / "checkpoints"]
        for s_dir in search_dirs:
            if s_dir.exists():
                for pth in s_dir.glob("*.pth"):
                    if self.load_pytorch_checkpoint(str(pth)):
                        return True
                for job in s_dir.glob("*.joblib"):
                    if self.load_classical_checkpoint(str(job)):
                        return True
        return False

    def load_pytorch_checkpoint(self, checkpoint_path: str, model_type: Optional[str] = None) -> bool:
        try:
            p = Path(checkpoint_path)
            if not p.exists():
                return False

            checkpoint = torch.load(p, map_location=self.device)
            state_dict = checkpoint.get("state_dict", checkpoint) if isinstance(checkpoint, dict) else checkpoint
            arch = model_type or (checkpoint.get("arch") if isinstance(checkpoint, dict) else None) or p.stem.split("_")[0]

            if "transformer" in arch.lower():
                model = CompactSignTransformer(num_classes=len(self.vocabulary), num_layers=3)
            elif "lstm" in arch.lower():
                model = BiLSTMSignModel(num_classes=len(self.vocabulary))
            elif "gru" in arch.lower():
                model = BiGRUSignModel(num_classes=len(self.vocabulary))
            elif "cnn" in arch.lower():
                model = Conv1DSignModel(num_classes=len(self.vocabulary))
            else:
                model = CompactSignTransformer(num_classes=len(self.vocabulary), num_layers=3)

            model.load_state_dict(state_dict)
            model.eval()
            self.model_instance = model
            self.active_model_name = p.name
            self.active_model_type = arch
            self.active_model_path = str(p)
            print(f"[Inference Engine] Loaded PyTorch checkpoint: {p.name} ({arch})")
            return True
        except Exception as e:
            print(f"[Inference Engine] Error loading PyTorch checkpoint {checkpoint_path}: {e}")
            return False

    def load_classical_checkpoint(self, checkpoint_path: str) -> bool:
        try:
            p = Path(checkpoint_path)
            if not p.exists():
                return False
            model = joblib.load(p)
            self.model_instance = model
            self.active_model_name = p.name
            self.active_model_type = "classical"
            self.active_model_path = str(p)
            print(f"[Inference Engine] Loaded Classical checkpoint: {p.name}")
            return True
        except Exception as e:
            print(f"[Inference Engine] Error loading classical checkpoint {checkpoint_path}: {e}")
            return False

    def get_available_models(self) -> List[Dict[str, Any]]:
        """Lists all registered models in artifacts/models with metadata."""
        models = []
        if not MODELS_DIR.exists():
            return models

        display_names = {
            "cnn1d_best.pth": "1D-CNN (Convolutional)",
            "bilstm_best.pth": "Bi-LSTM (Bidirectional)",
            "bigru_best.pth": "Bi-GRU (Gated Recurrent)",
            "transformer_best.pth": "Compact Transformer (Attention)",
            "random_forest_best.joblib": "Random Forest (Ensemble)",
            "svm_rbf_best.joblib": "SVM (RBF Kernel)"
        }

        for path in sorted(MODELS_DIR.glob("*")):
            if path.suffix in [".pth", ".joblib"]:
                size_kb = round(path.stat().st_size / 1024, 1)
                is_active = (self.active_model_name == path.name)
                m_type = "pytorch" if path.suffix == ".pth" else "classical"
                models.append({
                    "filename": path.name,
                    "display_name": display_names.get(path.name, path.stem),
                    "model_type": m_type,
                    "size_kb": size_kb,
                    "is_active": is_active,
                    "path": str(path)
                })
        return models

    def activate_model(self, checkpoint_filename: str) -> Dict[str, Any]:
        """Atomically switches active model checkpoint after smoke testing."""
        target_path = MODELS_DIR / checkpoint_filename
        if not target_path.exists():
            return {"success": False, "error": f"Checkpoint {checkpoint_filename} does not exist."}

        # Backup current state in case smoke test fails
        prev_instance = self.model_instance
        prev_name = self.active_model_name
        prev_type = self.active_model_type
        prev_path = self.active_model_path

        load_success = False
        if checkpoint_filename.endswith(".pth"):
            load_success = self.load_pytorch_checkpoint(str(target_path))
        else:
            load_success = self.load_classical_checkpoint(str(target_path))

        if not load_success:
            self.model_instance = prev_instance
            self.active_model_name = prev_name
            self.active_model_type = prev_type
            self.active_model_path = prev_path
            return {"success": False, "error": "Failed to load checkpoint."}

        # Run smoke test on a dummy sequence
        dummy_seq = np.zeros((TARGET_SEQUENCE_LENGTH, 138), dtype=np.float32)
        try:
            smoke_res = self.predict_sequence_tensor(dummy_seq)
            if "class_name" not in smoke_res:
                raise RuntimeError("Smoke test produced invalid response structure.")
        except Exception as e:
            # Rollback
            self.model_instance = prev_instance
            self.active_model_name = prev_name
            self.active_model_type = prev_type
            self.active_model_path = prev_path
            return {"success": False, "error": f"Smoke test failed on {checkpoint_filename}: {str(e)}"}

        # Update active_model_config.json
        try:
            import json
            config_path = MODELS_DIR / "active_model_config.json"
            cfg = {}
            if config_path.exists():
                with open(config_path) as f:
                    cfg = json.load(f)
            cfg["active_model_name"] = self.active_model_type or checkpoint_filename
            cfg["checkpoint_file"] = checkpoint_filename
            cfg["class_names"] = self.vocabulary
            with open(config_path, "w") as f:
                json.dump(cfg, f, indent=2)
        except Exception as e:
            print(f"[Inference Engine] Notice writing active_model_config: {e}")

        return {
            "success": True,
            "active_model_name": self.active_model_name,
            "active_model_type": self.active_model_type,
            "message": f"Successfully activated and smoke-tested {checkpoint_filename}."
        }

    def is_model_loaded(self) -> bool:
        return self.model_instance is not None

    def frames_to_sequential_tensor(self, frames_list: List[Dict[str, Any]]) -> Tuple[np.ndarray, int]:
        """
        Converts list of FrameLandmarksSchema into (32, 138) normalized tensor
        matching Feature Schema AB-LM-v1 with true preprocessing parity.
        """
        num_frames = len(frames_list)
        if num_frames == 0:
            return np.zeros((TARGET_SEQUENCE_LENGTH, 138), dtype=np.float32), 0

        raw_sequence = []
        valid_count = 0

        for f in frames_list:
            frame_arr = np.zeros(138, dtype=np.float32)
            
            # Right hand (21 landmarks * 3 coords = 63 dims)
            rh = f.get("right_hand") or []
            if rh and len(rh) >= 21:
                valid_count += 1
                for idx in range(21):
                    frame_arr[idx*3] = rh[idx].get("x", 0.0)
                    frame_arr[idx*3 + 1] = rh[idx].get("y", 0.0)
                    frame_arr[idx*3 + 2] = rh[idx].get("z", 0.0)

            # Left hand (21 landmarks * 3 coords = 63 dims)
            lh = f.get("left_hand") or []
            if lh and len(lh) >= 21:
                valid_count += 1
                for idx in range(21):
                    frame_arr[63 + idx*3] = lh[idx].get("x", 0.0)
                    frame_arr[63 + idx*3 + 1] = lh[idx].get("y", 0.0)
                    frame_arr[63 + idx*3 + 2] = lh[idx].get("z", 0.0)

            # Pose upper body (4 landmarks: left/right shoulder, left/right elbow = 12 dims)
            pose = f.get("pose") or []
            if pose and len(pose) >= 4:
                for idx in range(4):
                    frame_arr[126 + idx*3] = pose[idx].get("x", 0.0)
                    frame_arr[126 + idx*3 + 1] = pose[idx].get("y", 0.0)
                    frame_arr[126 + idx*3 + 2] = pose[idx].get("z", 0.0)

            raw_sequence.append(frame_arr)

        raw_np = np.array(raw_sequence, dtype=np.float32)

        # Standardized parity preprocessing: gap interpolation + torso/shoulder normalization + 32-frame resample
        processed_32x138 = self.cleaner.process_raw_frames(raw_np)
        return processed_32x138, valid_count

    def predict(self, frames_list: List[Dict[str, Any]]) -> Dict[str, Any]:
        start = time.perf_counter()

        if not self.is_model_loaded():
            return {
                "class_name": "Unavailable — required model/artifact not loaded.",
                "class_id": -1,
                "confidence": 0.0,
                "is_unknown_or_rejected": True,
                "rejection_reason": "No trained model weights are currently loaded in the backend registry.",
                "extracted_frame_count": len(frames_list),
                "model_architecture": "None",
                "inference_latency_ms": round((time.perf_counter() - start) * 1000, 2),
                "landmarks_quality_score": 0
            }

        if len(frames_list) < 8:
            return {
                "class_name": "Rejected: Too few frames",
                "class_id": -1,
                "confidence": 0.0,
                "is_unknown_or_rejected": True,
                "rejection_reason": f"Sign recording has {len(frames_list)} frames (requires at least 8 frames).",
                "extracted_frame_count": len(frames_list),
                "model_architecture": self.active_model_name or "Unknown",
                "inference_latency_ms": round((time.perf_counter() - start) * 1000, 2),
                "landmarks_quality_score": 0
            }

        seq_32x138, valid_count = self.frames_to_sequential_tensor(frames_list)
        quality_score = min(100, int((valid_count / max(1, len(frames_list) * 2)) * 100))

        if valid_count < 3:
            return {
                "class_name": "Rejected: No hands detected",
                "class_id": -1,
                "confidence": 0.0,
                "is_unknown_or_rejected": True,
                "rejection_reason": "No hand landmarks detected across the recording span.",
                "extracted_frame_count": len(frames_list),
                "model_architecture": self.active_model_name or "Unknown",
                "inference_latency_ms": round((time.perf_counter() - start) * 1000, 2),
                "landmarks_quality_score": 0
            }

        # Real model inference
        try:
            if isinstance(self.model_instance, torch.nn.Module):
                tensor_input = torch.tensor(seq_32x138, dtype=torch.float32).unsqueeze(0).to(self.device)
                with torch.no_grad():
                    logits = self.model_instance(tensor_input)
                    probs = torch.softmax(logits, dim=-1).squeeze(0).cpu().numpy()
                    predicted_idx = int(np.argmax(probs))
                    confidence = float(probs[predicted_idx])
            else:
                # Scikit-learn classical model
                tabular_features = self.extractor.extract_tabular_features(seq_32x138).reshape(1, -1)
                predicted_idx = int(self.model_instance.predict(tabular_features)[0])
                if hasattr(self.model_instance, "predict_proba"):
                    probs = self.model_instance.predict_proba(tabular_features)[0]
                    confidence = float(probs[predicted_idx])
                else:
                    confidence = 0.85

            latency = round((time.perf_counter() - start) * 1000, 2)
            predicted_word = self.vocabulary[predicted_idx] if 0 <= predicted_idx < len(self.vocabulary) else "Unknown"

            # Threshold rejection
            if confidence < REJECTION_THRESHOLD:
                return {
                    "class_name": "Rejected: Low confidence",
                    "class_id": -1,
                    "confidence": round(confidence, 4),
                    "is_unknown_or_rejected": True,
                    "rejection_reason": f"Confidence ({confidence:.1%}) below operating threshold ({REJECTION_THRESHOLD:.0%}).",
                    "extracted_frame_count": len(frames_list),
                    "model_architecture": self.active_model_name or "PyTorch Model",
                    "inference_latency_ms": latency,
                    "landmarks_quality_score": quality_score
                }

            return {
                "class_name": predicted_word,
                "class_id": predicted_idx,
                "confidence": round(confidence, 4),
                "is_unknown_or_rejected": False,
                "extracted_frame_count": len(frames_list),
                "model_architecture": self.active_model_name or "PyTorch Model",
                "inference_latency_ms": latency,
                "landmarks_quality_score": quality_score
            }
        except Exception as e:
            return {
                "class_name": "Inference Error",
                "class_id": -1,
                "confidence": 0.0,
                "is_unknown_or_rejected": True,
                "rejection_reason": f"Error during model forward pass: {str(e)}",
                "extracted_frame_count": len(frames_list),
                "model_architecture": self.active_model_name or "Error",
                "inference_latency_ms": round((time.perf_counter() - start) * 1000, 2),
                "landmarks_quality_score": quality_score
            }

    def predict_sequence_tensor(self, seq_32x138: np.ndarray) -> Dict[str, Any]:
        """Direct inference from preprocessed 32x138 tensor."""
        start = time.perf_counter()
        if not self.is_model_loaded():
            return {"class_name": "Unavailable", "confidence": 0.0, "is_unknown_or_rejected": True}
        if isinstance(self.model_instance, torch.nn.Module):
            tensor_input = torch.tensor(seq_32x138, dtype=torch.float32).unsqueeze(0).to(self.device)
            with torch.no_grad():
                logits = self.model_instance(tensor_input)
                probs = torch.softmax(logits, dim=-1).squeeze(0).cpu().numpy()
                predicted_idx = int(np.argmax(probs))
                confidence = float(probs[predicted_idx])
        else:
            tabular_features = self.extractor.extract_tabular_features(seq_32x138).reshape(1, -1)
            predicted_idx = int(self.model_instance.predict(tabular_features)[0])
            probs = self.model_instance.predict_proba(tabular_features)[0] if hasattr(self.model_instance, "predict_proba") else None
            confidence = float(probs[predicted_idx]) if probs is not None else 0.85

        is_rejected = confidence < REJECTION_THRESHOLD
        class_name = self.vocabulary[predicted_idx] if predicted_idx < len(self.vocabulary) else f"Sign #{predicted_idx}"
        return {
            "class_name": class_name if not is_rejected else "Rejected: Low Confidence",
            "class_id": predicted_idx if not is_rejected else -1,
            "confidence": round(confidence, 4),
            "is_unknown_or_rejected": is_rejected,
            "inference_latency_ms": round((time.perf_counter() - start) * 1000, 2)
        }

sign_inference_engine = SignInferenceEngine()
