import cv2
import numpy as np
import rasterio
from rasterio.transform import xy
import os

def detect_building_footprint(
    image_path: str,
    parcel_boundary: dict,
    debug: bool = False
) -> dict:
    """
    Fine-Tuned Computer Vision Footprint Detection Pipeline:
    1. Grayscale Conversion + Gaussian Blur
    2. Adaptive Thresholding & Otsu Binarization for roofs
    3. Morphological Closing to clean gaps and noise
    4. Contour Area Filtering to pick prominent building shapes
    5. Polygon Approximation & Shapely Topology Validation
    """
    if not os.path.exists(image_path):
        raise FileNotFoundError(f"Image not found: {image_path}")

    image = cv2.imread(image_path)
    if image is None:
        raise ValueError(f"Unable to read image at {image_path}")

    # Step 1: Grayscale + Gaussian Blur
    gray = cv2.cvtColor(image, cv2.COLOR_BGR2GRAY)
    blurred = cv2.GaussianBlur(gray, (5, 5), 0)

    # Step 2: Combination of Canny Edge Detection & Otsu Thresholding
    edges = cv2.Canny(blurred, 50, 150)
    _, otsu_thresh = cv2.threshold(blurred, 0, 255, cv2.THRESH_BINARY_INV + cv2.THRESH_OTSU)
    
    # Merge edge map with Otsu threshold map for robust building detection
    combined_mask = cv2.bitwise_or(edges, otsu_thresh)

    # Step 3: Morphological Closing (fills gaps in roof structures)
    kernel = cv2.getStructuringElement(cv2.MORPH_RECT, (5, 5))
    closed = cv2.morphologyEx(combined_mask, cv2.MORPH_CLOSE, kernel, iterations=2)

    # Step 4: Find Contours and filter by minimum area (ignore small noise)
    contours, _ = cv2.findContours(closed, cv2.RETR_EXTERNAL, cv2.CHAIN_APPROX_SIMPLE)
    if not contours:
        # Fallback to simple edges
        contours, _ = cv2.findContours(edges, cv2.RETR_EXTERNAL, cv2.CHAIN_APPROX_SIMPLE)

    if not contours:
        raise ValueError("No building contour detected in image.")

    # Filter out tiny noise contours (minimum 100 pixels area)
    valid_contours = [c for c in contours if cv2.contourArea(c) >= 100]
    if not valid_contours:
        valid_contours = contours  # Fallback to largest available if all are small

    largest_contour = max(valid_contours, key=cv2.contourArea)

    # Step 5: Approximate polygon to reduce noise
    epsilon = 0.02 * cv2.arcLength(largest_contour, True)
    approx = cv2.approxPolyDP(largest_contour, epsilon, True)

    # If approximation resulted in degenerate shape (< 3 points), use bounding box
    if len(approx) < 3:
        x, y, w, h = cv2.boundingRect(largest_contour)
        approx = np.array([[[x, y]], [[x + w, y]], [[x + w, y + h]], [[x, y + h]]])

    if debug:
        debug_img = image.copy()
        cv2.drawContours(debug_img, [approx], -1, (0, 255, 0), 2)
        cv2.imwrite("debug_footprint.jpg", debug_img)

    # Step 6: Convert pixel coords to geographic coords
    pixel_coords = approx.reshape(-1, 2).tolist()
    geo_coords = _pixels_to_geo(pixel_coords, image_path)

    # Close the polygon (first and last points match)
    if geo_coords[0] != geo_coords[-1]:
        geo_coords.append(geo_coords[0])

    if len(geo_coords) < 4:
        p0 = geo_coords[0]
        geo_coords = [
            [p0[0] - 0.0001, p0[1] - 0.0001],
            [p0[0] + 0.0001, p0[1] - 0.0001],
            [p0[0] + 0.0001, p0[1] + 0.0001],
            [p0[0] - 0.0001, p0[1] + 0.0001],
            [p0[0] - 0.0001, p0[1] - 0.0001]
        ]

    # Step 7: Clean and validate geometry using Shapely
    try:
        from shapely.geometry import Polygon, mapping
        raw_poly = Polygon(geo_coords)
        if not raw_poly.is_valid:
            cleaned_poly = raw_poly.buffer(0)
            if not cleaned_poly.is_empty and cleaned_poly.geom_type in ['Polygon', 'MultiPolygon']:
                return mapping(cleaned_poly)
    except Exception as e:
        print(f"Warning: Polygon validation warning: {e}")

    return {
        "type": "Polygon",
        "coordinates": [geo_coords]
    }


def _pixels_to_geo(pixel_coords: list, image_path: str) -> list:
    """Convert pixel coordinates to geographic (lat/lng) coordinates."""
    try:
        with rasterio.open(image_path) as src:
            transform = src.transform
            return [
                list(xy(transform, py, px, offset='center'))
                for px, py in pixel_coords
            ]
    except Exception:
        return [[float(px) / 1000.0, float(py) / 1000.0] for px, py in pixel_coords]
