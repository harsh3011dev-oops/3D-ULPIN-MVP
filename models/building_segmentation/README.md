# 3D-ULPIN-MVP: Building Instance Segmentation Model Package

**Target Repository:** [https://github.com/harsh3011dev-oops/3D-ULPIN-MVP.git](https://github.com/harsh3011dev-oops/3D-ULPIN-MVP.git)  
**Package Name:** `ulpin_building_segmentation_model`  
**Model Architecture:** `YOLO11s-seg` (10,067,203 parameters)  
**Trained Weights:** `weights/best.pt`  
**Verified SHA-256:** `9e649fbdf265420f1dd30899935d60df70c7961a716b3f432d978d7c0bbfb02b`  
**Package Version:** `1.0.0`  

---

## 1. Overview

This package contains the official trained and validated **YOLO11s-seg building-instance segmentation model** for integration into the `3D-ULPIN-MVP` platform. The model takes 2D aerial drone/satellite orthomosaics and outputs individual building bounding boxes, confidence scores, binary segmentation masks, and simplified pixel polygon boundaries.

### Benchmark Validation Performance (Full 200-Tile Validation Population):
- **Mask mAP50:** **0.4233** (+17.8% relative gain over initial baseline)
- **Mask Recall:** **0.4039** (+14.6% relative gain over initial baseline)
- **Mask Precision:** **0.4634**
- **Box mAP50:** **0.4316** (+19.1% relative gain over initial baseline)
- **Box Recall:** **0.4219**

---

## 2. Package Directory Layout

```
ulpin_building_segmentation_model/
├── config.json              # Model hyperparameters, defaults, and documented limits
├── inference.py             # Reusable Python inference interface (CPU & CUDA)
├── README.md                # Installation, usage, output schema, and GIS integration
├── requirements.txt         # Minimal runtime dependencies
├── SHA256SUMS.txt           # Cryptographic SHA-256 verification hashes
├── weights/
│   └── best.pt              # Authoritative trained model weights (10.1M params)
└── examples/
    ├── run_example.py       # Standalone execution example
    ├── sample_aerial_tile.png # Sample 640x640 validation image
    ├── sample_annotated.png # Visual inference output overlay
    └── sample_detections.json # Sample exported JSON detection schema
```

---

## 3. Installation in Host Project (`3D-ULPIN-MVP`)

### Step 1: Install Dependencies
In the target environment of `3D-ULPIN-MVP`:
```bash
pip install -r requirements.txt
```

### Step 2: Copy Package into Target Project
Copy this directory into your project's model or service directory:
```bash
cp -r dist/ulpin_building_segmentation_model /path/to/3D-ULPIN-MVP/src/models/
```

---

## 4. Python API & Usage Example

### Quick Start
```python
from pathlib import Path
from ulpin_building_segmentation_model.inference import BuildingSegmentationModel

# 1. Initialize model (loads weights once, CPU by default)
model = BuildingSegmentationModel(device="cpu")

# 2. Run prediction on an aerial image (path or numpy array)
results = model.predict(
    image="path/to/aerial_tile.png",
    conf=0.25,     # Configurable confidence threshold (default: 0.25)
    imgsz=800,     # Inference resolution (default: 800)
    device="cpu"   # Supports 'cpu' or 'cuda:0'
)

# 3. Process detected building instances
print(f"Detected {len(results)} building instances.")

for bldg in results:
    instance_id = bldg["instance_id"]
    confidence  = bldg["confidence"]
    bbox_xyxy   = bldg["bbox_xyxy"]       # [xmin, ymin, xmax, ymax] in pixels
    polygon     = bldg["polygon"]         # [[x0, y0], [x1, y1], ...] in pixels
    mask        = bldg["mask"]            # 2D binary numpy array (H, W)
    area_px     = bldg["area_pixels"]     # Surface area in square pixels

    print(f"Building #{instance_id}: Conf={confidence:.3f}, Area={area_px} px^2")
```

---

## 5. Output Schema

The `predict()` method returns a `list[dict]`. If no buildings are detected, it returns an empty list `[]`.

| Field Name | Type | Description |
| :--- | :--- | :--- |
| `instance_id` | `int` | Sequential 1-indexed identifier for the detected building. |
| `class_id` | `int` | Class index (`0` for `building`). |
| `class_name` | `str` | Class name string (`"building"`). |
| `confidence` | `float` | Detection confidence score ($0.0$ to $1.0$). |
| `bbox_xyxy` | `list[float]` | Pixel coordinates `[xmin, ymin, xmax, ymax]`. |
| `mask` | `np.ndarray` | 2D binary NumPy array of shape `(H, W)` with dtype `uint8` (`1` = building, `0` = background). |
| `polygon` | `list[list[int]]`| Ordered perimeter vertices `[[x0, y0], [x1, y1], ...]` in image-pixel space. |
| `area_pixels` | `float` | Surface area enclosed by the polygon in square pixels. |
| `image_width` | `int` | Native image width in pixels ($W$). |
| `image_height` | `int` | Native image height in pixels ($H$). |

---

## 6. Geographic Coordinate Conversion (for 3D-ULPIN-MVP Host Application)

> [!IMPORTANT]
> **Pixel Coordinates vs. Geographic Coordinates:**
> This model outputs coordinates strictly in **2D image-pixel space** ($0 \le X \le W$, $0 \le Y \le H$).
> To project these footprints into real-world geographic coordinates (e.g. WGS84 EPSG:4326 or UTM):

```python
# Host application integration snippet (using rasterio Affine transform):
import rasterio

with rasterio.open("georeferenced_aerial_orthomosaic.tif") as src:
    transform = src.transform  # Affine transform matrix
    crs = src.crs              # Geographic Coordinate Reference System

def pixel_to_geo(px: float, py: float, transform) -> tuple[float, float]:
    """Applies affine transformation from pixel coords to geographic CRS."""
    geo_x, geo_y = rasterio.transform.xy(transform, py, px)
    return geo_x, geo_y

# Transform each polygon vertex:
for bldg in results:
    geo_polygon = [pixel_to_geo(px, py, transform) for px, py in bldg["polygon"]]
    # bldg["geo_polygon"] can now be saved as GeoJSON or inserted into PostGIS / 3D-ULPIN-MVP
```

---

## 7. Model Scope & Explicit Disclaimers

1. **Building Segmentation Only:** This package performs 2D instance segmentation of building rooftops from aerial imagery.
2. **No 3D / Height Estimation:** The model does not calculate building height, floor counts, or 3D volumetric geometry. 3D reconstruction must be performed by the main `3D-ULPIN-MVP` pipeline using photogrammetry/DSM/stereo point clouds.
3. **No Cadastral or Legal Semantics:** The model detects physical rooftops, NOT legal property boundaries, land titles, or parcel ownership.
4. **No ULPIN Identifier Assignment:** Unique Land Parcel Identification Numbers (ULPIN) must be assigned by the host application and administrative registry services.
5. **Physical Limits of 2D RGB Imagery:** Adjoining structures sharing continuous, planar metal sheets or uniform concrete without visible shadow or elevation steps cannot be partitioned from 2D RGB alone and require cadastral vector or elevation overlays.

---

## 8. Verification & Integrity

Verify the cryptographic integrity of the packaged files:
```bash
sha256sum -c SHA256SUMS.txt
```
Expected output:
```
weights/best.pt: OK
inference.py: OK
config.json: OK
```
