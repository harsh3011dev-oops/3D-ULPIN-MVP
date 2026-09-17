"""
ai/height_estimation.py
DEM / DSM (Digital Elevation Model / Digital Surface Model) Height Estimation Service.
Computes true terrain ground elevation (DEM) and building height from elevation services
(Open-Elevation API / SRTM / Copernicus raster elevation services) to replace pure guessing.
"""

import logging
import math
from typing import Optional, Dict, Any, List, Tuple
import requests

logger = logging.getLogger(__name__)

OPEN_ELEVATION_API = "https://api.open-elevation.com/api/v1/lookup"
DEFAULT_TIMEOUT_SEC = 5.0

# Local regional elevation cache to avoid redundant API calls
_ELEVATION_CACHE: Dict[Tuple[float, float], float] = {}

def get_cached_elevation(lat: float, lon: float, precision: int = 4) -> Optional[float]:
    """Check in-memory cache rounded to ~11m precision."""
    key = (round(lat, precision), round(lon, precision))
    return _ELEVATION_CACHE.get(key)

def set_cached_elevation(lat: float, lon: float, elevation: float, precision: int = 4) -> None:
    key = (round(lat, precision), round(lon, precision))
    _ELEVATION_CACHE[key] = elevation

def fetch_elevation_point(lat: float, lon: float) -> Optional[float]:
    """
    Fetches elevation above Mean Sea Level (MSL) in meters for a given point.
    Queries Open-Elevation API with timeout and cache.
    """
    cached = get_cached_elevation(lat, lon)
    if cached is not None:
        return cached

    try:
        url = f"{OPEN_ELEVATION_API}?locations={lat:.6f},{lon:.6f}"
        resp = requests.get(url, timeout=DEFAULT_TIMEOUT_SEC)
        if resp.status_code == 200:
            data = resp.json()
            results = data.get("results", [])
            if results and "elevation" in results[0]:
                elev = float(results[0]["elevation"])
                set_cached_elevation(lat, lon, elev)
                return elev
    except Exception as err:
        logger.debug("Open-Elevation lookup failed for (%s, %s): %s", lat, lon, err)

    return None

def fetch_elevation_batch(locations: List[Tuple[float, float]]) -> Dict[Tuple[float, float], float]:
    """
    Fetches elevation for multiple locations in a single batch request.
    Locations is a list of (lat, lon) tuples.
    """
    results_map: Dict[Tuple[float, float], float] = {}
    to_fetch: List[Dict[str, float]] = []

    for lat, lon in locations:
        cached = get_cached_elevation(lat, lon)
        if cached is not None:
            results_map[(lat, lon)] = cached
        else:
            to_fetch.append({"latitude": lat, "longitude": lon})

    if not to_fetch:
        return results_map

    try:
        resp = requests.post(
            OPEN_ELEVATION_API,
            json={"locations": to_fetch},
            timeout=DEFAULT_TIMEOUT_SEC + 2.0
        )
        if resp.status_code == 200:
            data = resp.json()
            for item in data.get("results", []):
                lat = float(item["latitude"])
                lon = float(item["longitude"])
                elev = float(item["elevation"])
                set_cached_elevation(lat, lon, elev)
                results_map[(lat, lon)] = elev
    except Exception as err:
        logger.debug("Batch elevation lookup failed: %s", err)

    return results_map

def estimate_height_from_dem_dsm(
    latitude: float,
    longitude: float,
    footprint: Optional[Dict[str, Any]] = None,
    delta_sample_m: float = 20.0
) -> Optional[Dict[str, Any]]:
    """
    Estimates building height using DEM ground terrain sampling vs building centroid elevation.
    
    Approach:
    1. Sample ground elevation (DEM) at points around the building perimeter (North, South, East, West).
    2. Sample surface elevation (DSM) at building centroid.
    3. If DSM - DEM > 2.5m, returns true estimated height in meters.
    """
    # 1 degree latitude ~ 111,000 meters
    delta_lat = delta_sample_m / 111000.0
    delta_lon = delta_sample_m / (111000.0 * max(0.2, math.cos(math.radians(latitude))))

    # Sample perimeter ground points
    sample_points = [
        (latitude + delta_lat, longitude),
        (latitude - delta_lat, longitude),
        (latitude, longitude + delta_lon),
        (latitude, longitude - delta_lon),
        (latitude, longitude)  # Centroid point
    ]

    elev_map = fetch_elevation_batch(sample_points)
    centroid_elev = elev_map.get((latitude, longitude))

    ground_elevs = [
        elev_map[p] for p in sample_points[:4]
        if p in elev_map
    ]

    if centroid_elev is not None and ground_elevs:
        dem_ground = sum(ground_elevs) / len(ground_elevs)
        dsm_surface = centroid_elev
        height_diff = dsm_surface - dem_ground

        if height_diff >= 3.0:
            return {
                "height_meters": round(height_diff, 1),
                "dem_ground_elevation_m": round(dem_ground, 1),
                "dsm_surface_elevation_m": round(dsm_surface, 1),
                "method": "DEM/DSM Differential Analysis",
                "confidence": 0.75
            }
        else:
            return {
                "dem_ground_elevation_m": round(dem_ground, 1),
                "dsm_surface_elevation_m": round(dsm_surface, 1),
                "method": "DEM Terrain Baseline Sampled",
                "confidence": 0.5
            }

    return None
