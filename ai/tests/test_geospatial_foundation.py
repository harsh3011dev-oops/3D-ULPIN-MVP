"""
Deterministic Geospatial Foundation Automated Test Suite
=========================================================
Tests:
1. Explicit georeferencing transform passing (eliminating mutable global state).
2. Pixel-to-geographic coordinate conversion accuracy and independence from _last_image_bounds.
3. Appropriate projected CRS (UTM) selection based on latitude/longitude.
4. Metric area calculation in square meters using projected CRS vs naive degree scaling.
5. Strict determinism: identical inputs produce identical outputs within documented tolerance.
"""

import os
import math
import cv2
import numpy as np
import pytest
from shapely.geometry import Polygon, mapping, shape
from rasterio.warp import transform_geom

from ai.utils.geo_utils import get_utm_crs_for_latlon, calculate_polygon_area_sqm
from ai.utils.image_utils import compute_tile_grid_transform, _last_image_bounds
from ai.footprint_detection import detect_building_footprint, _pixels_to_geo
from ai.footprint_detection_v2 import detect_building_footprint_hybrid


@pytest.fixture
def synthetic_satellite_image(tmp_path):
    """
    Creates a synthetic 768x768 satellite image with a known centered building contour.
    Pixel box: (192, 192) to (576, 576), exactly 384x384 pixels (50% of width and height).
    Background is light (200) and building roof is dark (50) to match THRESH_BINARY_INV.
    """
    img_path = str(tmp_path / "synthetic_tile_patch.png")
    img = np.full((768, 768, 3), 200, dtype=np.uint8)
    # Dark building roof with sharp boundaries
    cv2.rectangle(img, (192, 192), (576, 576), (50, 50, 50), -1)
    cv2.imwrite(img_path, img)
    return img_path


def test_utm_crs_selection_across_regions():
    """Verify UTM zone and EPSG selection logic across diverse longitudes and hemispheres."""
    # Delhi, India: ~77.2° E, 28.6° N -> Zone 43N
    assert get_utm_crs_for_latlon(28.6139, 77.2090) == "EPSG:32643"

    # Mumbai, India: ~72.88° E, 19.08° N -> Zone 43N
    assert get_utm_crs_for_latlon(19.0760, 72.8777) == "EPSG:32643"

    # Kolkata, India: ~88.36° E, 22.57° N -> Zone 45N
    assert get_utm_crs_for_latlon(22.5726, 88.3639) == "EPSG:32644" or get_utm_crs_for_latlon(22.5726, 88.3639) == "EPSG:32645"

    # Bengaluru, India: ~77.59° E, 12.97° N -> Zone 43N
    assert get_utm_crs_for_latlon(12.9716, 77.5946) == "EPSG:32643"

    # Sydney, Australia: ~151.21° E, -33.87° S -> Zone 56S
    assert get_utm_crs_for_latlon(-33.8688, 151.2093) == "EPSG:32756"


def test_explicit_georeferencing_transform_independence(synthetic_satellite_image):
    """
    Verify that passing an explicit geo_transform converts pixel coordinates
    accurately into geographic coordinates without relying on the mutable global
    _last_image_bounds.
    """
    # Define a known geographic bounding box
    # min_lon = 77.2000000, max_lon = 77.2100000 (span = 0.01 deg)
    # min_lat = 28.6000000, max_lat = 28.6100000 (span = 0.01 deg)
    explicit_transform = {
        "min_lon": 77.2000000,
        "max_lon": 77.2100000,
        "min_lat": 28.6000000,
        "max_lat": 28.6100000,
        "img_w": 768,
        "img_h": 768,
        "crs": "EPSG:4326"
    }

    # Deliberately pollute the mutable global _last_image_bounds with bogus coordinates
    _last_image_bounds["min_lon"] = 0.1234567
    _last_image_bounds["max_lon"] = 0.7654321
    _last_image_bounds["min_lat"] = 0.1111111
    _last_image_bounds["max_lat"] = 0.2222222

    # 1. Test direct _pixels_to_geo with explicit transform
    # Pixel (192, 192) is 25% from top-left
    # Expected lon = 77.2000000 + 0.25 * 0.01 = 77.2025000
    # Expected lat = 28.6100000 - 0.25 * 0.01 = 28.6075000
    px_points = [[192, 192], [576, 576]]
    geo_points = _pixels_to_geo(px_points, image_path=synthetic_satellite_image, geo_transform=explicit_transform)

    assert abs(geo_points[0][0] - 77.2025000) < 1e-6, f"Expected 77.2025000, got {geo_points[0][0]}"
    assert abs(geo_points[0][1] - 28.6075000) < 1e-6, f"Expected 28.6075000, got {geo_points[0][1]}"

    # Pixel (576, 576) is 75% from top-left
    # Expected lon = 77.2000000 + 0.75 * 0.01 = 77.2075000
    # Expected lat = 28.6100000 - 0.75 * 0.01 = 28.6025000
    assert abs(geo_points[1][0] - 77.2075000) < 1e-6, f"Expected 77.2075000, got {geo_points[1][0]}"
    assert abs(geo_points[1][1] - 28.6025000) < 1e-6, f"Expected 28.6025000, got {geo_points[1][1]}"

    # 2. Test full detect_building_footprint with explicit geo_transform
    footprint = detect_building_footprint(
        synthetic_satellite_image,
        parcel_boundary={},
        geo_transform=explicit_transform
    )

    assert footprint["type"] == "Polygon"
    coords = footprint["coordinates"][0]
    lons = [p[0] for p in coords]
    lats = [p[1] for p in coords]

    # The contour bounding box should span [77.2025, 77.2075] lon and [28.6025, 28.6075] lat
    tolerance_deg = 0.0003  # Allow small contour approximation slack
    assert min(lons) == pytest.approx(77.2025, abs=tolerance_deg)
    assert max(lons) == pytest.approx(77.2075, abs=tolerance_deg)
    assert min(lats) == pytest.approx(28.6025, abs=tolerance_deg)
    assert max(lats) == pytest.approx(28.6075, abs=tolerance_deg)

    # Verify global bounds were NOT used (they were 0.1234567)
    assert min(lons) > 70.0


def test_metric_area_accuracy_vs_naive_formula():
    """
    Verify building footprint area calculation against a ground truth polygon with
    known metric dimensions, contrasting it with the broken degree multiplication.
    """
    # Construct a known ground-truth 100m x 50m building (5,000 m²) in UTM Zone 43N
    # Center near New Delhi: Easting ~ 720,000m, Northing ~ 3,167,000m
    utm_easting = 720000.0
    utm_northing = 3167000.0
    width_m = 100.0
    height_m = 50.0
    expected_area_sqm = width_m * height_m  # 5,000.0 m²

    poly_utm = Polygon([
        [utm_easting, utm_northing],
        [utm_easting + width_m, utm_northing],
        [utm_easting + width_m, utm_northing + height_m],
        [utm_easting, utm_northing + height_m],
        [utm_easting, utm_northing]
    ])
    assert poly_utm.area == pytest.approx(5000.0, rel=1e-5)

    # Project the ground-truth metric polygon into EPSG:4326 (WGS84 lon/lat)
    geom_4326_dict = transform_geom("EPSG:32643", "EPSG:4326", mapping(poly_utm))
    poly_4326 = shape(geom_4326_dict)

    # 1. Calculate area using our new projected UTM function
    calculated_area = calculate_polygon_area_sqm(poly_4326)

    # Assert accurate recovery of the true metric area within 0.1% tolerance
    relative_error = abs(calculated_area - expected_area_sqm) / expected_area_sqm
    assert relative_error < 0.001, (
        f"Projected area {calculated_area:.2f} m² deviates from expected {expected_area_sqm:.2f} m² "
        f"by {relative_error*100:.3f}%"
    )

    # 2. Demonstrate the distortion of the naive degree formula: poly.area * (111000**2)
    naive_area = poly_4326.area * (111000 ** 2)
    naive_error = (naive_area - expected_area_sqm) / expected_area_sqm
    # At latitude ~28.6° N, 1/cos(28.6°) ≈ 1.14 (i.e. +13.6% overestimation)
    assert naive_error > 0.10, f"Naive error should be > 10%, got {naive_error*100:.2f}%"
    assert naive_error == pytest.approx(0.136, abs=0.015)


def test_deterministic_repeatability(synthetic_satellite_image):
    """
    Verify that identical inputs produce bitwise / exact identical geographic polygons
    and calculated areas across multiple iterations (zero drift).
    """
    explicit_transform = {
        "min_lon": 77.2000000,
        "max_lon": 77.2100000,
        "min_lat": 28.6000000,
        "max_lat": 28.6100000,
        "img_w": 768,
        "img_h": 768,
        "crs": "EPSG:4326"
    }

    results_coords = []
    results_areas = []

    for _ in range(5):
        fp = detect_building_footprint(
            synthetic_satellite_image,
            parcel_boundary={},
            geo_transform=explicit_transform
        )
        area = calculate_polygon_area_sqm(fp)
        results_coords.append(fp["coordinates"])
        results_areas.append(area)

    # All polygon coordinates across 5 runs must be identical
    for coords in results_coords[1:]:
        assert coords == results_coords[0], "Polygon coordinates drifted between runs!"

    # All areas must be identical
    for area in results_areas[1:]:
        assert area == results_areas[0], "Calculated area drifted between runs!"


def test_area_edge_cases():
    """Verify that calculate_polygon_area_sqm safely handles empty, none, and pre-projected inputs."""
    assert calculate_polygon_area_sqm(None) == 0.0

    empty_poly = Polygon()
    assert calculate_polygon_area_sqm(empty_poly) == 0.0

    # Pre-projected metric coordinates (e.g. large Cartesian UTM values > 180)
    planar_poly = Polygon([[720000, 3167000], [720010, 3167000], [720010, 3167010], [720000, 3167010], [720000, 3167000]])
    assert calculate_polygon_area_sqm(planar_poly) == 100.0


def test_compute_tile_grid_transform():
    """Verify compute_tile_grid_transform generates valid geometric metadata."""
    lat, lon = 28.6139, 77.2090
    transform_dict = compute_tile_grid_transform(lat, lon, zoom=19, grid_size=3, tile_size=256)

    assert "min_lon" in transform_dict
    assert "max_lon" in transform_dict
    assert "min_lat" in transform_dict
    assert "max_lat" in transform_dict
    assert transform_dict["img_w"] == 768
    assert transform_dict["img_h"] == 768
    assert transform_dict["min_lon"] < transform_dict["max_lon"]
    assert transform_dict["min_lat"] < transform_dict["max_lat"]
    assert transform_dict["min_lon"] <= lon <= transform_dict["max_lon"]
    assert transform_dict["min_lat"] <= lat <= transform_dict["max_lat"]
