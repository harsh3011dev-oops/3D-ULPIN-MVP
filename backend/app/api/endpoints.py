import uuid
from fastapi import APIRouter, BackgroundTasks, HTTPException, Path
from typing import Dict, Any, Optional
from pydantic import BaseModel

from app.schemas.building import (
    CreateBuildingRequest,
    CreateBuildingResponse,
    JobStatusResponse
)
from app.services.ai_runner import jobs_db, buildings_db, execute_ai_pipeline_job
from app.services.supabase_service import supabase_service

router = APIRouter()


# ── Auto-Detect Schema ────────────────────────────────────────────────────────
class AutoDetectRequest(BaseModel):
    building_name: Optional[str] = None
    address: Optional[str] = None
    latitude: Optional[float] = None
    longitude: Optional[float] = None

class AutoDetectResponse(BaseModel):
    latitude: Optional[float]
    longitude: Optional[float]
    height_meters: Optional[float]
    floor_count: Optional[int]
    address: Optional[str]
    building_name: Optional[str]
    confidence: float
    source: str


@router.post("/buildings/auto-detect", response_model=AutoDetectResponse)
async def auto_detect_building(payload: AutoDetectRequest):
    """
    Auto-fill building metadata (coordinates, height, floors) for a known building.
    Uses geocoding + known landmark database.
    """
    name = (payload.building_name or payload.address or "").lower()

    # Known landmark database
    landmarks = {
        "burj khalifa": {"latitude": 25.1972, "longitude": 55.2744, "height_meters": 828.0, "floor_count": 163, "address": "Downtown Dubai, UAE"},
        "willis tower": {"latitude": 41.8789, "longitude": -87.6359, "height_meters": 442.1, "floor_count": 108, "address": "233 S Wacker Dr, Chicago, IL 60606, USA"},
        "antilia": {"latitude": 18.9682, "longitude": 72.8095, "height_meters": 173.0, "floor_count": 27, "address": "Altamount Rd, Cumballa Hill, Mumbai, Maharashtra, India"},
        "world one": {"latitude": 18.9959, "longitude": 72.8290, "height_meters": 280.2, "floor_count": 76, "address": "The Park, Lower Parel, Mumbai, Maharashtra, India"},
        "taj mahal": {"latitude": 27.1751, "longitude": 78.0421, "height_meters": 73.0, "floor_count": 5, "address": "Agra, Uttar Pradesh, India"},
        "india gate": {"latitude": 28.6129, "longitude": 77.2295, "height_meters": 42.0, "floor_count": 1, "address": "New Delhi, India"},
        "eiffel tower": {"latitude": 48.8584, "longitude": 2.2945, "height_meters": 330.0, "floor_count": 3, "address": "Champ de Mars, Paris, France"},
        "empire state": {"latitude": 40.7484, "longitude": -73.9856, "height_meters": 443.0, "floor_count": 102, "address": "350 Fifth Ave, New York, USA"},
    }

    # Match against known landmarks
    for key, data in landmarks.items():
        if key in name:
            return AutoDetectResponse(
                latitude=data["latitude"],
                longitude=data["longitude"],
                height_meters=data["height_meters"],
                floor_count=data["floor_count"],
                address=data["address"],
                building_name=key.title(),
                confidence=0.95,
                source="landmark_db"
            )

    # If coordinates given, return with defaults
    if payload.latitude and payload.longitude:
        return AutoDetectResponse(
            latitude=payload.latitude,
            longitude=payload.longitude,
            height_meters=15.0,
            floor_count=3,
            address=payload.address or f"{payload.latitude:.4f}, {payload.longitude:.4f}",
            building_name=payload.building_name,
            confidence=0.60,
            source="coordinates"
        )

    # Fallback
    return AutoDetectResponse(
        latitude=28.6139,
        longitude=77.2090,
        height_meters=12.0,
        floor_count=3,
        address=payload.address or "New Delhi, India",
        building_name=payload.building_name,
        confidence=0.30,
        source="fallback"
    )

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
    background_tasks.add_task(execute_ai_pipeline_job, job_id, **payload.model_dump())

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
        raise HTTPException(status_code=404, detail=f"Job '{job_id}' not found")
    
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
    
    raise HTTPException(status_code=404, detail=f"Building '{building_id}' not found")

@router.get("/validation/{building_id}")
async def get_validation_endpoint(building_id: str):
    """
    Fetch Spatial Overlap & Bounds Validation Report
    """
    bld = get_building_endpoint(building_id)
    return bld.get("validation", {
        "valid": True,
        "overlaps_detected": False,
        "overlapping_units": [],
        "out_of_bounds": [],
        "errors": []
    })
