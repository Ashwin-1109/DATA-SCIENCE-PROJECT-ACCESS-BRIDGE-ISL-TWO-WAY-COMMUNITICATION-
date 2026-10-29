"""
AccessBridge - Database Models (SQLite)
Stores sessions, training jobs, and experiment benchmark runs
"""

from datetime import datetime
from sqlalchemy import Column, Integer, String, Float, Boolean, DateTime, Text, JSON
from backend.app.database.session import Base

class SessionRecord(Base):
    __tablename__ = "sessions"

    id = Column(String, primary_key=True, index=True)
    created_at = Column(DateTime, default=datetime.utcnow)
    session_type = Column(String, index=True) # 'sign', 'caption', 'environment'
    transcript_text = Column(Text, nullable=True)
    metadata_json = Column(JSON, nullable=True)

class TrainingJobRecord(Base):
    __tablename__ = "training_jobs"

    id = Column(String, primary_key=True, index=True)
    created_at = Column(DateTime, default=datetime.utcnow)
    model_type = Column(String, index=True) # 'svm', 'rf', 'lstm', 'gru', 'cnn1d', 'transformer'
    status = Column(String, default="pending") # 'pending', 'running', 'completed', 'failed', 'cancelled'
    progress_pct = Column(Float, default=0.0)
    current_epoch = Column(Integer, default=0)
    total_epochs = Column(Integer, default=30)
    train_loss = Column(Float, nullable=True)
    val_loss = Column(Float, nullable=True)
    val_accuracy = Column(Float, nullable=True)
    artifact_path = Column(String, nullable=True)
    error_message = Column(Text, nullable=True)
    hyperparameters = Column(JSON, nullable=True)

class ExperimentRecord(Base):
    __tablename__ = "experiments"

    id = Column(String, primary_key=True, index=True)
    created_at = Column(DateTime, default=datetime.utcnow)
    model_name = Column(String, index=True)
    family = Column(String) # 'classical', 'sequential'
    top1_accuracy = Column(Float)
    macro_precision = Column(Float)
    macro_recall = Column(Float)
    macro_f1 = Column(Float)
    parameter_count = Column(Integer, nullable=True)
    serialized_size_bytes = Column(Integer)
    latency_median_ms = Column(Float)
    latency_p95_ms = Column(Float)
    metrics_json = Column(JSON, nullable=True)
