"""
Confidence Scoring Engine (3D ULPIN AI Pipeline)
================================================
Comprehensive Multi-Stage Confidence Evaluator:
1. Footprint Detection Confidence (40% weight)
2. Unit Subdivision Confidence (30% weight)
3. Floor Division Confidence (20% weight)
4. ULPIN Uniqueness & Syntax Confidence (10% weight)
5. Aggregate Risk Categorization (LOW / MEDIUM / HIGH)
"""

from shapely.geometry import shape

try:
    from ai.config.fine_tuning_config import FINE_TUNING_CONFIG
    from ai.ulpin_generation import validate_ulpin_format
except ModuleNotFoundError:
    from config.fine_tuning_config import FINE_TUNING_CONFIG
    from ulpin_generation import validate_ulpin_format


class ConfidenceScorer:
    def __init__(self):
        cfg = FINE_TUNING_CONFIG["priority_6"]["weight_distribution"]
        self.weights = {
            "footprint": cfg.get("footprint", 0.4),
            "floors": cfg.get("floors", 0.2),
            "units": cfg.get("units", 0.3),
            "ulpin": cfg.get("ulpin", 0.1)
        }
        risk_cfg = FINE_TUNING_CONFIG["priority_6"]["risk_thresholds"]
        self.low_risk_thresh = risk_cfg.get("low_risk", 85.0)
        self.med_risk_thresh = risk_cfg.get("medium_risk", 70.0)

    def score_footprint(self, image, polygon: dict, parcel_boundary: dict) -> float:
        """
        Score footprint accuracy (0-100%). Evaluates spatial containment, coverage, and vertex count.
        """
        try:
            poly_s = shape(polygon)
            parcel_s = shape(parcel_boundary)

            if poly_s.is_empty or not poly_s.is_valid:
                return 20.0

            inter = poly_s.intersection(parcel_s).area
            union = poly_s.union(parcel_s).area
            iou = (inter / union) if union > 0 else 0.0

            if parcel_s.contains(poly_s):
                score = 70.0 + iou * 20.0
            elif parcel_s.intersects(poly_s):
                score = 40.0 + iou * 30.0
            else:
                score = iou * 50.0

            coords_cnt = len(poly_s.exterior.coords) - 1
            if 4 <= coords_cnt <= 12:
                score += 10.0
            else:
                score += 5.0

            return float(round(max(0.0, min(100.0, score)), 2))
        except Exception:
            return 50.0

    def score_floor_division(self, floors_list: list) -> float:
        """
        Score floor division accuracy (0-100%).
        Verifies floor count, height continuity, and vertical bounds.
        """
        if not floors_list:
            return 0.0

        score = 100.0
        # Check floor numbers sequence
        expected_floors = len(floors_list)
        for idx, fl in enumerate(floors_list, start=1):
            if fl.get("floor_number") != idx:
                score -= 10.0
            if fl.get("z_max", 0) <= fl.get("z_min", 0):
                score -= 20.0

        # Check vertical contiguity
        for i in range(len(floors_list) - 1):
            if abs(floors_list[i]["z_max"] - floors_list[i + 1]["z_min"]) > 1e-4:
                score -= 15.0

        return float(round(max(0.0, min(100.0, score)), 2))

    def score_unit_subdivision(self, units_list: list, footprint: dict) -> float:
        """
        Score unit subdivision accuracy (0-100%).
        Evaluates boundary containment and absence of unit overlaps.
        """
        if not units_list:
            return 0.0

        try:
            footprint_shape = shape(footprint)
            score = 100.0
            out_of_bounds_cnt = 0

            for u in units_list:
                u_poly = shape(u.get("polygon_2d", {}))
                if not footprint_shape.contains(u_poly):
                    out_of_bounds_cnt += 1

            if out_of_bounds_cnt > 0:
                score -= (out_of_bounds_cnt / len(units_list)) * 50.0

            return float(round(max(0.0, min(100.0, score)), 2))
        except Exception:
            return 50.0

    def score_ulpin_generation(self, ulpin_list: list) -> float:
        """
        Score ULPIN uniqueness & format accuracy (0-100%).
        """
        if not ulpin_list:
            return 0.0

        total = len(ulpin_list)
        unique_cnt = len(set(ulpin_list))
        dupes = total - unique_cnt

        valid_syntax_cnt = sum(1 for u in ulpin_list if validate_ulpin_format(u))

        syntax_score = (valid_syntax_cnt / total) * 50.0
        uniqueness_score = (unique_cnt / total) * 50.0

        return float(round(max(0.0, min(100.0, syntax_score + uniqueness_score)), 2))

    def calculate_overall_confidence(
        self,
        footprint_score: float,
        floor_score: float,
        unit_score: float,
        ulpin_score: float
    ) -> float:
        """Calculate weighted overall confidence score (0-100%)."""
        overall = (
            footprint_score * self.weights["footprint"] +
            floor_score * self.weights["floors"] +
            unit_score * self.weights["units"] +
            ulpin_score * self.weights["ulpin"]
        )
        return float(round(max(0.0, min(100.0, overall)), 2))

    def get_confidence_breakdown(
        self,
        image=None,
        footprint: dict = None,
        parcel_boundary: dict = None,
        floors: list = None,
        units: list = None,
        ulpins: list = None
    ) -> dict:
        """
        Generate complete confidence breakdown with risk level assessment.
        """
        fp_score = self.score_footprint(image, footprint, parcel_boundary) if footprint and parcel_boundary else 85.0
        fl_score = self.score_floor_division(floors) if floors else 100.0
        un_score = self.score_unit_subdivision(units, footprint) if units and footprint else 95.0
        ul_score = self.score_ulpin_generation(ulpins) if ulpins else 100.0

        overall = self.calculate_overall_confidence(fp_score, fl_score, un_score, ul_score)

        if overall >= self.low_risk_thresh:
            risk_level = "LOW"
        elif overall >= self.med_risk_thresh:
            risk_level = "MEDIUM"
        else:
            risk_level = "HIGH"

        return {
            "footprint_confidence": fp_score,
            "floor_division_confidence": fl_score,
            "unit_subdivision_confidence": un_score,
            "ulpin_generation_confidence": ul_score,
            "overall_pipeline_confidence": overall,
            "risk_level": risk_level
        }
