"""
Latency Optimization Module (3D ULPIN AI Pipeline)
==================================================
Multi-threaded Parallel Satellite Downloader with Tile Caching & Image Compression:
1. Smart persistent tile disk caching (30-day auto-invalidation)
2. Parallel 4-tile concurrent HTTP downloading via ThreadPoolExecutor
3. Near-lossless JPEG 85 image compression
4. Single-scale lazy loading zoom manager
"""

import os
import time
import math
import requests
from io import BytesIO
from PIL import Image
import numpy as np
from concurrent.futures import ThreadPoolExecutor, as_completed

try:
    from ai.config.fine_tuning_config import FINE_TUNING_CONFIG
    from ai.utils.image_utils import STADIA_TILE_URL, ESRI_TILE_URL, _latlon_to_tile, _tile_to_latlon, _last_image_bounds
except ModuleNotFoundError:
    from config.fine_tuning_config import FINE_TUNING_CONFIG
    from utils.image_utils import STADIA_TILE_URL, ESRI_TILE_URL, _latlon_to_tile, _tile_to_latlon, _last_image_bounds

CACHE_DIR = FINE_TUNING_CONFIG["priority_4"]["tile_caching"]["cache_dir"]
MAX_AGE_SECONDS = FINE_TUNING_CONFIG["priority_4"]["tile_caching"]["max_age_days"] * 86400
MAX_WORKERS = FINE_TUNING_CONFIG["priority_4"]["parallel_download"]["max_workers"]


def _fetch_single_tile(tile_info: dict) -> tuple:
    """Helper function to fetch a single satellite tile with fallback."""
    tx, ty, zoom = tile_info["tx"], tile_info["ty"], tile_info["zoom"]
    dx, dy = tile_info["dx"], tile_info["dy"]

    url_primary = STADIA_TILE_URL.format(z=zoom, x=tx, y=ty)
    resp = None
    try:
        resp = requests.get(url_primary, timeout=5)
    except Exception:
        resp = None

    if not resp or resp.status_code != 200:
        url_fallback = ESRI_TILE_URL.format(z=zoom, y=ty, x=tx)
        try:
            resp = requests.get(url_fallback, timeout=5)
        except Exception:
            resp = None

    if resp and resp.status_code == 200:
        tile_img = Image.open(BytesIO(resp.content)).convert("RGB")
        return (dx, dy, tile_img)
    else:
        # Return fallback blank RGB tile if tile fetch fails
        blank = Image.new("RGB", (256, 256), color=(200, 200, 200))
        return (dx, dy, blank)


def parallel_tile_download(tiles_to_fetch: list) -> list:
    """
    Download multiple satellite tiles in parallel using ThreadPoolExecutor.

    Args:
        tiles_to_fetch (list): List of dicts containing {tx, ty, zoom, dx, dy}.

    Returns:
        list: List of tuples (dx, dy, PIL Image).
    """
    results = []
    with ThreadPoolExecutor(max_workers=MAX_WORKERS) as executor:
        futures = [executor.submit(_fetch_single_tile, tile) for tile in tiles_to_fetch]
        for future in as_completed(futures):
            try:
                res = future.result()
                results.append(res)
            except Exception as e:
                print(f"Parallel tile download worker error: {e}")
    return results


def download_satellite_tiles_cached(
    lat: float,
    lon: float,
    zoom: int = 19
) -> np.ndarray:
    """
    Smart tile caching + parallel downloading.

    Features:
    1. Check local cache before downloading.
    2. Download 4 tiles in PARALLEL via ThreadPoolExecutor.
    3. Compress using JPEG quality 85.
    4. Store in cache with timestamp & auto-invalidate after 30 days.

    Returns:
        np.ndarray: OpenCV BGR image array.
    """
    os.makedirs(CACHE_DIR, exist_ok=True)
    cache_key = f"tile_{lat:.4f}_{lon:.4f}_z{zoom}.jpg"
    cache_path = os.path.join(CACHE_DIR, cache_key)

    # Check Cache & Expiration
    if os.path.exists(cache_path):
        mtime = os.path.getmtime(cache_path)
        if time.time() - mtime <= MAX_AGE_SECONDS:
            img_pil = Image.open(cache_path).convert("RGB")
            return cv2_from_pil(img_pil)

    # Parallel Fetch Setup
    center_x, center_y = _latlon_to_tile(lat, lon, zoom)
    grid_size = 2
    half = grid_size // 2
    tile_size = 256

    tiles_to_fetch = []
    for dy in range(-half, half + 1):
        for dx in range(-half, half + 1):
            tiles_to_fetch.append({
                "tx": center_x + dx,
                "ty": center_y + dy,
                "zoom": zoom,
                "dx": dx,
                "dy": dy
            })

    # Record Geo Bounds for coordinate mapping
    top_left_lat, top_left_lon = _tile_to_latlon(center_x - half, center_y - half, zoom)
    bot_right_lat, bot_right_lon = _tile_to_latlon(center_x + half + 1, center_y + half + 1, zoom)
    _last_image_bounds["min_lon"] = top_left_lon
    _last_image_bounds["max_lon"] = bot_right_lon
    _last_image_bounds["min_lat"] = bot_right_lat
    _last_image_bounds["max_lat"] = top_left_lat

    # Execute Parallel Download
    fetched_tiles = parallel_tile_download(tiles_to_fetch)

    # Stitch Tiles into Stitched Image
    stitched = Image.new("RGB", (tile_size * grid_size, tile_size * grid_size))
    for dx, dy, tile_img in fetched_tiles:
        paste_x = (dx + half) * tile_size
        paste_y = (dy + half) * tile_size
        stitched.paste(tile_img, (paste_x, paste_y))

    # Save to Cache with JPEG 85 compression
    stitched.save(cache_path, format="JPEG", quality=85, optimize=True)

    return cv2_from_pil(stitched)


def optimize_image_compression(image_path: str) -> bytes:
    """
    Compress image to JPEG quality 85 without visual loss.

    Returns compressed image bytes.
    """
    if not os.path.exists(image_path):
        raise FileNotFoundError(f"Image not found: {image_path}")

    img = Image.open(image_path).convert("RGB")
    buffer = BytesIO()
    img.save(buffer, format="JPEG", quality=85, optimize=True)
    return buffer.getvalue()


def lazy_load_zoom_levels(
    lat: float,
    lon: float,
    primary_zoom: int = 19
) -> dict:
    """
    Lazy load only the single primary zoom level needed.

    Returns dict with zoom metadata and OpenCV BGR image array.
    """
    bgr_img = download_satellite_tiles_cached(lat, lon, zoom=primary_zoom)
    return {
        "zoom": primary_zoom,
        "center": [lat, lon],
        "image_shape": bgr_img.shape,
        "image": bgr_img
    }


def cv2_from_pil(pil_img: Image.Image) -> np.ndarray:
    """Convert PIL RGB Image to OpenCV BGR numpy array."""
    rgb_arr = np.array(pil_img)
    return cv2_cvtColor_rgb2bgr(rgb_arr)


def cv2_cvtColor_rgb2bgr(rgb_array: np.ndarray) -> np.ndarray:
    """Helper to swap R and B channels."""
    return rgb_array[:, :, ::-1].copy()
