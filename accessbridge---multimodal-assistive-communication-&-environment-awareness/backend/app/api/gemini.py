"""
AccessBridge - Gemini API Endpoints
Multimodal assistive vision and environment narration
"""

from fastapi import APIRouter, HTTPException
from pydantic import BaseModel, Field
from typing import Optional
from backend.app.services.gemini_service import gemini_service

router = APIRouter(prefix="/gemini", tags=["Gemini Multimodal AI"])

class DescribeSceneRequest(BaseModel):
    image_base64: str = Field(..., description="Base64 encoded JPEG or PNG image frame")
    mime_type: Optional[str] = "image/jpeg"
    prompt: Optional[str] = None

class DescribeSceneResponse(BaseModel):
    success: bool
    description: str
    model: Optional[str] = None
    error: Optional[str] = None

class SignClassifyRequest(BaseModel):
    image_base64: str = Field(..., description="Base64 encoded JPEG or PNG image frame containing sign gesture")
    mime_type: Optional[str] = "image/jpeg"

class SignClassifyResponse(BaseModel):
    success: bool
    class_name: str
    confidence: float
    reasoning: Optional[str] = None
    model: Optional[str] = None
    error: Optional[str] = None

class PlanSignsRequest(BaseModel):
    text: str = Field(..., description="Input spoken/written text to map into motion clips")

class PlanSignsResponse(BaseModel):
    original_text: str
    planned_clips: list
    matched_count: int
    unsupported_spans: list
    total_duration_sec: float
    supports_all: bool

@router.post("/describe", response_model=DescribeSceneResponse)
def describe_scene(req: DescribeSceneRequest):
    result = gemini_service.describe_scene(
        image_base64=req.image_base64,
        mime_type=req.mime_type or "image/jpeg",
        prompt=req.prompt
    )
    return DescribeSceneResponse(
        success=result.get("success", False),
        description=result.get("description", ""),
        model=result.get("model"),
        error=result.get("error")
    )

@router.post("/sign", response_model=SignClassifyResponse)
def classify_sign(req: SignClassifyRequest):
    result = gemini_service.classify_sign(
        image_base64=req.image_base64,
        mime_type=req.mime_type or "image/jpeg"
    )
    return SignClassifyResponse(
        success=result.get("success", False),
        class_name=result.get("class_name", "unknown"),
        confidence=result.get("confidence", 0.0),
        reasoning=result.get("reasoning"),
        model=result.get("model"),
        error=result.get("error")
    )

@router.post("/plan-signs", response_model=PlanSignsResponse)
def plan_signs(req: PlanSignsRequest):
    result = gemini_service.plan_signs(text=req.text)
    return PlanSignsResponse(**result)

class VerifySignRequest(BaseModel):
    image_base64: str = Field(..., description="Base64 encoded JPEG or PNG image frame of sign gesture")
    phrase: str = Field(..., description="Target sign phrase (e.g. 'Hello', 'How are you', etc.)")
    mime_type: Optional[str] = "image/jpeg"

class VerifySignResponse(BaseModel):
    success: bool
    verified: bool
    confidence: float
    status: str
    hand_position: str
    finger_shape: str
    feedback: str
    error: Optional[str] = None

@router.post("/verify-sign", response_model=VerifySignResponse)
def verify_sign(req: VerifySignRequest):
    result = gemini_service.verify_sign(
        image_base64=req.image_base64,
        phrase=req.phrase,
        mime_type=req.mime_type or "image/jpeg"
    )
    return VerifySignResponse(
        success=result.get("success", False),
        verified=result.get("verified", False),
        confidence=result.get("confidence", 0.0),
        status=result.get("status", "NEEDS_ADJUSTMENT"),
        hand_position=result.get("hand_position", "Unknown"),
        finger_shape=result.get("finger_shape", "Unknown"),
        feedback=result.get("feedback", ""),
        error=result.get("error")
    )


class VoiceCommandParseRequest(BaseModel):
    speech: str = Field(..., description="Spoken voice transcript to parse")


class VoiceCommandParseResponse(BaseModel):
    intent: str
    args: dict
    confirmation: str


@router.post("/command", response_model=VoiceCommandParseResponse)
def parse_command(req: VoiceCommandParseRequest):
    result = gemini_service.parse_voice_command(speech=req.speech)
    return VoiceCommandParseResponse(**result)


class VisualCardRequest(BaseModel):
    word: str
    prompt_modifier: Optional[str] = None


class VisualCardResponse(BaseModel):
    success: bool
    word: str
    imageUrl: Optional[str] = None
    fallback: str
    message: str


@router.post("/visual-card", response_model=VisualCardResponse)
def generate_visual_card(req: VisualCardRequest):
    result = gemini_service.generate_visual_card(word=req.word, prompt_modifier=req.prompt_modifier)
    return VisualCardResponse(**result)


class VisualCardEditRequest(BaseModel):
    image_base64: str
    instruction: str


@router.post("/visual-card/edit")
def edit_visual_card(req: VisualCardEditRequest):
    return {
        "success": True,
        "imageUrl": req.image_base64,
        "fallback": "original_preserved",
        "message": "Visual card modification preserved locally."
    }


@router.get("/status")
def get_gemini_status():
    return gemini_service.check_health()



