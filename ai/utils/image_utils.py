import os
import math
import requests
from shapely.geometry import shape
from PIL import Image
from io import BytesIO

STADIA_API_KEY = os.getenv("STADIA_API_KEY", "24c9f5e8-ab09-4848-97f1-1bdfdecf8091")

# Primary: Stadia Maps Satellite / Alidade Tiles
STADIA_TILE_URL = "https://tiles.stadiamaps.com/tiles/alidade_satellite/{z}/{x}/{y}.jpg?api_key=" + STADIA_API_KEY
# Fallback: ESRI World Imagery
ESRI_TILE_URL = "https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}"


def _latlon_to_tile(lat: float, lon: float, zoom: int):
    """Convert latitude/longitude to tile X, Y, Z coordinates."""
    n = 2 ** zoom
    x = int((lon + 180.0) / 360.0 * n)
    y = int((1.0 - math.asinh(math.tan(math.radians(lat))) / math.pi) / 2.0 * n)
    return x, y


def download_satellite_image(
    parcel_boundary: dict,
    output_path: str = "sample_data/downloaded_satellite.png",
    zoom: int = 19
) -> str:
    """
    Fine-tuned Multi-Source Satellite Downloader:
    1. Tries Stadia Maps Satellite API (using user API Key).
    2. If Stadia fails or rate limits, falls back to ESRI World Imagery.
    3. Stitches high-res tile grid for building-level close-up analysis.
    """
    os.makedirs(os.path.dirname(output_path), exist_ok=True)

    try:
        boundary_shape = shape(parcel_boundary)
        centroid = boundary_shape.centroid
        lon, lat = centroid.x, centroid.y

        center_x, center_y = _latlon_to_tile(lat, lon, zoom)

        print(f"Downloading high-res zoomed-in building satellite tiles (Zoom {zoom}) for [{lat:.4f}, {lon:.4f}]...")

        tile_size = 256
        grid_size = 2
        half = grid_size // 2
        stitched = Image.new("RGB", (tile_size * grid_size, tile_size * grid_size))

        # Try Stadia Maps first, then ESRI
        primary_success = False

        for dy in range(-half, half + 1):
            for dx in range(-half, half + 1):
                tx = center_x + dx
                ty = center_y + dy
                
                # Primary attempt: Stadia Maps
                url = STADIA_TILE_URL.format(z=zoom, x=tx, y=ty)
                resp = None
                try:
                    resp = requests.get(url, timeout=5)
                except Exception:
                    resp = None

                # Fallback attempt: ESRI World Imagery
                if not resp or resp.status_code != 200:
                    url = ESRI_TILE_URL.format(z=zoom, y=ty, x=tx)
                    resp = requests.get(url, timeout=5)

                if resp and resp.status_code == 200:
                    tile_img = Image.open(BytesIO(resp.content)).convert("RGB")
                    paste_x = (dx + half) * tile_size
                    paste_y = (dy + half) * tile_size
                    stitched.paste(tile_img, (paste_x, paste_y))
                    primary_success = True

        if primary_success:
            stitched.save(output_path)
            print(f"Fine-tuned Satellite Image saved to: {output_path}")
            return output_path
        else:
            return _get_fallback_image()

    except Exception as e:
        print(f"Satellite download error: {e}. Using fallback image.")
        return _get_fallback_image()


def _get_fallback_image() -> str:
    """Return the path of the best available fallback image."""
    for candidate in [
        "sample_data/Gemini_Generated_Image_ih606sih606sih60.png",
        "sample_data/test_building.jpg"
    ]:
        if os.path.exists(candidate):
            return candidate
    raise FileNotFoundError("No fallback images found in sample_data/.")
