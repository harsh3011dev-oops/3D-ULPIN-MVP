import pytest
from ai.ulpin_generation import generate_ulpin, validate_ulpin_format

def test_generate_ulpin():
    ulpin = generate_ulpin(
        parcel_id="PARCEL_001",
        building_id="550e8400-e29b-41d4-a716-446655440000",
        floor_number=1,
        unit_label="A01",
        centroid=[28.5921, 77.0490]
    )
    assert ulpin.startswith("PARCEL_001-550E8400-F01-UA01-")
    assert len(ulpin.split("-")) >= 5

def test_validate_ulpin_format():
    valid_ulpin = "PARCEL_001-550E8400-F01-UA01-ttnfv1h"
    assert validate_ulpin_format(valid_ulpin) is True

def test_validate_ulpin_format_invalid():
    invalid_ulpin = "INVALID_ULPIN_STRING"
    assert validate_ulpin_format(invalid_ulpin) is False
