import uuid
import json
import logging
from datetime import datetime, timezone
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select, update
from sqlalchemy.orm import selectinload
from backend.models import Job, Building, Unit, ValidationLog

import os

logger = logging.getLogger(__name__)

# In-memory store fallback when PostgreSQL database is unavailable
_CACHE_DIR = os.path.abspath(os.path.join(os.path.dirname(__file__), '../../cache'))
os.makedirs(_CACHE_DIR, exist_ok=True)
_JOBS_FILE = os.path.join(_CACHE_DIR, 'jobs_cache.json')

def _load_jobs_cache():
    if os.path.exists(_JOBS_FILE):
        try:
            with open(_JOBS_FILE, 'r', encoding='utf-8') as f:
                return json.load(f)
        except Exception as e:
            logger.warning(f"Failed to load jobs cache from disk: {e}")
    return {}

def _save_jobs_cache():
    try:
        with open(_JOBS_FILE, 'w', encoding='utf-8') as f:
            json.dump(_JOBS_CACHE, f, ensure_ascii=False, indent=2)
    except Exception as e:
        logger.warning(f"Failed to save jobs cache to disk: {e}")

_JOBS_CACHE = _load_jobs_cache()
_BUILDINGS_CACHE = {}
_VALIDATIONS_CACHE = {}

async def create_job(db: AsyncSession, parcel_id: str) -> Job:
    """Create a new job in the database with in-memory fallback."""
    job_id = str(uuid.uuid4())
    job = Job(job_id=job_id, parcel_id=parcel_id, status="pending", progress_pct=0)
    _JOBS_CACHE[job_id] = {
        "job_id": job_id,
        "parcel_id": parcel_id,
        "status": "pending",
        "progress_pct": 0,
        "progress_step": "Initializing",
        "result_json": None,
        "error_message": None,
        "created_at": datetime.now(timezone.utc).isoformat()
    }
    _save_jobs_cache()
    if db:
        try:
            db.add(job)
            await db.commit()
            await db.refresh(job)
        except Exception as e:
            logger.warning(f"Database unavailable for create_job, using in-memory cache: {e}")
    return job

async def get_job(db: AsyncSession, job_id: str) -> Job | dict | None:
    """Fetch a job by job_id with in-memory fallback. Prefers completed cached state."""
    cached = _JOBS_CACHE.get(job_id)
    
    db_job = None
    if db:
        try:
            import asyncio
            async def _fetch():
                result = await db.execute(select(Job).filter(Job.job_id == job_id))
                return result.scalars().first()
            db_job = await asyncio.wait_for(_fetch(), timeout=3.0)
        except Exception as e:
            logger.warning(f"Database lookup failed for job {job_id}, checking cache: {e}")
    
    if cached:
        class CachedJob:
            def __init__(self, data):
                for k, v in data.items():
                    setattr(self, k, v)
        # If DB is still 'processing' or missing building_id but cache has completed or building_id
        if db_job:
            if (getattr(db_job, 'status', None) == 'processing' and cached.get('status') == 'completed') or \
               (not getattr(db_job, 'building_id', None) and cached.get('building_id')):
                return CachedJob(cached)
            return db_job
        return CachedJob(cached)
    return db_job

async def update_job_status(
    db: AsyncSession, 
    job_id: str, 
    status: str, 
    progress_pct: int = None, 
    progress_step: str = None, 
    result_json: dict = None,
    error_message: str = None,
    building_id: str = None,
    started_at = None,
    completed_at = None
):
    """Update an existing job's status and progress in DB & in-memory fallback."""
    if result_json and not building_id:
        building_id = result_json.get("building_id")

    if job_id not in _JOBS_CACHE:
        _JOBS_CACHE[job_id] = {"job_id": job_id}

    _JOBS_CACHE[job_id]["status"] = status
    if progress_pct is not None:
        _JOBS_CACHE[job_id]["progress_pct"] = progress_pct
    if progress_step:
        _JOBS_CACHE[job_id]["progress_step"] = progress_step
    if building_id:
        _JOBS_CACHE[job_id]["building_id"] = building_id
    if result_json is not None:
        _JOBS_CACHE[job_id]["result_json"] = result_json
    if error_message:
        _JOBS_CACHE[job_id]["error_message"] = error_message
    _save_jobs_cache()

    values_dict = {"status": status}
    if progress_pct is not None:
        values_dict["progress_pct"] = progress_pct
    if progress_step:
        values_dict["progress_step"] = progress_step
    if building_id:
        values_dict["building_id"] = building_id
    if result_json is not None:
        values_dict["result_json"] = result_json
    if error_message:
        values_dict["error_message"] = error_message
    if started_at:
        values_dict["started_at"] = started_at
    if completed_at:
        values_dict["completed_at"] = completed_at

    import asyncio
    stmt = update(Job).where(Job.job_id == job_id).values(**values_dict)

    updated = False
    if db:
        try:
            async def _execute_db():
                await db.execute(stmt)
                await db.commit()

            await asyncio.wait_for(_execute_db(), timeout=4.0)
            updated = True
        except Exception as e:
            logger.warning(f"DB update failed with current session for job {job_id}: {e}")

    if not updated:
        try:
            from backend.database import AsyncSessionLocal
            async with AsyncSessionLocal() as fresh_db:
                await asyncio.wait_for(fresh_db.execute(stmt), timeout=4.0)
                await asyncio.wait_for(fresh_db.commit(), timeout=4.0)
        except Exception as e2:
            logger.warning(f"DB update with fresh session failed for job {job_id}: {e2}")

async def get_building_with_units(db: AsyncSession, building_id: str):
    """Fetch a building by its string ID, including all its units. Supports memory fallback."""
    if db:
        try:
            result = await db.execute(
                select(Building)
                .options(selectinload(Building.units))
                .filter(Building.building_id == building_id)
            )
            b = result.scalars().first()
            if b:
                return b
        except Exception:
            pass
            
    class DummyUnit:
        def __init__(self, data):
            self.unit_id = data.get('unit_id')
            self.ulpin = data.get('ulpin')
            self.floor = data.get('floor')
            self.floor_height_m = data.get('floor_height_m', 0.0)
            centroid = data.get('centroid', [0, 0])
            self.centroid_lat = centroid[0]
            self.centroid_lon = centroid[1]
            self.area_sqft = data.get('area_sqft', data.get('area_sqm', 0) * 10.764)
            self.polygon_2d = data.get('polygon_2d')

    class DummyBuilding:
        def __init__(self, data):
            self.building_id = data.get('building_id')
            self.parcel_id = data.get('parcel_id')
            self.height_meters = data.get('height', data.get('height_meters', 0.0))
            self.floor_count = data.get('floor_count')
            self.total_units = len(data.get('units', []))
            self.building_name = data.get('building_name')
            self.address = data.get('address')
            self.centroid_lat = data.get('latitude')
            self.centroid_lon = data.get('longitude')
            self.created_at = data.get('created_at')
            self.validation = None
            self.footprint = data.get('footprint')
            self.units = [DummyUnit(u) for u in data.get('units', [])]

    # Fallback to cache
    cached = _BUILDINGS_CACHE.get(building_id)
    if cached:
        return DummyBuilding(cached)

    # Final fallback: scan ai/exports/ on disk
    try:
        from backend.services.ai_runner import _load_result_by_building_id
        disk_result = _load_result_by_building_id(building_id)
        if disk_result:
            logger.info(f"Loaded building {building_id} from disk exports.")
            _BUILDINGS_CACHE[building_id] = disk_result
            _VALIDATIONS_CACHE[building_id] = disk_result.get('validation', {})
            return DummyBuilding(disk_result)
    except Exception as e:
        logger.warning(f"Disk lookup failed for building {building_id}: {e}")

    return None

async def get_validation_log(db: AsyncSession, building_id: str):
    """Fetch the validation log for a building. Supports memory fallback."""
    if db:
        try:
            building_res = await db.execute(select(Building.id).filter(Building.building_id == building_id))
            building_uuid = building_res.scalars().first()
            if building_uuid:
                result = await db.execute(
                    select(ValidationLog).filter(ValidationLog.building_id == building_uuid)
                )
                v = result.scalars().first()
                if v:
                    return v
        except Exception:
            pass
            
    cached = _VALIDATIONS_CACHE.get(building_id)
    if cached:
        class DummyValidation:
            def __init__(self, data):
                self.is_valid = data.get('valid', True)
                self.overlaps_detected = len(data.get('overlapping_units', []))
                self.out_of_bounds = len(data.get('out_of_bounds', []))
                self.confidence_score = data.get('confidence_score', 0.0)
                self.validation_report = data
                self.checked_at = datetime.utcnow()
        return DummyValidation(cached)
    return None
