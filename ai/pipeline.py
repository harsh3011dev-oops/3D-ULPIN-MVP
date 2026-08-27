try:
    from ai.footprint_detection import detect_multi_building_footprints
    from ai.footprint_detection_v2 import detect_building_footprint_hybrid
    from ai.geocoding_robust import geocode_address_robust
    from ai.extrusion import extrude_building
    from ai.floor_division import divide_into_floors, divide_floor_into_units
    from ai.ulpin_generation import generate_ulpin
    from ai.spatial_validation import validate_spatial_data
    from ai.utils.image_utils import download_satellite_image
    from ai.utils.geo_utils import fetch_osm_building_metadata
except ModuleNotFoundError:
    from footprint_detection import detect_multi_building_footprints
    from footprint_detection_v2 import detect_building_footprint_hybrid
    from geocoding_robust import geocode_address_robust
    from extrusion import extrude_building
    from floor_division import divide_into_floors, divide_floor_into_units
    from ulpin_generation import generate_ulpin
    from spatial_validation import validate_spatial_data
    from utils.image_utils import download_satellite_image
    from utils.geo_utils import fetch_osm_building_metadata

import uuid
from shapely.geometry import shape

def process_building(input_data: dict) -> dict:
    """
    Orchestrate the SMART AI pipeline for a single building:
    1. Resolve Address to GPS via Multi-API Cascading Geocoding (if address provided)
    2. Extract centroid from Parcel Boundary
    3. Query OpenStreetMap for building height & floors (or use overrides/defaults)
    4. Download satellite image from ESRI World Imagery / Stadia Maps
    5. Detect footprint using v2 Hybrid Multi-scale Canny + CV/OSM Blending
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

        # Smart Address Resolution via Multi-Provider Cascading Geocoder
        if address and not parcel_boundary:
            geo_info = geocode_address_robust(address)
            if geo_info and "latitude" in geo_info:
                lat, lon = geo_info["latitude"], geo_info["longitude"]
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

        boundary_shape = shape(parcel_boundary)
        centroid = boundary_shape.centroid
        lon, lat = centroid.x, centroid.y

        osm_data = fetch_osm_building_metadata(lat, lon)
        
        floor_count = input_data.get("floor_count")
        if floor_count:
            floor_count = int(floor_count)
        else:
            floor_count = osm_data.get("floor_count") or 3

        height_meters = input_data.get("height_meters")
        if height_meters:
            height_meters = float(height_meters)
        else:
            height_meters = osm_data.get("height_meters") or float(floor_count * 3.5)

        image_path = download_satellite_image(parcel_boundary)
        footprint_result = detect_building_footprint_hybrid(image_path, parcel_boundary)
        footprint_geojson = footprint_result.get("footprint", footprint_result)

        extrusion = extrude_building(footprint_geojson, height_meters, floor_count)
        floors = divide_into_floors(footprint_geojson, height_meters, floor_count)

        all_units = []
        for floor in floors:
            floor_units = divide_floor_into_units(floor, units_per_floor=4)
            all_units.extend(floor_units)

        for unit in all_units:
            ulpin = generate_ulpin(
                parcel_id=parcel_id,
                building_id=building_id,
                floor_number=unit["floor"],
                unit_label=unit["label"],
                centroid=unit["centroid"]
            )
            unit["ulpin"] = ulpin

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


def process_multi_building_parcel(input_data: dict) -> dict:
    """
    Orchestrate the SMART AI pipeline for a Multi-Building Parcel (e.g. Housing Society, Campus):
    Detects multiple building footprints in a single land parcel and generates 3D ULPINs for each.
    """
    try:
        parcel_id = input_data.get("parcel_id", "MULTI_PARCEL")
        parcel_boundary = input_data.get("parcel_boundary")
        address = input_data.get("address")
        max_buildings = input_data.get("max_buildings", 5)

        if address and not parcel_boundary:
            geo_info = geocode_address(address)
            if geo_info:
                lat, lon = geo_info["lat"], geo_info["lon"]
                delta = 0.001  # Larger 110m bounding box for multi-building parcel
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

        boundary_shape = shape(parcel_boundary)
        centroid = boundary_shape.centroid
        lon, lat = centroid.x, centroid.y

        image_path = download_satellite_image(parcel_boundary, zoom=18)
        footprints = detect_multi_building_footprints(image_path, parcel_boundary, min_area=30, max_buildings=max_buildings)

        floor_count = input_data.get("floor_count", 3)
        height_meters = input_data.get("height_meters", 10.5)

        processed_buildings = []
        total_units_count = 0

        for idx, fp in enumerate(footprints, start=1):
            bldg_id = f"{parcel_id}-BLDG{idx:02d}"

            extrusion = extrude_building(fp, height_meters, floor_count)
            floors = divide_into_floors(fp, height_meters, floor_count)

            bldg_units = []
            for floor in floors:
                floor_units = divide_floor_into_units(floor, units_per_floor=4)
                bldg_units.extend(floor_units)

            for unit in bldg_units:
                ulpin = generate_ulpin(
                    parcel_id=parcel_id,
                    building_id=bldg_id,
                    floor_number=unit["floor"],
                    unit_label=unit["label"],
                    centroid=unit["centroid"]
                )
                unit["ulpin"] = ulpin

            total_units_count += len(bldg_units)
            processed_buildings.append({
                "building_id": bldg_id,
                "building_index": idx,
                "footprint": fp,
                "height": height_meters,
                "floor_count": floor_count,
                "units_count": len(bldg_units),
                "units": bldg_units
            })

        return {
            "status": "success",
            "parcel_id": parcel_id,
            "total_buildings_detected": len(processed_buildings),
            "total_units_generated": total_units_count,
            "buildings": processed_buildings
        }

    except Exception as e:
        return {
            "status": "error",
            "message": str(e)
        }
