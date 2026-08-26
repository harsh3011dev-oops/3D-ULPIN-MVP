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


def fetch_osm_building_metadata(lat: float, lon: float, radius: int = 300) -> dict:
    """
    Query OpenStreetMap (Overpass API) to fetch height and floor count for any building
    within `radius` meters of the given lat/lon coordinates.

    Args:
        lat (float): Latitude of center.
        lon (float): Longitude of center.
        radius (int): Search radius in meters (default 300m).

    Returns:
        dict: Fetched metadata containing floor_count, height_meters, osm_id.
    """
    url = "https://overpass-api.de/api/interpreter"

    query = f"""
    [out:json][timeout:15];
    nwr(around:{radius},{lat},{lon});
    out tags;
    """

    try:
        print(f"Querying OpenStreetMap Overpass API for building metadata near [{lat}, {lon}]...")
        response = requests.post(url, data={"data": query}, timeout=15)
        
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
                    print(f"FOUND OSM building metadata: {metadata}")
                    return metadata

        print("No building height/floor metadata found on OpenStreetMap.")
        return {"floor_count": None, "height_meters": None, "osm_id": None}

    except Exception as e:
        print(f"Failed to query OpenStreetMap API: {e}")
        return {"floor_count": None, "height_meters": None, "osm_id": None}
