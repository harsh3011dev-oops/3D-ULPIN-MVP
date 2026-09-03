import asyncio
from backend.services.ai_runner import execute_ai_pipeline_job

async def main():
    await execute_ai_pipeline_job(
        job_id="test_job_id_123",
        parcel_id="PARCEL_GBLOCK_001",
        address="G-Block Applied Science, Patti Kalyana, Haryana",
        building_name="G-Block Applied Science",
        latitude=29.21147,
        longitude=77.01607,
        height_meters=35,
        floor_count=4
    )

if __name__ == "__main__":
    asyncio.run(main())
