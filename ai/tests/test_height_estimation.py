import pytest
from unittest.mock import patch, MagicMock
from ai.height_estimation import (
    fetch_elevation_point,
    fetch_elevation_batch,
    estimate_height_from_dem_dsm,
    get_cached_elevation,
    set_cached_elevation
)

def test_cached_elevation():
    set_cached_elevation(28.6139, 77.2090, 215.0)
    elev = get_cached_elevation(28.6139, 77.2090)
    assert elev == 215.0

@patch("requests.get")
def test_fetch_elevation_point(mock_get):
    mock_resp = MagicMock()
    mock_resp.status_code = 200
    mock_resp.json.return_value = {"results": [{"latitude": 28.5, "longitude": 77.2, "elevation": 210.0}]}
    mock_get.return_value = mock_resp

    elev = fetch_elevation_point(28.50001, 77.20001)
    assert elev == 210.0

@patch("requests.post")
def test_estimate_height_from_dem_dsm_building_detected(mock_post):
    def side_effect(url, json, timeout):
        locs = json.get("locations", [])
        mock_res = MagicMock()
        mock_res.status_code = 200
        mock_res.json.return_value = {
            "results": [
                {"latitude": loc["latitude"], "longitude": loc["longitude"], "elevation": 215.0 if idx < 4 else 245.0}
                for idx, loc in enumerate(locs)
            ]
        }
        return mock_res

    mock_post.side_effect = side_effect

    res = estimate_height_from_dem_dsm(26.80000, 82.19440)
    assert res is not None
    assert res["height_meters"] == 30.0
    assert res["dem_ground_elevation_m"] == 215.0
    assert res["dsm_surface_elevation_m"] == 245.0
    assert res["confidence"] == 0.75
