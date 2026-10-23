@echo off
title 3D-ULPIN-MVP: Local Backend Setup & Auto-Boot Setup
cd /d "%~dp0"

echo =======================================================================
echo        3D-ULPIN-MVP Backend Local Setup & Windows Auto-Boot Setup      
echo =======================================================================
echo.

where python >nul 2>nul
if %ERRORLEVEL% NEQ 0 (
    where py >nul 2>nul
    if %ERRORLEVEL% NEQ 0 (
        echo [ERROR] Python 3 was not found in your PATH.
        echo Please install Python 3.10, 3.11, or 3.12 from python.org
        echo and make sure to check "Add Python to PATH" during installation.
        echo.
        pause
        exit /b 1
    )
)

echo [1/5] Creating Python virtual environment (venv)...
if not exist "venv" (
    python -m venv venv
)
call venv\Scripts\activate.bat

echo [2/5] Installing lightweight CPU PyTorch (~180MB, fast and reliable)...
python -m pip install --upgrade pip
python -m pip install torch torchvision --index-url https://download.pytorch.org/whl/cpu

echo [3/5] Installing backend and geospatial dependencies...
if exist "requirements_windows.txt" (
    pip install -r requirements_windows.txt
) else if exist "requirements.txt" (
    pip install -r requirements.txt
)

echo [4/5] Verifying YOLO11s-seg model and backend integrity...
python -c "import backend.main; from models.building_segmentation.inference import BuildingSegmentationModel; m = BuildingSegmentationModel(device='cpu'); print('[OK] YOLO11s-seg loaded into memory successfully!')"

echo [5/5] Configuring automatic background startup on device boot...
set "TARGET_VBS=%~dp0start_silent_startup.vbs"
set "STARTUP_FOLDER=%APPDATA%\Microsoft\Windows\Start Menu\Programs\Startup"
set "SHORTCUT_PATH=%STARTUP_FOLDER%\3D_ULPIN_Backend.lnk"

powershell -NoProfile -Command "$ws = New-Object -ComObject WScript.Shell; $s = $ws.CreateShortcut('%SHORTCUT_PATH%'); $s.TargetPath = 'wscript.exe'; $s.Arguments = '\"%TARGET_VBS%\"'; $s.WorkingDirectory = '%~dp0'; $s.Description = '3D ULPIN MVP Local Backend Server'; $s.Save()"

schtasks /create /tn "3D_ULPIN_Backend" /tr "wscript.exe \"%TARGET_VBS%\"" /sc onlogon /f >nul 2>nul

echo.
echo =======================================================================
echo                   SUCCESS! SETUP IS COMPLETE!
echo =======================================================================
echo 1. Backend will start AUTOMATICALLY IN BACKGROUND on Windows boot!
echo    URL: http://127.0.0.1:8000
echo.
echo 2. To test manually right now, double-click: start_backend.bat
echo.
echo 3. To connect to VERCEL using ngrok:
echo    Double-click: start_ngrok.bat
echo    Copy the public URL (https://xxxx.ngrok-free.app) and put in Vercel:
echo    VITE_API_BASE_URL = https://xxxx.ngrok-free.app/api
echo =======================================================================
echo.
pause
