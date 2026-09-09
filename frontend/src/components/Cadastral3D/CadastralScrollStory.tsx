import React, { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Canvas } from '@react-three/fiber';
import { OrbitControls, Line, Html } from '@react-three/drei';
import * as THREE from 'three';
import {
  MapPin,
  Building2,
  Layers,
  Box,
  Hash,
  ArrowRight,
  ShieldCheck,
  CheckCircle2,
  Ruler,
  Maximize2
} from 'lucide-react';

interface StageConfig {
  id: number;
  key: string;
  tag: string;
  title: string;
  subtitle: string;
  description: string;
  cadFormula: string;
  metrics: { label: string; value: string }[];
  floorSeparation: number;
  highlightUnit: boolean;
  showBuilding: boolean;
  showFloors: boolean;
  showParcelOnly: boolean;
}

const STAGES: StageConfig[] = [
  {
    id: 1,
    key: 'land',
    tag: 'STAGE 01 / 05',
    title: 'Land Parcel Delineation',
    subtitle: 'WGS84 Polygon Boundary',
    description:
      'Standard 2D cadastral records define property solely by surface boundary vertices. In multi-story urban topologies, flat coordinates fail to register vertical ownership rights.',
    cadFormula: 'Boundary(P) = {(lat_i, lon_i) | i ∈ [1..N]}',
    metrics: [
      { label: 'PARCEL ID', value: 'DL-ND-07-8492' },
      { label: 'FOOTPRINT AREA', value: '412.50 m²' },
      { label: 'GEODETIC DATUM', value: 'WGS84 / EPSG:4326' },
      { label: 'SURFACE STATUS', value: 'Surveyed & Verified' },
    ],
    floorSeparation: 0,
    highlightUnit: false,
    showBuilding: false,
    showFloors: false,
    showParcelOnly: true,
  },
  {
    id: 2,
    key: 'building',
    tag: 'STAGE 02 / 05',
    title: 'Volumetric LoD1 Extrusion',
    subtitle: 'Envelope Height Projection',
    description:
      'Using OpenStreetMap heights, LiDAR elevation or AI computer vision inference, the 2D footprint is procedurally extruded into a 3D bounding geometry with accurate vertical limits.',
    cadFormula: 'Volume(B) = Area(P) × (Z_max - Z_min)',
    metrics: [
      { label: 'TOTAL HEIGHT', value: '38.40 m' },
      { label: 'ELEVATION BASE', value: 'Z_min: +214.2 m' },
      { label: 'ELEVATION ROOF', value: 'Z_max: +252.6 m' },
      { label: 'TOTAL VOLUME', value: '15,840.0 m³' },
    ],
    floorSeparation: 0,
    highlightUnit: false,
    showBuilding: true,
    showFloors: false,
    showParcelOnly: false,
  },
  {
    id: 3,
    key: 'floor',
    tag: 'STAGE 03 / 05',
    title: 'Vertical Strata Division',
    subtitle: 'Multi-Level Floor Separation',
    description:
      'The building volume is topologically sliced into discrete horizontal strata planes. Each floor level acquires dedicated Z-elevation intervals, floor heights, and structural indices.',
    cadFormula: 'Strata(k) = { (x, y, z) | z ∈ [Z_k, Z_k + h_k] }',
    metrics: [
      { label: 'TOTAL LEVELS', value: '12 Floors (G + 11)' },
      { label: 'FLOOR HEIGHT', value: '3.20 m / level' },
      { label: 'SLICING ALGORITHM', value: 'Topological PolySlicer' },
      { label: 'VERTICES / SLAB', value: '8 Coplanar Points' },
    ],
    floorSeparation: 0.28,
    highlightUnit: false,
    showBuilding: true,
    showFloors: true,
    showParcelOnly: false,
  },
  {
    id: 4,
    key: 'unit',
    tag: 'STAGE 04 / 05',
    title: 'Property Unit Isolation',
    subtitle: 'Individual Sub-Volume Cadastre',
    description:
      'Within a specific floor stratum, distinct property subdivisions (apartments, retail suites, utility rooms) are isolated into 3D bounded unit parcels with certified ownership records.',
    cadFormula: 'Unit(k, u) = Strata(k) ∩ Subdivision(u)',
    metrics: [
      { label: 'SELECTED UNIT', value: 'Unit #402 (Commercial)' },
      { label: 'UNIT FLOOR', value: 'Level 04 (+12.8 m)' },
      { label: 'USABLE VOLUME', value: '384.0 m³' },
      { label: 'BOUNDARY INTEGRITY', value: '100% Non-Overlapping' },
    ],
    floorSeparation: 0.45,
    highlightUnit: true,
    showBuilding: true,
    showFloors: true,
    showParcelOnly: false,
  },
  {
    id: 5,
    key: 'ulpin',
    tag: 'STAGE 05 / 05',
    title: 'Persistent 3D ULPIN Minting',
    subtitle: 'ISO 19152 Space-Filling Key',
    description:
      'A deterministic, 14+ character spatial key is generated from the unit 3D centroid, geohash, floor level, and parcel code, creating an unforgeable, legally binding cadastral identity.',
    cadFormula: 'ULPIN = HASH(GeoHash_8(Lat, Lon) || Level || Unit_ID)',
    metrics: [
      { label: '3D ULPIN KEY', value: '07-286129-0772295-04-02' },
      { label: 'STANDARD', value: 'ISO 19152 LADM Ed. 2' },
      { label: 'GEOHASH PRECISION', value: 'Sub-meter (±0.05m)' },
      { label: 'SPATIAL REGISTRY', value: 'Immutable Spatial Ledger' },
    ],
    floorSeparation: 0.35,
    highlightUnit: true,
    showBuilding: true,
    showFloors: true,
    showParcelOnly: false,
  },
];

function StoryScene({ stage }: { stage: StageConfig }) {
  const parcelCorners = [
    new THREE.Vector3(-1.8, 0.02, -1.4),
    new THREE.Vector3(1.8, 0.02, -1.4),
    new THREE.Vector3(1.8, 0.02, 1.4),
    new THREE.Vector3(-1.8, 0.02, 1.4),
    new THREE.Vector3(-1.8, 0.02, -1.4),
  ];

  const totalFloors = 6;
  const targetFloor = 3;

  return (
    <group position={[0, -1.0, 0]}>
      {/* Dark CAD Grid */}
      <gridHelper args={[16, 16, '#30363D', '#21262D']} position={[0, 0, 0]} />

      {/* Parcel Outline */}
      <Line
        points={parcelCorners}
        color={stage.id === 1 ? '#06B6D4' : '#0D9488'}
        lineWidth={stage.id === 1 ? 3.5 : 2}
      />

      {/* Parcel Corner Cylinders */}
      {parcelCorners.slice(0, 4).map((pt, i) => (
        <mesh key={i} position={pt}>
          <cylinderGeometry args={[0.07, 0.07, 0.05, 16]} />
          <meshBasicMaterial color="#06B6D4" />
        </mesh>
      ))}

      {/* Stage 1: 2D Parcel Plane with Coordinate Crosshairs */}
      {stage.showParcelOnly && (
        <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, 0.01, 0]}>
          <planeGeometry args={[3.6, 2.8]} />
          <meshStandardMaterial color="#0E7490" transparent opacity={0.35} />
        </mesh>
      )}

      {/* Stage 2: Solid LoD1 Monolithic Volume */}
      {stage.showBuilding && !stage.showFloors && (
        <group position={[0, 1.5, 0]}>
          <mesh castShadow receiveShadow>
            <boxGeometry args={[3.2, 3.0, 2.4]} />
            <meshStandardMaterial color="#1F2937" roughness={0.3} metalness={0.2} />
          </mesh>
          <lineSegments>
            <edgesGeometry args={[new THREE.BoxGeometry(3.2, 3.0, 2.4)]} />
            <lineBasicMaterial color="#06B6D4" linewidth={2} />
          </lineSegments>
          {/* Dimension indicator */}
          <Html position={[2.2, 0, 0]} center>
            <div className="cad-dimension-badge font-mono">H = 38.4m</div>
          </Html>
        </group>
      )}

      {/* Stages 3, 4, 5: Exploded Floor Strata Slabs */}
      {stage.showFloors && (
        <group>
          {Array.from({ length: totalFloors }).map((_, idx) => {
            const isTarget = idx === targetFloor;
            const yPos = idx * 0.45 + idx * stage.floorSeparation;
            const slabColor = isTarget && stage.highlightUnit
              ? '#0D9488'
              : idx % 2 === 0
              ? '#1E293B'
              : '#334155';
            const edgeColor = isTarget && stage.highlightUnit ? '#22D3EE' : '#64748B';

            return (
              <group key={idx} position={[0, yPos + 0.25, 0]}>
                <mesh castShadow receiveShadow>
                  <boxGeometry args={[3.2, 0.35, 2.4]} />
                  <meshStandardMaterial
                    color={slabColor}
                    roughness={0.3}
                    metalness={0.2}
                    emissive={isTarget && stage.highlightUnit ? '#083344' : '#000000'}
                  />
                </mesh>
                <lineSegments>
                  <edgesGeometry args={[new THREE.BoxGeometry(3.2, 0.35, 2.4)]} />
                  <lineBasicMaterial color={edgeColor} linewidth={1.5} />
                </lineSegments>

                {/* Technical Level Labels on Side */}
                <Html position={[-2.2, 0, 0]} center distanceFactor={14}>
                  <div className={`cad-floor-tag font-mono ${isTarget ? 'active' : ''}`}>
                    FL {String(idx + 1).padStart(2, '0')}
                  </div>
                </Html>

                {/* Stage 5: Minted ULPIN Tagging */}
                {isTarget && stage.id === 5 && (
                  <Html position={[2.2, 0.4, 1.2]} center distanceFactor={11}>
                    <div className="cadastral-ulpin-tag-card">
                      <div className="ulpin-tag-header">
                        <ShieldCheck size={13} color="#22D3EE" />
                        <span>MINTED 3D ULPIN</span>
                      </div>
                      <div className="ulpin-tag-code font-mono">07-286129-0772295-04-02</div>
                      <div className="ulpin-tag-meta">VOL: 384 m³ · STRATA LVL 04</div>
                    </div>
                  </Html>
                )}
              </group>
            );
          })}
        </group>
      )}
    </group>
  );
}

export default function CadastralScrollStory() {
  const [activeStageId, setActiveStageId] = useState<number>(1);
  const activeStage = STAGES.find((s) => s.id === activeStageId) || STAGES[0];

  return (
    <section id="cadastral-story" className="cadastral-story-section">
      <div className="story-header-bar">
        <div className="story-section-tag">
          <Layers size={14} color="#0D9488" />
          <span>CADASTRAL STRATA RESOLUTION ENGINE</span>
        </div>
        <h2 className="story-main-title">
          From Flat Surface to Certified 3D Volumetric Rights
        </h2>
        <p className="story-main-subtitle">
          Follow the five-stage computational sequence that turns ambiguous 2D deed footprints into legally binding, sub-meter accurate 3D property records.
        </p>
      </div>

      {/* Stage Selector Tabs */}
      <div className="stage-nav-strip">
        {STAGES.map((s) => {
          const isSelected = s.id === activeStageId;
          return (
            <button
              key={s.id}
              type="button"
              className={`stage-nav-item ${isSelected ? 'active' : ''}`}
              onClick={() => setActiveStageId(s.id)}
            >
              <span className="stage-num font-mono">0{s.id}</span>
              <span className="stage-label">{s.key.toUpperCase()}</span>
            </button>
          );
        })}
      </div>

      {/* Main 3D Interactive Stage Workbench */}
      <div className="story-workbench-grid">
        {/* Left Column: Stage Specification & CAD Telemetry */}
        <div className="workbench-telemetry-col">
          <AnimatePresence mode="wait">
            <motion.div
              key={activeStage.id}
              initial={{ opacity: 0, y: 12 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -12 }}
              transition={{ duration: 0.3 }}
              className="telemetry-card"
            >
              <div className="telemetry-tag-row">
                <span className="telemetry-tag font-mono">{activeStage.tag}</span>
                <span className="telemetry-status">
                  <CheckCircle2 size={13} color="#10B981" />
                  <span>RESOLVED</span>
                </span>
              </div>

              <h3 className="telemetry-title">{activeStage.title}</h3>
              <div className="telemetry-subtitle font-mono">{activeStage.subtitle}</div>

              <p className="telemetry-desc">{activeStage.description}</p>

              {/* Mathematical / Architectural Formula */}
              <div className="cad-formula-box font-mono">
                <div className="formula-label">SPATIAL FORMULATION</div>
                <div className="formula-text">{activeStage.cadFormula}</div>
              </div>

              {/* Metrics Grid */}
              <div className="cad-metrics-grid">
                {activeStage.metrics.map((m, idx) => (
                  <div key={idx} className="metric-cell">
                    <span className="metric-name font-mono">{m.label}</span>
                    <span className="metric-val font-mono">{m.value}</span>
                  </div>
                ))}
              </div>

              {/* Step Navigation Controls */}
              <div className="telemetry-actions">
                <button
                  type="button"
                  className="stage-ctrl-btn"
                  disabled={activeStageId === 1}
                  onClick={() => setActiveStageId((prev) => Math.max(1, prev - 1))}
                >
                  Previous Stage
                </button>
                <button
                  type="button"
                  className="stage-ctrl-btn primary"
                  disabled={activeStageId === STAGES.length}
                  onClick={() => setActiveStageId((prev) => Math.min(STAGES.length, prev + 1))}
                >
                  <span>Next: {STAGES[Math.min(STAGES.length - 1, activeStageId)]?.key.toUpperCase()}</span>
                  <ArrowRight size={14} />
                </button>
              </div>
            </motion.div>
          </AnimatePresence>
        </div>

        {/* Right Column: High-Precision 3D CAD Canvas */}
        <div className="workbench-canvas-col">
          <div className="canvas-frame-header">
            <div className="frame-status">
              <span className="frame-dot" />
              <span className="font-mono">STAGE 0{activeStage.id} 3D RENDER ENGINE</span>
            </div>
            <div className="frame-controls font-mono">
              <span>ORBIT: ENABLED</span>
              <span>FOV: 40°</span>
            </div>
          </div>

          <div className="canvas-wrapper">
            <Canvas
              shadows
              camera={{ position: [5.4, 4.2, 5.8], fov: 40 }}
              style={{ width: '100%', height: '100%' }}
            >
              <ambientLight intensity={0.7} />
              <directionalLight
                position={[8, 12, 8]}
                intensity={1.2}
                castShadow
                shadow-mapSize-width={1024}
                shadow-mapSize-height={1024}
              />
              <directionalLight position={[-6, 4, -4]} intensity={0.35} color="#38BDF8" />

              <StoryScene stage={activeStage} />

              <OrbitControls
                enableZoom={false}
                enablePan={false}
                minPolarAngle={Math.PI / 6}
                maxPolarAngle={Math.PI / 2.2}
              />
            </Canvas>
          </div>

          <div className="canvas-frame-footer font-mono">
            <span>DRAG TO INSPECT 3D VOLUMETRIC GEOMETRY</span>
            <span>TOPOLOGY: MANIFOLD MESH</span>
          </div>
        </div>
      </div>
    </section>
  );
}
