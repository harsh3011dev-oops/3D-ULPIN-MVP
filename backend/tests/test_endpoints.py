import pytest
from unittest.mock import AsyncMock, patch, MagicMock
from httpx import AsyncClient, ASGITransport
from datetime import datetime, timezone
from geoalchemy2.elements import WKTElement

from backend.main import app
from backend.database import get_db

# Dummy DB session override
async def override_get_db():
    session = AsyncMock()
    yield session

app.dependency_overrides[get_db] = override_get_db


@pytest.mark.asyncio
async def test_post_buildings_create_endpoint():
    """
    1. Verify POST /buildings/create and /api/v1/buildings/create → returns {job_id, status}
    """
    mock_job = MagicMock()
    mock_job.job_id = "test-job-uuid-1234"

    for path in ["/buildings/create", "/api/buildings/create", "/api/v1/buildings/create"]:
        with patch("backend.api.endpoints.create_job", new_callable=AsyncMock, return_value=mock_job), \
             patch("backend.api.endpoints.execute_ai_pipeline_job"):
            async with AsyncClient(transport=ASGITransport(app=app), base_url="http://test") as ac:
                response = await ac.post(
                    path,
                    json={
                        "parcel_id": "PARCEL_GURUGRAM_001",
                        "address": "Cyber Hub, Gurugram",
                        "height_meters": 45.0,
                        "floor_count": 15
                    },
                )

        assert response.status_code == 202
        data = response.json()
        assert "job_id" in data
        assert "status" in data
        assert data["job_id"] == "test-job-uuid-1234"
        assert data["status"] == "pending"


@pytest.mark.asyncio
async def test_get_jobs_status_endpoint():
    """
    2. Verify GET /jobs/{id}/status → returns {progress_pct, status}
    """
    mock_job = MagicMock()
    mock_job.job_id = "test-job-uuid-1234"
    mock_job.status = "processing"
    mock_job.progress_pct = 45
    mock_job.progress_step = "EXTRUDING_3D_VOLUMES"
    mock_job.result_json = None

    for path in ["/jobs/test-job-uuid-1234/status", "/api/v1/jobs/test-job-uuid-1234/status"]:
        with patch("backend.api.endpoints.get_job", new_callable=AsyncMock, return_value=mock_job):
            async with AsyncClient(transport=ASGITransport(app=app), base_url="http://test") as ac:
                response = await ac.get(path)

        assert response.status_code == 200
        data = response.json()
        assert "progress_pct" in data
        assert "status" in data
        assert data["progress_pct"] == 45
        assert data["status"] == "processing"
        assert data["job_id"] == "test-job-uuid-1234"


@pytest.mark.asyncio
async def test_get_buildings_by_id_endpoint():
    """
    3. Verify GET /buildings/{id} → returns Full building with units
    """
    mock_building = MagicMock()
    mock_building.building_id = "BLDG_001"
    mock_building.parcel_id = "PARCEL_001"
    mock_building.footprint = WKTElement("POLYGON((77.04 28.59, 77.05 28.59, 77.05 28.60, 77.04 28.60, 77.04 28.59))", srid=4326)
    mock_building.height_meters = 45.0
    mock_building.floor_count = 15
    mock_building.total_units = 1

    mock_unit = MagicMock()
    mock_unit.unit_id = "UNIT_F1_U1"
    mock_unit.ulpin = "PARCEL_001-BLDG_001-F01-U01"
    mock_unit.floor = 1
    mock_unit.centroid_lat = 28.595
    mock_unit.centroid_lon = 77.045
    mock_unit.polygon_2d = WKTElement("POLYGON((77.04 28.59, 77.05 28.59, 77.05 28.60, 77.04 28.60, 77.04 28.59))", srid=4326)
    mock_unit.area_sqft = 1200.0

    mock_building.units = [mock_unit]

    for path in ["/buildings/BLDG_001", "/api/v1/buildings/BLDG_001"]:
        with patch("backend.api.endpoints.get_building_with_units", new_callable=AsyncMock, return_value=mock_building):
            async with AsyncClient(transport=ASGITransport(app=app), base_url="http://test") as ac:
                response = await ac.get(path)

        assert response.status_code == 200
        data = response.json()
        assert "building_id" in data
        assert "parcel_id" in data
        assert "footprint" in data
        assert "height_meters" in data
        assert "floor_count" in data
        assert "total_units" in data
        assert "units" in data
        assert isinstance(data["units"], list)
        assert len(data["units"]) == 1
        unit = data["units"][0]
        assert "unit_id" in unit
        assert "ulpin" in unit
        assert "floor" in unit
        assert "centroid" in unit
        assert "polygon_2d" in unit
        assert "area_sqft" in unit


@pytest.mark.asyncio
async def test_get_validation_by_id_endpoint():
    """
    4. Verify GET /validation/{id} → returns Validation report
    """
    mock_val_log = MagicMock()
    mock_val_log.is_valid = True
    mock_val_log.overlaps_detected = 0
    mock_val_log.out_of_bounds = 0
    mock_val_log.confidence_score = 0.98
    mock_val_log.validation_report = {"errors": []}
    mock_val_log.checked_at = datetime.now(timezone.utc)

    for path in ["/validation/BLDG_001", "/api/v1/validation/BLDG_001"]:
        with patch("backend.api.endpoints.get_validation_log", new_callable=AsyncMock, return_value=mock_val_log):
            async with AsyncClient(transport=ASGITransport(app=app), base_url="http://test") as ac:
                response = await ac.get(path)

        assert response.status_code == 200
        data = response.json()
        assert "building_id" in data
        assert "is_valid" in data
        assert "overlaps_detected" in data
        assert "out_of_bounds" in data
        assert "confidence_score" in data
        assert "errors" in data
        assert data["building_id"] == "BLDG_001"
        assert data["is_valid"] is True
