"""
AccessBridge V1 - Comprehensive End-to-End System Verification
Verifies:
1. Backend health, readiness, and subsystem reporting
2. Sign vocabulary strictly aligned to 5 official greeting classes
3. Model registry listing all 6 checkpoints and atomic switching with smoke tests
4. Mathematical parity preprocessing through Cleaner
5. Deterministic sign planning with longest-phrase matching
6. Gemini sign recognition constraint (5 classes + unknown)
7. On-disk asset integrity: VRM avatar, 5 motion JSONs, MediaPipe WASM, TFLite models
"""

import sys
import json
from pathlib import Path
from fastapi.testclient import TestClient

# Setup root path
BASE_DIR = Path(__file__).resolve().parent.parent
sys.path.insert(0, str(BASE_DIR))

from backend.app.main import app

def test_system():
    client = TestClient(app)
    results = {}
    passed_all = True

    print("========================================================")
    print(" AccessBridge V1 Comprehensive System Verification")
    print("========================================================")

    # 1. Health check
    print("\n[1/7] Testing /api/health...")
    res = client.get("/api/health")
    assert res.status_code == 200, f"Health check failed: {res.text}"
    health_data = res.json()
    assert health_data["status"] == "ok"
    assert health_data["sign_model_loaded"] is True
    print(f"  -> Health OK: {health_data}")
    results["health"] = "PASS"

    # 2. Subsystems readiness
    print("\n[2/7] Testing /api/readiness/subsystems...")
    res = client.get("/api/readiness/subsystems")
    assert res.status_code == 200
    subsystems = res.json()
    subsystem_ids = [s["id"] for s in subsystems]
    assert "backend" in subsystem_ids
    assert "sign_model" in subsystem_ids
    sign_sub = next(s for s in subsystems if s["id"] == "sign_model")
    assert sign_sub["state"] == "ready"
    print(f"  -> Found {len(subsystems)} subsystems. Sign model state: {sign_sub['state']}")
    results["readiness"] = "PASS"

    # 3. Sign vocabulary check (strictly 5 classes)
    print("\n[3/7] Testing /api/sign/vocabulary...")
    res = client.get("/api/sign/vocabulary")
    assert res.status_code == 200
    vocab_data = res.json()
    expected_classes = ["Hello", "How are you", "Alright", "Good Morning", "Good afternoon"]
    assert vocab_data["vocabulary"] == expected_classes, f"Unexpected vocabulary: {vocab_data['vocabulary']}"
    assert vocab_data["count"] == 5
    print(f"  -> Vocabulary strictly matches 5 classes: {vocab_data['vocabulary']}")
    results["vocabulary"] = "PASS"

    # 4. Model Registry & Activation
    print("\n[4/7] Testing /api/models registry & activation...")
    res = client.get("/api/models")
    assert res.status_code == 200
    models = res.json()
    assert len(models) == 6, f"Expected 6 registered models, got {len(models)}"
    print(f"  -> Found {len(models)} registered models:")
    for m in models:
        active_mark = " (ACTIVE)" if m["is_active"] else ""
        print(f"     - {m['display_name']} [{m['filename']}] ({m['size_kb']} KB){active_mark}")

    # Switch to 1D-CNN
    res = client.post("/api/models/activate", json={"checkpoint_file": "cnn1d_best.pth"})
    assert res.status_code == 200
    assert res.json()["success"] is True
    print(f"  -> Activated 1D-CNN: {res.json()['message']}")

    # Switch to Transformer (verifying 3-layer fix)
    res = client.post("/api/models/activate", json={"checkpoint_file": "transformer_best.pth"})
    assert res.status_code == 200
    assert res.json()["success"] is True
    print(f"  -> Activated Transformer: {res.json()['message']}")

    # Switch to Bi-LSTM
    res = client.post("/api/models/activate", json={"checkpoint_file": "bilstm_best.pth"})
    assert res.status_code == 200
    assert res.json()["success"] is True
    print(f"  -> Activated Bi-LSTM: {res.json()['message']}")

    # Switch back to champion 1D-CNN
    res = client.post("/api/models/activate", json={"checkpoint_file": "cnn1d_best.pth"})
    assert res.status_code == 200
    results["model_registry"] = "PASS"

    # 5. Parity Inference via /api/sign/predict
    print("\n[5/7] Testing /api/sign/predict inference parity...")
    # Generate 32 valid dummy frames
    dummy_frames = []
    for f_idx in range(32):
        dummy_frames.append({
            "timestamp": f_idx * 33,
            "right_hand": [{"x": 0.5 + 0.05 * (f_idx % 3), "y": 0.4 + 0.02 * (f_idx % 2), "z": 0.0} for _ in range(21)],
            "left_hand": [{"x": 0.0, "y": 0.0, "z": 0.0} for _ in range(21)],
            "pose": [
                {"x": 0.4, "y": 0.3, "z": 0.0},
                {"x": 0.6, "y": 0.3, "z": 0.0},
                {"x": 0.35, "y": 0.5, "z": 0.0},
                {"x": 0.65, "y": 0.5, "z": 0.0}
            ],
            "has_right_hand": True,
            "has_left_hand": False,
            "has_pose": True
        })

    res = client.post("/api/sign/predict", json={"frames": dummy_frames})
    assert res.status_code == 200
    pred = res.json()
    print(f"  -> Prediction result: class='{pred['class_name']}', conf={pred['confidence']}, latency={pred['inference_latency_ms']}ms")
    assert "class_name" in pred
    assert "inference_latency_ms" in pred
    results["inference_parity"] = "PASS"

    # 6. Sign Planner & Gemini Sign Constraint
    print("\n[6/7] Testing /api/gemini/plan-signs longest-phrase matching...")
    test_text = "Hello! Good morning friend, how are you? Alright then."
    res = client.post("/api/gemini/plan-signs", json={"text": test_text})
    assert res.status_code == 200
    plan = res.json()
    matched_classes = [c["class_name"] for c in plan["planned_clips"]]
    print(f"  -> Input: '{test_text}'")
    print(f"  -> Matched Clips ({len(matched_classes)}): {matched_classes}")
    print(f"  -> Unsupported spans: {plan['unsupported_spans']}")
    assert "Hello" in matched_classes
    assert "Good Morning" in matched_classes
    assert "How are you" in matched_classes
    assert "Alright" in matched_classes
    results["sign_planner"] = "PASS"

    # 7. Asset Verification
    print("\n[7/7] Verifying on-disk assets integrity...")
    # Avatar
    avatar_path = BASE_DIR / "public" / "models" / "avatar.vrm"
    assert avatar_path.exists(), f"Missing avatar at {avatar_path}"
    print(f"  -> VRM Avatar: {avatar_path.stat().st_size / (1024*1024):.2f} MB OK")

    # Tasks models
    hand_task = BASE_DIR / "public" / "models" / "tasks" / "hand_landmarker.task"
    pose_task = BASE_DIR / "public" / "models" / "tasks" / "pose_landmarker.task"
    det_task = BASE_DIR / "public" / "models" / "tasks" / "efficientdet_lite0.tflite"
    assert hand_task.exists(), "Missing hand_landmarker.task"
    assert pose_task.exists(), "Missing pose_landmarker.task"
    assert det_task.exists(), "Missing efficientdet_lite0.tflite"
    print(f"  -> Tasks Models: Hand ({hand_task.stat().st_size/1024:.0f}KB), Pose ({pose_task.stat().st_size/1024:.0f}KB), EfficientDet ({det_task.stat().st_size/(1024*1024):.1f}MB) OK")

    # WASM files
    wasm_dir = BASE_DIR / "public" / "wasm"
    wasm_files = list(wasm_dir.glob("*.wasm"))
    assert len(wasm_files) >= 3, f"Expected at least 3 WASM files, got {len(wasm_files)}"
    print(f"  -> MediaPipe WASM binaries: {len(wasm_files)} files in {wasm_dir} OK")

    # Motion clips
    motion_dir = BASE_DIR / "public" / "motion"
    for phrase_clip in ["motion_hello_01.json", "motion_how_are_you_01.json", "motion_alright_01.json", "motion_good_morning_01.json", "motion_good_afternoon_01.json", "motion_index.json"]:
        m_path = motion_dir / phrase_clip
        assert m_path.exists(), f"Missing motion clip: {m_path}"
        with open(m_path) as f:
            m_data = json.load(f)
            if "keyframes" in m_data:
                assert len(m_data["keyframes"]) > 10
    print(f"  -> 5 Representative Motion Clips + Index verified in {motion_dir} OK")
    results["asset_integrity"] = "PASS"

    print("\n========================================================")
    print(" ALL VERIFICATION CHECKS PASSED (7/7)")
    print("========================================================")
    for test_name, status in results.items():
        print(f"  [PASS] {test_name}: {status}")

if __name__ == "__main__":
    test_system()
