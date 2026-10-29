"""
AccessBridge - FastAPI Main Entrypoint
Local CPU-first multimodal assistive communication backend.
Includes global error handling, request timeouts, and subsystem health reporting.
"""

import os
import time
import asyncio
from pathlib import Path
from fastapi import FastAPI, Request
from fastapi.responses import JSONResponse
from fastapi.middleware.cors import CORSMiddleware
from fastapi.staticfiles import StaticFiles
import dotenv

# Load environment variables from .env
env_path = Path(__file__).resolve().parent.parent.parent / ".env"
dotenv.load_dotenv(dotenv_path=env_path)

from backend.app.core.config import ARTIFACTS_DIR, DATA_DIR
from backend.app.database.session import engine, Base
from backend.app.api import readiness, sign, training, gemini, models, webcam, documents, stt, tts

# Initialize SQLite tables
Base.metadata.create_all(bind=engine)

SERVER_START_TIME = time.time()

app = FastAPI(
    title="AccessBridge API",
    description="Multimodal Assistive Communication & Environment Awareness API",
    version="1.0.0"
)

# Configure CORS
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
    expose_headers=["*"],
)

# Request Timeout Middleware (15 second timeout for client requests)
@app.middleware("http")
async def timeout_middleware(request: Request, call_next):
    # Static files and long training endpoints have extended leeway
    if request.url.path.startswith("/api/training/jobs") or request.url.path.startswith("/artifacts") or request.url.path.startswith("/data"):
        return await call_next(request)
        
    try:
        return await asyncio.wait_for(call_next(request), timeout=15.0)
    except asyncio.TimeoutError:
        return JSONResponse(
            status_code=504,
            content={
                "ok": False,
                "message": "Backend request timed out after 15 seconds.",
                "fallback": "Client offline fallback activated."
            }
        )

# Global Exception Handler (Never exposes raw stack traces to users)
@app.exception_handler(Exception)
async def global_exception_handler(request: Request, exc: Exception):
    import traceback
    print(f"[AccessBridge Global Error] {request.method} {request.url.path}: {exc}")
    traceback.print_exc()
    return JSONResponse(
        status_code=500,
        content={
            "ok": False,
            "message": "An internal service error occurred. Safe fallback engaged.",
            "fallback": "Local offline mode activated",
            "error_type": exc.__class__.__name__
        }
    )

# Mount Static Artifacts & Data
if ARTIFACTS_DIR.exists():
    app.mount("/artifacts", StaticFiles(directory=str(ARTIFACTS_DIR)), name="artifacts")
    app.mount("/api/artifacts", StaticFiles(directory=str(ARTIFACTS_DIR)), name="api_artifacts")

if DATA_DIR.exists():
    app.mount("/data", StaticFiles(directory=str(DATA_DIR)), name="data")
    app.mount("/api/data", StaticFiles(directory=str(DATA_DIR)), name="api_data")

# Mount API Routers
app.include_router(readiness.router, prefix="/api")
app.include_router(sign.router, prefix="/api")
app.include_router(training.router, prefix="/api")
app.include_router(gemini.router, prefix="/api")
app.include_router(models.router, prefix="/api")
app.include_router(webcam.router, prefix="/api")
app.include_router(documents.router, prefix="/api")
app.include_router(stt.router, prefix="/api")
app.include_router(tts.router, prefix="/api")

@app.get("/api/health")
def health():
    """
    Subsystem-level health report
    """
    uptime_sec = round(time.time() - SERVER_START_TIME, 1)

    # 1. Database
    db_status = "operational"
    try:
        with engine.connect() as conn:
            conn.execute("SELECT 1")
    except Exception:
        db_status = "error_fallback_in_memory"

    # 2. PyTorch Sign Model
    sign_model_status = {
        "status": "ready" if sign.sign_inference_engine.is_model_loaded() else "not_loaded",
        "active_model": sign.sign_inference_engine.active_model_name,
        "active_type": sign.sign_inference_engine.active_model_type,
        "vocabulary_count": len(sign.INCLUDE_VOCABULARY)
    }

    # 3. Gemini Multimodal
    gemini_health = gemini.gemini_service.check_health()

    # 4. STT (Whisper)
    stt_status = {
        "status": "ready" if stt._whisper_model is not None else ("available" if stt._whisper_error_message is None else "fallback_browser_speech"),
        "model_loaded": stt._whisper_model is not None,
        "device": "cpu"
    }

    # 5. TTS
    elevenlabs_key = os.getenv("ELEVENLABS_API_KEY", "").strip()
    google_tts_key = os.getenv("GOOGLE_TTS_API_KEY", "").strip()
    tts_status = {
        "status": "ready",
        "active_provider": "elevenlabs" if elevenlabs_key and not elevenlabs_key.startswith("YOUR_") else (
            "google_tts" if google_tts_key and not google_tts_key.startswith("YOUR_") else "browser_speech_synthesis"
        )
    }

    return {
        "status": "ok",
        "version": "1.0.0",
        "uptime_sec": uptime_sec,
        "subsystems": {
            "database": db_status,
            "sign_recognition": sign_model_status,
            "gemini_vision": gemini_health,
            "speech_to_text": stt_status,
            "text_to_speech": tts_status,
            "storage": {
                "artifacts_dir": str(ARTIFACTS_DIR),
                "artifacts_exists": ARTIFACTS_DIR.exists(),
                "data_dir": str(DATA_DIR),
                "data_exists": DATA_DIR.exists()
            }
        }
    }

@app.get("/api/capabilities")
def get_capabilities():
    keys_present = {
        "gemini": bool(gemini.gemini_service.is_available()),
        "elevenlabs": bool(os.getenv("ELEVENLABS_API_KEY", "").strip() and not os.getenv("ELEVENLABS_API_KEY", "").startswith("YOUR_")),
        "google_tts": bool(os.getenv("GOOGLE_TTS_API_KEY", "").strip() and not os.getenv("GOOGLE_TTS_API_KEY", "").startswith("YOUR_"))
    }
    
    # Active TTS provider
    tts_provider = "browser"
    if keys_present["elevenlabs"]:
        tts_provider = "elevenlabs"
    elif keys_present["google_tts"]:
        tts_provider = "google_tts"
        
    return {
        "ok": True,
        "keys_present": keys_present,
        "whisper_loaded": bool(stt._whisper_model is not None),
        "whisper_installed": bool(stt._whisper_error_message is None or stt._whisper_model is not None),
        "tts_provider": tts_provider,
        "active_model": {
            "name": sign.sign_inference_engine.active_model_name,
            "type": sign.sign_inference_engine.active_model_type,
            "path": sign.sign_inference_engine.active_model_path,
            "is_loaded": sign.sign_inference_engine.is_model_loaded(),
            "vocabulary_count": len(sign.INCLUDE_VOCABULARY)
        }
    }

if __name__ == "__main__":
    import uvicorn
    uvicorn.run("backend.app.main:app", host="0.0.0.0", port=8000, reload=True)
