"""Look up famous-building coordinates, height, and floors via Gemini."""

from __future__ import annotations

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
    "gemini-3.6-flash",
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
    if confidence < 70:
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
        "height_meters": height,
        "floors": floors,
        "confidence": confidence,
        "source": "gemini",
    }


async def call_gemini_api(building_name: str, city: str) -> Optional[dict[str, Any]]:
    # Changed to use Groq instead of Gemini due to timeouts
    api_key = os.getenv("GROQ_API_KEY")
    if not api_key:
        logger.error("GROQ_API_KEY is not set")
        return None

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
- If the building is unknown, fictional, or you are not at least 70% confident, return {{"found": false, "confidence": 0}}.
- Do not invent coordinates for unknown places.
"""

    payload = {
        "model": "qwen/qwen3.8-27b",
        "messages": [
            {"role": "system", "content": "You output JSON only."},
            {"role": "user", "content": prompt}
        ],
        "response_format": {"type": "json_object"},
        "temperature": 0.1,
    }

    last_error: Optional[str] = None
    import asyncio

    async with httpx.AsyncClient(timeout=25.0) as client:
        url = "https://api.groq.com/openai/v1/chat/completions"
        for attempt in range(3):
            try:
                response = await client.post(
                    url,
                    json=payload,
                    headers={
                        "Authorization": f"Bearer {api_key}",
                        "Content-Type": "application/json"
                    },
                )
            except Exception as exc:
                last_error = repr(exc)
                logger.warning("Groq request failed: %r", exc)
                break 
            
            if response.status_code == 429:
                logger.warning("Groq rate limited, retrying in 2s...")
                await asyncio.sleep(2.0)
                continue
                
            if response.status_code != 200:
                last_error = f"HTTP {response.status_code}: {response.text[:240]}"
                logger.warning("Groq error: %s", last_error)
                break

            try:
                result = response.json()
                text = result["choices"][0]["message"]["content"]
            except (KeyError, IndexError, TypeError) as exc:
                last_error = str(exc)
                break

            parsed = _extract_json(text)
            if not parsed:
                break
            normalized = _normalize(parsed, city)
            if normalized:
                normalized["source"] = "groq"
                return normalized
            return None

    logger.warning("Groq lookup failed: %s", last_error)
    return None
