from shapely.geometry import shape, mapping, box
import numpy as np

def divide_into_floors(
    footprint: dict,
    height_meters: float,
    floor_count: int,
    building_parts: list = None
) -> list:
    """
    Divide a 3D building extrusion into individual floor slabs.

    Each floor is the footprint polygon with z_min and z_max defining
    its vertical extent. Ground floor starts at z=0.

    Args:
        footprint (dict): GeoJSON Polygon of the main building footprint.
        height_meters (float): Total building height in meters.
        floor_count (int): Number of floors to divide into.
        building_parts (list, optional): List of building parts from OSM.

    Returns:
        list: Floor dicts — [{floor_number, label, z_min, z_max, floor_height_m, footprint}]
    """
    floor_height = height_meters / floor_count
    floors = []
    
    parts_shapes = []
    if building_parts:
        for part in building_parts:
            part_poly = shape(part["footprint"])
            if not part_poly.is_valid:
                part_poly = part_poly.buffer(0)
            parts_shapes.append({
                "poly": part_poly,
                "min_height": part.get("min_height", 0.0),
                "height": part.get("height", height_meters)
            })

    for i in range(floor_count):
        label = "G" if i == 0 else f"{i}F"
        z_min = round(i * floor_height, 2)
        z_max = round((i + 1) * floor_height, 2)
        
        # Determine the footprint for this specific floor
        floor_poly = None
        if parts_shapes:
            valid_parts = []
            for ps in parts_shapes:
                if z_min < ps["height"] and z_max > ps["min_height"]:
                    valid_parts.append(ps["poly"])
            
            if valid_parts:
                floor_poly = valid_parts[0]
                for p in valid_parts[1:]:
                    floor_poly = floor_poly.union(p)
                
                if not floor_poly.is_valid:
                    floor_poly = floor_poly.buffer(0)
        
        if floor_poly is not None and not floor_poly.is_empty:
            floor_footprint = mapping(floor_poly)
        else:
            floor_footprint = footprint

        floors.append({
            "floor_number": i + 1,
            "label": label,
            "z_min": z_min,
            "z_max": z_max,
            "floor_height_m": round(floor_height, 2),
            "footprint": floor_footprint
        })

    return floors


def divide_floor_into_units(
    floor: dict,
    units_per_floor: int = 4
) -> list:
    """
    Subdivide a floor polygon into individual property units (grid-based MVP).

    Divides the floor footprint into a uniform grid of `units_per_floor`
    rectangles. Each subdivision gets a unique label (A01, A02, B01, ...).

    Args:
        floor (dict): Floor dict from divide_into_floors() output.
        units_per_floor (int): Number of units per floor (default 4).

    Returns:
        list: Unit dicts — [{unit_id, floor, label, polygon_2d, centroid, area_sqm, z_min, z_max}]
    """
    footprint_shape = shape(floor["footprint"])
    if not footprint_shape.is_valid:
        footprint_shape = footprint_shape.buffer(0)
    minx, miny, maxx, maxy = footprint_shape.bounds
    floor_number = floor["floor_number"]

    cols = max(1, int(np.ceil(np.sqrt(units_per_floor))))
    rows = max(1, int(np.ceil(units_per_floor / cols)))
    cell_w = (maxx - minx) / cols
    cell_h = (maxy - miny) / rows

    units = []
    unit_num = 0

    for row in range(rows):
        for col in range(cols):
            if unit_num >= units_per_floor:
                break

            x0, y0 = minx + col * cell_w, miny + row * cell_h
            unit_poly = box(x0, y0, x0 + cell_w, y0 + cell_h).intersection(footprint_shape)

            if unit_poly.is_empty:
                continue

            if unit_poly.geom_type == "MultiPolygon":
                polys = [p for p in unit_poly.geoms if p.geom_type == "Polygon" and not p.is_empty]
                if polys:
                    unit_poly = max(polys, key=lambda g: g.area)
                else:
                    continue
            elif unit_poly.geom_type == "GeometryCollection":
                polys = [g for g in unit_poly.geoms if g.geom_type == "Polygon" and not g.is_empty]
                if polys:
                    unit_poly = max(polys, key=lambda g: g.area)
                else:
                    continue
            elif unit_poly.geom_type != "Polygon":
                continue

            label = f"{chr(65 + col)}{row + 1:02d}"
            centroid = unit_poly.centroid
            units.append({
                "unit_id": f"UNIT_F{floor_number:02d}_{label}",
                "floor": floor_number,
                "label": label,
                "polygon_2d": mapping(unit_poly),
                "centroid": [centroid.y, centroid.x],
                "area_sqm": round(unit_poly.area * (111_000 ** 2), 2),
                "floor_height_m": floor.get("floor_height_m", round(floor["z_max"] - floor["z_min"], 2)),
                "z_min": floor["z_min"],
                "z_max": floor["z_max"]
            })
            unit_num += 1

    return units
