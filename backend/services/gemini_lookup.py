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
    "gemini-flash-latest",
    "gemini-2.5-flash",
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
    api_key = (
        settings.gemini_api_key
        or os.getenv("GEMINI_API_KEY")
        or os.getenv("GOOGLE_API_KEY")
        or ""
    )
    if not api_key:
        logger.error("GEMINI_API_KEY is not set")
        raise RuntimeError("GEMINI_API_KEY is not configured")

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
        "contents": [{"parts": [{"text": prompt}]}],
        "generationConfig": {
            "temperature": 0.1,
            "responseMimeType": "application/json",
        },
    }

    last_error: Optional[str] = None
    async with httpx.AsyncClient(timeout=25.0) as client:
        for model in GEMINI_MODELS:
            url = GEMINI_URL.format(model=model)
            try:
                response = await client.post(
                    url,
                    params={"key": api_key},
                    json=payload,
                    headers={"x-goog-api-key": api_key},
                )
            except httpx.HTTPError as exc:
                last_error = str(exc)
                logger.warning("Gemini request failed for %s: %s", model, exc)
                continue

            if response.status_code != 200:
                last_error = f"{model} HTTP {response.status_code}: {response.text[:240]}"
                logger.warning("Gemini %s: %s", model, last_error)
                continue

            try:
                result = response.json()
                text = result["candidates"][0]["content"]["parts"][0]["text"]
            except (KeyError, IndexError, TypeError) as exc:
                last_error = str(exc)
                continue

            parsed = _extract_json(text)
            if not parsed:
                continue
            normalized = _normalize(parsed, city)
            if normalized:
                return normalized
            return None

    logger.warning("Gemini lookup failed: %s", last_error)
    return None
