@echo off
echo ========================================================
echo  AccessBridge - Launching Local Full-Stack Application
echo  Karunya Institute of Technology and Sciences
echo ========================================================

:: Check Node.js
where node >nul 2>nul
if %errorlevel% neq 0 (
    echo [ERROR] Node.js is not installed or not in PATH.
    pause
    exit /b 1
)

:: Start Backend in background if python exists
where python >nul 2>nul
if %errorlevel% equ 0 (
    echo Starting Python FastAPI backend on port 8000...
    start "AccessBridge Backend" cmd /k "cd /d ""%~dp0"" && python -m uvicorn backend.app.main:app --host 0.0.0.0 --port 8000"
) else (
    echo [INFO] Python not found. Operating in browser-assisted mode.
)

:: Start Frontend Vite dev server
echo Starting Frontend UI on port 3000...
node "%~dp0node_modules\vite\bin\vite.js" --port=3000 --host=0.0.0.0

pause
