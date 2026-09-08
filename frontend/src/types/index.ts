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
  floor?: number;
  floor_number: number;
  unit_name?: string;
  z_min: number;
  z_max: number;
  floor_height_m?: number;
  area_sqm?: number;
  area_sqft?: number;
  centroid?: [number, number]; // [lon, lat] or [lat, lng]
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
  footprint: GeoJSONPolygon | any;
  height: number;
  min_height?: number;
  levels?: number;
  min_levels?: number;
  roof_shape?: string;
  roof_height?: number;
  material?: string;
  color?: string;
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
  height_meters?: number;
  height?: number;
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
  built_up_area_sqm?: number;
  building_material?: string;
  building_color?: string;
  land_use?: string;
}

export interface AutoDetectBuildingPayload {
  building_name: string;
  city: string;
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
