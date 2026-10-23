"""
Tests for YOLO11s-seg Building Instance Segmentation Integration in 3D-ULPIN-MVP
================================================================================
Verifies:
1. Model package import and checkpoint loading.
2. Checkpoint SHA-256 cryptographic match.
3. Positive image inference through detector adapter.
4. Negative image zero-detection handling.
5. Geometry validation, polygon bounds, and schema conformity.
6. Georeferencing projection without coordinate fabrication.
7. Missing checkpoint error handling.
8. HybridMultiFootprintDetector integration with ML detector fallback.
"""

import os
import sys
import pytest
import numpy as np
from shapely.geometry import shape

# Ensure project root is in sys.path
PROJECT_ROOT = os.path.dirname(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))
if PROJECT_ROOT not in sys.path:
    sys.path.insert(0, PROJECT_ROOT)

from ai.detector_protocol import (
    YOLOSegmentationMultiDetector,
    YOLO11SegmentationMultiDetector,
    HybridMultiFootprintDetector,
    FootprintCandidate,
    PROJECT_VERIFIED_WEIGHTS
)
from models.building_segmentation.inference import BuildingSegmentationModel


EXPECTED_SHA256 = "9e649fbdf265420f1dd30899935d60df70c7961a716b3f432d978d7c0bbfb02b"


def test_01_model_import_and_checkpoint_hash():
    """Verify package import and exact SHA-256 hash match."""
    import hashlib
    assert os.path.exists(PROJECT_VERIFIED_WEIGHTS), f"Checkpoint missing at {PROJECT_VERIFIED_WEIGHTS}"

    with open(PROJECT_VERIFIED_WEIGHTS, "rb") as f:
        actual_hash = hashlib.sha256(f.read()).hexdigest()
    assert actual_hash == EXPECTED_SHA256, f"Hash mismatch: got {actual_hash}"

    # Verify BuildingSegmentationModel instantiates on CPU
    model = BuildingSegmentationModel(checkpoint_path=PROJECT_VERIFIED_WEIGHTS, device="cpu")
    assert model is not None
    assert model.default_conf == 0.25
    assert model.default_imgsz == 800


def test_02_detector_adapter_loading():
    """Verify YOLOSegmentationMultiDetector loads the verified package."""
    detector = YOLOSegmentationMultiDetector(device="cpu")
    assert detector.is_available is True
    assert detector.detector_name == "yolo11_building_segmenter"
    assert detector.detector_version == "1.0.0"

    # Verify canonical alias
    assert YOLO11SegmentationMultiDetector is YOLOSegmentationMultiDetector


def test_03_positive_image_inference():
    """Run inference on positive sample tile with valid georeferencing."""
    detector = YOLOSegmentationMultiDetector(device="cpu", conf_threshold=0.25)
    
    sample_img = os.path.join(PROJECT_ROOT, "models", "building_segmentation", "examples", "sample_aerial_tile.png")
    assert os.path.exists(sample_img), f"Sample image not found: {sample_img}"

    # Georeferencing bounds for test tile (e.g. Delhi / suburban area)
    geo_xform = {
        "min_lon": 77.2000,
        "max_lon": 77.2100,
        "min_lat": 28.6000,
        "max_lat": 28.6100,
        "img_w": 640,
        "img_h": 640
    }
    boundary = {
        "type": "Polygon",
        "coordinates": [[
            [77.2000, 28.6000],
            [77.2100, 28.6000],
            [77.2100, 28.6100],
            [77.2000, 28.6100],
            [77.2000, 28.6000]
        ]]
    }

    candidates = detector.detect_footprints(
        boundary=boundary,
        image_path=sample_img,
        geo_transform=geo_xform
    )

    assert len(candidates) > 0, "Expected at least 1 building candidate on positive tile"
    for c in candidates:
        assert isinstance(c, FootprintCandidate)
        assert c.confidence >= 0.25
        assert c.detector_name == "yolo11_building_segmenter"
        assert c.estimated_area_sqm is not None and c.estimated_area_sqm > 0
        assert c.approx_centroid is not None and len(c.approx_centroid) == 2
        # Check geographic coordinate bounds
        poly = shape(c.geometry)
        assert poly.is_valid
        minx, miny, maxx, maxy = poly.bounds
        assert 77.199 <= minx <= 77.211, f"Longitude out of expected bounds: {minx}"
        assert 28.599 <= miny <= 28.611, f"Latitude out of expected bounds: {miny}"
        # Check provenance
        assert c.provenance["model"] == "YOLO11s-seg"
        assert c.provenance["checkpoint_sha256"] == EXPECTED_SHA256
        assert "pixel_polygon" in c.provenance
        assert "pixel_bbox" in c.provenance


def test_04_negative_image_zero_detections(tmp_path):
    """Verify negative / blank image produces 0 detections without fabricating geometries."""
    detector = YOLOSegmentationMultiDetector(device="cpu")

    import cv2
    blank_img = np.zeros((640, 640, 3), dtype=np.uint8)
    blank_path = str(tmp_path / "blank_tile.png")
    cv2.imwrite(blank_path, blank_img)

    geo_xform = {
        "min_lon": 77.2000,
        "max_lon": 77.2100,
        "min_lat": 28.6000,
        "max_lat": 28.6100,
        "img_w": 640,
        "img_h": 640
    }
    boundary = {
        "type": "Polygon",
        "coordinates": [[
            [77.2000, 28.6000],
            [77.2100, 28.6000],
            [77.2100, 28.6100],
            [77.2000, 28.6100],
            [77.2000, 28.6000]
        ]]
    }

    candidates = detector.detect_footprints(
        boundary=boundary,
        image_path=blank_path,
        geo_transform=geo_xform
    )

    assert candidates == [], f"Expected empty list for blank tile, got {len(candidates)} candidates"


def test_05_missing_georeferencing_behavior():
    """Verify that detector does NOT invent geographic coordinates if georeferencing is missing."""
    detector = YOLOSegmentationMultiDetector(device="cpu")
    sample_img = os.path.join(PROJECT_ROOT, "models", "building_segmentation", "examples", "sample_aerial_tile.png")
    boundary = {"type": "Polygon", "coordinates": [[[0, 0], [1, 0], [1, 1], [0, 1], [0, 0]]]}

    # When geo_transform is None, detector must not invent coordinates
    candidates = detector.detect_footprints(
        boundary=boundary,
        image_path=sample_img,
        geo_transform=None
    )
    assert candidates == []


def test_06_missing_checkpoint_error_handling():
    """Verify clear FileNotFoundError when checkpoint path does not exist."""
    fake_weights = "/path/to/non_existent_weights.pt"
    detector = YOLOSegmentationMultiDetector(weights_path=fake_weights)
    assert detector.is_available is False
    with pytest.raises(FileNotFoundError) as exc_info:
        detector._load_model()
    assert "Building segmentation weights not found" in str(exc_info.value)


def test_07_hybrid_detector_integration():
    """Verify HybridMultiFootprintDetector automatically uses YOLO11 detector when initialized."""
    hybrid = HybridMultiFootprintDetector()
    assert hybrid.ml_detector is not None
    assert isinstance(hybrid.ml_detector, YOLOSegmentationMultiDetector)
    assert hybrid.ml_detector.detector_name == "yolo11_building_segmenter"
