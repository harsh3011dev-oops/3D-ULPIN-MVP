import json
from pipeline import process_building
from utils.exporter_utils import export_to_obj, export_to_cityjson, export_to_geojson3d

def run_pancham_hospital_pipeline():
    # 30 deg 43' 57.89" N, 76 deg 40' 56.28" E -> Pancham Hospital, Sector 118, Mohali
    lat_deg, lat_min, lat_sec = 30, 43, 57.89
    lon_deg, lon_min, lon_sec = 76, 40, 56.28

    lat = lat_deg + (lat_min / 60.0) + (lat_sec / 3600.0)
    lon = lon_deg + (lon_min / 60.0) + (lon_sec / 3600.0)

    print("=" * 65)
    print("Running 3D ULPIN Pipeline for: Pancham Hospital, Mohali")
    print(f"Decimal Coordinates: Lat = {lat:.6f}, Lon = {lon:.6f}")
    print("=" * 65)

    delta = 0.0006  # ~65m bounding box
    parcel_boundary = {
        "type": "Polygon",
        "coordinates": [[
            [lon - delta, lat - delta],
            [lon + delta, lat - delta],
            [lon + delta, lat + delta],
            [lon - delta, lat + delta],
            [lon - delta, lat - delta]
        ]]
    }

    test_input = {
        "parcel_id": "PARCEL_PANCHAM_HOSPITAL_MOHALI",
        "building_id": "bldg-pancham-hospital-001",
        "parcel_boundary": parcel_boundary,
        "floor_count": 3,
        "height_meters": 10.5
    }

    result = process_building(test_input)
    
    with open("debug_pipeline_output.json", "w") as f:
        json.dump(result, f, indent=4)

    if result.get("status") == "success":
        print("\n--- Exporting 3D Formats as pancham_hospital.* ---")
        export_to_obj(result, "exports/pancham_hospital.obj")
        export_to_cityjson(result, "exports/pancham_hospital.json")
        export_to_geojson3d(result, "exports/pancham_hospital.geojson")
        print("Exports completed successfully:")
        print("   - exports/pancham_hospital.obj")
        print("   - exports/pancham_hospital.json")
        print("   - exports/pancham_hospital.geojson")
        print(f"Sample 3D ULPIN: {result['units'][0]['ulpin']}")
    else:
        print(f"Error: {result.get('message')}")

if __name__ == "__main__":
    run_pancham_hospital_pipeline()
