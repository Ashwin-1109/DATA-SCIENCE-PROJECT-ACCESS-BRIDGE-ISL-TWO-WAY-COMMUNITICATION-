"""
AccessBridge - Pydantic Request & Response Schemas
"""

from typing import List, Optional, Dict, Any
from pydantic import BaseModel, Field

class HealthResponse(BaseModel):
    status: str
    version: str
    device: str
    uptime_sec: float

class SubsystemStatusResponse(BaseModel):
    id: str
    name: str
    category: str
    state: str
    details: str
    recovery_action: Optional[str] = None
    is_pretrained: bool = False

class LandmarkPointSchema(BaseModel):
    x: float
    y: float
    z: float
    visibility: Optional[float] = 1.0

class FrameLandmarksSchema(BaseModel):
    timestamp: int
    right_hand: Optional[List[LandmarkPointSchema]] = None
    left_hand: Optional[List[LandmarkPointSchema]] = None
    pose: Optional[List[LandmarkPointSchema]] = None
    has_right_hand: bool = False
    has_left_hand: bool = False
    has_pose: bool = False

class SignPredictRequest(BaseModel):
    frames: List[FrameLandmarksSchema]
    model_name: Optional[str] = "transformer"

class SignPredictResponse(BaseModel):
    class_name: str
    class_id: int
    confidence: float
    is_unknown_or_rejected: bool
    rejection_reason: Optional[str] = None
    extracted_frame_count: int
    model_architecture: str
    inference_latency_ms: float
    landmarks_quality_score: int

class TrainingJobCreateRequest(BaseModel):
    model_type: str = Field(..., description="svm, random_forest, lstm, gru, cnn1d, transformer")
    epochs: int = 30
    learning_rate: float = 0.001
    random_seed: int = 42
    is_smoke_test: bool = False

class TrainingJobStatusResponse(BaseModel):
    job_id: str
    model_type: str
    status: str
    progress_pct: float
    current_epoch: int
    total_epochs: int
    train_loss: Optional[float] = None
    val_accuracy: Optional[float] = None
    artifact_path: Optional[str] = None
    error_message: Optional[str] = None

class SignRecordRequest(BaseModel):
    word: str
    landmarks: List[List[float]] = Field(..., description="Normalized (32, 138) feature array")
    thumbnail_base64: Optional[str] = None
    signer_id: Optional[str] = "signer_user"

class SignRecordResponse(BaseModel):
    ok: bool
    sample_id: str
    word: str
    sample_count: int
    message: str

