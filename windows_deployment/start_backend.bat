@echo off
title 3D-ULPIN-MVP Backend Server (Port 8000)
cd /d "%~dp0\.."

if not exist "venv\Scripts\activate.bat" (
    echo [ERROR] Virtual environment "venv" not found!
    echo Please run setup_windows.bat first.
    pause
    exit /b 1
)

call venv\Scripts\activate.bat

echo =====================================================================
echo    Starting 3D-ULPIN-MVP Backend on http://127.0.0.1:8000
echo    Press Ctrl+C to stop the server
echo =====================================================================
echo.

uvicorn backend.main:app --host 0.0.0.0 --port 8000
pause
