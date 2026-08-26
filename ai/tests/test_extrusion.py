import pytest
from ai.extrusion import extrude_building

@pytest.fixture
def sample_footprint():
    return {
        "type": "Polygon",
        "coordinates": [[[0.0, 0.0], [0.001, 0.0], [0.001, 0.001], [0.0, 0.001], [0.0, 0.0]]]
    }

def test_extrude_building_success(sample_footprint):
    result = extrude_building(sample_footprint, height_meters=30.0, floor_count=10)
    assert result["type"] == "Building3D"
    assert result["z_min"] == 0.0
    assert result["z_max"] == 30.0
    assert result["floor_height_m"] == 3.0
    assert result["floor_count"] == 10
    assert result["volume_m3"] > 0

def test_extrude_building_invalid_height(sample_footprint):
    with pytest.raises(ValueError):
        extrude_building(sample_footprint, height_meters=-5.0, floor_count=10)

def test_extrude_building_invalid_floor_count(sample_footprint):
    with pytest.raises(ValueError):
        extrude_building(sample_footprint, height_meters=30.0, floor_count=0)
