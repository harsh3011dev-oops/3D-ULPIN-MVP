# 🗺️ Frontend 3D Blueprint — 3D ULPIN MVP
**Developer**: Rishabh | **Branch**: `feature/frontend` | **Deadline**: Day 6

---

## 1. 🎯 Your Responsibility

As the Frontend 3D Visualization Developer, you are the **face** of the 3D ULPIN system. You build the React application that allows users to submit a building (aerial image + metadata), wait for AI processing to complete, and then explore the fully interactive 3D building rendered on a globe using CesiumJS. Every unit can be clicked to reveal its ULPIN, floor info, and area. You also display spatial validation alerts when errors are detected. Your UI must be fast, visually stunning, and remain functional even when the backend is loading data.

---

## 2. 📄 Page Flow

```
┌────────────────────────────────────────────────────────────┐
│  PAGE 1: Home / Upload                                      │
│  Route: /                                                   │
│  Components: UploadForm, Header                             │
│  Action: User fills form → clicks "Process Building"        │
│  → POST /api/buildings/create → receive job_id             │
│  → Navigate to /processing/{job_id}                        │
└──────────────────────┬─────────────────────────────────────┘
                       │
                       ▼
┌────────────────────────────────────────────────────────────┐
│  PAGE 2: Processing / Loading                               │
│  Route: /processing/:jobId                                  │
│  Components: ProcessingScreen, ProgressBar                  │
│  Action: Poll GET /api/jobs/{jobId}/status every 2s         │
│  → On "done": Navigate to /map/{buildingId}                │
│  → On "failed": Show error + back button                   │
└──────────────────────┬─────────────────────────────────────┘
                       │
                       ▼
┌────────────────────────────────────────────────────────────┐
│  PAGE 3: 3D Map View                                        │
│  Route: /map/:buildingId                                    │
│  Components: Map3D, UnitCard, ValidationAlert, FloorSelector│
│  Action: Load building → render 3D CesiumJS view            │
│  → Click unit → UnitCard shows ULPIN                       │
│  → Validation errors → ValidationAlert shows in sidebar    │
└────────────────────────────────────────────────────────────┘
```

---

## 3. 📁 Folder Structure

```
frontend/
├── FRONTEND_BLUEPRINT.md              ← This file
├── public/
│   ├── index.html
│   └── cesium/                        ← CesiumJS static assets (copy from node_modules)
├── src/
│   ├── index.jsx                      ← React entry point
│   ├── App.jsx                        ← Router setup (React Router v6)
│   │
│   ├── api/
│   │   └── api.js                     ← All backend API calls (axios wrappers)
│   │
│   ├── pages/
│   │   ├── HomePage.jsx               ← Page 1: Upload form
│   │   ├── ProcessingPage.jsx         ← Page 2: Polling + progress bar
│   │   └── MapPage.jsx                ← Page 3: 3D map + sidebar
│   │
│   ├── components/
│   │   ├── UploadForm/
│   │   │   ├── UploadForm.jsx         ← 4-field building submission form
│   │   │   └── UploadForm.css
│   │   ├── Map3D/
│   │   │   ├── Map3D.jsx              ← CesiumJS globe + 3D building renderer
│   │   │   └── Map3D.css
│   │   ├── UnitCard/
│   │   │   ├── UnitCard.jsx           ← Right sidebar: unit details + ULPIN
│   │   │   └── UnitCard.css
│   │   ├── ValidationAlert/
│   │   │   ├── ValidationAlert.jsx    ← Validation status banner + error list
│   │   │   └── ValidationAlert.css
│   │   ├── FloorSelector/
│   │   │   ├── FloorSelector.jsx      ← Slider to isolate individual floors
│   │   │   └── FloorSelector.css
│   │   ├── Header/
│   │   │   ├── Header.jsx             ← Top navigation bar
│   │   │   └── Header.css
│   │   └── ProgressBar/
│   │       ├── ProgressBar.jsx        ← Animated loading progress
│   │       └── ProgressBar.css
│   │
│   ├── hooks/
│   │   ├── useBuilding.js             ← React Query hook: fetch building data
│   │   ├── useJobStatus.js            ← Polling hook for job processing status
│   │   └── useValidation.js           ← Fetch validation result for a building
│   │
│   ├── mocks/
│   │   ├── mockBuilding.js            ← Hardcoded building response (offline dev)
│   │   └── mockUnits.js               ← Hardcoded units array (offline dev)
│   │
│   └── styles/
│       ├── global.css                 ← Global dark theme, font, reset
│       └── variables.css              ← CSS custom properties (colors, spacing)
│
├── .env
├── package.json
└── README.md
```

---

## 4. 🧩 4 Key Components

### Component 1: `UploadForm.jsx`
**File**: `src/components/UploadForm/UploadForm.jsx`

```jsx
import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { createBuilding } from '../../api/api';
import './UploadForm.css';

/**
 * UploadForm Component
 *
 * Renders a form for submitting a new building to the 3D ULPIN pipeline.
 * Fields: aerial image URL, parcel ID, building height, floor count.
 * On submit: calls POST /api/buildings/create and navigates to /processing/{job_id}.
 *
 * Props: none
 * State: formData (object), loading (bool), error (string|null)
 */
export default function UploadForm() {
  const navigate = useNavigate();
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);

  const [formData, setFormData] = useState({
    parcel_id: '',
    aerial_image_url: '',
    height_meters: '',
    floor_count: '',
    // For MVP: use a fixed test parcel boundary (Delhi coordinates)
    parcel_boundary: {
      type: 'Polygon',
      coordinates: [[[77.049, 28.592], [77.050, 28.592], [77.050, 28.593], [77.049, 28.592]]]
    }
  });

  const handleChange = (e) => {
    setFormData({ ...formData, [e.target.name]: e.target.value });
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setLoading(true);
    setError(null);

    try {
      const payload = {
        ...formData,
        height_meters: parseFloat(formData.height_meters),
        floor_count: parseInt(formData.floor_count, 10),
      };

      const response = await createBuilding(payload);
      // Navigate to processing page with job_id
      navigate(`/processing/${response.job_id}`, {
        state: { building_id: response.building_id }
      });

    } catch (err) {
      setError(err.message || 'Submission failed. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="upload-form-container">
      <h2 className="upload-form-title">🏢 Submit Building for 3D ULPIN Generation</h2>

      {error && <div className="upload-form-error">{error}</div>}

      <form onSubmit={handleSubmit} className="upload-form">

        <div className="form-group">
          <label htmlFor="parcel_id">Parcel ID</label>
          <input
            id="parcel_id"
            name="parcel_id"
            type="text"
            placeholder="e.g. PARCEL_001"
            value={formData.parcel_id}
            onChange={handleChange}
            required
          />
        </div>

        <div className="form-group">
          <label htmlFor="aerial_image_url">Aerial Image URL</label>
          <input
            id="aerial_image_url"
            name="aerial_image_url"
            type="url"
            placeholder="https://storage.example.com/image.jpg"
            value={formData.aerial_image_url}
            onChange={handleChange}
            required
          />
        </div>

        <div className="form-row">
          <div className="form-group">
            <label htmlFor="height_meters">Building Height (meters)</label>
            <input
              id="height_meters"
              name="height_meters"
              type="number"
              placeholder="e.g. 45"
              min="3"
              max="500"
              value={formData.height_meters}
              onChange={handleChange}
              required
            />
          </div>

          <div className="form-group">
            <label htmlFor="floor_count">Number of Floors</label>
            <input
              id="floor_count"
              name="floor_count"
              type="number"
              placeholder="e.g. 15"
              min="1"
              max="150"
              value={formData.floor_count}
              onChange={handleChange}
              required
            />
          </div>
        </div>

        <button
          type="submit"
          className="submit-btn"
          disabled={loading}
          id="submit-building-btn"
        >
          {loading ? '⏳ Processing...' : '🚀 Generate 3D ULPIN'}
        </button>
      </form>
    </div>
  );
}
```

---

### Component 2: `Map3D.jsx`
**File**: `src/components/Map3D/Map3D.jsx`

```jsx
import React, { useEffect, useRef, useState } from 'react';
import * as Cesium from 'cesium';
import 'cesium/Build/Cesium/Widgets/widgets.css';
import './Map3D.css';

/**
 * Map3D Component
 *
 * Renders an interactive CesiumJS 3D globe with the building extruded from
 * GeoJSON footprint data. Each unit is rendered as a colored 3D polygon.
 * Clicking a unit fires onUnitClick(unit) for the parent to display in UnitCard.
 *
 * Props:
 *   building (object)  — Full building data from GET /api/buildings/{id}
 *   onUnitClick (func) — Called with unit object when user clicks a unit
 *   selectedFloor (number|null) — If set, only show units on this floor
 */
export default function Map3D({ building, onUnitClick, selectedFloor }) {
  const cesiumContainerRef = useRef(null);
  const viewerRef = useRef(null);

  useEffect(() => {
    if (!cesiumContainerRef.current || viewerRef.current) return;

    // Initialize Cesium viewer
    Cesium.Ion.defaultAccessToken = process.env.REACT_APP_CESIUM_TOKEN;

    const viewer = new Cesium.Viewer(cesiumContainerRef.current, {
      terrain: Cesium.Terrain.fromWorldTerrain(),
      timeline: false,
      animation: false,
      baseLayerPicker: false,
      navigationHelpButton: false,
      sceneModePicker: false,
    });

    viewerRef.current = viewer;

    return () => {
      viewer.destroy();
      viewerRef.current = null;
    };
  }, []);

  useEffect(() => {
    if (!viewerRef.current || !building?.units) return;

    const viewer = viewerRef.current;
    viewer.entities.removeAll();

    const FLOOR_COLORS = [
      Cesium.Color.fromCssColorString('#3B82F6').withAlpha(0.7), // blue
      Cesium.Color.fromCssColorString('#10B981').withAlpha(0.7), // green
      Cesium.Color.fromCssColorString('#F59E0B').withAlpha(0.7), // amber
      Cesium.Color.fromCssColorString('#EF4444').withAlpha(0.7), // red
      Cesium.Color.fromCssColorString('#8B5CF6').withAlpha(0.7), // purple
    ];

    const units = selectedFloor
      ? building.units.filter(u => u.floor_number === selectedFloor)
      : building.units;

    units.forEach((unit) => {
      if (!unit.polygon_2d?.coordinates) return;

      const coords = unit.polygon_2d.coordinates[0];
      const positions = coords.map(([lng, lat]) =>
        Cesium.Cartesian3.fromDegrees(lng, lat, unit.z_min)
      );

      const color = FLOOR_COLORS[(unit.floor_number - 1) % FLOOR_COLORS.length];

      const entity = viewer.entities.add({
        id: unit.unit_id,
        name: unit.ulpin,
        polygon: {
          hierarchy: new Cesium.PolygonHierarchy(positions),
          extrudedHeight: unit.z_max,
          height: unit.z_min,
          material: color,
          outline: true,
          outlineColor: Cesium.Color.WHITE.withAlpha(0.5),
        },
        properties: { unit }
      });
    });

    // Fly camera to building centroid
    if (building.units.length > 0) {
      const firstUnit = building.units[0];
      const [lat, lng] = firstUnit.centroid;
      viewer.camera.flyTo({
        destination: Cesium.Cartesian3.fromDegrees(lng, lat, 500),
        duration: 2,
      });
    }

    // Click handler
    const handler = new Cesium.ScreenSpaceEventHandler(viewer.scene.canvas);
    handler.setInputAction((click) => {
      const picked = viewer.scene.pick(click.position);
      if (Cesium.defined(picked) && picked.id?.properties?.unit) {
        onUnitClick(picked.id.properties.unit.getValue());
      }
    }, Cesium.ScreenSpaceEventType.LEFT_CLICK);

    return () => handler.destroy();

  }, [building, selectedFloor, onUnitClick]);

  return (
    <div
      ref={cesiumContainerRef}
      className="map3d-container"
      id="cesium-globe"
      aria-label="3D Building Map"
    />
  );
}
```

---

### Component 3: `UnitCard.jsx`
**File**: `src/components/UnitCard/UnitCard.jsx`

```jsx
import React, { useState } from 'react';
import './UnitCard.css';

/**
 * UnitCard Component
 *
 * Right sidebar that displays detailed information about a selected unit.
 * Shows ULPIN, floor number, area, z-coordinates, and centroid.
 * Includes a copy-to-clipboard button for the ULPIN string.
 *
 * Props:
 *   unit (object|null) — Selected unit object. null = show placeholder.
 */
export default function UnitCard({ unit }) {
  const [copied, setCopied] = useState(false);

  if (!unit) {
    return (
      <div className="unit-card unit-card--empty">
        <div className="unit-card-placeholder">
          <span className="unit-card-icon">🏠</span>
          <p>Click on any unit in the 3D map to see its details</p>
        </div>
      </div>
    );
  }

  const handleCopyULPIN = async () => {
    try {
      await navigator.clipboard.writeText(unit.ulpin);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      alert(`ULPIN: ${unit.ulpin}`);
    }
  };

  return (
    <div className="unit-card" id="unit-detail-panel">
      <div className="unit-card-header">
        <h3 className="unit-card-title">🏠 Unit Details</h3>
        <span className="unit-card-id">{unit.unit_id}</span>
      </div>

      <div className="ulpin-section">
        <label className="ulpin-label">3D ULPIN</label>
        <div className="ulpin-value-row">
          <code className="ulpin-code" id="ulpin-display">{unit.ulpin}</code>
          <button
            className={`copy-btn ${copied ? 'copy-btn--copied' : ''}`}
            onClick={handleCopyULPIN}
            title="Copy ULPIN"
            id="copy-ulpin-btn"
          >
            {copied ? '✅ Copied!' : '📋 Copy'}
          </button>
        </div>
      </div>

      <div className="unit-details-grid">
        <div className="detail-item">
          <span className="detail-label">Floor</span>
          <span className="detail-value">{unit.floor_number}</span>
        </div>
        <div className="detail-item">
          <span className="detail-label">Area</span>
          <span className="detail-value">{unit.area_sqm?.toFixed(1) ?? 'N/A'} m²</span>
        </div>
        <div className="detail-item">
          <span className="detail-label">Height (Bottom)</span>
          <span className="detail-value">{unit.z_min} m</span>
        </div>
        <div className="detail-item">
          <span className="detail-label">Height (Top)</span>
          <span className="detail-value">{unit.z_max} m</span>
        </div>
        <div className="detail-item">
          <span className="detail-label">Latitude</span>
          <span className="detail-value">{unit.centroid?.[0]?.toFixed(6)}</span>
        </div>
        <div className="detail-item">
          <span className="detail-label">Longitude</span>
          <span className="detail-value">{unit.centroid?.[1]?.toFixed(6)}</span>
        </div>
      </div>
    </div>
  );
}
```

---

### Component 4: `ValidationAlert.jsx`
**File**: `src/components/ValidationAlert/ValidationAlert.jsx`

```jsx
import React, { useState } from 'react';
import './ValidationAlert.css';

/**
 * ValidationAlert Component
 *
 * Shows spatial validation status for a building. If valid: green banner.
 * If invalid: red banner with collapsible error list showing affected units.
 *
 * Props:
 *   validation (object) — Validation result from GET /api/validation/{building_id}
 *                         {valid, overlaps_detected, overlapping_units, out_of_bounds, errors}
 */
export default function ValidationAlert({ validation }) {
  const [expanded, setExpanded] = useState(false);

  if (!validation) return null;

  if (validation.valid) {
    return (
      <div className="validation-alert validation-alert--valid" id="validation-status">
        <span className="validation-icon">✅</span>
        <span className="validation-message">All units spatially valid — no overlaps detected</span>
      </div>
    );
  }

  return (
    <div className="validation-alert validation-alert--invalid" id="validation-status">
      <div className="validation-header" onClick={() => setExpanded(!expanded)}>
        <span className="validation-icon">⚠️</span>
        <span className="validation-message">
          Spatial validation failed — {validation.errors?.length} issue(s) found
        </span>
        <span className="validation-toggle">{expanded ? '▲' : '▼'}</span>
      </div>

      {expanded && (
        <div className="validation-errors" id="validation-errors-list">
          {validation.overlapping_units?.length > 0 && (
            <div className="error-section">
              <h4>🔴 Overlapping Units</h4>
              {validation.overlapping_units.map(([unit1, unit2], i) => (
                <div key={i} className="error-item">
                  <code>{unit1}</code> overlaps with <code>{unit2}</code>
                </div>
              ))}
            </div>
          )}

          {validation.out_of_bounds?.length > 0 && (
            <div className="error-section">
              <h4>🟠 Out of Bounds Units</h4>
              {validation.out_of_bounds.map((unitId, i) => (
                <div key={i} className="error-item">
                  <code>{unitId}</code> extends beyond building footprint
                </div>
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  );
}
```

---

## 5. 🌐 `api.js` — Backend API Helpers

**File**: `src/api/api.js`

```javascript
import axios from 'axios';

// Base URL from environment variable
const BASE_URL = process.env.REACT_APP_API_BASE_URL || 'http://localhost:8000';

const apiClient = axios.create({
  baseURL: BASE_URL,
  timeout: 30000,
  headers: { 'Content-Type': 'application/json' },
});

// ─── BUILDINGS ───────────────────────────────────────────────

/**
 * Submit a new building for AI processing.
 * @param {object} buildingData - {parcel_id, aerial_image_url, height_meters, floor_count, parcel_boundary}
 * @returns {Promise<{building_id, job_id, status}>}
 */
export async function createBuilding(buildingData) {
  const response = await apiClient.post('/api/buildings/create', buildingData);
  return response.data;
}

/**
 * Fetch complete building data including all units.
 * @param {string} buildingId - UUID of the building
 * @returns {Promise<BuildingObject>}
 */
export async function getBuilding(buildingId) {
  const response = await apiClient.get(`/api/buildings/${buildingId}`);
  return response.data;
}

/**
 * Fetch paginated list of units for a building.
 * @param {string} buildingId
 * @param {object} params - {page, limit, floor}
 * @returns {Promise<{units, total, page, limit}>}
 */
export async function getBuildingUnits(buildingId, params = {}) {
  const response = await apiClient.get(`/api/buildings/${buildingId}/units`, { params });
  return response.data;
}

// ─── VALIDATION ──────────────────────────────────────────────

/**
 * Fetch spatial validation result for a building.
 * @param {string} buildingId
 * @returns {Promise<ValidationResult>}
 */
export async function getValidation(buildingId) {
  const response = await apiClient.get(`/api/validation/${buildingId}`);
  return response.data;
}

// ─── JOBS ────────────────────────────────────────────────────

/**
 * Poll job processing status.
 * @param {string} jobId
 * @returns {Promise<{status, progress_pct, error_message}>}
 */
export async function getJobStatus(jobId) {
  const response = await apiClient.get(`/api/jobs/${jobId}/status`);
  return response.data;
}

// ─── ERROR HANDLER ───────────────────────────────────────────

apiClient.interceptors.response.use(
  (response) => response,
  (error) => {
    const message =
      error.response?.data?.detail ||
      error.response?.data?.message ||
      error.message ||
      'An unexpected error occurred';
    return Promise.reject(new Error(message));
  }
);
```

---

## 6. 👤 User Workflow (Step-by-Step)

```
USER OPENS APP  →  http://localhost:3000
     │
     ▼
[HOME PAGE]
     User sees a clean upload form
     ↓
     Fills in:
       Parcel ID:         PARCEL_001
       Aerial Image URL:  https://example.com/building.jpg
       Height:            45 meters
       Floors:            15
     ↓
     Clicks: "🚀 Generate 3D ULPIN"
     ↓
     App calls: POST /api/buildings/create
     ↓
     Receives: { building_id, job_id, status: "processing" }
     ↓
     Navigates to: /processing/job-uuid-here

[PROCESSING PAGE]
     User sees animated progress bar
     "AI is analyzing your building..."
     ↓
     App polls: GET /api/jobs/{job_id}/status every 2 seconds
     ↓
     Progress updates: 0% → 25% → 50% → 75% → 100%
     ↓
     Status becomes "done"
     ↓
     Navigates to: /map/building-uuid-here

[3D MAP PAGE]
     Camera flies to building location (Delhi)
     ↓
     3D building appears — 15 floors, each floor has 4 colored units
     ↓
     User clicks on "Unit F03 A01" (3rd floor, Unit A01)
     ↓
     Right sidebar shows:
       3D ULPIN:  PARCEL_001-550E8400-F03-UA01-ttnfv13
       Floor:     3
       Area:      75.4 m²
       Height:    6.0m → 9.0m
     ↓
     User clicks "📋 Copy" → ULPIN copied to clipboard ✅
     ↓
     Validation banner: "✅ All units spatially valid"
     ↓
     User drags floor slider to "Floor 7"
     ↓
     Map shows only Floor 7 units highlighted
```

---

## 7. 📦 Libraries Needed

```json
{
  "dependencies": {
    "react": "^18.3.0",
    "react-dom": "^18.3.0",
    "react-router-dom": "^6.23.0",
    "axios": "^1.7.2",
    "@tanstack/react-query": "^5.40.0",
    "cesium": "^1.118.0",
    "resium": "^1.17.0"
  },
  "devDependencies": {
    "@vitejs/plugin-react": "^4.3.0",
    "vite": "^5.2.0",
    "vite-plugin-cesium": "^1.3.0",
    "@testing-library/react": "^16.0.0",
    "@testing-library/jest-dom": "^6.4.0",
    "@testing-library/user-event": "^14.5.0",
    "vitest": "^1.6.0"
  }
}
```

**Install:**
```bash
cd frontend
npm install
```

**CesiumJS Token:**
```bash
# Get free token at https://cesium.com/ion/tokens
# Add to frontend/.env:
REACT_APP_CESIUM_TOKEN=your_token_here
REACT_APP_API_BASE_URL=http://localhost:8000
```

---

## 8. 🎨 Styling Guidance

### Color Palette (Dark Theme)
```css
/* src/styles/variables.css */
:root {
  /* Background */
  --bg-primary:   #0F172A;   /* Deep navy — main background */
  --bg-secondary: #1E293B;   /* Slate — cards and panels */
  --bg-tertiary:  #334155;   /* Medium slate — input backgrounds */

  /* Accent */
  --accent-blue:  #3B82F6;   /* Electric blue — primary buttons */
  --accent-green: #10B981;   /* Emerald — success states */
  --accent-amber: #F59E0B;   /* Amber — warnings */
  --accent-red:   #EF4444;   /* Red — errors */

  /* Text */
  --text-primary:   #F1F5F9; /* Near white */
  --text-secondary: #94A3B8; /* Slate grey */
  --text-code:      #7DD3FC; /* Light blue — ULPIN codes */

  /* Borders */
  --border-color: #334155;

  /* Spacing */
  --radius-sm: 6px;
  --radius-md: 12px;
  --radius-lg: 20px;

  /* Typography */
  --font-sans: 'Inter', sans-serif;
  --font-mono: 'JetBrains Mono', monospace;  /* For ULPIN codes */
}
```

### Global CSS Rules
```css
/* src/styles/global.css */
@import url('https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700&family=JetBrains+Mono:wght@400;600&display=swap');

* {
  box-sizing: border-box;
  margin: 0;
  padding: 0;
}

body {
  font-family: var(--font-sans);
  background-color: var(--bg-primary);
  color: var(--text-primary);
  min-height: 100vh;
}

/* Smooth transitions on all interactive elements */
button, input, .unit-card, .validation-alert {
  transition: all 0.2s ease;
}
```

### Design Rules
| Element | Style |
|---------|-------|
| Cards | `background: var(--bg-secondary)`, `border-radius: var(--radius-md)`, subtle `box-shadow` |
| Buttons | Gradient: `#3B82F6 → #6366F1`, hover: lift effect + glow |
| Inputs | `background: var(--bg-tertiary)`, `border: 1px solid var(--border-color)`, blue focus ring |
| ULPIN text | `font-family: var(--font-mono)`, `color: var(--text-code)`, dark bg |
| Validation valid | Green left border + subtle green glow |
| Validation invalid | Red left border + pulsing animation |

---

## 9. ✅ Testing Checklist

```
frontend/src/
├── components/UploadForm/UploadForm.test.jsx
│   ├── [ ] test_renders_all_4_input_fields()
│   ├── [ ] test_submit_button_disabled_while_loading()
│   ├── [ ] test_navigates_to_processing_on_success()
│   └── [ ] test_shows_error_message_on_api_failure()
│
├── components/UnitCard/UnitCard.test.jsx
│   ├── [ ] test_shows_placeholder_when_no_unit_selected()
│   ├── [ ] test_displays_ulpin_when_unit_provided()
│   ├── [ ] test_copy_button_copies_ulpin_to_clipboard()
│   └── [ ] test_displays_all_unit_details()
│
├── components/ValidationAlert/ValidationAlert.test.jsx
│   ├── [ ] test_shows_green_banner_when_valid()
│   ├── [ ] test_shows_red_banner_when_invalid()
│   ├── [ ] test_error_list_expands_on_click()
│   └── [ ] test_returns_null_when_no_validation_data()
│
├── api/api.test.js
│   ├── [ ] test_createBuilding_calls_correct_endpoint()
│   ├── [ ] test_getBuilding_returns_building_data()
│   ├── [ ] test_getValidation_returns_validation_result()
│   └── [ ] test_api_error_returns_human_readable_message()
│
└── pages/ProcessingPage.test.jsx
    ├── [ ] test_polls_job_status_every_2_seconds()
    ├── [ ] test_navigates_to_map_when_done()
    └── [ ] test_shows_error_when_job_fails()
```

**Run:**
```bash
cd frontend
npm test -- --coverage
# Target: > 80% coverage
```

---

## 10. 🔗 Integration Points with Backend

| What | API Call | When |
|------|----------|------|
| Submit building | `POST /api/buildings/create` | User clicks submit |
| Poll job status | `GET /api/jobs/{jobId}/status` | Every 2s on ProcessingPage |
| Load 3D building | `GET /api/buildings/{buildingId}` | On MapPage mount |
| Load units | `GET /api/buildings/{buildingId}/units` | After building loaded |
| Load validation | `GET /api/validation/{buildingId}` | After building loaded |

**Using mock data for offline dev** (when Backend is not ready):
```javascript
// src/api/api.js — toggle this for offline development
const USE_MOCK = process.env.REACT_APP_USE_MOCK === 'true';

export async function getBuilding(buildingId) {
  if (USE_MOCK) {
    const { mockBuilding } = await import('../mocks/mockBuilding.js');
    return mockBuilding;
  }
  const response = await apiClient.get(`/api/buildings/${buildingId}`);
  return response.data;
}
```

```bash
# frontend/.env.development.local
REACT_APP_USE_MOCK=true
```

---

## 11. 📦 Deliverables by Day 6

| Day | Task | Done |
|-----|------|------|
| Day 1 | Bootstrap React + Vite project, install Cesium, render globe | `[ ]` |
| Day 2 | Build `UploadForm.jsx` + `api.js` stubs, wire mock data | `[ ]` |
| Day 3 | Build `Map3D.jsx` — load static GeoJSON building, extrude in 3D | `[ ]` |
| Day 4 | Build `UnitCard.jsx` + `FloorSelector.jsx`, wire click handler | `[ ]` |
| Day 5 | Build `ValidationAlert.jsx`, connect all components on `MapPage` | `[ ]` |
| Day 6 | Connect to live backend API, write component tests, open Draft PR | `[ ]` |

**Start dev server:**
```bash
cd frontend
npm run dev
# Opens: http://localhost:3000
```

---

*Blueprint Version: 1.0 | Last Updated: Day 1*
