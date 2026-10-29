"""
AccessBridge - Configuration Management
Local CPU-first runtime paths and security boundaries
"""

import os
from pathlib import Path

BASE_DIR = Path(__file__).resolve().parent.parent.parent.parent
DATA_DIR = BASE_DIR / "data"
ARTIFACTS_DIR = BASE_DIR / "artifacts"
MODELS_DIR = ARTIFACTS_DIR / "models"
EXPERIMENTS_DIR = ARTIFACTS_DIR / "experiments"

# Database
DATABASE_URL = f"sqlite:///{BASE_DIR / 'accessbridge.db'}"

# ML Parameters
INCLUDE_50_CLASSES_COUNT = 50
TARGET_SEQUENCE_LENGTH = 32
LANDMARK_DIMENSIONS = 138
REJECTION_THRESHOLD = 0.65

# Ensure directories exist
for path in [DATA_DIR, ARTIFACTS_DIR, MODELS_DIR, EXPERIMENTS_DIR]:
    path.mkdir(parents=True, exist_ok=True)
