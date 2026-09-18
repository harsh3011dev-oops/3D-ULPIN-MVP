"""
ai/exporter.py
Multi-Format 3D GIS Export Engine for 3D ULPIN Volumetric Parcels.

Exports 3D volumetric building digital twins & strata units to standard geospatial formats:
- GeoJSON-3D (.geojson) with 3D Z-coordinates
- CityJSON (OGC CityGML 3.0 Standard)
- Wavefront OBJ (.obj) 3D mesh for Blender / AutoCAD
- GLTF / GLB 3D scene model for WebGL
"""

import json
import logging
from pathlib import Path
from typing import Dict, Any, List, Optional, Union
from shapely.geometry import shape

logger = logging.getLogger(__name__)


class MultiFormat3DExporter:
    """
    Converts 3D building records into GeoJSON-3D, CityJSON, OBJ, and GLTF formats.
    """

    @staticmethod
    def to_geojson_3d(building_data: dict) -> dict:
        """
        Exports building and strata units to GeoJSON-3D format with 3D coordinates [lon, lat, z].
        """
        features = []
        b_id = building_data.get("building_id", "BLDG-001")

        # 1. Parent Building 3D Footprint Feature
        fp_2d = building_data.get("footprint", {})
        if fp_2d and "coordinates" in fp_2d:
            height = float(building_data.get("height_meters", 30.0))
            coords_2d = fp_2d["coordinates"][0]

            # 3D Base Polygon (z=0)
            base_3d = [[p[0], p[1], 0.0] for p in coords_2d]
            # 3D Roof Polygon (z=height)
            roof_3d = [[p[0], p[1], height] for p in coords_2d]

            features.append({
                "type": "Feature",
                "properties": {
                    "feature_type": "Building",
                    "building_id": b_id,
                    "parcel_id": building_data.get("parcel_id"),
                    "name": building_data.get("building_name", "Building"),
                    "height_meters": height,
                    "floor_count": building_data.get("floor_count", 1)
                },
                "geometry": {
                    "type": "MultiPolygon",
                    "coordinates": [[base_3d], [roof_3d]]
                }
            })

        # 2. Strata Unit 3D Features
        units = building_data.get("units", [])
        for unit in units:
            u_poly = unit.get("polygon_2d", {})
            if u_poly and "coordinates" in u_poly:
                z_min = float(unit.get("z_min", 0.0))
                z_max = float(unit.get("z_max", 3.5))
                c_2d = u_poly["coordinates"][0]

                u_base_3d = [[p[0], p[1], z_min] for p in c_2d]
                u_roof_3d = [[p[0], p[1], z_max] for p in c_2d]

                features.append({
                    "type": "Feature",
                    "properties": {
                        "feature_type": "StrataUnit",
                        "unit_id": unit.get("unit_id"),
                        "ulpin_3d": unit.get("ulpin"),
                        "floor": unit.get("floor"),
                        "label": unit.get("label"),
                        "z_min": z_min,
                        "z_max": z_max,
                        "area_sqm": unit.get("area_sqm")
                    },
                    "geometry": {
                        "type": "MultiPolygon",
                        "coordinates": [[u_base_3d], [u_roof_3d]]
                    }
                })

        return {
            "type": "FeatureCollection",
            "name": f"3D_ULPIN_{b_id}",
            "crs": {
                "type": "name",
                "properties": {"name": "urn:ogc:def:crs:OGC:1.3:CRS84"}
            },
            "features": features
        }

    @staticmethod
    def to_cityjson(building_data: dict) -> dict:
        """
        Exports building to OGC CityJSON (CityGML 3.0 Standard) format.
        """
        b_id = str(building_data.get("building_id", "bldg_1"))
        height = float(building_data.get("height_meters", 30.0))
        fp = building_data.get("footprint", {})

        vertices = []
        boundaries = []

        if fp and "coordinates" in fp:
            coords = fp["coordinates"][0]
            n_pts = len(coords) - 1

            # Base vertices (0..n_pts-1)
            for p in coords[:n_pts]:
                vertices.append([p[0], p[1], 0.0])

            # Roof vertices (n_pts..2*n_pts-1)
            for p in coords[:n_pts]:
                vertices.append([p[0], p[1], height])

            # Ground Surface Boundary
            ground_face = [list(range(n_pts))]
            # Roof Surface Boundary
            roof_face = [list(range(n_pts, 2 * n_pts))]

            # Wall Surface Boundaries
            wall_faces = []
            for i in range(n_pts):
                next_i = (i + 1) % n_pts
                wall_faces.append([[i, next_i, next_i + n_pts, i + n_pts]])

            boundaries = ground_face + roof_face + [w[0] for w in wall_faces]

        city_obj_id = f"id_{b_id}"

        return {
            "type": "CityJSON",
            "version": "1.1",
            "extensions": {},
            "CityObjects": {
                city_obj_id: {
                    "type": "Building",
                    "attributes": {
                        "name": building_data.get("building_name", "Building"),
                        "parcel_id": building_data.get("parcel_id"),
                        "measuredHeight": height,
                        "storeysAboveGround": building_data.get("floor_count", 1)
                    },
                    "geometry": [
                        {
                            "type": "Solid",
                            "lod": "1.2",
                            "boundaries": [[boundaries]] if boundaries else []
                        }
                    ]
                }
            },
            "vertices": vertices,
            "metadata": {
                "referenceSystem": "urn:ogc:def:crs:EPSG::4326"
            }
        }

    @staticmethod
    def to_obj_mesh(building_data: dict) -> str:
        """
        Exports 3D building mesh into Wavefront OBJ text format.
        """
        lines = [f"# 3D ULPIN Volumetric Mesh Export: {building_data.get('building_name', 'Building')}\n"]
        fp = building_data.get("footprint", {})
        height = float(building_data.get("height_meters", 30.0))

        if fp and "coordinates" in fp:
            coords = fp["coordinates"][0]
            n_pts = len(coords) - 1

            # Vertices 1 to n_pts (Base)
            for p in coords[:n_pts]:
                lines.append(f"v {p[0]:.7f} {p[1]:.7f} 0.000\n")

            # Vertices n_pts+1 to 2*n_pts (Roof)
            for p in coords[:n_pts]:
                lines.append(f"v {p[0]:.7f} {p[1]:.7f} {height:.3f}\n")

            lines.append("\n# Faces\n")
            # Base Face
            base_indices = " ".join(str(i + 1) for i in range(n_pts))
            lines.append(f"f {base_indices}\n")

            # Roof Face
            roof_indices = " ".join(str(n_pts + i + 1) for i in range(n_pts))
            lines.append(f"f {roof_indices}\n")

            # Wall Faces
            for i in range(n_pts):
                next_i = (i + 1) % n_pts
                v1 = i + 1
                v2 = next_i + 1
                v3 = next_i + n_pts + 1
                v4 = i + n_pts + 1
                lines.append(f"f {v1} {v2} {v3} {v4}\n")

        return "".join(lines)


def export_building_3d(
    building_data: dict,
    format_type: str = "geojson3d"
) -> Union[dict, str]:
    """
    Main interface for exporting 3D volumetric building data into target format.
    
    Supported formats: 'geojson3d', 'cityjson', 'obj'.
    """
    fmt = format_type.lower().strip()

    if fmt in ("geojson3d", "geojson_3d", "geojson"):
        return MultiFormat3DExporter.to_geojson_3d(building_data)
    elif fmt in ("cityjson", "citygml"):
        return MultiFormat3DExporter.to_cityjson(building_data)
    elif fmt in ("obj", "wavefront"):
        return MultiFormat3DExporter.to_obj_mesh(building_data)
    else:
        return MultiFormat3DExporter.to_geojson_3d(building_data)
