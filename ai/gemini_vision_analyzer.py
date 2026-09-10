"""
Gemini Vision Analyzer — 3D ULPIN AI Pipeline
Sends the downloaded satellite image to Google Gemini to visually extract:
- Building footprint (pixel coordinates)
- Estimated floor count & height (from shadows/context)
- Roof shape (dome, hipped, gabled, flat, pyramidal, mansard, etc.)
- Building color & facade material (concrete, glass, marble, sandstone, brick, metal)
- Architectural form & symmetry
- Vision confidence score (0-100)
"""

import asyncio
import base64
import json
import logging
import os
import re
from typing import Any, Dict, Optional

import cv2
import httpx

logger = logging.getLogger(__name__)

# Valid production Gemini models in prioritized order
GEMINI_MODELS = (
    "gemini-2.5-flash",
    "gemini-2.0-flash",
    "gemini-1.5-flash",
)
GEMINI_URL = "https://generativelanguage.googleapis.com/v1beta/models/{model}:generateContent"


def _get_api_key() -> str:
    try:
        from backend.config import settings
        return settings.gemini_api_key or os.getenv("GEMINI_API_KEY") or ""
    except ImportError:
        return os.getenv("GEMINI_API_KEY") or ""


def _extract_json(text: str) -> Optional[dict]:
    """Robustly extract JSON object from model output that may contain markdown code fences."""
    if not text:
        return None
    cleaned = text.strip()
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


async def analyze_building_image(image_path: str) -> Optional[Dict[str, Any]]:
    """
    Sends a satellite image to Gemini Vision to visually extract:
    - footprint_pixels: list of [x, y] pixel coordinates
    - estimated_floors: int
    - roof_shape: str (flat, gabled, hipped, dome, pyramidal, mansard, complex)
    - building_color: str
    - building_material: str (concrete, glass, marble, sandstone, brick, metal)
    - architectural_form: str (central_mass, tower, podium, wings, courtyard)
    - symmetry: str (radial, bilateral, asymmetric)
    - confidence: int (0-100)
    """
    api_key = _get_api_key()
    if not api_key:
        logger.warning("Gemini Vision: No API key found — skipping vision analysis.")
        return None

    if not os.path.exists(image_path):
        logger.warning("Gemini Vision: Image not found at %s", image_path)
        return None

    # Read and encode image
    try:
        with open(image_path, "rb") as f:
            b64_image = base64.b64encode(f.read()).decode("utf-8")
    except Exception as e:
        logger.warning("Gemini Vision: Failed to read image: %s", e)
        return None

    # Get image dimensions for pixel coordinate context
    img = cv2.imread(image_path)
    if img is None:
        logger.warning("Gemini Vision: cv2 could not read image.")
        return None
    img_h, img_w = img.shape[:2]

    # Determine MIME type from extension
    ext = os.path.splitext(image_path)[1].lower()
    mime_type = "image/png" if ext == ".png" else "image/jpeg"

    prompt = (
        f"You are an expert architectural and geospatial AI analyzing a high-resolution top-down satellite image.\n"
        f"Image dimensions: {img_w} x {img_h} pixels (width x height).\n\n"
        f"Task: Inspect the main building structure in the center of the image.\n\n"
        f"Return ONLY a valid JSON object (no extra text, no markdown formatting) with these exact keys:\n"
        f"- footprint_pixels: array of [x, y] coordinates tracing the building perimeter (x: 0-{img_w}, y: 0-{img_h}). Minimum 4 points.\n"
        f"- estimated_floors: integer floor count estimated from architectural scale, shadows, and height.\n"
        f"- roof_shape: one of 'flat', 'gabled', 'hipped', 'dome', 'pyramidal', 'mansard', 'barrel', 'round', 'complex'.\n"
        f"- building_color: dominant roof/facade color name (e.g. 'white', 'red', 'sandstone', 'gray', 'terracotta', 'dark_glass').\n"
        f"- building_material: dominant apparent material (e.g. 'marble', 'sandstone', 'concrete', 'glass', 'brick', 'metal').\n"
        f"- architectural_form: one of 'central_mass', 'tower', 'podium', 'wings', 'courtyard', 'monument'.\n"
        f"- symmetry: one of 'radial', 'bilateral', 'asymmetric'.\n"
        f"- confidence: integer 0-100 indicating confidence in this visual analysis.\n\n"
        f"If no building is clearly visible, return: {{\"confidence\": 0, \"footprint_pixels\": []}}\n"
    )

    payload = {
        "contents": [
            {
                "parts": [
                    {"text": prompt},
                    {
                        "inlineData": {
                            "mimeType": mime_type,
                            "data": b64_image,
                        }
                    },
                ]
            }
        ],
        "generationConfig": {
            "temperature": 0.1,
            "maxOutputTokens": 512,
        },
    }

    async with httpx.AsyncClient(timeout=30.0) as client:
        for model in GEMINI_MODELS:
            url = GEMINI_URL.format(model=model)
            for attempt in range(3):
                try:
                    response = await client.post(
                        url,
                        params={"key": api_key},
                        json=payload,
                        headers={"Content-Type": "application/json"},
                    )
                except httpx.HTTPError as exc:
                    logger.warning("Gemini Vision HTTP error [%s] attempt %d: %s", model, attempt + 1, exc)
                    await asyncio.sleep(1.5 ** attempt)
                    continue

                if response.status_code in (429, 503):
                    logger.warning(
                        "Gemini Vision [%s] HTTP %d (attempt %d/3) — retrying in %.1fs",
                        model, response.status_code, attempt + 1, 1.5 ** attempt
                    )
                    await asyncio.sleep(1.5 ** attempt)
                    continue

                if response.status_code == 404:
                    logger.warning("Gemini Vision model %s not found (HTTP 404) — trying next model.", model)
                    break

                if response.status_code != 200:
                    logger.warning("Gemini Vision [%s] HTTP %d: %s", model, response.status_code, response.text[:200])
                    break

                # Parse JSON response
                try:
                    result = response.json()
                    candidates = result.get("candidates") or []
                    if not candidates:
                        break
                    raw_text = candidates[0].get("content", {}).get("parts", [{}])[0].get("text", "")
                    parsed = _extract_json(raw_text)

                    if not parsed:
                        logger.warning("Gemini Vision [%s]: Could not parse JSON from response text.", model)
                        return None

                    conf = int(parsed.get("confidence", 0))
                    pixels = parsed.get("footprint_pixels", [])

                    logger.info(
                        "✅ Gemini Vision [%s]: confidence=%d, footprint_points=%d, floors=%s, roof=%s, material=%s, color=%s",
                        model, conf, len(pixels),
                        parsed.get("estimated_floors"),
                        parsed.get("roof_shape"),
                        parsed.get("building_material"),
                        parsed.get("building_color"),
                    )
                    return parsed

                except (KeyError, IndexError, TypeError, ValueError) as exc:
                    logger.warning("Gemini Vision [%s]: Response parsing error: %s", model, exc)
                    return None

    logger.info("Gemini Vision: Visual extraction completed or defaulted gracefully.")
    return None
