import os
import requests

OPENCAGE_API_KEY = os.getenv("OPENCAGE_API_KEY", "617a0507a3c8468aae0b5ffd61273ef4")

def geocode_address(address: str) -> dict:
    """
    Convert a text address or Plus Code (e.g., 'Connaught Place, New Delhi' or 'V36Q+J6V Narela')
    into GPS coordinates (lat, lon) using OpenCage Geocoding API with India locality boosting.

    Args:
        address (str): Place name, street address, or Plus Code string.

    Returns:
        dict: Geocoded location data containing lat, lon, formatted_address, and bounds.
    """
    try:
        clean_addr = address.strip()
        encoded_addr = requests.utils.quote(clean_addr)
        url = f"https://api.opencagedata.com/geocode/v1/json?q={encoded_addr}&key={OPENCAGE_API_KEY}&countrycode=in&limit=1&no_annotations=0"
        
        print(f"Geocoding address via OpenCage API: '{clean_addr}'...")
        response = requests.get(url, timeout=10)
        
        if response.status_code == 200:
            data = response.json()
            results = data.get("results", [])
            if results:
                first = results[0]
                geometry = first.get("geometry", {})
                lat = geometry.get("lat")
                lon = geometry.get("lng")
                formatted = first.get("formatted")
                
                print(f"Successfully geocoded '{clean_addr}' -> [{lat}, {lon}] ({formatted})")
                return {
                    "lat": lat,
                    "lon": lon,
                    "formatted_address": formatted
                }
        print(f"Warning: OpenCage returned no results for '{clean_addr}'")
        return None
    except Exception as e:
        print(f"Geocoding error: {e}")
        return None


OSM_OVERPASS_ENDPOINTS = [
    "https://maps.mail.ru/osm/tools/overpass/api/interpreter",
    "https://overpass-api.de/api/interpreter",
    "https://overpass.kumi.systems/api/interpreter",
    "https://lz4.overpass-api.de/api/interpreter",
    "https://z.overpass-api.de/api/interpreter",
    "https://overpass.osm.ch/api/interpreter",
    "https://overpass.private.coffee/api/interpreter",
]
OSM_HEADERS = {
    "User-Agent": "3D-ULPIN-Cadastral-Engine/2.0 (research@cadastral3d.gov.in)"
}

_OSM_CACHE = {}

def fetch_nominatim_building_polygon(name_or_query: str, lat: float = None, lon: float = None) -> dict | None:
    """
    Fetch exact vector polygon boundary from OpenStreetMap Nominatim API.
    """
    try:
        query = name_or_query
        if lat is not None and lon is not None and not name_or_query:
            query = f"{lat},{lon}"
        if not query:
            return None
        url = f"https://nominatim.openstreetmap.org/search?q={requests.utils.quote(query)}&format=geojson&polygon_geojson=1&limit=3"
        res = requests.get(url, headers=OSM_HEADERS, timeout=8)
        if res.status_code == 200:
            data = res.json()
            for f in data.get("features", []):
                geom = f.get("geometry", {})
                if geom.get("type") in ["Polygon", "MultiPolygon"]:
                    print(f"[OK] Found authoritative vector polygon from Nominatim for '{query}' ({geom.get('type')})")
                    return geom
    except Exception as e:
        print(f"Nominatim vector polygon lookup error: {e}")
    return None

def fetch_osm_building_metadata(lat: float, lon: float, radius: int = 300) -> dict:
    """
    Query OpenStreetMap (Overpass API) to fetch height and floor count for any building
    within `radius` meters of the given lat/lon coordinates.
    """
    cache_key = f"{round(lat, 4)}_{round(lon, 4)}_meta"
    if cache_key in _OSM_CACHE:
        return _OSM_CACHE[cache_key]

    query = f"""
    [out:json][timeout:12];
    (
      way["building"](around:{radius},{lat},{lon});
      relation["building"](around:{radius},{lat},{lon});
      way["building:part"](around:{radius},{lat},{lon});
      relation["building:part"](around:{radius},{lat},{lon});
    );
    out tags;
    """

    for endpoint in OSM_OVERPASS_ENDPOINTS:
        try:
            response = requests.post(endpoint, data={"data": query}, headers=OSM_HEADERS, timeout=8)
            if response.status_code == 200:
                data = response.json()
                elements = data.get("elements", [])
                for element in elements:
                    tags = element.get("tags", {})
                    levels = tags.get("building:levels") or tags.get("levels") or tags.get("building:floors")
                    height = tags.get("height") or tags.get("building:height") or tags.get("height:m")
                    
                    floor_count = None
                    if levels:
                        clean_lvl = str(levels).split(";")[0].split("-")[0].strip()
                        if clean_lvl.isdigit():
                            floor_count = int(clean_lvl)

                    height_meters = None
                    if height:
                        clean_h = str(height).replace("m", "").replace("meters", "").strip()
                        try:
                            height_meters = float(clean_h)
                        except ValueError:
                            pass

                    if floor_count or height_meters:
                        metadata = {
                            "floor_count": floor_count,
                            "height_meters": height_meters,
                            "osm_id": f"{element.get('type')}/{element.get('id')}"
                        }
                        _OSM_CACHE[cache_key] = metadata
                        return metadata
                break
        except Exception:
            continue

    fallback = {"floor_count": None, "height_meters": None, "osm_id": None}
    _OSM_CACHE[cache_key] = fallback
    return fallback


def fetch_osm_building_geometry(lat: float, lon: float, radius: int = 150) -> dict | None:
    """
    Fetch exact building vector polygon footprint from OpenStreetMap Overpass API.
    """
    data = fetch_osm_building_comprehensive(lat, lon, radius=radius)
    if data and data.get("footprint"):
        return data["footprint"]
    return None


def fetch_osm_building_comprehensive(lat: float, lon: float, radius: int = 350, building_name: str = None, osm_id: str = None) -> dict | None:
    """
    Query OpenStreetMap (Overpass API + Nominatim) to fetch complete architectural and cadastral
    building information: footprint polygon, building parts, levels, underground levels,
    heights, roof shapes, materials, landuse, and metadata.
    """
    cache_key = f"{round(lat, 4)}_{round(lon, 4)}_comp_{building_name or ''}_{osm_id or ''}"
    if cache_key in _OSM_CACHE:
        return _OSM_CACHE[cache_key]

    specific_clause = ""
    if osm_id and "/" in osm_id:
        parts = osm_id.split("/")
        if len(parts) == 2 and parts[0] in ["relation", "way", "node"] and parts[1].isdigit():
            specific_clause = f"{parts[0]}({parts[1]}); >;"
    elif osm_id and osm_id.isdigit():
        specific_clause = f"relation({osm_id}); way({osm_id}); >;"

    query = f"""
    [out:json][timeout:15];
    (
      {specific_clause}
      way["building"](around:{radius},{lat},{lon});
      relation["building"](around:{radius},{lat},{lon});
      way["building:part"](around:{radius},{lat},{lon});
      relation["building:part"](around:{radius},{lat},{lon});
      way["historic"](around:{radius},{lat},{lon});
      relation["historic"](around:{radius},{lat},{lon});
      way["tourism"](around:{radius},{lat},{lon});
      relation["tourism"](around:{radius},{lat},{lon});
      way["man_made"](around:{radius},{lat},{lon});
      relation["man_made"](around:{radius},{lat},{lon});
    );
    out body geom;
    """
    payload = None
    for endpoint in OSM_OVERPASS_ENDPOINTS:
        try:
            print(f"Fetching comprehensive OSM data from {endpoint} near [{lat}, {lon}] (osm_id: {osm_id})...")
            response = requests.post(endpoint, data={"data": query}, headers=OSM_HEADERS, timeout=15)
            if response.status_code == 200:
                payload = response.json()
                break
        except Exception as e:
            print(f"Endpoint {endpoint} failed: {e}")

    # Fallback to Nominatim vector polygon if Overpass was slow or returned empty
    nom_geom = None
    if building_name:
        nom_geom = fetch_nominatim_building_polygon(building_name, lat, lon)

    if not payload and not nom_geom:
        return None

    try:
        elements = (payload or {}).get("elements", [])
        if not elements:
            return None

        # Helper to parse float from string with units
        def _parse_float(val):
            if val is None:
                return None
            s = str(val).lower().replace("m", "").replace("meters", "").replace("ft", "").strip()
            try:
                return float(s)
            except ValueError:
                return None

        # Helper to parse integer level
        def _parse_int(val):
            if val is None:
                return None
            s = str(val).split(";")[0].split("-")[0].strip()
            try:
                return int(s)
            except ValueError:
                return None

        # Helper to convert OSM element geometry to GeoJSON Polygon coordinates
        def _elem_to_coords(el):
            geom = el.get("geometry", [])
            if len(geom) >= 3:
                coords = [[round(p["lon"], 7), round(p["lat"], 7)] for p in geom]
                if coords[0] != coords[-1]:
                    coords.append(coords[0])
                return coords
            return None

        building_elements = [e for e in elements if "building" in e.get("tags", {}) and e["tags"]["building"] != "no"]
        part_elements = [e for e in elements if "building:part" in e.get("tags", {}) and e["tags"]["building:part"] != "no"]

        # If no explicit building tag, check all ways with geometry
        if not building_elements and not part_elements:
            building_elements = elements

        main_elem = None

        # If osm_id was specified, find exact matching element first
        target_type, target_num = None, None
        if osm_id and "/" in osm_id:
            target_type, raw_num = osm_id.split("/", 1)
            target_num = int(raw_num) if raw_num.isdigit() else None
        elif osm_id and osm_id.isdigit():
            target_num = int(osm_id)

        if target_num is not None:
            for el in elements:
                if el.get("id") == target_num and (not target_type or el.get("type") == target_type):
                    main_elem = el
                    break

        # If not found by ID, find the main element closest to coordinates
        if not main_elem:
            best_dist = float("inf")
            for el in building_elements:
                coords = _elem_to_coords(el)
                if coords:
                    # Calculate approximate centroid
                    cx = sum(p[0] for p in coords[:-1]) / (len(coords) - 1)
                    cy = sum(p[1] for p in coords[:-1]) / (len(coords) - 1)
                    d = (cx - lon)**2 + (cy - lat)**2
                    if d < best_dist:
                        best_dist = d
                        main_elem = el

        main_footprint = None
        tags = main_elem.get("tags", {}) if main_elem else {}
        main_coords = _elem_to_coords(main_elem) if main_elem else None
        
        if main_coords:
            main_footprint = {
                "type": "Polygon",
                "coordinates": [main_coords]
            }

        if nom_geom:
            nom_vcount = len(nom_geom.get("coordinates", [[]])[0]) if nom_geom.get("type") == "Polygon" else sum(len(p[0]) for p in nom_geom.get("coordinates", []))
            curr_vcount = len(main_coords) if main_coords else 0
            # Only use Nominatim fallback if Overpass returned no valid polygon, or if Nominatim polygon is similarly sized.
            # Do NOT override if Nominatim returned a massive estate polygon (thousands of vertices).
            if curr_vcount < 4 or (nom_vcount > curr_vcount and nom_vcount < curr_vcount * 3):
                main_footprint = nom_geom

        if not main_footprint:
            return None

        # Extract levels & heights
        raw_levels = tags.get("building:levels") or tags.get("levels") or tags.get("building:floors")
        raw_ug = tags.get("building:levels:underground") or tags.get("levels:underground") or tags.get("underground:levels")
        raw_height = tags.get("height") or tags.get("building:height") or tags.get("height:m")
        raw_min_height = tags.get("min_height") or tags.get("building:min_height")
        raw_min_level = tags.get("min_level") or tags.get("building:min_level")

        levels = _parse_int(raw_levels)
        underground_levels = _parse_int(raw_ug) or (1 if tags.get("basement") == "yes" else 0)
        height = _parse_float(raw_height)
        min_height = _parse_float(raw_min_height) or 0.0

        # Floor count logic & Source determination
        is_floor_estimated = False
        if levels and levels > 0:
            floor_count = levels
            floor_source = "OSM building:levels"
        elif height and height > 0:
            floor_count = max(1, round(height / 3.5))
            floor_source = "Calculated from height (3.5m/floor)"
            is_floor_estimated = True
        else:
            # Conservative estimate based on building type
            b_type = tags.get("building", "yes").lower()
            if b_type in ["apartments", "hotel"]:
                floor_count = 5
            elif b_type in ["commercial", "office"]:
                floor_count = 4
            elif b_type in ["house", "residential", "villa"]:
                floor_count = 2
            elif b_type in ["monument", "temple", "church", "cathedral"]:
                floor_count = 2
            else:
                floor_count = 3
            floor_source = f"Estimated from building type ({b_type})"
            is_floor_estimated = True

        if not height or height <= 0:
            height = round(float(floor_count * 3.5), 1)

        # Roof details
        roof_shape = tags.get("roof:shape", "").lower() or None
        roof_height = _parse_float(tags.get("roof:height")) or None
        roof_levels = _parse_int(tags.get("roof:levels")) or None
        roof_material = tags.get("roof:material") or None
        roof_color = tags.get("roof:colour") or tags.get("roof:color") or None

        # Materials & Aesthetics
        building_material = tags.get("building:material") or tags.get("material") or None
        building_color = tags.get("building:colour") or tags.get("colour") or None
        building_name = tags.get("name") or tags.get("name:en") or tags.get("official_name") or None
        
        # Land Use & Class
        landuse = tags.get("landuse") or tags.get("amenity") or tags.get("tourism") or tags.get("historic") or tags.get("building", "General Cadastral")

        # Parse Building Parts & Auxiliary Structures
        parsed_parts = []
        all_part_candidates = []

        # Main building centroid for proximity filtering
        main_cx = sum(p[0] for p in main_coords[:-1]) / (len(main_coords) - 1) if main_coords else lon
        main_cy = sum(p[1] for p in main_coords[:-1]) / (len(main_coords) - 1) if main_coords else lat

        # Filter ALL parts (including explicitly tagged building:parts) by distance 
        # to ensure we don't include parts of neighboring unrelated buildings.
        compound_threshold_deg = 0.00065  # ~65-70 meters
        
        for el in part_elements:
            el_c = _elem_to_coords(el)
            if el_c:
                el_cx = sum(p[0] for p in el_c[:-1]) / (len(el_c) - 1)
                el_cy = sum(p[1] for p in el_c[:-1]) / (len(el_c) - 1)
                dist_sq = (el_cx - main_cx)**2 + (el_cy - main_cy)**2
                # Only include parts within the compound radius
                if dist_sq < (compound_threshold_deg ** 2 * 1.5): # generous radius for massive complexes
                    all_part_candidates.append(el)

        for el in building_elements:
            if el != main_elem and el.get("id") != main_elem.get("id"):
                el_tags = el.get("tags", {})
                b_val = el_tags.get("building", "")
                el_name = el_tags.get("name") or el_tags.get("name:en")
                # Skip if it has a separate distinct name from the main building
                if el_name and building_name and el_name.lower() not in building_name.lower() and building_name.lower() not in el_name.lower():
                    continue

                el_c = _elem_to_coords(el)
                if el_c and b_val not in ["no", ""]:
                    el_cx = sum(p[0] for p in el_c[:-1]) / (len(el_c) - 1)
                    el_cy = sum(p[1] for p in el_c[:-1]) / (len(el_c) - 1)
                    dist_sq = (el_cx - main_cx)**2 + (el_cy - main_cy)**2
                    if dist_sq < (compound_threshold_deg ** 2):
                        all_part_candidates.append(el)

        for idx, part in enumerate(all_part_candidates):
            p_tags = part.get("tags", {})
            p_coords = _elem_to_coords(part)
            if not p_coords:
                continue

            p_h = _parse_float(p_tags.get("height") or p_tags.get("building:height"))
            p_min_h = _parse_float(p_tags.get("min_height") or p_tags.get("building:min_height")) or 0.0
            p_levels = _parse_int(p_tags.get("building:levels") or p_tags.get("levels"))
            p_min_levels = _parse_int(p_tags.get("building:min_level") or p_tags.get("min_level")) or 0
            
            if not p_h:
                if p_levels:
                    p_h = round(float(p_levels * 3.5), 1)
                else:
                    p_h = height

            p_roof_shape = p_tags.get("roof:shape", "").lower() or roof_shape or None
            p_roof_h = _parse_float(p_tags.get("roof:height")) or None
            p_material = p_tags.get("building:material") or p_tags.get("material") or building_material
            p_color = p_tags.get("building:colour") or p_tags.get("colour") or building_color
            p_type = p_tags.get("building:part") or p_tags.get("building") or p_tags.get("man_made") or "generic"

            parsed_parts.append({
                "id": f"part_{idx+1}_{part.get('id', idx)}",
                "part_type": p_type,
                "footprint": {"type": "Polygon", "coordinates": [p_coords]},
                "height": float(p_h),
                "min_height": float(p_min_h),
                "levels": p_levels or max(1, round((p_h - p_min_h) / 3.5)),
                "min_levels": p_min_levels,
                "roof_shape": p_roof_shape,
                "roof_height": p_roof_h,
                "material": p_material,
                "color": p_color,
                "tags": p_tags
            })

        print(f"[OK] Extracted OSM Building: '{building_name or 'Unnamed'}' | Floors: {floor_count} ({floor_source}) | Parts: {len(parsed_parts)}")

        result_dict = {
            "osm_id": f"{main_elem.get('type')}/{main_elem.get('id')}" if main_elem else "osm/custom",
            "building_name": building_name,
            "footprint": main_footprint,
            "height_meters": float(height),
            "floor_count": int(floor_count),
            "underground_floors": int(underground_levels),
            "floor_source": floor_source,
            "is_floor_estimated": is_floor_estimated,
            "roof": {
                "shape": roof_shape,
                "height": roof_height,
                "levels": roof_levels,
                "material": roof_material,
                "color": roof_color
            },
            "building_material": building_material,
            "building_color": building_color,
            "land_use": landuse,
            "building_parts": parsed_parts,
            "raw_osm_data": payload,
            "tags": tags
        }
        _OSM_CACHE[cache_key] = result_dict
        return result_dict

    except Exception as e:
        print(f"Error fetching comprehensive OSM data: {e}")
        return None


