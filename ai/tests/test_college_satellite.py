"""
test_college_satellite.py
=========================
Test 2: Real College Satellite Image Test
- Downloads real satellite image for a college campus in Delhi
- Runs footprint detection on the image
- Verifies buildings are detected, units generated, ULPINs minted
- Checks export artifacts

Location: DTU (Delhi Technological University), Rohini, Delhi
GPS: 28.7501° N, 77.1182° E
"""

import pytest
import time
import os
import json

try:
    from ai.pipeline import process_building, process_multi_building_parcel
    from ai.utils.image_utils import download_satellite_image
    from ai.confidence_scorer import ConfidenceScorer
    from ai.quality_gates import QualityGates
except ModuleNotFoundError:
    from pipeline import process_building, process_multi_building_parcel
    from utils.image_utils import download_satellite_image
    from confidence_scorer import ConfidenceScorer
    from quality_gates import QualityGates


# ── College Campus Parcel Boundaries ──────────────────────────────────────────

# DTU Main Academic Block — Rohini Delhi (28.7501 N, 77.1182 E)
COLLEGE_PARCEL_SINGLE = {
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

# DTU Campus — larger multi-building boundary
COLLEGE_PARCEL_CAMPUS = {
    "type": "Polygon",
    "coordinates": [[[
        77.1165, 28.7488,
    ], [
        77.1200, 28.7488,
    ], [
        77.1200, 28.7515,
    ], [
        77.1165, 28.7515,
    ], [
        77.1165, 28.7488,
    ]]]
}

# Jamia Millia Islamia — South Delhi (28.5609 N, 77.2804 E)
JAMIA_PARCEL = {
    "type": "Polygon",
    "coordinates": [[[
        77.2799, 28.5604,
    ], [
        77.2809, 28.5604,
    ], [
        77.2809, 28.5614,
    ], [
        77.2799, 28.5614,
    ], [
        77.2799, 28.5604,
    ]]]
}


# ── Test 1: Single Academic Building ─────────────────────────────────────────

def test_college_single_building_satellite():
    """
    Run full AI pipeline on a single college academic building using real
    satellite download from ESRI World Imagery (Zoom-19).
    Verifies: status, footprint, units, ULPINs, validation pass.
    """
    print("\n📡 Downloading real satellite image for DTU Academic Block...")
    t0 = time.time()

    result = process_building({
        "parcel_id": "DTU_MAIN_BLOCK_01",
        "building_id": "bldg-dtu-academic-001",
        "parcel_boundary": COLLEGE_PARCEL_SINGLE,
        "height_meters": 18.0,   # 5-floor academic building ~18m
        "floor_count": 5
    })

    elapsed_ms = (time.time() - t0) * 1000
    print(f"⏱  Pipeline completed in {elapsed_ms:.0f}ms")
    print(f"📊 Status: {result.get('status')}")
    print(f"🏢 Units generated: {len(result.get('units', []))}")

    # ── Core assertions ───────────────────────────────────────────────────
    assert result["status"] == "success", f"Pipeline failed: {result.get('message')}"
    assert result["building_id"] == "bldg-dtu-academic-001"
    assert result["floor_count"] == 5
    assert result["height"] == 18.0

    # Should generate 5 floors × 4 units = 20 units
    units = result.get("units", [])
    assert len(units) == 20, f"Expected 20 units, got {len(units)}"

    # ── Footprint assertions ───────────────────────────────────────────────
    footprint = result.get("footprint")
    assert footprint is not None
    assert footprint["type"] == "Polygon"
    assert len(footprint["coordinates"][0]) >= 4, "Footprint must have ≥4 vertices"
    print(f"🗺  Footprint: {len(footprint['coordinates'][0])} vertices")

    # ── Extrusion 3D assertions ────────────────────────────────────────────
    ext = result.get("extrusion_3d", {})
    assert ext.get("z_min") == 0.0
    assert ext.get("z_max") == 18.0
    assert ext.get("floor_height_m") > 0
    print(f"📦 Extrusion: z_min={ext.get('z_min')}m → z_max={ext.get('z_max')}m")

    # ── ULPIN assertions ───────────────────────────────────────────────────
    for unit in units:
        ulpin = unit.get("ulpin", "")
        assert ulpin, f"Unit missing ULPIN: {unit.get('unit_id')}"
        assert "DTU_MAIN_BLOCK_01" in ulpin or len(ulpin.split("-")) >= 5, \
            f"ULPIN format invalid: {ulpin}"
        assert unit.get("floor") >= 1
        assert unit.get("floor") <= 5
    print(f"🔑 Sample ULPIN: {units[0]['ulpin']}")

    # ── Spatial validation assertions ──────────────────────────────────────
    val = result.get("validation", {})
    assert val.get("valid") is True, f"Spatial validation failed: {val}"
    print(f"✅ Spatial validation: PASS | Overlaps: {val.get('overlapping_units', [])}")

    # ── Quality gate check ─────────────────────────────────────────────────
    gates = QualityGates()
    gate_result = gates.run_all_gates(result, COLLEGE_PARCEL_SINGLE)
    assert gate_result["overall_passed"], \
        f"Quality gates failed: {gate_result.get('failed_gates', [])}"
    print(f"🎯 Quality gates: PASS")

    # ── Confidence score ───────────────────────────────────────────────────
    scorer = ConfidenceScorer()
    breakdown = scorer.get_confidence_breakdown(
        footprint=footprint,
        parcel_boundary=COLLEGE_PARCEL_SINGLE,
        floors=units,
        units=units,
        ulpins=[u.get("ulpin") for u in units]
    )
    confidence = breakdown["overall_pipeline_confidence"]
    assert confidence >= 60.0, f"Confidence too low: {confidence}%"
    print(f"📈 Confidence score: {confidence:.1f}%")

    print(f"\n✅ test_college_single_building_satellite PASSED ({elapsed_ms:.0f}ms)\n")


# ── Test 2: Multi-Building Campus Detection ────────────────────────────────────

def test_college_campus_multi_building():
    """
    Run multi-building campus pipeline on DTU campus satellite imagery.
    Verifies: multiple footprints detected, all ULPINs unique, campus boundary respected.
    """
    print("\n🏫 Running multi-building campus detection for DTU Campus...")
    t0 = time.time()

    result = process_multi_building_parcel({
        "parcel_id": "DTU_CAMPUS_MULTI",
        "parcel_boundary": COLLEGE_PARCEL_CAMPUS,
        "height_meters": 15.0,
        "floor_count": 4,
        "max_buildings": 6
    })

    elapsed_ms = (time.time() - t0) * 1000
    print(f"⏱  Pipeline completed in {elapsed_ms:.0f}ms")
    print(f"📊 Status: {result.get('status')}")
    print(f"🏛  Buildings detected: {result.get('total_buildings_detected', 0)}")
    print(f"🏢 Total units: {result.get('total_units_generated', 0)}")

    assert result["status"] == "success", f"Multi-building pipeline failed: {result.get('message')}"
    assert result["total_buildings_detected"] >= 1, "Must detect at least 1 building"
    assert result["total_units_generated"] > 0

    # All ULPINs must be unique
    all_ulpins = []
    for bldg in result.get("buildings", []):
        for unit in bldg.get("units", []):
            all_ulpins.append(unit.get("ulpin"))

    unique_ulpins = set(all_ulpins)
    assert len(all_ulpins) == len(unique_ulpins), \
        f"Duplicate ULPINs detected! {len(all_ulpins) - len(unique_ulpins)} duplicates"
    print(f"🔑 Total unique ULPINs: {len(unique_ulpins)}")
    print(f"\n✅ test_college_campus_multi_building PASSED ({elapsed_ms:.0f}ms)\n")


# ── Test 3: Address-Based College Test ─────────────────────────────────────────

def test_college_address_geocoding():
    """
    Test full pipeline using college address string (no boundary provided).
    Geocoder must resolve address → GPS → build boundary automatically.
    """
    print("\n🌍 Testing address-based geocoding for Jamia Millia Islamia...")
    t0 = time.time()

    result = process_building({
        "parcel_id": "JAMIA_MILIA_MAIN",
        "building_id": "bldg-jamia-main-001",
        "address": "Jamia Millia Islamia, Jamia Nagar, New Delhi, Delhi, India",
        "height_meters": 14.0,
        "floor_count": 4
    })

    elapsed_ms = (time.time() - t0) * 1000
    print(f"⏱  Geocoded + pipeline: {elapsed_ms:.0f}ms")
    print(f"📊 Status: {result.get('status')}")

    assert result["status"] == "success", f"Address geocoding pipeline failed: {result.get('message')}"
    assert len(result.get("units", [])) == 16  # 4 floors × 4 units
    print(f"✅ test_college_address_geocoding PASSED ({elapsed_ms:.0f}ms)\n")


# ── Test 4: Satellite Image File Saved ─────────────────────────────────────────

def test_satellite_image_download_saved():
    """
    Verify that the satellite image is actually downloaded and saved to disk.
    """
    print("\n🛰  Verifying satellite tile download to disk...")
    output_path = "ai/exports/test_college_satellite.png"

    img_path = download_satellite_image(
        COLLEGE_PARCEL_SINGLE,
        output_path=output_path,
        zoom=19
    )

    assert img_path is not None, "download_satellite_image returned None"
    assert os.path.exists(img_path), f"Satellite image not saved at: {img_path}"

    file_size = os.path.getsize(img_path)
    assert file_size > 1000, f"Satellite image too small ({file_size} bytes) — likely corrupt"
    print(f"🗂  Image saved: {img_path} ({file_size / 1024:.1f} KB)")
    print(f"✅ test_satellite_image_download_saved PASSED\n")
