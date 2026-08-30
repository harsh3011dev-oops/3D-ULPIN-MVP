"""
backend/main.py
─────────────────────────────────────────────
FastAPI application entry point.
Mounts all routers, configures CORS, and handles startup/shutdown.
"""

from contextlib import asynccontextmanager
from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
import logging

from backend.config import settings
from backend.database import check_db_connection
from backend.supabase_client import ensure_storage_bucket_exists

# ── Logging ───────────────────────────────────────────────────────────────────
logging.basicConfig(
    level=logging.DEBUG if settings.debug else logging.INFO,
    format="%(asctime)s [%(levelname)s] %(name)s: %(message)s",
)
logger = logging.getLogger(__name__)


# ── Lifespan (startup / shutdown) ─────────────────────────────────────────────
@asynccontextmanager
async def lifespan(app: FastAPI):
    """Run startup checks, then yield control to FastAPI, then cleanup."""
    logger.info("🚀 Starting 3D-ULPIN Backend...")

    # Verify Supabase DB connection
    db_ok = await check_db_connection()
    if not db_ok:
        logger.error("❌ Could not connect to Supabase DB — check DATABASE_URL in .env")

    # Ensure Storage bucket exists
    await ensure_storage_bucket_exists()

    logger.info("✅ Backend startup complete")
    yield

    logger.info("🛑 Shutting down backend...")


# ── App ───────────────────────────────────────────────────────────────────────
app = FastAPI(
    title="3D ULPIN API",
    description="Backend API for 3D Unique Land Parcel Identification Number system",
    version="1.0.0",
    docs_url="/docs",
    redoc_url="/redoc",
    lifespan=lifespan,
)

# ── CORS ──────────────────────────────────────────────────────────────────────
app.add_middleware(
    CORSMiddleware,
    allow_origins=settings.cors_origins_list,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# ── Routers ───────────────────────────────────────────────────────────────────
# Imported here to avoid circular imports
from backend.routes import health  # noqa: E402
from backend.api.endpoints import router as api_router

app.include_router(health.router)
app.include_router(api_router, prefix="/api")


# ── Root ──────────────────────────────────────────────────────────────────────
@app.get("/", tags=["root"])
async def root():
    return {
        "service": "3D ULPIN API",
        "version": "1.0.0",
        "docs": "/docs",
        "health": "/api/health",
    }
