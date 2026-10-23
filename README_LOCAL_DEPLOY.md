# 3D-ULPIN-MVP: Local Backend Deployment & ngrok Guide

This package contains the complete standalone Python FastAPI AI backend with YOLO11s-seg building segmentation, configured for local PC deployment (CPU) with **automatic Windows boot startup** and **ngrok integration for Vercel**.

---

## ⚡ Quick Setup (Sirf 2 Steps)

### Step 1: Run Setup
* **Agar aap Git Bash ya Terminal use kar rahe hain:**
  ```bash
  bash setup.sh
  ```
* **Ya Windows Explorer me directly double-click karein:**
  `setup.bat`

**Ye script kya karta hai:**
1. Clean lightweight virtual environment (`venv`) banata hai.
2. CPU PyTorch (~180MB) aur backend dependencies install karta hai.
3. YOLO11s-seg model checkpoint verify karta hai.
4. **🔥 AUTOMATIC WINDOWS BOOT TASK:** Backend ko Windows Startup aur Task Scheduler me register karta hai taaki **jaise hi aapka laptop/PC on ho, backend silently background me chalna shuru ho jaye (zero popup window).**

---

## 🌐 ngrok Se Vercel Ko Connect Kaise Karein

Frontend **Vercel** par hosted hai, aur Backend aapke **Local PC** par chal raha hai. Dono ko connect karne ke liye:

1. **ngrok Tunnel Start Karein:**
   * Terminal me:
     ```bash
     bash start_ngrok.sh
     ```
   * Ya Windows Explorer me double-click karein:
     `start_ngrok.bat`
2. **Public HTTPS Link Copy Karein:**
   Terminal me aapko ek public URL milega, jaise:
   `https://a1b2-c3d4.ngrok-free.app`
3. **Vercel Me Environment Variable Update Karein:**
   * [Vercel Dashboard](https://vercel.com) par jayein $\rightarrow$ Apne Project par click karein.
   * **Settings** $\rightarrow$ **Environment Variables**:
     * **Key:** `VITE_API_BASE_URL`
     * **Value:** `https://a1b2-c3d4.ngrok-free.app/api`
   * Save karein aur **Deployments** tab me ja kar **Redeploy** dabayein.

---

## 🛠️ Files Overview

* `setup.sh` / `setup.bat`: All-in-one setup & Windows Boot auto-task installer
* `start_backend.sh` / `start_backend.bat`: Backend server start karne ke liye (`http://127.0.0.1:8000`)
* `start_silent_startup.vbs`: Hidden background launcher (Windows boot par chalta hai)
* `start_ngrok.sh` / `start_ngrok.bat`: Port 8000 ko public HTTPS URL par tunnel karne ke liye
* `backend/`: FastAPI API routes, schemas, spatial services
* `ai/`: YOLO detector protocol, footprint inference, geometric utilities
* `models/building_segmentation/`: YOLO11s-seg trained checkpoint (`weights/best.pt`)

---

## 🔍 Verification

* **Check if Backend is running:**
  Browser me kholein: `http://127.0.0.1:8000/api/ping` $\rightarrow$ `{"status":"ok","message":"pong"}`
* **Check API Documentation:**
  Browser me kholein: `http://127.0.0.1:8000/docs`
* **Check ngrok URL:**
  Browser me kholein: `https://your-ngrok-subdomain.ngrok-free.app/api/ping`
