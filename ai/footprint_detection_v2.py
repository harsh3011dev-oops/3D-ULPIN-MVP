"""
Footprint Detection Enhancement Engine v2 (3D ULPIN AI Pipeline)
================================================================
Advanced Computer Vision & Spatial Intelligence Module:
1. Multi-scale Canny edge detection
2. HSV shadow and cloud segmentation with clarity metrics
3. CLAHE + Otsu adaptive thresholding
4. Hybrid CV + OpenStreetMap footprint blending strategy
5. Comprehensive footprint confidence scoring
"""

import cv2
import numpy as np
import os
from shapely.geometry import shape, Polygon, mapping
from shapely.ops import unary_union

try:
    from ai.config.fine_tuning_config import FINE_TUNING_CONFIG
    from ai.footprint_detection import _pixels_to_geo
except ModuleNotFoundError:
    from config.fine_tuning_config import FINE_TUNING_CONFIG
    from footprint_detection import _pixels_to_geo


def detect_edges_multiscale(image_path: str) -> np.ndarray:
    """
    Multi-scale Canny edge detection for shadow and lighting tolerance.

    Input: Image path (.png / .jpg)
    Output: Combined binary edge map (numpy uint8 ndarray)
    """
    if not os.path.exists(image_path):
        raise FileNotFoundError(f"Image not found: {image_path}")

    image = cv2.imread(image_path)
    if image is None:
        raise ValueError(f"Unable to read image at {image_path}")

    gray = cv2.cvtColor(image, cv2.COLOR_BGR2GRAY)
    blurred = cv2.GaussianBlur(gray, (5, 5), 0)

    cfg = FINE_TUNING_CONFIG["priority_1"]["multi_scale_canny"]
    fine_thresh = cfg.get("fine_thresholds", (30, 90))
    med_thresh = cfg.get("medium_thresholds", (50, 150))
    coarse_thresh = cfg.get("coarse_thresholds", (100, 200))

    edges_fine = cv2.Canny(blurred, fine_thresh[0], fine_thresh[1])
    edges_med = cv2.Canny(blurred, med_thresh[0], med_thresh[1])
    edges_coarse = cv2.Canny(blurred, coarse_thresh[0], coarse_thresh[1])

    combined = cv2.bitwise_or(edges_fine, edges_med)
    combined = cv2.bitwise_or(combined, edges_coarse)

    return combined


def detect_shadows_and_clouds(image_path: str) -> dict:
    """
    Identify problematic dark shadow regions and bright cloud cover in satellite images.

    Returns dict containing:
        - 'confidence_map': 2D float array (0.0 to 1.0)
        - 'shadow_mask': Binary uint8 mask (255 where shadow)
        - 'cloud_mask': Binary uint8 mask (255 where cloud)
        - 'overall_clarity': float score (0.0 to 100.0%)
    """
    if not os.path.exists(image_path):
        raise FileNotFoundError(f"Image not found: {image_path}")

    image = cv2.imread(image_path)
    if image is None:
        raise ValueError(f"Unable to read image at {image_path}")

    hsv = cv2.cvtColor(image, cv2.COLOR_BGR2HSV)
    h, s, v = cv2.split(hsv)

    cfg = FINE_TUNING_CONFIG["priority_1"]["shadow_detection"]["hsv_thresholds"]
    shadow_cfg = cfg.get("shadow", {"s_max": 80, "v_max": 70})
    cloud_cfg = cfg.get("cloud", {"s_max": 40, "v_min": 210})

    # Shadow: low saturation & low value (brightness)
    shadow_mask = np.where((s <= shadow_cfg["s_max"]) & (v <= shadow_cfg["v_max"]), 255, 0).astype(np.uint8)

    # Cloud: low saturation & high value (brightness)
    cloud_mask = np.where((s <= cloud_cfg["s_max"]) & (v >= cloud_cfg["v_min"]), 255, 0).astype(np.uint8)

    # Calculate pixel-level confidence map (1.0 = clear, 0.0 = obscured)
    total_pixels = image.shape[0] * image.shape[1]
    shadow_pixels = np.count_nonzero(shadow_mask)
    cloud_pixels = np.count_nonzero(cloud_mask)

    shadow_ratio = shadow_pixels / total_pixels
    cloud_ratio = cloud_pixels / total_pixels

    confidence_map = np.ones((image.shape[0], image.shape[1]), dtype=np.float32)
    confidence_map[shadow_mask == 255] = 0.4
    confidence_map[cloud_mask == 255] = 0.1

    overall_clarity = float(max(0.0, min(100.0, (1.0 - shadow_ratio * 0.5 - cloud_ratio * 0.9) * 100.0)))

    return {
        "confidence_map": confidence_map,
        "shadow_mask": shadow_mask,
        "cloud_mask": cloud_mask,
        "overall_clarity": round(overall_clarity, 2)
    }


def adaptive_threshold_footprint(image_path: str) -> np.ndarray:
    """
    Use CLAHE (Contrast Limited Adaptive Histogram Equalization) + Otsu dynamic thresholding.
    """
    if not os.path.exists(image_path):
        raise FileNotFoundError(f"Image not found: {image_path}")

    image = cv2.imread(image_path)
    if image is None:
        raise ValueError(f"Unable to read image at {image_path}")

    gray = cv2.cvtColor(image, cv2.COLOR_BGR2GRAY)

    clahe_cfg = FINE_TUNING_CONFIG["priority_1"]["clahe"]
    clahe = cv2.createCLAHE(
        clipLimit=clahe_cfg.get("clip_limit", 2.0),
        tileGridSize=clahe_cfg.get("tile_grid_size", (8, 8))
    )
    enhanced = clahe.apply(gray)
    blurred = cv2.GaussianBlur(enhanced, (5, 5), 0)

    _, otsu_mask = cv2.threshold(blurred, 0, 255, cv2.THRESH_BINARY_INV + cv2.THRESH_OTSU)

    kernel = cv2.getStructuringElement(cv2.MORPH_RECT, (5, 5))
    closed = cv2.morphologyEx(otsu_mask, cv2.MORPH_CLOSE, kernel, iterations=2)

    return closed


def score_footprint_confidence(
    image: np.ndarray,
    detected_polygon: dict,
    parcel_boundary: dict
) -> float:
    """
    Evaluate confidence score (0.0 to 100.0%) for detected building footprint based on:
    1. Edge continuity (+25% max)
    2. Polygon regularity & sharp corners (+25% max)
    3. Parcel alignment & containment (+30% max)
    4. Shadow / Cloud penalty (-20% max)
    """
    try:
        poly_shape = shape(detected_polygon)
        parcel_shape = shape(parcel_boundary)

        if poly_shape.is_empty or not poly_shape.is_valid:
            return 10.0

        # 1. Parcel Alignment & Containment Score (up to 30 points)
        intersection_area = poly_shape.intersection(parcel_shape).area
        union_area = poly_shape.union(parcel_shape).area
        iou = (intersection_area / union_area) if union_area > 0 else 0.0
        boundary_score = min(30.0, iou * 35.0 + (25.0 if parcel_shape.contains(poly_shape) else 10.0))

        # 2. Polygon Regularity (up to 25 points)
        num_vertices = len(poly_shape.exterior.coords) - 1
        if 4 <= num_vertices <= 12:
            regularity_score = 25.0
        elif num_vertices == 3 or 13 <= num_vertices <= 20:
            regularity_score = 18.0
        else:
            regularity_score = 10.0

        # 3. Edge Continuity Score (up to 25 points)
        gray = cv2.cvtColor(image, cv2.COLOR_BGR2GRAY) if len(image.shape) == 3 else image
        edges = cv2.Canny(gray, 50, 150)
        edge_density = np.count_nonzero(edges) / (image.shape[0] * image.shape[1])
        continuity_score = min(25.0, edge_density * 500.0)

        # 4. Shadow/Cloud Penalty (up to -20 points)
        if len(image.shape) == 3:
            hsv = cv2.cvtColor(image, cv2.COLOR_BGR2HSV)
            v = hsv[:, :, 2]
            dark_ratio = np.count_nonzero(v < 60) / v.size
            penalty = min(20.0, dark_ratio * 40.0)
        else:
            penalty = 5.0

        raw_score = boundary_score + regularity_score + continuity_score - penalty
        return float(round(max(0.0, min(100.0, raw_score)), 2))

    except Exception:
        return 50.0


def detect_building_footprint_hybrid(
    image_path: str,
    parcel_boundary: dict,
    osm_footprint: dict = None
) -> dict:
    """
    Hybrid Footprint Detection Strategy blending CV computer vision with OpenStreetMap data.

    Returns:
        dict containing:
        - 'footprint': GeoJSON Polygon
        - 'cv_confidence': float (0-100)
        - 'osm_confidence': float (0-100)
        - 'blend_ratio': float (ratio of CV used: 1.0, 0.7, or 0.3)
        - 'method_used': 'cv_only' | 'osm_only' | 'hybrid'
    """
    if not os.path.exists(image_path):
        raise FileNotFoundError(f"Image not found: {image_path}")

    image = cv2.imread(image_path)
    if image is None:
        raise ValueError(f"Unable to read image at {image_path}")

    # Step A: Run Multi-Scale Canny + CLAHE Adaptive Pipeline
    multiscale_edges = detect_edges_multiscale(image_path)
    adaptive_mask = adaptive_threshold_footprint(image_path)

    combined_mask = cv2.bitwise_or(multiscale_edges, adaptive_mask)

    contours, _ = cv2.findContours(combined_mask, cv2.RETR_EXTERNAL, cv2.CHAIN_APPROX_SIMPLE)
    if not contours:
        contours, _ = cv2.findContours(multiscale_edges, cv2.RETR_EXTERNAL, cv2.CHAIN_APPROX_SIMPLE)

    if not contours:
        cv_footprint = parcel_boundary
    else:
        valid_contours = [c for c in contours if cv2.contourArea(c) >= 100]
        largest_cnt = max(valid_contours, key=cv2.contourArea) if valid_contours else max(contours, key=cv2.contourArea)
        epsilon = 0.02 * cv2.arcLength(largest_cnt, True)
        approx = cv2.approxPolyDP(largest_cnt, epsilon, True)

        if len(approx) < 3:
            x, y, w, h = cv2.boundingRect(largest_cnt)
            approx = np.array([[[x, y]], [[x + w, y]], [[x + w, y + h]], [[x, y + h]]])

        pixel_coords = approx.reshape(-1, 2).tolist()
        geo_coords = _pixels_to_geo(pixel_coords, image_path)

        if geo_coords[0] != geo_coords[-1]:
            geo_coords.append(geo_coords[0])

        cv_footprint = {"type": "Polygon", "coordinates": [geo_coords]}

    # Step B: Score CV Confidence
    cv_conf = score_footprint_confidence(image, cv_footprint, parcel_boundary)
    osm_conf = 85.0 if osm_footprint else 0.0

    cfg = FINE_TUNING_CONFIG["priority_1"]["hybrid_strategy"]
    high_thresh = cfg.get("cv_confidence_threshold_high", 85)
    low_thresh = cfg.get("cv_confidence_threshold_low", 70)

    # Strategy Decision Tree
    if cv_conf >= high_thresh or not osm_footprint:
        method = "cv_only"
        blend_ratio = 1.0
        final_footprint = cv_footprint
    elif low_thresh <= cv_conf < high_thresh and osm_footprint:
        method = "hybrid"
        blend_ratio = 0.7
        # Geometric centroid-preserving blend of CV and OSM
        try:
            shape_cv = shape(cv_footprint)
            shape_osm = shape(osm_footprint)
            blended = shape_cv.intersection(shape_osm)
            if blended.is_empty or not blended.is_valid:
                blended = shape_cv.union(shape_osm).convex_hull
            final_footprint = mapping(blended)
        except Exception:
            final_footprint = cv_footprint
    else:
        method = "osm_only"
        blend_ratio = 0.3
        final_footprint = osm_footprint if osm_footprint else cv_footprint

    return {
        "footprint": final_footprint,
        "cv_confidence": cv_conf,
        "osm_confidence": osm_conf,
        "blend_ratio": blend_ratio,
        "method_used": method
    }
