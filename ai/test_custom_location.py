import json
import sys
from pipeline import process_building, process_multi_building_parcel
from utils.exporter_utils import export_to_obj, export_to_cityjson, export_to_geojson3d
from utils.geo_utils import fetch_osm_building_metadata

def run_check():
    # 30°43'57.89"N 76°40'56.28"E
    lat_deg, lat_min, lat_sec = 30, 43, 57.89
    lon_deg, lon_min, lon_sec = 76, 40, 56.28

    lat = lat_deg + (lat_min / 60.0) + (lat_sec / 3600.0)
    lon = lon_deg + (lon_min / 60.0) + (lon_sec / 3600.0)

    print("=" * 65)
    print(f"Checking Coordinates: {lat_deg} deg {lat_min}' {lat_sec}\" N, {lon_deg} deg {lon_min}' {lon_sec}\" E")
    print(f"Decimal Degrees: Lat = {lat:.6f}, Lon = {lon:.6f}")
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

    print("\n1. Querying OSM Building Metadata...")
    osm_meta = fetch_osm_building_metadata(lat, lon)
    print(f"   OSM Metadata Result: {json.dumps(osm_meta, indent=2)}")

    print("\n2. Running AI Pipeline (Single Building Detection & 3D ULPIN)...")
    single_input = {
        "parcel_id": "PARCEL_CUSTOM_30_7327_76_6823",
        "building_id": "BLDG_CUSTOM_01",
        "parcel_boundary": parcel_boundary,
        "floor_count": 3,
        "height_meters": 10.5
    }

    res_single = process_building(single_input)
    print(f"   Status: {res_single.get('status')}")
    if res_single.get("status") == "success":
        print(f"   Footprint Shape: {res_single.get('footprint', {}).get('type')}")
        print(f"   Height: {res_single.get('height')} m")
        print(f"   Floors: {res_single.get('floor_count')}")
        print(f"   Units Generated: {len(res_single.get('units', []))}")
        
        sample_ulpin = res_single['units'][0]['ulpin'] if res_single.get('units') else None
        print(f"   Sample 3D ULPIN: {sample_ulpin}")
        
        export_to_obj(res_single, "exports/custom_check_single.obj")
        export_to_cityjson(res_single, "exports/custom_check_single.json")
        export_to_geojson3d(res_single, "exports/custom_check_single.geojson")
        print("   Exported to exports/custom_check_single.*")
    else:
        print(f"   Error: {res_single.get('message')}")

    print("\n3. Running Multi-Building Detection Pipeline...")
    multi_input = {
        "parcel_id": "PARCEL_CUSTOM_MULTI",
        "parcel_boundary": parcel_boundary,
        "floor_count": 3,
        "height_meters": 10.5,
        "max_buildings": 6
    }
    res_multi = process_multi_building_parcel(multi_input)
    print(f"   Status: {res_multi.get('status')}")
    if res_multi.get("status") == "success":
        print(f"   Buildings Detected: {res_multi.get('total_buildings_detected')}")
        print(f"   Total Units Generated: {res_multi.get('total_units_generated')}")
        for b in res_multi.get("buildings", []):
            print(f"     - Building {b['building_id']}: {b['units_count']} units, sample ULPIN: {b['units'][0]['ulpin']}")
    else:
        print(f"   Error: {res_multi.get('message')}")

    print("=" * 65)

if __name__ == "__main__":
    run_check()
