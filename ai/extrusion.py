from shapely.geometry import shape

def extrude_building(
    footprint: dict,
    height_meters: float,
    floor_count: int
) -> dict:
    """
    Convert a 2D building footprint into a 3D extrusion representation.

    Takes the 2D footprint polygon and adds Z-axis information to create
    a volumetric 3D model with z_min (ground) and z_max (roof) values.

    Args:
        footprint (dict): GeoJSON Polygon of the building footprint.
        height_meters (float): Total building height in meters above ground.
        floor_count (int): Total number of floors.

    Returns:
        dict: 3D extrusion object with footprint, z_min, z_max, floor_height.

    Raises:
        ValueError: If height_meters <= 0 or floor_count <= 0.
    """
    if height_meters <= 0:
        raise ValueError(f"height_meters must be positive, got {height_meters}")
    if floor_count <= 0:
        raise ValueError(f"floor_count must be positive, got {floor_count}")

    floor_height = round(height_meters / floor_count, 2)
    poly = shape(footprint)
    volume_approx = round(poly.area * (111_000 ** 2) * height_meters, 2)

    return {
        "type": "Building3D",
        "footprint": footprint,
        "z_min": 0.0,
        "z_max": height_meters,
        "floor_height_m": floor_height,
        "floor_count": floor_count,
        "volume_m3": volume_approx
    }
