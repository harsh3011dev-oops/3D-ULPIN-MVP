from typing import List, Optional, Any, Dict
from pydantic import BaseModel, Field
from datetime import datetime

# --- Request Models ---

class BuildingCreateRequest(BaseModel):
    parcel_id: str = Field(..., description="Unique identifier for the parcel")
    address: Optional[str] = Field(None, description="Full address of the parcel")
    latitude: Optional[float] = Field(None, description="Latitude coordinate")
    longitude: Optional[float] = Field(None, description="Longitude coordinate")
    parcel_boundary: Optional[Dict[str, Any]] = Field(None, description="GeoJSON polygon of the parcel boundary")
    height_meters: float = Field(..., gt=0, description="Total height of the building in meters")
    floor_count: int = Field(..., gt=0, description="Total number of floors")
    aerial_image_path: Optional[str] = Field(None, description="Path or URL to the aerial image")

class JobStatusRequest(BaseModel):
    job_id: str

# --- Response Models ---

class JobStatusResponse(BaseModel):
    job_id: str
    status: str
    progress_pct: int
    progress_step: Optional[str] = None
    result_data: Optional[Dict[str, Any]] = None
    estimated_time_remaining_sec: Optional[int] = None

class UnitResponse(BaseModel):
    unit_id: str
    ulpin: str
    floor: int
    centroid: List[float]  # [lat, lon]
    polygon_2d: Dict[str, Any]  # GeoJSON
    area_sqft: float

class BuildingResponse(BaseModel):
    building_id: str
    parcel_id: str
    footprint: Dict[str, Any]  # GeoJSON
    height_meters: float
    floor_count: int
    total_units: int
    units: List[UnitResponse]

class ValidationResponse(BaseModel):
    building_id: str
    is_valid: bool
    overlaps_detected: int
    out_of_bounds: int
    confidence_score: float
    errors: List[str]
    checked_at: Optional[datetime] = None

class GenericResponse(BaseModel):
    status: str
    message: str
    job_id: Optional[str] = None
