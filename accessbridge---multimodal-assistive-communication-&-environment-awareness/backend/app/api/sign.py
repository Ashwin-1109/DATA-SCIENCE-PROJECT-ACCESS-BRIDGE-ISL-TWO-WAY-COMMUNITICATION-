"""
AccessBridge - Truthful Sign Language Recognition API
Uses real model weights, real preprocessing, and never fabricates classifications.
"""

from pathlib import Path
import json
import time
import base64
from fastapi import APIRouter, HTTPException
from backend.app.schemas.schemas import (
    SignPredictRequest, 
    SignPredictResponse,
    SignRecordRequest,
    SignRecordResponse
)
from backend.app.services.sign_inference_service import sign_inference_engine, INCLUDE_VOCABULARY

router = APIRouter(prefix="/sign", tags=["Sign Language"])

RECORDED_DATA_DIR = Path(__file__).resolve().parent.parent.parent / "data" / "recorded_signs"
RECORDED_DATA_DIR.mkdir(parents=True, exist_ok=True)

@router.post("/predict", response_model=SignPredictResponse)
def predict_sign(request: SignPredictRequest):
    # Convert Pydantic schemas to frame dictionaries
    frames_data = [f.model_dump() for f in request.frames]
    
    result = sign_inference_engine.predict(frames_data)
    return SignPredictResponse(**result)

@router.get("/vocabulary")
def get_vocabulary():
    return {"vocabulary": sign_inference_engine.vocabulary, "count": len(sign_inference_engine.vocabulary)}

@router.get("/status")
def get_active_model_status():
    return {
        "is_model_loaded": sign_inference_engine.is_model_loaded(),
        "active_model_name": sign_inference_engine.active_model_name,
        "active_model_type": sign_inference_engine.active_model_type,
        "active_model_path": sign_inference_engine.active_model_path,
        "vocabulary_count": len(INCLUDE_VOCABULARY)
    }

@router.post("/reload")
def reload_model_checkpoint():
    found = sign_inference_engine.discover_and_load_checkpoint()
    return {
        "success": found,
        "active_model": sign_inference_engine.active_model_name if found else None,
        "message": "Loaded verified checkpoint" if found else "No valid checkpoints discovered in models directory."
    }

@router.post("/record", response_model=SignRecordResponse)
def record_sign_sample(request: SignRecordRequest):
    try:
        word_clean = "".join([c for c in request.word if c.isalnum() or c in (" ", "_", "-")]).strip()
        if not word_clean:
            raise HTTPException(status_code=400, detail="Invalid word name")

        word_dir = RECORDED_DATA_DIR / word_clean
        word_dir.mkdir(parents=True, exist_ok=True)

        sample_id = f"sample_{int(time.time() * 1000)}"
        json_path = word_dir / f"{sample_id}.json"

        # Validate landmark dimensions
        landmarks = request.landmarks
        if not isinstance(landmarks, list) or len(landmarks) == 0:
            raise HTTPException(status_code=400, detail="Empty landmark sequence")

        # Save thumbnail if provided
        has_thumbnail = False
        if request.thumbnail_base64:
            try:
                thumb_data = request.thumbnail_base64
                if "," in thumb_data:
                    thumb_data = thumb_data.split(",", 1)[1]
                img_bytes = base64.b64decode(thumb_data)
                thumb_path = word_dir / f"{sample_id}.jpg"
                with open(thumb_path, "wb") as f_img:
                    f_img.write(img_bytes)
                has_thumbnail = True
            except Exception as e:
                print(f"[RecordSign] Warning: failed to decode thumbnail: {e}")

        payload = {
            "sample_id": sample_id,
            "word": word_clean,
            "signer_id": request.signer_id or "user_01",
            "frame_count": len(landmarks),
            "feature_dim": len(landmarks[0]) if landmarks else 0,
            "created_at": time.time(),
            "has_thumbnail": has_thumbnail,
            "landmarks": landmarks
        }

        with open(json_path, "w", encoding="utf-8") as f:
            json.dump(payload, f)

        # Count total samples for this word
        total_samples = len(list(word_dir.glob("sample_*.json")))

        return SignRecordResponse(
            ok=True,
            sample_id=sample_id,
            word=word_clean,
            sample_count=total_samples,
            message=f"Successfully stored sample for '{word_clean}' ({total_samples} total)"
        )
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Failed to save recorded sample: {str(e)}")

@router.get("/record/counts")
def get_recorded_sample_counts():
    counts = {}
    total = 0
    if RECORDED_DATA_DIR.exists():
        for word_folder in RECORDED_DATA_DIR.iterdir():
            if word_folder.is_dir():
                c = len(list(word_folder.glob("sample_*.json")))
                if c > 0:
                    counts[word_folder.name] = c
                    total += c
    return {
        "ok": True,
        "counts": counts,
        "total_samples": total
    }

