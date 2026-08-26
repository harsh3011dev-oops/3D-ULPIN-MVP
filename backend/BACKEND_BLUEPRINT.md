# 🗄️ Backend API Blueprint — 3D ULPIN MVP
**Developer**: Prateek | **Branch**: `feature/backend` | **Deadline**: Day 6

---

## 1. 🎯 Your Responsibility

As the Backend API Developer, you are the **nervous system** of the 3D ULPIN platform. You build and maintain the FastAPI server that accepts building submissions from the Frontend, triggers the AI module to process aerial images, persists all results in a PostgreSQL + PostGIS database, and serves structured building and unit data back to the Frontend. You own the entire data layer — schema design, migrations, CRUD operations, spatial queries, and API response formatting — ensuring the contract defined in `API_CONTRACT.md` is always honoured.

---

## 2. 🗃️ Database Schema

### Table 1: `parcels`
| Column | Type | Description |
|--------|------|-------------|
| `parcel_id` | `VARCHAR(50) PK` | e.g. `PARCEL_001` |
| `boundary` | `GEOMETRY(POLYGON, 4326)` | Legal land parcel boundary |
| `area_sqm` | `FLOAT` | Parcel area in sq. meters |
| `state` | `VARCHAR(50)` | State name (e.g. Delhi) |
| `district` | `VARCHAR(50)` | District name |
| `created_at` | `TIMESTAMP` | Record creation time |

### Table 2: `buildings`
| Column | Type | Description |
|--------|------|-------------|
| `building_id` | `UUID PK` | Auto-generated UUID |
| `parcel_id` | `VARCHAR(50) FK → parcels` | Parent parcel |
| `footprint` | `GEOMETRY(POLYGON, 4326)` | Detected building footprint |
| `height_m` | `FLOAT` | Total building height |
| `floor_count` | `INTEGER` | Number of floors |
| `aerial_image_url` | `TEXT` | URL/path to source aerial image |
| `status` | `VARCHAR(20)` | `pending / processing / done / failed` |
| `ai_output` | `JSONB` | Full AI output JSON (raw) |
| `created_at` | `TIMESTAMP` | |
| `updated_at` | `TIMESTAMP` | |

### Table 3: `units`
| Column | Type | Description |
|--------|------|-------------|
| `unit_id` | `VARCHAR(50) PK` | e.g. `UNIT_F01_A01` |
| `building_id` | `UUID FK → buildings` | Parent building |
| `ulpin` | `VARCHAR(100) UNIQUE` | 3D ULPIN string |
| `floor_number` | `INTEGER` | Floor (1-indexed) |
| `z_min` | `FLOAT` | Bottom height (meters) |
| `z_max` | `FLOAT` | Top height (meters) |
| `polygon_2d` | `GEOMETRY(POLYGON, 4326)` | Unit boundary on floor plan |
| `centroid` | `GEOMETRY(POINT, 4326)` | Unit centroid |
| `area_sqm` | `FLOAT` | Unit area |
| `created_at` | `TIMESTAMP` | |

### Table 4: `validation_log`
| Column | Type | Description |
|--------|------|-------------|
| `id` | `UUID PK` | Auto-generated |
| `building_id` | `UUID FK → buildings` | |
| `valid` | `BOOLEAN` | Overall validity |
| `overlaps_detected` | `BOOLEAN` | |
| `overlapping_units` | `JSONB` | Array of overlapping unit pairs |
| `out_of_bounds` | `JSONB` | Array of unit_ids out of boundary |
| `errors` | `JSONB` | Detailed error array |
| `validated_at` | `TIMESTAMP` | |

### Table 5: `jobs`
| Column | Type | Description |
|--------|------|-------------|
| `job_id` | `UUID PK` | Job identifier |
| `building_id` | `UUID FK → buildings` | Associated building |
| `status` | `VARCHAR(20)` | `queued / running / done / failed` |
| `progress_pct` | `INTEGER` | 0–100 progress |
| `error_message` | `TEXT` | Error details if failed |
| `started_at` | `TIMESTAMP` | |
| `completed_at` | `TIMESTAMP` | |

---

## 3. 📁 Folder Structure

```
backend/
├── BACKEND_BLUEPRINT.md          ← This file
├── main.py                       ← FastAPI app entry point, mounts all routers
├── database.py                   ← SQLAlchemy engine, session factory, PostGIS setup
├── models.py                     ← All SQLAlchemy ORM models (5 tables above)
├── schemas.py                    ← Pydantic request/response validation schemas
├── config.py                     ← Settings from .env (DB_URL, AI_MODULE_PATH, etc.)
├── routes/
│   ├── __init__.py
│   ├── buildings.py              ← POST /api/buildings/create, GET /api/buildings/{id}
│   ├── units.py                  ← GET /api/buildings/{id}/units, GET /api/units/{unit_id}
│   ├── validation.py             ← GET /api/validation/{building_id}
│   └── health.py                 ← GET /api/health (for frontend status check)
├── services/
│   ├── __init__.py
│   ├── ai_service.py             ← Calls ai.pipeline.process_building(), handles errors
│   ├── building_service.py       ← CRUD logic for buildings and units
│   └── validation_service.py     ← Stores and retrieves validation results
├── migrations/
│   ├── env.py                    ← Alembic config
│   └── versions/
│       └── 001_initial_schema.py ← Create all 5 tables
├── tests/
│   ├── __init__.py
│   ├── conftest.py               ← pytest fixtures: test DB, test client
│   ├── test_routes_buildings.py
│   ├── test_routes_units.py
│   ├── test_routes_validation.py
│   ├── test_models.py
│   └── test_integration.py       ← Full flow test with real AI module
├── .env.example
├── requirements.txt
└── README.md
```

---

## 4. 🌐 4 API Endpoints

### Endpoint 1: `POST /api/buildings/create`

**Purpose**: Accept aerial image + parcel metadata → trigger AI → store result → return job_id

**Request:**
```json
{
  "parcel_id": "PARCEL_001",
  "aerial_image_url": "https://storage.example.com/images/parcel001.jpg",
  "height_meters": 45.0,
  "floor_count": 15,
  "parcel_boundary": {
    "type": "Polygon",
    "coordinates": [[[77.049, 28.592], [77.050, 28.592], [77.050, 28.593], [77.049, 28.592]]]
  }
}
```

**Response (202 Accepted):**
```json
{
  "building_id": "550e8400-e29b-41d4-a716-446655440000",
  "job_id": "7f3c2a91-...",
  "status": "processing",
  "message": "Building submitted for AI processing. Poll /api/jobs/{job_id}/status for updates."
}
```

---

### Endpoint 2: `GET /api/buildings/{building_id}`

**Purpose**: Return complete building data including footprint and all units

**Response (200 OK):**
```json
{
  "building_id": "550e8400-...",
  "parcel_id": "PARCEL_001",
  "footprint": { "type": "Polygon", "coordinates": [[...]] },
  "height_m": 45.0,
  "floor_count": 15,
  "status": "done",
  "units": [
    {
      "unit_id": "UNIT_F01_A01",
      "ulpin": "PARCEL_001-550E8400-F01-UA01-ttnfv1h",
      "floor_number": 1,
      "z_min": 0.0,
      "z_max": 3.0,
      "area_sqm": 75.4,
      "centroid": [28.5921, 77.0490]
    }
  ],
  "created_at": "2026-08-27T10:30:00Z"
}
```

---

### Endpoint 3: `GET /api/buildings/{building_id}/units`

**Purpose**: List all units for a building with pagination

**Query Params**: `?page=1&limit=20&floor=1`

**Response (200 OK):**
```json
{
  "building_id": "550e8400-...",
  "total": 60,
  "page": 1,
  "limit": 20,
  "units": [
    {
      "unit_id": "UNIT_F01_A01",
      "ulpin": "PARCEL_001-550E8400-F01-UA01-ttnfv1h",
      "floor_number": 1,
      "z_min": 0.0,
      "z_max": 3.0,
      "polygon_2d": { "type": "Polygon", "coordinates": [[...]] },
      "centroid": [28.5921, 77.0490],
      "area_sqm": 75.4
    }
  ]
}
```

---

### Endpoint 4: `GET /api/validation/{building_id}`

**Purpose**: Return spatial validation status and any detected errors

**Response (200 OK):**
```json
{
  "building_id": "550e8400-...",
  "valid": true,
  "overlaps_detected": false,
  "overlapping_units": [],
  "out_of_bounds": [],
  "errors": [],
  "validated_at": "2026-08-27T10:31:05Z"
}
```

**Response when invalid (200 OK, `valid: false`):**
```json
{
  "building_id": "550e8400-...",
  "valid": false,
  "overlaps_detected": true,
  "overlapping_units": [["UNIT_F03_A01", "UNIT_F03_A02"]],
  "out_of_bounds": ["UNIT_F05_B03"],
  "errors": [
    { "unit_id": "UNIT_F03_A01", "type": "OVERLAP", "description": "Overlaps with UNIT_F03_A02" },
    { "unit_id": "UNIT_F05_B03", "type": "OUT_OF_BOUNDS", "description": "Unit extends beyond footprint" }
  ],
  "validated_at": "2026-08-27T10:31:05Z"
}
```

---

## 5. 🏗️ SQLAlchemy Model Templates

**File**: `backend/models.py`

```python
import uuid
from datetime import datetime
from sqlalchemy import Column, String, Float, Integer, Boolean, Text, TIMESTAMP, ForeignKey
from sqlalchemy.dialects.postgresql import UUID, JSONB
from geoalchemy2 import Geometry
from sqlalchemy.orm import relationship
from backend.database import Base


class Parcel(Base):
    __tablename__ = "parcels"

    parcel_id = Column(String(50), primary_key=True)
    boundary = Column(Geometry(geometry_type="POLYGON", srid=4326))
    area_sqm = Column(Float)
    state = Column(String(50))
    district = Column(String(50))
    created_at = Column(TIMESTAMP, default=datetime.utcnow)

    buildings = relationship("Building", back_populates="parcel")


class Building(Base):
    __tablename__ = "buildings"

    building_id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    parcel_id = Column(String(50), ForeignKey("parcels.parcel_id"), nullable=False)
    footprint = Column(Geometry(geometry_type="POLYGON", srid=4326))
    height_m = Column(Float, nullable=False)
    floor_count = Column(Integer, nullable=False)
    aerial_image_url = Column(Text)
    status = Column(String(20), default="pending")
    ai_output = Column(JSONB)
    created_at = Column(TIMESTAMP, default=datetime.utcnow)
    updated_at = Column(TIMESTAMP, default=datetime.utcnow, onupdate=datetime.utcnow)

    parcel = relationship("Parcel", back_populates="buildings")
    units = relationship("Unit", back_populates="building")
    validation = relationship("ValidationLog", back_populates="building", uselist=False)
    job = relationship("Job", back_populates="building", uselist=False)


class Unit(Base):
    __tablename__ = "units"

    unit_id = Column(String(50), primary_key=True)
    building_id = Column(UUID(as_uuid=True), ForeignKey("buildings.building_id"), nullable=False)
    ulpin = Column(String(100), unique=True, nullable=False)
    floor_number = Column(Integer, nullable=False)
    z_min = Column(Float, nullable=False)
    z_max = Column(Float, nullable=False)
    polygon_2d = Column(Geometry(geometry_type="POLYGON", srid=4326))
    centroid = Column(Geometry(geometry_type="POINT", srid=4326))
    area_sqm = Column(Float)
    created_at = Column(TIMESTAMP, default=datetime.utcnow)

    building = relationship("Building", back_populates="units")


class ValidationLog(Base):
    __tablename__ = "validation_log"

    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    building_id = Column(UUID(as_uuid=True), ForeignKey("buildings.building_id"), unique=True)
    valid = Column(Boolean, nullable=False)
    overlaps_detected = Column(Boolean, default=False)
    overlapping_units = Column(JSONB, default=list)
    out_of_bounds = Column(JSONB, default=list)
    errors = Column(JSONB, default=list)
    validated_at = Column(TIMESTAMP, default=datetime.utcnow)

    building = relationship("Building", back_populates="validation")


class Job(Base):
    __tablename__ = "jobs"

    job_id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    building_id = Column(UUID(as_uuid=True), ForeignKey("buildings.building_id"), unique=True)
    status = Column(String(20), default="queued")
    progress_pct = Column(Integer, default=0)
    error_message = Column(Text)
    started_at = Column(TIMESTAMP)
    completed_at = Column(TIMESTAMP)

    building = relationship("Building", back_populates="job")
```

---

## 6. 🔧 Service Layer Examples

### `ai_service.py`

```python
# backend/services/ai_service.py
import sys
import os
from sqlalchemy.orm import Session
from backend.models import Building, Unit, ValidationLog, Job
from datetime import datetime
import uuid

# Add ai module to path
sys.path.insert(0, os.path.join(os.path.dirname(__file__), '..', '..'))
from ai.pipeline import process_building


def run_ai_and_store(building_id: str, input_data: dict, db: Session) -> None:
    """
    Run AI pipeline for a building and persist all results to DB.

    Called as a FastAPI BackgroundTask after POST /api/buildings/create.
    Updates building status, stores units, and saves validation results.

    Args:
        building_id (str): UUID of the building record in DB.
        input_data (dict): Input dict matching AI module format.
        db (Session): Active SQLAlchemy DB session.
    """
    building = db.query(Building).filter_by(building_id=building_id).first()
    job = db.query(Job).filter_by(building_id=building_id).first()

    try:
        # Update status to processing
        building.status = "processing"
        job.status = "running"
        job.started_at = datetime.utcnow()
        db.commit()

        # Run AI pipeline
        result = process_building(input_data)

        if result["status"] != "success":
            raise Exception(result.get("message", "AI pipeline failed"))

        # Store units
        for unit_data in result["units"]:
            unit = Unit(
                unit_id=unit_data["unit_id"],
                building_id=building_id,
                ulpin=unit_data["ulpin"],
                floor_number=unit_data["floor"],
                z_min=unit_data["z_min"],
                z_max=unit_data["z_max"],
                area_sqm=unit_data.get("area_sqm"),
            )
            db.add(unit)

        # Store validation results
        validation = result["validation"]
        val_log = ValidationLog(
            building_id=building_id,
            valid=validation["valid"],
            overlaps_detected=validation["overlaps_detected"],
            overlapping_units=validation["overlapping_units"],
            out_of_bounds=validation["out_of_bounds"],
            errors=validation["errors"],
        )
        db.add(val_log)

        # Update building status
        building.status = "done"
        building.ai_output = result
        job.status = "done"
        job.progress_pct = 100
        job.completed_at = datetime.utcnow()
        db.commit()

    except Exception as e:
        building.status = "failed"
        job.status = "failed"
        job.error_message = str(e)
        job.completed_at = datetime.utcnow()
        db.commit()
        raise
```

### `validation_service.py`

```python
# backend/services/validation_service.py
from sqlalchemy.orm import Session
from backend.models import ValidationLog, Building


def get_validation_result(building_id: str, db: Session) -> dict:
    """
    Retrieve validation result for a building.

    Args:
        building_id (str): Building UUID.
        db (Session): DB session.

    Returns:
        dict: Validation result or error dict.
    """
    building = db.query(Building).filter_by(building_id=building_id).first()
    if not building:
        return {"error": "Building not found", "code": 404}

    if building.status != "done":
        return {"error": f"Building not yet processed. Status: {building.status}", "code": 202}

    val = db.query(ValidationLog).filter_by(building_id=building_id).first()
    if not val:
        return {"error": "Validation result not found", "code": 404}

    return {
        "building_id": str(building_id),
        "valid": val.valid,
        "overlaps_detected": val.overlaps_detected,
        "overlapping_units": val.overlapping_units,
        "out_of_bounds": val.out_of_bounds,
        "errors": val.errors,
        "validated_at": val.validated_at.isoformat()
    }
```

---

## 7. 🛣️ Routes Examples

### `buildings.py`

```python
# backend/routes/buildings.py
from fastapi import APIRouter, BackgroundTasks, Depends, HTTPException
from sqlalchemy.orm import Session
from backend.database import get_db
from backend.models import Building, Job
from backend.schemas import BuildingCreateRequest, BuildingCreateResponse
from backend.services.ai_service import run_ai_and_store
import uuid

router = APIRouter(prefix="/api/buildings", tags=["buildings"])


@router.post("/create", status_code=202)
async def create_building(
    request: BuildingCreateRequest,
    background_tasks: BackgroundTasks,
    db: Session = Depends(get_db)
):
    """Accept building submission and trigger AI processing in background."""
    building_id = uuid.uuid4()
    job_id = uuid.uuid4()

    # Create Building record
    building = Building(
        building_id=building_id,
        parcel_id=request.parcel_id,
        height_m=request.height_meters,
        floor_count=request.floor_count,
        aerial_image_url=request.aerial_image_url,
        status="pending"
    )
    job = Job(job_id=job_id, building_id=building_id, status="queued")

    db.add(building)
    db.add(job)
    db.commit()

    # Build AI input dict
    ai_input = {
        "aerial_image_path": request.aerial_image_url,
        "parcel_boundary": request.parcel_boundary,
        "height_meters": request.height_meters,
        "floor_count": request.floor_count,
        "parcel_id": request.parcel_id,
        "building_id": str(building_id)
    }

    # Trigger AI processing as background task
    background_tasks.add_task(run_ai_and_store, str(building_id), ai_input, db)

    return {
        "building_id": str(building_id),
        "job_id": str(job_id),
        "status": "processing",
        "message": "Building submitted. Poll /api/jobs/{job_id}/status for updates."
    }


@router.get("/{building_id}")
async def get_building(building_id: str, db: Session = Depends(get_db)):
    """Retrieve full building data including all units."""
    building = db.query(Building).filter_by(building_id=building_id).first()
    if not building:
        raise HTTPException(status_code=404, detail="Building not found")

    return {
        "building_id": str(building.building_id),
        "parcel_id": building.parcel_id,
        "height_m": building.height_m,
        "floor_count": building.floor_count,
        "status": building.status,
        "units": [
            {
                "unit_id": u.unit_id,
                "ulpin": u.ulpin,
                "floor_number": u.floor_number,
                "z_min": u.z_min,
                "z_max": u.z_max,
                "area_sqm": u.area_sqm
            }
            for u in building.units
        ],
        "created_at": building.created_at.isoformat()
    }
```

---

## 8. 🐘 Database Setup Instructions

### Step 1: Install PostgreSQL + PostGIS

```bash
# Ubuntu/WSL
sudo apt install postgresql postgresql-contrib postgis

# Windows: Download from https://www.postgresql.org/download/windows/
# Then install PostGIS via StackBuilder
```

### Step 2: Create Database

```sql
-- In psql as superuser (postgres)
CREATE USER ulpin_user WITH PASSWORD 'ulpin_pass';
CREATE DATABASE ulpin_db OWNER ulpin_user;
\c ulpin_db
CREATE EXTENSION postgis;
GRANT ALL PRIVILEGES ON DATABASE ulpin_db TO ulpin_user;
```

### Step 3: Set Environment Variables

```bash
# backend/.env
DATABASE_URL=postgresql+asyncpg://ulpin_user:ulpin_pass@localhost:5432/ulpin_db
AI_MODULE_PATH=../ai
SECRET_KEY=your-secret-key-here
```

### Step 4: Run Migrations

```bash
cd backend
pip install -r requirements.txt
alembic init migrations
alembic revision --autogenerate -m "initial_schema"
alembic upgrade head
```

### Step 5: Start Server

```bash
cd backend
uvicorn main:app --reload --host 0.0.0.0 --port 8000
# API docs: http://localhost:8000/docs
```

---

## 9. ✅ Testing Checklist

```
backend/tests/
├── test_models.py
│   ├── [ ] test_create_building_record()
│   ├── [ ] test_create_unit_with_ulpin()
│   ├── [ ] test_ulpin_unique_constraint()
│   └── [ ] test_postgis_geometry_store_and_retrieve()
│
├── test_routes_buildings.py
│   ├── [ ] test_post_create_returns_202()
│   ├── [ ] test_post_create_missing_fields_returns_422()
│   ├── [ ] test_get_building_returns_200()
│   ├── [ ] test_get_building_not_found_returns_404()
│   └── [ ] test_get_building_includes_units()
│
├── test_routes_units.py
│   ├── [ ] test_get_units_returns_paginated_list()
│   ├── [ ] test_get_units_filter_by_floor()
│   └── [ ] test_get_unit_not_found_returns_404()
│
├── test_routes_validation.py
│   ├── [ ] test_get_validation_valid_building()
│   ├── [ ] test_get_validation_invalid_building_shows_errors()
│   └── [ ] test_get_validation_processing_returns_202()
│
└── test_integration.py
    ├── [ ] test_full_flow_create_to_get_building()
    ├── [ ] test_units_persisted_after_ai_completes()
    └── [ ] test_validation_result_stored_after_processing()
```

**Run:**
```bash
cd backend
pytest tests/ -v --cov=. --cov-report=term-missing
# Target: > 85% coverage
```

---

## 10. 🔗 Integration Points

| Integration | Direction | Notes |
|-------------|-----------|-------|
| **Trigger AI** | Backend → AI | `from ai.pipeline import process_building` |
| **Receive AI output** | AI → Backend | Store in `buildings.ai_output` (JSONB) |
| **Serve Frontend** | Backend → Frontend | REST JSON at all 4 endpoints |
| **CORS** | Backend config | `allow_origins=["http://localhost:3000"]` |
| **Job status** | Backend → Frontend | `GET /api/jobs/{job_id}/status` |

---

## 11. 📦 Deliverables by Day 6

| Day | Task | Done |
|-----|------|------|
| Day 1 | Setup FastAPI project, PostgreSQL + PostGIS, test DB connection | `[ ]` |
| Day 2 | Create models.py + run Alembic migration — 5 tables created | `[ ]` |
| Day 3 | Implement `POST /create` with stub AI call + `GET /{id}` | `[ ]` |
| Day 4 | Implement `GET /units` with pagination + job status endpoint | `[ ]` |
| Day 5 | Wire real AI service into background task, store all results | `[ ]` |
| Day 6 | Write unit & integration tests, add CORS, open Draft PR | `[ ]` |

**requirements.txt:**
```
fastapi==0.111.0
uvicorn[standard]==0.29.0
sqlalchemy==2.0.30
asyncpg==0.29.0
geoalchemy2==0.15.1
alembic==1.13.1
pydantic==2.7.1
python-dotenv==1.0.1
httpx==0.27.0
pytest==8.1.1
pytest-asyncio==0.23.6
pytest-cov==5.0.0
```

---

*Blueprint Version: 1.0 | Last Updated: Day 1*
