"""Look up famous-building coordinates, height, and floors via Gemini with robust fallback handling."""

from __future__ import annotations

import asyncio
import json
import logging
import os
import re
from typing import Any, Optional

import httpx

from backend.config import settings

logger = logging.getLogger(__name__)

CACHE: dict[str, dict[str, Any]] = {}

# ── Famous Landmark Catalog Fallback ──────────────────────────────────────────
FAMOUS_LANDMARKS: dict[str, dict[str, Any]] = {
    "burj khalifa": {
        "building_name": "Burj Khalifa",
        "city": "Dubai",
        "latitude": 25.197197,
        "longitude": 55.274376,
        "height_meters": 828.0,
        "floors": 163,
        "confidence": 100,
        "source": "curated_catalog",
    },
    "taj mahal": {
        "building_name": "Taj Mahal",
        "city": "Agra",
        "latitude": 27.1751,
        "longitude": 78.0421,
        "height_meters": 73.0,
        "floors": 5,
        "confidence": 100,
        "source": "curated_catalog",
    },
    "eiffel tower": {
        "building_name": "Eiffel Tower",
        "city": "Paris",
        "latitude": 48.8584,
        "longitude": 2.2945,
        "height_meters": 330.0,
        "floors": 3,
        "confidence": 100,
        "source": "curated_catalog",
    },
    "empire state building": {
        "building_name": "Empire State Building",
        "city": "New York",
        "latitude": 40.7484,
        "longitude": -73.9857,
        "height_meters": 381.0,
        "floors": 102,
        "confidence": 100,
        "source": "curated_catalog",
    },
    "statue of liberty": {
        "building_name": "Statue of Liberty",
        "city": "New York",
        "latitude": 40.6892,
        "longitude": -74.0445,
        "height_meters": 93.0,
        "floors": 2,
        "confidence": 100,
        "source": "curated_catalog",
    },
    "petronas towers": {
        "building_name": "Petronas Twin Towers",
        "city": "Kuala Lumpur",
        "latitude": 3.1579,
        "longitude": 101.7116,
        "height_meters": 452.0,
        "floors": 88,
        "confidence": 100,
        "source": "curated_catalog",
    },
    "shanghai tower": {
        "building_name": "Shanghai Tower",
        "city": "Shanghai",
        "latitude": 31.2335,
        "longitude": 121.5056,
        "height_meters": 632.0,
        "floors": 128,
        "confidence": 100,
        "source": "curated_catalog",
    },
    "taipei 101": {
        "building_name": "Taipei 101",
        "city": "Taipei",
        "latitude": 25.0339,
        "longitude": 121.5645,
        "height_meters": 508.0,
        "floors": 101,
        "confidence": 100,
        "source": "curated_catalog",
    },
    "india gate": {
        "building_name": "India Gate",
        "city": "New Delhi",
        "latitude": 28.6129,
        "longitude": 77.2295,
        "height_meters": 42.0,
        "floors": 1,
        "confidence": 100,
        "source": "curated_catalog",
    },
    "cyber hub": {
        "building_name": "DLF Cyber Hub",
        "city": "Gurugram",
        "latitude": 28.4950,
        "longitude": 77.0895,
        "height_meters": 45.0,
        "floors": 10,
        "confidence": 100,
        "source": "curated_catalog",
    },
    "qutub minar": {
        "building_name": "Qutub Minar",
        "city": "New Delhi",
        "latitude": 28.5245,
        "longitude": 77.1855,
        "height_meters": 73.0,
        "floors": 5,
        "confidence": 100,
        "source": "curated_catalog",
    },
    "big ben": {
        "building_name": "Big Ben",
        "city": "London",
        "latitude": 51.5007,
        "longitude": -0.1246,
        "height_meters": 96.0,
        "floors": 11,
        "confidence": 100,
        "source": "curated_catalog",
    },
}

GEMINI_MODELS = (
    "gemini-3.6-flash",
    "gemini-2.5-flash",
    "gemini-2.0-flash",
    "gemini-1.5-flash",
)

GEMINI_URL = "https://generativelanguage.googleapis.com/v1beta/models/{model}:generateContent"


def cache_key(building_name: str, city: str) -> str:
    return f"{building_name.strip()}_{city.strip()}".lower()


def _extract_json(text: str) -> Optional[dict[str, Any]]:
    if not text:
        return None
    cleaned = text.strip()
    if cleaned.startswith("```"):
        cleaned = re.sub(r"^```(?:json)?\s*", "", cleaned)
        cleaned = re.sub(r"\s*```$", "", cleaned)
    match = re.search(r"\{.*\}", cleaned, re.DOTALL)
    if not match:
        return None
    try:
        data = json.loads(match.group())
    except json.JSONDecodeError:
        return None
    return data if isinstance(data, dict) else None


def _normalize(data: dict[str, Any], city: str) -> Optional[dict[str, Any]]:
    if data.get("found") is False or data.get("not_found") is True:
        return None

    confidence = data.get("confidence", 0)
    try:
        confidence = int(float(confidence))
    except (TypeError, ValueError):
        confidence = 0
    if confidence < 50:
        return None

    try:
        lat = float(data["latitude"])
        lon = float(data["longitude"])
    except (KeyError, TypeError, ValueError):
        return None
    if not (-90 <= lat <= 90 and -180 <= lon <= 180):
        return None

    height = data.get("height_meters")
    floors = data.get("floors")
    try:
        height = None if height is None else float(height)
    except (TypeError, ValueError):
        height = None
    try:
        floors = None if floors is None else int(floors)
    except (TypeError, ValueError):
        floors = None

    name = str(data.get("building_name") or "").strip()
    if not name:
        return None

    return {
        "building_name": name,
        "city": str(data.get("city") or city).strip(),
        "latitude": lat,
        "longitude": lon,
        "height_meters": height or 45.0,
        "floors": floors or 10,
        "confidence": confidence,
        "source": "gemini",
    }


async def _lookup_nominatim(building_name: str, city: str) -> Optional[dict[str, Any]]:
    """Fallback to OpenStreetMap Nominatim geocoding API."""
    headers = {"User-Agent": "3D-ULPIN-MVP/1.0 (contact@3d-ulpin.dev)"}
    url = "https://nominatim.openstreetmap.org/search"
    query = f"{building_name}, {city}"
    try:
        async with httpx.AsyncClient(timeout=8.0) as client:
            response = await client.get(
                url,
                params={"q": query, "format": "json", "limit": 1},
                headers=headers,
            )
            if response.status_code == 200:
                data = response.json()
                if data and isinstance(data, list) and len(data) > 0:
                    item = data[0]
                    lat = float(item["lat"])
                    lon = float(item["lon"])
                    display_name = item.get("display_name", building_name)
                    logger.info("Nominatim fallback found coordinates for %s: (%f, %f)", query, lat, lon)
                    return {
                        "building_name": building_name,
                        "city": city,
                        "latitude": lat,
                        "longitude": lon,
                        "height_meters": 50.0,
                        "floors": 12,
                        "confidence": 85,
                        "source": "nominatim_geocoding",
                    }
    except Exception as exc:
        logger.warning("Nominatim lookup failed for %s: %s", query, exc)
    return None


async def call_gemini_api(building_name: str, city: str) -> Optional[dict[str, Any]]:
    # 1. Check curated catalog first
    clean_name = building_name.strip().lower()
    for key, data in FAMOUS_LANDMARKS.items():
        if key in clean_name or clean_name in key:
            logger.info("Found landmark '%s' in curated catalog", key)
            return dict(data)

    # 2. Check memory cache
    ckey = cache_key(building_name, city)
    if ckey in CACHE:
        return CACHE[ckey]

    # 3. Call Gemini API
    api_key = (
        settings.gemini_api_key
        or os.getenv("GEMINI_API_KEY")
        or os.getenv("GOOGLE_API_KEY")
        or ""
    )

    if api_key:
        prompt = f"""You are a geospatial lookup tool for well-known buildings.

Get exact building info for: {building_name}, {city}

Return ONLY JSON (no markdown, no extra text):
{{
  "building_name": "canonical English name",
  "city": "{city}",
  "latitude": <float WGS84>,
  "longitude": <float WGS84>,
  "height_meters": <number or null>,
  "floors": <integer or null>,
  "confidence": <0-100 integer>
}}

Rules:
- Use the real-world location of this named building in that city.
- If the building is unknown, fictional, or you are not at least 50% confident, return {{"found": false, "confidence": 0}}.
- Do not invent coordinates for unknown places.
"""

        payload = {
            "contents": [{"parts": [{"text": prompt}]}],
            "generationConfig": {
                "temperature": 0.1,
                "responseMimeType": "application/json",
            },
        }

        async with httpx.AsyncClient(timeout=15.0) as client:
            for model in GEMINI_MODELS:
                url = GEMINI_URL.format(model=model)
                for attempt in range(2):
                    try:
                        response = await client.post(
                            url,
                            params={"key": api_key},
                            json=payload,
                            headers={"x-goog-api-key": api_key},
                        )
                    except httpx.HTTPError as exc:
                        logger.warning("Gemini HTTP error for %s: %s", model, exc)
                        break

                    if response.status_code == 503 or response.status_code == 429:
                        logger.warning("Gemini %s HTTP %d, retrying...", model, response.status_code)
                        await asyncio.sleep(1.0)
                        continue

                    if response.status_code != 200:
                        logger.warning("Gemini %s HTTP %d: %s", model, response.status_code, response.text[:200])
                        break

                    try:
                        result = response.json()
                        text = result["candidates"][0]["content"]["parts"][0]["text"]
                        parsed = _extract_json(text)
                        if parsed:
                            normalized = _normalize(parsed, city)
                            if normalized:
                                CACHE[ckey] = normalized
                                return normalized
                    except (KeyError, IndexError, TypeError) as exc:
                        logger.warning("Gemini parsing error for %s: %s", model, exc)
                        break

    # 4. Fallback to OpenStreetMap Nominatim geocoding
    nominatim_result = await _lookup_nominatim(building_name, city)
    if nominatim_result:
        CACHE[ckey] = nominatim_result
        return nominatim_result

    return None

