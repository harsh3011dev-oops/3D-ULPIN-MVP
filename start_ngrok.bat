@echo off
title 3D-ULPIN-MVP: Start ngrok Tunnel for Vercel
cd /d "%~dp0"

echo =======================================================================
echo         3D-ULPIN-MVP: Starting ngrok Tunnel on Port 8000
echo =======================================================================
echo.

where ngrok >nul 2>nul
if %ERRORLEVEL% NEQ 0 (
    echo [WARNING] ngrok was not found in your PATH.
    echo.
    echo To install ngrok easily on Windows, run this in PowerShell:
    echo    winget install ngrok
    echo Or download from: https://ngrok.com/download
    echo.
    echo After downloading, set your auth token (one-time):
    echo    ngrok config add-authtoken YOUR_AUTH_TOKEN
    echo.
    pause
    exit /b 1
)

echo Starting ngrok on port 8000...
echo.
echo =======================================================================
echo  INSTRUCTIONS FOR VERCEL INTEGRATION:
echo  1. Copy the public "Forwarding" HTTPS URL (e.g. https://xxxx.ngrok-free.app)
echo  2. Open Vercel Dashboard -> Project Settings -> Environment Variables
echo  3. Set:
echo     Key:   VITE_API_BASE_URL
echo     Value: https://xxxx.ngrok-free.app/api
echo  4. Click "Redeploy" on Vercel!
echo =======================================================================
echo.
ngrok http 8000
pause
