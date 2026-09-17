import logging
from typing import Optional, Dict, Any
from ai.models import HeightEstimate, FloorCountEstimate

logger = logging.getLogger(__name__)

DEFAULT_FLOOR_HEIGHT_M = 3.5

def estimate_floor_count(
    osm_data: Dict[str, Any],
    gemini_data: Dict[str, Any],
    user_floor_count: Optional[int] = None
) -> FloorCountEstimate:
    """
    Determine the best floor count estimate based on available sources.
    Hierarchy:
    1. User specified
    2. OSM building:levels
    3. Gemini semantic estimate
    4. Default fallback
    """
    if user_floor_count is not None and user_floor_count > 0:
        return FloorCountEstimate(
            value=user_floor_count,
            source="user_specified",
            confidence=1.0
        )
        
    osm_floors = osm_data.get("floor_count")
    if osm_floors is not None:
        try:
            val = int(osm_floors)
            if val > 0:
                return FloorCountEstimate(
                    value=val,
                    source="osm",
                    confidence=0.9
                )
        except ValueError:
            pass
            
    gemini_floors = gemini_data.get("estimated_floors")
    if gemini_floors is not None:
        try:
            val = int(gemini_floors)
            if val > 0:
                return FloorCountEstimate(
                    value=val,
                    source="gemini_vision",
                    confidence=0.6
                )
        except ValueError:
            pass
            
    # Fallback default
    return FloorCountEstimate(
        value=3,
        source="default",
        confidence=0.2
    )


def estimate_building_height(
    osm_data: Dict[str, Any],
    floor_count: FloorCountEstimate,
    user_height: Optional[float] = None,
    latitude: Optional[float] = None,
    longitude: Optional[float] = None,
    footprint: Optional[Dict[str, Any]] = None
) -> HeightEstimate:
    """
    Determine the best building height estimate based on available sources.
    Hierarchy:
    1. User specified
    2. OSM height
    3. DEM/DSM true elevation differential (Open-Elevation / SRTM / Copernicus)
    4. Estimated from floor count (floor_count * 3.5m)
    5. Default fallback
    """
    if user_height is not None and user_height > 0:
        return HeightEstimate(
            value_meters=float(user_height),
            source="user_specified",
            method="user input",
            confidence=1.0
        )
        
    osm_height = osm_data.get("height_meters")
    if osm_height is not None:
        try:
            val = float(osm_height)
            if val > 0:
                return HeightEstimate(
                    value_meters=val,
                    source="osm",
                    method="OSM tags",
                    confidence=0.9
                )
        except ValueError:
            pass

    # 3. DEM/DSM Elevation differential analysis (Phase 2 & Next Action 3)
    if latitude is not None and longitude is not None:
        try:
            from ai.height_estimation import estimate_height_from_dem_dsm
            dem_res = estimate_height_from_dem_dsm(latitude, longitude, footprint=footprint)
            if dem_res and dem_res.get("height_meters"):
                val = float(dem_res["height_meters"])
                if val >= 3.0:
                    return HeightEstimate(
                        value_meters=val,
                        source="dem_dsm_elevation",
                        method=dem_res.get("method", "DEM/DSM Differential Analysis"),
                        confidence=dem_res.get("confidence", 0.75)
                    )
        except Exception as e:
            logger.debug("DEM/DSM elevation calculation skipped: %s", e)
            
    if floor_count.value > 0:
        val = float(floor_count.value * DEFAULT_FLOOR_HEIGHT_M)
        return HeightEstimate(
            value_meters=val,
            source="estimated_from_floors",
            method=f"floor_count * {DEFAULT_FLOOR_HEIGHT_M}m",
            confidence=floor_count.confidence * 0.8
        )
        
    # Absolute fallback
    val = float(3 * DEFAULT_FLOOR_HEIGHT_M)
    return HeightEstimate(
        value_meters=val,
        source="default",
        method=f"3 * {DEFAULT_FLOOR_HEIGHT_M}m",
        confidence=0.1
    )
