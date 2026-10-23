from pydantic import BaseModel, Field, field_validator
from typing import List, Optional, Dict, Any, Literal
from shapely.geometry import shape

class UnitRecord(BaseModel):
    unit_id: str
    floor_number: int
    floor: Optional[int] = None
    label: str
    polygon_2d: dict  # GeoJSON
    centroid: List[float]
    area_sqm: float
    z_min: float
    z_max: float
    floor_height_m: float
    ulpin: str
    generation_method: str = "prototype_grid"

    def model_post_init(self, __context: Any) -> None:
        if self.floor is None:
            self.floor = self.floor_number

class FloorRecord(BaseModel):
    floor_number: int
    label: str
    z_min: float
    z_max: float
    floor_height_m: float
    height_meters: Optional[float] = None
    footprint: dict  # GeoJSON
    polygon_2d: Optional[dict] = None
    units: List[UnitRecord] = Field(default_factory=list)
    generation_method: str = "mathematical_slicing"

    def model_post_init(self, __context: Any) -> None:
        if self.height_meters is None:
            self.height_meters = self.floor_height_m
        if self.polygon_2d is None:
            self.polygon_2d = self.footprint

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
    aerial_image_transform: Optional[dict] = None
    
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


# ── Multi-Building Society Data Contracts (Milestone 3) ───────────────────────

class BuildingHeight(BaseModel):
    """
    Distinguishes measured, user-supplied, and estimated building heights
    with explicit confidence and uncertainty tracking.
    """
    value_meters: float = Field(..., gt=0.0, description="Building height in metres")
    source: Literal[
        "measured", 
        "user_supplied", 
        "estimated_from_floors", 
        "estimated_from_shadow", 
        "default"
    ] = Field(..., description="Provenance source of height value")
    confidence: float = Field(default=1.0, ge=0.0, le=1.0, description="Confidence in [0.0, 1.0]")
    measured_accuracy_m: Optional[float] = Field(default=None, ge=0.0, description="Measurement precision tolerance in metres")
    assumption_notes: Optional[str] = Field(default=None, description="Documented assumptions if estimated")


class BuildingHint(BaseModel):
    """
    User-supplied or surveyed hint for a specific building within a society.
    """
    hint_id: Optional[str] = None
    building_name: Optional[str] = None
    floor_count: Optional[int] = Field(default=None, gt=0)
    height_meters: Optional[float] = Field(default=None, gt=0.0)
    approx_location: Optional[List[float]] = None  # GeoJSON coordinate order [lon, lat]
    footprint_hint: Optional[Dict[str, Any]] = None  # GeoJSON polygon
    usage_type: Optional[str] = None

    @field_validator("approx_location")
    @classmethod
    def validate_approx_location(cls, v):
        if v is not None:
            if not isinstance(v, (list, tuple)) or len(v) != 2:
                raise ValueError("approx_location must be a [longitude, latitude] pair")
            lon, lat = v
            if not (-180.0 <= lon <= 180.0):
                raise ValueError(f"Longitude must be in [-180, 180], got {lon}")
            if not (-90.0 <= lat <= 90.0):
                raise ValueError(f"Latitude must be in [-90, 90], got {lat}")
        return v


class SocietyProcessRequest(BaseModel):
    """
    Strict data contract for processing a residential society parcel containing multiple buildings.
    """
    society_id: str = Field(..., min_length=1, description="Unique identifier for the residential society")
    parcel_id: str = Field(..., min_length=1, description="Cadastral parcel ID (distinct from society_id)")
    society_name: Optional[str] = Field(default=None, description="Name of the society/complex")
    address: Optional[str] = Field(default=None, description="Postal address")
    boundary: Dict[str, Any] = Field(..., description="GeoJSON Polygon/MultiPolygon of the outer society parcel boundary")
    detection_mode: Literal["auto", "osm_only", "cv_only", "hybrid", "manual_hints"] = Field(
        default="hybrid", description="Detection strategy mode"
    )
    max_buildings: int = Field(default=20, gt=0, le=100, description="Upper bound of buildings to process")
    buffer_tiles: int = Field(default=1, ge=0, le=5, description="Margin tiles for imagery boundary coverage")
    zoom: int = Field(default=19, ge=14, le=21, description="Web Mercator zoom level")
    building_hints: List[BuildingHint] = Field(default_factory=list, description="User or cadastral hints for buildings")
    allow_clipping: bool = Field(default=False, description="Whether to clip out-of-boundary footprints (default: exclude without clipping)")
    options: Dict[str, Any] = Field(default_factory=dict, description="Extensible operational options")

    @field_validator("boundary")
    @classmethod
    def validate_boundary_geojson(cls, v):
        if not isinstance(v, dict):
            raise ValueError("boundary must be a GeoJSON dictionary")
        geom_type = v.get("type")
        if geom_type not in ("Polygon", "MultiPolygon"):
            raise ValueError(f"boundary type must be 'Polygon' or 'MultiPolygon', got '{geom_type}'")
        coords = v.get("coordinates")
        if not coords or not isinstance(coords, list):
            raise ValueError("boundary coordinates must be a non-empty list")
        
        # Validate rings
        rings = coords if geom_type == "Polygon" else [ring for poly in coords for ring in poly]
        for ring in rings:
            if not isinstance(ring, list) or len(ring) < 4:
                raise ValueError("Polygon rings must contain at least 4 coordinate pairs")
            # Ring closure check
            if ring[0] != ring[-1]:
                raise ValueError("Polygon ring must be closed (first and last coordinate must be identical)")
            # Validate coordinate ranges: [lon, lat]
            for pt in ring:
                if not isinstance(pt, (list, tuple)) or len(pt) < 2:
                    raise ValueError(f"Each coordinate must be a [lon, lat] pair, got {pt}")
                lon, lat = pt[0], pt[1]
                if not (-180.0 <= lon <= 180.0):
                    raise ValueError(f"Longitude out of bounds [-180, 180]: {lon}")
                if not (-90.0 <= lat <= 90.0):
                    raise ValueError(f"Latitude out of bounds [-90, 90]: {lat}")

        # Check topological validity using Shapely
        try:
            geom = shape(v)
            if not geom.is_valid:
                raise ValueError(f"boundary geometry is topologically invalid")
            if geom.is_empty:
                raise ValueError("boundary geometry is empty")
        except Exception as e:
            if isinstance(e, ValueError):
                raise
            raise ValueError(f"Invalid GeoJSON boundary: {e}")

        return v


class BuildingRecord(BaseModel):
    """
    Comprehensive record for an individual building identified within a society parcel.
    Maintains explicit distinction between society_id, parcel_id, internal_building_id, and official_ulpin.
    """
    internal_building_id: str = Field(..., min_length=1, description="Stable internal building ID (e.g. 'BLDG-SOC001-A')")
    society_id: str = Field(..., min_length=1, description="Parent society identifier")
    parcel_id: str = Field(..., min_length=1, description="Parent parcel identifier")
    building_name: Optional[str] = Field(default=None, description="Building or tower name/label")
    official_ulpin: Optional[str] = Field(
        default=None, 
        description="Official ULPIN issued by authority (null unless verified official issuance mechanism exists)"
    )
    footprint: Dict[str, Any] = Field(..., description="GeoJSON Polygon of the building footprint in EPSG:4326")
    area_sqm: float = Field(..., gt=0.0, description="Metric footprint area in square metres (projected CRS)")
    height: BuildingHeight = Field(..., description="Building height with explicit source and precision")
    floor_count: int = Field(..., gt=0, description="Total above-ground floors")
    floor_count_source: str = Field(default="estimated", description="Source of floor count")
    built_up_area_sqm: float = Field(..., gt=0.0, description="Total built-up area in square metres (footprint * floors)")
    detector_provenance: Dict[str, Any] = Field(
        default_factory=dict, 
        description="Provenance of detection (detector_name, version, confidence, uncertainty)"
    )
    units: List[UnitRecord] = Field(default_factory=list, description="List of internal cadastral unit records")
    floors: List[FloorRecord] = Field(default_factory=list, description="Floor records hierarchy")
    validation: Dict[str, Any] = Field(default_factory=dict, description="Spatial validation log")
    is_within_boundary: bool = Field(default=True, description="Whether the building is strictly within the society parcel")


class SocietyProcessResponse(BaseModel):
    """
    Unified response contract for processing a multi-building residential society.
    """
    status: Literal["success", "partial_success", "error"] = Field(..., description="Response status")
    society_id: str = Field(..., min_length=1)
    parcel_id: str = Field(..., min_length=1)
    society_name: Optional[str] = None
    crs: str = Field(default="EPSG:4326", description="Coordinate reference system")
    boundary: Dict[str, Any] = Field(..., description="Society parcel boundary GeoJSON")
    total_society_area_sqm: float = Field(..., gt=0.0, description="Total parcel area in square metres")
    total_footprint_area_sqm: float = Field(default=0.0, ge=0.0, description="Sum of all building footprint areas")
    total_built_up_area_sqm: float = Field(default=0.0, ge=0.0, description="Sum of all building built-up areas")
    ground_coverage_ratio: float = Field(default=0.0, ge=0.0, le=1.0, description="Footprint area / society area")
    ground_coverage_pct: float = Field(default=0.0, ge=0.0, le=100.0, description="Ground coverage percentage")
    buildings_detected_count: int = Field(default=0, ge=0, description="Number of valid detected buildings")
    buildings: List[BuildingRecord] = Field(default_factory=list, description="Processed building records")
    excluded_buildings: List[Dict[str, Any]] = Field(
        default_factory=list, 
        description="Candidate footprints excluded (e.g. outside boundary) with reason"
    )
    official_ulpin: Optional[str] = Field(default=None, description="Official society-level ULPIN (null unless verified)")
    warnings: List[str] = Field(default_factory=list)
    errors: List[str] = Field(default_factory=list)
    execution_metadata: Dict[str, Any] = Field(default_factory=dict)

