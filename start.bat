@echo off
echo Starting 3D ULPIN Backend and Frontend...
start "3D ULPIN Backend (Port 8000)" cmd /k "uvicorn backend.main:app --reload --port 8000"
start "3D ULPIN Frontend (Port 3000)" cmd /k "cd frontend && npm run dev"
