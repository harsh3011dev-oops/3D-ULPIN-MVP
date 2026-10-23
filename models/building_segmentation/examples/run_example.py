#!/usr/bin/env python3
"""
3D-ULPIN-MVP Example Usage: Building Instance Segmentation
Demonstrates how to run the model on an aerial image, extract pixel polygons,
and bridge pixel-space outputs to geographic GIS workflows.
"""

import json
import sys
from pathlib import Path
import cv2
import numpy as np

# Ensure package root is in sys.path
package_root = Path(__file__).resolve().parent.parent
sys.path.insert(0, str(package_root))

from inference import BuildingSegmentationModel


def main():
    print("=" * 80)
    print("=== 3D-ULPIN-MVP Building Instance Segmentation: Example Runner ===")
    print("=" * 80)

    # 1. Initialize model (CPU by default)
    print("Initializing BuildingSegmentationModel on CPU...")
    model = BuildingSegmentationModel(device="cpu")

    # 2. Path to sample image
    example_dir = Path(__file__).resolve().parent
    sample_img_path = example_dir / "sample_aerial_tile.png"

    if not sample_img_path.exists():
        raise FileNotFoundError(f"Sample image not found: {sample_img_path}")

    print(f"Running inference on: {sample_img_path.name} (imgsz=800, conf=0.25)...")
    results = model.predict(sample_img_path, conf=0.25, imgsz=800, device="cpu")

    print(f"\nDetection Results: Found {len(results)} building instance(s).\n")

    # 3. Create annotated visualization
    img_bgr = cv2.imread(str(sample_img_path))
    overlay = img_bgr.copy()
    h, w = img_bgr.shape[:2]

    palette = [
        (40, 200, 100), (255, 120, 30), (50, 150, 255),
        (220, 50, 220), (0, 220, 220), (255, 200, 0)
    ]

    export_json = []

    for inst in results:
        iid = inst["instance_id"]
        conf = inst["confidence"]
        bx = inst["bbox_xyxy"]
        poly = inst["polygon"]
        color = palette[(iid - 1) % len(palette)]

        print(f"Building #{iid}:")
        print(f"  Confidence: {conf:.4f}")
        print(f"  BBox [xmin, ymin, xmax, ymax]: {bx}")
        print(f"  Surface Area: {inst['area_pixels']} px^2")
        print(f"  Polygon Vertices Count: {len(poly)}")

        # Draw contour on image
        if poly:
            pts = np.array(poly, dtype=np.int32).reshape((-1, 1, 2))
            cv2.fillPoly(overlay, [pts], color)
            cv2.polylines(img_bgr, [pts], True, color, 2)

        # Label tag
        xmin, ymin = int(bx[0]), int(bx[1])
        label = f"#{iid} ({conf:.2f})"
        cv2.putText(img_bgr, label, (xmin + 2, max(15, ymin - 5)), cv2.FONT_HERSHEY_SIMPLEX, 0.45, (0, 255, 255), 1)

        export_json.append({
            "instance_id": iid,
            "confidence": conf,
            "bbox_pixel_xyxy": bx,
            "area_pixels": inst["area_pixels"],
            "polygon_pixel_coords": poly
        })

    # Blend overlay
    cv2.addWeighted(overlay, 0.35, img_bgr, 0.65, 0, img_bgr)

    # Save outputs
    out_img_path = example_dir / "sample_annotated.png"
    out_json_path = example_dir / "sample_detections.json"

    cv2.imwrite(str(out_img_path), img_bgr)
    with open(out_json_path, "w", encoding="utf-8") as f:
        json.dump({
            "image": sample_img_path.name,
            "image_size": [w, h],
            "total_buildings_detected": len(results),
            "detections": export_json
        }, f, indent=2)

    print(f"\nSaved annotated image to: {out_img_path}")
    print(f"Saved detection JSON to: {out_json_path}")

    # 4. Illustrate Geographic Transformation Interface for 3D-ULPIN-MVP
    print("\n" + "-" * 80)
    print("GIS INTEGRATION NOTICE FOR 3D-ULPIN-MVP:")
    print("To convert pixel polygon coords [[x, y], ...] into geographic coordinates:")
    print("  e.g., using rasterio Affine transform (affine * (px, py)):")
    print("  geo_x = transform[0] + px * transform[1] + py * transform[2]")
    print("  geo_y = transform[3] + px * transform[4] + py * transform[5]")
    print("Pixel coordinates alone carry NO geographic CRS or legal cadastral meaning.")
    print("-" * 80)


if __name__ == "__main__":
    main()
