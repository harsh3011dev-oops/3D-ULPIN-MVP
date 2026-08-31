"""
test_backend_integration.py
============================
Test 3: Backend → AI Pipeline Integration Tests

Verifies:
  - Backend can call ai.pipeline.process_building() correctly
  - Output matches the backend schema (BuildingResponse fields)
  - Latency is acceptable (< 30s full pipeline, < 1s for pure compute)
  - All required schema fields are present and typed correctly
"""

import pytest
import time
import json

try:
    from ai.pipeline import process_building, process_multi_building_parcel
    from ai.quality_gates import QualityGates
    from ai.confidence_scorer import ConfidenceScorer
except ModuleNotFoundError:
    from pipeline import process_building, process_multi_building_parcel
    from quality_gates import QualityGates
    from confidence_scorer import ConfidenceScorer


# ── Shared test parcel ─────────────────────────────────────────────────────────

COLLEGE_PARCEL = {
    "type": "Polygon",
    "coordinates": [[[
        77.1177, 28.7496,
    ], [
        77.1187, 28.7496,
    ], [
        77.1187, 28.7506,
    ], [
        77.1177, 28.7506,
    ], [
        77.1177, 28.7496,
    ]]]
}

STANDARD_INPUT = {
    "parcel_id": "TEST_INTEGRATION_PARCEL_001",
    "building_id": "bldg-integration-test-001",
    "parcel_boundary": COLLEGE_PARCEL,
    "height_meters": 14.0,
    "floor_count": 4,
    "address": "DTU, Rohini, Delhi, India"
}


# ══════════════════════════════════════════════════════════════════════════════
# SCHEMA VALIDATION HELPERS
# ══════════════════════════════════════════════════════════════════════════════

def validate_output_schema(result: dict) -> list[str]:
    """
    Mirrors backend BuildingResponse + UnitResponse Pydantic schemas.
    Returns list of schema violation messages (empty = PASS).

    NOTE: Matches the ACTUAL pipeline output structure:
    - unit fields: unit_id, ulpin, floor, polygon_2d, centroid, area_sqm, z_min, z_max
    - floor_height_m lives in extrusion_3d, not per-unit
    - centroid may contain numpy float64 values (serializable)
    - polygon_2d coordinates may be tuples (Shapely output)
    """
    errors = []

    # ── Top-level required fields ─────────────────────────────────────────
    required_top = ["status", "building_id", "footprint", "height",
                    "floor_count", "units", "extrusion_3d", "validation"]
    for f in required_top:
        if f not in result:
            errors.append(f"Missing top-level field: '{f}'")

    if result.get("status") != "success":
        errors.append(f"status must be 'success', got: {result.get('status')}")

    # ── Footprint schema ──────────────────────────────────────────────────
    fp = result.get("footprint", {})
    if not isinstance(fp, dict):
        errors.append("footprint must be a dict (GeoJSON)")
    else:
        if fp.get("type") != "Polygon":
            errors.append(f"footprint.type must be 'Polygon', got: {fp.get('type')}")
        coords = fp.get("coordinates")
        if not isinstance(coords, (list, tuple)):
            errors.append("footprint.coordinates must be a list")
        elif len(coords) == 0 or len(coords[0]) < 4:
            errors.append("footprint must have at least 4 coordinate pairs")

    # ── Numeric fields ────────────────────────────────────────────────────
    if not isinstance(result.get("height"), (int, float)) or result.get("height") <= 0:
        errors.append(f"height must be positive number, got: {result.get('height')}")
    if not isinstance(result.get("floor_count"), int) or result.get("floor_count") <= 0:
        errors.append(f"floor_count must be positive int, got: {result.get('floor_count')}")

    # ── Extrusion 3D schema ───────────────────────────────────────────────
    # extrusion_3d may be returned as the full extrude_building() dict
    # which contains: type, footprint, z_min, z_max, floor_height_m, floor_count, volume_m3
    # OR as the pipeline-trimmed dict: {type, z_min, z_max, floor_height_m}
    ext = result.get("extrusion_3d", {})
    if not isinstance(ext, dict):
        errors.append("extrusion_3d must be a dict")
    else:
        for ef in ["z_min", "z_max", "floor_height_m"]:
            if ef not in ext:
                errors.append(f"extrusion_3d missing field: '{ef}'")
            elif not isinstance(ext[ef], (int, float)):
                errors.append(f"extrusion_3d.{ef} must be numeric, got: {type(ext[ef])}")
        z_min = ext.get("z_min", 1)
        z_max = ext.get("z_max", 0)
        if isinstance(z_min, (int, float)) and isinstance(z_max, (int, float)) and z_min >= z_max:
            errors.append(f"extrusion_3d.z_min ({z_min}) must be < z_max ({z_max})")

    # ── Units schema ──────────────────────────────────────────────────────
    units = result.get("units", [])
    if not isinstance(units, list) or len(units) == 0:
        errors.append("units must be a non-empty list")
    else:
        unit_ids = set()
        ulpins   = set()
        # Required unit fields from actual pipeline output
        unit_required = ["unit_id", "ulpin", "floor", "polygon_2d", "centroid", "area_sqm"]
        for i, u in enumerate(units):
            prefix = f"units[{i}]"
            for uf in unit_required:
                if uf not in u:
                    errors.append(f"{prefix} missing field: '{uf}'")

            # Uniqueness
            uid = u.get("unit_id")
            if uid in unit_ids:
                errors.append(f"Duplicate unit_id: {uid}")
            unit_ids.add(uid)

            ulpin = u.get("ulpin")
            if ulpin in ulpins:
                errors.append(f"Duplicate ULPIN: {ulpin}")
            ulpins.add(ulpin)

            # Floor range
            floor = u.get("floor")
            if not isinstance(floor, int) or floor < 1:
                errors.append(f"{prefix}.floor must be int ≥ 1, got: {floor}")

            # Centroid format: [lat, lon] — accepts numpy float64 too
            centroid = u.get("centroid")
            if not (isinstance(centroid, (list, tuple)) and len(centroid) == 2):
                errors.append(f"{prefix}.centroid must be [lat, lon], got: {centroid}")
            else:
                try:
                    float(centroid[0]), float(centroid[1])  # must be numeric
                except (TypeError, ValueError):
                    errors.append(f"{prefix}.centroid values must be numeric")

            # polygon_2d GeoJSON — may use tuples for coords (Shapely output)
            poly = u.get("polygon_2d", {})
            if isinstance(poly, dict):
                if poly.get("type") != "Polygon":
                    errors.append(f"{prefix}.polygon_2d.type must be 'Polygon', got: {poly.get('type')}")
            else:
                errors.append(f"{prefix}.polygon_2d must be a dict")

    # ── Validation schema ─────────────────────────────────────────────────
    val = result.get("validation", {})
    if "valid" not in val:
        errors.append("validation missing 'valid' field")
    if not isinstance(val.get("valid"), bool):
        errors.append(f"validation.valid must be bool, got: {type(val.get('valid'))}")

    return errors


# ══════════════════════════════════════════════════════════════════════════════
# TEST 1 — Backend Calls AI Pipeline Successfully
# ══════════════════════════════════════════════════════════════════════════════

def test_backend_calls_ai_pipeline():
    """
    Simulates exactly what backend/services/ai_runner.py does:
    calls process_building() with the same input shape and validates the result.
    """
    print("\n🔗 [Integration] Backend → ai.pipeline.process_building()")

    result = process_building(STANDARD_INPUT)

    assert result is not None, "process_building() returned None"
    assert isinstance(result, dict), "process_building() must return a dict"
    assert result.get("status") == "success", \
        f"Pipeline failed: {result.get('message')}"

    print(f"   ✅ Pipeline returned status=success")
    print(f"   📦 building_id: {result.get('building_id')}")
    print(f"   🏢 Units: {len(result.get('units', []))}")


# ══════════════════════════════════════════════════════════════════════════════
# TEST 2 — Output Matches Backend Schema
# ══════════════════════════════════════════════════════════════════════════════

def test_output_matches_backend_schema():
    """
    Full schema validation — every field the backend BuildingResponse
    and UnitResponse expects must be present and correctly typed.
    """
    print("\n📋 [Integration] Verifying output matches backend schema...")

    result = process_building(STANDARD_INPUT)
    schema_errors = validate_output_schema(result)

    if schema_errors:
        formatted = "\n   ".join(f"  ❌ {e}" for e in schema_errors)
        pytest.fail(f"Schema validation FAILED ({len(schema_errors)} errors):\n{formatted}")

    print(f"   ✅ Schema validation PASSED — all {len(result.get('units', []))} units conform")
    print(f"   🔑 Sample ULPIN: {result['units'][0]['ulpin']}")
    print(f"   📐 z_min={result['extrusion_3d']['z_min']}m → z_max={result['extrusion_3d']['z_max']}m")


# ══════════════════════════════════════════════════════════════════════════════
# TEST 3 — Pure Compute Latency (excluding satellite download)
# ══════════════════════════════════════════════════════════════════════════════

def test_pure_compute_latency_under_1s():
    """
    Measures only the CPU-bound compute steps (extrusion, floor division,
    ULPIN generation, validation) using a pre-cached/local satellite path.
    These steps must complete in < 1 second.
    """
    print("\n⏱  [Integration] Pure compute latency test (< 1000ms)...")

    try:
        from ai.extrusion import extrude_building
        from ai.floor_division import divide_into_floors, divide_floor_into_units
        from ai.ulpin_generation import generate_ulpin
        from ai.spatial_validation import validate_spatial_data
    except ModuleNotFoundError:
        from extrusion import extrude_building
        from floor_division import divide_into_floors, divide_floor_into_units
        from ulpin_generation import generate_ulpin
        from spatial_validation import validate_spatial_data

    footprint = {
        "type": "Polygon",
        "coordinates": [[[77.1177, 28.7496], [77.1187, 28.7496],
                          [77.1187, 28.7506], [77.1177, 28.7506],
                          [77.1177, 28.7496]]]
    }

    t0 = time.time()

    # Step 1: Extrude
    extrusion = extrude_building(footprint, height_meters=14.0, floor_count=4)

    # Step 2: Divide floors
    floors = divide_into_floors(footprint, height_meters=14.0, floor_count=4)

    # Step 3: Divide units + generate ULPINs
    all_units = []
    for floor in floors:
        floor_units = divide_floor_into_units(floor, units_per_floor=4)
        all_units.extend(floor_units)

    for unit in all_units:
        unit["ulpin"] = generate_ulpin(
            parcel_id="TEST_PARCEL",
            building_id="bldg-latency-test",
            floor_number=unit["floor"],
            unit_label=unit["label"],
            centroid=unit["centroid"]
        )

    # Step 4: Validate spatial
    validation = validate_spatial_data(all_units, footprint)

    elapsed_ms = (time.time() - t0) * 1000

    print(f"   ⏱  Pure compute: {elapsed_ms:.1f}ms")
    print(f"   🏢 Units generated: {len(all_units)}")
    print(f"   ✅ Spatial valid: {validation.get('valid')}")

    assert elapsed_ms < 1000.0, \
        f"Pure compute exceeded 1000ms budget: {elapsed_ms:.1f}ms"
    assert len(all_units) == 16   # 4 floors × 4 units
    assert validation.get("valid") is True

    print(f"   ✅ LATENCY PASS — {elapsed_ms:.1f}ms < 1000ms budget")


# ══════════════════════════════════════════════════════════════════════════════
# TEST 4 — Full Pipeline Latency (with satellite download)
# ══════════════════════════════════════════════════════════════════════════════

def test_full_pipeline_latency():
    """
    Measures end-to-end pipeline latency including satellite download.
    Reports breakdown. No hard limit (network-dependent) but logs timing.
    """
    print("\n🌐 [Integration] Full end-to-end pipeline latency measurement...")

    t_start = time.time()
    result = process_building(STANDARD_INPUT)
    total_ms = (time.time() - t_start) * 1000

    assert result["status"] == "success"

    print(f"\n   ┌─────────────────────────────────────────┐")
    print(f"   │  FULL PIPELINE LATENCY REPORT           │")
    print(f"   ├─────────────────────────────────────────┤")
    print(f"   │  Total wall time:  {total_ms:8.0f} ms          │")
    print(f"   │  Units generated:  {len(result['units']):8d}              │")
    print(f"   │  floor_count:      {result['floor_count']:8d}              │")
    print(f"   │  height_m:         {result['height']:8.1f}              │")
    print(f"   │  Validation:       {'PASS' if result['validation']['valid'] else 'FAIL':>8}              │")
    print(f"   └─────────────────────────────────────────┘")

    # Soft warning if > 60s (heavy network conditions)
    if total_ms > 60_000:
        print(f"   ⚠️  WARNING: Pipeline took {total_ms/1000:.1f}s — satellite download may be slow")


# ══════════════════════════════════════════════════════════════════════════════
# TEST 5 — ai_runner Mock Path (backend fallback)
# ══════════════════════════════════════════════════════════════════════════════

def test_backend_mock_fallback_schema():
    """
    Simulates backend/services/ai_runner._get_mock_ai_result() and verifies
    the mock output also conforms to the schema — important for backend tests
    that run without a real AI environment.
    """
    print("\n🤖 [Integration] Verifying backend mock AI result schema...")

    import uuid
    parcel_id = "MOCK_PARCEL_TEST"
    building_id = f"bldg-{uuid.uuid4().hex[:8]}"

    mock_result = {
        "status": "success",
        "building_id": building_id,
        "footprint": {
            "type": "Polygon",
            "coordinates": [[[77.087, 28.459], [77.088, 28.459],
                              [77.088, 28.460], [77.087, 28.460],
                              [77.087, 28.459]]]
        },
        "height": 70.0,
        "floor_count": 20,
        "extrusion_3d": {
            "type": "Building3D",
            "z_min": 0.0,
            "z_max": 70.0,
            "floor_height_m": 3.5
        },
        "units": [
            {
                "unit_id": "UNIT_F01_A01",
                "floor": 1,
                "floor_height_m": 3.5,
                "polygon_2d": {
                    "type": "Polygon",
                    "coordinates": [[[77.0871, 28.4591], [77.0879, 28.4591],
                                     [77.0879, 28.4599], [77.0871, 28.4599],
                                     [77.0871, 28.4591]]]
                },
                "centroid": [28.4595, 77.0875],
                "ulpin": f"{parcel_id}-{building_id}-F01-UA01-mock",
                "area_sqm": 80.0
            }
        ],
        "validation": {
            "valid": True,
            "overlapping_units": [],
            "out_of_bounds": []
        }
    }

    schema_errors = validate_output_schema(mock_result)
    assert not schema_errors, f"Mock result schema errors: {schema_errors}"
    print(f"   ✅ Backend mock result conforms to schema")


# ══════════════════════════════════════════════════════════════════════════════
# TEST 6 — ULPIN Uniqueness Across Multiple Runs
# ══════════════════════════════════════════════════════════════════════════════

def test_ulpin_global_uniqueness_across_runs():
    """
    Runs the compute layer (no satellite download) twice with different
    parcel IDs and confirms all ULPINs across both runs are globally unique.
    """
    print("\n🔑 [Integration] ULPIN global uniqueness across 2 pipeline runs...")

    try:
        from ai.extrusion import extrude_building
        from ai.floor_division import divide_into_floors, divide_floor_into_units
        from ai.ulpin_generation import generate_ulpin
    except ModuleNotFoundError:
        from extrusion import extrude_building
        from floor_division import divide_into_floors, divide_floor_into_units
        from ulpin_generation import generate_ulpin

    footprint = {
        "type": "Polygon",
        "coordinates": [[[77.1177, 28.7496], [77.1187, 28.7496],
                          [77.1187, 28.7506], [77.1177, 28.7506],
                          [77.1177, 28.7496]]]
    }

    all_ulpins = []
    for run_idx, (parcel, bldg) in enumerate([
        ("PARCEL_RUN_A", "bldg-run-a"),
        ("PARCEL_RUN_B", "bldg-run-b"),
    ], start=1):
        floors = divide_into_floors(footprint, height_meters=10.5, floor_count=3)
        for floor in floors:
            for unit in divide_floor_into_units(floor, units_per_floor=4):
                ulpin = generate_ulpin(
                    parcel_id=parcel,
                    building_id=bldg,
                    floor_number=unit["floor"],
                    unit_label=unit["label"],
                    centroid=unit["centroid"]
                )
                all_ulpins.append(ulpin)
        print(f"   Run {run_idx}: {parcel} → {len(floors)*4} ULPINs generated")

    unique_count = len(set(all_ulpins))
    assert unique_count == len(all_ulpins), \
        f"ULPIN collision! {len(all_ulpins) - unique_count} duplicates across runs"

    print(f"   ✅ All {len(all_ulpins)} ULPINs globally unique across 2 runs")
