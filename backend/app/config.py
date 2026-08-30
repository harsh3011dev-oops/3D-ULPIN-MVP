import os
import sys
from pydantic_settings import BaseSettings

# Ensure root and AI module paths are importable
ROOT_PATH = os.path.abspath(os.path.join(os.path.dirname(__file__), '../..'))
AI_MODULE_PATH = os.path.abspath(os.path.join(os.path.dirname(__file__), '../../ai'))
for p in [ROOT_PATH, AI_MODULE_PATH]:
    if p not in sys.path:
        sys.path.insert(0, p)

class Settings(BaseSettings):
    PROJECT_NAME: str = "3D ULPIN MVP Backend API"
    VERSION: str = "1.0.0"
    API_V1_STR: str = "/api"

    # Supabase Cloud Database Credentials (Read dynamically from environment or .env file)
    SUPABASE_URL: str = os.getenv("SUPABASE_URL", "https://jypzykeyltjllfbklgud.supabase.co")
    SUPABASE_KEY: str = os.getenv("SUPABASE_SECRET_KEY", os.getenv("SUPABASE_KEY", ""))
    SUPABASE_PUBLISHABLE_KEY: str = os.getenv("SUPABASE_PUBLISHABLE_KEY", "")
    
    # CORS
    BACKEND_CORS_ORIGINS: list = ["*"]

    class Config:
        env_file = ".env"
        case_sensitive = True
        extra = "ignore"

settings = Settings()
