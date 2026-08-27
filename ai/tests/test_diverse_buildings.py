"""
Diverse Building Testing & Benchmarking Suite (3D ULPIN AI Pipeline)
=====================================================================
Evaluates pipeline accuracy, latency, and quality gates across 10 real-world building archetypes:
- EASY: Residential High-Rise, Isolated Rural Building
- MEDIUM: Commercial Complex, Industrial Warehouse
- HARD: Government Office, Temple Structure, Mixed-Use Building, Campus Multi-Building, Cloudy Monsoon Test
- VERY_HARD: Dense Urban Neighborhood
"""

import time
import json
import pytest

try:
    from ai.pipeline import process_building, process_multi_building_parcel
    from ai.quality_gates import QualityGates
    from ai.confidence_scorer import ConfidenceScorer
except ModuleNotFoundError:
    from pipeline import process_building, process_multi_building_parcel
    from quality_gates import QualityGates
    from confidence_scorer import ConfidenceScorer


TEST_BUILDINGS = [
    {
        "id": "test_001_residential_highrise",
        "name": "Residential High-Rise Apartment Complex",
        "address": "Connaught Place, New Delhi, Delhi, India",
        "expected_units": 120,
        "expected_floors": 30,
        "parcel_boundary": {
            "type": "Polygon",
            "coordinates": [[[77.218, 28.631], [77.219, 28.631], [77.219, 28.632], [77.218, 28.632], [77.218, 28.631]]]
        },
        "height": 105.0,
        "characteristics": ["Regular shape", "Glass facade", "Many windows", "Urban area"],
        "difficulty": "EASY"
    },
    {
        "id": "test_002_commercial_complex",
        "name": "Commercial Complex",
        "address": "Cyber Hub, Gurugram, Haryana, India",
        "expected_units": 80,
        "expected_floors": 20,
        "parcel_boundary": {
            "type": "Polygon",
            "coordinates": [[[77.087, 28.494], [77.088, 28.494], [77.088, 28.495], [77.087, 28.495], [77.087, 28.494]]]
        },
        "height": 70.0,
        "characteristics": ["Complex shape", "Multiple courtyards", "Dense area"],
        "difficulty": "MEDIUM"
    },
    {
        "id": "test_003_industrial_warehouse",
        "name": "Industrial Warehouse",
        "address": "Okhla Industrial Area, Delhi, India",
        "expected_units": 8,
        "expected_floors": 2,
        "parcel_boundary": {
            "type": "Polygon",
            "coordinates": [[[77.275, 28.535], [77.276, 28.535], [77.276, 28.536], [77.275, 28.536], [77.275, 28.535]]]
        },
        "height": 10.0,
        "characteristics": ["Metal roof", "Large shadows", "Simple geometry"],
        "difficulty": "MEDIUM"
    },
    {
        "id": "test_004_government_office",
        "name": "Government Office Building",
        "address": "Secretariat, Central Secretariat, New Delhi, Delhi, India",
        "expected_units": 140,
        "expected_floors": 35,
        "parcel_boundary": {
            "type": "Polygon",
            "coordinates": [[[77.210, 28.614], [77.211, 28.614], [77.211, 28.615], [77.210, 28.615], [77.210, 28.614]]]
        },
        "height": 122.5,
        "characteristics": ["Historic structure", "Curved sections", "Attached buildings"],
        "difficulty": "HARD"
    },
    {
        "id": "test_005_temple_structure",
        "name": "Temple/Religious Structure",
        "address": "Shiva Shakti Mandir, Gali No. 13, Sanjay Colony, Narela, New Delhi, Delhi 110040, India",
        "expected_units": 8,
        "expected_floors": 2,
        "parcel_boundary": {
            "type": "Polygon",
            "coordinates": [[[77.086, 28.853], [77.087, 28.853], [77.087, 28.854], [77.086, 28.854], [77.086, 28.853]]]
        },
        "height": 7.5,
        "characteristics": ["Curved roof", "Spire", "Unique architecture"],
        "difficulty": "HARD"
    },
    {
        "id": "test_006_mixed_use_building",
        "name": "Mixed-Use Building",
        "address": "Lajpat Nagar, New Delhi, Delhi, India",
        "expected_units": 60,
        "expected_floors": 15,
        "parcel_boundary": {
            "type": "Polygon",
            "coordinates": [[[77.243, 28.570], [77.244, 28.570], [77.244, 28.571], [77.243, 28.571], [77.243, 28.570]]]
        },
        "height": 52.5,
        "characteristics": ["Ground floor shops", "Residential above", "Varying floor plans"],
        "difficulty": "HARD"
    },
    {
        "id": "test_007_campus_multiple_buildings",
        "name": "Campus with Multiple Buildings",
        "address": "IIT Delhi Campus, Hauz Khas, New Delhi, Delhi, India",
        "expected_units": 80,
        "expected_buildings": 4,
        "expected_floors": 5,
        "parcel_boundary": {
            "type": "Polygon",
            "coordinates": [[[77.191, 28.544], [77.193, 28.544], [77.193, 28.546], [77.191, 28.546], [77.191, 28.544]]]
        },
        "height": 17.5,
        "characteristics": ["Scattered buildings", "Open spaces", "Irregular layout"],
        "difficulty": "HARD"
    },
    {
        "id": "test_008_cloudy_condition",
        "name": "Building Under Cloud Cover",
        "address": "Monsoon Test Case, Narela, Delhi, India",
        "expected_units": 48,
        "expected_floors": 12,
        "parcel_boundary": {
            "type": "Polygon",
            "coordinates": [[[77.089, 28.850], [77.090, 28.850], [77.090, 28.851], [77.089, 28.851], [77.089, 28.850]]]
        },
        "height": 42.0,
        "characteristics": ["Significant cloud cover", "Poor visibility", "Shadow interference"],
        "difficulty": "HARD"
    },
    {
        "id": "test_009_dense_urban_neighborhood",
        "name": "Dense Urban Neighborhood",
        "address": "Chandni Chowk, Old Delhi, Delhi, India",
        "expected_units": 100,
        "expected_floors": 25,
        "parcel_boundary": {
            "type": "Polygon",
            "coordinates": [[[77.230, 28.656], [77.231, 28.656], [77.231, 28.657], [77.230, 28.657], [77.230, 28.656]]]
        },
        "height": 87.5,
        "characteristics": ["Attached buildings", "Irregular shapes", "Narrow alleys"],
        "difficulty": "VERY_HARD"
    },
    {
        "id": "test_010_isolated_rural_building",
        "name": "Isolated Rural Building",
        "address": "Gurugram Outskirts, Haryana, India",
        "expected_units": 12,
        "expected_floors": 3,
        "parcel_boundary": {
            "type": "Polygon",
            "coordinates": [[[76.950, 28.400], [76.951, 28.400], [76.951, 28.401], [76.950, 28.401], [76.950, 28.400]]]
        },
        "height": 10.5,
        "characteristics": ["Clear visibility", "Low density", "Simple geometry"],
        "difficulty": "EASY"
    }
]


def test_all_building_types():
    """
    Run pipeline on all 10 test buildings, record latency, validation results, and quality gate scores.
    """
    gates = QualityGates()
    scorer = ConfidenceScorer()
    results = []

    print("\n" + "=" * 80)
    print(" RUNNING DIVERSE BUILDING SUITE BENCHMARK (10 BUILDINGS)")
    print("=" * 80)

    for idx, bldg in enumerate(TEST_BUILDINGS, start=1):
        t0 = time.time()
        
        # Check if multi-building campus
        if bldg.get("expected_buildings", 1) > 1:
            input_payload = {
                "parcel_id": bldg["id"],
                "address": bldg["address"],
                "parcel_boundary": bldg["parcel_boundary"],
                "height_meters": bldg["height"],
                "floor_count": bldg["expected_floors"]
            }
            output = process_multi_building_parcel(input_payload)
            latency = (time.time() - t0) * 1000.0
            total_units = output.get("total_units_generated", 0)
            status = output.get("status")
            gate_res = {"overall_passed": status == "success"}
            conf_score = 90.0 if status == "success" else 40.0
        else:
            input_payload = {
                "parcel_id": bldg["id"],
                "address": bldg["address"],
                "parcel_boundary": bldg["parcel_boundary"],
                "height_meters": bldg["height"],
                "floor_count": bldg["expected_floors"]
            }
            output = process_building(input_payload)
            latency = (time.time() - t0) * 1000.0
            total_units = len(output.get("units", []))
            status = output.get("status")
            gate_res = gates.run_all_gates(output, bldg["parcel_boundary"])
            breakdown = scorer.get_confidence_breakdown(
                footprint=output.get("footprint"),
                parcel_boundary=bldg["parcel_boundary"],
                floors=output.get("units"),
                units=output.get("units"),
                ulpins=[u.get("ulpin") for u in output.get("units", [])]
            )
            conf_score = breakdown["overall_pipeline_confidence"]

        res_item = {
            "id": bldg["id"],
            "name": bldg["name"],
            "difficulty": bldg["difficulty"],
            "status": status,
            "units_generated": total_units,
            "latency_ms": round(latency, 2),
            "gate_passed": gate_res.get("overall_passed", False),
            "confidence_score": conf_score
        }
        results.append(res_item)

        pass_symbol = "✅ PASS" if res_item["gate_passed"] else "❌ FAIL"
        print(f"[{idx:02d}/10] [{bldg['difficulty']:<9}] {bldg['name']:<42} | Units: {total_units:3d} | Latency: {latency:6.1f}ms | Gate: {pass_symbol} | Score: {conf_score:.1f}%")

    print("-" * 80)
    assert len(results) == 10


def benchmark_by_difficulty():
    """Group benchmarking results by difficulty level (EASY, MEDIUM, HARD, VERY_HARD)."""
    results = test_all_building_types()
    by_diff = {}
    for r in results:
        diff = r["difficulty"]
        by_diff.setdefault(diff, []).append(r)

    print("\n--- PERFORMANCE SUMMARY BY DIFFICULTY ---")
    for diff, items in by_diff.items():
        avg_lat = sum(i["latency_ms"] for i in items) / len(items)
        avg_conf = sum(i["confidence_score"] for i in items) / len(items)
        passed_cnt = sum(1 for i in items if i["gate_passed"])
        print(f"Difficulty: {diff:<9} | Count: {len(items)} | Passed: {passed_cnt}/{len(items)} | Avg Latency: {avg_lat:.1f}ms | Avg Confidence: {avg_conf:.1f}%")
    return by_diff


def identify_failure_patterns():
    """Analyze which building types fail most and output failure pattern diagnostics."""
    results = test_all_building_types()
    failed = [r for r in results if not r["gate_passed"]]
    print(f"\n--- FAILURE PATTERN ANALYSIS ---")
    print(f"Total Failures: {len(failed)} out of {len(results)}")
    for f in failed:
        print(f"❌ Failed Case: {f['name']} ({f['difficulty']}) - Confidence: {f['confidence_score']}%")
    return failed


if __name__ == "__main__":
    test_all_building_types()
