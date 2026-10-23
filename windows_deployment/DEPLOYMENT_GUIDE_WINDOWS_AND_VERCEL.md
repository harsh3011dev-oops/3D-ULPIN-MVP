# 3D-ULPIN-MVP: Complete Windows Local Deployment & Vercel Integration Guide

> **Objective:** Deploy the Python AI Backend (with YOLO11s-seg) on your **Local Windows PC (CPU)** so that:
> 1. It automatically starts in the background as soon as your Windows PC powers on.
> 2. It connects seamlessly to your frontend deployed on **Vercel** so all building and society scans work smoothly without crashes or Render timeouts.

---

## 1. System Requirements (Aapki Requirements)

| Requirement | Minimum | Recommended |
| :--- | :--- | :--- |
| **Operating System** | Windows 10 or Windows 11 (64-bit) | Windows 11 (64-bit) |
| **Python Version** | Python 3.10, 3.11, or 3.12 (64-bit) | Python 3.11 or 3.12 |
| **System RAM** | 4 GB | 8 GB or 16 GB |
| **Disk Space** | ~2 GB free disk space | 4 GB free disk space |
| **GPU Needed?** | **NO (Runs 100% on CPU)** | GPU optional (CPU PyTorch is used) |

> ⚠️ **Important Python Note:** When installing Python on Windows, make sure you check the box:  
> **☑ "Add Python to PATH"** (ye bahut zaroori hai).

---

## 2. Windows Deployment Folder Structure

Sabhi Windows scripts `windows_deployment/` folder me available hain:

```
windows_deployment/
├── setup_windows.bat           # 1-Click Setup: Creates venv & installs CPU PyTorch + dependencies
├── start_backend.bat           # Normal launcher (opens terminal window, useful for debugging)
├── start_silent_startup.vbs    # Hidden background launcher (zero visible popup windows)
├── install_to_startup.bat      # Registers the backend into Windows Auto-Startup folder
├── uninstall_from_startup.bat  # Removes backend from Windows Auto-Startup
├── start_cloudflare_tunnel.bat # Free public HTTPS tunnel for Vercel connection
├── requirements_windows.txt    # Pinned lightweight Windows CPU dependencies (~350MB download)
└── DEPLOYMENT_GUIDE_WINDOWS_AND_VERCEL.md  # This comprehensive guide
```

---

## 3. Step-by-Step Installation on Windows (Sirf 2 Clicks)

### Step 1: Run Setup (One-time)
1. GitHub repo ko apne Windows PC par clone ya download karein.
2. `windows_deployment/` folder kholein.
3. Double-click karein: **`setup_windows.bat`**.
4. Ye script automatically:
   * Ek clean `venv` banayega.
   * Lightweight **CPU-only PyTorch** (~180MB) install karega (Render ki tarah OOM nahi hoga).
   * YOLO11s-seg model checkpoint (`models/building_segmentation/weights/best.pt`) ko load karke verify karega.
   * `[OK] YOLO11s-seg loaded into memory successfully!` message dikhayega.

---

### Step 2: Auto-Startup Enable Karein (Device On Hote Hi Chalne Ke Liye)
1. Double-click karein: **`install_to_startup.bat`**.
2. Ye script Windows ke official Startup folder (`%APPDATA%\Microsoft\Windows\Start Menu\Programs\Startup`) me ek silent shortcut bana dega.
3. **Khatam!** Ab jab bhi aapka Windows laptop/desktop turn on ya reboot hoga:
   * Backend server background me chupchap port **8000** par start ho jayega.
   * Screen par koi black command window nahi aayegi.

---

## 4. Vercel Frontend Se Connect Kaise Karein (Taaki Vercel Par Search Karein Toh Sab Sahi Chale)

Aapka frontend **Vercel** par hosted hai (HTTPS), aur backend aapke Windows laptop par chal raha hai. Dono ko connect karne ke liye:

### Option A: Free Cloudflare Tunnel (Recommended — No Account Needed)
1. Double-click karein: `windows_deployment/start_cloudflare_tunnel.bat`
   *(Agar install nahi hai, toh PowerShell me bas ye likhein: `winget install Cloudflare.cloudflared`)*.
2. Terminal me aapko ek public URL milega, jaise:
   `https://random-words-123.trycloudflare.com`
3. Ab [Vercel Dashboard](https://vercel.com) par jayein $\rightarrow$ Apne Project par click karein $\rightarrow$ **Settings** $\rightarrow$ **Environment Variables**:
   * **Key:** `VITE_API_BASE_URL`
   * **Value:** `https://random-words-123.trycloudflare.com/api`
4. **Deployments** tab me ja kar **Redeploy** dabayein.

### Option B: Free ngrok Tunnel
1. `ngrok http 8000` chalayein.
2. Public URL copy karein (e.g. `https://your-name.ngrok-free.app`).
3. Vercel Environment Variables me add karein:
   * `VITE_API_BASE_URL` = `https://your-name.ngrok-free.app/api`

---

## 5. Verification Checklist (Kaise Check Karein Sab Sahi Hai)

| Test | Command / Action | Expected Result |
| :--- | :--- | :--- |
| **Backend Health** | Browser me open karein: `http://127.0.0.1:8000/api/ping` | `{"status":"ok","message":"pong"}` |
| **Swagger API Docs**| Browser me open karein: `http://127.0.0.1:8000/docs` | FastAPI documentation UI open hogi |
| **Vercel Frontend** | Vercel URL open karein aur Explore page par jayein | Multi-building cadastre bina timeout ke render hoga |
| **Auto-Startup Test** | Laptop reboot karein aur bina kuch click kiye browser me `http://127.0.0.1:8000/api/ping` check karein | 200 OK milega (server already running!) |

---

## 6. How to Stop or Uninstall

* **Temporarily stop backend:** Open Windows Task Manager (`Ctrl + Shift + Esc`) $\rightarrow$ End task for `python.exe`.
* **Remove from Auto-Startup:** Double-click `windows_deployment/uninstall_from_startup.bat`.
