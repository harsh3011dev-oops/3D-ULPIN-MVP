import asyncio
from backend.services.gemini_lookup import call_gemini_api

async def main():
    result = await call_gemini_api("burj khalifa", "dubai")
    print("API RESULT:", result)

if __name__ == "__main__":
    asyncio.run(main())
