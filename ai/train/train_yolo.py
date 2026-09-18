"""
ai/train/train_yolo.py
Custom Model Training Pipeline for 3D ULPIN Building Segmentation Engine.

Fine-tunes YOLOv8-Seg on custom satellite imagery datasets (e.g. 23,000+ Roboflow images).
Outputs trained PyTorch model weights to `ai/models/best_building_seg.pt`.
"""

import os
import sys
import argparse
import logging
from pathlib import Path
from typing import Optional

logger = logging.getLogger(__name__)


def train_custom_building_model(
    data_yaml: str = "ai/dataset/data.yaml",
    base_weights: str = "yolov8n-seg.pt",
    epochs: int = 50,
    img_size: int = 640,
    batch_size: int = 16,
    output_dir: str = "ai/models"
) -> Optional[str]:
    """
    Trains / fine-tunes YOLOv8-Seg instance segmentation model on building footprint dataset.
    """
    try:
        from ultralytics import YOLO
    except ImportError:
        logger.error("Ultralytics package not installed. Install via: pip install ultralytics")
        return None

    yaml_path = Path(data_yaml)
    if not yaml_path.exists():
        logger.error("Dataset config %s not found!", data_yaml)
        return None

    out_path = Path(output_dir)
    out_path.mkdir(parents=True, exist_ok=True)

    logger.info("Initializing YOLOv8-Seg GPU training on dataset %s...", yaml_path.resolve())
    print(f"🚀 Launching YOLOv8-Seg Training on dataset: {yaml_path.resolve()}")
    print(f"📊 Hyperparameters: Epochs={epochs}, Batch Size={batch_size}, Image Resolution={img_size}px")

    model = YOLO(base_weights)

    # Execute training
    results = model.train(
        data=str(yaml_path.resolve()),
        epochs=epochs,
        imgsz=img_size,
        batch=batch_size,
        project=str(out_path.resolve()),
        name="building_segmentation_run",
        save=True,
        exist_ok=True
    )

    best_weights_path = out_path / "building_segmentation_run" / "weights" / "best.pt"
    target_export_path = out_path / "best_building_seg.pt"

    if best_weights_path.exists():
        import shutil
        shutil.copy(best_weights_path, target_export_path)
        print(f"✅ Training Complete! Model saved at: {target_export_path}")
        logger.info("Custom Building Segmentation Model successfully trained and saved to %s", target_export_path)
        return str(target_export_path)

    return None


if __name__ == "__main__":
    logging.basicConfig(level=logging.INFO)
    parser = argparse.ArgumentParser(description="3D ULPIN Building Footprint Model Trainer")
    parser.add_argument("--data", type=str, default="ai/dataset/data.yaml", help="Path to dataset data.yaml")
    parser.add_argument("--epochs", type=int, default=30, help="Number of training epochs")
    parser.add_argument("--batch", type=int, default=16, help="Batch size")
    parser.add_argument("--weights", type=str, default="yolov8n-seg.pt", help="Pretrained model weights")
    args = parser.parse_args()

    train_custom_building_model(
        data_yaml=args.data,
        base_weights=args.weights,
        epochs=args.epochs,
        batch_size=args.batch
    )
