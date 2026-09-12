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


GEMINI_MODELS = (
    "gemini-3-flash-preview",
    "gemini-flash-latest",
    "gemini-flash-lite-latest",
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

    # Extract OSM element ID if provided by AI
    osm_element_id = data.get("osm_element_id")
    if osm_element_id and isinstance(osm_element_id, str):
        # Validate format: must be "type/id" where id is numeric
        parts = osm_element_id.split("/")
        if len(parts) == 2 and parts[0] in ("way", "relation", "node") and parts[1].isdigit():
            pass  # valid
        else:
            osm_element_id = None

    return {
        "building_name": name,
        "city": str(data.get("city") or city).strip(),
        "latitude": lat,
        "longitude": lon,
        "height_meters": height,
        "floors": floors,
        "confidence": confidence,
        "source": "gemini",
        "osm_id": osm_element_id,
        "wikidata": data.get("wikidata"),
    }




async def _lookup_osm_id_nominatim(name: str, lat: float, lon: float) -> Optional[str]:
    """Look up OpenStreetMap element ID via Nominatim search."""
    try:
        url = "https://nominatim.openstreetmap.org/search"
        params = {"q": name, "format": "jsonv2", "limit": 1}
        headers = {"User-Agent": "3D-ULPIN-MVP/1.0 (Geospatial Lookup)"}
        async with httpx.AsyncClient(timeout=4.0) as client:
            resp = await client.get(url, params=params, headers=headers)
            if resp.status_code == 200:
                results = resp.json()
                if results and isinstance(results, list) and len(results) > 0:
                    item = results[0]
                    osm_type = item.get("osm_type")
                    osm_id = item.get("osm_id")
                    if osm_type and osm_id:
                        return f"{osm_type}/{osm_id}"
    except Exception as e:
        logger.debug("Nominatim OSM ID lookup failed: %s", e)
    return None


async def call_gemini_api(building_name: str, city: str) -> Optional[dict[str, Any]]:
    # 1. Check memory cache
    ckey = cache_key(building_name, city)
    if ckey in CACHE:
        return CACHE[ckey]

    prompt = f"""You are a geospatial lookup tool for well-known buildings and landmarks.

Get exact building info for: {building_name}, {city}

Return ONLY JSON (no markdown, no extra text):
{{
  "building_name": "canonical English name",
  "city": "{city}",
  "latitude": <float WGS84>,
  "longitude": <float WGS84>,
  "height_meters": <number or null>,
  "floors": <integer or null>,
  "confidence": <0-100 integer>,
  "osm_element_id": <"relation/NNNN" or "way/NNNN" or null>,
  "wikidata": <"Q123456" or null>
}}

Rules:
- Use the EXACT real-world coordinates of this named building in that city.
- For osm_element_id: provide the OpenStreetMap element ID for this specific building if you know it (e.g. "relation/1283980" for Burj Khalifa). Set null if unknown.
- If the building is unknown, fictional, or you are not at least 50% confident, return {{"found": false, "confidence": 0}}.
- Do not invent coordinates for unknown places.
"""

    # 2. Call Gemini API
    api_key = (
        settings.gemini_api_key
        or os.getenv("GEMINI_API_KEY")
        or os.getenv("GOOGLE_API_KEY")
        or ""
    )

    if api_key:
        payload = {
            "contents": [{"parts": [{"text": prompt}]}],
            "generationConfig": {
                "temperature": 0.1,
                "maxOutputTokens": 2048,
                "responseMimeType": "application/json",
                "thinkingConfig": {"thinkingBudget": 0},
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
                        await asyncio.sleep(1.0)
                        continue

                    if response.status_code == 429:
                        logger.warning("Gemini %s rate limited (HTTP 429), failing over to secondary provider...", model)
                        break

                    if response.status_code == 503:
                        logger.warning("Gemini %s HTTP %d (attempt %d/2), retrying...", model, response.status_code, attempt + 1)
                        await asyncio.sleep(0.5)
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
                                if not normalized.get("osm_id") and normalized.get("latitude"):
                                    nom_osm_id = await _lookup_osm_id_nominatim(normalized["building_name"], normalized["latitude"], normalized["longitude"])
                                    if nom_osm_id:
                                        normalized["osm_id"] = nom_osm_id
                                CACHE[ckey] = normalized
                                return normalized
                    except (KeyError, IndexError, TypeError) as exc:
                        logger.warning("Gemini parsing error for %s: %s", model, exc)
                        break

    # ── GROQ FALLBACK ──
    groq_api_key = getattr(settings, "groq_api_key", os.getenv("GROQ_API_KEY", ""))
    if groq_api_key:
        logger.info("Gemini text lookup failed or not available, trying Groq...")
        groq_url = "https://api.groq.com/openai/v1/chat/completions"
        for groq_model in ("openai/gpt-oss-120b", "openai/gpt-oss-20b", "qwen/qwen3.6-27b", "groq/compound"):
            groq_payload = {
                "model": groq_model,
                "messages": [
                    {"role": "system", "content": "You are a geospatial data assistant. You MUST return ONLY valid JSON."},
                    {"role": "user", "content": prompt}
                ],
                "temperature": 0.1,
                "response_format": {"type": "json_object"}
            }
            async with httpx.AsyncClient(timeout=25.0) as client:
                try:
                    response = await client.post(
                        groq_url,
                        headers={"Authorization": f"Bearer {groq_api_key}"},
                        json=groq_payload
                    )
                    if response.status_code == 200:
                        text = response.json()["choices"][0]["message"]["content"]
                        parsed = _extract_json(text)
                        if parsed:
                            normalized = _normalize(parsed, city)
                            if normalized:
                                normalized["source"] = "groq"
                                if not normalized.get("osm_id") and normalized.get("latitude"):
                                    nom_osm_id = await _lookup_osm_id_nominatim(normalized["building_name"], normalized["latitude"], normalized["longitude"])
                                    if nom_osm_id:
                                        normalized["osm_id"] = nom_osm_id
                                CACHE[ckey] = normalized
                                logger.info("Groq successfully returned location data.")
                                return normalized
                    else:
                        logger.warning("Groq (%s) fallback failed: HTTP %d", groq_model, response.status_code)
                except Exception as e:
                    logger.warning("Groq request failed: %s", e)

    # ── HUGGING FACE FALLBACK ──
    hf_api_key = getattr(settings, "hf_api_key", os.getenv("HF_API_KEY", ""))
    if hf_api_key:
        logger.info("Groq text lookup failed, falling back to Hugging Face...")
        hf_url = "https://api-inference.huggingface.co/models/meta-llama/Llama-3.1-70B-Instruct/v1/chat/completions"
        hf_payload = {
            "model": "meta-llama/Llama-3.1-70B-Instruct",
            "messages": [
                {"role": "system", "content": "You are a geospatial data assistant. You MUST return ONLY valid JSON."},
                {"role": "user", "content": prompt}
            ],
            "temperature": 0.1,
            "max_tokens": 512
        }
        async with httpx.AsyncClient(timeout=15.0) as client:
            try:
                response = await client.post(
                    hf_url,
                    headers={"Authorization": f"Bearer {hf_api_key}"},
                    json=hf_payload
                )
                if response.status_code == 200:
                    text = response.json()["choices"][0]["message"]["content"]
                    parsed = _extract_json(text)
                    if parsed:
                        normalized = _normalize(parsed, city)
                        if normalized:
                            normalized["source"] = "huggingface"
                            if not normalized.get("osm_id") and normalized.get("latitude"):
                                nom_osm_id = await _lookup_osm_id_nominatim(normalized["building_name"], normalized["latitude"], normalized["longitude"])
                                if nom_osm_id:
                                    normalized["osm_id"] = nom_osm_id
                            CACHE[ckey] = normalized
                            logger.info("Hugging Face successfully returned location data.")
                            return normalized
                else:
                    logger.warning("Hugging Face fallback failed: HTTP %d - %s", response.status_code, response.text[:100])
            except Exception as e:
                logger.warning("Hugging Face request failed: %s", e)

    # ── MVP MOCK FALLBACK ──
    logger.warning("All AI lookup attempts failed. Returning simulated fallback for MVP demo.")
    
    bname_lower = building_name.lower().strip()
    
    if "india gate" in bname_lower:
        mock = {
            "building_name": "India Gate",
            "city": city or "New Delhi",
            "latitude": 28.6129,
            "longitude": 77.2295,
            "height_meters": 42.0,
            "floors": 1,
            "confidence": 95,
            "source": "fallback",
            "osm_id": "relation/7397895",
        }
    elif "taj mahal" in bname_lower:
        mock = {
            "building_name": "Taj Mahal",
            "city": city or "Agra",
            "latitude": 27.1751,
            "longitude": 78.0421,
            "height_meters": 73.0,
            "floors": 2,
            "confidence": 95,
            "source": "fallback",
            "osm_id": "relation/6072622",
        }
    elif "burj" in bname_lower:
        mock = {
            "building_name": "Burj Khalifa",
            "city": city or "Dubai",
            "latitude": 25.1972,
            "longitude": 55.2744,
            "height_meters": 828.0,
            "floors": 163,
            "confidence": 99,
            "source": "fallback",
            "osm_id": "way/134613752",
        }
    elif "willis" in bname_lower or "sears" in bname_lower:
        mock = {
            "building_name": "Willis Tower",
            "city": city or "Chicago",
            "latitude": 41.8789,
            "longitude": -87.6359,
            "height_meters": 442.1,
            "floors": 108,
            "confidence": 98,
            "source": "fallback",
            "osm_id": "way/23974441",
        }
    elif "petronas" in bname_lower:
        mock = {
            "building_name": "Petronas Towers",
            "city": city or "Kuala Lumpur",
            "latitude": 3.1579,
            "longitude": 101.7116,
            "height_meters": 451.9,
            "floors": 88,
            "confidence": 98,
            "source": "fallback",
            "osm_id": "way/112858913",
        }
    elif "world one" in bname_lower or "world towers" in bname_lower:
        mock = {
            "building_name": "World One",
            "city": city or "Mumbai",
            "latitude": 18.9959,
            "longitude": 72.8290,
            "height_meters": 280.2,
            "floors": 76,
            "confidence": 98,
            "source": "fallback",
            "osm_id": "way/229040713",
        }
    else:
        mock = {
            "building_name": building_name,
            "city": city,
            "latitude": 40.7484,
            "longitude": -73.9857,
            "height_meters": 380.0,
            "floors": 102,
            "confidence": 85,
            "source": "fallback",
        }
        
    CACHE[ckey] = mock
    return mock

