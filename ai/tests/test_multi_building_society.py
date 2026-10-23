"""
Deterministic Synthetic Acceptance Test Suite: Multi-Building Society (Milestone 3)
===================================================================================
Location: Central Delhi (near 28.6139° N, 77.2090° E), UTM Zone 43N (EPSG:32643)
Origin: E = 715850.0 m, N = 3167050.0 m (Center: E = 716000.0 m, N = 3167200.0 m)

Validates:
1. 300m x 300m society parcel boundary has exact area 90,000 m².
2. Tower A has footprint 1,500 m² and 15 floors (built-up: 22,500 m²).
3. Tower B has footprint 1,600 m² and 10 floors (built-up: 16,000 m²).
4. Clubhouse has footprint 600 m² and 2 floors (built-up: 1,200 m²).
5. Aggregate metrics:
   - Total footprint: 3,700 m²
   - Total built-up area: 39,700 m²
   - Ground coverage ratio: ~0.041111 (~4.1111%)
6. Outside footprint is excluded by validation without silent clipping (unless explicitly requested).
7. Geometry ring normalization handles reversed orientation and shifted start vertices consistently.
8. Invalid boundaries and malformed coordinates are rejected by Pydantic/geometry validators.
9. GeoJSON serialization and reprojection satisfy documented precision tolerances (sub-2cm drift).
10. Strict determinism: 100% repeatable outputs across runs.
11. MultiFootprintDetector protocol conformance and candidate output schema.
12. Data contract integrity: official_ulpin is null, height sources distinguished, provenance tracked.

NOTE: Synthetic tests validate geometric calculations, coordinate transformations, and data contracts;
they do not claim or prove detection accuracy on arbitrary real-world satellite imagery.
"""

import math
import copy
import pytest
from typing import List, Tuple
from shapely.geometry import Polygon, box, shape, mapping
from rasterio.warp import transform

from ai.models import (
    SocietyProcessRequest,
    BuildingHint,
    BuildingHeight,
    BuildingRecord,
    SocietyProcessResponse
)
from ai.detector_protocol import (
    FootprintCandidate,
    MultiFootprintDetector,
    MockMultiFootprintDetector,
    normalize_geometry_ring,
    validate_and_filter_candidates
)
from ai.utils.geo_utils import calculate_polygon_area_sqm


# ─────────────────────────────────────────────────────────────────────────────
# Synthetic Society Setup (UTM EPSG:32643 -> EPSG:4326)
# ─────────────────────────────────────────────────────────────────────────────

# Corrected Central Delhi origin centered near 28.6139° N, 77.2090° E
ORIGIN_EASTING = 715850.0
ORIGIN_NORTHING = 3167050.0
UTM_CRS = "EPSG:32643"


def utm_box_to_geojson(min_e: float, min_n: float, max_e: float, max_n: float, round_decimals: int = 7) -> dict:
    """Convert an axis-aligned UTM bounding box to an EPSG:4326 GeoJSON Polygon."""
    xs = [min_e, max_e, max_e, min_e, min_e]
    ys = [min_n, min_n, max_n, max_n, min_n]
    lons, lats = transform(UTM_CRS, "EPSG:4326", xs, ys)
    coords = [[round(lon, round_decimals), round(lat, round_decimals)] for lon, lat in zip(lons, lats)]
    return {"type": "Polygon", "coordinates": [coords]}


def utm_box_to_polygon_full_precision(min_e: float, min_n: float, max_e: float, max_n: float) -> Polygon:
    """Return a Shapely Polygon in EPSG:4326 with full floating-point precision (unrounded)."""
    xs = [min_e, max_e, max_e, min_e, min_e]
    ys = [min_n, min_n, max_n, max_n, min_n]
    lons, lats = transform(UTM_CRS, "EPSG:4326", xs, ys)
    return Polygon(zip(lons, lats))


@pytest.fixture
def synthetic_society_data():
    """
    Constructs the approved synthetic residential society layout in Central Delhi:
    - Boundary: 300m x 300m (90,000 m²)
    - Tower A: 50m x 30m (1,500 m²), 15 floors
    - Tower B: 40m x 40m (1,600 m²), 10 floors
    - Clubhouse: 30m x 20m (600 m²), 2 floors
    - Outside Annex: 40m x 30m (1,200 m²), located at Easting E_0 + 320m (strictly outside)
    """
    e0, n0 = ORIGIN_EASTING, ORIGIN_NORTHING

    # 1. Society Boundary (300m x 300m)
    boundary_geojson = utm_box_to_geojson(e0, n0, e0 + 300.0, n0 + 300.0)
    boundary_poly_full = utm_box_to_polygon_full_precision(e0, n0, e0 + 300.0, n0 + 300.0)

    # 2. Tower A (50m x 30m = 1,500 m²)
    tower_a_geojson = utm_box_to_geojson(e0 + 30.0, n0 + 40.0, e0 + 80.0, n0 + 70.0)
    tower_a_poly_full = utm_box_to_polygon_full_precision(e0 + 30.0, n0 + 40.0, e0 + 80.0, n0 + 70.0)

    # 3. Tower B (40m x 40m = 1,600 m²)
    tower_b_geojson = utm_box_to_geojson(e0 + 150.0, n0 + 50.0, e0 + 190.0, n0 + 90.0)
    tower_b_poly_full = utm_box_to_polygon_full_precision(e0 + 150.0, n0 + 50.0, e0 + 190.0, n0 + 90.0)

    # 4. Clubhouse (30m x 20m = 600 m²)
    clubhouse_geojson = utm_box_to_geojson(e0 + 100.0, n0 + 200.0, e0 + 130.0, n0 + 220.0)
    clubhouse_poly_full = utm_box_to_polygon_full_precision(e0 + 100.0, n0 + 200.0, e0 + 130.0, n0 + 220.0)

    # 5. Outside Annex (40m x 30m = 1,200 m², E_0 + 320m to E_0 + 360m -> outside 300m boundary)
    outside_geojson = utm_box_to_geojson(e0 + 320.0, n0 + 50.0, e0 + 360.0, n0 + 80.0)

    return {
        "e0": e0,
        "n0": n0,
        "boundary_geojson": boundary_geojson,
        "boundary_poly_full": boundary_poly_full,
        "tower_a_geojson": tower_a_geojson,
        "tower_a_poly_full": tower_a_poly_full,
        "tower_b_geojson": tower_b_geojson,
        "tower_b_poly_full": tower_b_poly_full,
        "clubhouse_geojson": clubhouse_geojson,
        "clubhouse_poly_full": clubhouse_poly_full,
        "outside_geojson": outside_geojson
    }


# ─────────────────────────────────────────────────────────────────────────────
# 1. Society Boundary Area Test
# ─────────────────────────────────────────────────────────────────────────────

def test_synthetic_society_boundary_area(synthetic_society_data):
    """
    Test that a 300 m x 300 m society boundary has area 90,000 m².
    - Full double precision: exact within 0.001 m².
    - 7-decimal GeoJSON: within 2.0 m² (< 0.0025% reprojection rounding effect).
    """
    poly_full = synthetic_society_data["boundary_poly_full"]
    area_full = calculate_polygon_area_sqm(poly_full)
    assert abs(area_full - 90000.0) < 0.001, f"Expected 90,000 m², got {area_full}"

    poly_geojson = shape(synthetic_society_data["boundary_geojson"])
    area_geojson = calculate_polygon_area_sqm(poly_geojson)
    assert abs(area_geojson - 90000.0) < 2.0, f"Expected ~90,000 m², got {area_geojson}"


# ─────────────────────────────────────────────────────────────────────────────
# 2. Individual Building Footprints & Floor Specifications
# ─────────────────────────────────────────────────────────────────────────────

def test_individual_building_footprints_and_floors(synthetic_society_data):
    """
    Verify individual building specs:
    - Tower A: 1,500 m² footprint, 15 floors, 45.0m height
    - Tower B: 1,600 m² footprint, 10 floors, 30.0m height
    - Clubhouse: 600 m² footprint, 2 floors, 7.0m height
    """
    # Tower A
    poly_a = synthetic_society_data["tower_a_poly_full"]
    area_a = calculate_polygon_area_sqm(poly_a)
    assert abs(area_a - 1500.0) < 0.001
    record_a = BuildingRecord(
        internal_building_id="BLDG-SOC-A",
        society_id="SOC-DELHI-001",
        parcel_id="PARCEL-43N-001",
        building_name="Tower A",
        footprint=synthetic_society_data["tower_a_geojson"],
        area_sqm=1500.0,
        height=BuildingHeight(value_meters=45.0, source="estimated_from_floors", confidence=0.9),
        floor_count=15,
        floor_count_source="user_supplied",
        built_up_area_sqm=1500.0 * 15,
        detector_provenance={"detector_name": "synthetic_acceptance", "version": "1.0.0"}
    )
    assert record_a.floor_count == 15
    assert record_a.area_sqm == 1500.0
    assert record_a.built_up_area_sqm == 22500.0
    assert record_a.official_ulpin is None

    # Tower B
    poly_b = synthetic_society_data["tower_b_poly_full"]
    area_b = calculate_polygon_area_sqm(poly_b)
    assert abs(area_b - 1600.0) < 0.001
    record_b = BuildingRecord(
        internal_building_id="BLDG-SOC-B",
        society_id="SOC-DELHI-001",
        parcel_id="PARCEL-43N-001",
        building_name="Tower B",
        footprint=synthetic_society_data["tower_b_geojson"],
        area_sqm=1600.0,
        height=BuildingHeight(value_meters=30.0, source="user_supplied", confidence=1.0),
        floor_count=10,
        floor_count_source="user_supplied",
        built_up_area_sqm=1600.0 * 10,
        detector_provenance={"detector_name": "synthetic_acceptance", "version": "1.0.0"}
    )
    assert record_b.floor_count == 10
    assert record_b.area_sqm == 1600.0
    assert record_b.built_up_area_sqm == 16000.0

    # Clubhouse
    poly_c = synthetic_society_data["clubhouse_poly_full"]
    area_c = calculate_polygon_area_sqm(poly_c)
    assert abs(area_c - 600.0) < 0.001
    record_c = BuildingRecord(
        internal_building_id="BLDG-SOC-CLUB",
        society_id="SOC-DELHI-001",
        parcel_id="PARCEL-43N-001",
        building_name="Clubhouse",
        footprint=synthetic_society_data["clubhouse_geojson"],
        area_sqm=600.0,
        height=BuildingHeight(value_meters=7.0, source="measured", confidence=1.0, measured_accuracy_m=0.1),
        floor_count=2,
        floor_count_source="user_supplied",
        built_up_area_sqm=600.0 * 2,
        detector_provenance={"detector_name": "synthetic_acceptance", "version": "1.0.0"}
    )
    assert record_c.floor_count == 2
    assert record_c.area_sqm == 600.0
    assert record_c.built_up_area_sqm == 1200.0


# ─────────────────────────────────────────────────────────────────────────────
# 3. Aggregate Metrics & Ground Coverage Ratio
# ─────────────────────────────────────────────────────────────────────────────

def test_aggregate_metrics_and_ground_coverage(synthetic_society_data):
    """
    Test aggregate metrics:
    - Total Footprint Area = 1,500 + 1,600 + 600 = 3,700 m²
    - Total Built-Up Area = 22,500 + 16,000 + 1,200 = 39,700 m²
    - Ground Coverage Ratio = 3,700 / 90,000 ≈ 0.0411111 (~4.1111%)
    """
    buildings = [
        BuildingRecord(
            internal_building_id="BLDG-SOC-A", society_id="SOC-001", parcel_id="PARCEL-001",
            building_name="Tower A", footprint=synthetic_society_data["tower_a_geojson"],
            area_sqm=1500.0, height=BuildingHeight(value_meters=45.0, source="estimated_from_floors"),
            floor_count=15, built_up_area_sqm=22500.0
        ),
        BuildingRecord(
            internal_building_id="BLDG-SOC-B", society_id="SOC-001", parcel_id="PARCEL-001",
            building_name="Tower B", footprint=synthetic_society_data["tower_b_geojson"],
            area_sqm=1600.0, height=BuildingHeight(value_meters=30.0, source="user_supplied"),
            floor_count=10, built_up_area_sqm=16000.0
        ),
        BuildingRecord(
            internal_building_id="BLDG-SOC-CLUB", society_id="SOC-001", parcel_id="PARCEL-001",
            building_name="Clubhouse", footprint=synthetic_society_data["clubhouse_geojson"],
            area_sqm=600.0, height=BuildingHeight(value_meters=7.0, source="measured"),
            floor_count=2, built_up_area_sqm=1200.0
        )
    ]

    total_footprint = sum(b.area_sqm for b in buildings)
    total_built_up = sum(b.built_up_area_sqm for b in buildings)
    society_area = 90000.0
    coverage_ratio = total_footprint / society_area
    coverage_pct = coverage_ratio * 100.0

    assert total_footprint == 3700.0
    assert total_built_up == 39700.0
    assert abs(coverage_ratio - (37.0 / 900.0)) < 1e-9
    assert abs(coverage_pct - 4.111111) < 0.0001
    assert f"{coverage_pct:.4f}" == "4.1111"

    # Assemble and validate SocietyProcessResponse model
    response = SocietyProcessResponse(
        status="success",
        society_id="SOC-001",
        parcel_id="PARCEL-001",
        boundary=synthetic_society_data["boundary_geojson"],
        total_society_area_sqm=society_area,
        total_footprint_area_sqm=total_footprint,
        total_built_up_area_sqm=total_built_up,
        ground_coverage_ratio=coverage_ratio,
        ground_coverage_pct=round(coverage_pct, 4),
        buildings_detected_count=len(buildings),
        buildings=buildings,
        official_ulpin=None
    )
    assert response.status == "success"
    assert response.official_ulpin is None
    assert response.buildings_detected_count == 3


# ─────────────────────────────────────────────────────────────────────────────
# 4. Outside Footprint Exclusion Without Silent Clipping
# ─────────────────────────────────────────────────────────────────────────────

def test_outside_footprint_excluded_without_silent_clipping(synthetic_society_data):
    """
    Test that a footprint outside the society is excluded by the validation function
    without silently clipping it, unless allow_clipping=True is explicitly specified.
    """
    boundary_geojson = synthetic_society_data["boundary_geojson"]
    outside_geojson = synthetic_society_data["outside_geojson"]

    candidates = [
        FootprintCandidate(
            candidate_id="CAND-INSIDE-A",
            geometry=synthetic_society_data["tower_a_geojson"],
            confidence=0.95,
            detector_name="test_detector",
            detector_version="1.0"
        ),
        FootprintCandidate(
            candidate_id="CAND-OUTSIDE",
            geometry=outside_geojson,
            confidence=0.90,
            detector_name="test_detector",
            detector_version="1.0"
        )
    ]

    # Policy 1: Default allow_clipping=False -> Outside candidate must be excluded, NOT clipped!
    valid_cands, excluded = validate_and_filter_candidates(
        candidates, boundary_geojson, allow_clipping=False
    )
    assert len(valid_cands) == 1
    assert valid_cands[0].candidate_id == "CAND-INSIDE-A"

    assert len(excluded) == 1
    assert excluded[0]["candidate_id"] == "CAND-OUTSIDE"
    assert excluded[0]["reason"] == "strictly_outside_boundary"
    # Verify raw geometry was NOT modified
    assert excluded[0]["raw_geometry"] == outside_geojson

    # Policy 2: allow_clipping=True on strictly outside footprint -> still excluded (clipping is empty)
    valid_cands_clip, excluded_clip = validate_and_filter_candidates(
        [candidates[1]], boundary_geojson, allow_clipping=True
    )
    assert len(valid_cands_clip) == 0
    assert len(excluded_clip) == 1


# ─────────────────────────────────────────────────────────────────────────────
# 5. Geometry Ring Normalization (Reversed & Shifted Vertices)
# ─────────────────────────────────────────────────────────────────────────────

def test_geometry_normalization_equivalent_representations():
    """
    Verify that normalize_geometry_ring handles equivalent geometries consistently:
    - Counter-Clockwise ring
    - Clockwise reversed ring
    - Ring with cyclically shifted starting vertices
    All must normalize to the exact identical coordinate sequence and area.
    """
    # Ring A: Canonical CCW starting at (0, 0)
    ring_ccw = [[0.0, 0.0], [10.0, 0.0], [10.0, 10.0], [0.0, 10.0], [0.0, 0.0]]
    # Ring B: Clockwise reversed
    ring_cw = [[0.0, 0.0], [0.0, 10.0], [10.0, 10.0], [10.0, 0.0], [0.0, 0.0]]
    # Ring C: Shifted starting point at vertex (10, 0)
    ring_shifted_1 = [[10.0, 0.0], [10.0, 10.0], [0.0, 10.0], [0.0, 0.0], [10.0, 0.0]]
    # Ring D: Shifted starting point at vertex (10, 10) in CW direction
    ring_shifted_2_cw = [[10.0, 10.0], [10.0, 0.0], [0.0, 0.0], [0.0, 10.0], [10.0, 10.0]]

    norm_a = normalize_geometry_ring(ring_ccw)
    norm_b = normalize_geometry_ring(ring_cw)
    norm_c = normalize_geometry_ring(ring_shifted_1)
    norm_d = normalize_geometry_ring(ring_shifted_2_cw)

    assert norm_a == norm_b, "Clockwise reversed ring must normalize to identical vertices"
    assert norm_a == norm_c, "Shifted starting vertex ring must normalize to identical vertices"
    assert norm_a == norm_d, "Shifted CW ring must normalize to identical vertices"

    # All must start at the lexicographical minimum vertex (0.0, 0.0)
    assert norm_a[0] == [0.0, 0.0]
    assert norm_a[-1] == [0.0, 0.0]

    # Areas of original and normalized polygons must match exactly
    poly_orig = Polygon(ring_ccw)
    poly_norm = Polygon(norm_a)
    assert poly_orig.area == poly_norm.area == 100.0


# ─────────────────────────────────────────────────────────────────────────────
# 6. Rejection of Invalid Boundaries and Malformed Coordinates
# ─────────────────────────────────────────────────────────────────────────────

def test_invalid_boundary_and_malformed_coordinates_rejected():
    """
    Verify that Pydantic validators reject malformed boundaries, reversed lon/lat
    coordinates, non-closed rings, and negative dimensions.
    """
    valid_coords = [[[77.20, 28.60], [77.21, 28.60], [77.21, 28.61], [77.20, 28.61], [77.20, 28.60]]]

    # 1. Unclosed ring (coords[0] != coords[-1])
    unclosed = {"type": "Polygon", "coordinates": [[[77.20, 28.60], [77.21, 28.60], [77.21, 28.61], [77.20, 28.61]]]}
    with pytest.raises(ValueError, match="closed"):
        SocietyProcessRequest(
            society_id="SOC-001", parcel_id="P-001", boundary=unclosed
        )

    # 2. Too few vertices (< 4)
    degenerate = {"type": "Polygon", "coordinates": [[[77.20, 28.60], [77.21, 28.60], [77.20, 28.60]]]}
    with pytest.raises(ValueError, match="at least 4"):
        SocietyProcessRequest(
            society_id="SOC-001", parcel_id="P-001", boundary=degenerate
        )

    # 3. Coordinate order error / Latitude out of bounds (lon=28.6, lat=77.2 -> lat > 90)
    swapped_coords = {"type": "Polygon", "coordinates": [[[28.60, 177.20], [28.61, 177.20], [28.61, 177.21], [28.60, 177.21], [28.60, 177.20]]]}
    with pytest.raises(ValueError, match="Latitude out of bounds"):
        SocietyProcessRequest(
            society_id="SOC-001", parcel_id="P-001", boundary=swapped_coords
        )

    # 4. Self-intersecting bowtie polygon
    bowtie = {
        "type": "Polygon",
        "coordinates": [[[77.20, 28.60], [77.21, 28.61], [77.21, 28.60], [77.20, 28.61], [77.20, 28.60]]]
    }
    with pytest.raises(ValueError, match="invalid"):
        SocietyProcessRequest(
            society_id="SOC-001", parcel_id="P-001", boundary=bowtie
        )

    # 5. Invalid building dimensions in BuildingRecord (negative area / floor count <= 0)
    with pytest.raises(ValueError):
        BuildingRecord(
            internal_building_id="B-FAIL", society_id="S-1", parcel_id="P-1",
            footprint={"type": "Polygon", "coordinates": valid_coords},
            area_sqm=-100.0,  # Negative area rejected by gt=0
            height=BuildingHeight(value_meters=10.0, source="measured"),
            floor_count=5, built_up_area_sqm=500.0
        )

    with pytest.raises(ValueError):
        BuildingRecord(
            internal_building_id="B-FAIL", society_id="S-1", parcel_id="P-1",
            footprint={"type": "Polygon", "coordinates": valid_coords},
            area_sqm=100.0,
            height=BuildingHeight(value_meters=10.0, source="measured"),
            floor_count=0,  # Zero floor count rejected by gt=0
            built_up_area_sqm=500.0
        )


# ─────────────────────────────────────────────────────────────────────────────
# 7. GeoJSON Serialization & Reprojection Precision
# ─────────────────────────────────────────────────────────────────────────────

def test_geojson_serialization_and_reprojection_precision(synthetic_society_data):
    """
    Test coordinate precision when reprojecting between UTM EPSG:32643 and EPSG:4326.
    Converting to 7-decimal GeoJSON and reprojecting back to UTM must result in
    coordinate drift < 0.02m (2cm) and area error < 0.005%.
    """
    e0, n0 = synthetic_society_data["e0"], synthetic_society_data["n0"]
    orig_xs = [e0, e0 + 300.0, e0 + 300.0, e0, e0]
    orig_ys = [n0, n0, n0 + 300.0, n0 + 300.0, n0]

    # Forward: UTM -> EPSG:4326
    lons, lats = transform(UTM_CRS, "EPSG:4326", orig_xs, orig_ys)
    # Serialize to 7-decimal GeoJSON coordinates
    serialized_lons = [round(x, 7) for x in lons]
    serialized_lats = [round(y, 7) for y in lats]

    # Inverse: EPSG:4326 -> UTM
    reproj_xs, reproj_ys = transform("EPSG:4326", UTM_CRS, serialized_lons, serialized_lats)

    # Check maximum vertex drift in metres
    max_drift_e = max(abs(ox - rx) for ox, rx in zip(orig_xs, reproj_xs))
    max_drift_n = max(abs(oy - ry) for oy, ry in zip(orig_ys, reproj_ys))
    assert max_drift_e < 0.02, f"Easting drift exceeds 2cm: {max_drift_e:.4f}m"
    assert max_drift_n < 0.02, f"Northing drift exceeds 2cm: {max_drift_n:.4f}m"

    # Area comparison
    orig_poly = Polygon(zip(orig_xs, orig_ys))
    reproj_poly = Polygon(zip(reproj_xs, reproj_ys))
    area_diff = abs(orig_poly.area - reproj_poly.area)
    rel_error = area_diff / orig_poly.area
    assert rel_error < 0.00005, f"Relative area error exceeds 0.005%: {rel_error:.6f}"


# ─────────────────────────────────────────────────────────────────────────────
# 8. Deterministic Repeatability Across Runs
# ─────────────────────────────────────────────────────────────────────────────

def test_deterministic_repeatability_synthetic_runs(synthetic_society_data):
    """
    Verify that repeating synthetic geometry generation 50 times produces
    100% identical coordinate values and areas with 0 divergence.
    """
    e0, n0 = synthetic_society_data["e0"], synthetic_society_data["n0"]

    runs = []
    for _ in range(50):
        # Generate Tower A polygon
        ax = [e0 + 30.0, e0 + 80.0, e0 + 80.0, e0 + 30.0, e0 + 30.0]
        ay = [n0 + 40.0, n0 + 40.0, n0 + 70.0, n0 + 70.0, n0 + 40.0]
        alons, alats = transform(UTM_CRS, "EPSG:4326", ax, ay)
        coords = tuple((round(lon, 7), round(lat, 7)) for lon, lat in zip(alons, alats))
        runs.append(coords)

    # All 50 runs must be strictly identical
    first_run = runs[0]
    for i, r in enumerate(runs[1:], start=2):
        assert r == first_run, f"Run {i} deviated from deterministic run 1!"


# ─────────────────────────────────────────────────────────────────────────────
# 9. MultiFootprintDetector Protocol Conformance
# ─────────────────────────────────────────────────────────────────────────────

def test_multi_footprint_detector_protocol_conformance(synthetic_society_data):
    """
    Verify that MockMultiFootprintDetector conforms to the MultiFootprintDetector
    Protocol, returns valid FootprintCandidate objects, and preserves provenance.
    """
    detector = MockMultiFootprintDetector(
        detector_name="synthetic_society_evaluator",
        detector_version="1.0.0"
    )

    # Protocol runtime check
    assert isinstance(detector, MultiFootprintDetector)
    assert detector.detector_name == "synthetic_society_evaluator"
    assert detector.detector_version == "1.0.0"

    candidates = [
        FootprintCandidate(
            candidate_id="CAND-001",
            geometry=synthetic_society_data["tower_a_geojson"],
            confidence=0.98,
            detector_name=detector.detector_name,
            detector_version=detector.detector_version,
            estimated_area_sqm=1500.0,
            provenance={"synthetic_archetype": "high_rise"}
        ),
        FootprintCandidate(
            candidate_id="CAND-002",
            geometry=synthetic_society_data["tower_b_geojson"],
            confidence=0.95,
            detector_name=detector.detector_name,
            detector_version=detector.detector_version,
            estimated_area_sqm=1600.0,
            provenance={"synthetic_archetype": "mid_rise"}
        )
    ]
    detector.set_predefined_candidates(candidates)

    detected = detector.detect_footprints(boundary=synthetic_society_data["boundary_geojson"])
    assert len(detected) == 2
    assert detected[0].candidate_id == "CAND-001"
    assert detected[0].confidence == 0.98
    assert detected[0].detector_name == "synthetic_society_evaluator"
    assert detected[0].provenance["synthetic_archetype"] == "high_rise"


# ─────────────────────────────────────────────────────────────────────────────
# 10. Data Contract Provenance & Uncertainty Integrity
# ─────────────────────────────────────────────────────────────────────────────

def test_data_contract_provenance_and_height_distinction(synthetic_society_data):
    """
    Verify that data contracts properly distinguish measured, user-supplied,
    and estimated building heights, and track uncertainty and official_ulpin policy.
    """
    # 1. Measured height (e.g. from laser/survey)
    h_measured = BuildingHeight(
        value_meters=18.5,
        source="measured",
        confidence=1.0,
        measured_accuracy_m=0.05,
        assumption_notes="Calibrated terrestrial laser scan"
    )
    assert h_measured.source == "measured"
    assert h_measured.measured_accuracy_m == 0.05

    # 2. User supplied height
    h_user = BuildingHeight(
        value_meters=24.0,
        source="user_supplied",
        confidence=0.9,
        assumption_notes="Architectural floor plan submission"
    )
    assert h_user.source == "user_supplied"

    # 3. Estimated height (e.g. floor multiplication)
    h_est = BuildingHeight(
        value_meters=45.0,
        source="estimated_from_floors",
        confidence=0.75,
        assumption_notes="Assumed 3.0m per floor for 15 floors"
    )
    assert h_est.source == "estimated_from_floors"

    # 4. BuildingRecord contract verification
    bldg = BuildingRecord(
        internal_building_id="BLDG-CENTRAL-01",
        society_id="SOC-CENTRAL-DELHI",
        parcel_id="PARCEL-DL-001",
        building_name="Central Tower",
        official_ulpin=None,  # Null by default
        footprint=synthetic_society_data["tower_a_geojson"],
        area_sqm=1500.0,
        height=h_est,
        floor_count=15,
        built_up_area_sqm=22500.0,
        detector_provenance={
            "detector_name": "osm_vector_extractor",
            "version": "1.2.0",
            "raw_confidence": 0.95,
            "uncertainty_score": 0.05
        }
    )

    assert bldg.official_ulpin is None
    assert bldg.height.source == "estimated_from_floors"
    assert bldg.detector_provenance["uncertainty_score"] == 0.05
    assert bldg.is_within_boundary is True
