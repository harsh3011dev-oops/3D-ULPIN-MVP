"""
Unit Tests for Confidence Scoring Engine (3D ULPIN AI Pipeline)
"""

import pytest

try:
    from ai.confidence_scorer import ConfidenceScorer
except ModuleNotFoundError:
    from confidence_scorer import ConfidenceScorer


@pytest.fixture
def scorer():
    return ConfidenceScorer()


@pytest.fixture
def sample_data():
    footprint = {
        "type": "Polygon",
        "coordinates": [[[77.086, 28.853], [77.087, 28.853], [77.087, 28.854], [77.086, 28.854], [77.086, 28.853]]]
    }
    parcel_boundary = {
        "type": "Polygon",
        "coordinates": [[[77.085, 28.852], [77.088, 28.852], [77.088, 28.855], [77.085, 28.855], [77.085, 28.852]]]
    }
    floors = [
        {"floor_number": 1, "z_min": 0.0, "z_max": 3.5},
        {"floor_number": 2, "z_min": 3.5, "z_max": 7.0}
    ]
    units = [
        {"unit_id": "U1", "floor": 1, "polygon_2d": footprint},
        {"unit_id": "U2", "floor": 2, "polygon_2d": footprint}
    ]
    ulpins = [
        "PARCEL_001-BLDG001A-F01-UA01-ttnfv1h",
        "PARCEL_001-BLDG001A-F02-UA01-ttnfv1j"
    ]
    return {
        "footprint": footprint,
        "parcel_boundary": parcel_boundary,
        "floors": floors,
        "units": units,
        "ulpins": ulpins
    }


def test_score_footprint(scorer, sample_data):
    score = scorer.score_footprint(None, sample_data["footprint"], sample_data["parcel_boundary"])
    assert 0.0 <= score <= 100.0
    assert score >= 70.0


def test_score_floor_division(scorer, sample_data):
    score = scorer.score_floor_division(sample_data["floors"])
    assert score == 100.0


def test_score_unit_subdivision(scorer, sample_data):
    score = scorer.score_unit_subdivision(sample_data["units"], sample_data["footprint"])
    assert score == 100.0


def test_score_ulpin_generation(scorer, sample_data):
    score = scorer.score_ulpin_generation(sample_data["ulpins"])
    assert score == 100.0


def test_overall_confidence_and_breakdown(scorer, sample_data):
    breakdown = scorer.get_confidence_breakdown(
        footprint=sample_data["footprint"],
        parcel_boundary=sample_data["parcel_boundary"],
        floors=sample_data["floors"],
        units=sample_data["units"],
        ulpins=sample_data["ulpins"]
    )
    assert "overall_pipeline_confidence" in breakdown
    assert breakdown["overall_pipeline_confidence"] >= 80.0
    assert breakdown["risk_level"] in ["LOW", "MEDIUM", "HIGH"]
