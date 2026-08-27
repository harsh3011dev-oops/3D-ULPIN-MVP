"""
Unit Tests for Automated Quality Gates Engine (3D ULPIN AI Pipeline)
"""

import pytest

try:
    from ai.quality_gates import QualityGates
except ModuleNotFoundError:
    from quality_gates import QualityGates


@pytest.fixture
def gates():
    return QualityGates()


@pytest.fixture
def valid_pipeline_output():
    footprint = {
        "type": "Polygon",
        "coordinates": [[[77.086, 28.853], [77.087, 28.853], [77.087, 28.854], [77.086, 28.854], [77.086, 28.853]]]
    }
    unit1 = {
        "unit_id": "unit_101",
        "floor": 1,
        "polygon_2d": {
            "type": "Polygon",
            "coordinates": [[[77.086, 28.853], [77.0865, 28.853], [77.0865, 28.8535], [77.086, 28.8535], [77.086, 28.853]]]
        },
        "ulpin": "PARCEL_001-BLDG001A-F01-UA01-ttnfv1h"
    }
    unit2 = {
        "unit_id": "unit_102",
        "floor": 1,
        "polygon_2d": {
            "type": "Polygon",
            "coordinates": [[[77.0865, 28.8535], [77.087, 28.8535], [77.087, 28.854], [77.0865, 28.854], [77.0865, 28.8535]]]
        },
        "ulpin": "PARCEL_001-BLDG001A-F01-UA02-ttnfv1j"
    }
    return {
        "status": "success",
        "footprint": footprint,
        "units": [unit1, unit2]
    }


def test_footprint_gate(gates, valid_pipeline_output):
    res = gates.validate_footprint(valid_pipeline_output["footprint"])
    assert res["passed"] is True
    assert res["iou_score"] >= 0.88


def test_boundary_gate(gates, valid_pipeline_output):
    res = gates.validate_units_in_boundary(valid_pipeline_output["units"], valid_pipeline_output["footprint"])
    assert res["passed"] is True
    assert res["units_out_of_bounds"] == 0


def test_no_overlaps_gate(gates, valid_pipeline_output):
    res = gates.validate_no_overlaps(valid_pipeline_output["units"])
    assert res["passed"] is True
    assert res["overlaps_found"] == 0


def test_ulpin_format_gate(gates, valid_pipeline_output):
    ulpins = [u["ulpin"] for u in valid_pipeline_output["units"]]
    res = gates.validate_ulpin_format(ulpins)
    assert res["passed"] is True
    assert res["duplicate_ulpins"] == 0


def test_run_all_gates_success(gates, valid_pipeline_output):
    res = gates.run_all_gates(valid_pipeline_output)
    assert res["overall_passed"] is True
    assert len(res["failed_gates"]) == 0
