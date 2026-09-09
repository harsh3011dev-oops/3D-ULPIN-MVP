import base64
import json
import logging
import asyncio
import httpx
import os
import re

from typing import Optional, Dict, Any

logger = logging.getLogger(__name__)

# Same model configuration used in gemini_lookup.py
GEMINI_MODELS = (
    "gemini-3.6-flash",
    "gemini-2.5-flash",
    "gemini-2.0-flash",
    "gemini-1.5-flash",
)
GEMINI_URL = "https://generativelanguage.googleapis.com/v1beta/models/{model}:generateContent"


def _extract_json(text: str) -> Optional[dict]:
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
        return data if isinstance(data, dict) else None
    except json.JSONDecodeError:
        return None


def get_api_key() -> str:
    # Try importing settings, fallback to os.environ
    try:
        from backend.config import settings
        return settings.gemini_api_key or os.getenv("GEMINI_API_KEY") or ""
    except ImportError:
        return os.getenv("GEMINI_API_KEY") or ""


async def analyze_building_image(image_path: str) -> Optional[Dict[str, Any]]:
    """
    Sends a satellite image to Gemini Vision to extract building footprint pixels
    and other metadata like estimated floors, roof shape, and material.
    """
    api_key = get_api_key()
    if not api_key:
        logger.error("No Gemini API key found for vision analysis.")
        return None

    if not os.path.exists(image_path):
        logger.error(f"Image not found: {image_path}")
        return None

    try:
        with open(image_path, "rb") as f:
            img_data = f.read()
            b64_image = base64.b64encode(img_data).decode("utf-8")
    except Exception as e:
        logger.error(f"Failed to read image {image_path}: {e}")
        return None

    # We need to know the image dimensions so Gemini can return scaled coordinates
    import cv2
    img = cv2.imread(image_path)
    if img is None:
        return None
    height, width = img.shape[:2]

    prompt = f"""You are a geospatial AI expert analyzing satellite imagery. 
Look at this satellite image of a building. The image is {width} pixels wide and {height} pixels tall.
Identify the main building in the center of the image.

Return ONLY a JSON object (no markdown, no other text) with the following exact keys:
1. "footprint_pixels": A list of [x, y] coordinates forming the polygon outline of the building's footprint. The x values must be between 0 and {width}, and y values between 0 and {height}.
2. "estimated_floors": Your best estimate of the number of floors based on shadows/context (integer).
3. "roof_shape": The shape of the roof (e.g., "flat", "gabled", "hipped", "complex").
4. "building_color": The dominant color of the building's roof.
5. "building_material": The apparent construction material (e.g., "concrete", "metal", "tile").
6. "confidence": An integer from 0 to 100 indicating your confidence in the footprint outline.

If you cannot identify a building, return {{"confidence": 0, "footprint_pixels": []}}.
"""

    payload = {
        "contents": [
            {
                "parts": [
                    {"text": prompt},
                    {
                        "inlineData": {
                            "mimeType": "image/jpeg",
                            "data": b64_image
                        }
                    }
                ]
            }
        ],
        "generationConfig": {
            "temperature": 0.1,
            "responseMimeType": "application/json",
        },
    }

    async with httpx.AsyncClient(timeout=45.0) as client:
        for model in GEMINI_MODELS:
            url = GEMINI_URL.format(model=model)
            for attempt in range(4):
                try:
                    response = await client.post(
                        url,
                        params={"key": api_key},
                        json=payload,
                        headers={"x-goog-api-key": api_key},
                    )
                except httpx.HTTPError as exc:
                    logger.warning("Gemini Vision HTTP error for %s: %s", model, exc)
                    await asyncio.sleep(2.0 ** attempt)
                    continue

                if response.status_code in (503, 429):
                    logger.warning("Gemini Vision %s HTTP %d (attempt %d/4), retrying...", model, response.status_code, attempt + 1)
                    await asyncio.sleep(2.0 ** attempt)
                    continue

                if response.status_code != 200:
                    logger.warning("Gemini Vision %s HTTP %d: %s", model, response.status_code, response.text[:200])
                    break

                try:
                    result = response.json()
                    text = result["candidates"][0]["content"]["parts"][0]["text"]
                    parsed = _extract_json(text)
                    if parsed and "footprint_pixels" in parsed:
                        logger.info(f"Successfully extracted building info from Gemini Vision (confidence: {parsed.get('confidence', 0)}).")
                        return parsed
                    else:
                        logger.warning("Gemini Vision response didn't contain expected JSON.")
                        return None
                except (KeyError, IndexError, TypeError) as exc:
                    logger.warning("Gemini Vision parsing error for %s: %s", model, exc)
                    break
    
    return None
