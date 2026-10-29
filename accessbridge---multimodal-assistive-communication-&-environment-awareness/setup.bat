@echo off
echo ========================================================
echo  AccessBridge - First-Run Setup (Windows)
echo ========================================================

:: 1. Check Python
where python >nul 2>nul
if %errorlevel% neq 0 (
    echo [ERROR] Python 3.10+ is required. Please install Python and check 'Add to PATH'.
    pause
    exit /b 1
)

:: 2. Create virtual environment
if not exist "venv" (
    echo Creating Python virtual environment...
    python -m venv venv
)

:: 3. Install Python dependencies
echo Installing Python dependencies...
call venv\Scripts\activate.bat
pip install --upgrade pip
pip install -r backend\requirements.txt

:: 4. Install Node dependencies
echo Installing Frontend Node dependencies...
call npm install --ignore-scripts --legacy-peer-deps

echo ========================================================
echo  Setup Completed Successfully!
echo  Run start.bat to launch AccessBridge.
echo ========================================================
pause
