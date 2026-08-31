import json
from fastapi import APIRouter, Depends, HTTPException, BackgroundTasks
from sqlalchemy.ext.asyncio import AsyncSession
from shapely.geometry import shape

from backend.database import get_db
from backend.schemas import (
    BuildingCreateRequest, 
    JobStatusResponse, 
    BuildingResponse, 
    UnitResponse, 
    ValidationResponse,
    GenericResponse
)
from backend.services.supabase_service import (
    create_job, 
    get_job, 
    get_building_with_units, 
    get_validation_log
)
from backend.services.ai_runner import execute_ai_pipeline_job

router = APIRouter(prefix="/v1", tags=["3D ULPIN MVP"])

@router.post("/buildings/create", response_model=GenericResponse, status_code=202)
async def create_building_request(
    request: BuildingCreateRequest, 
    background_tasks: BackgroundTasks,
    db: AsyncSession = Depends(get_db)
):
    """
    Endpoint 1: Receive building requests (address, height, floors)
    Queues AI pipeline job asynchronously.
    """
    # 1. Validate input
    if request.height_meters <= 0:
        raise HTTPException(status_code=400, detail="height_meters must be greater than 0")
    if request.floor_count <= 0:
        raise HTTPException(status_code=400, detail="floor_count must be greater than 0")

    # 2 & 3. Generate job_id & Create Job record
    job = await create_job(db, request.parcel_id)

    # 4. Queue background task
    background_tasks.add_task(
        execute_ai_pipeline_job,
        job_id=job.job_id,
        parcel_id=request.parcel_id,
        address=request.address,
        latitude=request.latitude,
        longitude=request.longitude,
        height_meters=request.height_meters,
        floor_count=request.floor_count,
        aerial_image_url=request.aerial_image_path,
        parcel_boundary=request.parcel_boundary
    )

    # 5. Return immediately
    return GenericResponse(
        status="pending",
        message="Building processing started. Poll /jobs/{job_id}/status for progress.",
        job_id=job.job_id
    )

@router.get("/jobs/{job_id}/status", response_model=JobStatusResponse)
async def get_job_status(job_id: str, db: AsyncSession = Depends(get_db)):
    """
    Endpoint 2: Track job progress (0-100%)
    """
    job = await get_job(db, job_id)
    if not job:
        raise HTTPException(status_code=404, detail="Job not found")

    return JobStatusResponse(
        job_id=job.job_id,
        status=job.status,
        progress_pct=job.progress_pct,
        progress_step=job.progress_step,
        result_data=job.result_json
    )

@router.get("/buildings/{building_id}", response_model=BuildingResponse)
async def get_building(building_id: str, db: AsyncSession = Depends(get_db)):
    """
    Endpoint 3: Serve 3D building data + ULPINs to frontend
    """
    building = await get_building_with_units(db, building_id)
    if not building:
        raise HTTPException(status_code=404, detail="Building not found")

    from geoalchemy2.shape import to_shape
    import shapely.geometry

    # Convert WKT footprint to GeoJSON dictionary
    footprint_geom = to_shape(building.footprint)
    footprint_geojson = shapely.geometry.mapping(footprint_geom)

    units_response = []
    for u in building.units:
        unit_geom = to_shape(u.polygon_2d)
        units_response.append(
            UnitResponse(
                unit_id=u.unit_id,
                ulpin=u.ulpin,
                floor=u.floor,
                centroid=[u.centroid_lat, u.centroid_lon],
                polygon_2d=shapely.geometry.mapping(unit_geom),
                area_sqft=u.area_sqft
            )
        )

    return BuildingResponse(
        building_id=building.building_id,
        parcel_id=str(building.parcel_id) if building.parcel_id else "unknown",
        footprint=footprint_geojson,
        height_meters=building.height_meters,
        floor_count=building.floor_count,
        total_units=building.total_units,
        units=units_response
    )

@router.get("/validation/{building_id}", response_model=ValidationResponse)
async def get_validation(building_id: str, db: AsyncSession = Depends(get_db)):
    """
    Endpoint 4: Provide validation reports
    """
    # This requires looking up the building first to get its UUID
    val_log = await get_validation_log(db, building_id)
    if not val_log:
        raise HTTPException(status_code=404, detail="Validation log not found for this building")

    return ValidationResponse(
        building_id=building_id,
        is_valid=val_log.is_valid,
        overlaps_detected=val_log.overlaps_detected,
        out_of_bounds=val_log.out_of_bounds,
        confidence_score=val_log.confidence_score,
        errors=val_log.validation_report.get('errors', []) if val_log.validation_report else [],
        checked_at=val_log.checked_at
    )
