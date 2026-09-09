import pytest
from unittest.mock import patch, AsyncMock, MagicMock
from httpx import AsyncClient, ASGITransport
from backend.main import app
from backend.services.gemini_architectural_inference import (
    infer_architectural_metadata,
    _compute_cache_key,
    _extract_json,
    _INFERENCE_CACHE,
)


@pytest.mark.asyncio
async def test_compute_cache_key():
    payload1 = {
        "osm_id": "way/123",
        "building_name": "Test Building",
        "osm_tags": {"building": "yes"},
        "footprint_metrics": {"area_sqm": 500.0, "circularity": 0.8},
    }
    payload2 = {
        "osm_id": "way/123",
        "building_name": "Test Building",
        "osm_tags": {"building": "yes"},
        "footprint_metrics": {"area_sqm": 500.0, "circularity": 0.8},
    }
    k1 = _compute_cache_key(payload1)
    k2 = _compute_cache_key(payload2)
    assert k1 == k2
    assert len(k1) == 32


@pytest.mark.asyncio
async def test_extract_json():
    raw_json = '{"buildingType": "historic", "roofShape": "dome", "confidence": 0.82}'
    res = _extract_json(raw_json)
    assert res is not None
    assert res["buildingType"] == "historic"
    assert res["roofShape"] == "dome"
    assert res["confidence"] == 0.82

    markdown_json = '```json\n{"buildingType": "residential", "confidence": 0.65}\n```'
    res2 = _extract_json(markdown_json)
    assert res2 is not None
    assert res2["buildingType"] == "residential"


@pytest.mark.asyncio
async def test_infer_metadata_endpoint_mocked():
    mock_gemini_json = {
        "candidates": [
            {
                "content": {
                    "parts": [
                        {
                            "text": '{"buildingType": "religious", "roofShape": "dome", "architecturalForm": "central_mass", "confidence": 0.88, "towerProbability": 0.75, "symmetry": "radial", "suggestedMaterial": "marble"}'
                        }
                    ]
                }
            }
        ]
    }

    mock_resp = MagicMock()
    mock_resp.status_code = 200
    mock_resp.json.return_value = mock_gemini_json

    mock_client_instance = AsyncMock()
    mock_client_instance.post = AsyncMock(return_value=mock_resp)
    mock_client_instance.__aenter__.return_value = mock_client_instance
    mock_client_instance.__aexit__.return_value = None

    with patch("backend.services.gemini_architectural_inference.httpx.AsyncClient", return_value=mock_client_instance):
        transport = ASGITransport(app=app)
        async with AsyncClient(transport=transport, base_url="http://test") as ac:
            req_payload = {
                "osm_id": "way/mock_123_unique",
                "building_name": "Incomplete Monument Test",
                "osm_tags": {"historic": "monument"},
                "footprint_metrics": {
                    "area_sqm": 2500.0,
                    "circularity": 0.95,
                    "aspect_ratio": 1.0,
                    "is_circular": False,
                },
                "height": 45.0,
                "levels": 3,
                "has_parts": False,
                "source_metadata": {"historic": "monument"},
            }
            resp = await ac.post("/ai/infer-building-metadata", json=req_payload)
            assert resp.status_code == 200
            data = resp.json()
            assert data["roof_shape"] == "dome"
            assert data["building_type"] == "religious"
            assert data["confidence"] == 0.88
            assert data["provenance"]["source"] == "gemini"
            assert "roof_shape" in data["inferred_fields"]


@pytest.mark.asyncio
async def test_infer_metadata_endpoint_failure_fallback():
    mock_resp = MagicMock()
    mock_resp.status_code = 500

    mock_client_instance = AsyncMock()
    mock_client_instance.post = AsyncMock(return_value=mock_resp)
    mock_client_instance.__aenter__.return_value = mock_client_instance
    mock_client_instance.__aexit__.return_value = None

    with patch("backend.services.gemini_architectural_inference.httpx.AsyncClient", return_value=mock_client_instance):
        transport = ASGITransport(app=app)
        async with AsyncClient(transport=transport, base_url="http://test") as ac:
            req_payload = {
                "osm_id": "way/fail_999_unique",
                "building_name": "Failure Test Building",
                "osm_tags": {},
                "footprint_metrics": {"area_sqm": 200.0, "circularity": 0.5},
            }
            resp = await ac.post("/ai/infer-building-metadata", json=req_payload)
            assert resp.status_code == 200
            data = resp.json()
            assert data["confidence"] == 0.0
            assert data["provenance"]["status"] == "failed"
