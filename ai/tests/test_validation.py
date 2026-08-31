import pytest
from ai.spatial_validation import validate_spatial_data

@pytest.fixture
def sample_building_footprint():
    return {
        "type": "Polygon",
        "coordinates": [[[0.0, 0.0], [0.01, 0.0], [0.01, 0.01], [0.0, 0.01], [0.0, 0.0]]]
    }

def test_validate_spatial_data_valid(sample_building_footprint):
    units = [
        {
            "unit_id": "UNIT_F01_A01",
            "floor": 1,
            "polygon_2d": {
                "type": "Polygon",
                "coordinates": [[[0.0, 0.0], [0.005, 0.0], [0.005, 0.005], [0.0, 0.005], [0.0, 0.0]]]
            }
        },
        {
            "unit_id": "UNIT_F01_A02",
            "floor": 1,
            "polygon_2d": {
                "type": "Polygon",
                "coordinates": [[[0.005, 0.0], [0.01, 0.0], [0.01, 0.005], [0.005, 0.005], [0.005, 0.0]]]
            }
        }
    ]
    report = validate_spatial_data(units, sample_building_footprint)
    assert report["valid"] is True
    assert report["overlaps_detected"] is False

def test_validate_spatial_data_out_of_bounds(sample_building_footprint):
    units = [
        {
            "unit_id": "UNIT_F01_OUT",
            "floor": 1,
            "polygon_2d": {
                "type": "Polygon",
                "coordinates": [[[0.02, 0.02], [0.03, 0.02], [0.03, 0.03], [0.02, 0.03], [0.02, 0.02]]]
            }
        }
    ]
    report = validate_spatial_data(units, sample_building_footprint)
    assert report["valid"] is False
    assert "UNIT_F01_OUT" in report["out_of_bounds"]
