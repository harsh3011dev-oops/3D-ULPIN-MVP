try:
    from ai.footprint_detection import detect_multi_building_footprints
    from ai.footprint_detection_v2 import detect_building_footprint_hybrid
    from ai.geocoding_robust import geocode_address_robust
    from ai.extrusion import extrude_building
    from ai.floor_division import divide_into_floors, divide_floor_into_units
    from ai.ulpin_generation import generate_ulpin
    from ai.spatial_validation import validate_spatial_data, _normalize_geojson
    from ai.utils.image_utils import download_satellite_image
    from ai.utils.geo_utils import fetch_osm_building_metadata, fetch_osm_building_geometry, fetch_osm_building_comprehensive
    from ai.underground_detection import UndergroundDetector
    from ai.utility_mapper import UtilityMapper
    from ai.underground_ulpin import UndergroundULPINGenerator
    from ai.subsurface_validation import SubsurfaceValidator
except ModuleNotFoundError:
    from footprint_detection import detect_multi_building_footprints
    from footprint_detection_v2 import detect_building_footprint_hybrid
    from geocoding_robust import geocode_address_robust
    from extrusion import extrude_building
    from floor_division import divide_into_floors, divide_floor_into_units
    from ulpin_generation import generate_ulpin
    from spatial_validation import validate_spatial_data, _normalize_geojson
    from utils.image_utils import download_satellite_image
    from utils.geo_utils import fetch_osm_building_metadata, fetch_osm_building_geometry, fetch_osm_building_comprehensive
    from underground_detection import UndergroundDetector
    from utility_mapper import UtilityMapper
    from underground_ulpin import UndergroundULPINGenerator
    from subsurface_validation import SubsurfaceValidator

import uuid
import logging
from shapely.geometry import shape

logger = logging.getLogger(__name__)

# Default floor-to-ceiling height used when OSM data is unavailable
DEFAULT_FLOOR_HEIGHT_M: float = 3.5

def process_building(*args, **kwargs) -> dict:
    """
    Process building with EITHER address OR lat/lon
    
    Priority:
    1. If address provided → geocode it
    2. If address fails AND lat/lon provided → use coordinates
    3. If only lat/lon provided → use coordinates directly
    4. If neither → ERROR
    """
    # Accommodate both dict input (existing tests) and kwargs input (new tests)
    if len(args) == 1 and isinstance(args[0], dict):
        input_data = args[0].copy()
        input_data.update(kwargs)
    else:
        input_data = kwargs.copy()
        if len(args) > 0:
            input_data["parcel_id"] = args[0]
        if len(args) > 1:
            input_data["address"] = args[1]
        if len(args) > 2:
            input_data["latitude"] = args[2]
        if len(args) > 3:
            input_data["longitude"] = args[3]
        if len(args) > 4:
            input_data["height_meters"] = args[4]
        if len(args) > 5:
            input_data["floor_count"] = args[5]

    try:
        parcel_id = input_data.get("parcel_id", "UNKNOWN_PARCEL")
        building_name = input_data.get("building_name")
        building_id = input_data.get("building_id", str(uuid.uuid4()))
        parcel_boundary = input_data.get("parcel_boundary")
        address = input_data.get("address")
        latitude = input_data.get("latitude")
        longitude = input_data.get("longitude")

        logger.info("Processing building: %s", parcel_id)

        # Step 1: GET GPS COORDINATES
        lat, lon = None, None
        if address and not parcel_boundary and not (latitude is not None and longitude is not None):
            logger.info("[STEP 1] Geocoding address: %s", address)
            try:
                geo_info = geocode_address_robust(address)
                if geo_info and "latitude" in geo_info:
                    lat, lon = geo_info["latitude"], geo_info["longitude"]
                    logger.info("[OK] Geocoded successfully: %s, %s", lat, lon)
                else:
                    raise ValueError("Geocoding returned empty result")
            except Exception as e:
                logger.warning("[WARN] Geocoding failed: %s", e)
                if latitude is not None and longitude is not None:
                    logger.info("Using provided coordinates as fallback: %s, %s", latitude, longitude)
                    lat, lon = latitude, longitude
                else:
                    raise ValueError(f"Geocoding failed and no backup coordinates: {e}")
        elif latitude is not None and longitude is not None and not parcel_boundary:
            logger.info("[STEP 1] Using provided coordinates: %s, %s", latitude, longitude)
            lat, lon = latitude, longitude
        elif parcel_boundary:
            pass # Use centroid later
        else:
            raise ValueError("Either address OR (latitude, longitude) must be provided")

        if not parcel_boundary and (lat is not None and lon is not None):
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

        boundary_shape = shape(_normalize_geojson(parcel_boundary))
        centroid = boundary_shape.centroid
        lon, lat = centroid.x, centroid.y

        logger.info("[STEP 2] Fetching geographic & building metadata for %s, %s (name: %s)", lat, lon, building_name)
        osm_comp = fetch_osm_building_comprehensive(lat, lon, building_name=building_name) or {}
        osm_geom = osm_comp.get("footprint")

        # Determine generic floor count and source
        floor_count = input_data.get("floor_count")
        if floor_count:
            floor_count = int(floor_count)
            floor_source = "User Specified"
            is_floor_estimated = False
        elif osm_comp.get("floor_count"):
            floor_count = int(osm_comp["floor_count"])
            floor_source = osm_comp.get("floor_source", "OSM building:levels")
            is_floor_estimated = osm_comp.get("is_floor_estimated", False)
        else:
            floor_count = 3
            floor_source = "Conservative Default"
            is_floor_estimated = True

        height_meters = input_data.get("height_meters")
        if height_meters:
            height_meters = float(height_meters)
        elif osm_comp.get("height_meters"):
            height_meters = float(osm_comp["height_meters"])
        else:
            height_meters = float(floor_count * DEFAULT_FLOOR_HEIGHT_M)

        if not building_name and osm_comp.get("building_name"):
            building_name = osm_comp["building_name"]

        image_path = download_satellite_image(parcel_boundary)
        
        # ── GEMINI VISION INTEGRATION ──
        logger.info("[STEP 2.5] Sending satellite image to Gemini Vision for analysis...")
        import asyncio
        import concurrent.futures
        from ai.gemini_vision_analyzer import analyze_building_image

        gemini_vision_data = None
        try:
            # Run the async Gemini Vision call safely from a sync context
            # (pipeline runs in a thread pool, so we spin up a clean event loop)
            with concurrent.futures.ThreadPoolExecutor(max_workers=1) as pool:
                future = pool.submit(asyncio.run, analyze_building_image(image_path))
                gemini_vision_data = future.result(timeout=60)
        except Exception as e:
            logger.warning("Gemini Vision analysis failed: %s", e)

        gemini_footprint = None
        if gemini_vision_data and gemini_vision_data.get("confidence", 0) > 50:
            logger.info("Gemini Vision returned a footprint with high confidence.")
            pixel_coords = gemini_vision_data.get("footprint_pixels", [])
            if len(pixel_coords) >= 3:
                try:
                    from ai.footprint_detection import _pixels_to_geo
                    geo_coords = _pixels_to_geo(pixel_coords, image_path)
                    if geo_coords[0] != geo_coords[-1]:
                        geo_coords.append(geo_coords[0])
                    gemini_footprint = {"type": "Polygon", "coordinates": [geo_coords]}
                except Exception as e:
                    logger.warning(f"Failed to convert Gemini pixels to geo: {e}")

            # Override floor count if Gemini provided a reasonable estimate and we didn't have user input
            if input_data.get("floor_count") is None and gemini_vision_data.get("estimated_floors"):
                g_floors = int(gemini_vision_data["estimated_floors"])
                if g_floors > 0:
                    floor_count = g_floors
                    floor_source = "Gemini Vision Estimate"
                    height_meters = float(floor_count * DEFAULT_FLOOR_HEIGHT_M)
                    is_floor_estimated = True
                    logger.info(f"Using Gemini Vision estimated floors: {floor_count}")

        # Fallback to Hybrid CV + OSM if Gemini didn't return a footprint
        if gemini_footprint:
            footprint_geojson = gemini_footprint
        else:
            footprint_result = detect_building_footprint_hybrid(image_path, parcel_boundary, osm_footprint=osm_geom)
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
        try:
            from ai.confidence_scorer import ConfidenceScorer
            confidence = ConfidenceScorer().get_confidence_breakdown(
                image=image_path, footprint=footprint_geojson,
                parcel_boundary=parcel_boundary, floors=floors, units=all_units,
                ulpins=[u["ulpin"] for u in all_units]
            )
            validation_report["confidence_score"] = confidence["overall_pipeline_confidence"]
            validation_report["confidence_breakdown"] = confidence
        except Exception:
            validation_report["confidence_score"] = 100.0 if validation_report.get("valid") else 0.0

        # STEP 9: Underground Infrastructure Mapping
        logger.info("[STEP 9] Underground Infrastructure Mapping...")
        
        # Initialize detectors
        detector = UndergroundDetector(lat=lat, lon=lon, building_height=height_meters, building_name=building_name)
        
        # Detect underground structure
        underground = detector.get_underground_structure()
        
        # Map utilities
        mapper = UtilityMapper(lat=lat, lon=lon, building_coords=(lat, lon))
        utilities = mapper.map_utilities()
        
        import pygeohash
        geohash = pygeohash.encode(lat, lon, precision=7)
        
        # Generate underground ULPINs
        ulpin_gen = UndergroundULPINGenerator(parcel_id=parcel_id, building_id=building_id)
        basement_ulpins = ulpin_gen.generate_basement_ulpins(underground, geohash)
        utility_ulpins = ulpin_gen.generate_utility_ulpins(utilities, geohash)
        all_underground_ulpins = basement_ulpins + utility_ulpins
        
        # Validate underground infrastructure
        validator = SubsurfaceValidator()
        issues, ug_confidence = validator.validate_underground_ulpins(basement_ulpins, utilities)
        
        underground_data = {
            'basement_levels': len(underground.basement_levels),
            'parking_spaces': underground.parking_spaces,
            'total_volume_m3': underground.total_subsurface_volume,
            'max_depth_m': underground.depth_to_lowest_point,
            'utilities_mapped': len(utilities),
            'underground_ulpins': len(all_underground_ulpins),
            'validation_score': ug_confidence,
            'ulpin_details': [
                {
                    'ulpin': u.ulpin,
                    'type': u.ownership_type,
                    'title': getattr(u, 'title', f"Underground Structure ({u.subsurface_zone})"),
                    'subsurface_zone': u.subsurface_zone,
                    'level': u.level_number,
                    'volume_m3': u.volume_cubic_meters,
                    'depth_range': u.depth_range,
                    'coordinates': u.coordinates
                }
                for u in all_underground_ulpins
            ],
            'utilities': [
                {
                    'ulpin': f"{parcel_id}-{building_id}-U{u.utility_type[0].upper()}-001-{geohash}",
                    'type': u.utility_type,
                    'title': f"Underground {u.utility_type.capitalize()} Main Line (DN{u.diameter_mm}mm)",
                    'depth_m': u.depth_meters,
                    'diameter_mm': u.diameter_mm,
                    'capacity': u.capacity,
                    'conflicts': len(u.conflict_zones),
                    'path': getattr(u, 'path', [])
                }
                for u in utilities
            ],
            'validation_issues': [
                {
                    'type': issue.issue_type,
                    'severity': issue.severity,
                    'description': issue.description,
                    'location': issue.location
                }
                for issue in issues
            ]
        }

        footprint_poly = shape(_normalize_geojson(footprint_geojson))
        poly_area_sqm = round(float(footprint_poly.area * (111_000 ** 2)), 1)
        built_up_area_sqm = round(float(poly_area_sqm * floor_count), 1)

        # Pricing constant: approximate cost per sqm in INR (configurable via env)
        import os
        PRICE_PER_SQM = float(os.getenv("ASSESSMENT_PRICE_PER_SQM", "5200"))

        # Derive construction_type from OSM tags if available
        building_tag = osm_comp.get("building_type") or osm_comp.get("building")
        if building_tag and building_tag not in ("yes", "building"):
            construction_type = building_tag.replace("_", " ").title()
        else:
            construction_type = None  # Unknown — don't fabricate

        building_material = osm_comp.get("building_material")
        roof_shape = osm_comp.get("roof", {}).get("shape")
        building_color = osm_comp.get("building_color")
        
        if gemini_vision_data:
            if not building_material and gemini_vision_data.get("building_material"):
                building_material = gemini_vision_data["building_material"].title()
            if not roof_shape and gemini_vision_data.get("roof_shape"):
                roof_shape = gemini_vision_data["roof_shape"].title()
            if not building_color and gemini_vision_data.get("building_color"):
                building_color = gemini_vision_data["building_color"].title()

        assessment_data = {
            "land_use": osm_comp.get("land_use") or osm_comp.get("amenity") or osm_comp.get("shop"),
            "built_up_area_sqm": built_up_area_sqm,
            "floor_area_sqm": poly_area_sqm,
            "parcel_area_sqm": round(float(shape(_normalize_geojson(parcel_boundary)).area * (111_000 ** 2)), 1),
            "occupancy_type": osm_comp.get("amenity") or osm_comp.get("land_use") or osm_comp.get("shop"),
            "construction_type": construction_type,
            "building_material": building_material,
            "roof_shape": roof_shape,
            "record_status": "3D Cadastral Record Generated",
            "permit_status": osm_comp.get("permit_status"),
            "assessment_value": f"₹ {int(built_up_area_sqm * PRICE_PER_SQM):,}" if built_up_area_sqm > 0 else None
        }

        return {
            "status": "success",
            "building_id": building_id,
            "building_name": building_name,
            "address": address,
            "latitude": lat,
            "longitude": lon,
            "parcel_id": parcel_id,
            "footprint": footprint_geojson,
            "height": height_meters,
            "floor_count": floor_count,
            "floor_source": floor_source,
            "is_floor_estimated": is_floor_estimated,
            "underground_floors": osm_comp.get("underground_floors", 0),
            "built_up_area_sqm": built_up_area_sqm,
            "building_parts": osm_comp.get("building_parts", []),
            "roof": {"shape": roof_shape} if roof_shape else osm_comp.get("roof", {}),
            "building_material": building_material,
            "building_color": building_color,
            "aerial_image_url": f"/sample_data/{os.path.basename(image_path)}" if image_path and os.path.exists(image_path) else None,
            "gemini_vision_data": gemini_vision_data,
            "assessment": assessment_data,
            "extrusion_3d": {
                "type": "Building3D",
                "z_min": extrusion["z_min"],
                "z_max": extrusion["z_max"],
                "floor_height_m": extrusion["floor_height_m"]
            },
            "units": all_units,
            "validation": validation_report,
            "osm_id": osm_comp.get("osm_id"),
            "raw_osm_data": osm_comp.get("raw_osm_data"),
            "osm_source": osm_comp.get("osm_id") is not None,
            "underground": underground_data
        }

    except Exception as e:
        import traceback
        traceback.print_exc()
        return {
            "status": "error",
            "message": str(e)
        }


def process_multi_building_parcel(*args, **kwargs) -> dict:
    """
    Orchestrate the SMART AI pipeline for a Multi-Building Parcel (e.g. Housing Society, Campus):
    Detects multiple building footprints in a single land parcel and generates 3D ULPINs for each.
    """
    if len(args) == 1 and isinstance(args[0], dict):
        input_data = args[0].copy()
        input_data.update(kwargs)
    else:
        input_data = kwargs.copy()

    try:
        parcel_id = input_data.get("parcel_id", "MULTI_PARCEL")
        parcel_boundary = input_data.get("parcel_boundary")
        address = input_data.get("address")
        max_buildings = input_data.get("max_buildings", 5)

        if address and not parcel_boundary:
            geo_info = geocode_address_robust(address)
            if geo_info and "latitude" in geo_info:
                lat, lon = geo_info["latitude"], geo_info["longitude"]
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
