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
  floor_number: number;
  unit_name?: string;
  z_min: number;
  z_max: number;
  floor_height_m?: number;
  area_sqm?: number;
  centroid?: [number, number]; // [lat, lng]
  polygon_2d?: GeoJSONPolygon;
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

export interface Building {
  status: string;
  building_id: string;
  parcel_id: string;
  aerial_image_url?: string;
  building_name?: string;
  address?: string;
  footprint?: GeoJSONPolygon;
  height: number;
  floor_count: number;
  total_units?: number;
  extrusion_3d?: Extrusion3D;
  units: Unit[];
  validation?: SpatialValidation;
  created_at?: string;
}

export interface CreateBuildingPayload {
  parcel_id: string;
  aerial_image_url: string;
  height_meters: number;
  floor_count: number;
  parcel_boundary: GeoJSONPolygon;
}

export interface JobStatusResponse {
  status: "processing" | "done" | "failed";
  progress_pct: number;
  step?: string;
  building_id?: string;
  error_message?: string;
}
