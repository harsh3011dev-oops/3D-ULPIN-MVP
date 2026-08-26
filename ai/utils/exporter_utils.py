"""
3D Format Exporter Utility for 3D ULPIN MVP
============================================
Converts the AI pipeline's 3D building output into standard 3D formats
that can be directly loaded by Rishabh's Frontend (Three.js / CesiumJS).

Supported Formats:
  1. Wavefront OBJ (.obj + .mtl) → Three.js / Blender / 3D Viewers
  2. CityJSON (.json)            → CesiumJS / QGIS / any GIS tool
  3. GeoJSON 3D (.geojson)       → Generic spatial APIs and Web Maps

Usage:
  from utils.exporter_utils import export_to_obj, export_to_cityjson, export_to_geojson3d, export_all_formats
"""

import json
import os
import math
from shapely.geometry import shape


# ─────────────────────────────────────────────────────────────────
# 1. Wavefront OBJ + MTL Exporter (for Three.js / 3D Viewers)
# ─────────────────────────────────────────────────────────────────

def export_to_obj(pipeline_output: dict, output_path: str = "exports/building.obj") -> str:
    """
    Export the 3D building model to Wavefront OBJ format with companion MTL material file.
    Coordinates are scaled to local metric meters centered at (0, 0, 0) for perfect 3D proportions.

    Args:
        pipeline_output (dict): Full output dict from process_building().
        output_path (str): Where to save the .obj file.

    Returns:
        str: Path to the exported .obj file.
    """
    footprint = pipeline_output.get("footprint", {})
    height = pipeline_output.get("height", 10.5)
    floor_count = pipeline_output.get("floor_count", 3)
    building_id = pipeline_output.get("building_id", "building")

    out_dir = os.path.dirname(output_path) if os.path.dirname(output_path) else "."
    os.makedirs(out_dir, exist_ok=True)

    base_name = os.path.splitext(os.path.basename(output_path))[0]
    mtl_filename = f"{base_name}.mtl"
    mtl_path = os.path.join(out_dir, mtl_filename)

    # Extract 2D coordinates from footprint
    coords = _get_polygon_coords(footprint)
    if not coords:
        raise ValueError("Cannot export: footprint coordinates are missing.")

    if coords[0] == coords[-1]:
        coords = coords[:-1]

    n = len(coords)
    if n == 0:
        raise ValueError("No coordinates in polygon.")

    # Convert geographic coordinates (degrees) to local metric meters (centered at 0,0)
    center_x = sum(x for x, y in coords) / n
    center_y = sum(y for x, y in coords) / n
    lat_rad = math.radians(center_y)
    m_per_deg_lon = 111320.0 * math.cos(lat_rad)
    m_per_deg_lat = 110540.0

    metric_coords = []
    for x, y in coords:
        if abs(x) <= 180 and abs(y) <= 90:
            local_x = (x - center_x) * m_per_deg_lon
            local_z = (y - center_y) * m_per_deg_lat
        else:
            local_x = (x - center_x) * 0.1
            local_z = (y - center_y) * 0.1
        metric_coords.append((local_x, local_z))

    # Write companion MTL file
    mtl_content = f"""# 3D ULPIN Building Materials
newmtl BuildingWall
Kd 0.15 0.55 0.85
Ka 0.10 0.10 0.10
Ks 0.30 0.30 0.30
Ns 20
d 0.90

newmtl BuildingRoof
Kd 0.90 0.45 0.15
Ka 0.10 0.10 0.10
Ks 0.20 0.20 0.20
Ns 10
d 1.0

newmtl BuildingFloor
Kd 0.30 0.35 0.40
Ka 0.10 0.10 0.10
d 1.0
"""
    with open(mtl_path, "w") as f:
        f.write(mtl_content)

    # Write OBJ file with material bindings
    lines = [
        f"# 3D ULPIN Building Export (Local Metric Units)",
        f"# Building ID: {building_id}",
        f"# Height: {height}m, Floors: {floor_count}",
        f"mtllib {mtl_filename}",
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
    lines.append("usemtl BuildingWall")
    lines.append("# Walls (side faces)")
    for i in range(n):
        next_i = (i + 1) % n
        v0 = i + 1
        v1 = next_i + 1
        v2 = next_i + n + 1
        v3 = i + n + 1
        lines.append(f"f {v0} {v1} {v2} {v3}")

    lines.append("")
    lines.append("usemtl BuildingFloor")
    lines.append("# Floor (ground face)")
    floor_verts = " ".join(str(i + 1) for i in range(n))
    lines.append(f"f {floor_verts}")

    lines.append("")
    lines.append("usemtl BuildingRoof")
    lines.append("# Roof (top face)")
    roof_verts = " ".join(str(i + n + 1) for i in range(n))
    lines.append(f"f {roof_verts}")

    with open(output_path, "w") as f:
        f.write("\n".join(lines))

    print(f"OBJ exported to: {output_path} (with MTL: {mtl_path})")
    return output_path


# ─────────────────────────────────────────────────────────────────
# 2. CityJSON Exporter (for CesiumJS / QGIS)
# ─────────────────────────────────────────────────────────────────

def export_to_cityjson(pipeline_output: dict, output_path: str = "exports/building.json") -> str:
    """
    Export the 3D building model to OGC CityJSON 1.1 format.
    CityJSON is the standard format for 3D city models directly supported by CesiumJS & QGIS.
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

    vertices = []
    for x, y in coords:
        vertices.append([round(x, 7), round(y, 7), 0.0])       # Ground ring
    for x, y in coords:
        vertices.append([round(x, 7), round(y, 7), height])    # Roof ring

    n = len(coords)
    ground_ring = list(range(n))
    roof_ring = list(range(n, 2 * n))

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
                            [[ground_ring]] +
                            [[roof_ring]] +
                            walls
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
# 3. GeoJSON 3D Exporter (for REST APIs & Web Maps)
# ─────────────────────────────────────────────────────────────────

def export_to_geojson3d(pipeline_output: dict, output_path: str = "exports/building.geojson") -> str:
    """
    Export the 3D building and its individual subdivided units as a 3D GeoJSON FeatureCollection.
    """
    footprint = pipeline_output.get("footprint", {})
    height = pipeline_output.get("height", 10.5)
    floor_count = pipeline_output.get("floor_count", 3)
    building_id = pipeline_output.get("building_id", "building")
    units = pipeline_output.get("units", [])

    os.makedirs(os.path.dirname(output_path) if os.path.dirname(output_path) else ".", exist_ok=True)

    features = []

    # Main building footprint
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

    # Individual units
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
# 4. Master Export Bundle (All-in-One for Backend Integration)
# ─────────────────────────────────────────────────────────────────

def export_all_formats(pipeline_output: dict, output_dir: str = "exports", file_prefix: str = "building") -> dict:
    """
    Export all 3D formats (.obj + .mtl, .json, .geojson) in a single call.
    """
    os.makedirs(output_dir, exist_ok=True)
    obj_file = os.path.join(output_dir, f"{file_prefix}.obj")
    city_file = os.path.join(output_dir, f"{file_prefix}.json")
    geo_file = os.path.join(output_dir, f"{file_prefix}.geojson")

    return {
        "obj": export_to_obj(pipeline_output, obj_file),
        "cityjson": export_to_cityjson(pipeline_output, city_file),
        "geojson3d": export_to_geojson3d(pipeline_output, geo_file)
    }


def _get_polygon_coords(footprint: dict) -> list:
    """Extract outer ring coordinates from GeoJSON Polygon or MultiPolygon."""
    geom_type = footprint.get("type")
    coords = footprint.get("coordinates", [])

    if geom_type == "Polygon":
        return coords[0] if coords else []
    elif geom_type == "MultiPolygon":
        largest = max(coords, key=lambda ring: len(ring[0]))
        return largest[0]
    return []
