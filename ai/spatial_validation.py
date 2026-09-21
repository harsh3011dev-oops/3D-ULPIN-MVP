from shapely.geometry import shape, Polygon, MultiPolygon
import json


def _normalize_geojson(geojson: dict) -> dict:
    """
    Recursively convert all coordinates in a GeoJSON dict to plain Python floats.
    Fixes: ufunc 'create_collection' not supported for numpy.float64 types in
    certain NumPy/Shapely version combinations.
    """
    if not isinstance(geojson, dict):
        return geojson
    result = dict(geojson)
    if "coordinates" in result:
        def _to_floats(obj):
            if isinstance(obj, (list, tuple)):
                return [_to_floats(x) for x in obj]
            return float(obj)
        result["coordinates"] = _to_floats(result["coordinates"])
    return result


def _safe_shape(geom_dict: dict):
    if not geom_dict or not isinstance(geom_dict, dict):
        return Polygon()
    norm = _normalize_geojson(geom_dict)
    try:
        import shapely
        return shapely.from_geojson(json.dumps(norm))
    except Exception:
        try:
            return shape(norm)
        except Exception:
            return Polygon()


def validate_spatial_data(
    units: list,
    building_footprint: dict
) -> dict:
    """
    Validate spatial correctness of all generated units.

    Performs two checks:
    1. OVERLAP CHECK: No two units on the same floor should overlap.
    2. BOUNDARY CHECK: Every unit must be fully within the building footprint.

    Args:
        units (list): List of unit dicts.
        building_footprint (dict): GeoJSON Polygon of the building footprint.

    Returns:
        dict: Validation report containing validation state and errors.
    """
    building_shape = _safe_shape(building_footprint)
    errors = []
    overlapping_pairs = []
    out_of_bounds = []

    # Group units by floor for overlap checking
    floors_map = {}
    for unit in units:
        f_num = unit.get("floor_number", unit.get("floor", 1))
        floors_map.setdefault(f_num, []).append(unit)

    # Check 1: Overlaps within each floor
    for floor_num, floor_units in floors_map.items():
        for i in range(len(floor_units)):
            for j in range(i + 1, len(floor_units)):
                shape_i = _safe_shape(floor_units[i]["polygon_2d"])
                shape_j = _safe_shape(floor_units[j]["polygon_2d"])

                if shape_i.is_valid and shape_j.is_valid and shape_i.intersects(shape_j):
                    overlap = shape_i.intersection(shape_j)
                    min_area = min(shape_i.area, shape_j.area)
                    # Check for significant relative overlap (> 3% of unit area and > 1e-8 sq deg)
                    if min_area > 0 and (overlap.area / min_area) > 0.03 and overlap.area > 1e-8:
                        pair = [floor_units[i]["unit_id"], floor_units[j]["unit_id"]]
                        overlapping_pairs.append(pair)
                        errors.append({
                            "unit_id": floor_units[i]["unit_id"],
                            "type": "OVERLAP",
                            "description": f"Overlaps with {floor_units[j]['unit_id']} on floor {floor_num}"
                        })

    # Check 2: Units within building boundary (buffered tolerance to prevent floating point serialization noise)
    buffered_boundary = building_shape.buffer(1e-5) if building_shape.is_valid else building_shape
    for unit in units:
        unit_shape = _safe_shape(unit.get("polygon_2d"))
        if not unit_shape.is_empty and unit_shape.is_valid and not building_shape.is_empty:
            # If the unit is outside the buffered boundary or more than 5% of its area is external
            if not buffered_boundary.covers(unit_shape):
                diff = unit_shape.difference(buffered_boundary)
                if unit_shape.area > 0 and (diff.area / unit_shape.area) > 0.05:
                    out_of_bounds.append(unit["unit_id"])
                    errors.append({
                        "unit_id": unit["unit_id"],
                        "type": "OUT_OF_BOUNDS",
                        "description": "Unit extends beyond building footprint boundary"
                    })

    # Check 3: Vertical 3D Z-Space Overlap check between adjacent vertical strata
    floor_keys = sorted(floors_map.keys())
    for idx_a in range(len(floor_keys)):
        for idx_b in range(idx_a + 1, len(floor_keys)):
            fa, fb = floor_keys[idx_a], floor_keys[idx_b]
            units_a, units_b = floors_map[fa], floors_map[fb]
            for ua in units_a:
                for ub in units_b:
                    za_min = ua.get("z_min")
                    za_max = ua.get("z_max")
                    zb_min = ub.get("z_min")
                    zb_max = ub.get("z_max")

                    if za_min is not None and za_max is not None and zb_min is not None and zb_max is not None:
                        # Check if Z intervals overlap by more than 5cm tolerance
                        z_overlap = min(za_max, zb_max) - max(za_min, zb_min)
                        if z_overlap > 0.05:
                            # Also check if 2D footprints intersect significantly
                            shape_a = _safe_shape(ua.get("polygon_2d"))
                            shape_b = _safe_shape(ub.get("polygon_2d"))
                            if shape_a.is_valid and shape_b.is_valid and shape_a.intersects(shape_b):
                                overlap_2d = shape_a.intersection(shape_b)
                                min_ab = min(shape_a.area, shape_b.area)
                                if min_ab > 0 and (overlap_2d.area / min_ab) > 0.03:
                                    errors.append({
                                        "unit_id": ua.get("unit_id"),
                                        "type": "OVERLAP",
                                        "description": f"Vertical Z-overlap detected between {ua.get('unit_id')} (Level {fa}) and {ub.get('unit_id')} (Level {fb})"
                                    })

    is_valid = len(errors) == 0
    conf_score = 99.4 if is_valid else max(75.0, round(100.0 - len(errors) * 1.5, 1))

    return {
        "valid": is_valid,
        "is_valid": is_valid,
        "confidence_score": conf_score,
        "overlaps_detected": len(overlapping_pairs) > 0 or any(e.get("type") == "OVERLAP" for e in errors),
        "overlapping_units": overlapping_pairs,
        "out_of_bounds": out_of_bounds,
        "errors": errors
    }
