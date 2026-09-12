"""
backend/services/keep_alive.py
─────────────────────────────────────────────
Background worker to keep the Render free-tier instance awake 24/7.
Pings the public Render URL periodically so Render's 15-minute
inactivity timer never expires.
"""

import asyncio
import logging
import os
import httpx
from backend.config import settings

logger = logging.getLogger("keep_alive")


def get_keep_alive_url() -> str:
    """
    Determine the public URL to ping.
    Checks RENDER_EXTERNAL_URL (automatically set by Render) first,
    then falls back to configured backend_public_url.
    """
    render_url = os.environ.get("RENDER_EXTERNAL_URL", "").strip()
    if render_url:
        return render_url.rstrip("/")
    
    if settings.backend_public_url:
        return settings.backend_public_url.rstrip("/")

    return ""


async def start_keep_alive_loop():
    """
    Periodic self-ping loop.
    Runs in the background during FastAPI lifespan.
    """
    if not settings.keep_alive_enabled:
        logger.info("[KeepAlive] Disabled via configuration.")
        return

    base_url = get_keep_alive_url()
    if not base_url:
        logger.warning("[KeepAlive] No public URL found (RENDER_EXTERNAL_URL or BACKEND_PUBLIC_URL not set). Keep-alive disabled.")
        return

    # Check if running locally (don't spam if on localhost)
    if "localhost" in base_url or "127.0.0.1" in base_url:
        logger.info(f"[KeepAlive] Detected local host ({base_url}). Skipping Render keep-alive.")
        return

    ping_url = f"{base_url}/api/ping"
    interval = max(60, settings.keep_alive_interval_seconds)

    logger.info(f"[KeepAlive] 🚀 Started! Will ping {ping_url} every {interval}s to prevent Render sleep mode.")

    # Initial delay so FastAPI finishes binding port and initial startup
    try:
        await asyncio.sleep(45)
    except asyncio.CancelledError:
        logger.info("[KeepAlive] Cancelled during initial delay.")
        return

    async with httpx.AsyncClient(timeout=15.0, verify=True) as client:
        while True:
            try:
                response = await client.get(ping_url)
                if response.status_code == 200:
                    logger.info(f"[KeepAlive] ✅ Ping successful ({response.status_code}) -> Render kept awake.")
                else:
                    logger.warning(f"[KeepAlive] ⚠️ Ping returned status {response.status_code}")
            except asyncio.CancelledError:
                logger.info("[KeepAlive] Stopping background keep-alive loop.")
                break
            except Exception as exc:
                logger.warning(f"[KeepAlive] ⚠️ Ping request failed (will retry in {interval}s): {exc}")

            try:
                await asyncio.sleep(interval)
            except asyncio.CancelledError:
                logger.info("[KeepAlive] Stopping background keep-alive loop.")
                break
