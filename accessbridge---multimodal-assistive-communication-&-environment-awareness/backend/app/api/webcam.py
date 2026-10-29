"""
AccessBridge - IP Webcam Proxy & YOLO + Gemini Environmental Analysis
Allows connecting remote/mobile IP cameras (e.g. Android IP Webcam app),
running pretrained YOLOv8 object detection, and synthesizing Gemini spatial descriptions for blind users.
"""

import base64
import urllib.request
import urllib.error
from fastapi import APIRouter, HTTPException
from pydantic import BaseModel, Field
from typing import Optional, List, Dict, Any

from backend.app.services.yolo_service import yolo_service
from backend.app.services.gemini_service import gemini_service

router = APIRouter(prefix="/webcam", tags=["IP Webcam & Environmental AI"])

class FetchFrameRequest(BaseModel):
    url: str = Field(..., description="IP Webcam snapshot URL (e.g. http://192.168.1.50:8080/shot.jpg)")

class FetchFrameResponse(BaseModel):
    success: bool
    image_base64: str
    content_type: str = "image/jpeg"
    error: Optional[str] = None

class AnalyzeEnvironmentRequest(BaseModel):
    image_base64: Optional[str] = Field(None, description="Base64 encoded image frame")
    webcam_url: Optional[str] = Field(None, description="Remote IP camera URL to fetch frame from")
    prompt: Optional[str] = Field(None, description="Optional custom user question or prompt")

class AnalyzeEnvironmentResponse(BaseModel):
    success: bool
    count: int
    objects: List[Dict[str, Any]]
    spatial_summary: str
    gemini_description: str
    annotated_image_base64: Optional[str] = None
    frame_base64: Optional[str] = None
    error: Optional[str] = None

def _fetch_url_frame(url: str) -> tuple[str, str]:
    """Helper to fetch image bytes from remote URL and return (base64_str, content_type)."""
    # Clean up url if user entered plain host without shot.jpg
    cleaned_url = url.strip()
    if not cleaned_url.startswith("http://") and not cleaned_url.startswith("https://"):
        cleaned_url = "http://" + cleaned_url

    # Common IP Webcam paths
    req = urllib.request.Request(
        cleaned_url,
        headers={"User-Agent": "AccessBridge-Assistive-Client/1.0"}
    )
    with urllib.request.urlopen(req, timeout=6) as response:
        content_type = response.headers.get_content_type() or "image/jpeg"
        data = response.read()
        b64 = base64.b64encode(data).decode("utf-8")
        return b64, content_type

@router.post("/fetch-frame", response_model=FetchFrameResponse)
def fetch_webcam_frame(req: FetchFrameRequest):
    try:
        b64, c_type = _fetch_url_frame(req.url)
        return FetchFrameResponse(
            success=True,
            image_base64=f"data:{c_type};base64,{b64}",
            content_type=c_type
        )
    except urllib.error.URLError as e:
        return FetchFrameResponse(
            success=False,
            image_base64="",
            error=f"Could not connect to IP Webcam ({str(e.reason)}). Verify IP address and port."
        )
    except Exception as e:
        return FetchFrameResponse(
            success=False,
            image_base64="",
            error=f"Error fetching IP webcam frame: {str(e)}"
        )

@router.post("/analyze-environment", response_model=AnalyzeEnvironmentResponse)
def analyze_environment(req: AnalyzeEnvironmentRequest):
    img_b64 = req.image_base64

    # 1. If webcam_url provided, fetch live frame
    if not img_b64 and req.webcam_url:
        try:
            raw_b64, c_type = _fetch_url_frame(req.webcam_url)
            img_b64 = f"data:{c_type};base64,{raw_b64}"
        except Exception as e:
            return AnalyzeEnvironmentResponse(
                success=False,
                count=0,
                objects=[],
                spatial_summary="",
                gemini_description="Failed to fetch image frame from IP webcam.",
                error=f"IP Webcam connection error: {str(e)}"
            )

    if not img_b64:
        return AnalyzeEnvironmentResponse(
            success=False,
            count=0,
            objects=[],
            spatial_summary="",
            gemini_description="No image frame received.",
            error="Please provide either image_base64 or a valid webcam_url."
        )

    # 2. Run pretrained YOLO object detection
    yolo_res = yolo_service.detect_from_base64(img_b64)
    objects = yolo_res.get("objects", [])
    count = yolo_res.get("count", 0)
    spatial_summary = yolo_res.get("spatial_summary", "")
    annotated_b64 = yolo_res.get("annotated_image_base64")

    # 3. Formulate assistive prompt combining YOLO detections with Gemini
    detected_desc = ""
    if objects:
        detected_desc = "The YOLO vision system detected: " + ", ".join(
            [f"{o['label']} ({o['spatial_position']}, {o['distance_category']})" for o in objects[:8]]
        ) + ". "

    blind_assist_prompt = (
        f"{detected_desc} "
        f"Provide a clear, detailed, and vivid spatial description of this entire environment for a blind person. "
        f"Describe everything that is present, its position (left, right, straight ahead, foreground, background), "
        f"any walkable pathway, open doors, ground hazards or obstacles, and lighting/setting. "
        f"Use natural language formatted for spoken audio."
    )
    if req.prompt:
        blind_assist_prompt += f" Also answer this user question: '{req.prompt}'"

    # 4. Synthesize environment description with Gemini Vision
    gemini_res = gemini_service.describe_scene(
        image_base64=img_b64,
        prompt=blind_assist_prompt
    )

    gemini_text = gemini_res.get("description", "")
    if not gemini_text:
        gemini_text = spatial_summary

    return AnalyzeEnvironmentResponse(
        success=True,
        count=count,
        objects=objects,
        spatial_summary=spatial_summary,
        gemini_description=gemini_text,
        annotated_image_base64=annotated_b64,
        frame_base64=img_b64
    )
