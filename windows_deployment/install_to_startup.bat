@echo off
title 3D-ULPIN-MVP: Install to Windows Startup
cd /d "%~dp0"

echo =====================================================================
echo    Installing 3D-ULPIN-MVP Backend into Windows Startup
echo =====================================================================
echo.

set "TARGET_VBS=%~dp0start_silent_startup.vbs"
set "STARTUP_FOLDER=%APPDATA%\Microsoft\Windows\Start Menu\Programs\Startup"
set "SHORTCUT_PATH=%STARTUP_FOLDER%\3D_ULPIN_Backend.lnk"

echo Creating shortcut in: %STARTUP_FOLDER%

powershell -Command "$ws = New-Object -ComObject WScript.Shell; $s = $ws.CreateShortcut('%SHORTCUT_PATH%'); $s.TargetPath = 'wscript.exe'; $s.Arguments = '\"%TARGET_VBS%\"'; $s.WorkingDirectory = '%~dp0'; $s.Description = '3D ULPIN MVP Local Backend Server'; $s.Save()"

if exist "%SHORTCUT_PATH%" (
    echo.
    echo =====================================================================
    echo [SUCCESS] 3D-ULPIN-MVP Backend is now registered in Windows Startup!
    echo.
    echo Whenever your Windows PC turns on or reboots, the backend server
    echo will automatically start in the background on http://127.0.0.1:8000
    echo =====================================================================
    echo.
    echo To remove it anytime, simply run "uninstall_from_startup.bat".
) else (
    echo.
    echo [ERROR] Failed to create startup shortcut.
)

pause
