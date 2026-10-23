"""
Persistent Building ID Registry & Spatial Identity Tracker (Milestone 3 / Phase 1)
===================================================================================
Maintains stable internal building IDs across pipeline runs, detector changes,
and application restarts.

Key Rules:
1. Spatial Matching: Matches new detections to existing IDs via intersection-over-union
   (IoU) and centroid proximity.
2. Stability: Once an internal_building_id is assigned, it remains stable across repeated runs.
3. No Recycling: A retired building ID is NEVER recycled.
4. Split & Merge Auditing: Flags ambiguous split or merge identity changes for human review.
5. Persistence: State is committed to disk (JSON) or database, surviving restarts.
"""

import os
import json
import logging
from typing import Dict, Any, List, Optional, Tuple
from datetime import datetime, timezone
from shapely.geometry import shape, Polygon

logger = logging.getLogger(__name__)

DEFAULT_REGISTRY_PATH = os.path.abspath(
    os.path.join(os.path.dirname(__file__), "..", "cache", "building_id_registry.json")
)


def _compute_iou(poly1: Polygon, poly2: Polygon) -> float:
    """Compute Intersection-over-Union (IoU) between two Shapely polygons."""
    if not poly1.is_valid:
        poly1 = poly1.buffer(0)
    if not poly2.is_valid:
        poly2 = poly2.buffer(0)
    if poly1.is_empty or poly2.is_empty:
        return 0.0

    intersection = poly1.intersection(poly2).area
    union = poly1.union(poly2).area
    return float(intersection / union) if union > 0 else 0.0


class BuildingRegistry:
    """
    Registry managing persistent, stable building identities per society.
    """

    def __init__(self, storage_path: str = DEFAULT_REGISTRY_PATH):
        self.storage_path = storage_path
        self._data: Dict[str, Any] = {}
        self.load()

    def load(self) -> None:
        """Load registry from disk."""
        if os.path.exists(self.storage_path):
            try:
                with open(self.storage_path, "r", encoding="utf-8") as f:
                    self._data = json.load(f)
            except Exception as e:
                logger.warning(f"Failed to load building registry from {self.storage_path}: {e}")
                self._data = {}
        else:
            self._data = {}

    def save(self) -> None:
        """Persist registry to disk."""
        os.makedirs(os.path.dirname(self.storage_path), exist_ok=True)
        try:
            with open(self.storage_path, "w", encoding="utf-8") as f:
                json.dump(self._data, f, indent=2)
        except Exception as e:
            logger.error(f"Failed to save building registry to {self.storage_path}: {e}")

    def _get_society_record(self, society_id: str) -> Dict[str, Any]:
        if society_id not in self._data:
            self._data[society_id] = {
                "society_id": society_id,
                "next_counter": 1,
                "buildings": {},      # internal_building_id -> record
                "retired_ids": []      # list of IDs that must never be reused
            }
        return self._data[society_id]

    def _generate_next_id(self, society_id: str) -> str:
        """Generate next non-retired building ID."""
        soc = self._get_society_record(society_id)
        while True:
            cnt = soc["next_counter"]
            soc["next_counter"] += 1
            # Format: BLDG-{society_id}-{letter or number}
            if cnt <= 26:
                letter = chr(ord('A') + cnt - 1)
                candidate_id = f"BLDG-{society_id}-{letter}"
            else:
                candidate_id = f"BLDG-{society_id}-{cnt:03d}"

            if candidate_id not in soc["retired_ids"] and candidate_id not in soc["buildings"]:
                return candidate_id

    def match_and_assign_ids(
        self,
        society_id: str,
        candidates: List[Dict[str, Any]],
        iou_match_threshold: float = 0.35
    ) -> Tuple[List[Dict[str, Any]], List[str]]:
        """
        Spatially match incoming candidate footprints against registered buildings for this society.

        Args:
            society_id: Identifier of the parent society.
            candidates: List of candidate dictionaries, each containing:
                        {"footprint": GeoJSON, "area_sqm": float, "name": Optional[str]}
            iou_match_threshold: Minimum IoU to claim building identity stability.

        Returns:
            (assigned_records, warnings)
        """
        soc = self._get_society_record(society_id)
        registered = soc["buildings"]
        now_iso = datetime.now(timezone.utc).isoformat()

        candidate_shapes = [shape(c["footprint"]) for c in candidates]
        assigned_results: List[Dict[str, Any]] = []
        warnings: List[str] = []

        # Find existing active buildings
        active_existing = {
            bid: rec for bid, rec in registered.items()
            if rec.get("status") == "active"
        }

        matched_existing_ids = set()
        cand_matches: List[List[Tuple[str, float]]] = []

        # Step 1: Calculate IoU matrix between all candidates and active existing buildings
        for i, cand_poly in enumerate(candidate_shapes):
            matches_for_cand = []
            for ex_id, ex_rec in active_existing.items():
                ex_poly = shape(ex_rec["footprint"])
                iou = _compute_iou(cand_poly, ex_poly)
                if iou >= iou_match_threshold:
                    matches_for_cand.append((ex_id, iou))
            # Sort by highest IoU
            matches_for_cand.sort(key=lambda x: x[1], reverse=True)
            cand_matches.append(matches_for_cand)

        # Step 2: Check for Split / Merge scenarios
        # Merge: A candidate matches multiple existing buildings
        # Split: Multiple candidates match the same existing building
        existing_claimed_by: Dict[str, List[int]] = {}
        for c_idx, matches in enumerate(cand_matches):
            for ex_id, _ in matches:
                existing_claimed_by.setdefault(ex_id, []).append(c_idx)

        for c_idx, cand in enumerate(candidates):
            matches = cand_matches[c_idx]
            cand_poly = candidate_shapes[c_idx]

            if len(matches) > 1:
                # Merge detected: Candidate covers multiple previous buildings
                merged_ids = [m[0] for m in matches]
                assigned_id = self._generate_next_id(society_id)
                msg = f"Identity merge detected: Building {assigned_id} merged previously separate buildings {merged_ids}"
                warnings.append(msg)
                logger.info(msg)
                # Retire old buildings
                for mid in merged_ids:
                    registered[mid]["status"] = "retired"
                    registered[mid]["retired_at"] = now_iso
                    registered[mid]["retirement_reason"] = f"Merged into {assigned_id}"
                    if mid not in soc["retired_ids"]:
                        soc["retired_ids"].append(mid)
                    matched_existing_ids.add(mid)

                identity_status = "merged"
            elif len(matches) == 1:
                ex_id, iou = matches[0]
                claiming_cands = existing_claimed_by.get(ex_id, [])
                if len(claiming_cands) > 1:
                    # Split detected: Multiple candidates match this single previous building
                    assigned_id = self._generate_next_id(society_id)
                    msg = f"Identity split detected: Candidate {assigned_id} is part of split of previous building {ex_id}"
                    warnings.append(msg)
                    logger.info(msg)
                    # Retire parent building
                    registered[ex_id]["status"] = "retired"
                    registered[ex_id]["retired_at"] = now_iso
                    registered[ex_id]["retirement_reason"] = f"Split into multiple buildings including {assigned_id}"
                    if ex_id not in soc["retired_ids"]:
                        soc["retired_ids"].append(ex_id)
                    matched_existing_ids.add(ex_id)
                    identity_status = "split"
                else:
                    # Clean 1-to-1 match -> Preserve identity!
                    assigned_id = ex_id
                    matched_existing_ids.add(ex_id)
                    identity_status = "matched"
            else:
                # No match -> New building
                assigned_id = self._generate_next_id(society_id)
                identity_status = "new"

            # Update or create registered record
            centroid = cand_poly.centroid
            reg_entry = {
                "internal_building_id": assigned_id,
                "society_id": society_id,
                "footprint": cand["footprint"],
                "area_sqm": cand["area_sqm"],
                "centroid": [round(centroid.x, 7), round(centroid.y, 7)],
                "status": "active",
                "identity_status": identity_status,
                "last_seen_at": now_iso
            }
            if identity_status == "new":
                reg_entry["created_at"] = now_iso
            else:
                reg_entry["created_at"] = registered.get(assigned_id, {}).get("created_at", now_iso)
                reg_entry["updated_at"] = now_iso

            registered[assigned_id] = reg_entry

            res_cand = dict(cand)
            res_cand["internal_building_id"] = assigned_id
            res_cand["identity_status"] = identity_status
            assigned_results.append(res_cand)

        # Step 3: Flag and retire existing buildings that were not detected
        for ex_id, ex_rec in active_existing.items():
            if ex_id not in matched_existing_ids:
                ex_rec["status"] = "retired"
                ex_rec["retired_at"] = now_iso
                ex_rec["retirement_reason"] = "Not detected in latest run"
                if ex_id not in soc["retired_ids"]:
                    soc["retired_ids"].append(ex_id)
                msg = f"Building {ex_id} retired (not present in current detection)"
                warnings.append(msg)
                logger.info(msg)

        # Save registry changes
        self.save()
        return assigned_results, warnings
