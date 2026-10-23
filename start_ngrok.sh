#!/usr/bin/env bash
echo "======================================================================="
echo "        3D-ULPIN-MVP: Starting ngrok Tunnel on Port 8000               "
echo "======================================================================="
echo ""

if ! command -v ngrok >/dev/null 2>&1; then
    echo "⚠️ [WARNING] ngrok was not found in your PATH."
    echo "To install ngrok:"
    echo "  Windows: winget install ngrok"
    echo "  Ubuntu/Debian: curl -sSL https://ngrok-agent.s3.amazonaws.com/ngrok.asc | sudo tee /etc/apt/trusted.gpg.d/ngrok.asc >/dev/null && echo \"deb https://ngrok-agent.s3.amazonaws.com buster main\" | sudo tee /etc/apt/sources.list.d/ngrok.list && sudo apt update && sudo apt install ngrok"
    echo "  macOS: brew install ngrok"
    echo ""
    echo "After installation, run once: ngrok config add-authtoken YOUR_TOKEN"
    echo ""
    exit 1
fi

echo "======================================================================="
echo " INSTRUCTIONS FOR VERCEL INTEGRATION:"
echo " 1. Copy the public 'Forwarding' HTTPS URL (e.g. https://xxxx.ngrok-free.app)"
echo " 2. Open Vercel Dashboard -> Project Settings -> Environment Variables"
echo " 3. Set:"
echo "    Key:   VITE_API_BASE_URL"
echo "    Value: https://xxxx.ngrok-free.app/api"
echo " 4. Click 'Redeploy' on Vercel!"
echo "======================================================================="
echo ""
ngrok http 8000
