"""
3D-ULPIN-MVP: Standalone Building-Instance Segmentation Inference Module
Author: Google Antigravity Agent
Model: YOLO11s-seg (Trained on 1,096 aerial tiles)
Target Integration: https://github.com/harsh3011dev-oops/3D-ULPIN-MVP.git

DISCLAIMER:
This module outputs 2D building instance segmentation masks and polygons in
IMAGE-PIXEL COORDINATES. It does NOT estimate building height, 3D structure,
cadastral boundaries, ownership rights, or official ULPIN identifiers.
Geographic projection and parcel association must be performed by the host
application using georeferenced raster metadata (e.g. GDAL/rasterio Affine).
"""

import json
import os
from pathlib import Path
from typing import Union, List, Dict, Any, Optional

import cv2
import numpy as np
import torch
from ultralytics import YOLO


class BuildingSegmentationModel:
    """
    Reusable, standalone inference wrapper for 3D-ULPIN-MVP Building Instance Segmentation.
    Loads the YOLO11s-seg model once and supports repeated inferences on CPU or GPU.
    """

    def __init__(
        self,
        checkpoint_path: Optional[Union[str, Path]] = None,
        config_path: Optional[Union[str, Path]] = None,
        device: str = "cpu"
    ):
        """
        Initialize the model wrapper.

        Args:
            checkpoint_path: Path to weights/best.pt. If None, resolves relative to package.
            config_path: Path to config.json. If None, resolves relative to package.
            device: 'cpu' or 'cuda' (default: 'cpu').
        """
        package_root = Path(__file__).resolve().parent

        # 1. Load config
        if config_path is None:
            config_path = package_root / "config.json"
        config_path = Path(config_path)
        if not config_path.exists():
            raise FileNotFoundError(f"Configuration file not found: {config_path}")

        with open(config_path, "r", encoding="utf-8") as f:
            self.config = json.load(f)

        # 2. Resolve checkpoint path
        if checkpoint_path is None:
            rel_ckpt = self.config.get("checkpoint_relative_path", "weights/best.pt")
            checkpoint_path = package_root / rel_ckpt
        self.checkpoint_path = Path(checkpoint_path)

        if not self.checkpoint_path.exists():
            raise FileNotFoundError(f"Model checkpoint not found: {self.checkpoint_path}")

        self.device = str(device).lower()
        if self.device.startswith("cuda") and not torch.cuda.is_available():
            raise RuntimeError(f"CUDA requested ('{device}'), but torch.cuda.is_available() is False.")

        # 3. Load YOLO model once
        self.model = YOLO(str(self.checkpoint_path))
        self.model.to(self.device)

        # Default parameters from config
        defaults = self.config.get("defaults", {})
        self.default_conf = float(defaults.get("conf", 0.25))
        self.default_imgsz = int(defaults.get("imgsz", 800))
        self.default_iou = float(defaults.get("iou", 0.70))

    def predict(
        self,
        image: Union[str, Path, np.ndarray],
        conf: Optional[float] = None,
        imgsz: Optional[int] = None,
        device: Optional[str] = None
    ) -> List[Dict[str, Any]]:
        """
        Execute building-instance segmentation on a single aerial image.

        Args:
            image: Path to image file (str/Path) OR a NumPy BGR/RGB array (uint8).
            conf: Confidence threshold (default from config: 0.25).
            imgsz: Network inference input resolution (default: 800).
            device: Execution device override ('cpu' or 'cuda').

        Returns:
            List of dictionaries representing detected building instances.
            Returns an empty list [] if no buildings are detected.
            Each dictionary contains:
                - instance_id: int (1-indexed identifier)
                - class_id: int (0)
                - class_name: str ("building")
                - confidence: float (0.0 to 1.0)
                - bbox_xyxy: list of 4 floats [xmin, ymin, xmax, ymax] in pixel coords
                - mask: np.ndarray of shape (H, W), dtype uint8 (1 for building, 0 for bg)
                - polygon: list of [x, y] coordinates in pixel space
                - area_pixels: float (area enclosed by polygon in pixels)
                - image_width: int (original image width)
                - image_height: int (original image height)
        """
        conf_val = self.default_conf if conf is None else float(conf)
        imgsz_val = self.default_imgsz if imgsz is None else int(imgsz)
        dev_val = self.device if device is None else str(device).lower()

        # Input handling
        if isinstance(image, (str, Path)):
            img_path = Path(image)
            if not img_path.exists():
                raise FileNotFoundError(f"Image file does not exist: {img_path}")
            img_bgr = cv2.imread(str(img_path))
            if img_bgr is None:
                raise ValueError(f"Failed to decode image from path: {img_path}")
        elif isinstance(image, np.ndarray):
            if image.size == 0 or len(image.shape) not in (2, 3):
                raise ValueError("Invalid NumPy image array: shape must be (H, W) or (H, W, C).")
            img_bgr = image
        else:
            raise TypeError(f"Unsupported image type: {type(image)}. Expected str, Path, or np.ndarray.")

        h_orig, w_orig = img_bgr.shape[:2]

        # Run inference
        results = self.model.predict(
            source=img_bgr,
            conf=conf_val,
            imgsz=imgsz_val,
            device=dev_val,
            verbose=False
        )[0]

        instances: List[Dict[str, Any]] = []

        if results.boxes is None or len(results.boxes) == 0:
            return instances

        boxes_np = results.boxes.xyxy.cpu().numpy()
        scores_np = results.boxes.conf.cpu().numpy()
        classes_np = results.boxes.cls.cpu().numpy() if results.boxes.cls is not None else np.zeros(len(scores_np))

        has_masks = results.masks is not None and len(results.masks.data) > 0
        if has_masks:
            masks_tensor = results.masks.data.cpu().numpy()

        for i in range(len(scores_np)):
            score = float(scores_np[i])
            cls_id = int(classes_np[i])
            cls_name = "building"
            bx = [round(float(coord), 2) for coord in boxes_np[i]]

            # Extract binary instance mask resized to native image resolution
            if has_masks and i < len(masks_tensor):
                m = (masks_tensor[i] > 0.5).astype(np.uint8)
                if m.shape != (h_orig, w_orig):
                    m = cv2.resize(m, (w_orig, h_orig), interpolation=cv2.INTER_NEAREST)
            else:
                m = np.zeros((h_orig, w_orig), dtype=np.uint8)
                xmin, ymin, xmax, ymax = map(int, bx)
                m[max(0, ymin):min(h_orig, ymax), max(0, xmin):min(w_orig, xmax)] = 1

            # Extract simplified polygon contour
            cnts, _ = cv2.findContours(m, cv2.RETR_EXTERNAL, cv2.CHAIN_APPROX_SIMPLE)
            if cnts:
                c_max = max(cnts, key=cv2.contourArea)
                poly_pts = c_max.reshape(-1, 2)
                poly_coords = [[int(pt[0]), int(pt[1])] for pt in poly_pts]
                area_px = float(cv2.contourArea(c_max))
            else:
                poly_coords = [
                    [int(bx[0]), int(bx[1])],
                    [int(bx[2]), int(bx[1])],
                    [int(bx[2]), int(bx[3])],
                    [int(bx[0]), int(bx[3])]
                ]
                area_px = float((bx[2] - bx[0]) * (bx[3] - bx[1]))

            instances.append({
                "instance_id": i + 1,
                "class_id": cls_id,
                "class_name": cls_name,
                "confidence": round(score, 4),
                "bbox_xyxy": bx,
                "mask": m,
                "polygon": poly_coords,
                "area_pixels": round(area_px, 1),
                "image_width": w_orig,
                "image_height": h_orig
            })

        return instances


# Top-level singleton cache for convenience function
_GLOBAL_MODEL_INSTANCE: Optional[BuildingSegmentationModel] = None


def predict(
    image: Union[str, Path, np.ndarray],
    conf: float = 0.25,
    imgsz: int = 800,
    device: str = "cpu"
) -> List[Dict[str, Any]]:
    """
    Convenience function for stateless single-image predictions.
    Reuses a cached model instance on repeated calls to avoid reloading weights.
    """
    global _GLOBAL_MODEL_INSTANCE
    if _GLOBAL_MODEL_INSTANCE is None or _GLOBAL_MODEL_INSTANCE.device != str(device).lower():
        _GLOBAL_MODEL_INSTANCE = BuildingSegmentationModel(device=device)

    return _GLOBAL_MODEL_INSTANCE.predict(image=image, conf=conf, imgsz=imgsz, device=device)
