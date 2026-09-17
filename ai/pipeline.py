import uuid
import logging
import os
import asyncio
import concurrent.futures
from shapely.geometry import shape

from ai.models import (
    BuildingContext, 
    FootprintEstimate, 
    FloorRecord, 
    UnitRecord, 
    AssessmentData
)
from ai.estimation import estimate_floor_count, estimate_building_height
from ai.geocoding_robust import geocode_address_robust
from ai.extrusion import extrude_building
from ai.floor_division import divide_into_floors, divide_floor_into_units
from ai.ulpin_generation import generate_ulpin
from ai.spatial_validation import validate_spatial_data, _normalize_geojson
from ai.utils.image_utils import download_satellite_image
from ai.utils.geo_utils import fetch_osm_building_comprehensive

logger = logging.getLogger(__name__)

# Fallback footprint method if needed for multi-building
try:
    from ai.footprint_detection_v2 import detect_building_footprint_hybrid
except ModuleNotFoundError:
    pass

def _resolve_coordinates(input_data: dict) -> dict:
    address = input_data.get("address")
    parcel_boundary = input_data.get("parcel_boundary")
    latitude = input_data.get("latitude")
    longitude = input_data.get("longitude")
    
    if address and not parcel_boundary and not (latitude is not None and longitude is not None):
        logger.info("[STEP 1] Geocoding address: %s", address)
        try:
            geo_info = geocode_address_robust(address)
            if geo_info and "latitude" in geo_info:
                latitude, longitude = geo_info["latitude"], geo_info["longitude"]
                logger.info("[OK] Geocoded successfully: %s, %s", latitude, longitude)
            else:
                raise ValueError("Geocoding returned empty result")
        except Exception as e:
            logger.warning("[WARN] Geocoding failed: %s", e)
            if latitude is not None and longitude is not None:
                logger.info("Using provided coordinates as fallback: %s, %s", latitude, longitude)
            else:
                raise ValueError(f"Geocoding failed and no backup coordinates: {e}")
                
    if not parcel_boundary and (latitude is not None and longitude is not None):
        delta = 0.0005
        parcel_boundary = {
            "type": "Polygon",
            "coordinates": [[
                [longitude - delta, latitude - delta],
                [longitude + delta, latitude - delta],
                [longitude + delta, latitude + delta],
                [longitude - delta, latitude + delta],
                [longitude - delta, latitude - delta]
            ]]
        }

    if not parcel_boundary or "coordinates" not in parcel_boundary:
        raise ValueError("Invalid parcel boundary or address provided.")

    boundary_shape = shape(_normalize_geojson(parcel_boundary))
    centroid = boundary_shape.centroid
    longitude, latitude = centroid.x, centroid.y
    
    return {
        "latitude": latitude, 
        "longitude": longitude, 
        "parcel_boundary": parcel_boundary
    }

def process_building(*args, **kwargs) -> dict:
    """
    Modular, deterministic pipeline for processing a single building.
    Returns a dictionary compatible with the frontend/backend interface, 
    but internally uses the BuildingContext data contract.
    """
    if len(args) == 1 and isinstance(args[0], dict):
        input_data = args[0].copy()
        input_data.update(kwargs)
    else:
        input_data = kwargs.copy()
        if len(args) > 0: input_data["parcel_id"] = args[0]
        if len(args) > 1: input_data["address"] = args[1]
        if len(args) > 2: input_data["latitude"] = args[2]
        if len(args) > 3: input_data["longitude"] = args[3]
        if len(args) > 4: input_data["height_meters"] = args[4]
        if len(args) > 5: input_data["floor_count"] = args[5]

    try:
        building_id = input_data.get("building_id", str(uuid.uuid4()))
        parcel_id = input_data.get("parcel_id", "UNKNOWN_PARCEL")
        
        logger.info("Starting processing for building %s in parcel %s", building_id, parcel_id)
        
        # 1. Resolve Coordinates
        coords_data = _resolve_coordinates(input_data)
        
        # Initialize the Canonical Data Contract
        ctx = BuildingContext(
            building_id=building_id,
            parcel_id=parcel_id,
            building_name=input_data.get("building_name"),
            address=input_data.get("address"),
            latitude=coords_data["latitude"],
            longitude=coords_data["longitude"],
            parcel_boundary=coords_data["parcel_boundary"]
        )
        
        # 2. Fetch OSM Data
        logger.info("[STEP 2] Fetching geographic & building metadata for %s, %s", ctx.latitude, ctx.longitude)
        frontend_osm_id = input_data.get("osm_id")
        ctx.osm_data = fetch_osm_building_comprehensive(
            ctx.latitude, ctx.longitude, 
            building_name=ctx.building_name, 
            osm_id=frontend_osm_id
        ) or {}
        
        if not ctx.building_name and ctx.osm_data.get("building_name"):
            ctx.building_name = ctx.osm_data["building_name"]
            
        # 3. Download Satellite Image
        ctx.aerial_image_url = download_satellite_image(ctx.parcel_boundary)
        
        # 4. Semantic Analysis (Gemini)
        if ctx.aerial_image_url and os.path.exists(ctx.aerial_image_url):
            logger.info("[STEP 4] Sending satellite image to Gemini Vision for semantic analysis...")
            try:
                from ai.gemini_vision_analyzer import analyze_building_image
                with concurrent.futures.ThreadPoolExecutor(max_workers=1) as pool:
                    future = pool.submit(asyncio.run, analyze_building_image(ctx.aerial_image_url))
                    ctx.semantic_data = future.result(timeout=60) or {}
            except Exception as e:
                logger.warning("Gemini Vision analysis failed: %s", e)
        
        # 5. Footprint Estimation (OSM -> CV)
        osm_geom = ctx.osm_data.get("footprint")
        if osm_geom:
            ctx.footprint = FootprintEstimate(geometry=osm_geom, source="osm", confidence=0.95)
        else:
            logger.info("[STEP 5] OSM footprint not found. Using CV footprint detection.")
            try:
                footprint_result = detect_building_footprint_hybrid(ctx.aerial_image_url, ctx.parcel_boundary, osm_footprint=None)
                ctx.footprint = FootprintEstimate(
                    geometry=footprint_result.get("footprint", ctx.parcel_boundary),
                    source=footprint_result.get("method_used", "hybrid"),
                    confidence=footprint_result.get("cv_confidence", 50.0) / 100.0
                )
            except Exception as e:
                logger.warning("Footprint detection failed: %s", e)
                ctx.footprint = FootprintEstimate(geometry=ctx.parcel_boundary, source="fallback", confidence=0.1)

        # 6. Floor and Height Estimation
        in_floor_count = int(input_data["floor_count"]) if input_data.get("floor_count") else None
        ctx.floor_count = estimate_floor_count(ctx.osm_data, ctx.semantic_data, in_floor_count)
        
        in_height = float(input_data["height_meters"]) if input_data.get("height_meters") else None
        ctx.height = estimate_building_height(
            ctx.osm_data, 
            ctx.floor_count, 
            in_height,
            latitude=ctx.latitude,
            longitude=ctx.longitude,
            footprint=ctx.footprint.geometry if ctx.footprint else None
        )
        
        # 7. 3D Generation & Extrusion
        extrusion = extrude_building(ctx.footprint.geometry, ctx.height.value_meters, ctx.floor_count.value)
        floors = divide_into_floors(ctx.footprint.geometry, ctx.height.value_meters, ctx.floor_count.value)
        
        for f in floors:
            floor_rec = FloorRecord(
                floor_number=f["floor_number"],
                label=f["label"],
                z_min=f["z_min"],
                z_max=f["z_max"],
                floor_height_m=f["floor_height_m"],
                footprint=f["footprint"]
            )
            raw_units = divide_floor_into_units(f, units_per_floor=4)
            for ru in raw_units:
                centroid_list = ru["centroid"]
                ulpin = generate_ulpin(
                    parcel_id=ctx.parcel_id,
                    building_id=ctx.building_id,
                    floor_number=ru["floor"],
                    unit_label=ru["label"],
                    centroid=centroid_list
                )
                unit_rec = UnitRecord(
                    unit_id=ru["unit_id"],
                    floor_number=ru["floor"],
                    label=ru["label"],
                    polygon_2d=ru["polygon_2d"],
                    centroid=centroid_list,
                    area_sqm=ru["area_sqm"],
                    z_min=ru["z_min"],
                    z_max=ru["z_max"],
                    floor_height_m=ru["floor_height_m"],
                    ulpin=ulpin
                )
                floor_rec.units.append(unit_rec)
            ctx.floors.append(floor_rec)
            
        all_units_dicts_raw = [u.model_dump() for u in ctx.get_all_units()]
        # Ensure legacy "floor" key is set (= floor_number) for frontend/test compatibility
        all_units_dicts = []
        for u in all_units_dicts_raw:
            if "floor" not in u or u["floor"] is None:
                u["floor"] = u.get("floor_number", 1)
            all_units_dicts.append(u)
        
        # 8. Spatial Validation
        ctx.validation = validate_spatial_data(all_units_dicts, ctx.footprint.geometry)
        
        # 9. Formulate final Assessment Data
        footprint_poly = shape(_normalize_geojson(ctx.footprint.geometry))
        poly_area_sqm = round(float(footprint_poly.area * (111_000 ** 2)), 1)
        built_up_area_sqm = round(float(poly_area_sqm * ctx.floor_count.value), 1)
        PRICE_PER_SQM = float(os.getenv("ASSESSMENT_PRICE_PER_SQM", "5200"))
        
        building_material = ctx.osm_data.get("building_material") or ctx.semantic_data.get("building_material")
        if building_material: building_material = building_material.title()
        
        roof_shape = ctx.osm_data.get("roof", {}).get("shape") or ctx.semantic_data.get("roof_shape")
        if roof_shape: roof_shape = roof_shape.title()
        
        building_color = ctx.osm_data.get("building_color") or ctx.semantic_data.get("building_color")
        if building_color: building_color = building_color.title()
        
        building_tag = ctx.osm_data.get("building_type") or ctx.osm_data.get("building")
        construction_type = building_tag.replace("_", " ").title() if building_tag and building_tag not in ("yes", "building") else None
        
        ctx.assessment = AssessmentData(
            land_use=ctx.osm_data.get("land_use") or ctx.osm_data.get("amenity") or ctx.osm_data.get("shop"),
            built_up_area_sqm=built_up_area_sqm,
            floor_area_sqm=poly_area_sqm,
            parcel_area_sqm=round(float(shape(_normalize_geojson(ctx.parcel_boundary)).area * (111_000 ** 2)), 1),
            occupancy_type=ctx.osm_data.get("amenity") or ctx.osm_data.get("land_use") or ctx.osm_data.get("shop"),
            construction_type=construction_type,
            building_material=building_material,
            roof_shape=roof_shape,
            permit_status=ctx.osm_data.get("permit_status"),
            assessment_value=f"₹ {int(built_up_area_sqm * PRICE_PER_SQM):,}" if built_up_area_sqm > 0 else None
        )

        # Build output dictionary (for backwards compatibility with existing backend/frontend)
        return {
            "status": "success",
            "building_id": ctx.building_id,
            "building_name": ctx.building_name,
            "address": ctx.address,
            "latitude": ctx.latitude,
            "longitude": ctx.longitude,
            "parcel_id": ctx.parcel_id,
            "footprint": ctx.footprint.geometry,
            "height": ctx.height.value_meters,
            "floor_count": ctx.floor_count.value,
            "floor_source": ctx.floor_count.source,
            "is_floor_estimated": ctx.floor_count.source != "user_specified",
            "underground_floors": 0, # Underground mockup disabled for stabilization
            "built_up_area_sqm": ctx.assessment.built_up_area_sqm,
            "building_parts": ctx.osm_data.get("building_parts", []),
            "roof": {"shape": ctx.assessment.roof_shape},
            "building_material": ctx.assessment.building_material,
            "building_color": building_color,
            "aerial_image_url": f"/sample_data/{os.path.basename(ctx.aerial_image_url)}" if ctx.aerial_image_url else None,
            "gemini_vision_data": ctx.semantic_data,
            "assessment": ctx.assessment.model_dump(),
            "extrusion_3d": {
                "type": "Building3D",
                "z_min": extrusion["z_min"],
                "z_max": extrusion["z_max"],
                "floor_height_m": extrusion["floor_height_m"]
            },
            "units": all_units_dicts,
            "floors": [f.model_dump() for f in ctx.floors],
            "validation": ctx.validation,
            "osm_id": ctx.osm_data.get("osm_id"),
            "raw_osm_data": ctx.osm_data.get("raw_osm_data"),
            "osm_source": ctx.osm_data.get("osm_id") is not None,
            "underground": {
                'basement_levels': 0, 'parking_spaces': 0, 'total_volume_m3': 0, 'max_depth_m': 0,
                'utilities_mapped': 0, 'underground_ulpins': 0, 'validation_score': 0,
                'ulpin_details': [], 'utilities': [], 'validation_issues': []
            }
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
    Stubbed to preserve import signatures and structure. 
    Not fully implemented during single-building pipeline stabilization.
    """
    return {
        "status": "error",
        "message": "Multi-building pipeline is temporarily disabled during stabilization."
    }
