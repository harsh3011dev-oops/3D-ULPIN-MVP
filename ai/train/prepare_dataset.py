"""
ai/train/prepare_dataset.py
Dataset Downloader & Preprocessing Pipeline for Building Footprint Segmentation.

Formats satellite imagery (SpaceNet / OpenCities / Custom GeoJSON masks)
into YOLOv8-Seg training dataset format:
  dataset/
    ├── data.yaml
    ├── images/
    │   ├── train/
    │   └── val/
    └── labels/
        ├── train/
        └── val/
"""

import json
import os
import shutil
import logging
from pathlib import Path
from typing import Dict, Any, List, Tuple, Union
import numpy as np

logger = logging.getLogger(__name__)


def create_yolo_dataset_structure(base_dir: Union[str, Path] = "dataset") -> Dict[str, Path]:
    """Creates directory structure required for YOLOv8 segmentation training."""
    base_path = Path(base_dir)
    paths = {
        "base": base_path,
        "images_train": base_path / "images" / "train",
        "images_val": base_path / "images" / "val",
        "labels_train": base_path / "labels" / "train",
        "labels_val": base_path / "labels" / "val",
    }

    for p in paths.values():
        p.mkdir(parents=True, exist_ok=True)

    # Create dataset yaml file
    yaml_content = f"""# 3D ULPIN Building Footprint Segmentation Dataset Config
path: {base_path.resolve()}
train: images/train
val: images/val

names:
  0: building
"""
    yaml_path = base_path / "data.yaml"
    with open(yaml_path, "w", encoding="utf-8") as f:
        f.write(yaml_content)

    logger.info("YOLO dataset structure initialized at %s", base_path.resolve())
    return paths


def geojson_to_yolo_segmentation_txt(
    geojson_data: Dict[str, Any],
    img_width: int,
    img_height: int,
    output_txt_path: Union[str, Path]
) -> int:
    """
    Converts GeoJSON building footprint features into normalized YOLOv8 segmentation txt file.
    Format per line: <class_id> <x1> <y1> <x2> <y2> ... <xn> <yn> (normalized 0.0 - 1.0)
    """
    features = geojson_data.get("features", [])
    valid_lines = 0

    with open(output_txt_path, "w", encoding="utf-8") as f:
        for feat in features:
            geom = feat.get("geometry", {})
            gtype = geom.get("type")

            polygons = []
            if gtype == "Polygon":
                polygons = [geom.get("coordinates", [])[0]]
            elif gtype == "MultiPolygon":
                polygons = [p[0] for p in geom.get("coordinates", []) if p]

            for poly in polygons:
                if len(poly) < 3:
                    continue

                normalized_coords = []
                for pt in poly:
                    x, y = pt[0], pt[1]
                    # If points are geographic coordinates (lat/lon), map to relative box
                    norm_x = min(max(x / img_width if x > 1.0 else x, 0.0), 1.0)
                    norm_y = min(max(y / img_height if y > 1.0 else y, 0.0), 1.0)
                    normalized_coords.extend([f"{norm_x:.6f}", f"{norm_y:.6f}"])

                if len(normalized_coords) >= 6:
                    line_str = "0 " + " ".join(normalized_coords) + "\n"
                    f.write(line_str)
                    valid_lines += 1

    return valid_lines


if __name__ == "__main__":
    logging.basicConfig(level=logging.INFO)
    print("Preparing YOLOv8 Segmentation Dataset Structure...")
    paths = create_yolo_dataset_structure("ai/dataset")
    print(f"Dataset configuration created successfully at: {paths['base']}/data.yaml")
