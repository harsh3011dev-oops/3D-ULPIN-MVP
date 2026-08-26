# 🤖 AI Module Blueprint — 3D ULPIN MVP
**Developer**: Harsh | **Branch**: `feature/ai-module` | **Deadline**: Day 6

---

## 1. 🎯 Your Responsibility

As the AI Module Developer, you are the **brain** of the 3D ULPIN system. You take a raw aerial image of a land parcel plus metadata (height, floor count, boundary polygon) and transform it into a structured 3D representation — detecting the building footprint, extruding it into a 3D solid, slicing it into floors, subdividing each floor into units, assigning a globally unique ULPIN to every unit, and finally validating that no spatial conflicts exist. Your output JSON is what the Backend stores and the Frontend renders.

---

## 2. 📥 Input Format

The AI module receives the following input (as a Python `dict` or JSON):

```json
{
  "aerial_image_path": "string — absolute path to aerial .jpg/.tif image",
  "parcel_boundary": {
    "type": "Polygon",
    "coordinates": [[[77.049, 28.592], [77.050, 28.592], [77.050, 28.593], [77.049, 28.592]]]
  },
  "height_meters": 45.0,
  "floor_count": 15,
  "parcel_id": "PARCEL_001",
  "building_id": "uuid-string"
}
```

| Field | Type | Description |
|-------|------|-------------|
| `aerial_image_path` | `str` | Path to aerial/satellite image of the parcel |
| `parcel_boundary` | `GeoJSON Polygon` | Legal boundary of the land parcel |
| `height_meters` | `float` | Total building height in meters |
| `floor_count` | `int` | Number of floors in the building |
| `parcel_id` | `str` | Unique parcel identifier from land records |
| `building_id` | `str` (UUID) | Pre-generated UUID from Backend |

---

## 3. 📤 Output Format

Your module returns a Python `dict` matching this structure:

```json
{
  "status": "success",
  "building_id": "uuid-string",
  "footprint": {
    "type": "Polygon",
    "coordinates": [[[77.049, 28.592], [77.0495, 28.5925], [77.050, 28.592]]]
  },
  "height": 45.0,
  "floor_count": 15,
  "extrusion_3d": {
    "type": "Building3D",
    "z_min": 0.0,
    "z_max": 45.0,
    "floor_height_m": 3.0
  },
  "units": [
    {
      "unit_id": "UNIT_F01_A01",
      "floor": 1,
      "floor_height_m": 3.0,
      "z_min": 0.0,
      "z_max": 3.0,
      "polygon_2d": { "type": "Polygon", "coordinates": [[[]]] },
      "centroid": [28.5921, 77.0490],
      "ulpin": "PARCEL_001-BLDG001A-F01-UA01-ttnfv1h",
      "area_sqm": 75.4
    }
  ],
  "validation": {
    "overlaps_detected": false,
    "overlapping_units": [],
    "out_of_bounds": [],
    "valid": true,
    "errors": []
  }
}
```

---

## 4. 📁 Folder Structure

```
ai/
├── AI_BLUEPRINT.md              ← This file
├── footprint_detection.py       ← Building boundary detection from aerial image
├── extrusion.py                 ← 2D footprint → 3D solid geometry
├── floor_division.py            ← Divide building into floors, floors into units
├── ulpin_generation.py          ← Generate unique ULPIN strings
├── spatial_validation.py        ← Detect overlaps & boundary violations
├── pipeline.py                  ← Master orchestrator: runs all steps in order
├── utils/
│   ├── __init__.py
│   ├── geo_utils.py             ← Coordinate transforms, GeoJSON helpers
│   ├── image_utils.py           ← Image loading, preprocessing, resizing
│   └── logging_utils.py         ← Structured logging setup
├── sample_data/
│   ├── test_image_1.jpg         ← Rectangular building test image
│   ├── test_image_2.jpg         ← Irregular/L-shaped building test image
│   └── expected_outputs/
│       ├── output_building_1.json
│       └── output_building_2.json
├── tests/
│   ├── __init__.py
│   ├── test_footprint.py
│   ├── test_extrusion.py
│   ├── test_floor_division.py
│   ├── test_ulpin.py
│   ├── test_validation.py
│   └── test_pipeline.py         ← End-to-end pipeline test
├── requirements.txt
└── README.md
```

---

## 5. ⚙️ 6 Key Functions

### Function 1: `detect_building_footprint()`
**File**: `footprint_detection.py`

```python
import cv2
import numpy as np
import rasterio
from rasterio.transform import xy

def detect_building_footprint(
    image_path: str,
    parcel_boundary: dict,
    debug: bool = False
) -> dict:
    """
    Detect the building footprint from an aerial image.

    Uses OpenCV contour detection to find the largest building-shaped
    polygon within the given parcel boundary. Converts pixel coordinates
    to geographic coordinates (EPSG:4326) using rasterio transform.

    Args:
        image_path (str): Absolute path to the aerial image (.jpg or .tif).
        parcel_boundary (dict): GeoJSON Polygon of the parcel legal boundary.
        debug (bool): If True, saves intermediate images for debugging.

    Returns:
        dict: GeoJSON Polygon representing the detected building footprint.

    Raises:
        FileNotFoundError: If image_path does not exist.
        ValueError: If no building contour is detected in the image.
    """
    image = cv2.imread(image_path)
    if image is None:
        raise FileNotFoundError(f"Image not found: {image_path}")

    gray = cv2.cvtColor(image, cv2.COLOR_BGR2GRAY)
    blurred = cv2.GaussianBlur(gray, (5, 5), 0)
    edges = cv2.Canny(blurred, threshold1=50, threshold2=150)

    contours, _ = cv2.findContours(edges, cv2.RETR_EXTERNAL, cv2.CHAIN_APPROX_SIMPLE)
    if not contours:
        raise ValueError("No building contour detected in image.")

    largest_contour = max(contours, key=cv2.contourArea)
    epsilon = 0.02 * cv2.arcLength(largest_contour, True)
    approx = cv2.approxPolyDP(largest_contour, epsilon, True)

    pixel_coords = approx.reshape(-1, 2).tolist()
    geo_coords = _pixels_to_geo(pixel_coords, image_path)

    return {"type": "Polygon", "coordinates": [geo_coords]}


def _pixels_to_geo(pixel_coords: list, image_path: str) -> list:
    """Convert pixel coordinates to geographic (lat/lng) coordinates."""
    try:
        with rasterio.open(image_path) as src:
            transform = src.transform
            return [list(xy(transform, py, px, offset='center')) for px, py in pixel_coords]
    except Exception:
        # Fallback for non-georeferenced images
        return [[float(px) / 1000.0, float(py) / 1000.0] for px, py in pixel_coords]
```

---

### Function 2: `extrude_building()`
**File**: `extrusion.py`

```python
from shapely.geometry import shape

def extrude_building(
    footprint: dict,
    height_meters: float,
    floor_count: int
) -> dict:
    """
    Convert a 2D building footprint into a 3D extrusion representation.

    Takes the 2D footprint polygon and adds Z-axis information to create
    a volumetric 3D model with z_min (ground) and z_max (roof) values.

    Args:
        footprint (dict): GeoJSON Polygon of the building footprint.
        height_meters (float): Total building height in meters above ground.
        floor_count (int): Total number of floors.

    Returns:
        dict: 3D extrusion object with footprint, z_min, z_max, floor_height.

    Raises:
        ValueError: If height_meters <= 0 or floor_count <= 0.
    """
    if height_meters <= 0:
        raise ValueError(f"height_meters must be positive, got {height_meters}")
    if floor_count <= 0:
        raise ValueError(f"floor_count must be positive, got {floor_count}")

    floor_height = round(height_meters / floor_count, 2)
    poly = shape(footprint)
    volume_approx = round(poly.area * (111_000 ** 2) * height_meters, 2)

    return {
        "type": "Building3D",
        "footprint": footprint,
        "z_min": 0.0,
        "z_max": height_meters,
        "floor_height_m": floor_height,
        "floor_count": floor_count,
        "volume_m3": volume_approx
    }
```

---

### Function 3: `divide_into_floors()`
**File**: `floor_division.py`

```python
def divide_into_floors(
    footprint: dict,
    height_meters: float,
    floor_count: int
) -> list:
    """
    Divide a 3D building extrusion into individual floor slabs.

    Each floor is the footprint polygon with z_min and z_max defining
    its vertical extent. Ground floor starts at z=0.

    Args:
        footprint (dict): GeoJSON Polygon of the building footprint.
        height_meters (float): Total building height in meters.
        floor_count (int): Number of floors to divide into.

    Returns:
        list: Floor dicts — [{floor_number, label, z_min, z_max, floor_height_m, footprint}]

    Example:
        >>> floors = divide_into_floors(footprint, 9.0, 3)
        >>> floors[0]["z_min"], floors[0]["z_max"]
        (0.0, 3.0)
    """
    floor_height = height_meters / floor_count
    floors = []

    for i in range(floor_count):
        label = "G" if i == 0 else f"{i}F"
        floors.append({
            "floor_number": i + 1,
            "label": label,
            "z_min": round(i * floor_height, 2),
            "z_max": round((i + 1) * floor_height, 2),
            "floor_height_m": round(floor_height, 2),
            "footprint": footprint
        })

    return floors
```

---

### Function 4: `divide_floor_into_units()`
**File**: `floor_division.py`

```python
from shapely.geometry import shape, mapping, box
from shapely.ops import unary_union
import numpy as np

def divide_floor_into_units(
    floor: dict,
    units_per_floor: int = 4
) -> list:
    """
    Subdivide a floor polygon into individual property units (grid-based MVP).

    Divides the floor footprint into a uniform grid of `units_per_floor`
    rectangles. Each subdivision gets a unique label (A01, A02, B01, ...).

    Args:
        floor (dict): Floor dict from divide_into_floors() output.
        units_per_floor (int): Number of units per floor (default 4).

    Returns:
        list: Unit dicts — [{unit_id, floor, label, polygon_2d, centroid, area_sqm, z_min, z_max}]

    Notes:
        MVP uses simple grid subdivision. Future: integrate actual floor plans.
    """
    footprint_shape = shape(floor["footprint"])
    minx, miny, maxx, maxy = footprint_shape.bounds
    floor_number = floor["floor_number"]

    cols = max(1, int(np.ceil(np.sqrt(units_per_floor))))
    rows = max(1, int(np.ceil(units_per_floor / cols)))
    cell_w = (maxx - minx) / cols
    cell_h = (maxy - miny) / rows

    units = []
    unit_num = 0

    for row in range(rows):
        for col in range(cols):
            if unit_num >= units_per_floor:
                break

            x0, y0 = minx + col * cell_w, miny + row * cell_h
            unit_poly = box(x0, y0, x0 + cell_w, y0 + cell_h).intersection(footprint_shape)

            if unit_poly.is_empty:
                continue

            label = f"{chr(65 + col)}{row + 1:02d}"
            centroid = unit_poly.centroid
            units.append({
                "unit_id": f"UNIT_F{floor_number:02d}_{label}",
                "floor": floor_number,
                "label": label,
                "polygon_2d": mapping(unit_poly),
                "centroid": [centroid.y, centroid.x],
                "area_sqm": round(unit_poly.area * (111_000 ** 2), 2),
                "z_min": floor["z_min"],
                "z_max": floor["z_max"]
            })
            unit_num += 1

    return units
```

---

### Function 5: `generate_ulpin()`
**File**: `ulpin_generation.py`

```python
import pygeohash as geohash

def generate_ulpin(
    parcel_id: str,
    building_id: str,
    floor_number: int,
    unit_label: str,
    centroid: list
) -> str:
    """
    Generate a globally unique 3D ULPIN (Unique Land Parcel Identification Number).

    Format: {PARCEL_ID}-{BLDG_SHORT}-F{FLOOR:02d}-U{UNIT}-{GEOHASH}

    The geohash (7 chars, ~76m precision) ensures geographic uniqueness
    even if two buildings share the same parcel/floor/unit labels.

    Args:
        parcel_id (str): Parcel identifier, e.g. "PARCEL_001".
        building_id (str): Building UUID.
        floor_number (int): Floor number (1-indexed).
        unit_label (str): Unit label within floor, e.g. "A01".
        centroid (list): [latitude, longitude] of the unit centroid.

    Returns:
        str: ULPIN string, e.g. "PARCEL_001-BLDGA1B2C3D4-F01-UA01-ttnfv1h"

    Example:
        >>> ulpin = generate_ulpin("PARCEL_001", "uuid-abc", 1, "A01", [28.592, 77.049])
        "PARCEL_001-UUIDABC0-F01-UA01-ttnfv1h"
    """
    bldg_short = building_id.replace("-", "").upper()[:8]
    geo_hash = geohash.encode(centroid[0], centroid[1], precision=7)
    return f"{parcel_id}-{bldg_short}-F{floor_number:02d}-U{unit_label}-{geo_hash}"


def validate_ulpin_format(ulpin: str) -> bool:
    """Validate that a ULPIN string follows the expected format."""
    parts = ulpin.split("-")
    if len(parts) < 5:
        return False
    floor_part = parts[2]
    return floor_part.startswith("F") and floor_part[1:].isdigit()
```

---

### Function 6: `validate_spatial_data()`
**File**: `spatial_validation.py`

```python
from shapely.geometry import shape

def validate_spatial_data(
    units: list,
    building_footprint: dict
) -> dict:
    """
    Validate spatial correctness of all generated units.

    Performs two checks:
    1. OVERLAP CHECK: No two units on the same floor should overlap.
    2. BOUNDARY CHECK: Every unit must be within the building footprint.

    Args:
        units (list): List of unit dicts from divide_floor_into_units().
        building_footprint (dict): GeoJSON Polygon of the building footprint.

    Returns:
        dict: {valid, overlaps_detected, overlapping_units, out_of_bounds, errors}

    Example:
        >>> result = validate_spatial_data(units, footprint)
        >>> result["valid"]
        True
    """
    building_shape = shape(building_footprint)
    errors = []
    overlapping_pairs = []
    out_of_bounds = []

    # Group units by floor
    floors_map = {}
    for unit in units:
        floors_map.setdefault(unit["floor"], []).append(unit)

    # Check 1: Overlaps within same floor
    for floor_num, floor_units in floors_map.items():
        for i in range(len(floor_units)):
            for j in range(i + 1, len(floor_units)):
                s_i = shape(floor_units[i]["polygon_2d"])
                s_j = shape(floor_units[j]["polygon_2d"])
                if s_i.intersects(s_j) and s_i.intersection(s_j).area > 1e-10:
                    overlapping_pairs.append([floor_units[i]["unit_id"], floor_units[j]["unit_id"]])
                    errors.append({
                        "unit_id": floor_units[i]["unit_id"],
                        "type": "OVERLAP",
                        "description": f"Overlaps with {floor_units[j]['unit_id']} on floor {floor_num}"
                    })

    # Check 2: Units within building boundary
    for unit in units:
        if not building_shape.contains(shape(unit["polygon_2d"])):
            out_of_bounds.append(unit["unit_id"])
            errors.append({
                "unit_id": unit["unit_id"],
                "type": "OUT_OF_BOUNDS",
                "description": "Unit extends beyond building footprint boundary"
            })

    return {
        "valid": len(errors) == 0,
        "overlaps_detected": len(overlapping_pairs) > 0,
        "overlapping_units": overlapping_pairs,
        "out_of_bounds": out_of_bounds,
        "errors": errors
    }
```

---

## 6. 🔄 Pipeline Workflow

```
process_building(input_dict)
        │
        ▼
[1] Load & preprocess image (resize to max 1024×1024)
        │
        ▼
[2] detect_building_footprint()  → GeoJSON Polygon
        │
        ▼
[3] extrude_building()           → Building3D dict
        │
        ▼
[4] divide_into_floors()         → [floor_1, floor_2, ..., floor_N]
        │
        ▼
[5] divide_floor_into_units()    → all_units[] (for every floor)
        │
        ▼
[6] generate_ulpin()             → attach ulpin to each unit
        │
        ▼
[7] validate_spatial_data()      → validation report
        │
        ▼
[8] Assemble & return output dict → Backend stores it
```

---

## 7. ✅ Testing Checklist

```
ai/tests/
├── test_footprint.py
│   ├── [ ] test_footprint_from_valid_image()
│   ├── [ ] test_footprint_area_positive()
│   ├── [ ] test_footprint_invalid_image_raises()
│   └── [ ] test_coordinates_in_epsg4326()
│
├── test_extrusion.py
│   ├── [ ] test_z_max_equals_height()
│   ├── [ ] test_floor_height_calculation()
│   └── [ ] test_negative_height_raises_valueerror()
│
├── test_floor_division.py
│   ├── [ ] test_floor_count_matches_input()
│   ├── [ ] test_floors_are_contiguous()
│   ├── [ ] test_unit_count_per_floor()
│   └── [ ] test_no_unit_overlap_on_same_floor()
│
├── test_ulpin.py
│   ├── [ ] test_ulpin_format_is_valid()
│   ├── [ ] test_100_units_all_unique()
│   └── [ ] test_ulpin_contains_floor_number()
│
├── test_validation.py
│   ├── [ ] test_clean_units_pass_validation()
│   ├── [ ] test_overlapping_units_flagged()
│   └── [ ] test_out_of_bounds_units_flagged()
│
└── test_pipeline.py
    ├── [ ] test_full_pipeline_success_status()
    ├── [ ] test_output_has_required_keys()
    └── [ ] test_all_ulpins_unique_in_output()
```

**Run:**
```bash
cd ai
pytest tests/ -v --cov=. --cov-report=term-missing
# Target: > 90% coverage
```

---

## 8. 🔗 Integration Points with Backend

| Point | Direction | How |
|-------|-----------|-----|
| Trigger AI | Backend → AI | `from ai.pipeline import process_building` |
| Return output | AI → Backend | `return output_dict` |
| Error signal | AI → Backend | `raise ProcessingError(message)` |

**Your `pipeline.py` must export:**
```python
def process_building(input_data: dict) -> dict:
    """Main entry point called by Backend."""
    # Run all 6 steps, return assembled output
    ...
```

---

## 9. 📦 Deliverables by Day 6

| Day | Task | Done |
|-----|------|------|
| Day 1 | Setup venv, install packages, test rasterio on sample image | `[ ]` |
| Day 2 | Stub `pipeline.py` returning hardcoded output (Backend unblocked) | `[ ]` |
| Day 3 | Implement `footprint_detection.py` with real OpenCV logic | `[ ]` |
| Day 4 | Implement `extrusion.py` + `floor_division.py` | `[ ]` |
| Day 5 | Implement `ulpin_generation.py` + `spatial_validation.py` | `[ ]` |
| Day 6 | Wire all into `pipeline.py`, run full end-to-end, open Draft PR | `[ ]` |

**requirements.txt:**
```
opencv-python==4.9.0.80
rasterio==1.3.9
shapely==2.0.3
pyproj==3.6.1
numpy==1.26.4
pygeohash==1.2.0
scikit-image==0.22.0
pytest==8.1.1
pytest-cov==5.0.0
```

---

*Blueprint Version: 1.0 | Last Updated: Day 1*
