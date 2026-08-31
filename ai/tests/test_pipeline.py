import pytest
from ai.pipeline import process_building

def test_process_building_with_address():
    test_input = {
        "parcel_id": "PARCEL_TEST_PIPELINE",
        "building_id": "bldg-test-pipeline-01",
        "address": "Sector 62, Noida, Uttar Pradesh, India",
        "floor_count": 2,
        "height_meters": 7.0
    }
    result = process_building(test_input)
    assert result["status"] == "success"
    assert result["building_id"] == "bldg-test-pipeline-01"
    assert result["floor_count"] == 2
    assert result["height"] == 7.0
    assert len(result["units"]) == 8  # 2 floors * 4 units/floor
    assert result["validation"]["valid"] is True

def test_process_building_invalid_input():
    result = process_building({})
    assert result["status"] == "error"
    assert "message" in result
