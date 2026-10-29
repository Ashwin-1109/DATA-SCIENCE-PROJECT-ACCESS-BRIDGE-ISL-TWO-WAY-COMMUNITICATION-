#!/usr/bin/env python3
"""
AccessBridge - Environment & Dependency Checker
Verifies Python version, Node.js version, and ML dependency readiness.
"""

import sys
import shutil
import platform

def check():
    print("=" * 60)
    print("AccessBridge - Environment Readiness Verification")
    print("Karunya Institute of Technology and Sciences")
    print("=" * 60)

    # 1. OS & Python
    py_ver = sys.version_info
    print(f"OS: {platform.system()} {platform.release()} ({platform.machine()})")
    print(f"Python: {py_ver.major}.{py_ver.minor}.{py_ver.micro}")
    if py_ver < (3, 10):
        print("  [WARN] Python 3.10 or 3.11 is recommended.")
    else:
        print("  [OK] Python version compatible.")

    # 2. Node.js
    node_path = shutil.which("node")
    if node_path:
        print(f"Node.js: Detected at {node_path}")
    else:
        print("  [WARN] Node.js not detected in PATH.")

    # 3. Tesseract OCR
    tess_path = shutil.which("tesseract")
    if tess_path:
        print(f"Tesseract OCR: Detected at {tess_path}")
    else:
        print("  [INFO] Tesseract executable not detected in system PATH. (Browser Tesseract.js will act as client engine).")

    # 4. Check Key Python Modules
    modules = [
        ("torch", "PyTorch (CPU/CUDA)"),
        ("mediapipe", "MediaPipe Vision"),
        ("sklearn", "Scikit-Learn"),
        ("numpy", "NumPy"),
        ("pandas", "Pandas"),
        ("fastapi", "FastAPI"),
        ("cv2", "OpenCV")
    ]

    print("\nChecking Python Packages:")
    for mod_name, label in modules:
        try:
            __import__(mod_name)
            print(f"  [OK] {label}")
        except ImportError:
            print(f"  [MISSING] {label} (install via: pip install -r backend/requirements.txt)")

    print("\nEnvironment check complete.")

if __name__ == "__main__":
    check()
