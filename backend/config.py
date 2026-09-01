"""
backend/config.py
─────────────────────────────────────────────
Central settings loader using pydantic-settings.
All config comes from .env file — never hardcoded.
"""

from pydantic_settings import BaseSettings
from functools import lru_cache
from pathlib import Path

# Resolve .env path — works whether run from project root or backend/
_BACKEND_DIR = Path(__file__).parent
_ENV_FILE = _BACKEND_DIR / ".env"


class Settings(BaseSettings):
    # ── Supabase ──────────────────────────────
    supabase_url: str = "https://mock.supabase.co"
    supabase_anon_key: str = "mock_anon_key"
    supabase_service_role_key: str = "mock_service_role_key"
    supabase_storage_bucket: str = "aerial-images"

    # ── Database ──────────────────────────────
    database_url: str = "postgresql+asyncpg://postgres:postgres@localhost:5432/postgres"

    # ── App ───────────────────────────────────
    secret_key: str = "change-me"
    debug: bool = False
    cors_origins: str = "http://localhost:3000"

    @property
    def cors_origins_list(self) -> list[str]:
        """Parse comma-separated CORS origins into a list."""
        return [origin.strip() for origin in self.cors_origins.split(",")]

    class Config:
        env_file = str(_ENV_FILE)  # Absolute path — works from any cwd
        env_file_encoding = "utf-8"
        case_sensitive = False
        extra = "ignore"


@lru_cache()
def get_settings() -> Settings:
    """Return cached settings instance (loaded once at startup)."""
    return Settings()


# Convenience alias used throughout the app
settings = get_settings()
