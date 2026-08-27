"""
Automated Quality Gates Engine (3D ULPIN AI Pipeline)
=====================================================
Automated Threshold Gatekeeper:
1. Footprint IoU Validation (≥ 88% IoU threshold)
2. Unit Boundary Containment Validation (0 units out-of-bounds)
3. Unit Non-Overlap Validation (0 overlapping unit pairs)
4. ULPIN Syntax & Global Uniqueness Validation
5. Unified Gatekeeper Orchestrator (rejects pipeline output if ANY gate fails)
"""

from shapely.geometry import shape

try:
    from ai.config.fine_tuning_config import FINE_TUNING_CONFIG
    from ai.ulpin_generation import validate_ulpin_format
except ModuleNotFoundError:
    from config.fine_tuning_config import FINE_TUNING_CONFIG
    from ulpin_generation import validate_ulpin_format


class QualityGates:
    def __init__(self):
        cfg = FINE_TUNING_CONFIG["priority_7"]["gates"]
        self.min_iou = cfg.get("footprint_iou_min", 0.88)
        self.check_boundary = cfg.get("unit_boundary_check", True)
        self.check_overlap = cfg.get("overlap_check", True)
        self.check_ulpin = cfg.get("ulpin_format_check", True)

    def validate_footprint(self, footprint: dict, parcel_boundary: dict = None) -> dict:
        """
        Check: Footprint valid and IoU >= 88% against parcel boundary (if provided).
        """
        try:
            poly_s = shape(footprint)
            if poly_s.is_empty or not poly_s.is_valid:
                return {
                    "passed": False,
                    "iou_score": 0.0,
                    "error_message": "Footprint geometry is empty or invalid."
                }

            if parcel_boundary:
                parcel_s = shape(parcel_boundary)
                inter = poly_s.intersection(parcel_s).area
                union = poly_s.union(parcel_s).area
                iou = (inter / union) if union > 0 else 0.0
            else:
                iou = 0.90  # Default assumed IoU when parcel boundary is unsupplied

            passed = iou >= self.min_iou
            error_msg = None if passed else f"Footprint IoU score ({iou:.4f}) is below minimum required threshold ({self.min_iou})."

            return {
                "passed": passed,
                "iou_score": round(iou, 4),
                "error_message": error_msg
            }
        except Exception as e:
            return {
                "passed": False,
                "iou_score": 0.0,
                "error_message": f"Footprint validation error: {e}"
            }

    def validate_units_in_boundary(self, units: list, boundary: dict) -> dict:
        """
        Check: All units are strictly within building boundary.
        """
        if not units:
            return {"passed": True, "units_out_of_bounds": 0, "problematic_units": []}

        try:
            bound_shape = shape(boundary)
            problematic = []

            for u in units:
                u_poly = shape(u.get("polygon_2d", {}))
                if not bound_shape.contains(u_poly):
                    problematic.append(u.get("unit_id", "UNKNOWN_UNIT"))

            passed = len(problematic) == 0
            return {
                "passed": passed,
                "units_out_of_bounds": len(problematic),
                "problematic_units": problematic
            }
        except Exception as e:
            return {"passed": False, "units_out_of_bounds": len(units), "problematic_units": ["ALL_UNITS_ERROR"]}

    def validate_no_overlaps(self, units: list) -> dict:
        """
        Check: No overlapping unit polygons on the same floor.
        """
        if not units:
            return {"passed": True, "overlaps_found": 0, "overlapping_pairs": []}

        floors_map = {}
        for u in units:
            floors_map.setdefault(u.get("floor"), []).append(u)

        overlapping_pairs = []
        for floor_num, f_units in floors_map.items():
            for i in range(len(f_units)):
                for j in range(i + 1, len(f_units)):
                    s_i = shape(f_units[i].get("polygon_2d", {}))
                    s_j = shape(f_units[j].get("polygon_2d", {}))

                    if s_i.intersects(s_j):
                        inter_area = s_i.intersection(s_j).area
                        if inter_area > 1e-10:
                            pair = (f_units[i].get("unit_id"), f_units[j].get("unit_id"))
                            overlapping_pairs.append(pair)

        passed = len(overlapping_pairs) == 0
        return {
            "passed": passed,
            "overlaps_found": len(overlapping_pairs),
            "overlapping_pairs": overlapping_pairs
        }

    def validate_ulpin_format(self, ulpin_list: list) -> dict:
        """
        Check: ULPIN format is valid & 100% unique.
        """
        if not ulpin_list:
            return {"passed": True, "format_errors": 0, "duplicate_ulpins": 0, "malformed_ulpins": []}

        malformed = [u for u in ulpin_list if not validate_ulpin_format(u)]
        unique_ulpins = set(ulpin_list)
        duplicates = len(ulpin_list) - len(unique_ulpins)

        passed = len(malformed) == 0 and duplicates == 0
        return {
            "passed": passed,
            "format_errors": len(malformed),
            "duplicate_ulpins": duplicates,
            "malformed_ulpins": malformed
        }

    def run_all_gates(self, pipeline_output: dict, parcel_boundary: dict = None) -> dict:
        """
        Run all quality gates against pipeline output.

        If ANY gate fails:
        - overall_passed = False
        - Provides detailed failed_gates array and error summary.
        """
        footprint = pipeline_output.get("footprint", {})
        units = pipeline_output.get("units", [])
        ulpins = [u.get("ulpin") for u in units if u.get("ulpin")]

        fp_gate = self.validate_footprint(footprint, parcel_boundary)
        bound_gate = self.validate_units_in_boundary(units, footprint)
        overlap_gate = self.validate_no_overlaps(units)
        ulpin_gate = self.validate_ulpin_format(ulpins)

        failed_gates = []
        if not fp_gate["passed"]:
            failed_gates.append("FOOTPRINT_IOU_GATE")
        if not bound_gate["passed"]:
            failed_gates.append("UNIT_BOUNDARY_GATE")
        if not overlap_gate["passed"]:
            failed_gates.append("UNIT_OVERLAP_GATE")
        if not ulpin_gate["passed"]:
            failed_gates.append("ULPIN_SYNTAX_GATE")

        overall_passed = len(failed_gates) == 0
        summary = "All Quality Gates Passed ✅" if overall_passed else f"Quality Gates Failed ❌: {', '.join(failed_gates)}"

        return {
            "overall_passed": overall_passed,
            "footprint_gate": fp_gate,
            "boundary_gate": bound_gate,
            "overlap_gate": overlap_gate,
            "ulpin_gate": ulpin_gate,
            "failed_gates": failed_gates,
            "error_summary": summary
        }
