import pytest
from httpx import AsyncClient
from backend.main import app

@pytest.mark.asyncio
async def test_building_create_success():
    async with AsyncClient(app=app, base_url="http://test") as ac:
        response = await ac.post(
            "/api/v1/buildings/create",
            json={
                "parcel_id": "PARCEL_CYBER_HUB_GURUGRAM",
                "address": "Cyber Hub, DLF Cyber City, Gurugram, Haryana 122001, India",
                "height_meters": 70.0,
                "floor_count": 20
            },
        )
    assert response.status_code == 202
    data = response.json()
    assert "job_id" in data
    assert data["status"] == "pending"

@pytest.mark.asyncio
async def test_building_create_invalid_height():
    async with AsyncClient(app=app, base_url="http://test") as ac:
        response = await ac.post(
            "/api/v1/buildings/create",
            json={
                "parcel_id": "PARCEL_INVALID",
                "address": "Test",
                "height_meters": -5.0,
                "floor_count": 20
            },
        )
    assert response.status_code == 400
