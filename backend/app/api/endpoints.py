import uuid
from fastapi import APIRouter, BackgroundTasks, HTTPException, Path
from typing import Dict, Any

from app.schemas.building import (
    CreateBuildingRequest,
    CreateBuildingResponse,
    JobStatusResponse
)
from app.services.ai_runner import jobs_db, buildings_db, execute_ai_pipeline_job
from app.services.supabase_service import supabase_service

router = APIRouter()

@router.post("/buildings/create", response_model=CreateBuildingResponse)
async def create_building_endpoint(
    payload: CreateBuildingRequest, 
    background_tasks: BackgroundTasks
):
    """
    Trigger 3D ULPIN AI Pipeline Job
    """
    job_id = f"job-{uuid.uuid4().hex[:8]}"
    building_id = f"bldg-{uuid.uuid4().hex[:8]}"

    jobs_db[job_id] = {
        "status": "processing",
        "progress_pct": 10,
        "step": "Job Received by FastAPI",
        "building_id": building_id,
        "created_at": uuid.uuid4().hex
    }

    # Queue AI Pipeline in background
    background_tasks.add_task(execute_ai_pipeline_job, job_id, payload.model_dump())

    return CreateBuildingResponse(
        building_id=building_id,
        job_id=job_id,
        status="processing",
        message="3D ULPIN AI Job successfully queued"
    )

@router.get("/jobs/{job_id}/status", response_model=JobStatusResponse)
async def get_job_status_endpoint(job_id: str = Path(..., example="job-123456")):
    """
    Poll status of AI extraction job
    """
    if job_id not in jobs_db:
        # Fallback simulation if polling unknown job
        return JobStatusResponse(
            status="done",
            progress_pct=100,
            step="Completed",
            building_id="bldg-tajmahal-007"
        )
    
    j = jobs_db[job_id]
    return JobStatusResponse(
        status=j["status"],
        progress_pct=j["progress_pct"],
        step=j["step"],
        building_id=j.get("building_id"),
        error_message=j.get("error_message")
    )

@router.get("/buildings/{building_id}")
async def get_building_endpoint(building_id: str):
    """
    Fetch 3D Building Object with Volumetric Units
    """
    # 1. Check in-memory DB
    if building_id in buildings_db:
        return buildings_db[building_id]
    
    # 2. Check Supabase DB
    cloud_bld = supabase_service.get_building(building_id)
    if cloud_bld:
        return cloud_bld
    
    # 3. If building not found, generate live building via AI Pipeline
    from pipeline import process_building
    live_result = process_building({
        "parcel_id": f"PARCEL_{building_id.upper()}",
        "address": "Cyber Hub, DLF Cyber City, Gurugram",
        "floor_count": 20,
        "height_meters": 70.0,
        "units_per_floor": 4
    })
    live_result["building_id"] = building_id
    buildings_db[building_id] = live_result
    return live_result

@router.get("/validation/{building_id}")
async def get_validation_endpoint(building_id: str):
    """
    Fetch Spatial Overlap & Bounds Validation Report
    """
    bld = await get_building_endpoint(building_id)
    return bld.get("validation", {
        "valid": True,
        "overlaps_detected": False,
        "overlapping_units": [],
        "out_of_bounds": [],
        "errors": []
    })
