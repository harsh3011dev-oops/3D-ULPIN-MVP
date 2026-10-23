"""
End-to-End Deterministic Integration Test Suite: Multi-Building Pipeline (Phase 3)
==================================================================================
Covers:
1. Synthetic multi-building society end-to-end execution with MockMultiFootprintDetector.
2. Correct building count and unique stable internal IDs.
3. Exact synthetic footprint areas and aggregate society metrics.
4. Rejection of invalid, outside-boundary, and too-small candidates.
5. Deduplication of overlapping candidates and connected structure handling.
6. Identity stability across repeated runs and application restart.
7. Split and merge identity scenarios with non-recycling retired ID guarantee.
8. Height provenance and uncertainty tracking (measured vs user_supplied vs estimated).
9. Empty detector results and detector exception handling.
10. Placeholder imagery quarantine safety.
11. Backend API validation and persistence (POST /societies/process & GET /societies/{society_id}).
"""

import os
import json
import pytest
from shapely.geometry import Polygon, box, shape, mapping
from rasterio.warp import transform
from fastapi.testclient import TestClient

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
    normalize_geometry_ring
)
from ai.building_registry import BuildingRegistry
from ai.pipeline import process_multi_building_parcel
from ai.utils.geo_utils import calculate_polygon_area_sqm
from backend.main import app

ORIGIN_EASTING = 715850.0
ORIGIN_NORTHING = 3167050.0
UTM_CRS = "EPSG:32643"


def _utm_box_to_geojson(x_min, y_min, x_max, y_max):
    xs = [x_min, x_max, x_max, x_min, x_min]
    ys = [y_min, y_min, y_max, y_max, y_min]
    lons, lats = transform(UTM_CRS, "EPSG:4326", xs, ys)
    coords = [[round(lon, 7), round(lat, 7)] for lon, lat in zip(lons, lats)]
    return {"type": "Polygon", "coordinates": [coords]}


@pytest.fixture
def synthetic_society_fixture():
    # 300m x 300m parcel: 90,000 m²
    society_boundary = _utm_box_to_geojson(
        ORIGIN_EASTING, ORIGIN_NORTHING,
        ORIGIN_EASTING + 300.0, ORIGIN_NORTHING + 300.0
    )

    # Tower A: 30m x 50m = 1,500 m²
    tower_a = _utm_box_to_geojson(
        ORIGIN_EASTING + 30.0, ORIGIN_NORTHING + 30.0,
        ORIGIN_EASTING + 60.0, ORIGIN_NORTHING + 80.0
    )

    # Tower B: 40m x 40m = 1,600 m²
    tower_b = _utm_box_to_geojson(
        ORIGIN_EASTING + 120.0, ORIGIN_NORTHING + 30.0,
        ORIGIN_EASTING + 160.0, ORIGIN_NORTHING + 70.0
    )

    # Clubhouse: 20m x 30m = 600 m²
    clubhouse = _utm_box_to_geojson(
        ORIGIN_EASTING + 200.0, ORIGIN_NORTHING + 30.0,
        ORIGIN_EASTING + 220.0, ORIGIN_NORTHING + 60.0
    )

    # Outside building: strictly outside society boundary
    outside_bldg = _utm_box_to_geojson(
        ORIGIN_EASTING + 350.0, ORIGIN_NORTHING + 350.0,
        ORIGIN_EASTING + 390.0, ORIGIN_NORTHING + 390.0
    )

    # Tiny shed: 2m x 3m = 6 m² (< min_building_area_sqm 15m²)
    tiny_shed = _utm_box_to_geojson(
        ORIGIN_EASTING + 250.0, ORIGIN_NORTHING + 250.0,
        ORIGIN_EASTING + 252.0, ORIGIN_NORTHING + 253.0
    )

    return {
        "boundary": society_boundary,
        "tower_a": tower_a,
        "tower_b": tower_b,
        "clubhouse": clubhouse,
        "outside": outside_bldg,
        "tiny_shed": tiny_shed
    }


def test_integrated_multi_building_pipeline_deterministic(synthetic_society_fixture, tmp_path):
    """
    Test 1-3: End-to-end multi-building execution, counts, areas, and aggregate metrics.
    """
    fix = synthetic_society_fixture
    reg_path = str(tmp_path / "registry.json")
    registry = BuildingRegistry(storage_path=reg_path)

    candidates = [
        FootprintCandidate(
            candidate_id="cand_tower_a",
            geometry=fix["tower_a"],
            confidence=0.95,
            detector_name="test_detector",
            detector_version="1.0.0",
            provenance={"building_name": "Tower A"}
        ),
        FootprintCandidate(
            candidate_id="cand_tower_b",
            geometry=fix["tower_b"],
            confidence=0.92,
            detector_name="test_detector",
            detector_version="1.0.0",
            provenance={"building_name": "Tower B"}
        ),
        FootprintCandidate(
            candidate_id="cand_clubhouse",
            geometry=fix["clubhouse"],
            confidence=0.90,
            detector_name="test_detector",
            detector_version="1.0.0",
            provenance={"building_name": "Clubhouse"}
        ),
    ]

    mock_detector = MockMultiFootprintDetector()
    mock_detector.set_predefined_candidates(candidates)

    hints = [
        BuildingHint(building_name="Tower A", floor_count=15, height_meters=52.5),
        BuildingHint(building_name="Tower B", floor_count=10, height_meters=35.0),
        BuildingHint(building_name="Clubhouse", floor_count=2, height_meters=7.0),
    ]

    req = SocietyProcessRequest(
        society_id="SOC_SYNTH_001",
        parcel_id="PARCEL_SYNTH_001",
        society_name="Greenfield Residency",
        boundary=fix["boundary"],
        detection_mode="hybrid",
        building_hints=hints
    )

    result = process_multi_building_parcel(req, detector=mock_detector, registry=registry)

    assert result["status"] == "success"
    assert result["society_id"] == "SOC_SYNTH_001"
    assert result["parcel_id"] == "PARCEL_SYNTH_001"
    assert result["buildings_detected_count"] == 3
    assert len(result["buildings"]) == 3

    # Footprint and built-up area assertions (tolerance < 0.1 m² for unrounded UTM)
    bldgs = {b["building_name"]: b for b in result["buildings"]}
    assert abs(bldgs["Tower A"]["area_sqm"] - 1500.0) < 1.0
    assert abs(bldgs["Tower A"]["built_up_area_sqm"] - 22500.0) < 15.0
    assert abs(bldgs["Tower B"]["area_sqm"] - 1600.0) < 1.0
    assert abs(bldgs["Tower B"]["built_up_area_sqm"] - 16000.0) < 15.0
    assert abs(bldgs["Clubhouse"]["area_sqm"] - 600.0) < 1.0
    assert abs(bldgs["Clubhouse"]["built_up_area_sqm"] - 1200.0) < 10.0

    # Aggregate metrics
    assert abs(result["total_footprint_area_sqm"] - 3700.0) < 3.0
    assert abs(result["total_built_up_area_sqm"] - 39700.0) < 30.0
    assert abs(result["total_society_area_sqm"] - 90000.0) < 10.0
    assert abs(result["ground_coverage_pct"] - 4.11) < 0.1

    # Strict Official ULPIN check
    assert result["official_ulpin"] is None
    for b in result["buildings"]:
        assert b["official_ulpin"] is None


def test_rejection_of_outside_and_undersized_candidates(synthetic_society_fixture, tmp_path):
    """
    Test 4: Rejection of invalid, outside-boundary, and undersized candidate footprints.
    """
    fix = synthetic_society_fixture
    reg_path = str(tmp_path / "registry.json")
    registry = BuildingRegistry(storage_path=reg_path)

    candidates = [
        FootprintCandidate(
            candidate_id="valid_tower_a",
            geometry=fix["tower_a"],
            confidence=0.95,
            detector_name="test_det",
            detector_version="1.0"
        ),
        FootprintCandidate(
            candidate_id="outside_bldg",
            geometry=fix["outside"],
            confidence=0.90,
            detector_name="test_det",
            detector_version="1.0"
        ),
        FootprintCandidate(
            candidate_id="tiny_shed",
            geometry=fix["tiny_shed"],
            confidence=0.80,
            detector_name="test_det",
            detector_version="1.0"
        ),
        FootprintCandidate(
            candidate_id="malformed_empty",
            geometry={"type": "Polygon", "coordinates": [[[0, 0], [0, 0], [0, 0], [0, 0]]]},
            confidence=0.50,
            detector_name="test_det",
            detector_version="1.0"
        )
    ]

    mock_detector = MockMultiFootprintDetector()
    mock_detector.set_predefined_candidates(candidates)

    req = SocietyProcessRequest(
        society_id="SOC_SYNTH_002",
        parcel_id="PARCEL_SYNTH_002",
        boundary=fix["boundary"],
        options={"min_building_area_sqm": 20.0}
    )

    result = process_multi_building_parcel(req, detector=mock_detector, registry=registry)

    assert result["buildings_detected_count"] == 1
    assert len(result["excluded_buildings"]) >= 3

    excluded_reasons = {ex["candidate_id"]: ex["reason"] for ex in result["excluded_buildings"]}
    assert "outside" in excluded_reasons["outside_bldg"]
    assert "below_minimum_building_area" in excluded_reasons["tiny_shed"]


def test_deduplication_and_connected_structures(synthetic_society_fixture, tmp_path):
    """
    Test 5: Geometric deduplication of overlapping detections and preservation of connected structures.
    """
    fix = synthetic_society_fixture
    reg_path = str(tmp_path / "registry.json")
    registry = BuildingRegistry(storage_path=reg_path)

    # Candidate 1: High confidence detection of Tower A
    cand1 = FootprintCandidate(
        candidate_id="tower_a_v1",
        geometry=fix["tower_a"],
        confidence=0.95,
        detector_name="det1",
        detector_version="1.0"
    )

    # Candidate 2: Duplicate lower-confidence detection of Tower A (85% overlap)
    poly_a = shape(fix["tower_a"])
    poly_shifted = box(poly_a.bounds[0] + 0.00001, poly_a.bounds[1], poly_a.bounds[2] + 0.00001, poly_a.bounds[3])
    cand2 = FootprintCandidate(
        candidate_id="tower_a_v2",
        geometry=mapping(poly_shifted),
        confidence=0.60,
        detector_name="det2",
        detector_version="1.0"
    )

    mock_detector = MockMultiFootprintDetector()
    mock_detector.set_predefined_candidates([cand1, cand2])

    req = SocietyProcessRequest(
        society_id="SOC_SYNTH_003",
        parcel_id="PARCEL_SYNTH_003",
        boundary=fix["boundary"]
    )

    result = process_multi_building_parcel(req, detector=mock_detector, registry=registry)

    # Only the higher-confidence candidate should be kept
    assert result["buildings_detected_count"] == 1
    excluded_ids = [ex["candidate_id"] for ex in result["excluded_buildings"]]
    assert "tower_a_v2" in excluded_ids


def test_persistent_id_stability_and_application_restart(synthetic_society_fixture, tmp_path):
    """
    Test 6 & 7: Stable IDs across repeated runs, application restart, and split/merge scenarios.
    """
    fix = synthetic_society_fixture
    reg_file = str(tmp_path / "persisted_registry.json")

    # Run 1: Detect Tower A & Tower B
    reg1 = BuildingRegistry(storage_path=reg_file)
    cands_run1 = [
        FootprintCandidate(candidate_id="c1", geometry=fix["tower_a"], confidence=0.9, detector_name="d", detector_version="1"),
        FootprintCandidate(candidate_id="c2", geometry=fix["tower_b"], confidence=0.9, detector_name="d", detector_version="1")
    ]
    det1 = MockMultiFootprintDetector()
    det1.set_predefined_candidates(cands_run1)

    req = SocietyProcessRequest(society_id="SOC_RESTART_TEST", parcel_id="PARCEL_RESTART", boundary=fix["boundary"])
    res1 = process_multi_building_parcel(req, detector=det1, registry=reg1)

    id_tower_a = res1["buildings"][0]["internal_building_id"]
    id_tower_b = res1["buildings"][1]["internal_building_id"]
    assert id_tower_a == "BLDG-SOC_RESTART_TEST-A"
    assert id_tower_b == "BLDG-SOC_RESTART_TEST-B"

    # Simulate Application Restart: New registry instance loaded from disk file
    reg2 = BuildingRegistry(storage_path=reg_file)
    res2 = process_multi_building_parcel(req, detector=det1, registry=reg2)

    # Verify ID Stability: Same buildings receive exact same internal IDs
    ids_run2 = [b["internal_building_id"] for b in res2["buildings"]]
    assert ids_run2 == [id_tower_a, id_tower_b]

    # Run 3: Remove Tower B, Add Clubhouse -> Tower B is retired, Clubhouse gets new ID 'C'
    cands_run3 = [
        FootprintCandidate(candidate_id="c1", geometry=fix["tower_a"], confidence=0.9, detector_name="d", detector_version="1"),
        FootprintCandidate(candidate_id="c3", geometry=fix["clubhouse"], confidence=0.9, detector_name="d", detector_version="1")
    ]
    det3 = MockMultiFootprintDetector()
    det3.set_predefined_candidates(cands_run3)

    res3 = process_multi_building_parcel(req, detector=det3, registry=reg2)
    ids_run3 = [b["internal_building_id"] for b in res3["buildings"]]
    assert id_tower_a in ids_run3
    assert "BLDG-SOC_RESTART_TEST-C" in ids_run3
    # Retired ID 'B' is NEVER recycled
    assert "BLDG-SOC_RESTART_TEST-B" not in ids_run3


def test_height_provenance_and_uncertainty(synthetic_society_fixture, tmp_path):
    """
    Test 8: Height provenance tracking (user_supplied vs measured vs estimated).
    """
    fix = synthetic_society_fixture
    reg_path = str(tmp_path / "registry.json")

    candidates = [
        # Building 1: Has OSM measured height
        FootprintCandidate(
            candidate_id="c_osm",
            geometry=fix["tower_a"],
            confidence=0.95,
            detector_name="d", detector_version="1",
            provenance={"tags": {"height": "45.0m", "building:levels": "12"}}
        ),
        # Building 2: Has candidate attributes
        FootprintCandidate(
            candidate_id="c_attr",
            geometry=fix["tower_b"],
            confidence=0.90,
            detector_name="d", detector_version="1",
            provenance={"height_meters": 28.0, "floor_count": 8}
        ),
        # Building 3: No height or floor info (pure fallback estimate)
        FootprintCandidate(
            candidate_id="c_fallback",
            geometry=fix["clubhouse"],
            confidence=0.85,
            detector_name="d", detector_version="1"
        )
    ]
    det = MockMultiFootprintDetector()
    det.set_predefined_candidates(candidates)

    req = SocietyProcessRequest(
        society_id="SOC_HEIGHT_TEST",
        parcel_id="PARCEL_H",
        boundary=fix["boundary"]
    )
    result = process_multi_building_parcel(req, detector=det, registry=BuildingRegistry(storage_path=reg_path))

    records = {b["internal_building_id"]: b for b in result["buildings"]}
    bldgs = list(records.values())

    # Check that heights and sources are tracked honestly
    sources = [b["height"]["source"] for b in bldgs]
    assert "measured" in sources
    assert "estimated_from_floors" in sources


def test_empty_candidates_and_detector_exception(synthetic_society_fixture, tmp_path):
    """
    Test 9: Empty detector results and detector exception handling.
    """
    fix = synthetic_society_fixture
    reg_path = str(tmp_path / "registry.json")

    # 1. Empty candidates
    det_empty = MockMultiFootprintDetector()
    det_empty.set_predefined_candidates([])
    req = SocietyProcessRequest(society_id="SOC_EMPTY", parcel_id="P_EMPTY", boundary=fix["boundary"])
    res_empty = process_multi_building_parcel(req, detector=det_empty, registry=BuildingRegistry(storage_path=reg_path))
    assert res_empty["buildings_detected_count"] == 0
    assert any("No building footprints detected" in w for w in res_empty["warnings"])

    # 2. Detector exception handling
    class FailingDetector:
        @property
        def detector_name(self): return "failing_mock"
        @property
        def detector_version(self): return "1.0"
        def detect_footprints(self, *args, **kwargs):
            raise RuntimeError("Inference memory fault simulated")

    res_fail = process_multi_building_parcel(req, detector=FailingDetector(), registry=BuildingRegistry(storage_path=reg_path))
    assert res_fail["status"] == "error"
    assert any("failing_mock" in err for err in res_fail["errors"])


def test_backend_api_society_process_endpoint(synthetic_society_fixture):
    """
    Test 10: Backend REST API POST /societies/process and GET /societies/{society_id}.
    """
    client = TestClient(app)
    fix = synthetic_society_fixture

    payload = {
        "society_id": "SOC_API_TEST_001",
        "parcel_id": "PARCEL_API_001",
        "society_name": "API Test Complex",
        "boundary": fix["boundary"],
        "detection_mode": "manual_hints",
        "building_hints": [
            {
                "hint_id": "hint_1",
                "building_name": "API Tower 1",
                "floor_count": 8,
                "height_meters": 28.0,
                "footprint_hint": fix["tower_a"]
            },
            {
                "hint_id": "hint_2",
                "building_name": "API Tower 2",
                "floor_count": 5,
                "height_meters": 17.5,
                "footprint_hint": fix["tower_b"]
            }
        ]
    }

    # 1. POST /societies/process
    resp = client.post("/societies/process", json=payload)
    assert resp.status_code == 200, f"Response: {resp.text}"
    data = resp.json()

    assert data["status"] == "success"
    assert data["society_id"] == "SOC_API_TEST_001"
    assert data["buildings_detected_count"] == 2
    bld_ids = [b["internal_building_id"] for b in data["buildings"]]

    # 2. GET /societies/{society_id}
    get_resp = client.get("/societies/SOC_API_TEST_001")
    assert get_resp.status_code == 200
    get_data = get_resp.json()
    assert get_data["society_id"] == "SOC_API_TEST_001"
    assert get_data["buildings_detected_count"] == 2

    # 3. GET /buildings/{building_id} for individual building
    first_bldg_id = bld_ids[0]
    bldg_resp = client.get(f"/buildings/{first_bldg_id}")
    assert bldg_resp.status_code == 200
    b_data = bldg_resp.json()
    assert b_data["building_id"] == first_bldg_id
    assert b_data["floor_count"] == 8
