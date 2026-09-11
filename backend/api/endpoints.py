import json
from fastapi import APIRouter, Depends, HTTPException, BackgroundTasks
from sqlalchemy.ext.asyncio import AsyncSession
from shapely.geometry import shape

from backend.database import get_db
from backend.schemas import (
    BuildingCreateRequest,
    BuildingAutoDetectRequest,
    BuildingAutoDetectResponse,
    JobStatusResponse, 
    BuildingResponse, 
    UnitResponse, 
    ValidationResponse,
    GenericResponse,
    BuildingValidationSummary
)
from backend.services.gemini_lookup import CACHE, cache_key, call_gemini_api
from backend.services.gemini_architectural_inference import infer_architectural_metadata
from backend.services.supabase_service import (
    create_job, 
    get_job, 
    get_building_with_units, 
    get_validation_log
)
from backend.services.ai_runner import execute_ai_pipeline_job

router = APIRouter(tags=["3D ULPIN MVP"])

@router.post("/ai/infer-building-metadata")
async def infer_building_metadata_endpoint(request: dict):
    """
    Optional Gemini AI architectural inference endpoint.
    Infers missing architectural metadata (roofShape, buildingType, etc.)
    strictly from geometric shape metrics and OSM tags.
    """
    return await infer_architectural_metadata(request)


# ── In-memory cache for auto-detect results ──────────────────────────────────
_AUTODETECT_CACHE: dict = {}

@router.post("/buildings/auto-detect")
async def auto_detect_building(request: dict):
    """
    Accepts {"building_name": "Taj Mahal", "city": "Agra"}
    Returns auto-filled lat/lon/height/floors via Gemini AI.
    """
    building_name = str(request.get("building_name", "")).strip()
    city = str(request.get("city", "")).strip()

    if not building_name or not city:
        raise HTTPException(status_code=400, detail="Both building_name and city are required.")

    # Use a different variable name to avoid shadowing the imported `cache_key` function
    _key = f"{building_name}|{city}".lower()
    if _key in _AUTODETECT_CACHE:
        return _AUTODETECT_CACHE[_key]

    result = await call_gemini_api(building_name, city)
    if not result:
        raise HTTPException(status_code=404, detail="Building not found")

    _AUTODETECT_CACHE[_key] = result
    return result

@router.post("/buildings/create", response_model=GenericResponse, status_code=202)
async def create_building_request(
    request: BuildingCreateRequest, 
    background_tasks: BackgroundTasks,
    db: AsyncSession = Depends(get_db)
):
    """
    Endpoint 1: Receive building requests (address, height, floors)
    Queues AI pipeline job asynchronously.
    """
    # 1. Validate input
    if request.height_meters <= 0:
        raise HTTPException(status_code=400, detail="height_meters must be greater than 0")
    if request.floor_count <= 0:
        raise HTTPException(status_code=400, detail="floor_count must be greater than 0")

    # 2 & 3. Generate job_id & Create Job record
    job = await create_job(db, request.parcel_id)

    # 4. Queue background task
    background_tasks.add_task(
        execute_ai_pipeline_job,
        job_id=job.job_id,
        parcel_id=request.parcel_id,
        building_name=request.building_name,
        address=request.address,
        latitude=request.latitude,
        longitude=request.longitude,
        height_meters=request.height_meters,
        floor_count=request.floor_count,
        aerial_image_url=request.aerial_image_path,
        parcel_boundary=request.parcel_boundary,
        osm_id=request.osm_id,
    )

    # 5. Return immediately
    return GenericResponse(
        status="pending",
        message="Building processing started. Poll /jobs/{job_id}/status for progress.",
        job_id=job.job_id
    )

@router.get("/jobs/{job_id}/status", response_model=JobStatusResponse)
async def get_job_status(job_id: str, db: AsyncSession = Depends(get_db)):
    """
    Endpoint 2: Track job progress (0-100%)
    """
    job = await get_job(db, job_id)
    if not job:
        raise HTTPException(status_code=404, detail="Job not found")

    # Prefer the dedicated building_id column; fall back to result_json for backward compat
    raw_bldg_id = getattr(job, 'building_id', None)
    if isinstance(raw_bldg_id, str):
        building_id = raw_bldg_id
    elif getattr(job, 'result_json', None) and isinstance(job.result_json, dict):
        building_id = job.result_json.get("building_id")
    else:
        building_id = None

    return JobStatusResponse(
        job_id=job.job_id,
        status=job.status,
        progress_pct=job.progress_pct,
        progress_step=job.progress_step,
        building_id=building_id,
        result_data=job.result_json,
        error_message=getattr(job, "error_message", None)
    )

@router.get("/buildings/{building_id}", response_model=BuildingResponse)
async def get_building(building_id: str, db: AsyncSession = Depends(get_db)):
    """
    Endpoint 3: Serve 3D building data + ULPINs to frontend.
    Serves from DB → in-memory cache → disk exports.
    """
    import shapely.geometry, shapely.wkt, os

    def _to_geojson(geom_val):
        """Convert any geometry representation to a GeoJSON dict."""
        if isinstance(geom_val, dict):
            return geom_val  # Already GeoJSON
        if isinstance(geom_val, str):
            wkt_clean = geom_val.split(";", 1)[-1] if ";" in geom_val else geom_val
            return shapely.geometry.mapping(shapely.wkt.loads(wkt_clean))
        try:
            from geoalchemy2.shape import to_shape
            return shapely.geometry.mapping(to_shape(geom_val))
        except Exception:
            return {"type": "Polygon", "coordinates": []}

    # ── Try DB + cache first ──────────────────────────────────────────────────
    building = await get_building_with_units(db, building_id)

    if building:
        try:
            disk_result = None
            try:
                from backend.services.ai_runner import _load_result_by_building_id
                disk_result = _load_result_by_building_id(building_id)
            except Exception:
                pass
            result_validation = (disk_result or {}).get("validation", {})
            validation = getattr(building, "validation", None)
            units_response = []
            for u in building.units:
                floor_num = getattr(u, "floor", None) or 1
                floor_height = getattr(u, "floor_height_m", None) or 0.0
                units_response.append(UnitResponse(
                    unit_id=u.unit_id, ulpin=u.ulpin, floor=floor_num,
                    centroid=[getattr(u, 'centroid_lat', 0.0), getattr(u, 'centroid_lon', 0.0)],
                    polygon_2d=_to_geojson(u.polygon_2d), area_sqft=getattr(u, 'area_sqft', 0.0) or 0.0,
                    z_min=(floor_num - 1) * floor_height, z_max=floor_num * floor_height,
                    floor_height_m=floor_height
                ))
            b_name = (disk_result or {}).get("building_name") or getattr(building, "building_name", None)
            b_addr = (disk_result or {}).get("address") or getattr(building, "address", None)
            b_lat = (disk_result or {}).get("latitude") or getattr(building, "centroid_lat", None)
            b_lon = (disk_result or {}).get("longitude") or getattr(building, "centroid_lon", None)
            b_created = getattr(building, "created_at", None)

            return BuildingResponse(
                building_id=str(building.building_id),
                parcel_id=str(building.parcel_id) if building.parcel_id else (disk_result or {}).get("parcel_id", "unknown"),
                footprint=_to_geojson(building.footprint),
                height_meters=float(building.height_meters or 0.0),
                floor_count=int(building.floor_count or 1),
                total_units=int(building.total_units or len(units_response)),
                units=units_response,
                building_name=str(b_name) if isinstance(b_name, str) else None,
                address=str(b_addr) if isinstance(b_addr, str) else None,
                latitude=float(b_lat) if isinstance(b_lat, (int, float)) else None,
                longitude=float(b_lon) if isinstance(b_lon, (int, float)) else None,
                created_at=b_created if hasattr(b_created, "isoformat") else None,
                validation=BuildingValidationSummary(
                    is_valid=bool(getattr(validation, "is_valid", result_validation.get("valid", True))),
                    overlaps_detected=int(getattr(validation, "overlaps_detected", len(result_validation.get("overlapping_units", [])))),
                    out_of_bounds=int(getattr(validation, "out_of_bounds", len(result_validation.get("out_of_bounds", [])))),
                    confidence_score=float(getattr(validation, "confidence_score", result_validation.get("confidence_score", 0.0))),
                    errors=result_validation.get("errors", [])
                ),
                underground=(disk_result or {}).get("underground", None),
                building_parts=(disk_result or {}).get("building_parts", None),
                roof=(disk_result or {}).get("roof", None),
                assessment=(disk_result or {}).get("assessment", None),
                floor_source=(disk_result or {}).get("floor_source", None),
                is_floor_estimated=(disk_result or {}).get("is_floor_estimated", None),
                underground_floors=(disk_result or {}).get("underground_floors", None),
                built_up_area_sqm=(disk_result or {}).get("built_up_area_sqm", None),
                building_material=(disk_result or {}).get("building_material", None),
                building_color=(disk_result or {}).get("building_color", None),
                aerial_image_url=(disk_result or {}).get("aerial_image_url", None),
                gemini_vision_data=(disk_result or {}).get("gemini_vision_data", None),
                osm_id=(disk_result or {}).get("osm_id", None)
            )
        except Exception as exc:
            import logging
            logging.getLogger(__name__).warning(f"Building cache hit but response build failed: {exc}. Falling through to disk scan.")
            # fall through to disk-scan below

    # ── Fallback: scan disk exports by building_id OR job_id ────────────────
    exports_dir = os.path.abspath(
        os.path.join(os.path.dirname(__file__), "../../ai/exports")
    )
    result = None
    try:
        for fname in os.listdir(exports_dir):
            if not fname.endswith(".json"):
                continue
            fpath = os.path.join(exports_dir, fname)
            try:
                with open(fpath, encoding='utf-8') as f:
                    data = json.load(f)
                r = data.get("result", data)
                # Match by building_id OR by the file's job_id (= filename stem)
                if (r.get("building_id") == building_id or
                        fname.replace(".json", "") == building_id):
                    result = r
                    break
            except Exception:
                continue
    except Exception:
        pass

    if not result:
        raise HTTPException(status_code=404, detail=f"Building '{building_id}' not found")

    # Build response directly from AI pipeline result dict
    raw_units = result.get("units", [])
    floor_count = result.get("floor_count", 1)
    height     = result.get("height", result.get("height_meters", 0.0))
    floor_ht   = height / floor_count if floor_count else 3.5

    units_response = []
    for u in raw_units:
        floor_num  = u.get("floor", 1)
        centroid   = u.get("centroid", [0.0, 0.0])
        area_sqft  = u.get("area_sqft", u.get("area_sqm", 0) * 10.764)

        units_response.append(
            UnitResponse(
                unit_id=u.get("unit_id", ""),
                ulpin=u.get("ulpin", ""),
                floor=floor_num,
                centroid=centroid if isinstance(centroid, list) else [0.0, 0.0],
                polygon_2d=_to_geojson(u.get("polygon_2d", {})),
                area_sqft=float(area_sqft or 0.0),
                z_min=u.get("z_min"), z_max=u.get("z_max"),
                floor_height_m=u.get("floor_height_m")
            )
        )

    return BuildingResponse(
        building_id=result.get("building_id", building_id),
        parcel_id=result.get("parcel_id", "unknown"),
        footprint=_to_geojson(result.get("footprint", {})),
        height_meters=float(height),
        floor_count=int(floor_count),
        total_units=len(units_response), units=units_response,
        building_name=result.get("building_name"), address=result.get("address"),
        latitude=result.get("latitude"), longitude=result.get("longitude"),
        created_at=result.get("created_at"),
        validation=BuildingValidationSummary(
            is_valid=result.get("validation", {}).get("valid", True),
            overlaps_detected=len(result.get("validation", {}).get("overlapping_units", [])),
            out_of_bounds=len(result.get("validation", {}).get("out_of_bounds", [])),
            confidence_score=result.get("validation", {}).get("confidence_score", 0.0),
            errors=result.get("validation", {}).get("errors", [])
        ),
        underground=result.get("underground", None),
        building_parts=result.get("building_parts", None),
        roof=result.get("roof", None),
        assessment=result.get("assessment", None),
        floor_source=result.get("floor_source", None),
        is_floor_estimated=result.get("is_floor_estimated", None),
        underground_floors=result.get("underground_floors", None),
        built_up_area_sqm=result.get("built_up_area_sqm", None),
        building_material=result.get("building_material", None),
        building_color=result.get("building_color", None),
        aerial_image_url=result.get("aerial_image_url", None),
        gemini_vision_data=result.get("gemini_vision_data", None),
        osm_id=result.get("osm_id", None)
    )

@router.get("/buildings/{building_id}/units", response_model=list[UnitResponse])
async def get_building_units(building_id: str, db: AsyncSession = Depends(get_db)):
    """
    Endpoint: Get list of units for a building.
    Delegates to the get_building endpoint and extracts units.
    """
    # Call the service layer, not the endpoint function, to avoid dependency injection issues
    building_resp = await get_building(building_id, db)
    return building_resp.units

@router.get("/validation/{building_id}", response_model=ValidationResponse)
@router.get("/buildings/{building_id}/validation", response_model=ValidationResponse)
async def get_validation(building_id: str, db: AsyncSession = Depends(get_db)):
    """
    Endpoint 4: Provide validation reports
    """
    val_log = await get_validation_log(db, building_id)
    if val_log:
        return ValidationResponse(
            building_id=building_id,
            is_valid=val_log.is_valid,
            overlaps_detected=val_log.overlaps_detected,
            out_of_bounds=val_log.out_of_bounds,
            confidence_score=val_log.confidence_score,
            errors=val_log.validation_report.get('errors', []) if val_log.validation_report else [],
            checked_at=val_log.checked_at
        )

    # Fallback: check disk exports
    import os
    exports_dir = os.path.abspath(
        os.path.join(os.path.dirname(__file__), "../../ai/exports")
    )
    try:
        for fname in os.listdir(exports_dir):
            if not fname.endswith(".json"):
                continue
            fpath = os.path.join(exports_dir, fname)
            try:
                with open(fpath, encoding='utf-8') as f:
                    data = json.load(f)
                r = data.get("result", data)
                if (r.get("building_id") == building_id or
                        fname.replace(".json", "") == building_id):
                    val = r.get("validation", {})
                    return ValidationResponse(
                        building_id=r.get("building_id", building_id),
                        is_valid=val.get("valid", True),
                        overlaps_detected=len(val.get("overlapping_units", [])),
                        out_of_bounds=len(val.get("out_of_bounds", [])),
                        confidence_score=float(val.get("confidence_score", 0.0)),
                        errors=[str(e) for e in val.get("errors", [])]
                    )
            except Exception:
                continue
    except Exception:
        pass

    raise HTTPException(status_code=404, detail="Validation log not found for this building")


