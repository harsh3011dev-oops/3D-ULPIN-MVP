"""
backend/services/gemini_architectural_inference.py
──────────────────────────────────────────────────
Optional AI architectural inference service using Gemini API.
Infers ONLY missing architectural metadata (roof shape, building typology, symmetry)
when OpenStreetMap tags are incomplete.

STRICT RULES:
1. Real OSM data ALWAYS supersedes Gemini inferences.
2. Never generates coordinates, polygon vertices, or raw Three.js code.
3. Separates provenance (sourceMetadata vs inferredMetadata).
4. Results are cached by OSM ID and geometric hash.
"""

from __future__ import annotations

import hashlib
import json
import logging
import os
import re
from typing import Any, Optional
import httpx

from backend.config import settings

logger = logging.getLogger(__name__)

# In-memory cache for inferred architectural metadata
_INFERENCE_CACHE: dict[str, dict[str, Any]] = {}

GEMINI_MODELS = (
    "gemini-2.5-flash",
    "gemini-2.0-flash",
    "gemini-1.5-flash",
)

GEMINI_URL = "https://generativelanguage.googleapis.com/v1beta/models/{model}:generateContent"

ALLOWED_ROOF_SHAPES = {
    "flat",
    "gabled",
    "hipped",
    "pyramidal",
    "dome",
    "onion",
    "cone",
    "mansard",
    "skillion",
    "barrel",
    "round",
}

ALLOWED_BUILDING_TYPES = {
    "residential",
    "commercial",
    "office",
    "industrial",
    "historic",
    "religious",
    "civic",
    "educational",
    "transport",
    "mixed_use",
}


def _compute_cache_key(payload: dict[str, Any]) -> str:
    """Compute deterministic cache key from input metadata."""
    osm_id = str(payload.get("osm_id") or "")
    name = str(payload.get("building_name") or "")
    tags_str = json.dumps(payload.get("osm_tags") or {}, sort_keys=True)
    metrics_str = json.dumps(payload.get("footprint_metrics") or {}, sort_keys=True)
    raw = f"{osm_id}:{name}:{tags_str}:{metrics_str}"
    return hashlib.sha256(raw.encode("utf-8")).hexdigest()[:32]


def _extract_json(text: str) -> Optional[dict[str, Any]]:
    """Extract and parse JSON from model response text."""
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


async def infer_architectural_metadata(request_data: dict[str, Any]) -> dict[str, Any]:
    """
    Infer missing architectural attributes (roofShape, buildingType, architecturalForm)
    based strictly on structured OSM tags and geometric shape metrics.
    """
    cache_key = _compute_cache_key(request_data)
    if cache_key in _INFERENCE_CACHE:
        cached = dict(_INFERENCE_CACHE[cache_key])
        cached["provenance"] = {**cached.get("provenance", {}), "cached": True}
        return cached

    api_key = settings.gemini_api_key or os.environ.get("GEMINI_API_KEY", "")
    if not api_key:
        logger.info("GEMINI_API_KEY is not configured — returning neutral inference.")
        return {
            "confidence": 0.0,
            "inferred_fields": [],
            "reason": "GEMINI_API_KEY not configured",
            "provenance": {"source": "none", "cached": False},
        }

    # Extract input context
    osm_tags = request_data.get("osm_tags") or {}
    metrics = request_data.get("footprint_metrics") or {}
    known_roof = request_data.get("known_roof_shape")
    known_type = request_data.get("known_building_type")
    known_material = request_data.get("known_material")
    building_name = request_data.get("building_name") or ""
    parts_count = int(request_data.get("building_parts_count") or 0)

    prompt = f"""You are an architectural metadata inference assistant.
Given structured geometric properties and OpenStreetMap tags of a real building, infer ONLY missing architectural characteristics.
Do NOT invent coordinates or polygon vertices.

INPUT DATA:
- Building Type Tag: {osm_tags.get('building', 'unknown')}
- Historic/Heritage Tags: {osm_tags.get('historic', 'none')}, {osm_tags.get('heritage', 'none')}
- Tourism Tag: {osm_tags.get('tourism', 'none')}
- Amenity Tag: {osm_tags.get('amenity', 'none')}
- Number of Building Parts: {parts_count}
- Known Roof Shape: {known_roof or 'MISSING'}
- Known Building Type: {known_type or 'MISSING'}
- Known Material: {known_material or 'MISSING'}
- Footprint Area: ~{metrics.get('area_sqm', 0)} m²
- Circularity Metric (0 to 1, 1=circle): {metrics.get('circularity', 0)}
- Aspect Ratio: {metrics.get('aspect_ratio', 1.0)}
- Symmetry: {'Symmetric' if metrics.get('is_symmetric') else 'Asymmetric'}
- Courtyard / Atrium Holes: {'Yes' if metrics.get('has_holes') else 'No'}

TASK:
Infer only the missing fields.
Allowed roofShape values: flat, gabled, hipped, pyramidal, dome, onion, cone, mansard, skillion, barrel.
Allowed buildingType values: residential, commercial, office, industrial, historic, religious, civic, educational, transport, mixed_use.
Allowed architecturalForm: central_mass, linear_block, courtyard_enclosure, stepped_tiers, tower_podium, complex.

Respond with strict JSON in this exact format:
{{
  "buildingType": "one of the allowed buildingType values",
  "roofShape": "one of the allowed roofShape values",
  "architecturalForm": "one of the allowed architecturalForm values",
  "suggestedMaterial": "string (e.g. sandstone, marble, concrete, glass, brick, limestone)",
  "towerProbability": float between 0.0 and 1.0,
  "symmetry": "radial" | "bilateral" | "asymmetric",
  "confidence": float between 0.0 and 1.0,
  "reasoning": "brief explanation"
}}"""

    payload = {
        "contents": [{"parts": [{"text": prompt}]}],
        "generationConfig": {
            "temperature": 0.1,
            "maxOutputTokens": 300,
            "responseMimeType": "application/json",
        },
    }

    inferred_result = None
    model_used = None

    async with httpx.AsyncClient(timeout=4.0) as client:
        for model in GEMINI_MODELS:
            url = GEMINI_URL.format(model=model)
            try:
                resp = await client.post(
                    url,
                    json=payload,
                    params={"key": api_key},
                    headers={"Content-Type": "application/json"},
                )
                if resp.status_code == 200:
                    data = resp.json()
                    candidates = data.get("candidates") or []
                    if candidates:
                        content_parts = candidates[0].get("content", {}).get("parts", [])
                        if content_parts:
                            text = content_parts[0].get("text", "")
                            parsed = _extract_json(text)
                            if parsed:
                                inferred_result = parsed
                                model_used = model
                                break
                else:
                    logger.debug(f"Gemini model {model} returned HTTP {resp.status_code}")
            except Exception as e:
                logger.debug(f"Gemini call to {model} failed: {e}")
                continue

    if not inferred_result:
        return {
            "confidence": 0.0,
            "inferred_fields": [],
            "reason": "AI inference unavailable or non-responsive",
            "provenance": {"source": "gemini", "status": "failed", "cached": False},
        }

    # Validate and normalize inferred values
    confidence = float(inferred_result.get("confidence") or 0.0)
    confidence = max(0.0, min(1.0, confidence))

    raw_roof = str(inferred_result.get("roofShape") or "").lower().strip()
    roof_shape = raw_roof if raw_roof in ALLOWED_ROOF_SHAPES else "flat"

    raw_btype = str(inferred_result.get("buildingType") or "").lower().strip()
    building_type = raw_btype if raw_btype in ALLOWED_BUILDING_TYPES else "mixed_use"

    architectural_form = str(inferred_result.get("architecturalForm") or "central_mass").lower().strip()
    suggested_material = str(inferred_result.get("suggestedMaterial") or "concrete").lower().strip()
    tower_prob = float(inferred_result.get("towerProbability") or 0.0)
    symmetry = str(inferred_result.get("symmetry") or "bilateral").lower().strip()

    inferred_fields = []
    if not known_roof and roof_shape:
        inferred_fields.append("roof_shape")
    if not known_type and building_type:
        inferred_fields.append("building_type")
    if not known_material and suggested_material:
        inferred_fields.append("suggested_material")
    inferred_fields.append("architectural_form")

    final_response = {
        "confidence": round(confidence, 2),
        "building_type": building_type,
        "roof_shape": roof_shape,
        "architectural_form": architectural_form,
        "suggested_material": suggested_material,
        "tower_probability": round(tower_prob, 2),
        "symmetry": symmetry,
        "inferred_fields": inferred_fields,
        "reasoning": str(inferred_result.get("reasoning") or ""),
        "provenance": {
            "source": "gemini",
            "model": model_used or "unknown",
            "cached": False,
        },
    }

    _INFERENCE_CACHE[cache_key] = final_response
    return final_response
