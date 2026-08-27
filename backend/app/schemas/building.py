from pydantic import BaseModel, Field
from typing import List, Optional, Dict, Any

class GeoJSONPolygon(BaseModel):
    type: str = "Polygon"
    coordinates: List[List[List[float]]]

class CreateBuildingRequest(BaseModel):
    parcel_id: str = Field(..., example="PARCEL_CYBER_HUB_01")
    aerial_image_url: Optional[str] = Field(None, example="https://example.com/aerial.png")
    address: Optional[str] = Field("Cyber Hub, DLF Cyber City, Gurugram", example="Cyber Hub, Gurugram")
    height_meters: float = Field(70.0, example=70.0)
    floor_count: int = Field(20, example=20)
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
