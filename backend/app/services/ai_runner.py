import os
import sys
import time
import uuid
from typing import Dict, Any

# Ensure AI module path is importable
AI_PATH = os.path.abspath(os.path.join(os.path.dirname(__file__), '../../../ai'))
if AI_PATH not in sys.path:
    sys.path.append(AI_PATH)

from pipeline import process_building
from app.services.supabase_service import supabase_service

# In-memory Job & Building Store
jobs_db: Dict[str, Dict[str, Any]] = {}
buildings_db: Dict[str, Dict[str, Any]] = {}

def execute_ai_pipeline_job(job_id: str, payload: Dict[str, Any]):
    """Background task runner for executing 3D ULPIN AI Pipeline"""
    try:
        jobs_db[job_id]["status"] = "processing"
        jobs_db[job_id]["progress_pct"] = 25
        jobs_db[job_id]["step"] = "Executing Geocoding & OSM Elevation Retrieval..."

        # Call real AI pipeline
        input_data = {
            "parcel_id": payload["parcel_id"],
            "address": payload.get("address", "Cyber Hub Gurugram"),
            "floor_count": payload["floor_count"],
            "height_meters": payload["height_meters"],
            "units_per_floor": payload.get("units_per_floor", 4)
        }

        jobs_db[job_id]["progress_pct"] = 60
        jobs_db[job_id]["step"] = "Slicing Floor Slabs & Generating 3D ULPIN Codes..."

        result = process_building(input_data)

        building_id = result.get("building_id", f"bldg-{uuid.uuid4().hex[:8]}")
        result["building_id"] = building_id

        # Save to memory and Supabase Cloud DB
        buildings_db[building_id] = result
        supabase_service.save_building(result)

        jobs_db[job_id]["status"] = "done"
        jobs_db[job_id]["progress_pct"] = 100
        jobs_db[job_id]["step"] = "3D ULPIN Generation Complete"
        jobs_db[job_id]["building_id"] = building_id

    except Exception as e:
        print(f"Pipeline Execution Error: {e}")
        jobs_db[job_id]["status"] = "failed"
        jobs_db[job_id]["error_message"] = str(e)
