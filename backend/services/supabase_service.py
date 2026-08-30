import uuid
import json
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select, update
from sqlalchemy.orm import selectinload
from backend.models import Job, Building, Unit, ValidationLog

async def create_job(db: AsyncSession, parcel_id: str) -> Job:
    """Create a new job in the database."""
    job_id = str(uuid.uuid4())
    job = Job(job_id=job_id, parcel_id=parcel_id, status="pending", progress_pct=0)
    db.add(job)
    await db.commit()
    await db.refresh(job)
    return job

async def get_job(db: AsyncSession, job_id: str) -> Job | None:
    """Fetch a job by job_id."""
    result = await db.execute(select(Job).filter(Job.job_id == job_id))
    return result.scalars().first()

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
    """Update an existing job's status and progress."""
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

async def get_building_with_units(db: AsyncSession, building_id: str) -> Building | None:
    """Fetch a building by its string ID, including all its units."""
    result = await db.execute(
        select(Building)
        .options(selectinload(Building.units))
        .filter(Building.building_id == building_id)
    )
    return result.scalars().first()

async def get_validation_log(db: AsyncSession, building_id: str) -> ValidationLog | None:
    """Fetch the validation log for a building."""
    # First get the internal UUID for the building
    building_res = await db.execute(select(Building.id).filter(Building.building_id == building_id))
    building_uuid = building_res.scalars().first()
    
    if not building_uuid:
        return None
        
    result = await db.execute(
        select(ValidationLog).filter(ValidationLog.building_id == building_uuid)
    )
    return result.scalars().first()
