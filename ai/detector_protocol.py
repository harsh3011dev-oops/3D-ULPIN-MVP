"""
Multi-Building Footprint Detector Protocol & Candidate Schemas (Milestone 3)
=============================================================================
Defines the abstract interface for multi-building footprint detection engines,
preserving detector provenance, uncertainty, and explicit candidate schemas.

NOTE: Heuristic contour detection (such as OpenCV thresholding) is designed for
high-contrast synthetic/rooftop imagery and is NOT claimed to be accurate on
arbitrary real-world satellite imagery without dedicated ML segmentation.
"""

from typing import Protocol, runtime_checkable, List, Dict, Any, Optional, Tuple
from pydantic import BaseModel, Field
from shapely.geometry import shape, mapping, Polygon, Point
from shapely.geometry.polygon import orient
import math
import os


class FootprintCandidate(BaseModel):
    """
    Standard candidate output schema produced by a footprint detector.
    Preserves raw detection geometry, confidence, and provenance.
    """
    candidate_id: str = Field(..., description="Unique ID for this candidate within the run")
    geometry: Dict[str, Any] = Field(..., description="GeoJSON Polygon in EPSG:4326")
    confidence: float = Field(..., ge=0.0, le=1.0, description="Detection confidence score")
    detector_name: str = Field(..., description="Name of the detecting module")
    detector_version: str = Field(..., description="Version of the detecting module")
    estimated_area_sqm: Optional[float] = Field(default=None, gt=0.0, description="Estimated metric area")
    approx_centroid: Optional[List[float]] = Field(default=None, description="[lon, lat] centroid")
    provenance: Dict[str, Any] = Field(default_factory=dict, description="Metadata, bounding boxes, or raw attributes")


@runtime_checkable
class MultiFootprintDetector(Protocol):
    """
    Protocol defining the contract for multi-building footprint detection engines.
    Implementations may include OSM vector extractors, synthetic acceptance generators,
    or evaluated ML models (when integrated in future milestones).
    """
    @property
    def detector_name(self) -> str:
        """Unique identifier of the detector implementation."""
        ...

    @property
    def detector_version(self) -> str:
        """Version string of the detector implementation."""
        ...

    def detect_footprints(
        self,
        boundary: Dict[str, Any],
        image_path: Optional[str] = None,
        geo_transform: Optional[Dict[str, Any]] = None,
        hints: Optional[List[Any]] = None,
        **kwargs
    ) -> List[FootprintCandidate]:
        """
        Detect candidate building footprints within a specified boundary.

        Args:
            boundary: GeoJSON Polygon of the outer parcel/society.
            image_path: Optional path to verified georeferenced raster.
            geo_transform: Explicit georeferencing transform dictionary.
            hints: Optional list of BuildingHint objects.

        Returns:
            List of FootprintCandidate objects with geometry in EPSG:4326.
        """
        ...


def normalize_geometry_ring(ring: List[List[float]], precision: int = 7) -> List[List[float]]:
    """
    Normalize a polygon ring coordinate sequence to a canonical representation:
    1. Removes redundant closing vertex if present.
    2. Rounds coordinates to specified decimal precision.
    3. Normalizes orientation to Counter-Clockwise (CCW).
    4. Cyclically rotates the ring so the lexicographically minimum vertex (min_lon, min_lat) is first.
    5. Closes the ring by repeating the canonical first vertex at the end.

    Guarantees that equivalent polygons with reversed orientation or different
    starting vertices produce identical coordinate lists.
    """
    if not ring or len(ring) < 3:
        return ring

    # 1. Strip closing point if identical to first
    pts = [[round(p[0], precision), round(p[1], precision)] for p in ring]
    if len(pts) >= 4 and pts[0] == pts[-1]:
        pts = pts[:-1]

    # 2. Check signed area (Shoelace formula) for CCW orientation
    n = len(pts)
    signed_area = 0.0
    for i in range(n):
        x1, y1 = pts[i]
        x2, y2 = pts[(i + 1) % n]
        signed_area += (x1 * y2 - x2 * y1)

    # If signed_area < 0, ring is Clockwise -> reverse to make it Counter-Clockwise
    if signed_area < 0:
        pts.reverse()

    # 3. Find lexicographically minimum vertex (min lon, then min lat)
    min_idx = 0
    min_val = (pts[0][0], pts[0][1])
    for i in range(1, len(pts)):
        val = (pts[i][0], pts[i][1])
        if val < min_val:
            min_val = val
            min_idx = i

    # 4. Cyclically rotate vertices to start at min_idx
    canonical_pts = pts[min_idx:] + pts[:min_idx]

    # 5. Close ring
    canonical_pts.append(canonical_pts[0])
    return canonical_pts


def validate_and_filter_candidates(
    candidates: List[FootprintCandidate],
    society_boundary: Dict[str, Any],
    allow_clipping: bool = False
) -> Tuple[List[FootprintCandidate], List[Dict[str, Any]]]:
    """
    Validates candidate footprints against the society boundary.

    Policy:
    - If a building footprint is outside or extends outside the society boundary:
      - If allow_clipping is False (default): Exclude it completely without silently
        modifying its geometry, recording it in the excluded list.
      - If allow_clipping is True: Intersect the footprint with the boundary.

    Returns:
        (valid_candidates, excluded_records)
    """
    society_shape = shape(society_boundary)
    valid_candidates: List[FootprintCandidate] = []
    excluded_records: List[Dict[str, Any]] = []

    for c in candidates:
        cand_shape = shape(c.geometry)
        if not cand_shape.is_valid:
            cand_shape = cand_shape.buffer(0)

        # Check containment
        if society_shape.contains(cand_shape):
            valid_candidates.append(c)
        elif society_shape.intersects(cand_shape):
            if allow_clipping:
                clipped = cand_shape.intersection(society_shape)
                if not clipped.is_empty and clipped.geom_type in ("Polygon", "MultiPolygon"):
                    clipped_geom = mapping(clipped)
                    c_clipped = c.model_copy(update={
                        "geometry": clipped_geom,
                        "provenance": {**c.provenance, "clipped": True}
                    })
                    valid_candidates.append(c_clipped)
                else:
                    excluded_records.append({
                        "candidate_id": c.candidate_id,
                        "reason": "outside_boundary_clipping_produced_empty_geometry",
                        "raw_geometry": c.geometry
                    })
            else:
                excluded_records.append({
                    "candidate_id": c.candidate_id,
                    "reason": "outside_boundary_partial_overlap_clipping_disallowed",
                    "raw_geometry": c.geometry
                })
        else:
            # Completely outside
            excluded_records.append({
                "candidate_id": c.candidate_id,
                "reason": "strictly_outside_boundary",
                "raw_geometry": c.geometry
            })

    return valid_candidates, excluded_records


class MockMultiFootprintDetector:
    """
    Deterministic reference implementation conforming to MultiFootprintDetector.
    Used for unit testing, synthetic acceptance suites, and protocol verification.
    """
    def __init__(self, detector_name: str = "mock_synthetic_detector", detector_version: str = "1.0.0"):
        self._name = detector_name
        self._version = detector_version
        self._predefined_candidates: List[FootprintCandidate] = []

    @property
    def detector_name(self) -> str:
        return self._name

    @property
    def detector_version(self) -> str:
        return self._version

    def set_predefined_candidates(self, candidates: List[FootprintCandidate]) -> None:
        self._predefined_candidates = list(candidates)

    def detect_footprints(
        self,
        boundary: Dict[str, Any],
        image_path: Optional[str] = None,
        geo_transform: Optional[Dict[str, Any]] = None,
        hints: Optional[List[Any]] = None,
        **kwargs
    ) -> List[FootprintCandidate]:
        return list(self._predefined_candidates)


class ManualHintsFootprintDetector:
    """
    Detector implementation that translates user-provided BuildingHints into candidates.
    """
    def __init__(self, detector_name: str = "manual_hints_detector", detector_version: str = "1.0.0"):
        self._name = detector_name
        self._version = detector_version

    @property
    def detector_name(self) -> str:
        return self._name

    @property
    def detector_version(self) -> str:
        return self._version

    def detect_footprints(
        self,
        boundary: Dict[str, Any],
        image_path: Optional[str] = None,
        geo_transform: Optional[Dict[str, Any]] = None,
        hints: Optional[List[Any]] = None,
        **kwargs
    ) -> List[FootprintCandidate]:
        candidates: List[FootprintCandidate] = []
        if not hints:
            return candidates

        for i, h in enumerate(hints):
            h_dict = h.model_dump() if hasattr(h, "model_dump") else (h if isinstance(h, dict) else {})
            geom = h_dict.get("footprint_hint")
            if geom and isinstance(geom, dict):
                cid = h_dict.get("hint_id") or f"hint_{i+1}"
                name = h_dict.get("building_name")
                candidates.append(
                    FootprintCandidate(
                        candidate_id=cid,
                        geometry=geom,
                        confidence=1.0,
                        detector_name=self.detector_name,
                        detector_version=self.detector_version,
                        provenance={
                            "hint_id": cid,
                            "building_name": name,
                            "floor_count": h_dict.get("floor_count"),
                            "height_meters": h_dict.get("height_meters"),
                            "source": "user_hint"
                        }
                    )
                )
        return candidates


class OSMMultiFootprintDetector:
    """
    Detector implementation that queries OpenStreetMap Overpass API for multiple
    building polygons within or intersecting the outer boundary.
    """
    def __init__(self, detector_name: str = "osm_multi_detector", detector_version: str = "1.0.0"):
        self._name = detector_name
        self._version = detector_version

    @property
    def detector_name(self) -> str:
        return self._name

    @property
    def detector_version(self) -> str:
        return self._version

    def detect_footprints(
        self,
        boundary: Dict[str, Any],
        image_path: Optional[str] = None,
        geo_transform: Optional[Dict[str, Any]] = None,
        hints: Optional[List[Any]] = None,
        **kwargs
    ) -> List[FootprintCandidate]:
        import requests
        from ai.utils.geo_utils import OSM_OVERPASS_ENDPOINTS, OSM_HEADERS

        candidates: List[FootprintCandidate] = []
        try:
            b_shape = shape(boundary)
            min_lon, min_lat, max_lon, max_lat = b_shape.bounds

            # Expand bounds slightly (~20m) to capture boundary-intersecting elements
            query = f"""
            [out:json][timeout:10];
            (
              way["building"]({min_lat - 0.0002:.6f},{min_lon - 0.0002:.6f},{max_lat + 0.0002:.6f},{max_lon + 0.0002:.6f});
              relation["building"]({min_lat - 0.0002:.6f},{min_lon - 0.0002:.6f},{max_lat + 0.0002:.6f},{max_lon + 0.0002:.6f});
            );
            out body geom;
            """
            payload = None
            for endpoint in OSM_OVERPASS_ENDPOINTS:
                try:
                    resp = requests.post(endpoint, data={"data": query}, headers=OSM_HEADERS, timeout=10)
                    if resp.status_code == 200:
                        payload = resp.json()
                        break
                except Exception:
                    continue

            if not payload or "elements" not in payload:
                return candidates

            for el in payload.get("elements", []):
                geom = el.get("geometry", [])
                if len(geom) >= 3:
                    coords = [[round(p["lon"], 7), round(p["lat"], 7)] for p in geom]
                    if coords[0] != coords[-1]:
                        coords.append(coords[0])
                    poly_geom = {"type": "Polygon", "coordinates": [coords]}
                    tags = el.get("tags", {})
                    osm_id = f"{el.get('type')}/{el.get('id')}"
                    candidates.append(
                        FootprintCandidate(
                            candidate_id=f"osm_{el.get('id')}",
                            geometry=poly_geom,
                            confidence=0.9,
                            detector_name=self.detector_name,
                            detector_version=self.detector_version,
                            provenance={
                                "osm_id": osm_id,
                                "tags": tags,
                                "source": "openstreetmap"
                            }
                        )
                    )
        except Exception as e:
            # Silently degrade if Overpass is down or offline
            pass

        return candidates


# --- Legacy Model Retirement (Phase J) ---
# Pre-existing fine-tuned YOLO checkpoints are formally marked as retired for the scratch-training milestone.
# They are preserved on disk for provenance/auditing but deactivated from default active inference.
RETIRED_LEGACY_WEIGHTS = {
    "best_building_seg.pt": os.path.abspath(os.path.join(os.path.dirname(__file__), "models", "best_building_seg.pt")),
    "building_segmentation_best.pt": os.path.abspath(os.path.join(os.path.dirname(__file__), "models", "building_segmentation", "best.pt"))
}

# Active weights: checks BUILDING_SEG_WEIGHTS first, then verified project package weights
PROJECT_ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
PROJECT_VERIFIED_PACKAGE = os.path.join(PROJECT_ROOT, "models", "building_segmentation")
PROJECT_VERIFIED_WEIGHTS = os.path.join(PROJECT_VERIFIED_PACKAGE, "weights", "best.pt")

DEFAULT_WEIGHTS_PATH: Optional[str] = os.getenv(
    "BUILDING_SEG_WEIGHTS",
    PROJECT_VERIFIED_WEIGHTS if os.path.exists(PROJECT_VERIFIED_WEIGHTS) else None
)


class YOLOSegmentationMultiDetector:
    """
    Deep-learning building footprint detector powered by trained YOLO11s-seg instance segmentation.
    Translates model output masks into validated georeferenced footprint candidates using explicit transforms.
    Maintains strict placeholder quarantine.
    """
    def __init__(
        self,
        weights_path: Optional[str] = None,
        conf_threshold: float = 0.25,
        device: str = "cpu",
        detector_name: str = "yolo11_building_segmenter",
        detector_version: str = "1.0.0"
    ):
        self._name = detector_name
        self._version = detector_version
        self.conf_threshold = conf_threshold
        self.device = device
        self.weights_path = weights_path or DEFAULT_WEIGHTS_PATH
        self._model = None
        self._is_packaged_model = False
        self._is_available = bool(self.weights_path and os.path.exists(self.weights_path))

    @property
    def detector_name(self) -> str:
        return self._name

    @property
    def detector_version(self) -> str:
        return self._version

    @property
    def is_available(self) -> bool:
        return self._is_available

    def _load_model(self):
        if self._model is None:
            if not self.is_available:
                raise FileNotFoundError(
                    f"Building segmentation weights not found at: {self.weights_path}. "
                    "Please verify weights path or run ml_training/building_segmentation/train.py."
                )
            # 1. Try loading via verified standalone package adapter
            try:
                import sys
                if PROJECT_ROOT not in sys.path:
                    sys.path.insert(0, PROJECT_ROOT)
                from models.building_segmentation.inference import BuildingSegmentationModel
                config_path = os.path.join(PROJECT_VERIFIED_PACKAGE, "config.json")
                self._model = BuildingSegmentationModel(
                    checkpoint_path=self.weights_path,
                    config_path=config_path if os.path.exists(config_path) else None,
                    device=self.device
                )
                self._is_packaged_model = True
            except Exception as e:
                # 2. Fallback to direct Ultralytics YOLO loading
                try:
                    from ultralytics import YOLO
                    self._model = YOLO(self.weights_path)
                    self._is_packaged_model = False
                except Exception as inner_e:
                    raise RuntimeError(f"Failed to load YOLO model: {e}; fallback error: {inner_e}")
        return self._model

    def detect_footprints(
        self,
        boundary: Dict[str, Any],
        image_path: Optional[str] = None,
        geo_transform: Optional[Dict[str, Any]] = None,
        hints: Optional[List[Any]] = None,
        **kwargs
    ) -> List[FootprintCandidate]:
        import logging
        logger = logging.getLogger(__name__)
        from ai.utils.image_utils import is_placeholder_image
        from ai.footprint_detection import _pixels_to_geo
        from ai.utils.geo_utils import calculate_polygon_area_sqm

        if not self.is_available:
            return []

        if not image_path or not os.path.exists(image_path) or not geo_transform:
            return []

        if is_placeholder_image(image_path, geo_transform=geo_transform):
            raise ValueError("CV/ML inference is strictly prohibited on quarantined or placeholder imagery.")

        model = self._load_model()
        conf = float(kwargs.get("conf", kwargs.get("conf_threshold", self.conf_threshold)))
        imgsz = int(kwargs.get("imgsz", 800))
        device = kwargs.get("device", self.device)

        candidates: List[FootprintCandidate] = []

        if getattr(self, "_is_packaged_model", False):
            # Inference via BuildingSegmentationModel adapter
            instances = model.predict(image=image_path, conf=conf, imgsz=imgsz, device=device)
            for idx, inst in enumerate(instances, start=1):
                poly_pts = inst.get("polygon", [])
                if len(poly_pts) < 3:
                    continue

                geo_coords = _pixels_to_geo(poly_pts, image_path, geo_transform=geo_transform)
                if not geo_coords or len(geo_coords) < 3:
                    continue

                if geo_coords[0] != geo_coords[-1]:
                    geo_coords.append(geo_coords[0])

                poly_geom = {"type": "Polygon", "coordinates": [geo_coords]}
                try:
                    poly_s = shape(poly_geom)
                    if not poly_s.is_valid:
                        poly_s = poly_s.buffer(0)
                    if poly_s.is_empty:
                        continue
                    area_m2 = round(float(calculate_polygon_area_sqm(poly_s)), 1)
                    cx, cy = round(poly_s.centroid.x, 7), round(poly_s.centroid.y, 7)
                except Exception:
                    continue

                inst_conf = float(inst.get("confidence", conf))
                candidates.append(
                    FootprintCandidate(
                        candidate_id=f"yolo_seg_{idx}",
                        geometry=poly_geom,
                        confidence=round(inst_conf, 4),
                        detector_name=self.detector_name,
                        detector_version=self.detector_version,
                        estimated_area_sqm=area_m2,
                        approx_centroid=[cx, cy],
                        provenance={
                            "model": "YOLO11s-seg",
                            "weights": str(self.weights_path),
                            "checkpoint_sha256": "9e649fbdf265420f1dd30899935d60df70c7961a716b3f432d978d7c0bbfb02b",
                            "confidence": round(inst_conf, 4),
                            "pixel_bbox": inst.get("bbox_xyxy"),
                            "pixel_polygon": poly_pts,
                            "area_pixels": inst.get("area_pixels"),
                            "source": "ml_instance_segmentation"
                        }
                    )
                )
        else:
            # Fallback for direct Ultralytics YOLO model
            results = model.predict(source=image_path, conf=conf, device=device, verbose=False)
            if not results:
                return candidates

            res = results[0]
            if res.masks is None or len(res.masks) == 0:
                return candidates

            for idx, (mask_xy, box) in enumerate(zip(res.masks.xy, res.boxes), start=1):
                box_conf = float(box.conf[0])
                pixel_pts = mask_xy.astype(int).tolist()
                if len(pixel_pts) < 3:
                    continue

                geo_coords = _pixels_to_geo(pixel_pts, image_path, geo_transform=geo_transform)
                if not geo_coords or len(geo_coords) < 3:
                    continue

                if geo_coords[0] != geo_coords[-1]:
                    geo_coords.append(geo_coords[0])

                poly_geom = {"type": "Polygon", "coordinates": [geo_coords]}
                try:
                    poly_s = shape(poly_geom)
                    if not poly_s.is_valid:
                        poly_s = poly_s.buffer(0)
                    if poly_s.is_empty:
                        continue
                    area_m2 = round(float(calculate_polygon_area_sqm(poly_s)), 1)
                    cx, cy = round(poly_s.centroid.x, 7), round(poly_s.centroid.y, 7)
                except Exception:
                    continue

                candidates.append(
                    FootprintCandidate(
                        candidate_id=f"yolo_seg_{idx}",
                        geometry=poly_geom,
                        confidence=round(box_conf, 4),
                        detector_name=self.detector_name,
                        detector_version=self.detector_version,
                        estimated_area_sqm=area_m2,
                        approx_centroid=[cx, cy],
                        provenance={
                            "model": "yolov8s-seg",
                            "weights": self.weights_path,
                            "box_confidence": round(box_conf, 4),
                            "source": "ml_instance_segmentation"
                        }
                    )
                )

        logger.info(
            "%s (v%s) produced %d footprint candidate(s) for %s",
            self.detector_name, self.detector_version, len(candidates), image_path
        )
        return candidates


# Canonical alias for clarity
YOLO11SegmentationMultiDetector = YOLOSegmentationMultiDetector


class HybridMultiFootprintDetector:
    """
    Standard hybrid detector coordinating manual hints, OSM vector detection,
    and visual raster detection (with strict placeholder quarantine).
    """
    def __init__(
        self, 
        ml_detector: Optional[MultiFootprintDetector] = None,
        detector_name: str = "hybrid_multi_detector", 
        detector_version: str = "1.0.0"
    ):
        self._name = detector_name
        self._version = detector_version
        self.hints_detector = ManualHintsFootprintDetector()
        self.osm_detector = OSMMultiFootprintDetector()

        if ml_detector is None and DEFAULT_WEIGHTS_PATH and os.path.exists(DEFAULT_WEIGHTS_PATH):
            try:
                self.ml_detector = YOLOSegmentationMultiDetector()
            except Exception:
                self.ml_detector = None
        else:
            self.ml_detector = ml_detector


    @property
    def detector_name(self) -> str:
        return self._name

    @property
    def detector_version(self) -> str:
        return self._version

    def detect_footprints(
        self,
        boundary: Dict[str, Any],
        image_path: Optional[str] = None,
        geo_transform: Optional[Dict[str, Any]] = None,
        hints: Optional[List[Any]] = None,
        **kwargs
    ) -> List[FootprintCandidate]:
        from ai.utils.image_utils import is_placeholder_image

        candidates: List[FootprintCandidate] = []

        # 1. Manual hints have highest priority
        if hints:
            hint_cands = self.hints_detector.detect_footprints(boundary=boundary, hints=hints)
            candidates.extend(hint_cands)

        # 2. OSM vectors
        osm_cands = self.osm_detector.detect_footprints(boundary=boundary)
        candidates.extend(osm_cands)

        # 3. Visual ML detector if available and image is genuine
        if self.ml_detector is not None and image_path and geo_transform:
            if not is_placeholder_image(image_path, geo_transform=geo_transform):
                try:
                    ml_cands = self.ml_detector.detect_footprints(
                        boundary=boundary,
                        image_path=image_path,
                        geo_transform=geo_transform,
                        **kwargs
                    )
                    candidates.extend(ml_cands)
                except Exception:
                    pass

        # 4. Fallback: If no candidates yet and real imagery with transform is available, use CV contour detector
        if not candidates and image_path and geo_transform:
            if not is_placeholder_image(image_path, geo_transform=geo_transform):
                try:
                    from ai.footprint_detection import detect_multi_building_footprints

                    fps = detect_multi_building_footprints(
                        image_path=image_path,
                        parcel_boundary=boundary,
                        min_area=kwargs.get("min_area", 30),
                        max_buildings=kwargs.get("max_buildings", 6),
                        geo_transform=geo_transform
                    )
                    for idx, fp in enumerate(fps, start=1):
                        candidates.append(
                            FootprintCandidate(
                                candidate_id=f"cv_{idx}",
                                geometry=fp,
                                confidence=0.75,
                                detector_name="cv_multi_contour",
                                detector_version="1.0.0",
                                provenance={"detector": "cv_multi_contour", "note": "Heuristic visual contour fallback"}
                            )
                        )
                except Exception:
                    pass

        return candidates


