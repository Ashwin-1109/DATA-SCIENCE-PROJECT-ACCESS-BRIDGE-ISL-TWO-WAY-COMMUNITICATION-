#!/usr/bin/env bash
# AccessBridge - Launch Script for Linux / macOS

set -e

echo "========================================================"
echo " AccessBridge - Launching Local Application"
echo " Karunya Institute of Technology and Sciences"
echo "========================================================"

# Check Python and launch backend if virtualenv exists
if [ -d "venv" ]; then
    echo "Activating Python virtual environment..."
    source venv/bin/activate
    echo "Starting Python FastAPI backend on port 8000..."
    python -m uvicorn backend.app.main:app --port 8000 &
    BACKEND_PID=$!
    trap "kill $BACKEND_PID" EXIT
fi

# Launch frontend
echo "Starting Frontend UI on port 3000..."
npm run dev
