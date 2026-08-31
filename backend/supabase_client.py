"""
backend/supabase_client.py
─────────────────────────────────────────────
Supabase Python client for Storage operations.
Used for uploading/downloading aerial images.

NOTE: This is separate from SQLAlchemy DB connection.
      SQLAlchemy → handles PostgreSQL data (buildings, units, etc.)
      Supabase client → handles Storage (aerial image files)
"""

from supabase import create_client, Client
from backend.config import settings
import logging

logger = logging.getLogger(__name__)

# ── Singleton Supabase client (service role — full access) ────────────────────
_supabase_client: Client | None = None


def get_supabase_client() -> Client:
    """
    Return a singleton Supabase client using the service role key.
    Used server-side only — never expose service role key to frontend.
    """
    global _supabase_client
    if _supabase_client is None:
        _supabase_client = create_client(
            supabase_url=settings.supabase_url,
            supabase_key=settings.supabase_service_role_key,
        )
        logger.info("✅ Supabase client initialized")
    return _supabase_client


# ── Storage helpers ───────────────────────────────────────────────────────────

async def upload_aerial_image(file_bytes: bytes, filename: str, content_type: str = "image/jpeg") -> str:
    """
    Upload an aerial image to Supabase Storage.

    Args:
        file_bytes: Raw image bytes
        filename: Storage path (e.g. "parcels/PARCEL_001/aerial.jpg")
        content_type: MIME type of the image

    Returns:
        Public URL of the uploaded image
    """
    client = get_supabase_client()
    bucket = settings.supabase_storage_bucket

    try:
        response = client.storage.from_(bucket).upload(
            path=filename,
            file=file_bytes,
            file_options={"content-type": content_type, "upsert": "true"},
        )

        # Get public URL
        public_url = client.storage.from_(bucket).get_public_url(filename)
        logger.info(f"✅ Uploaded aerial image: {public_url}")
        return public_url

    except Exception as e:
        logger.error(f"❌ Failed to upload aerial image '{filename}': {e}")
        raise


def get_aerial_image_url(filename: str) -> str:
    """
    Get public URL for an existing aerial image in Supabase Storage.

    Args:
        filename: Storage path (e.g. "parcels/PARCEL_001/aerial.jpg")

    Returns:
        Public URL string
    """
    client = get_supabase_client()
    return client.storage.from_(settings.supabase_storage_bucket).get_public_url(filename)


async def ensure_storage_bucket_exists() -> None:
    """
    Create the aerial-images bucket if it doesn't exist yet.
    Called from main.py lifespan on startup.
    """
    bucket_name = settings.supabase_storage_bucket

    try:
        client = get_supabase_client()
        existing = client.storage.list_buckets()
        bucket_names = [b.name for b in existing]

        if bucket_name not in bucket_names:
            client.storage.create_bucket(
                bucket_name,
                options={"public": True}  # Public so frontend can load images
            )
            logger.info(f"✅ Created Supabase Storage bucket: '{bucket_name}'")
        else:
            logger.info(f"✅ Supabase Storage bucket '{bucket_name}' already exists")

    except Exception as e:
        logger.warning(f"⚠️  Could not verify storage bucket: {e}")
