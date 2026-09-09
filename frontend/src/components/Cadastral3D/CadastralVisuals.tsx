import React, { useState } from 'react';
import { motion } from 'framer-motion';
import {
  Layers,
  Box,
  ShieldCheck,
  CheckCircle2,
  AlertTriangle,
  ArrowRight,
  Maximize2,
  Hash,
  Ruler,
  Cpu
} from 'lucide-react';

/* ── 01 · 3D Property Mapping Visual ── */
export function PropertyMappingVisual() {
  const [viewMode, setViewMode] = useState<'2d' | '3d'>('3d');

  return (
    <div className="editorial-visual-card">
      <div className="card-top-bar font-mono">
        <div className="indicator-pill">
          <span className="dot" />
          <span>LOD1 EXTRUSION ENGINE</span>
        </div>
        <div className="toggle-tabs">
          <button
            type="button"
            className={`tab-btn ${viewMode === '2d' ? 'active' : ''}`}
            onClick={() => setViewMode('2d')}
          >
            2D Flat
          </button>
          <button
            type="button"
            className={`tab-btn ${viewMode === '3d' ? 'active' : ''}`}
            onClick={() => setViewMode('3d')}
          >
            3D Volume
          </button>
        </div>
      </div>

      <div className="schematic-view-area">
        {viewMode === '2d' ? (
          <div className="schematic-2d-canvas">
            <div className="flat-parcel-box">
              <div className="parcel-inner-grid" />
              <div className="parcel-label font-mono">
                <span>PARCEL #DL-ND-8492</span>
                <span className="dim">2D Area: 412.5 m²</span>
                <span className="warn">⚠️ Zero Vertical Rights</span>
              </div>
            </div>
          </div>
        ) : (
          <div className="schematic-3d-canvas">
            <div className="extrusion-stack-3d">
              <div className="roof-plane">
                <span className="font-mono">Z_max: +252.6m</span>
              </div>
              <div className="wall-facade left">
                <div className="facade-strata-lines" />
              </div>
              <div className="wall-facade front">
                <div className="facade-strata-lines" />
                <div className="dimension-callout font-mono">
                  <span>H = 38.4m</span>
                  <span>Vol = 15,840 m³</span>
                </div>
              </div>
              <div className="ground-parcel-plane">
                <span className="font-mono">Z_min: +214.2m</span>
              </div>
            </div>
          </div>
        )}
      </div>

      <div className="card-bottom-bar font-mono">
        <span>POLYGON: 4 VERTICES</span>
        <span>PROJECTION: EPSG:4326 → EPSG:3857</span>
      </div>
    </div>
  );
}

/* ── 02 · Vertical Property Registration Visual ── */
export function VerticalStrataVisual() {
  const [selectedStrata, setSelectedStrata] = useState<number>(3);

  const STRATA_LEVELS = [
    { floor: 4, name: 'Penthouse Unit #401', use: 'Residential', area: '185 m²', volume: '592 m³', status: 'Registered' },
    { floor: 3, name: 'Commercial Suite #302', use: 'Commercial Office', area: '220 m²', volume: '704 m³', status: 'Active ULPIN' },
    { floor: 2, name: 'Medical Clinic #201', use: 'Healthcare / Services', area: '210 m²', volume: '672 m³', status: 'Registered' },
    { floor: 1, name: 'Retail Bank Branch #101', use: 'Financial / Retail', area: '380 m²', volume: '1,216 m³', status: 'Registered' },
  ];

  return (
    <div className="editorial-visual-card">
      <div className="card-top-bar font-mono">
        <div className="indicator-pill">
          <Layers size={13} color="#0D9488" />
          <span>MULTI-STRATA DISSECTOR</span>
        </div>
        <span>4 REGISTERED LEVELS</span>
      </div>

      <div className="strata-interactive-list">
        {STRATA_LEVELS.map((st) => {
          const isSelected = selectedStrata === st.floor;
          return (
            <div
              key={st.floor}
              className={`strata-level-row ${isSelected ? 'selected' : ''}`}
              onClick={() => setSelectedStrata(st.floor)}
            >
              <div className="level-badge font-mono">FL 0{st.floor}</div>
              <div className="level-info">
                <div className="level-title">{st.name}</div>
                <div className="level-sub font-mono">
                  {st.use} · {st.area} · {st.volume}
                </div>
              </div>
              <div className="level-status font-mono">
                <span className={isSelected ? 'status-active' : 'status-ok'}>
                  {st.status}
                </span>
              </div>
            </div>
          );
        })}
      </div>

      <div className="card-bottom-bar font-mono">
        <span>VERTICAL TOPOLOGY: ISOLATED</span>
        <span>OVERLAPS: 0.00%</span>
      </div>
    </div>
  );
}

/* ── 03 · Spatial Validation Topology Visual ── */
export function SpatialValidationVisual() {
  return (
    <div className="editorial-visual-card">
      <div className="card-top-bar font-mono">
        <div className="indicator-pill">
          <ShieldCheck size={13} color="#10B981" />
          <span>TOPOLOGY AUDITOR</span>
        </div>
        <span className="text-green font-mono">STATUS: 100% VALID</span>
      </div>

      <div className="validation-matrix-grid">
        <div className="val-metric-box">
          <div className="val-icon"><CheckCircle2 size={16} color="#10B981" /></div>
          <div className="val-label font-mono">3D CLASH DETECTION</div>
          <div className="val-value font-mono">0 Intersections</div>
          <div className="val-sub">All floor units non-colliding</div>
        </div>

        <div className="val-metric-box">
          <div className="val-icon"><CheckCircle2 size={16} color="#10B981" /></div>
          <div className="val-label font-mono">BOUNDARY CONTAINMENT</div>
          <div className="val-value font-mono">100.0% Enclosed</div>
          <div className="val-sub">Strict parcel boundary compliance</div>
        </div>

        <div className="val-metric-box">
          <div className="val-icon"><CheckCircle2 size={16} color="#10B981" /></div>
          <div className="val-label font-mono">Z-AXIS CONTINUITY</div>
          <div className="val-value font-mono">Zero Gaps (±0.00m)</div>
          <div className="val-sub">Continuous vertical strata mesh</div>
        </div>

        <div className="val-metric-box">
          <div className="val-icon"><CheckCircle2 size={16} color="#10B981" /></div>
          <div className="val-label font-mono">ISO 19152 SCHEMA</div>
          <div className="val-value font-mono">LADM Level 3</div>
          <div className="val-sub">Fully certified schema conformant</div>
        </div>
      </div>

      <div className="card-bottom-bar font-mono">
        <span>ALGORITHM: SHAPELY 3D VOXEL CLASH DETECTOR</span>
      </div>
    </div>
  );
}

/* ── 04 · Unique 3D ULPIN Hierarchy Visual ── */
export function UniqueULPINVisual() {
  return (
    <div className="editorial-visual-card">
      <div className="card-top-bar font-mono">
        <div className="indicator-pill">
          <Hash size={13} color="#0891B2" />
          <span>SPATIAL KEY HIERARCHY</span>
        </div>
        <span>ISO 19152 COMPLIANT</span>
      </div>

      <div className="ulpin-tree-visual">
        <div className="tree-node">
          <span className="node-tag font-mono">STATE / DISTRICT</span>
          <span className="node-code font-mono">07 (DELHI-ND)</span>
        </div>
        <div className="tree-divider">↓</div>
        <div className="tree-node">
          <span className="node-tag font-mono">CENTROID GEOHASH (LAT, LON)</span>
          <span className="node-code font-mono">28.612952, 77.229514</span>
        </div>
        <div className="tree-divider">↓</div>
        <div className="tree-node">
          <span className="node-tag font-mono">VERTICAL STRATUM</span>
          <span className="node-code font-mono">LVL-04 (+12.8m Elevation)</span>
        </div>
        <div className="tree-divider">↓</div>
        <div className="tree-node active">
          <span className="node-tag font-mono">PERSISTENT 3D ULPIN MINTED</span>
          <span className="node-code font-mono highlight">07-286129-0772295-04-02</span>
        </div>
      </div>

      <div className="card-bottom-bar font-mono">
        <span>SPACE-FILLING KEY: MORTON Z-ORDER CURVE</span>
      </div>
    </div>
  );
}
