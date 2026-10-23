@echo off
title 3D-ULPIN-MVP Windows Setup (CPU)
cd /d "%~dp0\.."

echo =====================================================================
echo    3D-ULPIN-MVP: Windows Local CPU Deployment Setup
echo =====================================================================
echo.

where python >nul 2>nul
if %ERRORLEVEL% NEQ 0 (
    echo [ERROR] Python 3 was not found in your PATH.
    echo Please install Python 3.10, 3.11, or 3.12 from python.org
    echo and make sure to check "Add Python to PATH" during installation.
    echo.
    pause
    exit /b 1
)

echo [1/4] Creating virtual environment (venv)...
if not exist "venv" (
    python -m venv venv
)
call venv\Scripts\activate.bat

echo [2/4] Installing lightweight CPU PyTorch (180MB download, NOT 4GB CUDA)...
pip install --upgrade pip
pip install torch torchvision --index-url https://download.pytorch.org/whl/cpu

echo [3/4] Installing backend and geospatial dependencies...
pip install -r windows_deployment\requirements_windows.txt

echo [4/4] Verifying YOLO11s-seg model and backend integrity...
python -c "import backend.main; from models.building_segmentation.inference import BuildingSegmentationModel; m = BuildingSegmentationModel(device='cpu'); print('[OK] YOLO11s-seg loaded into memory successfully!')"

if %ERRORLEVEL% EQU 0 (
    echo.
    echo =====================================================================
    echo    SUCCESS! 3D-ULPIN-MVP Backend is ready on your Windows PC!
    echo =====================================================================
    echo You can now run "start_backend.bat" to start the server,
    echo or run "install_to_startup.bat" to make it start automatically on boot.
    echo.
) else (
    echo.
    echo [ERROR] Verification failed. Please check the error message above.
)

pause
