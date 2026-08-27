export interface GeoJSONPolygon {
  type: "Polygon";
  coordinates: number[][][];
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
  centroid?: [number, number]; // [lat, lng] or [lng, lat]
  polygon_2d?: GeoJSONPolygon;
  status?: string;
  owner?: string;
  use_type?: string;
}

export interface SpatialValidation {
  valid: boolean;
  overlaps_detected: boolean;
  overlapping_units?: [string, string][];
  out_of_bounds?: string[];
  errors?: string[];
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
