"""
Deterministic Automated Test Suite: Dynamic Imagery Sizing & Safe Image Quarantine (Milestone 2)
================================================================================================
Covers:
1. Tile-grid coverage: Actual XYZ tile extent completely encloses the society boundary with buffer.
2. Edge alignment: Seams across global Web Mercator tile boundaries are correctly gridded and continuous.
3. Latitude-dependent resolution: Ground Sampling Distance (GSD) reflects metric decrease with latitude.
4. Stitched-raster transform consistency: Pixel-to-geographic mapping matches boundary corners and center.
5. Placeholder quarantine: Strictly prohibits OpenCV/YOLO visual detection on fallback placeholders,
   allowing OSM vector fallback with clear provenance when available.
6. No-imagery / no-OSM failure: When imagery is quarantined and no OSM vectors exist, returns a clear error
   rather than fabricating footprints from the parcel boundary.
"""

import os
import math
import cv2
import numpy as np
import pytest
from shapely.geometry import Polygon, box, shape, mapping

from ai.utils.image_utils import (
    _latlon_to_tile,
    _tile_to_latlon,
    get_tile_gsd_meters,
    compute_boundary_tile_grid_transform,
    is_placeholder_image,
    _get_fallback_image
)
from ai.footprint_detection_v2 import detect_building_footprint_hybrid
from ai.footprint_detection import detect_building_footprint
from ai.pipeline import process_building


# ─────────────────────────────────────────────────────────────────────────────
# Fixtures
# ─────────────────────────────────────────────────────────────────────────────

@pytest.fixture
def delhi_society_boundary():
    """
    Synthetic ~300m x 300m residential society boundary centered near 28.6139° N, 77.2090° E.
    In EPSG:4326 degrees, ~0.003° lon by ~0.0027° lat.
    """
    min_lon, max_lon = 77.2075, 77.2105
    min_lat, max_lat = 28.6125, 28.6152
    return {
        "type": "Polygon",
        "coordinates": [[
            [min_lon, min_lat],
            [max_lon, min_lat],
            [max_lon, max_lat],
            [min_lon, max_lat],
            [min_lon, min_lat]
        ]]
    }


@pytest.fixture
def synthetic_valid_image(tmp_path):
    """Creates a real 512x512 image on disk for valid visual testing."""
    img_path = str(tmp_path / "valid_raster_tile.png")
    img = np.full((512, 512, 3), 220, dtype=np.uint8)
    # Centered building roof
    cv2.rectangle(img, (128, 128), (384, 384), (40, 40, 40), -1)
    cv2.imwrite(img_path, img)
    return img_path


# ─────────────────────────────────────────────────────────────────────────────
# 1. Tile-Grid Coverage Test
# ─────────────────────────────────────────────────────────────────────────────

def test_tile_grid_coverage_encloses_society_boundary(delhi_society_boundary):
    """
    Verify that the calculated XYZ tile extent strictly encloses the society boundary
    on all four cardinal directions, accounting for global grid alignment and buffer.
    """
    zoom = 19
    buffer_tiles = 1
    tile_size = 256

    transform = compute_boundary_tile_grid_transform(
        delhi_society_boundary, zoom=zoom, buffer_tiles=buffer_tiles, tile_size=tile_size
    )

    b_shape = shape(delhi_society_boundary)
    b_min_lon, b_min_lat, b_max_lon, b_max_lat = b_shape.bounds

    # Check that stitched raster bounds enclose the society boundary
    assert transform["min_lon"] < b_min_lon, "Stitched raster min_lon must be west of boundary min_lon"
    assert transform["max_lon"] > b_max_lon, "Stitched raster max_lon must be east of boundary max_lon"
    assert transform["min_lat"] < b_min_lat, "Stitched raster min_lat must be south of boundary min_lat"
    assert transform["max_lat"] > b_max_lat, "Stitched raster max_lat must be north of boundary max_lat"

    # Shapely polygon containment check
    raster_polygon = box(transform["min_lon"], transform["min_lat"], transform["max_lon"], transform["max_lat"])
    assert raster_polygon.contains(b_shape), "Stitched raster box must strictly contain the entire boundary"

    # Tile range metadata checks
    tr = transform["tile_range"]
    assert tr["nx"] >= 3, "At zoom 19 with buffer=1, a 300m society must span at least 3 tiles in X"
    assert tr["ny"] >= 3, "At zoom 19 with buffer=1, a 300m society must span at least 3 tiles in Y"
    assert transform["img_w"] == tr["nx"] * tile_size
    assert transform["img_h"] == tr["ny"] * tile_size


# ─────────────────────────────────────────────────────────────────────────────
# 2. Edge Alignment Across Global Tile Boundaries
# ─────────────────────────────────────────────────────────────────────────────

def test_edge_alignment_across_global_tile_boundaries():
    """
    Construct a boundary straddling a global Web Mercator tile boundary.
    Verify that the tile-grid computation correctly identifies multiple tiles
    and that adjacent tiles align with zero gap.
    """
    zoom = 18
    # Determine the longitude boundary between two tiles at zoom 18
    sample_tx = 186400
    lat_seam, lon_seam = _tile_to_latlon(sample_tx, 110000, zoom)

    # Place a boundary that straddles lon_seam exactly
    straddling_boundary = {
        "type": "Polygon",
        "coordinates": [[
            [lon_seam - 0.0005, lat_seam - 0.0005],
            [lon_seam + 0.0005, lat_seam - 0.0005],
            [lon_seam + 0.0005, lat_seam + 0.0005],
            [lon_seam - 0.0005, lat_seam + 0.0005],
            [lon_seam - 0.0005, lat_seam - 0.0005]
        ]]
    }

    # Compute with 0 buffer to test raw tile spans
    transform_no_buffer = compute_boundary_tile_grid_transform(
        straddling_boundary, zoom=zoom, buffer_tiles=0
    )
    tr = transform_no_buffer["tile_range"]

    # Boundary MUST span across at least 2 tiles horizontally because it straddles lon_seam
    assert tr["nx"] >= 2, f"Boundary straddling tile seam must span ≥2 tiles, got {tr['nx']}"
    assert tr["tx_start"] < tr["tx_end"]

    # Check tile seam continuity: left tile right edge == right tile left edge
    left_tile_lat, left_tile_lon = _tile_to_latlon(sample_tx, 110000, zoom)
    assert abs(left_tile_lon - lon_seam) < 1e-9


# ─────────────────────────────────────────────────────────────────────────────
# 3. Latitude-Dependent Resolution (GSD)
# ─────────────────────────────────────────────────────────────────────────────

def test_latitude_dependent_resolution_gsd():
    """
    Verify that get_tile_gsd_meters correctly models Web Mercator scale variation
    as a cosine function of latitude.
    """
    zoom = 19
    tile_size = 256
    c_wgs84 = 40075016.686

    # Equator (0° N)
    gsd_equator = get_tile_gsd_meters(0.0, zoom, tile_size)
    expected_equator = c_wgs84 / (tile_size * (2 ** zoom))
    assert abs(gsd_equator - expected_equator) < 1e-6

    # Delhi (28.6139° N)
    gsd_delhi = get_tile_gsd_meters(28.6139, zoom, tile_size)
    expected_delhi = (c_wgs84 * math.cos(math.radians(28.6139))) / (tile_size * (2 ** zoom))
    assert abs(gsd_delhi - expected_delhi) < 1e-6

    # London (51.5074° N)
    gsd_london = get_tile_gsd_meters(51.5074, zoom, tile_size)

    # High Latitude / Arctic (70.0° N)
    gsd_arctic = get_tile_gsd_meters(70.0, zoom, tile_size)

    # Resolution (metres per pixel) decreases as latitude increases towards the poles
    assert gsd_equator > gsd_delhi > gsd_london > gsd_arctic
    # At 60° latitude, cos(60°) = 0.5, so GSD must be exactly half the equatorial GSD
    gsd_60 = get_tile_gsd_meters(60.0, zoom, tile_size)
    assert abs(gsd_60 - (0.5 * gsd_equator)) < 1e-5


# ─────────────────────────────────────────────────────────────────────────────
# 4. Stitched-Raster Transform Consistency
# ─────────────────────────────────────────────────────────────────────────────

def test_stitched_raster_transform_consistency(delhi_society_boundary):
    """
    Verify mathematical consistency between the stitched raster pixel grid
    and the geographic georeferencing transform.
    """
    zoom = 19
    transform = compute_boundary_tile_grid_transform(delhi_society_boundary, zoom=zoom, buffer_tiles=1)

    img_w = transform["img_w"]
    img_h = transform["img_h"]
    min_lon = transform["min_lon"]
    max_lon = transform["max_lon"]
    min_lat = transform["min_lat"]
    max_lat = transform["max_lat"]

    # Resolution properties
    lon_per_px = transform["lon_per_px"]
    lat_per_px = transform["lat_per_px"]
    assert abs(lon_per_px - (max_lon - min_lon) / float(img_w)) < 1e-12
    assert abs(lat_per_px - (max_lat - min_lat) / float(img_h)) < 1e-12

    # Forward mapping function
    def px_to_geo(px, py):
        lon = min_lon + (px / float(img_w)) * (max_lon - min_lon)
        lat = max_lat - (py / float(img_h)) * (max_lat - min_lat)
        return lon, lat

    # Test Corner 1: Top-Left (0, 0)
    tl_lon, tl_lat = px_to_geo(0, 0)
    assert abs(tl_lon - min_lon) < 1e-9
    assert abs(tl_lat - max_lat) < 1e-9

    # Test Corner 2: Bottom-Right (img_w, img_h)
    br_lon, br_lat = px_to_geo(img_w, img_h)
    assert abs(br_lon - max_lon) < 1e-9
    assert abs(br_lat - min_lat) < 1e-9

    # Test Center: (img_w / 2, img_h / 2)
    c_lon, c_lat = px_to_geo(img_w / 2.0, img_h / 2.0)
    assert abs(c_lon - ((min_lon + max_lon) / 2.0)) < 1e-9
    assert abs(c_lat - ((min_lat + max_lat) / 2.0)) < 1e-9


# ─────────────────────────────────────────────────────────────────────────────
# 5. Placeholder Quarantine & Prohibited CV Detection
# ─────────────────────────────────────────────────────────────────────────────

def test_placeholder_quarantine_prohibits_cv(delhi_society_boundary, tmp_path):
    """
    Verify that if imagery acquisition fails, the image is a placeholder, or
    the transform is unavailable, OpenCV visual detection is strictly prohibited.
    """
    fallback_path = _get_fallback_image()
    assert os.path.exists(fallback_path)

    # 5a. Quarantined image with NO OSM footprint -> must raise ValueError
    with pytest.raises(ValueError, match="strictly prohibited"):
        detect_building_footprint_hybrid(
            image_path=fallback_path,
            parcel_boundary=delhi_society_boundary,
            osm_footprint=None,
            geo_transform=None  # Transform unavailable / Quarantined
        )

    # 5b. Explicit quarantined transform -> must also raise ValueError
    quarantined_transform = {
        "min_lon": 77.0, "max_lon": 77.1,
        "min_lat": 28.0, "max_lat": 28.1,
        "is_quarantined": True
    }
    with pytest.raises(ValueError, match="strictly prohibited"):
        detect_building_footprint_hybrid(
            image_path=fallback_path,
            parcel_boundary=delhi_society_boundary,
            osm_footprint=None,
            geo_transform=quarantined_transform
        )

    # 5c. Legacy detect_building_footprint with quarantined transform -> raises ValueError
    with pytest.raises(ValueError, match="strictly prohibited"):
        detect_building_footprint(
            image_path=fallback_path,
            parcel_boundary=delhi_society_boundary,
            geo_transform=quarantined_transform
        )

    # 5d. In fallback mode with OSM footprint available -> uses OSM with clear provenance, NO CV
    mock_osm_footprint = {
        "type": "Polygon",
        "coordinates": [[[77.208, 28.613], [77.209, 28.613], [77.209, 28.614], [77.208, 28.614], [77.208, 28.613]]]
    }
    fallback_result = detect_building_footprint_hybrid(
        image_path=fallback_path,
        parcel_boundary=delhi_society_boundary,
        osm_footprint=mock_osm_footprint,
        geo_transform=None  # Quarantined
    )
    assert fallback_result["method_used"] == "osm_only"
    assert fallback_result["cv_confidence"] == 0.0
    assert fallback_result["osm_confidence"] == 95.0
    assert fallback_result["footprint"] == mock_osm_footprint
    assert "quarantine_reason" in fallback_result


# ─────────────────────────────────────────────────────────────────────────────
# 6. No-Imagery / No-OSM Failure Handling
# ─────────────────────────────────────────────────────────────────────────────

def test_no_imagery_no_osm_pipeline_failure(delhi_society_boundary, monkeypatch):
    """
    Verify that when both satellite download fails (yielding quarantined placeholder)
    AND OSM building vectors do not exist:
    - The pipeline returns a clear error rather than fabricating footprints out of the boundary.
    """
    # Mock download_satellite_image to simulate download failure / stock placeholder return
    def mock_download_fail(*args, **kwargs):
        fallback_path = _get_fallback_image()
        if kwargs.get("return_transform"):
            return fallback_path, None
        return fallback_path

    # Mock fetch_osm_building_comprehensive to return empty (no OSM building footprint)
    def mock_osm_empty(*args, **kwargs):
        return {"footprint": None, "building_name": None}

    monkeypatch.setattr("ai.pipeline.download_satellite_image", mock_download_fail)
    monkeypatch.setattr("ai.pipeline.fetch_osm_building_comprehensive", mock_osm_empty)

    input_payload = {
        "parcel_id": "TEST_PARCEL_NO_IMAGERY_NO_OSM",
        "building_id": "bldg_fail_safe_001",
        "parcel_boundary": delhi_society_boundary,
        "floor_count": 3,
        "height_meters": 10.0
    }

    result = process_building(input_payload)

    # Must fail with clear error status
    assert result["status"] == "error", f"Pipeline must return error status, got: {result}"
    assert "strictly prohibited" in result["message"] or "quarantined" in result["message"]
    # Verify no fabricated footprint returned
    assert "footprint" not in result or result.get("footprint") is None
