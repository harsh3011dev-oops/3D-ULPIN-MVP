import pytest
from ai.floor_division import divide_into_floors, divide_floor_into_units

@pytest.fixture
def sample_footprint():
    return {
        "type": "Polygon",
        "coordinates": [[[0.0, 0.0], [0.001, 0.0], [0.001, 0.001], [0.0, 0.001], [0.0, 0.0]]]
    }

def test_divide_into_floors(sample_footprint):
    floors = divide_into_floors(sample_footprint, height_meters=15.0, floor_count=5)
    assert len(floors) == 5
    assert floors[0]["label"] == "G"
    assert floors[1]["label"] == "1F"
    assert floors[0]["z_min"] == 0.0
    assert floors[0]["z_max"] == 3.0
    assert floors[4]["z_max"] == 15.0

def test_divide_floor_into_units(sample_footprint):
    floor = {
        "floor_number": 1,
        "label": "G",
        "z_min": 0.0,
        "z_max": 3.0,
        "footprint": sample_footprint
    }
    units = divide_floor_into_units(floor, units_per_floor=4)
    assert len(units) == 4
    for unit in units:
        assert "unit_id" in unit
        assert unit["floor"] == 1
        assert "centroid" in unit
        assert unit["area_sqm"] > 0
