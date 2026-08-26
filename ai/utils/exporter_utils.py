"""
3D Format Exporter Utility for 3D ULPIN MVP
============================================
Converts the AI pipeline's 3D building output into standard 3D formats
that can be directly loaded by Rishabh's Frontend (Three.js / CesiumJS).

Supported Formats:
  1. Wavefront OBJ (.obj)  → Three.js / Blender
  2. CityJSON (.json)      → CesiumJS / QGIS / any GIS tool
  3. GeoJSON 3D (.geojson) → Generic spatial APIs and maps

Usage:
  from utils.exporter_utils import export_to_obj, export_to_cityjson, export_to_geojson3d
"""

import json
import os
from shapely.geometry import shape


# ─────────────────────────────────────────────────────────────────
# 1. Wavefront OBJ Exporter (for Three.js)
# ─────────────────────────────────────────────────────────────────

def export_to_obj(pipeline_output: dict, output_path: str = "exports/building.obj") -> str:
    """
    Export the 3D building model to Wavefront OBJ format.
    
    Generates a 3D mesh with:
    - Floor polygon (ground face)
    - Roof polygon (top face)
    - Vertical walls connecting floor to roof

    Args:
        pipeline_output (dict): Full output dict from process_building().
        output_path (str): Where to save the .obj file.

    Returns:
        str: Path to the exported .obj file.
    """
    footprint = pipeline_output.get("footprint", {})
    height = pipeline_output.get("height", 10.5)
    building_id = pipeline_output.get("building_id", "building")

    os.makedirs(os.path.dirname(output_path) if os.path.dirname(output_path) else ".", exist_ok=True)

    # Extract 2D coordinates from footprint
    coords = _get_polygon_coords(footprint)
    if not coords:
        raise ValueError("Cannot export: footprint coordinates are missing.")

    # Remove duplicate closing point if present
    if coords[0] == coords[-1]:
        coords = coords[:-1]

    n = len(coords)
    if n == 0:
        raise ValueError("No coordinates in polygon.")

    # Convert geographic coordinates (degrees) to local metric meters (centered at 0,0)
    # 1 deg latitude ~ 110540 meters, 1 deg longitude ~ 111320 * cos(lat) meters
    import math
    center_x = sum(x for x, y in coords) / n
    center_y = sum(y for x, y in coords) / n
    lat_rad = math.radians(center_y)
    m_per_deg_lon = 111320.0 * math.cos(lat_rad)
    m_per_deg_lat = 110540.0

    metric_coords = []
    for x, y in coords:
        # Check if coordinates are in degrees (GPS) or already in pixels/meters
        if abs(x) <= 180 and abs(y) <= 90:
            local_x = (x - center_x) * m_per_deg_lon
            local_z = (y - center_y) * m_per_deg_lat
        else:
            # Fallback for pixel coordinates: center and scale
            local_x = (x - center_x) * 0.1
            local_z = (y - center_y) * 0.1
        metric_coords.append((local_x, local_z))

    lines = [
        f"# 3D ULPIN Building Export (Local Metric Units)",
        f"# Building ID: {building_id}",
        f"# Height: {height}m",
        "",
        f"o {building_id}",
        ""
    ]

    # Define vertices: bottom ring first, then top ring
    for lx, lz in metric_coords:
        lines.append(f"v {lx:.3f} 0.000 {lz:.3f}")   # Ground (y=0)
    for lx, lz in metric_coords:
        lines.append(f"v {lx:.3f} {height:.3f} {lz:.3f}")  # Roof (y=height)

    lines.append("")
    lines.append("# Walls (side faces)")
    for i in range(n):
        next_i = (i + 1) % n
        # OBJ face indices are 1-based
        v0 = i + 1         # bottom current
        v1 = next_i + 1    # bottom next
        v2 = next_i + n + 1  # top next
        v3 = i + n + 1       # top current
        lines.append(f"f {v0} {v1} {v2} {v3}")

    # Floor face (ground polygon)
    lines.append("# Floor (ground face)")
    floor_verts = " ".join(str(i + 1) for i in range(n))
    lines.append(f"f {floor_verts}")

    # Roof face (top polygon)
    lines.append("# Roof (top face)")
    roof_verts = " ".join(str(i + n + 1) for i in range(n))
    lines.append(f"f {roof_verts}")

    with open(output_path, "w") as f:
        f.write("\n".join(lines))

    print(f"OBJ exported to: {output_path}")
    return output_path


# ─────────────────────────────────────────────────────────────────
# 2. CityJSON Exporter (for CesiumJS / QGIS)
# ─────────────────────────────────────────────────────────────────

def export_to_cityjson(pipeline_output: dict, output_path: str = "exports/building.json") -> str:
    """
    Export the 3D building model to OGC CityJSON format.
    
    CityJSON is the standard format for 3D city models. It is directly
    supported by CesiumJS, QGIS, and many GIS tools.

    Args:
        pipeline_output (dict): Full output dict from process_building().
        output_path (str): Where to save the CityJSON file.

    Returns:
        str: Path to the exported CityJSON file.
    """
    footprint = pipeline_output.get("footprint", {})
    height = pipeline_output.get("height", 10.5)
    floor_count = pipeline_output.get("floor_count", 3)
    building_id = pipeline_output.get("building_id", "building")
    units = pipeline_output.get("units", [])

    os.makedirs(os.path.dirname(output_path) if os.path.dirname(output_path) else ".", exist_ok=True)

    coords = _get_polygon_coords(footprint)
    if coords[0] == coords[-1]:
        coords = coords[:-1]

    # CityJSON vertex list (all unique vertices)
    vertices = []
    for x, y in coords:
        vertices.append([round(x, 6), round(y, 6), 0.0])       # Ground ring
    for x, y in coords:
        vertices.append([round(x, 6), round(y, 6), height])     # Roof ring

    n = len(coords)
    ground_ring = list(range(n))
    roof_ring = list(range(n, 2 * n))

    # Build walls surface boundaries
    walls = []
    for i in range(n):
        next_i = (i + 1) % n
        walls.append([[i, next_i, next_i + n, i + n]])

    city_json = {
        "type": "CityJSON",
        "version": "1.1",
        "metadata": {
            "title": f"3D ULPIN Building: {building_id}",
            "referenceSystem": "urn:ogc:def:crs:OGC:1.3:CRS84"
        },
        "CityObjects": {
            building_id: {
                "type": "Building",
                "attributes": {
                    "building_id": building_id,
                    "floor_count": floor_count,
                    "height_m": height,
                    "total_units": len(units)
                },
                "geometry": [
                    {
                        "type": "Solid",
                        "lod": "1",
                        "boundaries": [
                            [[ground_ring]] +   # Ground
                            [[roof_ring]] +      # Roof
                            walls                # Walls
                        ]
                    }
                ]
            }
        },
        "vertices": vertices
    }

    with open(output_path, "w") as f:
        json.dump(city_json, f, indent=2)

    print(f"CityJSON exported to: {output_path}")
    return output_path


# ─────────────────────────────────────────────────────────────────
# 3. GeoJSON 3D Exporter (for REST APIs and generic maps)
# ─────────────────────────────────────────────────────────────────

def export_to_geojson3d(pipeline_output: dict, output_path: str = "exports/building.geojson") -> str:
    """
    Export the 3D building and its individual units as a 3D GeoJSON
    FeatureCollection with z-coordinate elevation properties.

    Args:
        pipeline_output (dict): Full output dict from process_building().
        output_path (str): Where to save the GeoJSON file.

    Returns:
        str: Path to the exported GeoJSON file.
    """
    footprint = pipeline_output.get("footprint", {})
    height = pipeline_output.get("height", 10.5)
    floor_count = pipeline_output.get("floor_count", 3)
    building_id = pipeline_output.get("building_id", "building")
    units = pipeline_output.get("units", [])

    os.makedirs(os.path.dirname(output_path) if os.path.dirname(output_path) else ".", exist_ok=True)

    features = []

    # Main building footprint as a feature
    features.append({
        "type": "Feature",
        "id": building_id,
        "properties": {
            "type": "Building",
            "building_id": building_id,
            "height_m": height,
            "floor_count": floor_count,
            "total_units": len(units)
        },
        "geometry": footprint
    })

    # Each unit as a separate feature
    for unit in units:
        features.append({
            "type": "Feature",
            "id": unit.get("unit_id"),
            "properties": {
                "type": "Unit",
                "unit_id": unit.get("unit_id"),
                "floor": unit.get("floor"),
                "label": unit.get("label"),
                "z_min": unit.get("z_min"),
                "z_max": unit.get("z_max"),
                "area_sqm": unit.get("area_sqm"),
                "ulpin": unit.get("ulpin")
            },
            "geometry": unit.get("polygon_2d")
        })

    geojson = {
        "type": "FeatureCollection",
        "name": f"3D ULPIN — {building_id}",
        "crs": {
            "type": "name",
            "properties": {"name": "urn:ogc:def:crs:OGC:1.3:CRS84"}
        },
        "features": features
    }

    with open(output_path, "w") as f:
        json.dump(geojson, f, indent=2)

    print(f"GeoJSON 3D exported to: {output_path}")
    return output_path


# ─────────────────────────────────────────────────────────────────
# Helper: Extract polygon ring coordinates safely
# ─────────────────────────────────────────────────────────────────

def _get_polygon_coords(footprint: dict) -> list:
    """Extract the outer ring coordinates from a GeoJSON Polygon or MultiPolygon."""
    geom_type = footprint.get("type")
    coords = footprint.get("coordinates", [])

    if geom_type == "Polygon":
        return coords[0] if coords else []
    elif geom_type == "MultiPolygon":
        # Take the largest polygon ring
        largest = max(coords, key=lambda ring: len(ring[0]))
        return largest[0]
    return []
