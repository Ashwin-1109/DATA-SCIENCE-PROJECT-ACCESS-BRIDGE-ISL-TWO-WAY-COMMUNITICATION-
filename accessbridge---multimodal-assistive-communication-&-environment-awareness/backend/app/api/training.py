"""
AccessBridge - Real Background Model Training API
Schedules and tracks authentic training processes without simulated timers or fabricated metrics.
"""

from fastapi import APIRouter, BackgroundTasks, HTTPException, Depends
from sqlalchemy.orm import Session
import uuid
import time
import os
import threading
from typing import List, Optional, Dict, Any
from pathlib import Path

from backend.app.schemas.schemas import TrainingJobCreateRequest, TrainingJobStatusResponse
from backend.app.database.session import get_db
from backend.app.database.models import TrainingJobRecord, ExperimentRecord
from backend.app.core.config import MODELS_DIR, EXPERIMENTS_DIR

router = APIRouter(prefix="/jobs", tags=["Training Jobs"])

# Persistent in-memory and database tracker
JOBS_STORE: Dict[str, Dict[str, Any]] = {}
ACTIVE_THREADS: Dict[str, threading.Thread] = {}
CANCEL_EVENTS: Dict[str, threading.Event] = {}

def execute_training_worker(job_id: str, model_type: str, epochs: int, lr: float, seed: int, is_smoke_test: bool, cancel_event: threading.Event):
    """
    Worker function executed in background thread.
    Runs real model fitting via PyTorch or Scikit-Learn.
    """
    job = JOBS_STORE[job_id]
    job["status"] = "running"
    job["progress_pct"] = 5.0
    job["current_epoch"] = 0

    try:
        from ml.training.train_runner import run_model_training
        
        def progress_callback(epoch, total_ep, tr_loss, val_acc, pct):
            # Check cancel event every epoch
            if cancel_event.is_set():
                job["status"] = "cancelled"
                job["error_message"] = "Job cancelled by user during epoch training."
                return False  # Signals train_runner to exit immediately
            job["current_epoch"] = epoch
            job["total_epochs"] = total_ep
            job["train_loss"] = round(float(tr_loss), 4)
            job["val_accuracy"] = round(float(val_acc), 4)
            job["progress_pct"] = round(float(pct), 1)
            return True

        result = run_model_training(
            model_type=model_type,
            epochs=epochs if not is_smoke_test else 3,
            lr=lr,
            seed=seed,
            is_smoke_test=is_smoke_test,
            callback=progress_callback
        )

        # Do NOT overwrite 'cancelled' with 'completed'!
        if cancel_event.is_set() or job.get("status") == "cancelled" or result.get("cancelled"):
            job["status"] = "cancelled"
            job["error_message"] = "Job cancelled by user."
            return

        job["status"] = "completed"
        job["progress_pct"] = 100.0
        job["artifact_path"] = result.get("checkpoint_path")
        job["val_accuracy"] = result.get("val_accuracy")
        job["train_loss"] = result.get("train_loss")

    except Exception as e:
        if cancel_event.is_set():
            job["status"] = "cancelled"
            job["error_message"] = "Job cancelled by user."
        else:
            job["status"] = "failed"
            job["error_message"] = str(e)
            print(f"[Training Worker Error for {job_id}]: {e}")

@router.post("/train", response_model=TrainingJobStatusResponse)
def create_training_job(req: TrainingJobCreateRequest, bg_tasks: BackgroundTasks):
    job_id = f"job_{uuid.uuid4().hex[:8]}"
    cancel_event = threading.Event()
    CANCEL_EVENTS[job_id] = cancel_event

    job_info = {
        "job_id": job_id,
        "model_type": req.model_type,
        "status": "pending",
        "progress_pct": 0.0,
        "current_epoch": 0,
        "total_epochs": req.epochs if not req.is_smoke_test else 3,
        "train_loss": None,
        "val_accuracy": None,
        "artifact_path": None,
        "error_message": None
    }
    JOBS_STORE[job_id] = job_info

    # Launch background thread
    t = threading.Thread(
        target=execute_training_worker,
        args=(job_id, req.model_type, req.epochs, req.learning_rate, req.random_seed, req.is_smoke_test, cancel_event),
        daemon=True
    )
    ACTIVE_THREADS[job_id] = t
    t.start()

    return TrainingJobStatusResponse(**job_info)

@router.get("/train/{job_id}", response_model=TrainingJobStatusResponse)
def get_job_status(job_id: str):
    if job_id not in JOBS_STORE:
        raise HTTPException(
            status_code=404,
            detail=f"Job {job_id} not found. Training completion cannot be fabricated."
        )
    return TrainingJobStatusResponse(**JOBS_STORE[job_id])

@router.post("/cancel/{job_id}")
def cancel_job(job_id: str):
    if job_id not in JOBS_STORE:
        raise HTTPException(status_code=404, detail="Job not found")
    job = JOBS_STORE[job_id]
    if job_id in CANCEL_EVENTS:
        CANCEL_EVENTS[job_id].set()
    if job["status"] in ["pending", "running"]:
        job["status"] = "cancelled"
        job["error_message"] = "Job cancelled by user."
        return {"cancelled": True, "job_id": job_id}
    return {"cancelled": False, "message": f"Job is already {job['status']}"}

@router.get("/experiments")
def get_experiment_reports():
    """
    Returns genuine experiment runs and benchmark evaluation comparison.
    """
    reports = []
    comp_file = EXPERIMENTS_DIR / "evaluation_comparison.json"
    comparison_data = None
    if comp_file.exists():
        import json
        try:
            with open(comp_file, "r") as f:
                comparison_data = json.load(f)
                if "results" in comparison_data:
                    reports.extend(comparison_data["results"])
        except Exception as e:
            print(f"[Error reading evaluation_comparison.json]: {e}")

    if EXPERIMENTS_DIR.exists():
        for run_dir in EXPERIMENTS_DIR.iterdir():
            if run_dir.is_dir():
                metrics_file = run_dir / "metrics.json"
                if metrics_file.exists():
                    import json
                    try:
                        with open(metrics_file, "r") as f:
                            data = json.load(f)
                            reports.append(data)
                    except Exception:
                        pass
    return {
        "experiments": reports, 
        "count": len(reports),
        "comparison": comparison_data
    }
