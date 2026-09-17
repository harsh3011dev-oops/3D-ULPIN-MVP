from pydantic import BaseModel, Field
from typing import List, Optional, Dict, Any

class UnitRecord(BaseModel):
    unit_id: str
    floor_number: int
    label: str
    polygon_2d: dict  # GeoJSON
    centroid: List[float]
    area_sqm: float
    z_min: float
    z_max: float
    floor_height_m: float
    ulpin: str
    generation_method: str = "prototype_grid"

class FloorRecord(BaseModel):
    floor_number: int
    label: str
    z_min: float
    z_max: float
    floor_height_m: float
    footprint: dict  # GeoJSON
    units: List[UnitRecord] = Field(default_factory=list)
    generation_method: str = "mathematical_slicing"

class HeightEstimate(BaseModel):
    value_meters: float
    source: str  # "osm", "estimated_from_floors", "default"
    method: str
    confidence: float

class FloorCountEstimate(BaseModel):
    value: int
    source: str  # "osm", "gemini", "default"
    confidence: float

class FootprintEstimate(BaseModel):
    geometry: dict  # GeoJSON
    source: str  # "osm", "cv_only", "hybrid"
    confidence: float

class AssessmentData(BaseModel):
    land_use: Optional[str] = None
    built_up_area_sqm: float = 0.0
    floor_area_sqm: float = 0.0
    parcel_area_sqm: float = 0.0
    occupancy_type: Optional[str] = None
    construction_type: Optional[str] = None
    building_material: Optional[str] = None
    roof_shape: Optional[str] = None
    record_status: str = "3D Cadastral Record Generated"
    permit_status: Optional[str] = None
    assessment_value: Optional[str] = None

class BuildingContext(BaseModel):
    building_id: str
    parcel_id: str
    building_name: Optional[str] = None
    address: Optional[str] = None
    latitude: float
    longitude: float
    
    parcel_boundary: Optional[dict] = None
    aerial_image_url: Optional[str] = None
    
    footprint: Optional[FootprintEstimate] = None
    height: Optional[HeightEstimate] = None
    floor_count: Optional[FloorCountEstimate] = None
    
    floors: List[FloorRecord] = Field(default_factory=list)
    
    semantic_data: Dict[str, Any] = Field(default_factory=dict) # Gemini vision output
    osm_data: Dict[str, Any] = Field(default_factory=dict) # OSM raw data
    validation: Dict[str, Any] = Field(default_factory=dict)
    assessment: Optional[AssessmentData] = None
    
    def get_all_units(self) -> List[UnitRecord]:
        units = []
        for f in self.floors:
            units.extend(f.units)
        return units
