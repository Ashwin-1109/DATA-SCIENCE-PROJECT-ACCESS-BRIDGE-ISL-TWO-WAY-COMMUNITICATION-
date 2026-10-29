"""
AccessBridge - Speech-to-Text (STT) Backend Endpoint
Supports chunk-based transcription using faster-whisper (CPU, small model).
Fails gracefully with informative message if faster-whisper is not installed.
"""

import os
import tempfile
from fastapi import APIRouter, UploadFile, File, Form, HTTPException
from typing import Optional

router = APIRouter(prefix="/stt", tags=["Speech to Text"])

_whisper_model = None
_whisper_load_attempted = False
_whisper_error_message = None


def get_whisper_model():
    """Lazily load faster-whisper model without crashing the server if missing."""
    global _whisper_model, _whisper_load_attempted, _whisper_error_message
    if _whisper_load_attempted:
        return _whisper_model, _whisper_error_message

    _whisper_load_attempted = True
    try:
        from faster_whisper import WhisperModel
        # Load small model on CPU with int8 quantization for fast, low-memory execution
        _whisper_model = WhisperModel("small", device="cpu", compute_type="int8")
        _whisper_error_message = None
        return _whisper_model, None
    except ImportError:
        _whisper_error_message = "faster-whisper is not installed in the Python environment. Browser Web Speech API or manual typed input will be used."
        _whisper_model = None
        return None, _whisper_error_message
    except Exception as e:
        _whisper_error_message = f"Failed to initialize Whisper model: {str(e)}"
        _whisper_model = None
        return None, _whisper_error_message


@router.post("")
@router.post("/")
async def transcribe_audio(
    file: UploadFile = File(...),
    language: Optional[str] = Form(None)
):
    """
    Transcribes uploaded audio chunk (3-5s WebM/WAV) using faster-whisper on CPU.
    Returns clear fallback status if the model is not installed.
    """
    model, err = get_whisper_model()
    if model is None:
        return {
            "success": False,
            "text": "",
            "language": language or "en",
            "installed": False,
            "fallback": "web_speech_or_typed",
            "message": err or "STT backend engine unavailable."
        }

    try:
        suffix = os.path.splitext(file.filename or "")[1] or ".webm"
        with tempfile.NamedTemporaryFile(delete=False, suffix=suffix) as tmp:
            content = await file.read()
            tmp.write(content)
            tmp_path = tmp.name

        try:
            # Map common language codes
            lang_code = None
            if language:
                cleaned_lang = language.split("-")[0].lower()
                if cleaned_lang in ["en", "ta", "hi"]:
                    lang_code = cleaned_lang

            segments, info = model.transcribe(
                tmp_path,
                beam_size=3,
                language=lang_code,
                vad_filter=True,
                vad_parameters=dict(min_silence_duration_ms=400)
            )

            text_chunks = [segment.text.strip() for segment in segments]
            full_text = " ".join(text_chunks).strip()

            return {
                "success": True,
                "text": full_text,
                "language": info.language if hasattr(info, "language") else (lang_code or "en"),
                "confidence": getattr(info, "language_probability", 0.95),
                "installed": True,
                "fallback": None,
                "message": "Transcription successful."
            }
        finally:
            if os.path.exists(tmp_path):
                os.remove(tmp_path)

    except Exception as e:
        return {
            "success": False,
            "text": "",
            "language": language or "en",
            "installed": True,
            "fallback": "web_speech_or_typed",
            "message": f"Audio decoding/transcription error: {str(e)}"
        }


@router.get("/status")
def get_stt_status():
    """Reports whether local Whisper model is installed and ready."""
    try:
        import faster_whisper
        return {
            "available": True,
            "installed": True,
            "engine": "faster-whisper",
            "model_size": "small",
            "device": "cpu"
        }
    except ImportError:
        return {
            "available": False,
            "installed": False,
            "engine": "web_speech_api_only",
            "message": "faster-whisper not installed; backend falls back gracefully to browser SpeechRecognition."
        }
