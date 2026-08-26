import json
from pipeline import process_building

if __name__ == "__main__":
    print("=" * 60)
    print(" TESTING REAL LOCATION: Sanjeevni Hospital, Narela, Delhi")
    print("=" * 60)
    
    # Specific Address Query requested by user:
    test_input = {
        "parcel_id": "PARCEL_SANJEEVNI_HOSPITAL_NARELA",
        "building_id": "bldg-sanjeevni-narela-001",
        "address": "Sanjeevni Hospital, Pana Mamurpur, Narela, New Delhi, Delhi 110040, India"
    }

    print(f"Submitting Input:\n{json.dumps(test_input, indent=2)}\n")
    result = process_building(test_input)

    output_file = "debug_pipeline_output.json"
    with open(output_file, "w") as f:
        json.dump(result, f, indent=4)

    print("-" * 60)
    print(f"Status: {result.get('status')}")
    print(f"Building ID: {result.get('building_id')}")
    print(f"Detected Height: {result.get('height')} meters")
    print(f"Detected Floors: {result.get('floor_count')} floors")
    print(f"Total Units Generated: {len(result.get('units', []))}")
    print(f"Full pipeline output saved to '{output_file}'.")
    print("-" * 60)
