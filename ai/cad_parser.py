"""
ai/cad_parser.py
Indoor CAD / GeoJSON / DXF Floor Plan Parser.

Parses actual architectural floor plan files (.dxf, .geojson, .json)
to extract real-world apartment/unit boundaries, common areas, corridors,
and wall polygons instead of relying on pure mathematical grid slicing.
"""

import json
import logging
import math
from pathlib import Path
from typing import Dict, Any, List, Optional, Tuple, Union
from shapely.geometry import shape, mapping, Polygon, MultiPolygon, box
from shapely.ops import transform, unary_union

logger = logging.getLogger(__name__)

try:
    import ezdxf
    HAS_EZDXF = True
except ImportError:
    HAS_EZDXF = False
    logger.debug("ezdxf is not installed. DXF file parsing will fallback to GeoJSON parser.")


class FloorPlanParser:
    """
    Parses CAD (DXF), GeoJSON, or JSON indoor floor plan drawings and fits them
    within a target 2D building footprint.
    """

    @staticmethod
    def parse_geojson_floorplan(
        geojson_data: Union[dict, str, Path],
        target_footprint: Optional[dict] = None
    ) -> List[Dict[str, Any]]:
        """
        Parses a GeoJSON floor plan file containing unit features.
        
        Args:
            geojson_data: Dict or file path to GeoJSON floorplan.
            target_footprint: Target building footprint GeoJSON Polygon for spatial alignment.
            
        Returns:
            List of parsed unit dicts: [{unit_id, label, polygon_2d, area_sqm, category}]
        """
        if isinstance(geojson_data, (str, Path)):
            with open(geojson_data, "r", encoding="utf-8") as f:
                geojson_data = json.load(f)

        features = geojson_data.get("features", []) if isinstance(geojson_data, dict) else []
        if not features and isinstance(geojson_data, dict) and "type" in geojson_data:
            features = [{"type": "Feature", "geometry": geojson_data, "properties": {}}]

        parsed_units = []
        target_shape = shape(target_footprint) if target_footprint else None

        for idx, feat in enumerate(features):
            geom_dict = feat.get("geometry")
            if not geom_dict:
                continue

            try:
                poly_shape = shape(geom_dict)
                if not poly_shape.is_valid:
                    poly_shape = poly_shape.buffer(0)

                if poly_shape.is_empty:
                    continue

                props = feat.get("properties", {})
                unit_label = (
                    props.get("unit_id")
                    or props.get("label")
                    or props.get("name")
                    or props.get("unit")
                    or f"U{idx + 1:02d}"
                )
                category = props.get("type", props.get("category", "residential"))

                # If target footprint is provided, align/clip to footprint bounds
                if target_shape and not poly_shape.intersects(target_shape):
                    # Scaled transformation to target footprint bounding box
                    poly_shape = FloorPlanParser._fit_geometry_to_target(poly_shape, target_shape)

                area_sqm = round(poly_shape.area * (111_000 ** 2), 2) if poly_shape.area < 0.1 else round(poly_shape.area, 2)

                centroid = poly_shape.centroid
                parsed_units.append({
                    "unit_id": f"UNIT_{unit_label}",
                    "label": unit_label,
                    "category": category,
                    "polygon_2d": mapping(poly_shape),
                    "centroid": [centroid.y, centroid.x],
                    "area_sqm": area_sqm
                })
            except Exception as err:
                logger.warning("Error parsing floorplan feature %d: %s", idx, err)

        return parsed_units

    @staticmethod
    def parse_dxf_floorplan(
        dxf_file_path: Union[str, Path],
        target_footprint: Optional[dict] = None
    ) -> List[Dict[str, Any]]:
        """
        Parses a CAD .dxf file to extract closed LWPOLYLINE / POLYLINE room boundaries.
        """
        if not HAS_EZDXF:
            logger.warning("ezdxf package missing. Cannot parse DXF file directly.")
            return []

        doc = ezdxf.readfile(str(dxf_file_path))
        msp = doc.modelspace()
        parsed_units = []

        target_shape = shape(target_footprint) if target_footprint else None
        unit_counter = 1

        for entity in msp:
            if entity.dxftype() in ("LWPOLYLINE", "POLYLINE") and entity.is_closed:
                try:
                    points = [(p[0], p[1]) for p in entity.get_points()]
                    if len(points) < 3:
                        continue
                    poly_shape = Polygon(points)
                    if not poly_shape.is_valid:
                        poly_shape = poly_shape.buffer(0)

                    if poly_shape.is_empty or poly_shape.area < 1.0:
                        continue

                    if target_shape:
                        poly_shape = FloorPlanParser._fit_geometry_to_target(poly_shape, target_shape)

                    centroid = poly_shape.centroid
                    unit_label = f"A{unit_counter:02d}"
                    parsed_units.append({
                        "unit_id": f"UNIT_{unit_label}",
                        "label": unit_label,
                        "category": "residential",
                        "polygon_2d": mapping(poly_shape),
                        "centroid": [centroid.y, centroid.x],
                        "area_sqm": round(poly_shape.area, 2)
                    })
                    unit_counter += 1
                except Exception as err:
                    logger.debug("Failed parsing DXF entity: %s", err)

        return parsed_units

    @staticmethod
    def _fit_geometry_to_target(source_geom: Polygon, target_geom: Polygon) -> Polygon:
        """Scales and shifts a CAD floorplan geometry to fit cleanly inside a 2D building footprint."""
        s_minx, s_miny, s_maxx, s_maxy = source_geom.bounds
        t_minx, t_miny, t_maxx, t_maxy = target_geom.bounds

        s_w = max(s_maxx - s_minx, 1e-6)
        s_h = max(s_maxy - s_miny, 1e-6)
        t_w = t_maxx - t_minx
        t_h = t_maxy - t_miny

        scale_x = t_w / s_w
        scale_y = t_h / s_h

        def _transform_pt(x, y, z=None):
            nx = t_minx + (x - s_minx) * scale_x
            ny = t_miny + (y - s_miny) * scale_y
            return (nx, ny)

        transformed = transform(_transform_pt, source_geom)
        fitted = transformed.intersection(target_geom)
        return fitted if not fitted.is_empty and fitted.geom_type == "Polygon" else target_geom


def parse_floor_into_units_from_file(
    floor: dict,
    floorplan_file: Optional[Union[str, Path]] = None,
    units_per_floor: int = 4
) -> List[Dict[str, Any]]:
    """
    Main interface function for Floor Unit Division.
    If a floorplan CAD/GeoJSON file is provided, parses real indoor units.
    Otherwise, uses grid slicing as a clean fallback.
    """
    if floorplan_file and Path(floorplan_file).exists():
        path = Path(floorplan_file)
        if path.suffix.lower() == ".dxf":
            units = FloorPlanParser.parse_dxf_floorplan(path, target_footprint=floor["footprint"])
        else:
            units = FloorPlanParser.parse_geojson_floorplan(path, target_footprint=floor["footprint"])

        if units:
            # Annotate floor height & vertical range
            for u in units:
                u["floor"] = floor["floor_number"]
                u["z_min"] = floor["z_min"]
                u["z_max"] = floor["z_max"]
                u["floor_height_m"] = floor.get("floor_height_m", round(floor["z_max"] - floor["z_min"], 2))
                u["unit_id"] = f"UNIT_F{floor['floor_number']:02d}_{u['label']}"
            return units

    # Fallback to standard floor division if no CAD file provided
    from ai.floor_division import divide_floor_into_units
    return divide_floor_into_units(floor, units_per_floor=units_per_floor)
