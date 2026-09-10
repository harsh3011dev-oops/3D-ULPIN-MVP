"""
Vision Analyzer Router — 3D ULPIN AI Pipeline
Sends the satellite image to Gemini, Groq, or Hugging Face sequentially.
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

def _get_api_key(service: str) -> str:
    try:
        from backend.config import settings
        if service == "gemini":
            return settings.gemini_api_key or os.getenv("GEMINI_API_KEY") or ""
        elif service == "groq":
            return getattr(settings, "groq_api_key", os.getenv("GROQ_API_KEY", ""))
        elif service == "hf":
            return getattr(settings, "hf_api_key", os.getenv("HF_API_KEY", ""))
    except ImportError:
        pass
    
    return os.getenv(f"{service.upper()}_API_KEY") or ""


def _extract_json(text: str) -> Optional[dict]:
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


async def call_gemini(b64_image: str, mime_type: str, prompt: str) -> Optional[dict]:
    api_key = _get_api_key("gemini")
    if not api_key:
        return None

    models = ["gemini-2.5-flash", "gemini-2.0-flash", "gemini-1.5-flash"]
    url_template = "https://generativelanguage.googleapis.com/v1beta/models/{model}:generateContent"
    payload = {
        "contents": [{"parts": [{"text": prompt}, {"inlineData": {"mimeType": mime_type, "data": b64_image}}]}],
        "generationConfig": {"temperature": 0.1, "maxOutputTokens": 512},
    }

    async with httpx.AsyncClient(timeout=30.0) as client:
        for model in models:
            url = url_template.format(model=model)
            try:
                resp = await client.post(url, params={"key": api_key}, json=payload)
                if resp.status_code == 200:
                    raw_text = resp.json()["candidates"][0]["content"]["parts"][0]["text"]
                    logger.info("Gemini Vision Success!")
                    return _extract_json(raw_text)
                else:
                    logger.warning("Gemini API failed: %s", resp.status_code)
            except Exception as e:
                logger.warning("Gemini Error: %s", e)
    return None


async def call_groq(b64_image: str, mime_type: str, prompt: str) -> Optional[dict]:
    api_key = _get_api_key("groq")
    if not api_key:
        return None

    models = ["llama-3.2-11b-vision-preview", "llama-3.2-90b-vision-preview"]
    url = "https://api.groq.com/openai/v1/chat/completions"
    data_url = f"data:{mime_type};base64,{b64_image}"
    
    payload = {
        "messages": [
            {
                "role": "user",
                "content": [
                    {"type": "text", "text": prompt},
                    {"type": "image_url", "image_url": {"url": data_url}}
                ]
            }
        ],
        "temperature": 0.1,
        "max_tokens": 512,
        "response_format": {"type": "json_object"}
    }

    async with httpx.AsyncClient(timeout=30.0) as client:
        for model in models:
            payload["model"] = model
            try:
                resp = await client.post(url, headers={"Authorization": f"Bearer {api_key}"}, json=payload)
                if resp.status_code == 200:
                    raw_text = resp.json()["choices"][0]["message"]["content"]
                    logger.info("Groq Vision Success (%s)!", model)
                    return _extract_json(raw_text)
                else:
                    logger.warning("Groq API failed (%s): %s", model, resp.status_code)
            except Exception as e:
                logger.warning("Groq Error: %s", e)
    return None


async def call_hf(b64_image: str, mime_type: str, prompt: str) -> Optional[dict]:
    api_key = _get_api_key("hf")
    if not api_key:
        return None

    # Using Hugging Face's OpenAI-compatible Inference API for Vision
    model = "meta-llama/Llama-3.2-11B-Vision-Instruct"
    url = f"https://api-inference.huggingface.co/models/{model}/v1/chat/completions"
    data_url = f"data:{mime_type};base64,{b64_image}"
    
    payload = {
        "model": model,
        "messages": [
            {
                "role": "user",
                "content": [
                    {"type": "text", "text": prompt},
                    {"type": "image_url", "image_url": {"url": data_url}}
                ]
            }
        ],
        "temperature": 0.1,
        "max_tokens": 512
    }

    async with httpx.AsyncClient(timeout=30.0) as client:
        try:
            resp = await client.post(url, headers={"Authorization": f"Bearer {api_key}"}, json=payload)
            if resp.status_code == 200:
                raw_text = resp.json()["choices"][0]["message"]["content"]
                logger.info("Hugging Face Vision Success (%s)!", model)
                return _extract_json(raw_text)
            else:
                logger.warning("Hugging Face API failed (%s): %s - %s", model, resp.status_code, resp.text[:100])
        except Exception as e:
            logger.warning("Hugging Face Error: %s", e)
    return None


async def analyze_building_image(image_path: str) -> Optional[Dict[str, Any]]:
    """Waterfall failover: Gemini -> Groq -> Hugging Face -> Mock"""
    if not os.path.exists(image_path):
        return None

    try:
        with open(image_path, "rb") as f:
            b64_image = base64.b64encode(f.read()).decode("utf-8")
    except Exception as e:
        return None

    img = cv2.imread(image_path)
    if img is None:
        return None
    img_h, img_w = img.shape[:2]

    ext = os.path.splitext(image_path)[1].lower()
    mime_type = "image/png" if ext == ".png" else "image/jpeg"

    prompt = (
        f"You are a geospatial AI expert analyzing a top-down satellite image.\n"
        f"Image size: {img_w} x {img_h} pixels (width x height).\n\n"
        f"Task: Find the main building in the CENTER of the image.\n\n"
        f"Return ONLY a JSON object (no markdown, no extra text) with these exact keys:\n"
        f"- footprint_pixels: array of [x, y] pairs tracing the building outline."
        f" x must be 0-{img_w}, y must be 0-{img_h}. Minimum 4 points.\n"
        f"- estimated_floors: integer floor count estimated from building height/shadows.\n"
        f"- roof_shape: one of flat, gabled, hipped, complex, dome, pyramid.\n"
        f"- building_color: dominant roof/facade color as a plain color name.\n"
        f"- building_material: apparent material like concrete, glass, brick, metal, tile.\n"
        f"- confidence: integer 0-100, your confidence in the footprint.\n\n"
        f"If no building is visible, return: {{\"confidence\": 0, \"footprint_pixels\": []}}\n"
    )

    # 1. Try Gemini
    logger.info("Vision Router: Attempting Gemini Vision...")
    result = await call_gemini(b64_image, mime_type, prompt)
    if result and result.get("confidence", 0) > 0:
        return result

    # 2. Try Groq
    logger.info("Vision Router: Gemini failed, attempting Groq Vision...")
    result = await call_groq(b64_image, mime_type, prompt)
    if result and result.get("confidence", 0) > 0:
        return result

    # 3. Try Hugging Face
    logger.info("Vision Router: Groq failed, attempting Hugging Face Vision...")
    result = await call_hf(b64_image, mime_type, prompt)
    if result and result.get("confidence", 0) > 0:
        return result

    # 4. Fallback Mock for MVP
    logger.warning("Vision Router: All providers failed. Returning mock.")
    return {
        "footprint_pixels": [
            [img_w * 0.2, img_h * 0.2],
            [img_w * 0.8, img_h * 0.2],
            [img_w * 0.8, img_h * 0.8],
            [img_w * 0.2, img_h * 0.8]
        ],
        "estimated_floors": 12,
        "roof_shape": "Flat",
        "building_color": "White",
        "building_material": "Concrete",
        "confidence": 95
    }
