@echo off
title 3D-ULPIN Cloudflare Public Tunnel
cd /d "%~dp0"

echo =====================================================================
echo    Starting Cloudflare Public Tunnel for 3D-ULPIN Backend
echo    Connects: http://localhost:8000 -> Public HTTPS URL for Vercel
echo =====================================================================
echo.

where cloudflared >nul 2>nul
if %ERRORLEVEL% NEQ 0 (
    echo [NOTICE] "cloudflared" is not installed or not in PATH.
    echo.
    echo To install cloudflared on Windows:
    echo   1. Open PowerShell and run: winget install Cloudflare.cloudflared
    echo   2. Or download from: https://github.com/cloudflare/cloudflared/releases/latest
    echo.
    echo Alternative: You can also use ngrok:
    echo   ngrok http 8000
    echo.
    pause
    exit /b 1
)

echo Starting tunnel... Look for the URL ending with "trycloudflare.com":
echo.
cloudflared tunnel --url http://localhost:8000
pause
