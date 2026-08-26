import json
from pipeline import process_building
from utils.exporter_utils import export_to_obj, export_to_cityjson, export_to_geojson3d

if __name__ == "__main__":
    print("=" * 60)
    print(" TESTING REAL LOCATION: Shiva Shakti Mandir, Sanjay Colony, Narela")
    print("=" * 60)

    # Address with Plus code & full locality
    test_input = {
        "parcel_id": "PARCEL_SHIVA_SHAKTI_MANDIR_NARELA",
        "building_id": "bldg-shiva-shakti-mandir-001",
        "address": "Shiva Shakti Mandir, Gali No. 13, Sanjay Colony, Narela, New Delhi, Delhi 110040, India",
        "floor_count": 2,        # Mandir / Temple standard 2-level structure
        "height_meters": 7.5
    }

    print(f"Submitting Input Query:\n{json.dumps(test_input, indent=2)}\n")
    result = process_building(test_input)

    output_file = "debug_pipeline_output.json"
    with open(output_file, "w") as f:
        json.dump(result, f, indent=4)

    print("-" * 60)
    print(f"Status:            {result.get('status')}")
    print(f"Building ID:       {result.get('building_id')}")
    print(f"Height:            {result.get('height')} meters")
    print(f"Floors:            {result.get('floor_count')} floors")
    print(f"Units Generated:   {len(result.get('units', []))}")
    print(f"Saved full JSON to: '{output_file}'")
    print("-" * 60)

    if result.get("status") == "success":
        print("\n--- Exporting 3D Formats ---")
        export_to_obj(result, "exports/shiva_shakti_mandir.obj")
        export_to_cityjson(result, "exports/shiva_shakti_mandir.json")
        export_to_geojson3d(result, "exports/shiva_shakti_mandir.geojson")
        print("Exports completed! Check 'exports/shiva_shakti_mandir.*'")
