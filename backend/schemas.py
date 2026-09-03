from typing import List, Optional, Any, Dict
from pydantic import BaseModel, Field
from datetime import datetime

# --- Request Models ---

class BuildingAutoDetectRequest(BaseModel):
    building_name: str = Field(..., min_length=1, description="Famous building name")
    city: str = Field(..., min_length=1, description="City where the building is located")


class BuildingAutoDetectResponse(BaseModel):
    building_name: str
    city: str
    latitude: float
    longitude: float
    height_meters: Optional[float] = None
    floors: Optional[int] = None
    confidence: int
    source: str = "gemini"


class BuildingCreateRequest(BaseModel):
    parcel_id: str = Field(..., description="Unique identifier for the parcel")
    building_name: Optional[str] = Field(None, description="User supplied building name")
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
    building_id: Optional[str] = None
    result_data: Optional[Dict[str, Any]] = None
    error_message: Optional[str] = None
    estimated_time_remaining_sec: Optional[int] = None

class UnitResponse(BaseModel):
    unit_id: str
    ulpin: str
    floor: int
    centroid: List[float]  # [lat, lon]
    polygon_2d: Dict[str, Any]  # GeoJSON
    area_sqft: float
    z_min: Optional[float] = None
    z_max: Optional[float] = None
    floor_height_m: Optional[float] = None

class BuildingValidationSummary(BaseModel):
    is_valid: bool = True
    overlaps_detected: int = 0
    out_of_bounds: int = 0
    confidence_score: float = 0.0
    errors: List[Any] = []

class BuildingResponse(BaseModel):
    building_id: str
    parcel_id: str
    footprint: Dict[str, Any]  # GeoJSON
    height_meters: float
    floor_count: int
    total_units: int
    units: List[UnitResponse]
    building_name: Optional[str] = None
    address: Optional[str] = None
    latitude: Optional[float] = None
    longitude: Optional[float] = None
    created_at: Optional[datetime] = None
    validation: Optional[BuildingValidationSummary] = None

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
