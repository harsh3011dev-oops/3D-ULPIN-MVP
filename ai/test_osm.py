import requests

# Willis Tower, Chicago (Latitude: 41.8789, Longitude: -87.6359)
lat, lon = 41.8789, -87.6359
delta = 0.002

min_lat = lat - delta
max_lat = lat + delta
min_lon = lon - delta
max_lon = lon + delta

query = f"""
[out:json][timeout:10];
way["building:levels"]({min_lat},{min_lon},{max_lat},{max_lon});
out tags;
"""

try:
    url = "https://overpass.kumi.systems/api/interpreter"
    res = requests.post(url, data={"data": query}, timeout=10)
    print("HTTP Status Code:", res.status_code)
    data = res.json()
    elements = data.get("elements", [])
    print(f"Elements found with building:levels: {len(elements)}")
    for el in elements:
        print(" -> Tags:", el.get("tags"))
except Exception as e:
    print("Error:", e)
