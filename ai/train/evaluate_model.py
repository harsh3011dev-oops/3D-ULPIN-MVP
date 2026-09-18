"""
ai/train/evaluate_model.py
Model Validation & Accuracy Evaluation Engine for 3D ULPIN Building Segmentation.

Evaluates trained model weights on test images, computes IoU, Precision, Recall, mAP50,
and generates side-by-side visual prediction bounding boxes & polygons saved to `ai/outputs/predictions/`.
"""

import os
import sys
import glob
import logging
from pathlib import Path
import numpy as np
import cv2

logger = logging.getLogger(__name__)


def evaluate_model_accuracy(
    weights_path: str = "ai/models/best_building_seg.pt",
    data_yaml: str = "/home/piet/Buidling-footprint-2/data.yaml",
    sample_images_dir: str = "/home/piet/Buidling-footprint-2/valid/images",
    output_vis_dir: str = "ai/outputs/predictions"
):
    """
    Evaluates trained YOLOv8 model performance metrics and renders visual prediction comparisons.
    """
    try:
        from ultralytics import YOLO
    except ImportError:
        print("❌ Error: Ultralytics package not installed. Run: pip install ultralytics")
        return

    w_path = Path(weights_path)
    if not w_path.exists():
        # Fallback to run weights if best_building_seg.pt not yet created
        run_weights = Path("ai/models/building_segmentation_run/weights/best.pt")
        if run_weights.exists():
            w_path = run_weights
        else:
            print(f"❌ Weights file {weights_path} not found. Ensure training has completed first!")
            return

    print("=" * 65)
    print("📊 3D ULPIN BUILDING MODEL ACCURACY & EVALUATION REPORT")
    print("=" * 65)
    print(f"📦 Loading Trained Weights: {w_path.resolve()}")
    print(f"📁 Dataset Config: {data_yaml}")

    model = YOLO(str(w_path.resolve()))

    # 1. Run Validation Metrics Benchmark
    print("\n🔍 Running Quantitative Accuracy Benchmark on Validation Set...")
    metrics = model.val(data=data_yaml, split="val", verbose=True)

    # Extract metrics
    map50 = round(float(metrics.seg.map50) * 100, 2)
    map50_95 = round(float(metrics.seg.map) * 100, 2)
    precision = round(float(metrics.seg.mp) * 100, 2)
    recall = round(float(metrics.seg.mr) * 100, 2)

    print("\n" + "=" * 65)
    print("🎯 ACCURACY BENCHMARK RESULTS")
    print("=" * 65)
    print(f"✅ mAP50 (Segmentation Accuracy) : {map50}%")
    print(f"✅ mAP50-95 (Strict Precision)  : {map50_95}%")
    print(f"✅ Precision (Exactness)        : {precision}%")
    print(f"✅ Recall (Coverage)            : {recall}%")
    print("=" * 65)

    # 2. Render Visual Sample Predictions
    vis_out = Path(output_vis_dir)
    vis_out.mkdir(parents=True, exist_ok=True)

    sample_files = glob.glob(os.path.join(sample_images_dir, "*.jpg")) + glob.glob(os.path.join(sample_images_dir, "*.png"))
    if not sample_files:
        print(f"⚠️ No sample images found in {sample_images_dir} for visual rendering.")
        return

    print(f"\n🖼️ Generating Visual Prediction Artifacts for {min(10, len(sample_files))} Sample Satellite Images...")
    for idx, img_p in enumerate(sample_files[:10]):
        res = model.predict(img_p, conf=0.3, verbose=False)[0]
        rendered = res.plot()  # Render bounding polygons & masks on image

        save_name = f"prediction_sample_{idx + 1:02d}.jpg"
        save_path = vis_out / save_name
        cv2.imwrite(str(save_path), rendered)
        print(f"   📸 Saved Visual Prediction: {save_path.resolve()}")

    print(f"\n✨ Evaluation Complete! All visual predictions saved to: {vis_out.resolve()}")


if __name__ == "__main__":
    logging.basicConfig(level=logging.INFO)
    weights = sys.argv[1] if len(sys.argv) > 1 else "ai/models/best_building_seg.pt"
    evaluate_model_accuracy(weights_path=weights)
