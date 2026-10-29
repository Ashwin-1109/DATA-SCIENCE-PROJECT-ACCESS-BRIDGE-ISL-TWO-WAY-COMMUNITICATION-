"""
Test Suite: Model Activation & Rollback Engine
Verifies that when an invalid or corrupted checkpoint is activated,
the engine safely catches the error, rolls back active state, and leaves the previous model intact.
"""

import sys
from pathlib import Path

# Add project root to path
ROOT = Path(__file__).resolve().parent.parent
sys.path.insert(0, str(ROOT))

from backend.app.services.sign_inference_service import sign_inference_engine

def test_model_activate_rollback():
    print("--- Testing PyTorch Model Activation & Rollback ---")
    
    # 1. Discover or ensure initial active model
    initial_loaded = sign_inference_engine.is_model_loaded()
    initial_name = sign_inference_engine.active_model_name
    initial_type = sign_inference_engine.active_model_type
    initial_path = sign_inference_engine.active_model_path
    
    print(f"  Initial Model State: loaded={initial_loaded}, name={initial_name}, type={initial_type}")
    
    # 2. Attempt to activate a non-existent / corrupted checkpoint
    fake_checkpoint = "non_existent_corrupted_model.pth"
    result = sign_inference_engine.activate_model(fake_checkpoint)
    
    # 3. Assert failure response
    assert result["success"] is False, "activate_model with invalid checkpoint should return success=False"
    assert "error" in result, "Result must contain error details"
    print(f"  Handled expected rejection cleanly: {result['error']}")
    
    # 4. Assert Atomic Rollback State
    assert sign_inference_engine.active_model_name == initial_name, "active_model_name must be preserved via rollback"
    assert sign_inference_engine.active_model_type == initial_type, "active_model_type must be preserved via rollback"
    assert sign_inference_engine.active_model_path == initial_path, "active_model_path must be preserved via rollback"
    assert sign_inference_engine.is_model_loaded() == initial_loaded, "Model loaded state must match pre-activation state"
    
    print("  PASS: Atomic rollback successfully preserved previous model state.")
    return True

if __name__ == "__main__":
    success = test_model_activate_rollback()
    if success:
        print("Model Activation Rollback Test: ALL PASSED")
        sys.exit(0)
    else:
        print("Model Activation Rollback Test: FAILED")
        sys.exit(1)
