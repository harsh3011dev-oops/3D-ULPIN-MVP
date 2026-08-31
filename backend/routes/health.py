"""
backend/routes/health.py
─────────────────────────────────────────────
Health check endpoint — used by frontend and monitoring.
"""

from fastapi import APIRouter, Depends
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import text
from backend.database import get_db
from backend.supabase_client import get_supabase_client
from backend.config import settings
import logging

router = APIRouter(prefix="/api", tags=["health"])
logger = logging.getLogger(__name__)


@router.get("/health")
async def health_check(db: AsyncSession = Depends(get_db)):
    """
    Returns system health status including DB and Storage connectivity.
    Frontend polls this on startup to confirm backend is ready.
    """
    health = {
        "status": "ok",
        "service": "3D ULPIN API",
        "version": "1.0.0",
        "supabase_url": settings.supabase_url,
        "checks": {}
    }

    # ── Check DB ──────────────────────────────
    try:
        result = await db.execute(text("SELECT 1"))
        result.scalar()
        health["checks"]["database"] = "✅ connected"
    except Exception as e:
        health["checks"]["database"] = f"❌ {str(e)}"
        health["status"] = "degraded"

    # ── Check PostGIS ─────────────────────────
    try:
        result = await db.execute(text("SELECT PostGIS_Version()"))
        postgis_ver = result.scalar()
        health["checks"]["postgis"] = f"✅ {postgis_ver}"
    except Exception as e:
        health["checks"]["postgis"] = f"❌ {str(e)}"
        health["status"] = "degraded"

    # ── Check Supabase Storage ─────────────────
    try:
        client = get_supabase_client()
        buckets = client.storage.list_buckets()
        bucket_names = [b.name for b in buckets]
        if settings.supabase_storage_bucket in bucket_names:
            health["checks"]["storage"] = f"✅ bucket '{settings.supabase_storage_bucket}' ready"
        else:
            health["checks"]["storage"] = f"⚠️  bucket '{settings.supabase_storage_bucket}' not found"
    except Exception as e:
        health["checks"]["storage"] = f"❌ {str(e)}"
        health["status"] = "degraded"

    return health
