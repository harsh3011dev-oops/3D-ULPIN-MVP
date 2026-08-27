from shapely.geometry import shape

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
    building_shape = shape(building_footprint)
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
                shape_i = shape(floor_units[i]["polygon_2d"])
                shape_j = shape(floor_units[j]["polygon_2d"])

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
        unit_shape = shape(unit["polygon_2d"])
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
