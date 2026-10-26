import os
import math
import requests
import concurrent.futures
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


def get_tile_gsd_meters(lat: float, zoom: int, tile_size: int = 256) -> float:
    """
    Calculate the exact ground sampling distance (metres per pixel)
    at a specific latitude and zoom level on the Web Mercator projection (EPSG:3857).
    """
    c = 40075016.686  # WGS84 equatorial circumference in metres
    lat_rad = math.radians(lat)
    return (c * math.cos(lat_rad)) / (tile_size * (2 ** zoom))


def compute_tile_grid_transform(
    center_lat: float,
    center_lon: float,
    zoom: int = 19,
    grid_size: int = 3,
    tile_size: int = 256
) -> dict:
    """
    Compute deterministic georeferencing transform parameters for a fixed-size stitched tile grid.
    Preserved for backwards compatibility with existing point-based benchmarks.
    
    Returns a dict containing:
        - min_lon, max_lon, min_lat, max_lat
        - img_w, img_h
        - lon_per_px, lat_per_px
        - crs: 'EPSG:4326'
    """
    center_x, center_y = _latlon_to_tile(center_lat, center_lon, zoom)
    half = grid_size // 2
    top_left_lat, top_left_lon = _tile_to_latlon(center_x - half, center_y - half, zoom)
    bot_right_lat, bot_right_lon = _tile_to_latlon(center_x + half + 1, center_y + half + 1, zoom)
    img_w = tile_size * grid_size
    img_h = tile_size * grid_size

    return {
        "min_lon": top_left_lon,
        "max_lon": bot_right_lon,
        "min_lat": bot_right_lat,
        "max_lat": top_left_lat,
        "img_w": img_w,
        "img_h": img_h,
        "lon_per_px": (bot_right_lon - top_left_lon) / float(img_w),
        "lat_per_px": (top_left_lat - bot_right_lat) / float(img_h),
        "crs": "EPSG:4326",
        "top_left_lon": top_left_lon,
        "top_left_lat": top_left_lat,
        "center_tile": (center_x, center_y),
        "zoom": zoom,
        "is_quarantined": False
    }


def compute_boundary_tile_grid_transform(
    boundary: dict,
    zoom: int = 19,
    buffer_tiles: int = 1,
    tile_size: int = 256
) -> dict:
    """
    Calculate actual XYZ tile indices covering the society boundary.
    Accounts for global tile-grid alignment, latitude, zoom, actual tile dimensions,
    and a configurable buffer.
    
    Returns explicit georeferencing transform dict describing the final stitched raster.
    """
    boundary_shape = shape(boundary) if isinstance(boundary, dict) else boundary
    min_lon, min_lat, max_lon, max_lat = boundary_shape.bounds

    # Tile indices for the bounding box corners.
    # Note: In Web Mercator, max_lat (North) corresponds to minimum Y tile index!
    tx_min, ty_min = _latlon_to_tile(max_lat, min_lon, zoom)
    tx_max, ty_max = _latlon_to_tile(min_lat, max_lon, zoom)

    max_tile_idx = (2 ** zoom) - 1
    tx_start = max(0, tx_min - buffer_tiles)
    tx_end = min(max_tile_idx, tx_max + buffer_tiles)
    ty_start = max(0, ty_min - buffer_tiles)
    ty_end = min(max_tile_idx, ty_max + buffer_tiles)

    nx = tx_end - tx_start + 1
    ny = ty_end - ty_start + 1
    img_w = nx * tile_size
    img_h = ny * tile_size

    top_left_lat, top_left_lon = _tile_to_latlon(tx_start, ty_start, zoom)
    bot_right_lat, bot_right_lon = _tile_to_latlon(tx_end + 1, ty_end + 1, zoom)

    centroid = boundary_shape.centroid
    gsd_m = get_tile_gsd_meters(centroid.y, zoom, tile_size)

    return {
        "min_lon": top_left_lon,
        "max_lon": bot_right_lon,
        "min_lat": bot_right_lat,
        "max_lat": top_left_lat,
        "img_w": img_w,
        "img_h": img_h,
        "lon_per_px": (bot_right_lon - top_left_lon) / float(img_w),
        "lat_per_px": (top_left_lat - bot_right_lat) / float(img_h),
        "crs": "EPSG:4326",
        "top_left_lon": top_left_lon,
        "top_left_lat": top_left_lat,
        "gsd_meters": gsd_m,
        "tile_range": {
            "tx_start": tx_start,
            "tx_end": tx_end,
            "ty_start": ty_start,
            "ty_end": ty_end,
            "nx": nx,
            "ny": ny,
            "zoom": zoom,
            "buffer_tiles": buffer_tiles
        },
        "zoom": zoom,
        "is_quarantined": False
    }


KNOWN_PLACEHOLDER_SUBSTRINGS = [
    "Gemini_Generated_Image",
    "test_building.jpg",
    "placeholder",
    "fallback"
]


def is_placeholder_image(image_path: str | None, geo_transform: dict | None = None) -> bool:
    """
    Check if an image is an unreferenced stock placeholder or quarantined asset.
    Returns True if:
    1. geo_transform is None or has is_quarantined=True.
    2. image_path is None or missing from filesystem.
    3. image_path is one of the known stock placeholder assets (e.g., in sample_data).
    """
    if geo_transform is None:
        return True
    if isinstance(geo_transform, dict) and geo_transform.get("is_quarantined", False) is True:
        return True
    if not image_path or not os.path.exists(image_path):
        return True
    
    # Check if pointing to known sample_data stock placeholder
    sample_data_dir = os.path.abspath(os.path.join(os.path.dirname(__file__), "..", "sample_data"))
    try:
        abs_p = os.path.abspath(image_path)
        if os.path.dirname(abs_p) == sample_data_dir:
            fname = os.path.basename(abs_p)
            for sub in KNOWN_PLACEHOLDER_SUBSTRINGS:
                if sub in fname:
                    return True
    except Exception:
        pass

    fname = os.path.basename(image_path)
    if "Gemini_Generated_Image" in fname or "placeholder" in fname.lower() or "quarantine" in fname.lower():
        return True
            
    return False


def download_satellite_image(
    parcel_boundary: dict,
    output_path: str = "sample_data/downloaded_satellite.png",
    zoom: int = 19,
    return_transform: bool = False,
    buffer_tiles: int = 1
):
    """
    Multi-Source Satellite Downloader with Dynamic Tile Grid Extent:
    1. Calculates actual XYZ tile indices covering the parcel/society boundary.
    2. Tries Stadia Maps Satellite API (using user API Key).
    3. If Stadia fails or rate limits, falls back to ESRI World Imagery.
    4. Stitches the dynamic tile grid for the full boundary extent.
    5. If download fails, returns placeholder path with transform=None (quarantined).

    If return_transform is True, returns tuple (image_path, geo_transform_dict | None).
    Otherwise returns image_path for backwards compatibility.
    """
    os.makedirs(os.path.dirname(output_path), exist_ok=True)

    try:
        tile_size = 256
        # Compute dynamic tile grid transform based on actual boundary geometry
        geo_transform = compute_boundary_tile_grid_transform(
            parcel_boundary, zoom=zoom, buffer_tiles=buffer_tiles, tile_size=tile_size
        )
        tr = geo_transform["tile_range"]
        tx_start = tr["tx_start"]
        tx_end = tr["tx_end"]
        ty_start = tr["ty_start"]
        ty_end = tr["ty_end"]
        nx = tr["nx"]
        ny = tr["ny"]
        img_w = geo_transform["img_w"]
        img_h = geo_transform["img_h"]

        print(f"Downloading high-res satellite tiles (Zoom {zoom}) for boundary: grid {nx}x{ny} tiles ({img_w}x{img_h} px)...")

        stitched = Image.new("RGB", (img_w, img_h))

        # Download tiles in parallel using ThreadPoolExecutor (ESRI World Imagery as primary)
        primary_success = False

        def _fetch_single_tile(tx: int, ty: int):
            # 1. Try ESRI World Imagery directly (high-res, reliable, zero key required)
            url = ESRI_TILE_URL.format(z=zoom, y=ty, x=tx)
            try:
                resp = requests.get(url, timeout=3.5)
                if resp and resp.status_code == 200:
                    tile_img = Image.open(BytesIO(resp.content)).convert("RGB")
                    return tx, ty, tile_img
            except Exception:
                pass

            # 2. Fallback to Stadia Maps only if key is non-default
            if STADIA_API_KEY and STADIA_API_KEY != "24c9f5e8-ab09-4848-97f1-1bdfdecf8091":
                try:
                    url_st = STADIA_TILE_URL.format(z=zoom, x=tx, y=ty)
                    resp_st = requests.get(url_st, timeout=3.5)
                    if resp_st and resp_st.status_code == 200:
                        tile_img = Image.open(BytesIO(resp_st.content)).convert("RGB")
                        return tx, ty, tile_img
                except Exception:
                    pass

            return tx, ty, None

        tile_coords = [
            (tx, ty)
            for ty in range(ty_start, ty_end + 1)
            for tx in range(tx_start, tx_end + 1)
        ]

        with concurrent.futures.ThreadPoolExecutor(max_workers=min(12, len(tile_coords) or 1)) as executor:
            futures = [executor.submit(_fetch_single_tile, tx, ty) for tx, ty in tile_coords]
            for future in concurrent.futures.as_completed(futures):
                try:
                    tx, ty, tile_img = future.result()
                    if tile_img is not None:
                        paste_x = (tx - tx_start) * tile_size
                        paste_y = (ty - ty_start) * tile_size
                        stitched.paste(tile_img, (paste_x, paste_y))
                        primary_success = True
                except Exception:
                    continue

        if primary_success:
            stitched.save(output_path)
            print(f"Fine-tuned Satellite Image saved to: {output_path}")
            print(f"Image Geo Bounds: [{geo_transform['min_lat']:.4f},{geo_transform['min_lon']:.4f}] to [{geo_transform['max_lat']:.4f},{geo_transform['max_lon']:.4f}]")
            _last_image_bounds["min_lon"] = geo_transform["min_lon"]
            _last_image_bounds["max_lon"] = geo_transform["max_lon"]
            _last_image_bounds["min_lat"] = geo_transform["min_lat"]
            _last_image_bounds["max_lat"] = geo_transform["max_lat"]
            if return_transform:
                return output_path, geo_transform
            return output_path
        else:
            fallback = _get_fallback_image()
            print(f"Satellite download failed. Stock placeholder quarantined: {fallback}")
            # Reset legacy bounds so stale bounds do not bleed into quarantined state
            _last_image_bounds["min_lon"] = None
            _last_image_bounds["max_lon"] = None
            _last_image_bounds["min_lat"] = None
            _last_image_bounds["max_lat"] = None
            if return_transform:
                return fallback, None
            return fallback

    except Exception as e:
        print(f"Satellite download error: {e}. Stock placeholder quarantined.")
        fallback = _get_fallback_image()
        _last_image_bounds["min_lon"] = None
        _last_image_bounds["max_lon"] = None
        _last_image_bounds["min_lat"] = None
        _last_image_bounds["max_lat"] = None
        if return_transform:
            return fallback, None
        return fallback


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

