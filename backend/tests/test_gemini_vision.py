import pytest
from unittest.mock import patch, AsyncMock, MagicMock
from ai.gemini_vision_analyzer import (
    analyze_building_image,
    _extract_json,
    GEMINI_MODELS,
)


@pytest.mark.asyncio
async def test_vision_extract_json():
    raw = '{"confidence": 92, "roof_shape": "dome", "building_material": "marble", "estimated_floors": 4}'
    res = _extract_json(raw)
    assert res is not None
    assert res["confidence"] == 92
    assert res["roof_shape"] == "dome"
    assert res["building_material"] == "marble"

    fenced = '```json\n{"confidence": 85, "roof_shape": "hipped", "building_color": "terracotta"}\n```'
    res2 = _extract_json(fenced)
    assert res2 is not None
    assert res2["confidence"] == 85
    assert res2["building_color"] == "terracotta"


@pytest.mark.asyncio
async def test_vision_models_list():
    assert "gemini-2.5-flash" in GEMINI_MODELS
    assert "gemini-2.0-flash" in GEMINI_MODELS
    assert "gemini-1.5-flash" in GEMINI_MODELS


@pytest.mark.asyncio
async def test_analyze_building_image_mocked(tmp_path):
    # Create a dummy image file
    import cv2
    import numpy as np

    img = np.zeros((256, 256, 3), dtype=np.uint8)
    dummy_img_path = str(tmp_path / "test_satellite.png")
    cv2.imwrite(dummy_img_path, img)

    mock_gemini_json = {
        "candidates": [
            {
                "content": {
                    "parts": [
                        {
                            "text": '{"confidence": 90, "roof_shape": "dome", "building_material": "sandstone", "building_color": "red", "estimated_floors": 3, "footprint_pixels": [[10, 10], [100, 10], [100, 100], [10, 100]]}'
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

    with patch("ai.gemini_vision_analyzer.httpx.AsyncClient", return_value=mock_client_instance), \
         patch("ai.gemini_vision_analyzer._get_api_key", return_value="test_api_key"):
        result = await analyze_building_image(dummy_img_path)
        assert result is not None
        assert result["confidence"] == 90
        assert result["roof_shape"] == "dome"
        assert result["building_material"] == "sandstone"
        assert len(result["footprint_pixels"]) == 4
