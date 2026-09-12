export interface GeoJSONPolygon {
  type: "Polygon";
  coordinates: number[][][];
}

export interface Extrusion3D {
  type: "Building3D";
  footprint?: GeoJSONPolygon;
  z_min: number;
  z_max: number;
  floor_height_m: number;
  floor_count: number;
  volume_m3?: number;
}

export interface Unit {
  unit_id: string;
  ulpin: string;
  /** Primary floor field returned by backend */
  floor: number;
  /** Alias for floor — used in some legacy components */
  floor_number?: number;
  unit_name?: string;
  unit_number?: string;
  z_min?: number | null;
  z_max?: number | null;
  floor_height_m?: number;
  area_sqm?: number;
  area_sqft?: number;
  centroid?: [number, number]; // [lat, lon]
  polygon_2d?: GeoJSONPolygon | any;
  status?: string;
  owner?: string;
  use_type?: string;
}

export interface ValidationError {
  unit_id: string;
  type: "OVERLAP" | "OUT_OF_BOUNDS";
  description: string;
}

export interface SpatialValidation {
  valid?: boolean;
  is_valid?: boolean;
  overlaps_detected: boolean;
  confidence_score?: number;
  out_of_bounds_count?: number;
  overlapping_units?: [string, string][];
  out_of_bounds?: string[];
  errors?: (string | ValidationError)[];
}

export interface ValidationResult {
  building_id: string;
  is_valid: boolean;
  overlaps_detected: number;
  out_of_bounds: number;
  confidence_score: number;
  errors: string[];
}

export interface UndergroundUnit {
  ulpin: string;
  type: 'basement' | 'parking' | 'utility' | 'metro' | string;
  title?: string;
  subsurface_zone?: string;
  level: number; // negative: -1, -2, ...
  volume_m3: number;
  depth_range: [number, number];
  coordinates: [number, number]; // [lat, lon]
}

export interface UtilityInfo {
  ulpin?: string;
  type: 'water' | 'sewage' | 'power' | 'telecom' | 'gas' | string;
  title?: string;
  depth_m: number;
  diameter_mm: number;
  capacity: number;
  conflicts: number;
  path?: [number, number, number][]; // [(lat, lon, depth), ...]
}

export interface UndergroundData {
  basement_levels: number;
  parking_spaces: number;
  total_volume_m3: number;
  max_depth_m: number;
  utilities_mapped: number;
  underground_ulpins: number;
  validation_score: number;
  ulpin_details: UndergroundUnit[];
  utilities: UtilityInfo[];
  validation_issues: any[];
}

export interface BuildingPart {
  id: string;
  part_type?: string;
  footprint: GeoJSONPolygon | any;
  height: number;
  min_height?: number;
  levels?: number;
  min_levels?: number;
  roof_shape?: string;
  roof_height?: number;
  material?: string;
  color?: string;
  tags?: Record<string, any>;
}

export interface RoofInfo {
  shape?: string;
  height?: number;
  levels?: number;
  material?: string;
  color?: string;
}

export interface AssessmentInfo {
  land_use?: string;
  built_up_area_sqm?: number;
  floor_area_sqm?: number;
  parcel_area_sqm?: number;
  occupancy_type?: string;
  construction_type?: string;
  building_material?: string;
  record_status?: string;
  permit_status?: string;
  assessment_value?: string;
  spatial_validation_status?: string;
  basement_levels?: number;
  basement_use?: string;
  basement_source?: string;
}

export type DomeShapeType = 'hemisphere' | 'ellipsoid' | 'onion' | 'shallow_dome' | 'cupola';

export interface DomeElement {
  type: 'dome';
  position?: { x: number; y: number; z: number };
  relativePosition?: [number, number]; // [relX, relZ] normalized 0..1
  radius?: number;
  radiusX?: number;
  radiusZ?: number;
  height: number;
  baseElevation?: number;
  shape: DomeShapeType;
  hasDrum?: boolean;
  drumRadius?: number;
  drumHeight?: number;
  drumSides?: number;
  hasFinial?: boolean;
  finialHeight?: number;
  finialStyle?: 'spire' | 'kalash' | 'cross' | 'crescent' | 'pin';
  diameterRatio?: number;
  heightRatio?: number;
  confidence: number;
  source?: string;
}

export interface ArchElement {
  type: 'arch';
  position?: { x: number; y: number; z: number };
  relativePosition?: [number, number, number]; // [relX, relY, relZ]
  width: number;
  height: number;
  depth?: number;
  springHeight?: number;
  orientation?: 'front' | 'rear' | 'left' | 'right' | number;
  wallThickness?: number;
  isOpening?: boolean;
  confidence: number;
  source?: string;
}

export type ArchitecturalElement = DomeElement | ArchElement | {
  type: 'drum' | 'spire' | 'minaret' | 'tower' | 'finial';
  [key: string]: any;
};

export interface RoofElementDetection {
  type: 'dome' | 'spire' | 'parapet' | 'arch';
  shape?: DomeShapeType;
  relativePosition?: [number, number];
  diameterRatio?: number;
  heightRatio?: number;
  hasDrum?: boolean;
  hasFinial?: boolean;
  confidence: number;
}

export interface MultiViewAnalysisResult {
  massLayout: {
    shape: string;
    confidence: number;
    aspectRatioApprox?: number;
  };
  floors: {
    value: number;
    source: string;
    estimated: boolean;
    confidence: number;
  };
  facadeModules: {
    repeatingBays: boolean;
    bayCountApprox: number;
    windowRows: number;
    confidence: number;
  };
  sideTower: {
    present: boolean;
    relativePosition: string;
    relativeHeight: number;
    widthRatio: number;
    confidence: number;
  };
  horizontalBands: {
    present: boolean;
    levels: number[];
  };
  groundFloor: {
    glazing: boolean;
    entranceZones: string[];
  };
  roof: {
    shape: string;
    raisedElements: string[];
    possibleSolarPanels: boolean;
  };
  roofElements?: RoofElementDetection[];
  architecturalElements?: ArchitecturalElement[];
  provenance?: {
    source: string;
    imageCount?: number;
    analyzedAt?: string;
    cached?: boolean;
  };
}

export interface Building {
  status?: string;
  building_id: string;
  parcel_id: string;
  ulpin?: string;
  aerial_image_url?: string;
  building_name?: string;
  address?: string;
  latitude?: number;
  longitude?: number;
  footprint?: GeoJSONPolygon | any;
  parcel_boundary?: GeoJSONPolygon | any;
  height_meters?: number;
  height?: number;
  floor_height_m?: number;
  floor_count: number;
  total_units?: number;
  extrusion_3d?: Extrusion3D;
  units: Unit[];
  validation?: SpatialValidation;
  created_at?: string;
  underground?: UndergroundData;
  building_parts?: BuildingPart[];
  roof?: RoofInfo;
  assessment?: AssessmentInfo;
  floor_source?: string;
  is_floor_estimated?: boolean;
  underground_floors?: number;
  basement_count?: number;
  basement_use?: string;
  basement_source?: string;
  built_up_area_sqm?: number;
  building_material?: string;
  building_color?: string;
  land_use?: string;
  osm_id?: string;
  raw_osm_data?: any;
  gemini_vision_data?: any;
  reference_images?: string[];
  multiview_analysis?: MultiViewAnalysisResult;
  vision_multiview?: boolean;
  architectural_elements?: ArchitecturalElement[];
  architecturalElements?: ArchitecturalElement[];
}

export interface AutoDetectBuildingPayload {
  building_name: string;
  city?: string;
}

export interface AutoDetectBuildingResult {
  building_name: string;
  city: string;
  latitude: number;
  longitude: number;
  height_meters: number | null;
  floors: number | null;
  confidence: number;
  source: string;
  osm_id?: string | null;
  wikidata?: string | null;
  building_type?: string | null;
}

export interface CreateBuildingPayload {
  parcel_id: string;
  building_name?: string;
  address?: string;
  latitude?: number;
  longitude?: number;
  aerial_image_url?: string;
  height_meters: number;
  floor_count: number;
  parcel_boundary?: GeoJSONPolygon | any;
  osm_id?: string | null;
}

export interface JobStatus {
  job_id: string;
  status: 'pending' | 'processing' | 'completed' | 'done' | 'failed';
  progress_pct: number;
  progress_step?: string;
  step?: string;
  building_id?: string;
  error_message?: string;
}

export interface JobStatusResponse {
  status: "processing" | "done" | "failed" | "completed" | "pending";
  progress_pct: number;
  step?: string;
  progress_step?: string;
  building_id?: string;
  error_message?: string;
  result_data?: { building_id?: string };
}

export interface PresetBuilding {
  name: string;
  parcel_id: string;
  address: string;
  height_meters: number;
  floor_count: number;
  lat: number;
  lon: number;
}

export type GeometryQualityLevel = 'HIGH' | 'DETAILED' | 'STANDARD' | 'BASIC' | 'ESTIMATED';

export type GeometryProviderSource =
  | 'CUSTOM_MODEL'
  | 'OSM2WORLD'
  | 'OSM_BUILDING_PARTS'
  | 'VISION_RECONSTRUCTION'
  | 'OSM_FOOTPRINT'
  | 'CONSERVATIVE_FALLBACK';

export interface ResolvedPlace {
  canonicalName: string;
  latitude: number;
  longitude: number;
  boundingBox: [number, number, number, number]; // [minLon, minLat, maxLon, maxLat]
  osmType?: 'node' | 'way' | 'relation';
  osmId?: string; // e.g. "relation/6072622" or "way/1238914562"
  placeType?: string;
  address: string;
  rawTags?: Record<string, string>;
  category?: string;
}

export interface LandmarkSite {
  mainStructure?: any;
  relatedStructures: any[];
  siteBoundary?: any;
  courtyards: any[];
  accessStructures: any[];
  tags?: Record<string, string>;
}

export interface BuildingPartData extends BuildingPart {
  source: string;
  holes?: any[];
  roof_levels?: number;
  roof_direction?: number;
  roof_orientation?: string;
  roof_material?: string;
  roof_color?: string;
}

export interface UnifiedBuildingData {
  id: string;
  canonicalName: string;
  osmId?: string;
  latitude: number;
  longitude: number;
  sourceProvider: GeometryProviderSource;
  qualityLevel: GeometryQualityLevel;
  confidence: number;
  footprint?: GeoJSONPolygon | any;
  holes?: any[];
  buildingParts: BuildingPartData[];
  siteData?: LandmarkSite;
  height: number;
  levels: number;
  minHeight?: number;
  floorHeight?: number;
  roofData?: {
    shape: string;
    height: number;
    levels?: number;
    material?: string;
    color?: string;
    direction?: number;
  };
  material?: string;
  color?: string;
  tags?: Record<string, any>;
  sourceMetadata: {
    osmId?: string;
    providerName: string;
    meshCount?: number;
    partCount?: number;
    license?: string;
    qualityLevel: GeometryQualityLevel;
    timestamp?: number;
  };
  estimatedFields: string[];
  boundingBox3D?: {
    minX: number; minY: number; minZ: number;
    maxX: number; maxY: number; maxZ: number;
  };
  customModelUrl?: string;
}

export interface ProviderReconstructionResult {
  providerName: GeometryProviderSource;
  qualityLevel: GeometryQualityLevel;
  confidence: number;
  estimatedFields: string[];
  group?: any; // THREE.Group
  meshes?: any[]; // THREE.Mesh[]
  buildingPartsCount: number;
  meshCount: number;
  roofShapes: string[];
  fallbackUsed: boolean;
  statusMessage: string;
  modelUrl?: string;
}

export interface InferredArchitecturalMetadata {
  confidence: number;
  building_type?: string;
  roof_shape?: string;
  architectural_form?: string;
  suggested_material?: string;
  tower_probability?: number;
  symmetry?: string;
  inferred_fields: string[];
  reasoning?: string;
  provenance: {
    source: string;
    model?: string;
    cached?: boolean;
    status?: string;
  };
}

export interface InferredMetadataRequest {
  osm_id?: string;
  building_name?: string;
  osm_tags?: Record<string, any>;
  footprint_metrics?: {
    area_sqm: number;
    circularity: number;
    aspect_ratio: number;
    vertex_count: number;
    has_holes: boolean;
    is_symmetric: boolean;
  };
  building_parts_count?: number;
  known_height?: number;
  known_levels?: number;
  known_roof_shape?: string;
  known_building_type?: string;
  known_material?: string;
}

export type ThreeMaterialMode = 'UNIFIED' | 'SOURCE';
