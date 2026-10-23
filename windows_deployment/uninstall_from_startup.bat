@echo off
title 3D-ULPIN-MVP: Remove from Windows Startup
set "SHORTCUT_PATH=%APPDATA%\Microsoft\Windows\Start Menu\Programs\Startup\3D_ULPIN_Backend.lnk"

if exist "%SHORTCUT_PATH%" (
    del "%SHORTCUT_PATH%"
    echo [SUCCESS] Removed 3D-ULPIN-MVP from Windows Startup.
) else (
    echo [INFO] Shortcut was not present in Windows Startup.
)

pause
