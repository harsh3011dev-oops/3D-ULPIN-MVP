# 🌐 3D-ULPIN: AI-Powered 3D Cadastral & Volumetric Land Registry System

<div align="center">

[![FastAPI](https://img.shields.io/badge/Backend-FastAPI-009688.svg?style=for-the-badge&logo=fastapi&logoColor=white)](https://fastapi.tiangolo.com)
[![React](https://img.shields.io/badge/Frontend-React%2018%20%2B%20Vite-61DAFB.svg?style=for-the-badge&logo=react&logoColor=black)](https://reactjs.org/)
[![Deck.gl](https://img.shields.io/badge/Geospatial-deck.gl%20v9-1870C2.svg?style=for-the-badge)](https://deck.gl/)
[![Three.js](https://img.shields.io/badge/3D%20Engine-Three.js-000000.svg?style=for-the-badge&logo=three.js&logoColor=white)](https://threejs.org/)
[![Python](https://img.shields.io/badge/Python-3.10%20%7C%203.11-3776AB.svg?style=for-the-badge&logo=python&logoColor=white)](https://python.org)
[![TypeScript](https://img.shields.io/badge/TypeScript-5.4-3178C6.svg?style=for-the-badge&logo=typescript&logoColor=white)](https://www.typescriptlang.org/)
[![Google Gemini](https://img.shields.io/badge/Vision%20AI-Gemini%202.5%20Flash-4285F4.svg?style=for-the-badge&logo=google&logoColor=white)](https://deepmind.google/technologies/gemini/)
[![PostGIS](https://img.shields.io/badge/Database-PostgreSQL%20%2B%20PostGIS-336791.svg?style=for-the-badge&logo=postgresql&logoColor=white)](https://postgis.net/)
[![License](https://img.shields.io/badge/License-MIT-green.svg?style=for-the-badge)](LICENSE)

<p align="center">
  <b>Next-Generation Volumetric Cadastral Registry & 3D Spatial Digital Twin Engine</b><br>
  Modernizing 2D Land Records into Multi-Layer Volumetric Parcel Digital Twins under the <b>Digital India Land Records Modernization Programme (DILRMP)</b> and <b>ISO 19152 LADM</b> standards.
</p>

</div>

---

## 📌 Executive Summary

Traditional cadastral systems worldwide rely on **2D surface parcel boundaries (Khasra / Plot maps)**. In high-density urban environments, multi-story buildings, vertical towers, underground utilities, and multi-owner strata developments all share a single 2D spatial footprint.

```
 Traditional 2D Cadastre                3D-ULPIN Volumetric Digital Twin
 ┌─────────────────────────┐            ┌───────────────────────────┐  ▲ +80m (Penthouse)
 │  Parcel ID: DL-04-1029  │            │  ULPIN-3D: DL-1029-F24-U02│  │
 │  Footprint: 1,200 sq.m  │   ──────►  ├───────────────────────────┤  │
 │  Owner: [Multiple]      │            │  ULPIN-3D: DL-1029-F12-U01│  │
 │  Elevation: Undefined   │            ├───────────────────────────┤  │ 0.0m (Ground Level)
 └─────────────────────────┘            │  Subsurface Utility Rights│  ▼ -12m (Basement/Pipes)
                                        └───────────────────────────┘
```

### The 2D Land Record Deficit
* **Vertical Ambiguity**: Conventional systems cannot define individual property boundaries in multi-tier developments.
* **Subsurface Blind Spots**: Lack of spatial tracking for subterranean utility networks, transportation tunnels, and subterranean parking structures.
* **Transaction Friction**: Financial institutions, municipal corporations, and citizens face ambiguity in cross-verifying vertical spatial titles.

### The 3D-ULPIN Solution
**3D-ULPIN (Unique Land Parcel Identification Number - 3D)** expands India's standard 14-digit Bhu-Aadhaar / ULPIN into a **Volumetric Spatial Envelope** defined by geodetic coordinates, vertical elevation profiles, and discrete strata ownership units:

$$\text{ULPIN-3D} = \mathcal{H}\Big(\text{Parcel}_{2\text{D}}, Z_{\min}, Z_{\max}, \text{Floor}_{\text{idx}}, \text{Unit}_{\text{idx}}, \text{SpatialCentroid}\Big)$$

The platform integrates high-resolution satellite imagery, OpenStreetMap vector geometries, Google Gemini Multimodal Vision AI, and PostGIS 3D spatial indexing to generate automated, compliant Level of Detail (LoD-1 / LoD-2) cadastral digital twins.

---

## 🌟 Key Capabilities

### 1. 🛰️ Multi-Source Geospatial Ingestion & Reconstruction
* **Autonomous Footprint Extraction**: High-precision building footprint vectorization from ESRI World Imagery, Mapbox, and OpenStreetMap Overpass geometries.
* **Polygon Smoothing & Regularization**: Geometric refinement pipelines utilizing Douglas-Peucker and Shapely topological algorithms to eliminate digitization noise.
* **Universal Coordinate Parser**: Single-input ingestion workbench supporting Decimal Degrees (`28.6139, 77.2090`), Directional Degrees (`28.6139°N, 77.2090°E`), DMS (`28°36'50"N, 77°12'32"E`), and reverse geodetic lookups with real-time **WGS84 (EPSG:4326)** validation.

### 2. 🤖 Gemini Multimodal Vision & Architectural Intelligence
* **Multimodal Aerial & Facade Analysis**: Integrated `gemini-2.5-flash` vision models analyze high-resolution aerial perspectives to classify architectural styles, roof typologies (flat, pitched, domed, hipped), and structural dimensions.
* **Intelligent Floor & Height Stratification**: Automatically computes structural heights, floor counts, and inter-story clearances from spatial imagery and regional building codes.
* **Deterministic Fallback Heuristics**: Embedded domain heuristics ensure seamless inference across areas with varying satellite coverage.

### 3. 🏙️ Immersive 3D Cadastral Digital Twin Studio
* **High-Performance WebGL/WebGPU Viewport**: Powered by **Deck.gl v9**, **Three.js**, and **MapLibre GL** for 60 FPS rendering of dense urban meshes.
* **Interactive Strata Slicing & X-Ray Mode**: Click-to-inspect individual vertical apartments, common areas, and commercial units with live volumetric telemetry ($z_{\min}, z_{\max}, \text{Built-up Area}$).
* **Dynamic Solar & Daylight Simulation**: Real-time celestial sun angle rendering to inspect shadow envelopes and solar rights across neighboring parcels.
* **Standard Asset Export**: One-click export to **GeoJSON-3D**, **CityJSON**, **OBJ**, and **GLTF/GLB** formats.

### 4. 🚇 Subterranean Infrastructure & Utility Mapping
* **3D Utility Network Visualization**: Interactive 3D pipeline layers representing water mains, electrical conduits, gas pipelines, and stormwater infrastructure beneath parcels.
* **Vertical Clearance Telemetry**: Real-time distance and buffer calculations between subterranean utility corridors and building foundation envelopes.

### 5. 🛡️ 3D Topological Validation Engine
* **Non-Overlap Verification**: Automated 3D Boolean intersection checks confirming zero volumetric collisions between adjacent units.
* **Boundary Containment Analysis**: Assures all internal strata remain strictly within the legal parent parcel envelope.
* **Confidence Scoring**: Outputs comprehensive validation manifests with quantitative topological integrity scores.

---

## 🏗️ System Architecture

```mermaid
flowchart TD
    subgraph Client["Frontend Presentation Layer (React 18 + TypeScript + Vite)"]
        UI["Ingestion Workbench & Search HUD"]
        DeckMap["Deck.gl v9 + Three.js 3D Viewport"]
        StrataUI["Strata Inspection & Telemetry Panel"]
        UtilUI["Subsurface Utility Visualizer"]
    end

    subgraph Gateway["API Gateway & Service Layer (FastAPI)"]
        Router["REST Controller (/api/v1)"]
        AsyncQueue["Asynchronous Background Job Orchestrator"]
        CacheLayer["In-Memory & Distributed Cache"]
    end

    subgraph AIEngine["Spatial AI & Geometric Engine"]
        CV["Footprint Extruder & Topology Processor"]
        OSM["OSM Overpass / Vector Service"]
        GeminiVision["Google Gemini 2.5 Multimodal Vision API"]
        SatEngine["ESRI / Mapbox Satellite Tile Engine"]
        StrataEngine["Volumetric Strata Partitioning & ULPIN Generator"]
    end

    subgraph DataStore["Persistence & Spatial Registry"]
        Postgres[("PostgreSQL + PostGIS (Supabase)")]
        MeshStore["3D Geometry & Tile Asset Repository"]
        AuditLog["Validation & Audit Trail Records"]
    end

    UI -->|Parcel Coordinates / Landmark| Router
    Router --> AsyncQueue
    AsyncQueue --> SatEngine
    SatEngine -->|High-Res Aerial Tiles| GeminiVision
    AsyncQueue --> OSM
    OSM --> CV
    GeminiVision -->|Architectural & Height Metrics| CV
    CV --> StrataEngine
    StrataEngine -->|Volumetric 3D Parcels + ULPINs| Postgres
    StrataEngine --> MeshStore
    AsyncQueue --> AuditLog
    Postgres --> Router
    Router -->|3D GeoJSON / Streamed Meshes| DeckMap
    DeckMap --> StrataUI
    DeckMap --> UtilUI
```

---

## 🛠️ Technology Stack

| Layer | Technology | Description |
| :--- | :--- | :--- |
| **Frontend Framework** | React 18, TypeScript 5.4, Vite | Modern, typed component architecture with rapid HMR |
| **3D & Geospatial Engine** | Deck.gl v9, Three.js, MapLibre GL, React Three Fiber | Hardware-accelerated 3D tile rendering and spatial projection |
| **UI & Motion** | Framer Motion, Lucide Icons, Vanilla CSS Tokens | Glassmorphic design system with micro-interactions |
| **Backend Framework** | FastAPI (Python 3.10 / 3.11), Uvicorn, Pydantic v2 | High-throughput asynchronous REST API |
| **Spatial & AI Engine** | OpenCV, Shapely, GeoPandas, `google-genai` | Geometric polygon operations, 3D extrusions & Multimodal AI |
| **Database & GIS** | PostgreSQL 15+, PostGIS 3.3+, Supabase | 3D spatial indexing (`ST_3DIntersects`, `ST_Extrude`) |
| **Data Providers** | OpenStreetMap Overpass API, ESRI World Imagery | Global base vector boundaries and satellite imagery |
| **Container & CI** | Docker, Render Cloud Blueprint, Pytest | Production-ready containerization and automated testing |

---

## 📁 Repository Structure

```
3D-ULPIN-MVP/
├── ai/                                # Spatial AI & 3D Extrusion Engine
│   ├── footprint_detection_v2.py     # Satellite polygon extraction & contouring
│   ├── extrusion.py                   # 2D footprint to 3D volumetric extrusion
│   ├── floor_division.py              # Strata vertical floor & unit partitioning
│   ├── gemini_vision_analyzer.py      # Gemini Multimodal satellite vision analyzer
│   ├── pipeline.py                    # End-to-end spatial modeling pipeline
│   ├── ulpin_generation.py            # 3D ULPIN unique cryptographic hash generator
│   └── utils/                         # Geodesy & coordinate transform utilities
│
├── backend/                           # FastAPI Cloud Backend
│   ├── api/                           # Route controllers & API versioning
│   │   └── endpoints.py               # REST endpoints (/buildings, /jobs, /validation)
│   ├── services/                      # Core business services & GIS adapters
│   │   ├── ai_runner.py               # Asynchronous task orchestrator
│   │   ├── gemini_architectural_inference.py # Architectural inference engine
│   │   ├── gemini_lookup.py           # Landmark coordinate resolver
│   │   └── supabase_service.py        # PostGIS persistence & transaction manager
│   ├── config.py                      # Application settings & environment schemas
│   ├── database.py                    # Async SQLAlchemy & GeoAlchemy connections
│   ├── schemas.py                     # Pydantic request/response data contracts
│   ├── main.py                        # FastAPI application lifecycle entrypoint
│   └── tests/                         # Pytest automated test suites
│
├── frontend/                          # React + Vite 3D Web Application
│   ├── src/
│   │   ├── components/
│   │   │   ├── Cadastral3D/           # 3D globe & architectural visualizers
│   │   │   ├── Header/                # Navigation bar with dark glassmorphism
│   │   │   ├── Map3D/                 # Three.js & Deck.gl geospatial canvas
│   │   │   └── UndergroundPanel/      # Subterranean utility network controller
│   │   ├── pages/
│   │   │   ├── ExplorePage.tsx        # Ingestion Workbench (Universal coordinate input)
│   │   │   ├── MapPage.tsx            # Full-screen 3D Cadastral Digital Twin Studio
│   │   │   └── ProcessingPage.tsx     # Real-time pipeline execution monitor
│   │   ├── utils/                     # Geodetic parsers, unit formatters & API client
│   │   └── styles/                    # Design tokens & dark theme CSS variables
│   └── package.json
│
├── sample_data/                       # Reference geospatial datasets & aerial imagery
├── Dockerfile                         # Production multi-stage Docker container
├── requirements.txt                   # Backend Python dependencies
├── render.yaml                        # Cloud deployment specification
└── pytest.ini                         # Pytest configuration
```

---

## ⚡ Quickstart Guide

### Prerequisites
* **Python**: `3.10` or `3.11`
* **Node.js**: `v18.0.0+` or `v20.0.0+` (`npm` included)
* **Git**: `2.30+`
* *(Optional)* **Google Gemini API Key**: Obtainable from [Google AI Studio](https://aistudio.google.com/)

---

### Step 1: Clone the Repository
```bash
git clone https://github.com/harsh3011dev-oops/3D-ULPIN-MVP.git
cd 3D-ULPIN-MVP
```

---

### Step 2: Backend Setup & Configuration

```bash
# Create and activate Python virtual environment
python -m venv venv

# Windows (PowerShell / Command Prompt):
.\venv\Scripts\activate

# Linux / macOS:
source venv/bin/activate

# Install dependencies
pip install -r requirements.txt

# Configure environment variables
cp backend/.env.example backend/.env
```

Configure your `backend/.env` file:
```env
PORT=8000
DEBUG=True
GEMINI_API_KEY="your-gemini-api-key"
DATABASE_URL="postgresql+asyncpg://postgres:password@localhost:5432/3d_ulpin"
SUPABASE_URL="https://your-project.supabase.co"
SUPABASE_KEY="your-supabase-service-key"
```

Start the FastAPI application:
```bash
python -m uvicorn backend.main:app --reload --port 8000
```
Interactive OpenAPI documentation will be accessible at [`http://127.0.0.1:8000/docs`](http://127.0.0.1:8000/docs).

---

### Step 3: Frontend Setup & Launch

```bash
cd frontend

# Install Node dependencies
npm install

# Start the Vite development server
npm run dev
```
Open your browser at [`http://localhost:3000`](http://localhost:3000) (or the port specified by Vite).

---

## 🐳 Docker Deployment

The project includes a production-ready container definition:

```bash
# Build Docker image
docker build -t 3d-ulpin-mvp .

# Run container with environment configuration
docker run -p 8000:8000 --env-file backend/.env 3d-ulpin-mvp
```

---

## 📡 REST API Reference

All routes are version-prefixed under `/api/v1` (with backward-compatible `/api` aliases).

### 1. Ingest Parcel & Initiate 3D Generation
`POST /api/v1/buildings/create`

**Request Payload:**
```json
{
  "parcel_id": "PARCEL-DEL-2024-001",
  "building_name": "Antigravity Tower",
  "address": "Connaught Place, New Delhi",
  "latitude": 28.6315,
  "longitude": 77.2167,
  "height_meters": 48.0,
  "floor_count": 16,
  "aerial_image_path": "https://example.com/aerial.jpg"
}
```

**Response (202 Accepted):**
```json
{
  "status": "pending",
  "message": "Building processing started. Poll /jobs/{job_id}/status for progress.",
  "job_id": "9b1deb4d-3b7d-4bad-9bdd-2b0d7b3dcb6d"
}
```

---

### 2. Poll Asynchronous Job Status
`GET /api/v1/jobs/{job_id}/status`

**Response (200 OK):**
```json
{
  "job_id": "9b1deb4d-3b7d-4bad-9bdd-2b0d7b3dcb6d",
  "status": "completed",
  "progress_pct": 100,
  "progress_step": "3D Volumetric Mesh Generated",
  "building_id": "bldg_8f9c112a",
  "error_message": null
}
```

---

### 3. Retrieve 3D Volumetric Parcel Record
`GET /api/v1/buildings/{building_id}`

**Response Structure (200 OK):**
```json
{
  "building_id": "bldg_8f9c112a",
  "parcel_id": "PARCEL-DEL-2024-001",
  "building_name": "Antigravity Tower",
  "height_meters": 48.0,
  "floor_count": 16,
  "total_units": 64,
  "footprint": {
    "type": "Polygon",
    "coordinates": [[[77.2165, 28.6313], [77.2169, 28.6313], [77.2169, 28.6317], [77.2165, 28.6317], [77.2165, 28.6313]]]
  },
  "units": [
    {
      "unit_id": "UNIT_F04_U02",
      "ulpin": "DEL-2024-001-F04-U02-77212863",
      "floor": 4,
      "floor_height_m": 3.0,
      "z_min": 9.0,
      "z_max": 12.0,
      "area_sqft": 1450.0,
      "centroid": [28.6315, 77.2167],
      "polygon_2d": { "type": "Polygon", "coordinates": [...] }
    }
  ],
  "validation": {
    "is_valid": true,
    "overlaps_detected": 0,
    "out_of_bounds": 0,
    "confidence_score": 0.98,
    "errors": []
  }
}
```

---

### 4. Automated Landmark & Coordinate Resolution
`POST /api/v1/buildings/auto-detect`

**Request Payload:**
```json
{
  "building_name": "Qutub Minar",
  "city": "New Delhi"
}
```

**Response (200 OK):**
```json
{
  "latitude": 28.5245,
  "longitude": 77.1855,
  "height_meters": 72.5,
  "floor_count": 5,
  "building_type": "monument",
  "confidence": 0.99
}
```

---

### 5. Architectural AI Metadata Inference
`POST /api/v1/ai/infer-building-metadata`

**Request Payload:**
```json
{
  "footprint_area_sqm": 850.0,
  "aspect_ratio": 1.4,
  "estimated_height": 32.0,
  "osm_tags": { "amenity": "commercial" }
}
```

**Response (200 OK):**
```json
{
  "roof_shape": "flat",
  "building_material": "concrete_glass",
  "estimated_floors": 9,
  "interstory_height_m": 3.55,
  "confidence": 0.94
}
```

---

## 🏛️ Policy & Spatial Standards Compliance

* **DILRMP (Digital India Land Records Modernization Programme)**: Upgrades 2D unique parcel numbers into 3D vertical spatial rights representations.
* **OGC CityGML 3.0 & 3D Tiles Standard**: Strict conformance to standard Level of Detail (LoD-1 block models and LoD-2 roof/facade features) for geometric interoperability.
* **ISO 19152:2012 / LADM (Land Administration Domain Model)**: Full support for 3D Spatial Units (`LA_SpatialUnit`), volumetric boundaries, and legal strata rights.
* **Geodetic Standard**: Native **WGS84 (EPSG:4326)** coordinates with metric projection handling (**EPSG:3857 / UTM**).

---

## 🧪 Testing & Quality Assurance

### Automated Backend Test Suite
The backend includes test coverage validating API contracts, geometry extrusions, topological validation rules, and AI service resilience:

```bash
# Execute pytest test suites with verbose output
python -m pytest backend/tests/ -v
```

### Frontend Type Validation & Production Build
```bash
cd frontend
npm run build
```

---

## 🗺️ Strategic Roadmap

- [x] **Phase 1: Ingestion & 3D Extrusion Engine**
  - High-precision coordinate parsing (Decimal, DMS, Directional).
  - OpenStreetMap vector extraction and automated extrusion.
- [x] **Phase 2: Multimodal AI & Architectural Intelligence**
  - Google Gemini 2.5 Flash multimodal aerial analysis.
  - Strata floor partitioning and 3D ULPIN hash encoding.
- [x] **Phase 3: Digital Twin Viewport & Subterranean Mapping**
  - Deck.gl v9 + Three.js GPU rendering.
  - Subsurface utility pipeline integration and strata slicing.
- [ ] **Phase 4: Sovereign Enterprise Integrations**
  - Direct integration with state revenue land record portals (Bhoomi, Dharani, AnyROR).
  - High-density LiDAR Point Cloud mesh densification (LoD-3).
  - Smart-contract legal strata registry on permissioned distributed ledgers.

---

## 👥 Engineering & Authors

* **Harsh** &mdash; AI Computer Vision, Satellite Segmentation & Gemini Vision Engine
* **Prateek** &mdash; FastAPI Cloud Backend, PostGIS Spatial Indexing & Task Orchestration
* **Rishabh** &mdash; Geospatial 3D Viewport, Deck.gl / Three.js Visualizer & UI/UX Architecture

---

## 📄 License

This project is licensed under the **MIT License** &mdash; see the [LICENSE](LICENSE) file for complete details.