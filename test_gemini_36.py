import asyncio
import httpx
from backend.config import settings
import traceback

async def main():
    api_key = settings.gemini_api_key
    model = "gemini-3.6-flash"
    url = f"https://generativelanguage.googleapis.com/v1beta/models/{model}:generateContent"
    payload = {
        "contents": [{"parts": [{"text": "{ \"test\": 123 }"}]}],
        "generationConfig": {"temperature": 0.1, "responseMimeType": "application/json"}
    }
    async with httpx.AsyncClient(timeout=15.0) as client:
        try:
            resp = await client.post(url, params={"key": api_key}, json=payload)
            print("Status:", resp.status_code)
            print("Response:", resp.text)
        except Exception as e:
            traceback.print_exc()

if __name__ == "__main__":
    asyncio.run(main())
