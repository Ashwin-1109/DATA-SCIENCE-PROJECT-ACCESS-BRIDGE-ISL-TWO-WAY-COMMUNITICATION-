"""
AccessBridge - Model Registry & Activation API
Enables dynamic discovery, inspection, and atomic smoke-tested switching
between all 6 trained model checkpoints.
"""

from fastapi import APIRouter, HTTPException
from pydantic import BaseModel, Field
from typing import List, Optional, Dict, Any
from backend.app.services.sign_inference_service import sign_inference_engine

router = APIRouter(prefix="/models", tags=["Model Registry"])

class ModelInfoResponse(BaseModel):
    filename: str
    display_name: str
    model_type: str
    size_kb: float
    is_active: bool
    path: str

class ActivateModelRequest(BaseModel):
    checkpoint_file: str = Field(..., description="Filename of the checkpoint, e.g. cnn1d_best.pth")

class ActivateModelResponse(BaseModel):
    success: bool
    active_model_name: Optional[str] = None
    active_model_type: Optional[str] = None
    message: str
    error: Optional[str] = None

@router.get("", response_model=List[ModelInfoResponse])
def list_registered_models():
    """Returns all available trained models in the registry."""
    return sign_inference_engine.get_available_models()

@router.post("/activate", response_model=ActivateModelResponse)
def activate_model(request: ActivateModelRequest):
    """
    Atomically switches active model after smoke testing against sample tensor.
    """
    res = sign_inference_engine.activate_model(request.checkpoint_file)
    if not res.get("success"):
        raise HTTPException(status_code=400, detail=res.get("error", "Failed to activate model."))
    return ActivateModelResponse(
        success=True,
        active_model_name=res.get("active_model_name"),
        active_model_type=res.get("active_model_type"),
        message=res.get("message", "Model activated successfully.")
    )

@router.get("/active")
def get_active_model():
    """Returns metadata for the currently active model."""
    return {
        "is_model_loaded": sign_inference_engine.is_model_loaded(),
        "active_model_name": sign_inference_engine.active_model_name,
        "active_model_type": sign_inference_engine.active_model_type,
        "active_model_path": sign_inference_engine.active_model_path,
        "vocabulary": sign_inference_engine.vocabulary,
        "vocabulary_count": len(sign_inference_engine.vocabulary)
    }
