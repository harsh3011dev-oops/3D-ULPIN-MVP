import pytest
import os
import cv2
import numpy as np
from ai.footprint_detection import detect_building_footprint, _pixels_to_geo

@pytest.fixture
def dummy_image_path(tmp_path):
    img_path = str(tmp_path / "test_building.jpg")
    img = np.zeros((300, 300, 3), dtype=np.uint8)
    cv2.rectangle(img, (50, 50), (200, 200), (255, 255, 255), -1)
    cv2.imwrite(img_path, img)
    return img_path

def test_detect_footprint_success(dummy_image_path):
    footprint = detect_building_footprint(dummy_image_path, parcel_boundary={}, debug=False)
    assert footprint["type"] == "Polygon"
    assert len(footprint["coordinates"]) == 1
    coords = footprint["coordinates"][0]
    assert len(coords) >= 4
    # Check that polygon is closed
    assert coords[0] == coords[-1]

def test_detect_footprint_missing_file():
    with pytest.raises(FileNotFoundError):
        detect_building_footprint("non_existent_image.jpg", parcel_boundary={})

def test_pixels_to_geo_fallback():
    pixel_coords = [[100, 100], [200, 100], [200, 200], [100, 200]]
    geo = _pixels_to_geo(pixel_coords, "dummy.jpg")
    assert len(geo) == 4
    assert isinstance(geo[0][0], float)
