#!/bin/bash
# 3D ULPIN MVP - Local Start Script for Linux
echo "=========================================="
echo " Starting 3D ULPIN Backend & Frontend "
echo "=========================================="

DIR="$( cd "$( dirname "${BASH_SOURCE[0]}" )" >/dev/null 2>&1 && pwd )"
PYTHON_BIN="/home/piet/venv/bin/python3"

# Check if port 8000 is running
if lsof -Pi :8000 -sTCP:LISTEN -t >/dev/null ; then
    echo "✅ Backend is already running on port 8000"
else
    echo "🚀 Starting Backend on http://localhost:8000..."
    $PYTHON_BIN -m uvicorn backend.main:app --port 8000 --host 0.0.0.0 &
    sleep 2
fi

# Check if port 3000 is running
if lsof -Pi :3000 -sTCP:LISTEN -t >/dev/null ; then
    echo "✅ Frontend is already running on http://localhost:3000"
else
    echo "🚀 Starting Frontend on http://localhost:3000..."
    cd "$DIR/frontend" && npm run dev &
fi

echo "=========================================="
echo " App Ready!"
echo " Open in browser: http://localhost:3000/explore"
echo "=========================================="
