# 3D-ULPIN-MVP: Windows Local CPU Deployment & Auto-Startup Guide

This guide allows you to run the **3D-ULPIN-MVP Backend & YOLO11s-seg Model** directly on your Windows PC (CPU mode) and have it start automatically whenever your computer powers on.

---

## 1. Quick Start in 2 Clicks

1. **Step 1:** Double-click `setup_windows.bat`.
   * It creates a Python virtual environment (`venv`).
   * It installs the lightweight **CPU PyTorch** (~180MB) and all requirements.
   * It verifies that the YOLO11s-seg model loads into memory properly.
2. **Step 2:** Double-click `install_to_startup.bat`.
   * It automatically registers the backend into your Windows Startup folder (`shell:startup`).
   * **Done!** From now on, whenever you turn on or restart your PC, the backend automatically runs in the background on `http://127.0.0.1:8000`.

---

## 2. Scripts Reference

| Script | Purpose |
| :--- | :--- |
| `setup_windows.bat` | One-time setup: creates venv and installs dependencies on Windows. |
| `start_backend.bat` | Runs the backend with a visible terminal window (useful for debugging). |
| `start_silent_startup.vbs` | Runs the backend silently in the background (no black CMD popup). |
| `install_to_startup.bat` | Adds the silent runner to your Windows Startup folder. |
| `uninstall_from_startup.bat`| Removes the backend from Windows Startup. |

---

## 3. Connecting to Vercel (Frontend Live on Vercel $\rightarrow$ Backend on Windows)

Because your backend runs on your Windows PC and your frontend is deployed on Vercel:

1. Open a terminal on your Windows machine and run a free Cloudflare tunnel:
   ```cmd
   cloudflared tunnel --url http://localhost:8000
   ```
2. Copy the public HTTPS URL printed in the terminal (e.g. `https://random-words.trycloudflare.com`).
3. In your **Vercel Project Dashboard** $\rightarrow$ **Settings** $\rightarrow$ **Environment Variables**:
   * Name: `VITE_API_BASE_URL`
   * Value: `https://random-words.trycloudflare.com/api`
4. Redeploy your Vercel project.

Now your Vercel frontend will talk directly to your Windows PC's backend and YOLO model seamlessly!
