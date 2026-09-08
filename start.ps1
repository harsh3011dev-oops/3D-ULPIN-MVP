Start-Process powershell -ArgumentList "-NoExit", "-Command", "uvicorn backend.main:app --reload --port 8000"
Start-Process powershell -ArgumentList "-NoExit", "-Command", "Set-Location frontend; npm run dev"
