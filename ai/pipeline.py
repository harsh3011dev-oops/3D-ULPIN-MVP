try:
    from ai.footprint_detection import detect_building_footprint
    from ai.extrusion import extrude_building
    from ai.floor_division import divide_into_floors, divide_floor_into_units
    from ai.ulpin_generation import generate_ulpin
    from ai.spatial_validation import validate_spatial_data
    from ai.utils.image_utils import download_satellite_image
    from ai.utils.geo_utils import fetch_osm_building_metadata, geocode_address
except ModuleNotFoundError:
    from footprint_detection import detect_building_footprint
    from extrusion import extrude_building
    from floor_division import divide_into_floors, divide_floor_into_units
    from ulpin_generation import generate_ulpin
    from spatial_validation import validate_spatial_data
    from utils.image_utils import download_satellite_image
    from utils.geo_utils import fetch_osm_building_metadata, geocode_address

import uuid
from shapely.geometry import shape

def process_building(input_data: dict) -> dict:
    """
    Orchestrate the SMART AI pipeline:
    1. Resolve Address to GPS via OpenCage Geocoding (if address provided)
    2. Extract centroid from Parcel Boundary
    3. Query OpenStreetMap for building height & floors (or use overrides/defaults)
    4. Download satellite image from ESRI World Imagery
    5. Detect footprint from downloaded satellite image
    6. Extrude building footprint to 3D
    7. Slice building into floors & units
    8. Generate unique 3D ULPINs
    9. Validate spatial data
    """
    try:
        parcel_id = input_data.get("parcel_id", "UNKNOWN_PARCEL")
        building_id = input_data.get("building_id", str(uuid.uuid4()))
        parcel_boundary = input_data.get("parcel_boundary")
        address = input_data.get("address")

        # Smart Address Resolution via OpenCage API
        if address and not parcel_boundary:
            geo_info = geocode_address(address)
            if geo_info:
                lat, lon = geo_info["lat"], geo_info["lon"]
                delta = 0.0005
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

        if not parcel_boundary or "coordinates" not in parcel_boundary:
            raise ValueError("Invalid parcel boundary or address provided.")

        # Step 1: Calculate centroid of the parcel boundary
        boundary_shape = shape(parcel_boundary)
        centroid = boundary_shape.centroid
        lon, lat = centroid.x, centroid.y

        # Step 2: Query OSM for building height/floors
        osm_data = fetch_osm_building_metadata(lat, lon)
        
        # Determine Floor Count & Height (OSM -> User Override -> Smart Defaults)
        floor_count = input_data.get("floor_count")
        if floor_count:
            floor_count = int(floor_count)
        else:
            floor_count = osm_data.get("floor_count") or 3
            print(f"Using floor count: {floor_count}")

        height_meters = input_data.get("height_meters")
        if height_meters:
            height_meters = float(height_meters)
        else:
            height_meters = osm_data.get("height_meters") or float(floor_count * 3.5)
            print(f"Using height: {height_meters}m")

        # Step 3: Download satellite image via ESRI
        image_path = download_satellite_image(parcel_boundary)

        # Step 4: Detect building footprint from the downloaded image
        footprint_geojson = detect_building_footprint(image_path, parcel_boundary)

        # Step 5: Extrude 3D building
        extrusion = extrude_building(footprint_geojson, height_meters, floor_count)

        # Step 6: Divide building into floors
        floors = divide_into_floors(footprint_geojson, height_meters, floor_count)

        # Step 7: Divide floors into units (4 units per floor for MVP)
        all_units = []
        for floor in floors:
            floor_units = divide_floor_into_units(floor, units_per_floor=4)
            all_units.extend(floor_units)

        # Step 8: Generate ULPIN for each unit
        for unit in all_units:
            ulpin = generate_ulpin(
                parcel_id=parcel_id,
                building_id=building_id,
                floor_number=unit["floor"],
                unit_label=unit["label"],
                centroid=unit["centroid"]
            )
            unit["ulpin"] = ulpin

        # Step 9: Validate units spatially
        validation_report = validate_spatial_data(all_units, footprint_geojson)

        return {
            "status": "success",
            "building_id": building_id,
            "footprint": footprint_geojson,
            "height": height_meters,
            "floor_count": floor_count,
            "extrusion_3d": {
                "type": "Building3D",
                "z_min": extrusion["z_min"],
                "z_max": extrusion["z_max"],
                "floor_height_m": extrusion["floor_height_m"]
            },
            "units": all_units,
            "validation": validation_report,
            "osm_source": osm_data.get("osm_id") is not None
        }

    except Exception as e:
        return {
            "status": "error",
            "message": str(e)
        }

if __name__ == "__main__":
    # Test text address geocoding pipeline!
    test_input = {
        "parcel_id": "PARCEL_NOIDA_SECTOR62",
        "building_id": "bldg-noida-sec62",
        "address": "Sector 62, Noida, Uttar Pradesh, India"
    }
    print(process_building(test_input))
