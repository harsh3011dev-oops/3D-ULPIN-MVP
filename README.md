# 3D ULPIN MVP - AI-Powered 3D Cadastral System

## Overview
Convert 2D land cadastral records to 3D property identification system using aerial imagery and GIS data.

### Problem Statement
भारतीय land records 2D हैं। एक ही plot पर 20-floor building हो सकती है, लेकिन current system नहीं बताता कि building के अंदर कौन-सा flat exactly किस 3D space में है।

**Solution**: 3D ULPIN (Unique Land Parcel Identification Number) system जो हर property को unique volumetric identity दे।

## Project Structure
3D-ULPIN-MVP/
├── ai/ # AI Module (Harsh)
│ ├── footprint_detection.py
│ ├── extrusion.py
│ ├── floor_division.py
│ ├── ulpin_generation.py
│ ├── spatial_validation.py
│ └── tests/
├── backend/ # Backend API (Prateek)
│ ├── models.py
│ ├── routes/
│ ├── database.py
│ └── tests/
├── frontend/ # 3D Map UI (Rishabh)
│ ├── components/
│ ├── pages/
│ ├── api.js
│ └── tests/
├── API_CONTRACT.md # Shared API specs
└── README.md
 
## Tech Stack
- **AI**: Python (OpenCV, Shapely, scikit-image)
- **Backend**: FastAPI + PostGIS (or Django)
- **Frontend**: React + CesiumJS / deck.gl
- **Database**: PostgreSQL with PostGIS extension

## Setup

### Prerequisites
- Git
- Python 3.9+
- Node.js 16+
- PostgreSQL + PostGIS

### Clone & Setup
```bash
git clone https://github.com/harsh3011dev-oops/3D-ULPIN-MVP.git
cd 3D-ULPIN-MVP

# Each team member in their branch
git checkout feature/ai-module        # Harsh
git checkout feature/backend          # Prateek
git checkout feature/frontend         # Rishabh
```

## 20-Day Timeline
- Days 1-2: Setup + API contract finalization
- Days 3-6: Core module development (parallel)
- Days 7-10: Integration + floor division
- Days 11-13: Spatial validation + UI
- Days 14-16: Testing + bug fixes
- Days 17-18: Pilot run on real buildings
- Days 19-20: Research paper + demo

## Git Workflow
1. Work in your `feature/xxx` branch
2. Commit regularly with clear messages
3. Daily `git pull origin develop`
4. When ready: Create PR `feature/xxx` → `develop`
5. Code review by team member
6. Merge to develop

## Testing
- Unit tests for each module
- Integration tests for API
- E2E tests for 3D visualization
- Pilot test on 2-3 real buildings

## Contributors
- **Harsh** - AI Module
- **Prateek** - Backend API
- **Rishabh** - Frontend 3D Map