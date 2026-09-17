import uuid
import pytest
from backend.models import Building, Floor, Unit, Parcel
from backend.schemas import FloorResponse, BuildingResponse, UnitResponse

def test_floor_model_and_relationships():
    parcel_id = uuid.uuid4()
    building_id = uuid.uuid4()
    floor_id = uuid.uuid4()
    unit_id = uuid.uuid4()

    building = Building(
        id=building_id,
        parcel_id=parcel_id,
        building_id="BLDG_TEST_001",
        height_meters=12.0,
        floor_count=3,
        total_units=12
    )

    floor = Floor(
        id=floor_id,
        building_id=building_id,
        floor_number=1,
        label="Floor 1",
        z_min=0.0,
        z_max=4.0,
        height_meters=4.0,
        area_sqm=350.0
    )

    unit = Unit(
        id=unit_id,
        building_id=building_id,
        floor_id=floor_id,
        unit_id="U101",
        ulpin="PARCEL_001-BLDG001-F01-U101-testgeo",
        floor=1,
        floor_height_m=4.0,
        area_sqft=800.0
    )

    building.floors.append(floor)
    floor.units.append(unit)
    building.units.append(unit)

    assert len(building.floors) == 1
    assert building.floors[0].floor_number == 1
    assert building.floors[0].height_meters == 4.0
    assert len(floor.units) == 1
    assert floor.units[0].unit_id == "U101"
    assert floor.units[0].floor_id == floor_id
    assert unit.floor_rel == floor

def test_floor_response_schema():
    floor_resp = FloorResponse(
        id=str(uuid.uuid4()),
        floor_number=2,
        label="Floor 2",
        z_min=4.0,
        z_max=8.0,
        height_meters=4.0,
        area_sqm=350.0,
        polygon_2d={"type": "Polygon", "coordinates": [[[0, 0], [1, 0], [1, 1], [0, 1], [0, 0]]]},
        total_units=4,
        units=[]
    )
    assert floor_resp.floor_number == 2
    assert floor_resp.height_meters == 4.0
    assert floor_resp.z_max == 8.0
