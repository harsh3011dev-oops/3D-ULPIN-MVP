"""
Quick test script to verify all 3 export formats work correctly.
Run: python test_exporter.py
"""
import json
from pipeline import process_building
from utils.exporter_utils import export_to_obj, export_to_cityjson, export_to_geojson3d

if __name__ == "__main__":
    print("=" * 60)
    print(" TASK 2: Testing 3D Format Exporter")
    print("=" * 60)

    # Step 1: Run pipeline for a real location
    result = process_building({
        "parcel_id": "PARCEL_EXPORT_TEST",
        "building_id": "bldg-export-test-001",
        "address": "India Gate, New Delhi, India",
        "floor_count": 4,
        "height_meters": 14.0
    })

    print(f"\nPipeline Status: {result.get('status')}")
    print(f"Floors: {result.get('floor_count')}, Units: {len(result.get('units', []))}")

    if result.get("status") == "success":
        print("\n--- Exporting 3 formats ---")

        # Export OBJ (Three.js)
        obj_path = export_to_obj(result, "exports/india_gate.obj")

        # Export CityJSON (CesiumJS)
        city_path = export_to_cityjson(result, "exports/india_gate.json")

        # Export GeoJSON 3D (REST API)
        geo_path = export_to_geojson3d(result, "exports/india_gate.geojson")

        print("\n--- Export Summary ---")
        print(f"OBJ file:      {obj_path}")
        print(f"CityJSON file: {city_path}")
        print(f"GeoJSON file:  {geo_path}")
        print("\nAll 3 exports DONE! Check the 'exports/' folder.")
