#!/usr/bin/env bash
# AccessBridge - First-Run Setup (Linux / macOS)

set -e

echo "========================================================"
echo " AccessBridge - First-Run Setup"
echo "========================================================"

# 1. Create virtualenv
if [ ! -d "venv" ]; then
    echo "Creating Python virtual environment..."
    python3 -m venv venv
fi

# 2. Install Python packages
source venv/bin/activate
pip install --upgrade pip
pip install -r backend/requirements.txt

# 3. Install Node packages
npm install

echo "========================================================"
echo " Setup Completed Successfully!"
echo " Run ./start.sh to launch AccessBridge."
echo "========================================================"
