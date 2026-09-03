from pydantic import BaseModel, Field
from typing import List, Optional, Dict, Any

class GeoJSONPolygon(BaseModel):
    type: str = "Polygon"
    coordinates: List[List[List[float]]]

class CreateBuildingRequest(BaseModel):
    parcel_id: str = Field(..., example="PARCEL_BLDG_001")
    aerial_image_url: Optional[str] = Field(None, example="https://example.com/aerial.png")
    address: Optional[str] = Field(None, example="123 Main Street, City, India")
    latitude: Optional[float] = Field(None, example=28.6139)
    longitude: Optional[float] = Field(None, example=77.2090)
    height_meters: float = Field(..., example=45.0)
    floor_count: int = Field(..., example=12)
    units_per_floor: Optional[int] = Field(4, example=4)
    parcel_boundary: Optional[GeoJSONPolygon] = None

class CreateBuildingResponse(BaseModel):
    building_id: str
    job_id: str
    status: str
    message: str

class JobStatusResponse(BaseModel):
    status: str
    progress_pct: int
    step: str
    building_id: Optional[str] = None
    error_message: Optional[str] = None
