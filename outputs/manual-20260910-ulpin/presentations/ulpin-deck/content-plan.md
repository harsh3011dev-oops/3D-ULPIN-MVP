# 3D ULPIN — SIH 2026 PPT Working Plan

## Core thesis

Indian land records are mostly 2D, but real property rights exist vertically: floors, flats, commercial units, basements and underground utility spaces. 3D ULPIN converts a parcel/building into validated volumetric units and assigns each unit a persistent spatial identity.

## Submission structure (6 slides)

1. **Title page**
   - Working title: **3D ULPIN: AI-Powered 3D Cadastral Intelligence**
   - Subtitle: From flat land parcels to certified volumetric property rights
   - Visual: aerial parcel → 3D building → highlighted unit / ULPIN tag
   - Need from team: exact SIH problem statement ID, official title, theme, category, team ID, registered team name.

2. **Proposed Solution**
   - Claim: 3D ULPIN gives every floor-level property unit a unique, queryable volumetric identity.
   - Three proof areas: problem gap, proposed system, what makes it novel.
   - Key points: 2D parcel + aerial/GIS data; 3D extrusion; floor/unit subdivision; ULPIN generation; spatial validation; 3D map/certificate output.

3. **Technical Approach**
   - Claim: A six-stage pipeline turns geospatial inputs into validated 3D cadastral records.
   - Flow: Input parcel boundary → footprint detection → 3D extrusion → floor/unit division → ULPIN generation → overlap/boundary validation → 3D map/API output.
   - Stack: Python, OpenCV, Shapely, scikit-image; FastAPI; PostgreSQL/PostGIS; React; deck.gl/Cesium/Three.js; GeoJSON/CityJSON-style 3D output.
   - Napkin visual needed: workflow + architecture diagram.

4. **Feasibility & Viability**
   - Claim: The MVP is implementable with existing geospatial data, open-source tools and a modular API contract.
   - Feasibility: modular AI pipeline; optional height/floor overrides; GIS-compatible output; automated tests.
   - Risks: poor imagery, missing height data, irregular buildings, legal adoption/interoperability.
   - Mitigations: OSM/terrain/AI fallback hierarchy; confidence scoring; manual override; PostGIS validation; ISO 19152/LADM-aligned data model.

5. **Impact & Benefits**
   - Claim: A volumetric cadastral layer makes vertical ownership, planning and infrastructure easier to verify.
   - Beneficiaries: citizens/property owners, municipal bodies, registries, planners, utilities, lenders/insurers.
   - Benefits: clearer property records; fewer boundary conflicts; better urban planning; underground-space visibility; machine-readable records; scalable digital governance.
   - Napkin visual needed: stakeholder/value chain or before/after comparison.

6. **Research & References**
   - Project references: official SIH template; project README/API contract/AI blueprint; OpenStreetMap; PostGIS; GeoJSON; ISO 19152/LADM reference.
   - Demo/prototype reference: local 3D map UI and generated sample outputs.
   - Include YouTube reference link supplied by team only if it is an approved inspiration/reference source.

## Napkin.ai prompt set

### Workflow prompt

Create a clean, presentation-ready horizontal workflow diagram for an AI-powered 3D cadastral system called “3D ULPIN”. Show seven sequential stages with arrows: 1) Parcel boundary + aerial/GIS input, 2) AI building footprint detection, 3) 2D-to-3D building extrusion with height/elevation, 4) floor and unit subdivision, 5) unique ULPIN generation using spatial/geohash + floor + unit identity, 6) 3D overlap and boundary validation, 7) 3D map, API and digital certificate output. Use minimal labels, a technical blue/teal palette, and emphasize the transformation from flat 2D data to validated volumetric property records. No logos, no invented statistics, no paragraphs.

### Architecture prompt

Create a clean layered system architecture diagram for “3D ULPIN”. Layers from left to right or top to bottom: Data Inputs (parcel boundaries, aerial imagery, GIS/OSM height and floor metadata), AI Processing (OpenCV footprint detection, Shapely extrusion, floor/unit division, confidence scoring), Spatial Intelligence (ULPIN generation, PostGIS geometry validation, overlap/out-of-bounds checks), Services (FastAPI and API contract), User Experience (React 3D map, unit inspection, ULPIN certificate). Use directional arrows, concise labels, editable-looking boxes, and show the key output as a certified 3D volumetric property record. No fake vendor logos or unsupported metrics.

### Impact prompt

Create a simple before-and-after visual for a presentation: on the left, a flat 2D parcel polygon with ambiguous multi-floor ownership; on the right, the same parcel transformed into a transparent 3D building with separated floors, highlighted units, underground utility volumes and a unique ULPIN tag. Add a small stakeholder rail for citizen, municipality, registry, planner and utility operator. Use a clean civic-tech style, restrained blue/teal/orange accents, and minimal text.

## Copy rules

- Keep the official SIH template headings unchanged.
- Use short bullets and diagrams; avoid paragraph blocks.
- Do not present prototype values as national-scale results.
- Mark any sample ULPIN/code as illustrative.
- Do not claim legal certification or sub-meter accuracy unless the team has verified and approved that wording.
