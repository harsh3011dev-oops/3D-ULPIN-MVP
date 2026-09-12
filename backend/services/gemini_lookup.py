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

    # ── UNIVERSAL DYNAMIC GEOSPATIAL RESOLUTION FALLBACK ──
    logger.info("AI LLM lookup unconfigured or exhausted. Resolving dynamically via OpenStreetMap Nominatim...")
    
    query = f"{building_name.strip()}, {city.strip()}" if city and city.lower() not in building_name.lower() else building_name.strip()
    
    try:
        url = "https://nominatim.openstreetmap.org/search"
        params = {
            "q": query,
            "format": "jsonv2",
            "addressdetails": 1,
            "extratags": 1,
            "limit": 3,
        }
        headers = {"User-Agent": "3D-ULPIN-Universal-Landmark-Engine/2.0 (geospatial-lookup)"}
        async with httpx.AsyncClient(timeout=6.0) as client:
            resp = await client.get(url, params=params, headers=headers)
            if resp.status_code == 200:
                results = resp.json()
                if results and isinstance(results, list) and len(results) > 0:
                    best = results[0]
                    lat = float(best.get("lat", 0))
                    lon = float(best.get("lon", 0))
                    osm_type = best.get("osm_type")
                    osm_id = best.get("osm_id")
                    
                    if lat != 0 and lon != 0:
                        osm_el_id = f"{osm_type}/{osm_id}" if osm_type and osm_id else None
                        
                        # Extract height / floors from extratags if present
                        extratags = best.get("extratags") or {}
                        h_tag = extratags.get("height") or extratags.get("building:height")
                        lvl_tag = extratags.get("building:levels") or extratags.get("levels")
                        
                        height_m = None
                        if h_tag:
                            try:
                                height_m = float(re.sub(r"[^\d.]", "", str(h_tag)))
                            except ValueError:
                                pass
                                
                        floors = None
                        if lvl_tag:
                            try:
                                floors = int(re.sub(r"[^\d]", "", str(lvl_tag)))
                            except ValueError:
                                pass
                                
                        dynamic_result = {
                            "building_name": best.get("name") or building_name,
                            "city": city or (best.get("address", {}).get("city") or best.get("address", {}).get("state") or ""),
                            "latitude": lat,
                            "longitude": lon,
                            "height_meters": height_m,
                            "floors": floors,
                            "confidence": 92 if osm_el_id else 80,
                            "source": "osm_nominatim",
                            "osm_id": osm_el_id,
                            "wikidata": extratags.get("wikidata"),
                        }
                        CACHE[ckey] = dynamic_result
                        return dynamic_result
    except Exception as e:
        logger.warning("Dynamic Nominatim fallback error: %s", e)

    return None


