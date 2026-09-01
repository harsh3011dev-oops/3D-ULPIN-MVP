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
  valid: boolean;
  overlaps_detected: boolean;
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

export interface Building {
  status?: string;
  building_id: string;
  parcel_id: string;
  aerial_image_url?: string;
  building_name?: string;
  address?: string;
  footprint?: GeoJSONPolygon | any;
  height_meters?: number;
  height?: number;
  floor_count: number;
  total_units?: number;
  extrusion_3d?: Extrusion3D;
  units: Unit[];
  validation?: SpatialValidation;
  created_at?: string;
}

export interface CreateBuildingPayload {
  parcel_id: string;
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
