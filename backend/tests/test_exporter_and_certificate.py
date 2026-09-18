"""
backend/tests/test_exporter_and_certificate.py
Automated Tests for 3D GIS Multi-Format Exporter and 3D ULPIN Certificate Generator.
"""

import pytest
from ai.exporter import export_building_3d
from backend.services.certificate_generator import generate_3d_ulpin_certificate_html


def test_exporter_geojson3d():
    b_data = {
        "building_id": "bldg_test_101",
        "parcel_id": "PARCEL-DEL-2024-001",
        "building_name": "Test Tower",
        "height_meters": 36.0,
        "floor_count": 12,
        "footprint": {
            "type": "Polygon",
            "coordinates": [[[77.21, 28.63], [77.22, 28.63], [77.22, 28.64], [77.21, 28.64], [77.21, 28.63]]]
        },
        "units": [
            {
                "unit_id": "UNIT_F01_101",
                "ulpin": "DEL-2024-001-F01-U101-7721",
                "floor": 1,
                "label": "Flat 101",
                "z_min": 0.0,
                "z_max": 3.0,
                "area_sqm": 120.0,
                "polygon_2d": {
                    "type": "Polygon",
                    "coordinates": [[[77.21, 28.63], [77.215, 28.63], [77.215, 28.635], [77.21, 28.635], [77.21, 28.63]]]
                }
            }
        ]
    }

    res_geojson = export_building_3d(b_data, format_type="geojson3d")
    assert res_geojson["type"] == "FeatureCollection"
    assert len(res_geojson["features"]) >= 2
    assert res_geojson["features"][0]["properties"]["building_id"] == "bldg_test_101"

    res_cityjson = export_building_3d(b_data, format_type="cityjson")
    assert res_cityjson["type"] == "CityJSON"
    assert len(res_cityjson["vertices"]) > 0

    res_obj = export_building_3d(b_data, format_type="obj")
    assert isinstance(res_obj, str)
    assert "v " in res_obj
    assert "f " in res_obj


def test_certificate_html_generator():
    b_data = {
        "building_id": "bldg_test_101",
        "parcel_id": "PARCEL-DEL-2024-001",
        "building_name": "Antigravity Tower",
        "city": "New Delhi"
    }
    u_data = {
        "unit_id": "UNIT_F04_U02",
        "ulpin": "DEL-2024-001-F04-U02-77212863",
        "floor": 4,
        "label": "Flat 402",
        "z_min": 9.0,
        "z_max": 12.0,
        "area_sqm": 134.7,
        "centroid": [28.6315, 77.2167]
    }

    html = generate_3d_ulpin_certificate_html(b_data, u_data)
    assert "3D ULPIN Title Certificate" in html
    assert "DEL-2024-001-F04-U02-77212863" in html
    assert "DILRMP" in html
    assert "ISO 19152 LADM" in html
