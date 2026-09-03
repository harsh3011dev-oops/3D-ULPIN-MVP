import asyncio
from httpx import AsyncClient
from backend.main import app

async def test():
    async with AsyncClient(app=app, base_url="http://test") as ac:
        response = await ac.get("/api/v1/buildings/6d24dc16-7205-4af7-9e9d-dc89100c8b4f")
        print(response.status_code)
        print(response.text)

if __name__ == "__main__":
    asyncio.run(test())
