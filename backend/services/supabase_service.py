import uuid
import json
import logging
from datetime import datetime
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select, update
from sqlalchemy.orm import selectinload
from backend.models import Job, Building, Unit, ValidationLog

logger = logging.getLogger(__name__)

# In-memory store fallback when PostgreSQL database is unavailable
_JOBS_CACHE = {}
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
        "created_at": datetime.utcnow().isoformat()
    }
    if db:
        try:
            db.add(job)
            await db.commit()
            await db.refresh(job)
        except Exception as e:
            logger.warning(f"Database unavailable for create_job, using in-memory cache: {e}")
    return job

async def get_job(db: AsyncSession, job_id: str) -> Job | dict | None:
    """Fetch a job by job_id with in-memory fallback."""
    if db:
        try:
            result = await db.execute(select(Job).filter(Job.job_id == job_id))
            db_job = result.scalars().first()
            if db_job:
                return db_job
        except Exception as e:
            logger.warning(f"Database lookup failed for job {job_id}, checking cache: {e}")
    
    cached = _JOBS_CACHE.get(job_id)
    if cached:
        # Create dummy Job object for attribute compatibility
        class CachedJob:
            def __init__(self, data):
                for k, v in data.items():
                    setattr(self, k, v)
        return CachedJob(cached)
    return None

async def update_job_status(
    db: AsyncSession, 
    job_id: str, 
    status: str, 
    progress_pct: int = None, 
    progress_step: str = None, 
    result_json: dict = None,
    error_message: str = None,
    started_at = None,
    completed_at = None
):
    """Update an existing job's status and progress in DB & in-memory fallback."""
    if job_id in _JOBS_CACHE:
        _JOBS_CACHE[job_id]["status"] = status
        if progress_pct is not None:
            _JOBS_CACHE[job_id]["progress_pct"] = progress_pct
        if progress_step:
            _JOBS_CACHE[job_id]["progress_step"] = progress_step
        if result_json is not None:
            _JOBS_CACHE[job_id]["result_json"] = result_json
        if error_message:
            _JOBS_CACHE[job_id]["error_message"] = error_message

    if db:
        try:
            stmt = update(Job).where(Job.job_id == job_id).values(status=status)
            if progress_pct is not None:
                stmt = stmt.values(progress_pct=progress_pct)
            if progress_step:
                stmt = stmt.values(progress_step=progress_step)
            if result_json is not None:
                stmt = stmt.values(result_json=result_json)
            if error_message:
                stmt = stmt.values(error_message=error_message)
            if started_at:
                stmt = stmt.values(started_at=started_at)
            if completed_at:
                stmt = stmt.values(completed_at=completed_at)
                
            await db.execute(stmt)
            await db.commit()
        except Exception as e:
            logger.warning(f"DB update failed for job {job_id}: {e}")

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
