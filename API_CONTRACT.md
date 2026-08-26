# API Contract - 3D ULPIN MVP

## 1. AI Module Output (Harsh)

### Input
```json
{
  "aerial_image_path": "string (path to aerial image)",
  "parcel_boundary": "GeoJSON.Polygon",
  "height_meters": "float",
  "floor_count": "int"
}
```

### Output
```json
{
  "status": "success",
  "building_id": "uuid",
  "footprint": "GeoJSON.Polygon",
  "height": 45.0,
  "floor_count": 15,
  "extrusion_3d": "CityJSON/GeoJSON-3D format",
  "units": [
    {
      "unit_id": "UNIT_F1_A01",
      "floor": 1,
      "floor_height_m": 3.0,
      "polygon_2d": "GeoJSON.Polygon",
      "centroid": [28.5921, 77.0490],
      "ulpin": "PARCEL_001-BLDG_001-F01-U01-2857739"
    }
  ],
  "validation": {
    "overlaps_detected": false,
    "overlapping_units": [],
    "out_of_bounds": [],
    "valid": true
  }
}
```

## 2. Backend API Endpoints (Prateek)

### POST /api/buildings/create
**Request:**
```json
{
  "parcel_id": "PARCEL_001",
  "aerial_image_url": "https://...",
  "height": 45.0,
  "floor_count": 15
}
```

**Response:**
```json
{
  "building_id": "uuid",
  "status": "processing"
}
```

### GET /api/buildings/{building_id}
**Response:** Full building object with units

### GET /api/buildings/{building_id}/units
**Response:** Array of unit objects

### GET /api/validation/{building_id}
**Response:**
```json
{
  "valid": true,
  "overlaps": [],
  "errors": []
}
```

## 3. Frontend Requirements (Rishabh)

- Expects GeoJSON/CityJSON from `/api/buildings/{id}`
- Renders 3D building with CesiumJS
- Interactive unit selection
- ULPIN display on click