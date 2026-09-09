import re

with open("backend/services/gemini_lookup.py", "r") as f:
    content = f.read()

# Remove FAMOUS_LANDMARKS dictionary
content = re.sub(r"# ── Famous Landmark Catalog Fallback.*?FAMOUS_LANDMARKS: dict\[str, dict\[str, Any\]\] = \{.*?\n\}\n", "", content, flags=re.DOTALL)

# Remove the fallback default values in _normalize
content = content.replace('"height_meters": height or 45.0,', '"height_meters": height,')
content = content.replace('"floors": floors or 10,', '"floors": floors,')

# Remove _lookup_nominatim function entirely
content = re.sub(r"async def _lookup_nominatim.*?return None\n", "", content, flags=re.DOTALL)

# Remove the curated catalog check in call_gemini_api
curated_check = """    # 1. Check curated catalog first
    clean_name = building_name.strip().lower()
    for key, data in FAMOUS_LANDMARKS.items():
        if key in clean_name or clean_name in key:
            logger.info("Found landmark '%s' in curated catalog", key)
            return dict(data)

"""
content = content.replace(curated_check, "")

# Remove the nominatim fallback check in call_gemini_api
nominatim_fallback = """    # 4. Fallback to OpenStreetMap Nominatim geocoding
    nominatim_result = await _lookup_nominatim(building_name, city)
    if nominatim_result:
        CACHE[ckey] = nominatim_result
        return nominatim_result
"""
content = content.replace(nominatim_fallback, "")

# Update the comment numbers
content = content.replace("# 2. Check memory cache", "# 1. Check memory cache")
content = content.replace("# 3. Call Gemini API", "# 2. Call Gemini API")

with open("backend/services/gemini_lookup.py", "w") as f:
    f.write(content)

