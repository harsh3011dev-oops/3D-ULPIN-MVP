"""
Real Location Test: GPS Coordinates 28°51'14.39"N 77°05'47.95"E
================================================================
Narela / North Delhi area
"""

import json
import sys
import os

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))

from pipeline import process_building
from utils.exporter_utils import export_all_formats
from quality_gates import QualityGates
from confidence_scorer import ConfidenceScorer

# DMS -> Decimal Degrees conversion
# 28°51'14.39"N = 28 + 51/60 + 14.39/3600
LAT = 28 + 51/60 + 14.39/3600   # 28.85400°N
# 77°05'47.95"E = 77 + 5/60 + 47.95/3600
LON = 77 + 5/60 + 47.95/3600    # 77.09665°E

DELTA = 0.0005  # ~55 metres boundary radius

if __name__ == "__main__":
    print("=" * 70)
    print(" PIPELINE TEST: 28°51'14.39\"N  77°05'47.95\"E")
    print(f" Decimal → Lat: {LAT:.6f}  Lon: {LON:.6f}")
    print("=" * 70)

    parcel_boundary = {
        "type": "Polygon",
        "coordinates": [[
            [LON - DELTA, LAT - DELTA],
            [LON + DELTA, LAT - DELTA],
            [LON + DELTA, LAT + DELTA],
            [LON - DELTA, LAT + DELTA],
            [LON - DELTA, LAT - DELTA],
        ]]
    }

    test_input = {
        "parcel_id": "PARCEL_NARELA_GPS_001",
        "building_id": "bldg-narela-gps-001",
        "parcel_boundary": parcel_boundary,
        "floor_count": 5,
        "height_meters": 17.5
    }

    print(f"\nInput Payload:\n{json.dumps(test_input, indent=2)}\n")

    result = process_building(test_input)

    # Save full debug output
    with open("debug_gps_output.json", "w") as f:
        json.dump(result, f, indent=4)

    # Quality Gates + Confidence
    gates = QualityGates()
    scorer = ConfidenceScorer()

    gate_result = gates.run_all_gates(result, parcel_boundary)
    confidence_breakdown = scorer.get_confidence_breakdown(
        footprint=result.get("footprint"),
        parcel_boundary=parcel_boundary,
        floors=result.get("units"),
        units=result.get("units"),
        ulpins=[u.get("ulpin") for u in result.get("units", [])]
    )

    print("-" * 70)
    print(f"  Status                 : {result.get('status')}")
    print(f"  Building ID            : {result.get('building_id')}")
    print(f"  GPS Coords             : {LAT:.6f}°N, {LON:.6f}°E")
    print(f"  Tile Coverage          : {result.get('image_bounds', 'N/A')}")
    print(f"  Height                 : {result.get('height')} m")
    print(f"  Floors                 : {result.get('floor_count')}")
    print(f"  Units Generated        : {len(result.get('units', []))}")
    print(f"  Quality Gates Passed   : {gate_result.get('overall_passed')}")
    if gate_result.get('failed_gates'):
        print(f"  Failed Gates           : {gate_result.get('failed_gates')}")
    print(f"  Overall Confidence     : {confidence_breakdown.get('overall_pipeline_confidence')}%")
    print(f"  Risk Level             : {confidence_breakdown.get('risk_level')}")
    print(f"  Footprint Score        : {confidence_breakdown.get('footprint_score')}%")
    print(f"  Unit Score             : {confidence_breakdown.get('unit_score')}%")
    print(f"  ULPIN Score            : {confidence_breakdown.get('ulpin_score')}%")
    print(f"  Saved to               : debug_gps_output.json")
    print("-" * 70)

    if result.get("status") == "success":
        # Print first 3 sample ULPINs
        units = result.get("units", [])
        print(f"\n  Sample ULPINs (first 3 of {len(units)}):")
        for u in units[:3]:
            print(f"    → {u.get('ulpin')}")

        # Export 3D formats
        print("\n--- Exporting 3D Formats ---")
        exports = export_all_formats(result, output_dir="exports", file_prefix="narela_gps")
        for fmt, path in exports.items():
            print(f"  [{fmt.upper()}] → {path}")

    print("=" * 70)
