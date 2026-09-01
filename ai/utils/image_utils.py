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

# Global dict to store geo bounds of last downloaded image (used by footprint_detection.py)
_last_image_bounds = {
    "min_lon": None, "max_lon": None,
    "min_lat": None, "max_lat": None
}


def _latlon_to_tile(lat: float, lon: float, zoom: int):
    """Convert latitude/longitude to tile X, Y, Z coordinates."""
    n = 2 ** zoom
    x = int((lon + 180.0) / 360.0 * n)
    y = int((1.0 - math.asinh(math.tan(math.radians(lat))) / math.pi) / 2.0 * n)
    return x, y


def _tile_to_latlon(tx: int, ty: int, zoom: int):
    """Convert tile X, Y, Z to top-left corner latitude/longitude of that tile."""
    n = 2 ** zoom
    lon = tx / n * 360.0 - 180.0
    lat = math.degrees(math.atan(math.sinh(math.pi * (1 - 2 * ty / n))))
    return lat, lon


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

        # Compute geographic bounds of the stitched image
        top_left_lat, top_left_lon = _tile_to_latlon(center_x - half, center_y - half, zoom)
        bot_right_lat, bot_right_lon = _tile_to_latlon(center_x + half + 1, center_y + half + 1, zoom)

        # Store bounds globally so footprint_detection.py can use them
        _last_image_bounds["min_lon"] = top_left_lon
        _last_image_bounds["max_lon"] = bot_right_lon
        _last_image_bounds["min_lat"] = bot_right_lat   # Note: lat decreases going down
        _last_image_bounds["max_lat"] = top_left_lat

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
            print(f"Image Geo Bounds: [{_last_image_bounds['min_lat']:.4f},{_last_image_bounds['min_lon']:.4f}] to [{_last_image_bounds['max_lat']:.4f},{_last_image_bounds['max_lon']:.4f}]")
            return output_path
        else:
            return _get_fallback_image()

    except Exception as e:
        print(f"Satellite download error: {e}. Using fallback image.")
        return _get_fallback_image()


def _get_fallback_image() -> str:
    """Return the path of the best available fallback image."""
    sample_data_dir = os.path.abspath(os.path.join(os.path.dirname(__file__), "..", "sample_data"))
    for candidate in [
        os.path.join(sample_data_dir, "Gemini_Generated_Image_ih606sih606sih60.png"),
        os.path.join(sample_data_dir, "test_building.jpg"),
    ]:
        if os.path.exists(candidate):
            return candidate
    raise FileNotFoundError(f"No fallback images found in {sample_data_dir}.")
