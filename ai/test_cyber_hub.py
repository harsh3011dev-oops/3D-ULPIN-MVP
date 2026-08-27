"""
Real Location Test Script: Cyber Hub, DLF Cyber City, Gurugram
==============================================================
Test pipeline output on Cyber Hub Gurugram (20 floors, 80+ units).
"""

import json
import os
from pipeline import process_building
from utils.exporter_utils import export_all_formats
from quality_gates import QualityGates
from confidence_scorer import ConfidenceScorer

if __name__ == "__main__":
    print("=" * 70)
    print(" TESTING REAL LOCATION: Cyber Hub, DLF Cyber City, Gurugram")
    print("=" * 70)

    test_input = {
        "parcel_id": "PARCEL_CYBER_HUB_GURUGRAM",
        "building_id": "bldg-cyber-hub-001",
        "address": "Cyber Hub, DLF Cyber City, Gurugram, Haryana 122001, India",
        "floor_count": 20,
        "height_meters": 70.0
    }

    print(f"Submitting Input Query:\n{json.dumps(test_input, indent=2)}\n")
    result = process_building(test_input)

    output_file = "debug_cyber_hub_output.json"
    with open(output_file, "w") as f:
        json.dump(result, f, indent=4)

    gates = QualityGates()
    scorer = ConfidenceScorer()

    gate_result = gates.run_all_gates(result)
    confidence_breakdown = scorer.get_confidence_breakdown(
        footprint=result.get("footprint"),
        floors=result.get("units"),
        units=result.get("units"),
        ulpins=[u.get("ulpin") for u in result.get("units", [])]
    )

    print("-" * 70)
    print(f"Status:               {result.get('status')}")
    print(f"Building ID:          {result.get('building_id')}")
    print(f"Height:               {result.get('height')} meters")
    print(f"Floors:               {result.get('floor_count')} floors")
    print(f"Units Generated:      {len(result.get('units', []))}")
    print(f"Quality Gates Passed: {gate_result.get('overall_passed')}")
    print(f"Overall Confidence:   {confidence_breakdown.get('overall_pipeline_confidence')}%")
    print(f"Risk Level:           {confidence_breakdown.get('risk_level')}")
    print(f"Saved full JSON to:   '{output_file}'")
    print("-" * 70)

    if result.get("status") == "success":
        print("\n--- Exporting 3D Formats ---")
        exports = export_all_formats(result, output_dir="exports", file_prefix="cyber_hub_gurugram")
        print("Exports completed successfully:")
        for fmt, path in exports.items():
            print(f"  - {fmt.upper()}: {path}")
    print("=" * 70)
