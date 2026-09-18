"""
ai/test_cad_floorplan_pipeline.py
Real Architectural CAD Floor Plan Ingestion & 3D ULPIN Test Script.

Tests parsing indoor floor plans (.geojson / .dxf) into real apartment unit polygons
(Flat 101, 102, 103, 104) and generates 3D ULPIN IDs per apartment unit.
"""

import json
import logging
from pathlib import Path
from ai.cad_parser import parse_floor_into_units_from_file
from ai.floor_division import divide_into_floors
from ai.ulpin_generation import generate_ulpin

logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)


def run_cad_floorplan_test():
    floorplan_file = Path("sample_data/sample_residential_floorplan.geojson")
    
    building_footprint = {
        "type": "Polygon",
        "coordinates": [[
            [77.2163, 28.6313],
            [77.2171, 28.6313],
            [77.2171, 28.6317],
            [77.2163, 28.6317],
            [77.2163, 28.6313]
        ]]
    }

    print("=" * 70)
    print("🏢 REAL CAD/GEOJSON FLOOR PLAN PARSING & 3D ULPIN GENERATION TEST")
    print("=" * 70)
    print(f"📁 Ingesting Architectural Floor Plan File: {floorplan_file.resolve()}")

    # 1. Slice building into floors
    total_height_m = 35.0
    floor_count = 10
    floors = divide_into_floors(building_footprint, total_height_m, floor_count)

    print(f"\n📊 Extruded Building Height: {total_height_m}m across {floor_count} Floors")
    print("-" * 70)

    # 2. Parse indoor units for Floor 1 using CAD file
    floor_1 = floors[0]
    parsed_units = parse_floor_into_units_from_file(
        floor=floor_1,
        floorplan_file=floorplan_file
    )

    print(f"\n✅ SUCCESSFULLY PARSED {len(parsed_units)} REAL APARTMENT UNITS FOR FLOOR 1:")
    print("-" * 70)

    for idx, unit in enumerate(parsed_units):
        ulpin = generate_ulpin(
            parcel_id="PARCEL-DEL-2024-001",
            building_id="BLDG-TOWER-A",
            floor_number=unit["floor"],
            unit_label=unit["label"],
            centroid=unit["centroid"]
        )

        print(f"  🏠 Unit #{idx + 1}: {unit['label']}")
        print(f"     🔹 Category    : {unit.get('category', 'residential').upper()}")
        print(f"     🔹 Area        : {unit['area_sqm']} sq.m")
        print(f"     🔹 Elevation   : Z_min={unit['z_min']}m, Z_max={unit['z_max']}m")
        print(f"     🔹 Centroid    : Lat {unit['centroid'][0]:.6f}, Lon {unit['centroid'][1]:.6f}")
        print(f"     🆔 3D ULPIN    : {ulpin}")
        print("-" * 70)

    print("\n🎉 CAD Floor Plan Ingestion & Volumetric Parcelization Test Complete!")


if __name__ == "__main__":
    run_cad_floorplan_test()
