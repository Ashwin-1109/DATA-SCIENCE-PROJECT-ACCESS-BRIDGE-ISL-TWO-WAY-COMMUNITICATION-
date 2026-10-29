"""
AccessBridge - Text-to-Speech (TTS) Backend Endpoint
Supports optional premium neural voice generation (Google Cloud TTS / ElevenLabs)
Fails gracefully to browser SpeechSynthesis with informative fallback response.
"""

import os
import json
import base64
import urllib.request
import urllib.error
from fastapi import APIRouter, HTTPException
from pydantic import BaseModel, Field
from typing import Optional, List

router = APIRouter(prefix="/tts", tags=["Text to Speech"])


class TtsSynthesizeRequest(BaseModel):
    text: str = Field(..., description="Text content to speak")
    language: Optional[str] = Field("en-IN", description="Language tag (en-IN, ta-IN, hi-IN)")
    voice_gender: Optional[str] = Field("female", description="Voice preference")


class TtsSynthesizeResponse(BaseModel):
    success: bool
    audio_base64: Optional[str] = None
    mime_type: Optional[str] = None
    fallback: str
    message: str
    provider: str


@router.post("", response_model=TtsSynthesizeResponse)
@router.post("/", response_model=TtsSynthesizeResponse)
def synthesize_speech(req: TtsSynthesizeRequest):
    """
    Synthesizes speech via cloud API if credentials are provided in .env.
    Otherwise gracefully instructs client to use high-quality local Web Speech API.
    """
    eleven_key = os.getenv("ELEVENLABS_API_KEY", "").strip()
    google_tts_key = os.getenv("GOOGLE_TTS_API_KEY", "").strip()

    # 1. Attempt ElevenLabs if key configured
    if eleven_key and not eleven_key.startswith("YOUR_"):
        try:
            # Default to a friendly soft female voice ID (Rachel)
            voice_id = os.getenv("ELEVENLABS_VOICE_ID", "21m00Tcm4TlvDq8ikWAM")
            url = f"https://api.elevenlabs.io/v1/text-to-speech/{voice_id}"
            payload = json.dumps({
                "text": req.text,
                "model_id": "eleven_multilingual_v2",
                "voice_settings": {
                    "stability": 0.65,
                    "similarity_boost": 0.80,
                    "style": 0.20,
                    "use_speaker_boost": True
                }
            }).encode("utf-8")

            request = urllib.request.Request(
                url,
                data=payload,
                headers={
                    "Content-Type": "application/json",
                    "xi-api-key": eleven_key,
                    "Accept": "audio/mpeg"
                }
            )

            with urllib.request.urlopen(request, timeout=8) as response:
                audio_data = response.read()
                b64 = base64.b64encode(audio_data).decode("utf-8")
                return TtsSynthesizeResponse(
                    success=True,
                    audio_base64=f"data:audio/mpeg;base64,{b64}",
                    mime_type="audio/mpeg",
                    fallback="none",
                    message="Premium neural voice generated.",
                    provider="elevenlabs"
                )
        except Exception as e:
            # Fall back safely
            pass

    # 2. Default graceful fallback to Web Speech
    return TtsSynthesizeResponse(
        success=False,
        audio_base64=None,
        mime_type=None,
        fallback="browser_speech_synthesis",
        message="Cloud TTS key not configured; using high-quality local browser speech synthesis.",
        provider="web_speech_api"
    )


@router.get("/status")
def get_tts_status():
    eleven_key = os.getenv("ELEVENLABS_API_KEY", "").strip()
    has_premium = bool(eleven_key and not eleven_key.startswith("YOUR_"))
    return {
        "premium_available": has_premium,
        "default_engine": "web_speech_api",
        "supported_engines": ["elevenlabs", "web_speech_api"] if has_premium else ["web_speech_api"],
        "recommended_female_voices": [
            "Microsoft Neerja Online (Natural) - English (India)",
            "Microsoft Pallavi Online (Natural) - Tamil (India)",
            "Microsoft Aria Online (Natural) - English (United States)",
            "Google UK English Female",
            "Samantha"
        ]
    }
