import json
from pipeline import process_multi_building_parcel

if __name__ == "__main__":
    print("=" * 60)
    print(" TASK 3: Testing Multi-Building Parcel Support")
    print("=" * 60)

    # Multi-building parcel test query: IIT Delhi Campus / Housing Complex
    test_input = {
        "parcel_id": "PARCEL_IIT_DELHI_CAMPUS",
        "address": "IIT Delhi, Hauz Khas, New Delhi, Delhi, India",
        "max_buildings": 4,
        "floor_count": 4,
        "height_meters": 14.0
    }

    print(f"Submitting Multi-Building Query:\n{json.dumps(test_input, indent=2)}\n")
    result = process_multi_building_parcel(test_input)

    output_file = "debug_multi_building_output.json"
    with open(output_file, "w") as f:
        json.dump(result, f, indent=4)

    print("-" * 60)
    print(f"Status:                   {result.get('status')}")
    print(f"Parcel ID:                {result.get('parcel_id')}")
    print(f"Total Buildings Detected: {result.get('total_buildings_detected')}")
    print(f"Total Units Generated:    {result.get('total_units_generated')}")
    print(f"Saved full output to:     '{output_file}'")
    print("-" * 60)
