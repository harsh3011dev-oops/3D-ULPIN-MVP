import sys
import os
import json
import logging
from datetime import datetime
from shapely.geometry import shape

# Add project root to sys.path so we can import the AI module
sys.path.insert(0, os.path.abspath(os.path.join(os.path.dirname(__file__), '../..')))

from backend.database import AsyncSessionLocal
from backend.services import supabase_service
from backend.models import Building, Unit, ValidationLog

logger = logging.getLogger(__name__)

# ── Persistent storage directory ─────────────────────────────────────────────
_EXPORTS_DIR = os.path.abspath(os.path.join(os.path.dirname(__file__), '../../ai/exports'))
os.makedirs(_EXPORTS_DIR, exist_ok=True)


def _save_result_to_disk(job_id: str, result: dict):
    """Persist pipeline result so it survives server restarts."""
    try:
        path = os.path.join(_EXPORTS_DIR, f"{job_id}.json")
        with open(path, 'w') as f:
            json.dump({'job_id': job_id, 'result': result}, f, indent=2)
        logger.info(f"Pipeline result saved to {path}")
    except Exception as e:
        logger.warning(f"Could not save result to disk: {e}")


def _load_result_from_disk(job_id: str) -> dict | None:
    """Load pipeline result from disk if available."""
    try:
        path = os.path.join(_EXPORTS_DIR, f"{job_id}.json")
        if os.path.exists(path):
            with open(path) as f:
                data = json.load(f)
            return data.get('result')
    except Exception:
        pass
    return None


def _load_result_by_building_id(building_id: str) -> dict | None:
    """Scan exports dir for a result matching building_id."""
    try:
        for fname in os.listdir(_EXPORTS_DIR):
            if not fname.endswith('.json'):
                continue
            fpath = os.path.join(_EXPORTS_DIR, fname)
            try:
                with open(fpath) as f:
                    data = json.load(f)
                result = data.get('result', {})
                if result.get('building_id') == building_id:
                    return result
            except Exception:
                continue
    except Exception:
        pass
    return None

async def execute_ai_pipeline_job(job_id: str, parcel_id: str, address: str, height_meters: float, floor_count: int, latitude: float = None, longitude: float = None, units_per_floor: int = 4, aerial_image_url: str = None, parcel_boundary: dict = None):
    """Background task to run the AI pipeline and store results in Supabase."""
    logger.info(f"Starting AI pipeline for job {job_id}")
    
    async with AsyncSessionLocal() as db:
        try:
            # 1. Update Job status to 'processing'
            await supabase_service.update_job_status(
                db, job_id, "processing", 0, "Initializing AI Pipeline", started_at=datetime.utcnow()
            )

            # 2. Call AI pipeline
            try:
                from ai.pipeline import process_building
                # Wait for 50% progress
                await supabase_service.update_job_status(db, job_id, "processing", 50, "Running AI Inference")
                
                # Mock or real call depending on if process_building is async
                result = process_building(
                    parcel_id=parcel_id,
                    address=address,
                    latitude=latitude,
                    longitude=longitude,
                    height_meters=height_meters,
                    floor_count=floor_count,
                    parcel_boundary=parcel_boundary
                )
            except ImportError:
                # Fallback mock for testing if AI module isn't fully ready
                logger.warning("Could not import ai.pipeline.process_building. Using mock data.")
                result = _get_mock_ai_result(parcel_id)
            
            # Update progress
            await supabase_service.update_job_status(db, job_id, "processing", 90, "Saving to Database")

            # 3. Save to Supabase (or fallback to cache)
            building_id = result.get('building_id')
            
            try:
                # Convert GeoJSON footprints to WKT for PostGIS
                footprint_wkt = f"SRID=4326;{shape(result['footprint']).wkt}"
                
                building = Building(
                    parcel_id=None,  # Ideally we'd look up the parcel UUID first
                    building_id=building_id,
                    footprint=footprint_wkt,
                    height_meters=result['height'],
                    floor_count=result['floor_count'],
                    total_units=len(result.get('units', [])),
                    centroid_lat=result['footprint']['coordinates'][0][0][1], # Rough centroid
                    centroid_lon=result['footprint']['coordinates'][0][0][0]
                )
                db.add(building)
                await db.flush() # Get the UUID
    
                # Insert Units
                for u in result.get('units', []):
                    unit_wkt = f"SRID=4326;{shape(u['polygon_2d']).wkt}"
                    unit = Unit(
                        building_id=building.id,
                        unit_id=u['unit_id'],
                        ulpin=u['ulpin'],
                        floor=u['floor'],
                        floor_height_m=u['floor_height_m'],
                        polygon_2d=unit_wkt,
                        centroid_lat=u['centroid'][0],
                        centroid_lon=u['centroid'][1],
                        area_sqft=u.get('area_sqm', 0) * 10.764 # Convert sqm to sqft
                    )
                    db.add(unit)
                
                # Insert Validation Log
                val_data = result.get('validation', {})
                val_log = ValidationLog(
                    building_id=building.id,
                    is_valid=val_data.get('valid', True),
                    overlaps_detected=len(val_data.get('overlapping_units', [])),
                    out_of_bounds=len(val_data.get('out_of_bounds', [])),
                    confidence_score=95.0, # Placeholder
                    validation_report=val_data
                )
                db.add(val_log)
                await db.commit()
            except Exception as e:
                logger.warning(f"Database unavailable for pipeline flush, saving result to memory cache: {e}")
                if db:
                    try:
                        await db.rollback()
                    except:
                        pass
            # Save result to disk for persistence across restarts
            _save_result_to_disk(job_id, result)
            # Also populate in-memory building cache
            supabase_service._BUILDINGS_CACHE[building_id] = result
            supabase_service._VALIDATIONS_CACHE[building_id] = result.get('validation', {})

            # 4. Update Job to completed
            await supabase_service.update_job_status(
                db, 
                job_id, 
                "completed", 
                100, 
                "Done", 
                result_json=result,
                completed_at=datetime.utcnow()
            )
            logger.info(f"Job {job_id} completed successfully.")

        except Exception as e:
            # Handle failure
            logger.error(f"Job {job_id} failed: {e}")
            await db.rollback()
            await supabase_service.update_job_status(
                db, 
                job_id, 
                "failed", 
                error_message=str(e),
                completed_at=datetime.utcnow()
            )

def _get_mock_ai_result(parcel_id: str) -> dict:
    """Provides a mock result if the AI module is not available."""
    import uuid
    building_id = f"bldg-{uuid.uuid4().hex[:8]}"
    return {
        "status": "success",
        "building_id": building_id,
        "footprint": {
            "type": "Polygon",
            "coordinates": [[[77.087, 28.459], [77.088, 28.459], [77.088, 28.460], [77.087, 28.460], [77.087, 28.459]]]
        },
        "height": 70.0,
        "floor_count": 20,
        "units": [
            {
                "unit_id": "UNIT_F01_A01",
                "floor": 1,
                "floor_height_m": 3.5,
                "polygon_2d": {
                    "type": "Polygon",
                    "coordinates": [[[77.0871, 28.4591], [77.0879, 28.4591], [77.0879, 28.4599], [77.0871, 28.4599], [77.0871, 28.4591]]]
                },
                "centroid": [28.4595, 77.0875],
                "ulpin": f"{parcel_id}-{building_id}-F01-UA01-mock",
                "area_sqm": 80.0
            }
        ],
        "validation": {
            "overlaps_detected": False,
            "overlapping_units": [],
            "out_of_bounds": [],
            "valid": True
        }
    }
