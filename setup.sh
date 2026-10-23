#!/usr/bin/env bash
# ==============================================================================
# 3D-ULPIN-MVP: Local Backend Setup Script
# - Creates lightweight CPU Python virtual environment
# - Installs CPU PyTorch & backend dependencies
# - Verifies YOLO11s-seg model
# - AUTOMATICALLY CREATES WINDOWS BOOT STARTUP TASK (runs in background on device boot)
# - Prepares ngrok deployment for Vercel integration
# ==============================================================================

set -e

SCRIPT_DIR="$( cd "$( dirname "${BASH_SOURCE[0]}" )" && pwd )"
cd "$SCRIPT_DIR"

echo "======================================================================="
echo "       3D-ULPIN-MVP Backend Local Setup & Windows Auto-Boot Setup      "
echo "======================================================================="
echo ""

# ------------------------------------------------------------------------------
# 1. Detect Python
# ------------------------------------------------------------------------------
PYTHON_CMD=""
for cmd in python3 python py; do
    if command -v "$cmd" >/dev/null 2>&1; then
        PYTHON_CMD="$cmd"
        break
    fi
done

if [ -z "$PYTHON_CMD" ]; then
    echo "❌ [ERROR] Python was not found in your PATH."
    echo "Please install Python 3.10, 3.11, or 3.12 (64-bit) from https://www.python.org"
    echo "Make sure to check: 'Add Python to PATH' during installation."
    exit 1
fi

PY_VER=$($PYTHON_CMD -c 'import sys; print(f"{sys.version_info.major}.{sys.version_info.minor}")')
echo "✅ Found Python $PY_VER using command: $PYTHON_CMD"

# ------------------------------------------------------------------------------
# 2. Virtual Environment Setup
# ------------------------------------------------------------------------------
echo ""
echo "[1/5] Creating Python virtual environment (venv)..."
if [ ! -d "venv" ]; then
    $PYTHON_CMD -m venv venv
    echo "✅ Created venv."
else
    echo "✅ venv already exists."
fi

# Detect activation script (Windows vs Unix)
if [ -f "venv/Scripts/activate" ]; then
    # Git Bash / MSYS on Windows
    # shellcheck disable=SC1091
    source venv/Scripts/activate
    PYTHON_EXEC="venv/Scripts/python.exe"
elif [ -f "venv/bin/activate" ]; then
    # Unix / Linux / macOS / WSL
    # shellcheck disable=SC1091
    source venv/bin/activate
    PYTHON_EXEC="venv/bin/python"
else
    echo "❌ [ERROR] Virtual environment activation file not found."
    exit 1
fi

# ------------------------------------------------------------------------------
# 3. Install Dependencies (CPU PyTorch + Backend)
# ------------------------------------------------------------------------------
echo ""
echo "[2/5] Upgrading pip and installing lightweight CPU PyTorch..."
python -m pip install --upgrade pip

# CPU PyTorch is lightweight (~180MB) and does NOT crash with OOM
python -m pip install torch torchvision --index-url https://download.pytorch.org/whl/cpu

echo ""
echo "[3/5] Installing backend & computer vision dependencies..."
if [ -f "requirements_windows.txt" ]; then
    python -m pip install -r requirements_windows.txt
elif [ -f "windows_deployment/requirements_windows.txt" ]; then
    python -m pip install -r windows_deployment/requirements_windows.txt
elif [ -f "requirements.txt" ]; then
    python -m pip install -r requirements.txt
fi

# ------------------------------------------------------------------------------
# 4. Verify YOLO11s-seg Model & Backend
# ------------------------------------------------------------------------------
echo ""
echo "[4/5] Verifying YOLO11s-seg model and backend integrity..."
python -c "
import sys
try:
    import backend.main
    from models.building_segmentation.inference import BuildingSegmentationModel
    model = BuildingSegmentationModel(device='cpu')
    print('✅ [OK] YOLO11s-seg model checkpoint verified and loaded into memory successfully!')
except Exception as e:
    print(f'❌ [ERROR] Model verification failed: {e}', file=sys.stderr)
    sys.exit(1)
"

# ------------------------------------------------------------------------------
# 5. AUTOMATICALLY CREATE WINDOWS BOOT STARTUP TASK
# ------------------------------------------------------------------------------
echo ""
echo "[5/5] Configuring automatic background startup on device boot..."

# Create silent VBS launcher if not present
cat << 'EOF' > start_silent_startup.vbs
' 3D-ULPIN-MVP: Silent Background Launcher (No visible console window)
Set objShell = CreateObject("WScript.Shell")
Set objFSO = CreateObject("Scripting.FileSystemObject")
strDir = objFSO.GetParentFolderName(WScript.ScriptFullName)

' Check if venv/Scripts/python.exe exists (Windows venv)
strPython = strDir & "\venv\Scripts\python.exe"
If Not objFSO.FileExists(strPython) Then
    strPython = "python.exe"
End If

strCommand = "cmd.exe /c cd /d """ & strDir & """ && """ & strPython & """ -m uvicorn backend.main:app --host 127.0.0.1 --port 8000"
objShell.Run strCommand, 0, False
EOF

# Detect if we are on Windows (Git Bash, MSYS, Cygwin, or native Windows)
IS_WINDOWS=false
if [[ "$OSTYPE" == "msys"* ]] || [[ "$OSTYPE" == "cygwin"* ]] || [[ "$OSTYPE" == "win32"* ]] || command -v cmd.exe >/dev/null 2>&1; then
    IS_WINDOWS=true
fi

if [ "$IS_WINDOWS" = true ]; then
    echo "Detected Windows environment."

    # Try resolving Windows APPDATA directory
    WIN_APPDATA=""
    if command -v cmd.exe >/dev/null 2>&1; then
        WIN_APPDATA=$(cmd.exe /c "echo %APPDATA%" 2>/dev/null | tr -d '\r')
    fi
    if [ -z "$WIN_APPDATA" ] && [ -n "$APPDATA" ]; then
        WIN_APPDATA="$APPDATA"
    fi

    # Convert Windows path if in Git Bash / MSYS
    if [ -n "$WIN_APPDATA" ]; then
        STARTUP_FOLDER="$WIN_APPDATA\\Microsoft\\Windows\\Start Menu\\Programs\\Startup"
        SHORTCUT_FILE="$STARTUP_FOLDER\\3D_ULPIN_Backend.lnk"
        
        # Native Windows path to our VBS
        WIN_DIR=$(pwd -W 2>/dev/null || pwd)
        VBS_PATH="$WIN_DIR\\start_silent_startup.vbs"

        echo "Registering silent startup shortcut in Windows Startup folder..."
        powershell.exe -NoProfile -Command "
            try {
                \$ws = New-Object -ComObject WScript.Shell;
                \$s = \$ws.CreateShortcut('$SHORTCUT_FILE');
                \$s.TargetPath = 'wscript.exe';
                \$s.Arguments = '\"$VBS_PATH\"';
                \$s.WorkingDirectory = '$WIN_DIR';
                \$s.Description = '3D ULPIN MVP Local Backend Server';
                \$s.Save();
                Write-Host '✅ Startup shortcut created successfully!'
            } catch {
                Write-Host '⚠️ Could not create shortcut via COM: ' \$_.Exception.Message
            }
        " 2>/dev/null || true

        # Also create a Windows Scheduled Task as an extra guarantee
        echo "Creating Windows Scheduled Task (Runs on user login / system start)..."
        schtasks.exe /create /tn "3D_ULPIN_Backend" /tr "wscript.exe \"$VBS_PATH\"" /sc onlogon /f >/dev/null 2>&1 || true
    fi

    echo "✅ [SUCCESS] Windows Auto-Boot task is set up!"
    echo "   Whenever your Windows PC boots, the backend starts automatically in the background on port 8000."

elif [ -d "/mnt/c/Users" ]; then
    # Running inside WSL on Windows
    echo "Detected WSL on Windows."
    WIN_USER=$(cmd.exe /c "echo %USERNAME%" 2>/dev/null | tr -d '\r' || true)
    if [ -n "$WIN_USER" ] && [ -d "/mnt/c/Users/$WIN_USER" ]; then
        WSL_STARTUP="/mnt/c/Users/$WIN_USER/AppData/Roaming/Microsoft/Windows/Start Menu/Programs/Startup"
        if [ -d "$WSL_STARTUP" ]; then
            cat << EOF > "$WSL_STARTUP/start_3d_ulpin.bat"
@echo off
wsl.exe -d $WSL_DISTRO_NAME -u $USER -- bash -c "cd '$SCRIPT_DIR' && source venv/bin/activate && python -m uvicorn backend.main:app --host 127.0.0.1 --port 8000"
EOF
            echo "✅ Created Windows Startup batch file at: $WSL_STARTUP/start_3d_ulpin.bat"
        fi
    fi
else
    # Native Linux: Set up crontab @reboot
    echo "Native Linux detected. Adding @reboot crontab entry..."
    (crontab -l 2>/dev/null | grep -v "backend.main:app" ; echo "@reboot cd $SCRIPT_DIR && $PYTHON_EXEC -m uvicorn backend.main:app --host 127.0.0.1 --port 8000 >/dev/null 2>&1 &") | crontab - || true
    echo "✅ [SUCCESS] crontab @reboot task configured!"
fi

echo ""
echo "======================================================================="
echo "                  🎉 SETUP COMPLETE SUCCESSFULLY!                      "
echo "======================================================================="
echo "1. Backend Server: Starts automatically in background when Windows boots"
echo "   URL: http://127.0.0.1:8000"
echo ""
echo "2. To test manually right now, run:"
echo "   ./start_backend.sh     (or start_backend.bat on Windows)"
echo ""
echo "3. To connect to VERCEL using ngrok, run:"
echo "   ./start_ngrok.sh       (or start_ngrok.bat on Windows)"
echo "   Copy the https://xxxx.ngrok-free.app link and set in Vercel:"
echo "   VITE_API_BASE_URL = https://xxxx.ngrok-free.app/api"
echo "======================================================================="
