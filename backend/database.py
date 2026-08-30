"""
backend/database.py
─────────────────────────────────────────────
SQLAlchemy async engine connected to Supabase PostgreSQL.
Uses Transaction Pooler (port 6543) — best for serverless/FastAPI.

KEY FIX: Supabase uses pgbouncer in transaction mode which does NOT support
prepared statements. We must set statement_cache_size=0 via creator function
to ensure asyncpg never caches prepared statements.
"""

from sqlalchemy.ext.asyncio import AsyncSession, create_async_engine, async_sessionmaker
from sqlalchemy.orm import DeclarativeBase
from sqlalchemy import text, event
from sqlalchemy.pool import NullPool
from backend.config import settings
import logging

logger = logging.getLogger(__name__)


def _make_engine():
    """
    Build the async engine with statement_cache_size=0.
    This is the correct way to pass asyncpg-specific args through SQLAlchemy
    when using Supabase Transaction Pooler (pgbouncer transaction mode).
    """
    import asyncpg  # noqa: F401 — ensures asyncpg is installed

    async def connect():
        """Custom asyncpg connection that disables prepared statement caching."""
        import asyncpg
        from urllib.parse import urlparse, unquote

        # Parse the DATABASE_URL to extract components
        url = settings.database_url
        # Convert asyncpg URL format for direct asyncpg connection
        # SQLAlchemy URL: postgresql+asyncpg://user:pass@host:port/db
        # asyncpg URL:    postgresql://user:pass@host:port/db
        raw_url = url.replace("postgresql+asyncpg://", "postgresql://")

        conn = await asyncpg.connect(
            dsn=raw_url,
            statement_cache_size=0,           # Required for pgbouncer transaction mode
            prepared_statement_cache_size=0,  # Belt and suspenders
        )
        return conn

    # Use NullPool — let asyncpg manage its own connection pooling
    # This avoids SQLAlchemy pool conflicts with pgbouncer
    engine = create_async_engine(
        settings.database_url,
        echo=settings.debug,
        poolclass=NullPool,            # Disable SQLAlchemy pooling (pgbouncer handles it)
        connect_args={
            "statement_cache_size": 0,
            "prepared_statement_cache_size": 0,
        },
    )
    return engine


engine = _make_engine()

# ── Session Factory ───────────────────────────────────────────────────────────
AsyncSessionLocal = async_sessionmaker(
    bind=engine,
    class_=AsyncSession,
    expire_on_commit=False,
    autocommit=False,
    autoflush=False,
)


# ── Base Class for ORM Models ─────────────────────────────────────────────────
class Base(DeclarativeBase):
    pass


# ── Dependency Injection (FastAPI) ────────────────────────────────────────────
async def get_db() -> AsyncSession:
    """
    FastAPI dependency — yields an async DB session.
    Session is automatically closed after the request completes.

    Usage:
        async def my_route(db: AsyncSession = Depends(get_db)):
            ...
    """
    async with AsyncSessionLocal() as session:
        try:
            yield session
            await session.commit()
        except Exception:
            await session.rollback()
            raise
        finally:
            await session.close()


# ── Startup Health Check ──────────────────────────────────────────────────────
async def check_db_connection() -> bool:
    """
    Verify Supabase PostgreSQL connectivity on startup.
    Called from main.py lifespan event.
    Uses raw asyncpg connection to bypass SQLAlchemy pool internals.
    """
    try:
        import asyncpg
        raw_url = settings.database_url.replace("postgresql+asyncpg://", "postgresql://")

        conn = await asyncpg.connect(
            dsn=raw_url,
            statement_cache_size=0,
        )
        try:
            version = await conn.fetchval("SELECT version()")
            logger.info("[OK] Connected to Supabase DB: %s", version[:70])

            # Check PostGIS
            try:
                postgis = await conn.fetchval("SELECT PostGIS_Version()")
                logger.info("[OK] PostGIS: %s", postgis)
            except Exception:
                logger.warning("[WARN] PostGIS not enabled -- enable at Supabase -> Database -> Extensions")
        finally:
            await conn.close()

        return True
    except Exception as e:
        logger.error("[FAIL] Database connection failed: %s", e)
        return False
