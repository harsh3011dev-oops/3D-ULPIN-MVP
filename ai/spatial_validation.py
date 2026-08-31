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
        gtype = norm.get("type")
        coords = norm.get("coordinates", [])
        if gtype == "Polygon" and coords:
            return Polygon(coords[0], coords[1:])
        elif gtype == "MultiPolygon" and coords:
            polys = [Polygon(p[0], p[1:]) for p in coords if len(p) > 0]
            return MultiPolygon(polys) if polys else Polygon()
        return shape(norm)
    except Exception:
        try:
            import shapely
            return shapely.from_geojson(json.dumps(norm))
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
        floors_map.setdefault(unit["floor"], []).append(unit)

    # Check 1: Overlaps within each floor
    for floor_num, floor_units in floors_map.items():
        for i in range(len(floor_units)):
            for j in range(i + 1, len(floor_units)):
                shape_i = _safe_shape(floor_units[i]["polygon_2d"])
                shape_j = _safe_shape(floor_units[j]["polygon_2d"])

                if shape_i.intersects(shape_j):
                    overlap = shape_i.intersection(shape_j)
                    if overlap.area > 1e-10:  # ignore tiny floating point noise
                        pair = [floor_units[i]["unit_id"], floor_units[j]["unit_id"]]
                        overlapping_pairs.append(pair)
                        errors.append({
                            "unit_id": floor_units[i]["unit_id"],
                            "type": "OVERLAP",
                            "description": f"Overlaps with {floor_units[j]['unit_id']} on floor {floor_num}"
                        })

    # Check 2: Units within building boundary
    for unit in units:
        unit_shape = _safe_shape(unit["polygon_2d"])
        if not building_shape.buffer(1e-7).covers(unit_shape):
            out_of_bounds.append(unit["unit_id"])
            errors.append({
                "unit_id": unit["unit_id"],
                "type": "OUT_OF_BOUNDS",
                "description": "Unit extends beyond building footprint boundary"
            })

    return {
        "valid": len(errors) == 0,
        "overlaps_detected": len(overlapping_pairs) > 0,
        "overlapping_units": overlapping_pairs,
        "out_of_bounds": out_of_bounds,
        "errors": errors
    }
