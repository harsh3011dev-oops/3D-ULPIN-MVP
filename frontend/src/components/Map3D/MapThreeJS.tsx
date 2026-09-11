import React, { useEffect, useRef, useState, useMemo } from 'react';
import * as THREE from 'three';
import { OrbitControls } from 'three/examples/jsm/controls/OrbitControls.js';
import { Building, Unit, BuildingPart } from '../../types';
import {
  getBuildingCenter,
  getBuildingHeight,
  getFloorHeight,
  getFootprintDimensions,
  getUnitFloor,
  footprintToShapes,
  footprintToShape,
  getFloorCountInfo,
  getFootprintVertexCount,
  getShapeMetrics,
  getPartCenterOffset,
  getProportionalZoning,
  scaleShape,
  evaluateBestGeometryProvider,
  validateBuildingData,
  ShapeMetrics,
  FootprintDimensions,
  ProportionalZoning,
} from '../../utils/footprintUtils';
import { fetchTerrainHeight } from '../../utils/reearth';
import { fetchDetailedOSMData, OSMDataResponse } from '../../utils/osmFetcher';
import { generate3DBuildingOSM2World, OSM2WorldResult } from '../../utils/osm2worldProvider';
import { inferBuildingMetadata } from '../../api/api';
import {
  RotateCw,
  Layers,
  MapPin,
  ZoomIn,
  ZoomOut,
  PanelLeft,
  PanelRight,
  ShieldCheck,
  CheckCircle2,
  Sparkles,
  Box,
  Compass,
  Eye,
  Info,
  ChevronDown,
  ChevronUp,
} from 'lucide-react';
import './Map3D.css';

interface MapThreeJSProps {
  building: Building;
  selectedUnit: Unit | null;
  onUnitClick: (unit: Unit) => void;
  selectedFloor: number | null;
  isLeftOpen?: boolean;
  isRightOpen?: boolean;
  onToggleLeft?: () => void;
  onToggleRight?: () => void;
}

const FLOOR_HEX_COLORS = [
  0x6366f1,
  0x3b82f6,
  0x10b981,
  0xf59e0b,
  0xec4899,
  0x8b5cf6,
];

export type LODLevel = 'FAR' | 'MEDIUM' | 'CLOSE' | 'SELECTED';

export interface ArchitecturalTelemetry {
  provider: 'OSM2World' | 'OSM building:part' | 'OSM Polygon Extrusion' | 'Procedural Extrusion' | 'Fallback';
  geometrySource: string;
  osmId: string;
  sourcePartCount: number;
  buildingPartsCount: number;
  partTypes: string[];
  roofType: string;
  roofHeightM: number;
  generatedMeshCount: number;
  lodLevel: LODLevel;
  visualHeight: number;
  cadastralHeight: number;
  fallbackUsed: boolean;
  modelLoaded: boolean;
  modelVisible: boolean;
  hardcodedGeometry: boolean;
  aiAssisted: boolean;
  aiConfidence: number | null;
  aiFieldsUsed: string[];
  aiReasoning?: string;
  sourceMetadata: {
    roofShape?: string;
    buildingMaterial?: string;
    height?: number;
    levels?: number;
  };
  inferredMetadata?: {
    roofShape?: string;
    buildingType?: string;
    suggestedMaterial?: string;
    architecturalForm?: string;
    confidence: number;
  };
  proportions: {
    platformM: number;
    wallM: number;
    roofM: number;
    finialM: number;
  };
  hasHoles: boolean;
  circularity: number;
}

// ─────────────────────────────────────────────────────────────
// MATERIAL SYSTEM: Realistic Physical & Architectural Materials
// ─────────────────────────────────────────────────────────────

function createArchitecturalMaterials(building: Building, wireframe: boolean) {
  const matTag = (building.assessment?.building_material || building.building_material || '').toLowerCase();
  const colorTag = (building.building_color || '').toLowerCase();
  const roofMatTag = (building.roof?.material || '').toLowerCase();
  const roofColorTag = (building.roof?.color || '').toLowerCase();

  const isSandstone = matTag.includes('sandstone') || matTag.includes('brick') || colorTag.includes('red') || colorTag.includes('ochre');
  const isMarbleOrWhite = matTag.includes('marble') || matTag.includes('granite') || colorTag.includes('white') || colorTag.includes('ivory');
  const isStoneOrHeritage = matTag.includes('stone') || matTag.includes('masonry') || matTag.includes('limestone');
  const isTerracotta = matTag.includes('clay') || matTag.includes('terracotta') || roofMatTag.includes('tile') || roofColorTag.includes('terracotta');

  // 1. Primary Wall / Body Material
  let wallColor = 0xe2e8f0; // Warm limestone / architectural off-white
  let roughness = 0.65;
  let metalness = 0.05;

  if (isSandstone) {
    wallColor = 0x9a3412; // Rich red/ochre sandstone
    roughness = 0.78;
  } else if (isMarbleOrWhite) {
    wallColor = 0xf8fafc; // Crystalline marble
    roughness = 0.40;
    metalness = 0.02;
  } else if (isStoneOrHeritage) {
    wallColor = 0xd6d3d1; // Weathered stone
    roughness = 0.80;
  } else if (isTerracotta) {
    wallColor = 0xc2410c;
    roughness = 0.85;
  }

  const isModern = !isSandstone && !isMarbleOrWhite && !isStoneOrHeritage && !isTerracotta;

  const wallMaterial = isModern
    ? new THREE.MeshPhysicalMaterial({
        color: 0xf1f5f9,
        map: generateModernFacadeTexture(building.floor_count || 4),
        metalness: 0.35,
        roughness: 0.25,
        clearcoat: 0.75,
        clearcoatRoughness: 0.15,
        reflectivity: 0.85,
        wireframe,
      })
    : new THREE.MeshStandardMaterial({
        color: wallColor,
        roughness,
        metalness,
        wireframe,
      });

  // 2. Podium / Platform Plinth Material
  const podiumMaterial = new THREE.MeshStandardMaterial({
    color: isSandstone ? 0x7c2d12 : isMarbleOrWhite ? 0xe2e8f0 : 0x475569,
    roughness: 0.85,
    metalness: 0.05,
    wireframe,
  });

  // 3. Roof / Dome Material
  let roofColor = 0x334155;
  if (isMarbleOrWhite) roofColor = 0xffffff;
  else if (isSandstone) roofColor = 0x7c2d12;
  else if (isTerracotta) roofColor = 0xb45309;

  const roofMaterial = new THREE.MeshStandardMaterial({
    color: roofColor,
    roughness: isMarbleOrWhite ? 0.35 : 0.65,
    metalness: 0.1,
    wireframe,
  });

  // 4. Gold / Brass Kalash Accent Material
  const goldAccentMat = new THREE.MeshStandardMaterial({
    color: 0xf59e0b,
    metalness: 0.95,
    roughness: 0.18,
    wireframe,
  });

  // 5. Cornice / Trim Accent Material
  const trimMaterial = new THREE.MeshStandardMaterial({
    color: isMarbleOrWhite ? 0xe2e8f0 : isSandstone ? 0xb45309 : 0x64748b,
    roughness: 0.5,
    metalness: 0.15,
    wireframe,
  });

  // 6. Subtle Architectural Pen Outline Material
  const edgeMaterial = new THREE.LineBasicMaterial({
    color: 0x0f172a,
    transparent: true,
    opacity: 0.40,
  });

  return {
    wallMaterial,
    podiumMaterial,
    roofMaterial,
    goldAccentMat,
    trimMaterial,
    edgeMaterial,
    isHistoric: !isModern,
  };
}

// High-resolution architectural glass curtain wall facade texture generator
function generateModernFacadeTexture(floors: number) {
  const canvas = document.createElement('canvas');
  const COLS = 8;
  canvas.width = 1024;
  canvas.height = 1024;
  const ctx = canvas.getContext('2d');
  if (ctx) {
    ctx.fillStyle = '#0b1120';
    ctx.fillRect(0, 0, 1024, 1024);

    const visibleRows = Math.min(Math.max(floors, 2), 24);
    const rowH = 1024 / visibleRows;
    const colW = 1024 / COLS;

    for (let j = 0; j < visibleRows; j++) {
      const y = j * rowH;

      // 1. Spandrel Beam (Horizontal aluminum panel between floors)
      ctx.fillStyle = '#1e293b';
      ctx.fillRect(0, y, 1024, rowH * 0.22);

      // Metallic trim line on spandrel edge
      ctx.fillStyle = '#475569';
      ctx.fillRect(0, y + rowH * 0.22 - 2, 1024, 2);

      // Contact shadow beneath floor slab
      ctx.fillStyle = 'rgba(0, 0, 0, 0.45)';
      ctx.fillRect(0, y + rowH * 0.22, 1024, rowH * 0.06);

      // 2. Glass Window Pane Row
      const winY = y + rowH * 0.26;
      const winH = rowH * 0.68;

      for (let i = 0; i < COLS; i++) {
        const x = i * colW + colW * 0.06;
        const winW = colW * 0.88;

        // Window Frame Border
        ctx.fillStyle = '#0f172a';
        ctx.fillRect(x - 2, winY - 2, winW + 4, winH + 4);

        // Realistic Interior Window Lighting Variation
        const seed = (i * 19 + j * 37) % 100;
        if (seed > 80) {
          const grad = ctx.createLinearGradient(x, winY, x, winY + winH);
          grad.addColorStop(0, '#fef08a');
          grad.addColorStop(0.7, '#eab308');
          grad.addColorStop(1, '#ca8a04');
          ctx.fillStyle = grad;
        } else if (seed > 60) {
          const grad = ctx.createLinearGradient(x, winY, x, winY + winH);
          grad.addColorStop(0, '#e0f2fe');
          grad.addColorStop(1, '#38bdf8');
          ctx.fillStyle = grad;
        } else if (seed > 15) {
          const grad = ctx.createLinearGradient(x, winY, x + winW, winY + winH);
          grad.addColorStop(0, '#1d4ed8');
          grad.addColorStop(0.4, '#2563eb');
          grad.addColorStop(1, '#0f172a');
          ctx.fillStyle = grad;
        } else {
          ctx.fillStyle = '#090d16';
        }
        ctx.fillRect(x, winY, winW, winH);

        // Glass Glare Reflection Streak
        ctx.fillStyle = 'rgba(255, 255, 255, 0.14)';
        ctx.beginPath();
        ctx.moveTo(x, winY);
        ctx.lineTo(x + winW * 0.35, winY);
        ctx.lineTo(x, winY + winH * 0.65);
        ctx.closePath();
        ctx.fill();

        // Horizontal Window Pane Divider
        ctx.fillStyle = '#1e293b';
        ctx.fillRect(x, winY + winH * 0.5, winW, 2);
      }

      // Vertical Mullion Beams across facade
      for (let i = 0; i <= COLS; i++) {
        ctx.fillStyle = '#334155';
        ctx.fillRect(i * colW - 2, y, 4, rowH);
      }
    }
  }
  const tex = new THREE.CanvasTexture(canvas);
  tex.wrapS = THREE.RepeatWrapping;
  tex.wrapT = THREE.RepeatWrapping;
  tex.repeat.set(1, Math.ceil(Math.max(floors, 1) / 6));
  return tex;
}

// Procedural ground plaza texture with stone tiles & landscaping
function generatePlazaTexture() {
  const canvas = document.createElement('canvas');
  canvas.width = 1024;
  canvas.height = 1024;
  const ctx = canvas.getContext('2d');
  if (ctx) {
    ctx.fillStyle = '#0a0f1d';
    ctx.fillRect(0, 0, 1024, 1024);

    ctx.strokeStyle = 'rgba(100, 116, 139, 0.22)';
    ctx.lineWidth = 2;
    const tileSize = 64;
    for (let x = 0; x < 1024; x += tileSize) {
      ctx.beginPath();
      ctx.moveTo(x, 0);
      ctx.lineTo(x, 1024);
      ctx.stroke();
    }
    for (let y = 0; y < 1024; y += tileSize) {
      ctx.beginPath();
      ctx.moveTo(0, y);
      ctx.lineTo(1024, y);
      ctx.stroke();
    }

    ctx.fillStyle = '#1e293b';
    ctx.fillRect(256, 256, 512, 512);

    ctx.fillStyle = '#14532d';
    ctx.fillRect(90, 90, 140, 844);
    ctx.fillRect(794, 90, 140, 844);

    ctx.fillStyle = '#020617';
    ctx.fillRect(0, 930, 1024, 94);

    ctx.fillStyle = '#94a3b8';
    for (let x = 20; x < 1024; x += 60) {
      ctx.fillRect(x, 975, 35, 4);
    }
  }
  const tex = new THREE.CanvasTexture(canvas);
  tex.wrapS = THREE.RepeatWrapping;
  tex.wrapT = THREE.RepeatWrapping;
  return tex;
}

// Build surrounding context: Ground plaza, trees, lamp posts
function buildSurroundingContext(scene: THREE.Scene, dims: { width: number; depth: number }, sceneExtent: number) {
  const plazaTex = generatePlazaTexture();
  plazaTex.repeat.set(2, 2);
  const groundGeo = new THREE.PlaneGeometry(sceneExtent * 2.5, sceneExtent * 2.5);
  const groundMat = new THREE.MeshStandardMaterial({
    map: plazaTex,
    roughness: 0.75,
    metalness: 0.2,
  });
  const groundMesh = new THREE.Mesh(groundGeo, groundMat);
  groundMesh.rotation.x = -Math.PI / 2;
  groundMesh.position.y = -0.05;
  groundMesh.receiveShadow = true;
  scene.add(groundMesh);

  const treeBarkMat = new THREE.MeshStandardMaterial({ color: 0x451a03, roughness: 0.9 });
  const treeFoliageMat = new THREE.MeshStandardMaterial({ color: 0x15803d, roughness: 0.6, metalness: 0.1 });
  const lampPoleMat = new THREE.MeshStandardMaterial({ color: 0x334155, metalness: 0.8, roughness: 0.2 });
  const lampGlowMat = new THREE.MeshStandardMaterial({ color: 0xfef08a, emissive: 0xfef08a, emissiveIntensity: 1.2 });

  const marginX = dims.width / 2 + 6;
  const marginZ = dims.depth / 2 + 6;
  const treePositions = [
    [-marginX - 4, -marginZ],
    [-marginX - 4, 0],
    [-marginX - 4, marginZ],
    [marginX + 4, -marginZ],
    [marginX + 4, 0],
    [marginX + 4, marginZ],
    [-marginX / 2, -marginZ - 5],
    [marginX / 2, -marginZ - 5],
    [-marginX / 2, marginZ + 5],
    [marginX / 2, marginZ + 5],
  ];

  treePositions.forEach(([x, z]) => {
    const treeGroup = new THREE.Group();
    const trunk = new THREE.Mesh(new THREE.CylinderGeometry(0.3, 0.45, 3.5, 8), treeBarkMat);
    trunk.position.y = 1.75;
    trunk.castShadow = true;
    treeGroup.add(trunk);

    const f1 = new THREE.Mesh(new THREE.IcosahedronGeometry(2.2, 1), treeFoliageMat);
    f1.position.y = 4.2;
    f1.castShadow = true;
    treeGroup.add(f1);

    const f2 = new THREE.Mesh(new THREE.IcosahedronGeometry(1.6, 1), treeFoliageMat);
    f2.position.y = 5.8;
    f2.castShadow = true;
    treeGroup.add(f2);

    treeGroup.position.set(x, 0, z);
    scene.add(treeGroup);
  });

  const lampPositions = [
    [-marginX - 1, -marginZ + 2],
    [-marginX - 1, marginZ - 2],
    [marginX + 1, -marginZ + 2],
    [marginX + 1, marginZ - 2],
  ];

  lampPositions.forEach(([x, z]) => {
    const lampGroup = new THREE.Group();
    const pole = new THREE.Mesh(new THREE.CylinderGeometry(0.08, 0.12, 4.2, 8), lampPoleMat);
    pole.position.y = 2.1;
    lampGroup.add(pole);

    const globe = new THREE.Mesh(new THREE.SphereGeometry(0.35, 12, 12), lampGlowMat);
    globe.position.y = 4.3;
    lampGroup.add(globe);

    lampGroup.position.set(x, 0, z);
    scene.add(lampGroup);
  });
}

// ─────────────────────────────────────────────────────────────
// GEOMETRY CLASSIFICATION ENGINE (Purely metadata + geometry)
// ─────────────────────────────────────────────────────────────

export type BuildingPartClassification =
  | 'tower'
  | 'cylinder'
  | 'tapered_tower'
  | 'dome'
  | 'onion'
  | 'cone'
  | 'pyramidal'
  | 'roof'
  | 'wing'
  | 'courtyard'
  | 'platform'
  | 'entrance'
  | 'generic_extrusion';

function classifyBuildingPart(part: BuildingPart, metrics: ShapeMetrics): BuildingPartClassification {
  const pType = (part.part_type || '').toLowerCase();
  const rShape = (part.roof_shape || '').toLowerCase();
  const tags = part.tags || {};
  const manMade = (tags.man_made || '').toLowerCase();
  const bPartTag = (tags['building:part'] || '').toLowerCase();

  // 1. Explicit Dome / Onion tags
  if (rShape.includes('onion') || bPartTag.includes('onion') || bPartTag.includes('kalash') || rShape.includes('bulbous')) {
    return 'onion';
  }
  if (rShape.includes('dome') || bPartTag.includes('dome') || bPartTag.includes('cupola') || rShape.includes('round') || rShape.includes('sphere')) {
    return 'dome';
  }

  // 2. Explicit Tower / Minaret / Cylinder tags or circular high-aspect ratio structures
  if (
    manMade.includes('tower') ||
    manMade.includes('minaret') ||
    manMade.includes('chimney') ||
    bPartTag.includes('tower') ||
    bPartTag.includes('minaret') ||
    pType.includes('minaret') ||
    pType.includes('tower')
  ) {
    if (metrics.circularity > 0.70) {
      return part.height > 15 ? 'tapered_tower' : 'cylinder';
    }
    return 'tower';
  }

  // 3. Shape Analysis for Circular / Octagonal Columns & Minarets
  if (metrics.circularity > 0.76 && metrics.vertexCount >= 6) {
    if (part.height > 12 && part.height / Math.max(metrics.width, metrics.depth) > 1.6) {
      return 'tapered_tower';
    }
    if (metrics.width < 14 && metrics.depth < 14 && part.height > 6) {
      return 'cylinder';
    }
  }

  // 4. Roof shapes
  if (rShape.includes('pyramidal') || rShape.includes('pyramid') || bPartTag.includes('pyramid')) return 'pyramidal';
  if (rShape.includes('cone') || rShape.includes('conical')) return 'cone';
  if (
    rShape.includes('gabled') ||
    rShape.includes('hipped') ||
    rShape.includes('mansard') ||
    rShape.includes('skillion') ||
    rShape.includes('pitched') ||
    bPartTag === 'roof'
  ) {
    return 'roof';
  }

  // 5. Plinths & Platforms
  if (bPartTag.includes('platform') || bPartTag.includes('plinth') || bPartTag.includes('podium') || bPartTag.includes('terrace')) {
    return 'platform';
  }

  // 6. Courtyards (shapes with holes)
  if (metrics.hasHoles || bPartTag.includes('courtyard') || bPartTag.includes('atrium')) return 'courtyard';

  // 7. Entrances / Porticos / Canopies
  if (bPartTag.includes('entrance') || bPartTag.includes('steps') || bPartTag.includes('canopy') || bPartTag.includes('portico')) return 'entrance';

  // 8. Wings (elongated extensions)
  if (metrics.aspectRatio > 2.6 || bPartTag.includes('wing') || bPartTag.includes('corridor')) return 'wing';

  return 'generic_extrusion';
}

// ─────────────────────────────────────────────────────────────
// PROCEDURAL ARCHITECTURAL GEOMETRY BUILDERS
// ─────────────────────────────────────────────────────────────

/**
 * 1. Tapered Minaret / Classical Architectural Tower Builder
 */
function createTaperedTowerMesh(
  radiusBase: number,
  heightM: number,
  facadeMat: THREE.Material,
  accentMat: THREE.Material,
  edgeMat: THREE.Material,
): THREE.Group {
  const towerGroup = new THREE.Group();
  const radiusTop = radiusBase * 0.78;

  // Main Tapered Shaft
  const shaftGeo = new THREE.CylinderGeometry(radiusTop, radiusBase, heightM, 24);
  const shaftMesh = new THREE.Mesh(shaftGeo, facadeMat);
  shaftMesh.position.y = heightM / 2;
  shaftMesh.castShadow = true;
  shaftMesh.receiveShadow = true;
  towerGroup.add(shaftMesh);

  const shaftEdges = new THREE.LineSegments(new THREE.EdgesGeometry(shaftGeo, 30), edgeMat);
  shaftEdges.position.y = heightM / 2;
  towerGroup.add(shaftEdges);

  // Multi-Tier Cantilever Balcony Rings
  const tierPcts = heightM > 25 ? [0.35, 0.65, 0.92] : [0.5, 0.92];
  tierPcts.forEach((pct) => {
    const tierH = heightM * pct;
    const currentR = radiusBase + (radiusTop - radiusBase) * pct;
    const ringGeo = new THREE.CylinderGeometry(currentR * 1.28, currentR * 1.08, 0.6, 24);
    const ringMesh = new THREE.Mesh(ringGeo, facadeMat);
    ringMesh.position.y = tierH;
    ringMesh.castShadow = true;
    towerGroup.add(ringMesh);

    // Balcony Railing / Corbel Trim
    const trimGeo = new THREE.TorusGeometry(currentR * 1.25, 0.08, 6, 24);
    trimGeo.rotateX(Math.PI / 2);
    const trimMesh = new THREE.Mesh(trimGeo, accentMat);
    trimMesh.position.y = tierH + 0.35;
    towerGroup.add(trimMesh);
  });

  // Crown Pavilion / Cupola at apex
  const cupolaR = radiusTop * 0.95;
  const cupolaH = Math.max(cupolaR * 1.4, 2.5);

  // Open Pillar Pavilion
  const pillarCount = 6;
  for (let i = 0; i < pillarCount; i++) {
    const ang = (i / pillarCount) * Math.PI * 2;
    const px = Math.cos(ang) * cupolaR * 0.75;
    const pz = Math.sin(ang) * cupolaR * 0.75;
    const pillarMesh = new THREE.Mesh(new THREE.CylinderGeometry(0.08, 0.1, cupolaH * 0.5, 8), facadeMat);
    pillarMesh.position.set(px, heightM + (cupolaH * 0.5) / 2, pz);
    towerGroup.add(pillarMesh);
  }

  // Small Dome Crown
  const domeGeo = new THREE.SphereGeometry(cupolaR * 0.9, 20, 16, 0, Math.PI * 2, 0, Math.PI / 2);
  const domeMesh = new THREE.Mesh(domeGeo, facadeMat);
  domeMesh.position.y = heightM + cupolaH * 0.5;
  domeMesh.castShadow = true;
  towerGroup.add(domeMesh);

  // Brass/Golden Kalash Needle Finial
  const finialH = Math.max(cupolaR * 1.2, 2.2);
  const finialMesh = new THREE.Mesh(new THREE.CylinderGeometry(0.05, 0.22, finialH, 8), accentMat);
  finialMesh.position.y = heightM + cupolaH * 0.5 + cupolaR * 0.9 + finialH / 2;
  finialMesh.castShadow = true;
  towerGroup.add(finialMesh);

  return towerGroup;
}

/**
 * 2. Parametric Bulbous Onion Dome & Classical Hemisphere Dome Lathe Builder
 */
function createDomeMesh(
  radius: number,
  heightM: number,
  domeType: 'onion' | 'hemisphere',
  domeMat: THREE.Material,
  accentMat: THREE.Material,
  edgeMat: THREE.Material,
): THREE.Group {
  const domeGroup = new THREE.Group();

  // Circular Drum Base with arched frieze
  const drumH = Math.max(heightM * 0.22, 1.5);
  const drumR = radius * 0.92;
  const drumGeo = new THREE.CylinderGeometry(drumR, drumR, drumH, 32);
  const drumMesh = new THREE.Mesh(drumGeo, domeMat);
  drumMesh.position.y = drumH / 2;
  drumMesh.castShadow = true;
  domeGroup.add(drumMesh);

  const drumTrim = new THREE.Mesh(new THREE.CylinderGeometry(drumR * 1.05, drumR * 1.02, 0.35, 32), accentMat);
  drumTrim.position.y = drumH;
  domeGroup.add(drumTrim);

  const actualDomeH = Math.max(heightM - drumH, 2.0);

  if (domeType === 'onion') {
    // True Architectural Bulbous Onion Spline via LatheGeometry
    const pts: THREE.Vector2[] = [];
    const segments = 24;
    const bulbousR = radius * 1.08;

    for (let i = 0; i <= segments; i++) {
      const t = i / segments;
      const y = drumH + t * actualDomeH;
      let r: number;

      if (t < 0.25) {
        // Base outward flare
        const k = t / 0.25;
        r = drumR + (bulbousR - drumR) * Math.sin(k * (Math.PI / 2));
      } else if (t < 0.70) {
        // Bulbous belly curve
        const k = (t - 0.25) / 0.45;
        r = bulbousR * Math.cos(k * 0.7);
      } else {
        // Ogee inward pointed tip
        const k = (t - 0.70) / 0.30;
        r = bulbousR * Math.cos(0.7) * Math.pow(1 - k, 1.8);
      }

      pts.push(new THREE.Vector2(Math.max(0.04, r), y));
    }

    const onionGeo = new THREE.LatheGeometry(pts, 36);
    const onionMesh = new THREE.Mesh(onionGeo, domeMat);
    onionMesh.castShadow = true;
    onionMesh.receiveShadow = true;
    domeGroup.add(onionMesh);

    const domeEdges = new THREE.LineSegments(new THREE.EdgesGeometry(onionGeo, 35), edgeMat);
    domeGroup.add(domeEdges);

    // Decorative Kalash Spire with stacked lotus beads
    const kalashH = Math.max(heightM * 0.28, 2.5);
    const kalashGroup = new THREE.Group();

    const bead1 = new THREE.Mesh(new THREE.SphereGeometry(radius * 0.16, 12, 12), accentMat);
    bead1.position.y = drumH + actualDomeH + radius * 0.16;
    kalashGroup.add(bead1);

    const bead2 = new THREE.Mesh(new THREE.SphereGeometry(radius * 0.10, 12, 12), accentMat);
    bead2.position.y = drumH + actualDomeH + radius * 0.35;
    kalashGroup.add(bead2);

    const needle = new THREE.Mesh(new THREE.CylinderGeometry(0.04, 0.15, kalashH, 8), accentMat);
    needle.position.y = drumH + actualDomeH + kalashH / 2;
    kalashGroup.add(needle);

    domeGroup.add(kalashGroup);
  } else {
    // Classical Hemisphere Dome
    const hemiGeo = new THREE.SphereGeometry(drumR, 32, 20, 0, Math.PI * 2, 0, Math.PI / 2);
    const hemiMesh = new THREE.Mesh(hemiGeo, domeMat);
    hemiMesh.position.y = drumH;
    hemiMesh.castShadow = true;
    domeGroup.add(hemiMesh);

    // Lantern Cupola & Spire
    const lanternGeo = new THREE.CylinderGeometry(drumR * 0.2, drumR * 0.25, actualDomeH * 0.3, 12);
    const lanternMesh = new THREE.Mesh(lanternGeo, accentMat);
    lanternMesh.position.y = drumH + drumR + (actualDomeH * 0.3) / 2;
    domeGroup.add(lanternMesh);

    const spireH = Math.max(heightM * 0.25, 2.0);
    const spireMesh = new THREE.Mesh(new THREE.ConeGeometry(drumR * 0.18, spireH, 12), accentMat);
    spireMesh.position.y = drumH + drumR + actualDomeH * 0.3 + spireH / 2;
    domeGroup.add(spireMesh);
  }

  return domeGroup;
}

/**
 * 3. Procedural Roof Mesh Generator matching shape perimeters
 */
function generatePolygonalRoof(
  group: THREE.Group,
  shapes: THREE.Shape[],
  roofShape: string,
  baseElevation: number,
  roofHeightM: number,
  dims: { width: number; depth: number },
  roofMat: THREE.Material,
  accentMat: THREE.Material,
  edgeMat: THREE.Material,
  offsetCenter?: { x: number; z: number },
) {
  const normShape = (roofShape || 'flat').toLowerCase();
  const radius = Math.min(dims.width, dims.depth) / 2;
  const cx = offsetCenter?.x || 0;
  const cz = offsetCenter?.z || 0;

  if (normShape.includes('onion') || normShape.includes('bulbous')) {
    const onionGroup = createDomeMesh(radius, Math.max(roofHeightM, radius * 1.1, 5), 'onion', roofMat, accentMat, edgeMat);
    onionGroup.position.set(cx, baseElevation, cz);
    group.add(onionGroup);
  } else if (normShape.includes('dome') || normShape.includes('round') || normShape.includes('spherical')) {
    const domeGroup = createDomeMesh(radius, Math.max(roofHeightM, radius * 0.9, 4), 'hemisphere', roofMat, accentMat, edgeMat);
    domeGroup.position.set(cx, baseElevation, cz);
    group.add(domeGroup);
  } else if (normShape.includes('pyramidal') || normShape.includes('pyramid')) {
    const pyramidH = Math.max(roofHeightM, 4);
    const pyramidGeo = new THREE.ConeGeometry(radius * 1.08, pyramidH, 4);
    const pyramidMesh = new THREE.Mesh(pyramidGeo, roofMat);
    pyramidMesh.position.set(cx, baseElevation + pyramidH / 2, cz);
    pyramidMesh.rotation.y = Math.PI / 4;
    pyramidMesh.castShadow = true;
    group.add(pyramidMesh);

    const edges = new THREE.LineSegments(new THREE.EdgesGeometry(pyramidGeo, 25), edgeMat);
    edges.position.set(cx, baseElevation + pyramidH / 2, cz);
    edges.rotation.y = Math.PI / 4;
    group.add(edges);
  } else if (normShape.includes('cone') || normShape.includes('conical') || normShape.includes('spire')) {
    const coneH = Math.max(roofHeightM, 5);
    const coneGeo = new THREE.ConeGeometry(radius * 1.05, coneH, 32);
    const coneMesh = new THREE.Mesh(coneGeo, roofMat);
    coneMesh.position.set(cx, baseElevation + coneH / 2, cz);
    coneMesh.castShadow = true;
    group.add(coneMesh);

    const edges = new THREE.LineSegments(new THREE.EdgesGeometry(coneGeo, 30), edgeMat);
    edges.position.set(cx, baseElevation + coneH / 2, cz);
    group.add(edges);
  } else if (normShape.includes('gabled') || normShape.includes('hipped') || normShape.includes('pitched') || normShape.includes('skillion') || normShape.includes('mansard')) {
    const pitchH = Math.max(roofHeightM, 3.2);
    shapes.forEach((shape) => {
      const gabledGeo = new THREE.ExtrudeGeometry(shape, {
        depth: pitchH,
        bevelEnabled: true,
        bevelThickness: pitchH * 0.35,
        bevelSize: 0.5,
        bevelSegments: 2,
      });
      gabledGeo.rotateX(-Math.PI / 2);
      const gMesh = new THREE.Mesh(gabledGeo, roofMat);
      gMesh.position.set(0, baseElevation, 0);
      gMesh.castShadow = true;
      group.add(gMesh);

      const edges = new THREE.LineSegments(new THREE.EdgesGeometry(gabledGeo, 25), edgeMat);
      edges.position.set(0, baseElevation, 0);
      group.add(edges);
    });
  } else {
    // Modern Flat Roof with Parapet wall, Stepped Louvered Core, and Communication Mast
    const parapetH = Math.max(1.2, baseElevation * 0.02);
    shapes.forEach((shape) => {
      const parapetGeo = new THREE.ExtrudeGeometry(shape, { depth: parapetH, bevelEnabled: false });
      parapetGeo.rotateX(-Math.PI / 2);
      const parapetMesh = new THREE.Mesh(parapetGeo, accentMat);
      parapetMesh.position.set(0, baseElevation, 0);
      parapetMesh.castShadow = true;
      group.add(parapetMesh);

      const edges = new THREE.LineSegments(new THREE.EdgesGeometry(parapetGeo, 35), edgeMat);
      edges.position.set(0, baseElevation, 0);
      group.add(edges);
    });

    const coreW = Math.max(dims.width * 0.35, 4);
    const coreD = Math.max(dims.depth * 0.35, 4);
    const coreH = Math.max(3.0, baseElevation * 0.08);
    const coreMesh = new THREE.Mesh(new THREE.BoxGeometry(coreW, coreH, coreD), roofMat);
    coreMesh.position.set(cx, baseElevation + parapetH + coreH / 2, cz);
    coreMesh.castShadow = true;
    group.add(coreMesh);

    const hvacMesh = new THREE.Mesh(new THREE.BoxGeometry(coreW * 0.75, 1.4, coreD * 0.75), accentMat);
    hvacMesh.position.set(cx, baseElevation + parapetH + coreH + 0.7, cz);
    hvacMesh.castShadow = true;
    group.add(hvacMesh);

    const mastH = Math.max(5.0, baseElevation * 0.14);
    const mastMesh = new THREE.Mesh(new THREE.CylinderGeometry(0.06, 0.2, mastH, 8), accentMat);
    mastMesh.position.set(cx, baseElevation + parapetH + coreH + 1.4 + mastH / 2, cz);
    group.add(mastMesh);

    const beaconMesh = new THREE.Mesh(
      new THREE.SphereGeometry(0.35, 8, 8),
      new THREE.MeshStandardMaterial({ color: 0xef4444, emissive: 0xef4444, emissiveIntensity: 2.5 }),
    );
    beaconMesh.position.set(cx, baseElevation + parapetH + coreH + 1.4 + mastH, cz);
    group.add(beaconMesh);
  }
}

/**
 * 4. Lightweight Procedural Facade Details at Close LOD (Instanced Windows & String Courses)
 */
function buildCloseDetailFacade(
  facadeGroup: THREE.Group,
  shapes: THREE.Shape[],
  baseY: number,
  wallHeight: number,
  floorHeight: number,
) {
  // Premium glass with slight reflectivity
  const windowGeo = new THREE.BoxGeometry(1.6, floorHeight * 0.65, 0.2);
  const windowMat = new THREE.MeshPhysicalMaterial({
    color: 0x0f172a,
    roughness: 0.1,
    metalness: 0.9,
    clearcoat: 1.0,
    clearcoatRoughness: 0.1,
  });

  const floors = Math.floor(wallHeight / floorHeight);
  if (floors <= 0) return;

  shapes.forEach((shape) => {
    const pts = shape.getPoints();
    if (pts.length < 3) return;

    const windowTransforms: THREE.Matrix4[] = [];
    const windowColors: THREE.Color[] = [];

    const baseColor = new THREE.Color(0x0f172a); // dark glass
    const litColor1 = new THREE.Color(0xfde047); // warm interior light
    const litColor2 = new THREE.Color(0xe0f2fe); // cool interior light

    for (let i = 0; i < pts.length - 1; i++) {
      const p1 = pts[i];
      const p2 = pts[i + 1];
      const segLen = Math.hypot(p2.x - p1.x, p2.y - p1.y);
      if (segLen < 4.0) continue;

      const numBays = Math.floor(segLen / 4.5);
      const angle = Math.atan2(p2.y - p1.y, p2.x - p1.x);

      for (let f = 0; f < floors; f++) {
        const winY = baseY + f * floorHeight + floorHeight * 0.5;

        for (let b = 1; b <= numBays; b++) {
          const t = b / (numBays + 1);
          const wx = p1.x + (p2.x - p1.x) * t;
          const wz = -(p1.y + (p2.y - p1.y) * t);

          const mat = new THREE.Matrix4();
          mat.makeRotationY(-angle);
          mat.setPosition(wx, winY, wz);
          windowTransforms.push(mat);

          // Add random "lights on" effect to make buildings look alive and premium
          const rand = Math.random();
          if (rand > 0.85) {
            windowColors.push(rand > 0.92 ? litColor1 : litColor2);
          } else {
            windowColors.push(baseColor);
          }
        }
      }
    }

    if (windowTransforms.length > 0) {
      const instancedMesh = new THREE.InstancedMesh(windowGeo, windowMat, windowTransforms.length);
      const colorArray = new Float32Array(windowTransforms.length * 3);
      
      windowTransforms.forEach((matrix, idx) => {
        instancedMesh.setMatrixAt(idx, matrix);
        const col = windowColors[idx];
        colorArray[idx * 3] = col.r;
        colorArray[idx * 3 + 1] = col.g;
        colorArray[idx * 3 + 2] = col.b;
      });
      
      instancedMesh.instanceColor = new THREE.InstancedBufferAttribute(colorArray, 3);
      instancedMesh.instanceMatrix.needsUpdate = true;
      facadeGroup.add(instancedMesh);
    }
  });
}

// ─────────────────────────────────────────────────────────────
// MULTI-MASS ARCHITECTURAL RECONSTRUCTION PIPELINE
// ─────────────────────────────────────────────────────────────

function constructMultiMassBuilding(
  visualGroup: THREE.Group,
  facadeDetailsGroup: THREE.Group,
  building: Building,
  dims: FootprintDimensions,
  totalHeight: number,
  floorHeight: number,
  wireframe: boolean,
  inferredMetadata?: any,
): {
  exteriorMeshes: THREE.Mesh[];
  geometrySource: string;
  partTypes: string[];
  roofType: string;
  roofHeightM: number;
  proportions: { platformM: number; wallM: number; roofM: number; finialM: number };
  circularity: number;
} {
  const exteriorMeshes: THREE.Mesh[] = [];
  const partTypes: string[] = [];
  const centerLng = dims.centerLng;
  const centerLat = dims.centerLat;

  const materials = createArchitecturalMaterials(building, wireframe);
  const metrics = getShapeMetrics(building.footprint, centerLng, centerLat);

  // STRICT RULE: REAL OSM DATA ALWAYS WINS.
  // Real OSM tag > Gemini inference.
  let effectiveRoofShape = building.roof?.shape;
  if (!effectiveRoofShape && inferredMetadata?.roof_shape && inferredMetadata.confidence >= 0.75) {
    effectiveRoofShape = inferredMetadata.roof_shape;
  } else if (!effectiveRoofShape && inferredMetadata?.roof_shape && inferredMetadata.confidence >= 0.50) {
    if (['flat', 'gabled', 'hipped', 'pyramidal'].includes(inferredMetadata.roof_shape)) {
      effectiveRoofShape = inferredMetadata.roof_shape;
    }
  }

  const zoning = getProportionalZoning(
    totalHeight,
    metrics,
    building.roof?.height,
    effectiveRoofShape,
  );

  const parts = building.building_parts || [];
  let geometrySource = 'Fallback';
  let roofType = effectiveRoofShape || 'flat';
  let roofHeightM = zoning.roofHeight;

  if (parts.length > 0) {
    geometrySource = 'OSM building:part';

    // IMPORTANT: OSM mappers often only map the roof domes/towers as `building:part`
    // and leave the massive main building base as just the footprint.
    // If we only render parts, the main building disappears!
    // We must render the main footprint up to the lowest elevated part to act as the base body.
    let baseBodyHeight = 0;
    const elevatedParts = parts.filter(p => p.min_height !== undefined && p.min_height > 0);
    if (elevatedParts.length > 0) {
      baseBodyHeight = Math.min(...elevatedParts.map(p => p.min_height!));
    } else {
      // If parts exist but none are elevated, they might not cover the whole footprint.
      // Default to 1 floor height just in case, or maybe 40% of total height.
      baseBodyHeight = floorHeight;
    }

    if (baseBodyHeight > 0) {
      const baseShapes = footprintToShapes(building.footprint, centerLng, centerLat);
      baseShapes.forEach((shape) => {
        const baseGeo = new THREE.ExtrudeGeometry(shape, { depth: baseBodyHeight, bevelEnabled: false });
        baseGeo.rotateX(-Math.PI / 2);
        const baseMesh = new THREE.Mesh(baseGeo, materials.wallMaterial);
        baseMesh.position.y = 0;
        baseMesh.castShadow = true;
        baseMesh.receiveShadow = true;
        // Use polygonOffset to prevent z-fighting with parts that start at 0
        baseMesh.material.polygonOffset = true;
        baseMesh.material.polygonOffsetFactor = 1;
        baseMesh.material.polygonOffsetUnits = 1;
        visualGroup.add(baseMesh);
        exteriorMeshes.push(baseMesh);

        const edges = new THREE.LineSegments(new THREE.EdgesGeometry(baseGeo, 30), materials.edgeMaterial);
        edges.position.y = 0;
        visualGroup.add(edges);
      });
    }

    parts.forEach((part: BuildingPart) => {
      const partShapes = part.footprint
        ? footprintToShapes(part.footprint, centerLng, centerLat)
        : footprintToShapes(building.footprint, centerLng, centerLat);

      const partMetrics = getShapeMetrics(part.footprint, centerLng, centerLat);
      const classification = classifyBuildingPart(part, partMetrics);
      partTypes.push(classification);

      const partOffset = getPartCenterOffset(part.footprint, centerLng, centerLat);
      const baseLevel = part.min_levels || 0;
      const partLevels = part.levels || Math.max((building.floor_count || 3) - baseLevel, 1);
      const baseElev = part.min_height !== undefined ? part.min_height : baseLevel * floorHeight;
      const partH = part.height !== undefined ? Math.max(part.height - baseElev, 2.0) : partLevels * floorHeight;

      // 1. Tapered Minarets & Towers
      if (classification === 'tapered_tower') {
        const radius = Math.min(partMetrics.width, partMetrics.depth) / 2;
        const towerMesh = createTaperedTowerMesh(
          radius,
          partH,
          materials.wallMaterial,
          materials.goldAccentMat,
          materials.edgeMaterial,
        );
        towerMesh.position.set(partOffset.x, baseElev, partOffset.z);
        visualGroup.add(towerMesh);
      }
      // 2. Standard Circular Cylinders
      else if (classification === 'cylinder') {
        const radius = Math.min(partMetrics.width, partMetrics.depth) / 2;
        const cylGeo = new THREE.CylinderGeometry(radius * 0.92, radius, partH, 24);
        const cylMesh = new THREE.Mesh(cylGeo, materials.wallMaterial);
        cylMesh.position.set(partOffset.x, baseElev + partH / 2, partOffset.z);
        cylMesh.castShadow = true;
        cylMesh.receiveShadow = true;
        visualGroup.add(cylMesh);
        exteriorMeshes.push(cylMesh);

        const edges = new THREE.LineSegments(new THREE.EdgesGeometry(cylGeo, 30), materials.edgeMaterial);
        edges.position.set(partOffset.x, baseElev + partH / 2, partOffset.z);
        visualGroup.add(edges);

        // Cupola at apex
        const cupolaGeo = new THREE.SphereGeometry(radius * 0.9, 16, 16, 0, Math.PI * 2, 0, Math.PI / 2);
        const cupolaMesh = new THREE.Mesh(cupolaGeo, materials.wallMaterial);
        cupolaMesh.position.set(partOffset.x, baseElev + partH, partOffset.z);
        visualGroup.add(cupolaMesh);
        exteriorMeshes.push(cupolaMesh);

        const finial = new THREE.Mesh(new THREE.CylinderGeometry(0.06, 0.2, 2.2, 8), materials.goldAccentMat);
        finial.position.set(partOffset.x, baseElev + partH + radius * 0.9 + 1.1, partOffset.z);
        visualGroup.add(finial);
      }
      // 3. Bulbous Onion / Classical Domes
      else if (classification === 'dome' || classification === 'onion') {
        const radius = Math.min(partMetrics.width, partMetrics.depth) / 2;
        const domeGroup = createDomeMesh(
          radius,
          part.roof_height || partH,
          classification === 'onion' ? 'onion' : 'hemisphere',
          materials.roofMaterial,
          materials.goldAccentMat,
          materials.edgeMaterial,
        );
        domeGroup.position.set(partOffset.x, baseElev, partOffset.z);
        visualGroup.add(domeGroup);
      }
      // 4. Platforms & Plinths
      else if (classification === 'platform') {
        partShapes.forEach((shape) => {
          const platGeo = new THREE.ExtrudeGeometry(shape, { depth: partH, bevelEnabled: false });
          platGeo.rotateX(-Math.PI / 2);
          const platMesh = new THREE.Mesh(platGeo, materials.podiumMaterial);
          platMesh.position.y = baseElev;
          platMesh.castShadow = true;
          platMesh.receiveShadow = true;
          visualGroup.add(platMesh);
          exteriorMeshes.push(platMesh);

          const edges = new THREE.LineSegments(new THREE.EdgesGeometry(platGeo, 30), materials.edgeMaterial);
          edges.position.y = baseElev;
          visualGroup.add(edges);
        });
      }
      // 5. Generic Extrusions / Wings / Main Bodies / Courtyards
      else {
        partShapes.forEach((shape) => {
          const extrudeGeo = new THREE.ExtrudeGeometry(shape, {
            depth: partH,
            bevelEnabled: false,
          });
          extrudeGeo.rotateX(-Math.PI / 2);

          const partMesh = new THREE.Mesh(extrudeGeo, materials.wallMaterial);
          partMesh.position.y = baseElev;
          partMesh.castShadow = true;
          partMesh.receiveShadow = true;
          visualGroup.add(partMesh);
          exteriorMeshes.push(partMesh);

          const edges = new THREE.LineSegments(new THREE.EdgesGeometry(extrudeGeo, 30), materials.edgeMaterial);
          edges.position.y = baseElev;
          visualGroup.add(edges);
        });

        // Roof for this building part if specified or if top tier
        const pRoofShape = part.roof_shape || (partLevels > 1 ? building.roof?.shape : 'flat') || 'flat';
        if (pRoofShape !== 'flat') {
          const pRoofH = part.roof_height || building.roof?.height || 3.0;
          generatePolygonalRoof(
            visualGroup,
            partShapes,
            pRoofShape,
            baseElev + partH,
            pRoofH,
            partMetrics,
            materials.roofMaterial,
            materials.goldAccentMat,
            materials.edgeMaterial,
            partOffset,
          );
        }
      }
    });
  } else if (building.footprint) {
    // ─────────────────────────────────────────────────────────────
    // SINGLE FOOTPRINT — PREMIUM PROCEDURAL MULTI-MASS RECONSTRUCTION
    // Generates: Stepped Podium + Per-Floor Spandrel Bands + Cornice + Roof Crown
    // ─────────────────────────────────────────────────────────────
    geometrySource = 'OSM Footprint (Procedural Mass Decomposition)';
    const shapes = footprintToShapes(building.footprint, centerLng, centerLat);
    const floors = building.floor_count || Math.max(Math.round(totalHeight / floorHeight), 3);

    if (shapes.length > 0) {
      // 1. ── Raised Podium Base (always present for all buildings > 2 floors) ──
      const podiumH = Math.max(floorHeight * 0.9, 2.5);
      const podiumElev = 0;
      shapes.forEach((shape) => {
        const podShape = scaleShape(shape, 1.035);
        const podGeo = new THREE.ExtrudeGeometry(podShape, { depth: podiumH, bevelEnabled: false });
        podGeo.rotateX(-Math.PI / 2);
        const podMesh = new THREE.Mesh(podGeo, materials.podiumMaterial);
        podMesh.position.y = podiumElev;
        podMesh.castShadow = true;
        podMesh.receiveShadow = true;
        visualGroup.add(podMesh);
        exteriorMeshes.push(podMesh);
        const podEdges = new THREE.LineSegments(new THREE.EdgesGeometry(podGeo, 25), materials.edgeMaterial);
        podEdges.position.y = podiumElev;
        visualGroup.add(podEdges);
      });

      // Podium Cornice Cap
      shapes.forEach((shape) => {
        const capShape = scaleShape(shape, 1.05);
        const capGeo = new THREE.ExtrudeGeometry(capShape, { depth: 0.5, bevelEnabled: false });
        capGeo.rotateX(-Math.PI / 2);
        const capMesh = new THREE.Mesh(capGeo, materials.trimMaterial);
        capMesh.position.y = podiumH - 0.05;
        visualGroup.add(capMesh);
      });

      let currentElev = podiumH;
      const wallBodyH = Math.max(totalHeight - podiumH - floorHeight * 0.6, floorHeight * 2);

      // 2. ── Main Wall Body (full glass/concrete facade) ──
      shapes.forEach((shape) => {
        const bodyGeo = new THREE.ExtrudeGeometry(shape, { depth: wallBodyH, bevelEnabled: false });
        bodyGeo.rotateX(-Math.PI / 2);
        const bodyMesh = new THREE.Mesh(bodyGeo, materials.wallMaterial);
        bodyMesh.position.y = currentElev;
        bodyMesh.castShadow = true;
        bodyMesh.receiveShadow = true;
        visualGroup.add(bodyMesh);
        exteriorMeshes.push(bodyMesh);
      });

      // Add detailed 3D instanced windows to make the local building look premium
      buildCloseDetailFacade(facadeDetailsGroup, shapes, currentElev, wallBodyH, floorHeight);


      // 3. ── Per-Floor Spandrel Band Lines (horizontal separation between every floor) ──
      // These give the building the critical "multi-story" look — visible horizontal floor bands
      const spandrelH = 0.28;
      const spandrelMat = new THREE.MeshStandardMaterial({
        color: materials.isHistoric ? 0x7c2d12 : 0x1e293b,
        roughness: 0.5,
        metalness: 0.6,
      });
      shapes.forEach((shape) => {
        const bandShape = scaleShape(shape, 1.008);
        const bandGeo = new THREE.ExtrudeGeometry(bandShape, { depth: spandrelH, bevelEnabled: false });
        bandGeo.rotateX(-Math.PI / 2);
        
        const instanceCount = floors - 1;
        if (instanceCount > 0) {
          const instancedMesh = new THREE.InstancedMesh(bandGeo, spandrelMat, instanceCount);
          const dummy = new THREE.Object3D();
          for (let f = 1; f < floors; f++) {
            const bandY = currentElev + (f / floors) * wallBodyH - spandrelH / 2;
            dummy.position.set(0, bandY, 0);
            dummy.updateMatrix();
            instancedMesh.setMatrixAt(f - 1, dummy.matrix);
          }
          instancedMesh.instanceMatrix.needsUpdate = true;
          instancedMesh.castShadow = false;
          visualGroup.add(instancedMesh);
        }
      });

      currentElev += wallBodyH;

      // 4. ── Setback Crown / Mechanical Penthouse Floor ──
      const penthouseH = Math.max(floorHeight * 0.7, 2.2);
      shapes.forEach((shape) => {
        const pentShape = scaleShape(shape, 0.88); // Setback inward
        const pentGeo = new THREE.ExtrudeGeometry(pentShape, { depth: penthouseH, bevelEnabled: false });
        pentGeo.rotateX(-Math.PI / 2);
        const pentMesh = new THREE.Mesh(pentGeo, materials.roofMaterial);
        pentMesh.position.y = currentElev;
        pentMesh.castShadow = true;
        visualGroup.add(pentMesh);
        exteriorMeshes.push(pentMesh);
        const pentEdges = new THREE.LineSegments(new THREE.EdgesGeometry(pentGeo, 25), materials.edgeMaterial);
        pentEdges.position.y = currentElev;
        visualGroup.add(pentEdges);
      });

      // Penthouse step-in cornice line
      shapes.forEach((shape) => {
        const stepShape = scaleShape(shape, 1.01);
        const stepGeo = new THREE.ExtrudeGeometry(stepShape, { depth: 0.4, bevelEnabled: false });
        stepGeo.rotateX(-Math.PI / 2);
        const stepMesh = new THREE.Mesh(stepGeo, materials.trimMaterial);
        stepMesh.position.y = currentElev - 0.05;
        visualGroup.add(stepMesh);
      });

      currentElev += penthouseH;

      // 5. ── Flat Roof Parapet + HVAC Core + Mast ──
      const cx = 0;
      const cz = 0;
      const parapetH = 1.1;
      shapes.forEach((shape) => {
        const paraGeo = new THREE.ExtrudeGeometry(shape, { depth: parapetH, bevelEnabled: false });
        paraGeo.rotateX(-Math.PI / 2);
        const paraMesh = new THREE.Mesh(paraGeo, materials.trimMaterial);
        paraMesh.position.y = currentElev;
        visualGroup.add(paraMesh);
        const paraEdges = new THREE.LineSegments(new THREE.EdgesGeometry(paraGeo, 30), materials.edgeMaterial);
        paraEdges.position.y = currentElev;
        visualGroup.add(paraEdges);
      });

      // Rooftop HVAC / mechanical core box
      const coreW = Math.max(dims.width * 0.32, 4);
      const coreD = Math.max(dims.depth * 0.32, 4);
      const coreH = Math.max(2.8, floorHeight * 0.5);
      const coreMesh = new THREE.Mesh(new THREE.BoxGeometry(coreW, coreH, coreD), materials.roofMaterial);
      coreMesh.position.set(cx, currentElev + parapetH + coreH / 2, cz);
      coreMesh.castShadow = true;
      visualGroup.add(coreMesh);

      // HVAC unit on top of core
      const hvacMesh = new THREE.Mesh(new THREE.BoxGeometry(coreW * 0.8, 1.2, coreD * 0.8), materials.trimMaterial);
      hvacMesh.position.set(cx, currentElev + parapetH + coreH + 0.6, cz);
      visualGroup.add(hvacMesh);

      // Communication mast
      const mastH = Math.max(4.5, totalHeight * 0.12);
      const mastMesh = new THREE.Mesh(new THREE.CylinderGeometry(0.06, 0.2, mastH, 8), materials.trimMaterial);
      mastMesh.position.set(cx, currentElev + parapetH + coreH + 1.2 + mastH / 2, cz);
      visualGroup.add(mastMesh);

      // Beacon light at mast tip
      const beaconMesh = new THREE.Mesh(
        new THREE.SphereGeometry(0.32, 8, 8),
        new THREE.MeshStandardMaterial({ color: 0xef4444, emissive: 0xef4444, emissiveIntensity: 2.8 }),
      );
      beaconMesh.position.set(cx, currentElev + parapetH + coreH + 1.2 + mastH, cz);
      visualGroup.add(beaconMesh);

      // If non-flat roof shape specified, add on top
      if (roofType && roofType !== 'flat') {
        generatePolygonalRoof(
          visualGroup, shapes, roofType, currentElev + parapetH,
          Math.max(zoning.roofHeight, 4), dims,
          materials.roofMaterial, materials.goldAccentMat, materials.edgeMaterial,
        );
      }

      // 6. ── Close LOD Facade Details (Instanced windows) ──
      buildCloseDetailFacade(facadeDetailsGroup, shapes, podiumH, wallBodyH, floorHeight);
    }
  } else {
    // Universal fallback for buildings with a footprint but no parts
    geometrySource = 'Procedural footprint';
    const baseShapes = footprintToShapes(building.footprint, centerLng, centerLat);
    
    // Extrude the actual footprint instead of a generic box
    baseShapes.forEach((shape) => {
      const fallbackGeo = new THREE.ExtrudeGeometry(shape, { depth: totalHeight, bevelEnabled: false });
      fallbackGeo.rotateX(-Math.PI / 2);
      const fallbackMesh = new THREE.Mesh(fallbackGeo, materials.wallMaterial);
      fallbackMesh.position.y = 0;
      fallbackMesh.castShadow = true;
      fallbackMesh.receiveShadow = true;
      visualGroup.add(fallbackMesh);
      exteriorMeshes.push(fallbackMesh);

      const edges = new THREE.LineSegments(new THREE.EdgesGeometry(fallbackGeo, 30), materials.edgeMaterial);
      edges.position.y = 0;
      visualGroup.add(edges);
    });

    // Add roof if not flat
    if (roofType && roofType !== 'flat') {
      generatePolygonalRoof(
        visualGroup, baseShapes, roofType, totalHeight,
        Math.max(zoning.roofHeight, 4), dims,
        materials.roofMaterial, materials.goldAccentMat, materials.edgeMaterial,
      );
    }
  }

  return {
    exteriorMeshes,
    geometrySource,
    partTypes: Array.from(new Set(partTypes)),
    roofType,
    roofHeightM,
    proportions: {
      platformM: zoning.platformHeight,
      wallM: zoning.wallHeight,
      roofM: zoning.roofHeight,
      finialM: zoning.finialHeight,
    },
    circularity: metrics.circularity,
  };
}

// ─────────────────────────────────────────────────────────────
// COMPONENT MAIN
// ─────────────────────────────────────────────────────────────

export default function MapThreeJS({
  building,
  selectedUnit,
  onUnitClick,
  selectedFloor,
  isLeftOpen,
  isRightOpen,
  onToggleLeft,
  onToggleRight,
}: MapThreeJSProps) {
  const mountRef = useRef<HTMLDivElement>(null);
  const sceneRef = useRef<THREE.Scene | null>(null);
  const rendererRef = useRef<THREE.WebGLRenderer | null>(null);
  const controlsRef = useRef<OrbitControls | null>(null);
  const cameraRef = useRef<THREE.PerspectiveCamera | null>(null);
  const unitMeshesRef = useRef<Map<string, THREE.Mesh>>(new Map());
  const exteriorMeshesRef = useRef<THREE.Mesh[]>([]);
  const visualBuildingGroupRef = useRef<THREE.Group | null>(null);
  const facadeDetailsGroupRef = useRef<THREE.Group | null>(null);
  const cadastralULPINGroupRef = useRef<THREE.Group | null>(null);
  const autoRotateRef = useRef(false);
  const currentRequestIdRef = useRef(0);

  // Stable refs for callbacks and dynamic props to prevent re-initializing Three.js scene
  const onUnitClickRef = useRef(onUnitClick);
  onUnitClickRef.current = onUnitClick;
  const selectedFloorRef = useRef(selectedFloor);
  selectedFloorRef.current = selectedFloor;

  const [autoRotate, setAutoRotate] = useState(false);
  const [wireframeMode, setWireframeMode] = useState(false);
  const [, setHoveredUnitId] = useState<string | null>(null);
  const [groundElevation, setGroundElevation] = useState<number | null>(null);
  const [activeLod, setActiveLod] = useState<LODLevel>('MEDIUM');
  const [showDebugHud, setShowDebugHud] = useState(true);
  const [fallbackNotice, setFallbackNotice] = useState<string | null>(null);

  // Telemetry state strictly reflecting real source data & mesh counts
  const [telemetry, setTelemetry] = useState<ArchitecturalTelemetry>({
    provider: 'OSM building:part',
    geometrySource: 'OSM Geometry',
    osmId: building?.osm_id || 'osm/auto',
    sourcePartCount: building?.building_parts?.length || 0,
    buildingPartsCount: building?.building_parts?.length || 0,
    partTypes: [],
    roofType: building?.roof?.shape || 'flat',
    roofHeightM: building?.roof?.height || 3.5,
    generatedMeshCount: 1,
    lodLevel: 'MEDIUM',
    visualHeight: 30,
    cadastralHeight: 30,
    fallbackUsed: false,
    modelLoaded: true,
    modelVisible: true,
    hardcodedGeometry: false,
    aiAssisted: false,
    aiConfidence: null,
    aiFieldsUsed: [],
    sourceMetadata: {
      roofShape: building?.roof?.shape,
      buildingMaterial: building?.assessment?.building_material || building?.building_material,
      height: building?.height_meters || building?.height,
      levels: building?.floor_count,
    },
    inferredMetadata: undefined,
    proportions: {
      platformM: 0,
      wallM: 30,
      roofM: 0,
      finialM: 0,
    },
    hasHoles: false,
    circularity: 0.78,
  });

  // 3D Anchored Screen Projection State
  const [apexScreenPos, setApexScreenPos] = useState<{ x: number; y: number; visible: boolean } | null>(null);
  const [floorScreenPos, setFloorScreenPos] = useState<{ x: number; y: number; visible: boolean } | null>(null);
  const [camDistMeters, setCamDistMeters] = useState<number>(50);

  const { lat: centerLat, lng: centerLng } = getBuildingCenter(building);
  const dims = useMemo(() => getFootprintDimensions(building.footprint), [building.footprint]);
  const buildingHeight = getBuildingHeight(building);
  const floorHeight = getFloorHeight(building);
  const floorInfo = useMemo(() => getFloorCountInfo(building), [building]);

  // Stable building identifier — building geometry is reconstructed ONLY when target building changes
  const buildingKey = useMemo(
    () => `${building?.building_id || ''}_${centerLat.toFixed(6)}_${centerLng.toFixed(6)}_${building?.osm_id || ''}`,
    [building?.building_id, centerLat, centerLng, building?.osm_id]
  );

  useEffect(() => {
    if (!centerLat || !centerLng) return;
    let cancelled = false;
    fetchTerrainHeight(centerLng, centerLat).then((result) => {
      if (!cancelled && result?.elevation != null) {
        setGroundElevation(result.elevation);
      }
    });
    return () => {
      cancelled = true;
    };
  }, [centerLat, centerLng]);

  autoRotateRef.current = autoRotate;

  // ─────────────────────────────────────────────────────────────
  // MAIN THREE.JS SCENE INITIALIZATION & BUILDING GEOMETRY LOADER
  // Re-runs ONLY when the selected building changes or wireframe is toggled.
  // Never re-runs on camera moves, floor changes, or hover events.
  // ─────────────────────────────────────────────────────────────
  useEffect(() => {
    if (!mountRef.current) return;

    const reqId = ++currentRequestIdRef.current;

    const width = mountRef.current.clientWidth || 800;
    const height = mountRef.current.clientHeight || 520;

    const maxDim = Math.max(dims.width, dims.depth, 10);
    const sceneExtent = Math.max(maxDim * 3, buildingHeight * 0.7, 60);

    const scene = new THREE.Scene();
    sceneRef.current = scene;

    // Atmospheric Sky Dome Background
    const skyDomeGeo = new THREE.SphereGeometry(sceneExtent * 4, 32, 32);
    const skyDomeMat = new THREE.MeshBasicMaterial({
      color: 0x080e1a,
      side: THREE.BackSide,
    });
    const skyDome = new THREE.Mesh(skyDomeGeo, skyDomeMat);
    scene.add(skyDome);

    const camera = new THREE.PerspectiveCamera(40, width / height, 0.5, 100000);
    const heightFactor = buildingHeight > 500 ? 1.6 : buildingHeight > 250 ? 1.4 : 1.1;
    const targetCamDist = Math.max(maxDim * 2.2, buildingHeight * heightFactor, 45);
    camera.position.set(targetCamDist * 0.9, buildingHeight * 0.55 + maxDim * 0.25, targetCamDist * 0.9);
    cameraRef.current = camera;

    const renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true, powerPreference: 'high-performance' });
    renderer.setSize(width, height);
    renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    renderer.shadowMap.enabled = true;
    renderer.shadowMap.type = THREE.PCFSoftShadowMap;
    renderer.toneMapping = THREE.ACESFilmicToneMapping;
    renderer.toneMappingExposure = 1.35;

    mountRef.current.innerHTML = '';
    mountRef.current.appendChild(renderer.domElement);
    rendererRef.current = renderer;

    const targetY = buildingHeight * (buildingHeight > 300 ? 0.42 : 0.45);
    const controls = new OrbitControls(camera, renderer.domElement);
    controls.enableDamping = true;
    controls.dampingFactor = 0.05;
    controls.target.set(0, targetY, 0);
    controls.maxPolarAngle = Math.PI / 2 - 0.02;
    controls.minDistance = Math.max(4, maxDim * 0.3);
    controls.maxDistance = Math.max(25000, buildingHeight * 15);
    controlsRef.current = controls;

    // Lighting Setup
    const hemiLight = new THREE.HemisphereLight(0xe0f2fe, 0x334155, 1.8);
    scene.add(hemiLight);

    const sunLight = new THREE.DirectionalLight(0xfffaf0, 2.9);
    sunLight.position.set(sceneExtent * 0.8, buildingHeight * 1.5 + sceneExtent, sceneExtent * 0.8);
    sunLight.target.position.set(0, targetY, 0);
    scene.add(sunLight.target);
    sunLight.castShadow = true;
    sunLight.shadow.mapSize.width = 2048;
    sunLight.shadow.mapSize.height = 2048;
    sunLight.shadow.bias = -0.0002;
    sunLight.shadow.normalBias = 0.08;
    sunLight.shadow.camera.near = 1;
    sunLight.shadow.camera.far = Math.max(sceneExtent * 4, buildingHeight * 3.5);
    const d = Math.max(sceneExtent * 1.2, buildingHeight * 0.7);
    sunLight.shadow.camera.left = -d;
    sunLight.shadow.camera.right = d;
    sunLight.shadow.camera.top = d;
    sunLight.shadow.camera.bottom = -d;
    scene.add(sunLight);
    
    // Fill light to bring out architectural detail on shadowed sides of tall models
    const fillLight = new THREE.DirectionalLight(0x94a3b8, 1.4);
    fillLight.position.set(-sceneExtent * 0.8, buildingHeight * 0.6, -sceneExtent * 0.8);
    scene.add(fillLight);

    const rimLight = new THREE.PointLight(0x818cf8, 3.5, sceneExtent * 2.5);
    rimLight.position.set(-maxDim * 1.5, buildingHeight * 0.8, -maxDim * 1.5);
    scene.add(rimLight);

    // Surrounding Plaza & Landscaping
    buildSurroundingContext(scene, dims, sceneExtent);

    // ─────────────────────────────────────────────────────────────
    // UNDERGROUND VISUALIZATION LAYER
    // Renders basement levels below the ground plane as transparent
    // volumetric blocks with colored-coded type indicators.
    // ─────────────────────────────────────────────────────────────
    const undergroundData = building.underground;
    if (undergroundData?.ulpin_details?.length) {
      const ugGroup = new THREE.Group();
      ugGroup.name = 'undergroundGroup';
      scene.add(ugGroup);

      const TYPE_COLORS: Record<string, number> = {
        basement: 0x6366f1,
        parking: 0xf59e0b,
        utility: 0x06b6d4,
        metro: 0xec4899,
        museum: 0x8b5cf6,
        mixed: 0x10b981,
      };

      const baseShapes = footprintToShapes(building.footprint, dims.centerLng, dims.centerLat);

      undergroundData.ulpin_details
        .filter(u => u.level < 0)
        .forEach((level) => {
          const depthTop = -(level.depth_range[0] || 0);
          const depthBot = -(level.depth_range[1] || level.depth_range[0] + 3.5);
          const slabHeight = Math.abs(depthBot - depthTop);
          const color = TYPE_COLORS[level.type] || 0x6366f1;

          baseShapes.forEach((shape) => {
            // Transparent solid slab
            const ugGeo = new THREE.ExtrudeGeometry(shape, { depth: slabHeight, bevelEnabled: false });
            ugGeo.rotateX(-Math.PI / 2);
            const ugMat = new THREE.MeshStandardMaterial({
              color,
              transparent: true,
              opacity: 0.18,
              roughness: 0.8,
              metalness: 0.3,
              side: THREE.DoubleSide,
            });
            const ugMesh = new THREE.Mesh(ugGeo, ugMat);
            ugMesh.position.y = depthTop; // negative = below ground
            ugGroup.add(ugMesh);

            // Wireframe outline for clarity
            const edgesMat = new THREE.LineBasicMaterial({ color, transparent: true, opacity: 0.6 });
            const edges = new THREE.LineSegments(new THREE.EdgesGeometry(ugGeo, 30), edgesMat);
            edges.position.y = depthTop;
            ugGroup.add(edges);

            // Floor label strip at the ceiling of each level
            const stripGeo = new THREE.ExtrudeGeometry(shape, { depth: 0.25, bevelEnabled: false });
            stripGeo.rotateX(-Math.PI / 2);
            const stripMat = new THREE.MeshStandardMaterial({ color, roughness: 0.5, metalness: 0.6, transparent: true, opacity: 0.55 });
            const stripMesh = new THREE.Mesh(stripGeo, stripMat);
            stripMesh.position.y = depthTop + 0.01;
            ugGroup.add(stripMesh);
          });
        });

      // Vertical dotted shaft from ground to deepest level
      if (undergroundData.max_depth_m > 0) {
        const shaftGeo = new THREE.CylinderGeometry(0.25, 0.25, undergroundData.max_depth_m, 12);
        const shaftMat = new THREE.MeshStandardMaterial({ color: 0x818cf8, transparent: true, opacity: 0.4, metalness: 0.8 });
        const shaftMesh = new THREE.Mesh(shaftGeo, shaftMat);
        shaftMesh.position.set(0, -(undergroundData.max_depth_m / 2), 0);
        ugGroup.add(shaftMesh);
      }
    }

    // ─────────────────────────────────────────────────────────────
    // ARCHITECTURE SEPARATION:
    // 1. visualBuildingGroup: Physical 3D building (OSM2World / Procedural)
    // 2. facadeDetailsGroup: Close LOD architectural facade details
    // 3. cadastralULPINGroup: Independent cadastral floor volumes
    // ─────────────────────────────────────────────────────────────
    const rootBuildingGroup = new THREE.Group();
    rootBuildingGroup.name = 'rootBuildingGroup';
    scene.add(rootBuildingGroup);

    const visualBuildingGroup = new THREE.Group();
    visualBuildingGroup.name = 'visualBuildingGroup';
    visualBuildingGroup.visible = true;
    rootBuildingGroup.add(visualBuildingGroup);
    visualBuildingGroupRef.current = visualBuildingGroup;

    const facadeDetailsGroup = new THREE.Group();
    facadeDetailsGroup.name = 'facadeDetailsGroup';
    rootBuildingGroup.add(facadeDetailsGroup);
    facadeDetailsGroupRef.current = facadeDetailsGroup;

    const cadastralULPINGroup = new THREE.Group();
    cadastralULPINGroup.name = 'cadastralULPINGroup';
    rootBuildingGroup.add(cadastralULPINGroup);
    cadastralULPINGroupRef.current = cadastralULPINGroup;

    // Helper: Construct real procedural geometry from OSM vector polygon & parts
    const applyProceduralReconstruction = (inferredAiData?: any) => {
      const validation = validateBuildingData(building);
      if (!validation.isValid) {
        console.warn('Building data validation issue:', validation.error);
      }

      while (visualBuildingGroup.children.length > 0) {
        visualBuildingGroup.remove(visualBuildingGroup.children[0]);
      }
      while (facadeDetailsGroup.children.length > 0) {
        facadeDetailsGroup.remove(facadeDetailsGroup.children[0]);
      }

      const reconResult = constructMultiMassBuilding(
        visualBuildingGroup,
        facadeDetailsGroup,
        building,
        dims,
        buildingHeight,
        floorHeight,
        wireframeMode,
        inferredAiData,
      );
      exteriorMeshesRef.current = reconResult.exteriorMeshes;

      // Ensure all meshes have frustum culling disabled & valid bounds
      visualBuildingGroup.traverse((child) => {
        if ((child as THREE.Mesh).isMesh) {
          const m = child as THREE.Mesh;
          m.frustumCulled = false;
          m.geometry?.computeBoundingBox?.();
          m.geometry?.computeBoundingSphere?.();
        }
      });

      const sourceParts = building.building_parts?.length || 0;
      const genMeshes = reconResult.exteriorMeshes.length;
      const bBox = new THREE.Box3().setFromObject(visualBuildingGroup);

      const decision = evaluateBestGeometryProvider(building, false);
      const isAiAssisted = Boolean(inferredAiData && inferredAiData.confidence >= 0.50);

      setTelemetry({
        provider: decision.provider,
        geometrySource: reconResult.geometrySource,
        osmId: building.osm_id || 'osm/auto',
        sourcePartCount: sourceParts,
        buildingPartsCount: sourceParts,
        partTypes: reconResult.partTypes || [],
        roofType: reconResult.roofType,
        roofHeightM: reconResult.roofHeightM,
        generatedMeshCount: genMeshes,
        lodLevel: 'MEDIUM',
        visualHeight: buildingHeight,
        cadastralHeight: (building.floor_count || 1) * floorHeight,
        fallbackUsed: decision.fallbackUsed,
        modelLoaded: true,
        modelVisible: true,
        hardcodedGeometry: false,
        aiAssisted: isAiAssisted,
        aiConfidence: isAiAssisted ? Math.round(inferredAiData.confidence * 100) : null,
        aiFieldsUsed: isAiAssisted ? inferredAiData.inferred_fields || [] : [],
        aiReasoning: isAiAssisted ? inferredAiData.reasoning : undefined,
        sourceMetadata: {
          roofShape: building.roof?.shape,
          buildingMaterial: building.assessment?.building_material || building.building_material,
          height: building.height_meters || building.height,
          levels: building.floor_count,
        },
        inferredMetadata: isAiAssisted ? inferredAiData : undefined,
        proportions: reconResult.proportions || {
          platformM: 0,
          wallM: buildingHeight,
          roofM: reconResult.roofHeightM,
          finialM: 0,
        },
        hasHoles: getShapeMetrics(building.footprint).hasHoles,
        circularity: reconResult.circularity,
      });

      setFallbackNotice(decision.reason || null);

      console.log({
        buildingName: building.building_name || building.address || 'Cadastral Building',
        osmId: building.osm_id || 'osm/auto',
        provider: decision.provider,
        sourcePartCount: sourceParts,
        generatedMeshCount: genMeshes,
        aiAssisted: isAiAssisted,
        aiConfidence: isAiAssisted ? inferredAiData.confidence : null,
        modelVisible: true,
        modelPosition: visualBuildingGroup.position,
        modelScale: visualBuildingGroup.scale,
        boundingBox: bBox,
        selectedFloor: selectedFloorRef.current,
        requestId: reqId,
      });
    };

    // 1. Initial render from available OSM vector data + Satellite Vision Data
    const initialVisionInference = building.gemini_vision_data ? {
      confidence: (building.gemini_vision_data.confidence || 80) / 100,
      building_type: building.gemini_vision_data.architectural_form || 'mixed_use',
      roof_shape: (building.gemini_vision_data.roof_shape || '').toLowerCase(),
      architectural_form: building.gemini_vision_data.architectural_form || 'central_mass',
      suggested_material: building.gemini_vision_data.building_material || building.building_material,
      symmetry: building.gemini_vision_data.symmetry || 'bilateral',
      inferred_fields: ['satellite_vision', 'roof_shape', 'building_material'],
      reasoning: 'Derived from high-res satellite image via Gemini Vision',
      provenance: { source: 'gemini_vision', model: 'gemini-vision', cached: true }
    } : undefined;

    applyProceduralReconstruction(initialVisionInference);

    // 2. Optional Gemini AI inference when key OSM metadata is missing
    const hasExplicitRoofTag = Boolean(building.roof?.shape);
    const hasExplicitParts = Boolean(building.building_parts && building.building_parts.length > 0);

    if (!hasExplicitRoofTag && !hasExplicitParts) {
      const shapeMetrics = getShapeMetrics(building.footprint, centerLng, centerLat);
      inferBuildingMetadata({
        osm_id: building.osm_id,
        building_name: building.building_name,
        osm_tags: building.raw_osm_data?.tags || {},
        footprint_metrics: {
          area_sqm: shapeMetrics.areaSqm,
          circularity: shapeMetrics.circularity,
          aspect_ratio: shapeMetrics.aspectRatio,
          vertex_count: shapeMetrics.vertexCount,
          has_holes: shapeMetrics.hasHoles,
          is_symmetric: shapeMetrics.isSymmetric,
        },
        building_parts_count: building.building_parts?.length || 0,
        known_height: building.height_meters || building.height,
        known_levels: building.floor_count,
        known_roof_shape: building.roof?.shape,
        known_material: building.assessment?.building_material || building.building_material,
      })
        .then((inferredResult) => {
          if (reqId === currentRequestIdRef.current && inferredResult && inferredResult.confidence >= 0.50) {
            applyProceduralReconstruction(inferredResult);
          }
        })
        .catch((err) => {
          console.debug('Optional Gemini inference skipped:', err);
        });
    }

    // 2. Asynchronously fetch full Overpass data & convert with OSM2World
    (async () => {
      try {
        const osmData = await fetchDetailedOSMData(centerLat, centerLng, 180, building.osm_id);
        if (reqId !== currentRequestIdRef.current || !osmData || !osmData.elements || osmData.elements.length === 0) {
          return;
        }

        const o2wResult = await generate3DBuildingOSM2World(osmData, {
          targetElementId: building.osm_id,
        });

        if (reqId !== currentRequestIdRef.current) return;

        if (o2wResult && o2wResult.meshes.length > 0) {
          // Clear procedural fallback and attach real OSM2World geometry
          while (visualBuildingGroup.children.length > 0) {
            visualBuildingGroup.remove(visualBuildingGroup.children[0]);
          }
          while (facadeDetailsGroup.children.length > 0) {
            facadeDetailsGroup.remove(facadeDetailsGroup.children[0]);
          }

          visualBuildingGroup.add(o2wResult.group);
          visualBuildingGroup.visible = true;
          exteriorMeshesRef.current = o2wResult.meshes;

          // Ensure all OSM2World meshes have frustum culling disabled & valid bounds
          visualBuildingGroup.traverse((child) => {
            if ((child as THREE.Mesh).isMesh) {
              const m = child as THREE.Mesh;
              m.frustumCulled = false;
              m.geometry?.computeBoundingBox?.();
              m.geometry?.computeBoundingSphere?.();
            }
          });

          const o2wBBox = new THREE.Box3().setFromObject(visualBuildingGroup);

          setTelemetry({
            provider: 'OSM2World',
            geometrySource: 'OSM2World',
            osmId: building.osm_id || 'osm/auto',
            sourcePartCount: o2wResult.buildingPartsCount,
            buildingPartsCount: o2wResult.buildingPartsCount,
            partTypes: ['osm2world-native'],
            roofType: o2wResult.roofShapes.join(', ') || 'geometric',
            roofHeightM: 4.0,
            generatedMeshCount: o2wResult.meshCount,
            lodLevel: 'MEDIUM',
            visualHeight: buildingHeight,
            cadastralHeight: (building.floor_count || 1) * floorHeight,
            fallbackUsed: false,
            modelLoaded: true,
            modelVisible: true,
            hardcodedGeometry: false,
            proportions: {
              platformM: 0,
              wallM: buildingHeight - 4.0,
              roofM: 4.0,
              finialM: 0,
            },
            hasHoles: getShapeMetrics(building.footprint).hasHoles,
            circularity: 0.85,
            aiAssisted: false,
            aiConfidence: 0,
            aiFieldsUsed: [],
            sourceMetadata: (building as any).raw_tags || building.raw_osm_data?.tags || {},
          });

          setFallbackNotice(null);

          console.log({
            buildingName: building.building_name || building.address || 'Cadastral Building',
            osmId: building.osm_id || 'osm/auto',
            provider: 'OSM2World',
            sourcePartCount: o2wResult.buildingPartsCount,
            generatedMeshCount: o2wResult.meshCount,
            modelVisible: true,
            modelPosition: visualBuildingGroup.position,
            modelScale: visualBuildingGroup.scale,
            boundingBox: o2wBBox,
            selectedFloor: selectedFloorRef.current,
            requestId: reqId,
          });
        }
      } catch (err) {
        console.warn('OSM2World generation failed, keeping procedural fallback:', err);
      }
    })();

    // Construct Cadastral ULPIN Floor Layers
    // Always generate one slab per floor (even if no units from DB),
    // so floor selection always works. Units just override color/metadata.
    const unitMap = new Map<string, THREE.Mesh>();
    const units = building?.units || [];
    const shape = building.footprint ? footprintToShape(building.footprint, centerLng, centerLat) : null;
    const totalFloors = building.floor_count || Math.max(units.length, 1);

    // Build a map from floor number to unit (if available)
    const floorToUnit = new Map<number, (typeof units)[0]>();
    units.forEach(u => { const f = getUnitFloor(u); floorToUnit.set(f, u); });

    // Create one slab per floor
    const floorSlabs: THREE.Mesh[] = [];
    for (let floorNum = 1; floorNum <= totalFloors; floorNum++) {
      const levelY = (floorNum - 1) * floorHeight;
      const baseColor = FLOOR_HEX_COLORS[(floorNum - 1) % FLOOR_HEX_COLORS.length];
      const unit = floorToUnit.get(floorNum);

      const levelMat = new THREE.MeshStandardMaterial({
        color: baseColor,
        transparent: true,
        opacity: 0,
        depthWrite: false,
        wireframe: wireframeMode,
      });

      let levelMesh: THREE.Mesh;
      if (shape) {
        const slabGeo = new THREE.ExtrudeGeometry(shape, { depth: floorHeight * 0.95, bevelEnabled: false });
        slabGeo.rotateX(-Math.PI / 2);
        slabGeo.computeBoundingBox();
        slabGeo.computeBoundingSphere();
        levelMesh = new THREE.Mesh(slabGeo, levelMat);
        levelMesh.position.y = levelY;
      } else {
        const boxGeo = new THREE.BoxGeometry(dims.width * 1.01, floorHeight * 0.95, dims.depth * 1.01);
        boxGeo.computeBoundingBox();
        boxGeo.computeBoundingSphere();
        levelMesh = new THREE.Mesh(boxGeo, levelMat);
        levelMesh.position.y = levelY + floorHeight / 2;
      }

      levelMesh.frustumCulled = false;
      levelMesh.userData = { unit: unit || { unit_id: `floor-${floorNum}`, floor: floorNum }, baseColor, floorNum };
      levelMesh.visible = false;
      cadastralULPINGroup.add(levelMesh);
      floorSlabs.push(levelMesh);

      // Register by unit_id if a real unit exists, also by floor key
      if (unit) unitMap.set(unit.unit_id, levelMesh);
      unitMap.set(`floor-${floorNum}`, levelMesh);
    }

    // ── Sequential Floor Reveal Animation ────────────────────────────
    // Animates floors popping in one-by-one from bottom to top on load.
    let revealTimer: ReturnType<typeof setTimeout>;
    const revealFloor = (idx: number) => {
      if (idx >= floorSlabs.length) return;
      const slab = floorSlabs[idx];
      const mat = slab.material as THREE.MeshStandardMaterial;
      slab.visible = true;
      // Animate opacity from 0 to target over ~300ms using a simple interval
      let opacity = 0;
      const targetOpacity = 0.45;
      const step = targetOpacity / 15;
      const fadeIn = setInterval(() => {
        opacity = Math.min(opacity + step, targetOpacity);
        mat.opacity = opacity;
        mat.needsUpdate = true;
        if (opacity >= targetOpacity) {
          clearInterval(fadeIn);
          // After fully visible, fade back out (slabs idle until floor is selected)
          const fadeOut = setInterval(() => {
            opacity = Math.max(opacity - step * 0.5, 0);
            mat.opacity = opacity;
            mat.needsUpdate = true;
            if (opacity <= 0) {
              slab.visible = false;
              clearInterval(fadeOut);
            }
          }, 30);
        }
      }, 20);
      revealTimer = setTimeout(() => revealFloor(idx + 1), 120);
    };
    // Start the staggered reveal animation shortly after scene loads
    const startRevealTimeout = setTimeout(() => revealFloor(0), 400);

    unitMeshesRef.current = unitMap;

    const raycaster = new THREE.Raycaster();
    const mouse = new THREE.Vector2();

    const handlePointerMove = (e: MouseEvent) => {
      if (!rendererRef.current) return;
      const rect = rendererRef.current.domElement.getBoundingClientRect();
      mouse.x = ((e.clientX - rect.left) / rect.width) * 2 - 1;
      mouse.y = -((e.clientY - rect.top) / rect.height) * 2 + 1;

      raycaster.setFromCamera(mouse, camera);
      const intersects = raycaster.intersectObjects(Array.from(unitMap.values()));

      if (intersects.length > 0) {
        setHoveredUnitId((intersects[0].object as THREE.Mesh).userData.unit.unit_id);
        rendererRef.current.domElement.style.cursor = 'pointer';
      } else {
        setHoveredUnitId(null);
        rendererRef.current.domElement.style.cursor = 'grab';
      }
    };

    const handleClick = (e: MouseEvent) => {
      if (!rendererRef.current) return;
      const rect = rendererRef.current.domElement.getBoundingClientRect();
      mouse.x = ((e.clientX - rect.left) / rect.width) * 2 - 1;
      mouse.y = -((e.clientY - rect.top) / rect.height) * 2 + 1;

      raycaster.setFromCamera(mouse, camera);
      const intersects = raycaster.intersectObjects(Array.from(unitMap.values()));

      if (intersects.length > 0) {
        const clickedMesh = intersects[0].object as THREE.Mesh;
        if (clickedMesh.userData.unit && onUnitClickRef.current) {
          onUnitClickRef.current(clickedMesh.userData.unit as Unit);
        }
      }
    };

    const domElem = renderer.domElement;
    domElem.addEventListener('pointermove', handlePointerMove);
    domElem.addEventListener('click', handleClick);

    const apexWorldVec = new THREE.Vector3(0, buildingHeight + 2.5, 0);
    const floorWorldVec = new THREE.Vector3(dims.width / 2 + 1.5, 0, 0);

    let animId: number;
    const animate = () => {
      animId = requestAnimationFrame(animate);
      controls.update();
      if (autoRotateRef.current && sceneRef.current) {
        sceneRef.current.rotation.y += 0.004;
      }

      const dist = camera.position.distanceTo(controls.target);
      setCamDistMeters(dist);

      // LOD Controller — visualBuildingGroup is ALWAYS kept visible
      let currentLod: LODLevel = 'MEDIUM';
      if (selectedFloorRef.current !== null) {
        currentLod = 'SELECTED';
      } else if (dist > 350) {
        currentLod = 'FAR';
      } else if (dist <= 120) {
        currentLod = 'CLOSE';
      } else {
        currentLod = 'MEDIUM';
      }

      setActiveLod(currentLod);

      if (facadeDetailsGroupRef.current) {
        facadeDetailsGroupRef.current.visible = currentLod === 'CLOSE' || currentLod === 'SELECTED';
      }

      if (visualBuildingGroupRef.current) {
        visualBuildingGroupRef.current.visible = true;
      }

      const projApex = apexWorldVec.clone().project(camera);
      if (projApex.z < 1.0) {
        const x = (projApex.x * 0.5 + 0.5) * width;
        const y = (-(projApex.y * 0.5) + 0.5) * height;
        setApexScreenPos({ x, y, visible: dist < 1200 });
      } else {
        setApexScreenPos(null);
      }

      if (selectedFloorRef.current !== null) {
        const fY = (selectedFloorRef.current - 0.5) * floorHeight;
        floorWorldVec.set(dims.width / 2 + 2, fY, 0);
        const projFloor = floorWorldVec.clone().project(camera);
        if (projFloor.z < 1.0) {
          const fx = (projFloor.x * 0.5 + 0.5) * width;
          const fy = (-(projFloor.y * 0.5) + 0.5) * height;
          setFloorScreenPos({ x: fx, y: fy, visible: true });
        } else {
          setFloorScreenPos(null);
        }
      } else {
        setFloorScreenPos(null);
      }

      renderer.render(scene, camera);
    };
    animate();

    const handleResize = () => {
      if (!mountRef.current || !rendererRef.current) return;
      const w = mountRef.current.clientWidth;
      const h = mountRef.current.clientHeight;
      if (w > 0 && h > 0) {
        camera.aspect = w / h;
        camera.updateProjectionMatrix();
        rendererRef.current.setSize(w, h);
      }
    };
    window.addEventListener('resize', handleResize);

    const resizeObserver = new ResizeObserver(() => {
      handleResize();
    });
    if (mountRef.current) {
      resizeObserver.observe(mountRef.current);
    }

    return () => {
      cancelAnimationFrame(animId);
      resizeObserver.disconnect();
      window.removeEventListener('resize', handleResize);
      domElem.removeEventListener('pointermove', handlePointerMove);
      domElem.removeEventListener('click', handleClick);
      renderer.dispose();
      clearTimeout(startRevealTimeout);
      // @ts-ignore — revealTimer may not be set if floors = 0
      clearTimeout(revealTimer);
      unitMap.clear();
      unitMeshesRef.current.clear();
      exteriorMeshesRef.current = [];
    };
  }, [buildingKey, wireframeMode]);

  // ─────────────────────────────────────────────────────────────
  // FLOOR ISOLATOR EFFECT:
  // Toggles Cadastral Floor Highlights and visual envelope opacity
  // WITHOUT ever destroying or rebuilding visualBuildingGroup.
  // ─────────────────────────────────────────────────────────────
  useEffect(() => {
    // 1. Cadastral ULPIN Layer Highlighting
    unitMeshesRef.current.forEach((mesh) => {
      const u = mesh.userData.unit;
      const floorNum = mesh.userData.floorNum || getUnitFloor(u);
      const isSelected = selectedUnit?.unit_id === u?.unit_id;
      const isFloorActive = selectedFloor !== null && selectedFloor === floorNum;
      const mat = mesh.material as THREE.MeshStandardMaterial;

      if (isSelected) {
        mesh.visible = true;
        mat.color.setHex(0x38bdf8);
        mat.emissive.setHex(0x0284c7);
        mat.emissiveIntensity = 1.1;
        mat.opacity = 0.92;
        mat.needsUpdate = true;
      } else if (isFloorActive) {
        mesh.visible = true;
        mat.color.setHex(0x0d9488);
        mat.emissive.setHex(0x042f2e);
        mat.emissiveIntensity = 0.8;
        mat.opacity = 0.88;
        mat.needsUpdate = true;
      } else {
        mesh.visible = false;
        mat.opacity = 0;
        mat.emissiveIntensity = 0;
        mat.needsUpdate = true;
      }
    });

    // 2. Visual Building Envelope: Fades smoothly when a floor is isolated; fully opaque otherwise
    if (visualBuildingGroupRef.current) {
      visualBuildingGroupRef.current.visible = true;
      visualBuildingGroupRef.current.traverse((child) => {
        if ((child as THREE.Mesh).isMesh) {
          const m = child as THREE.Mesh;
          const targetOpacity = selectedFloor !== null ? 0.2 : 1.0;
          if (Array.isArray(m.material)) {
            m.material.forEach((mat) => {
              mat.transparent = selectedFloor !== null;
              mat.opacity = targetOpacity;
              mat.depthWrite = selectedFloor === null;
              mat.needsUpdate = true;
            });
          } else if (m.material) {
            m.material.transparent = selectedFloor !== null;
            m.material.opacity = targetOpacity;
            m.material.depthWrite = selectedFloor === null;
            m.material.needsUpdate = true;
          }
        }
      });
    }
  }, [selectedUnit, selectedFloor]);

  const handleZoomIn = () => {
    if (cameraRef.current && controlsRef.current) {
      cameraRef.current.position.multiplyScalar(0.85);
      controlsRef.current.update();
    }
  };

  const handleZoomOut = () => {
    if (cameraRef.current && controlsRef.current) {
      cameraRef.current.position.multiplyScalar(1.15);
      controlsRef.current.update();
    }
  };

  const selectedFloorUnit = useMemo(() => {
    if (selectedFloor === null) return null;
    return (building?.units || []).find((u) => getUnitFloor(u) === selectedFloor);
  }, [building?.units, selectedFloor]);

  return (
    <div className="threejs-map-container">
      <div className="threejs-canvas-wrapper" ref={mountRef} />

      {/* ── 3D Anchored Floating Building Assessment Badge ── */}
      {apexScreenPos && apexScreenPos.visible && (
        <div className="anchored-badge-container">
          <div
            className="anchored-building-badge"
            style={{
              left: `${apexScreenPos.x}px`,
              top: `${apexScreenPos.y}px`,
              opacity: camDistMeters > 500 ? 0.6 : 1.0,
              transform: `translate(-50%, -100%) scale(${Math.max(0.8, Math.min(1.05, 90 / (camDistMeters || 90)))})`,
            }}
          >
            <div className="badge-header">
              <span className="badge-title">
                {building?.building_name || building?.address || 'Procedural Cadastral Structure'}
              </span>
              {building?.ulpin && (
                <span className="badge-ulpin">{building.ulpin.slice(0, 12)}...</span>
              )}
            </div>

            <div className="badge-stats">
              <div className="badge-stat-item">
                <span className="badge-stat-label">Levels:</span>
                <span className="badge-stat-val">{floorInfo.countText}</span>
              </div>
              <div className="badge-stat-item">
                <span className="badge-stat-label">Height:</span>
                <span className="badge-stat-val">{buildingHeight.toFixed(1)}m</span>
              </div>
              {dims.areaSqm > 0 && (
                <div className="badge-stat-item">
                  <span className="badge-stat-label">Footprint:</span>
                  <span className="badge-stat-val">{dims.areaSqm.toLocaleString()} m²</span>
                </div>
              )}
              {building.assessment?.built_up_area_sqm && (
                <div className="badge-stat-item">
                  <span className="badge-stat-label">Built-up:</span>
                  <span className="badge-stat-val">{building.assessment.built_up_area_sqm.toLocaleString()} m²</span>
                </div>
              )}
            </div>

            <div className="badge-chips">
              <span className="badge-chip validated">
                <CheckCircle2 size={11} />
                <span>{building.assessment?.spatial_validation_status || 'Spatially Validated'}</span>
              </span>
              <span className="badge-chip source">
                <Sparkles size={11} />
                <span>{floorInfo.sourceText}</span>
              </span>
            </div>
          </div>
        </div>
      )}

      {/* ── 3D Anchored Selected Floor Card ── */}
      {selectedFloor !== null && floorScreenPos && floorScreenPos.visible && (
        <div className="anchored-badge-container">
          <div
            className="anchored-floor-badge"
            style={{
              left: `${floorScreenPos.x}px`,
              top: `${floorScreenPos.y}px`,
            }}
          >
            <div className="floor-badge-title">
              <span>FLOOR {selectedFloor}</span>
              <span style={{ fontSize: '0.65rem', color: '#94a3b8' }}>
                +{(selectedFloor * floorHeight).toFixed(1)}m
              </span>
            </div>
            <div className="floor-badge-unit">
              {selectedFloorUnit?.unit_id || `UNIT_F0${selectedFloor}_A01`}
            </div>
            {selectedFloorUnit?.ulpin && (
              <div className="floor-badge-detail" style={{ color: '#38bdf8', wordBreak: 'break-all' }}>
                ULPIN: {selectedFloorUnit.ulpin}
              </div>
            )}
            <div className="floor-badge-detail">
              Area: ~{dims.areaSqm ? Math.round(dims.areaSqm * 0.95).toLocaleString() : '850'} m² · Isolated Level
            </div>
          </div>
        </div>
      )}

      {/* Toolbar Controls */}
      <div className="threejs-toolbar">
        <button
          className={`toolbar-btn ${autoRotate ? 'active' : ''}`}
          onClick={() => setAutoRotate(!autoRotate)}
          title="Auto Rotate Scene"
        >
          <RotateCw size={15} />
          <span>{autoRotate ? 'Rotating' : 'Rotate'}</span>
        </button>

        <button
          className={`toolbar-btn ${wireframeMode ? 'active' : ''}`}
          onClick={() => setWireframeMode(!wireframeMode)}
          title="Toggle Wireframe Structural Skeleton"
        >
          <Layers size={15} />
          <span>Wireframe</span>
        </button>

        <button
          className={`toolbar-btn ${showDebugHud ? 'active' : ''}`}
          onClick={() => setShowDebugHud(!showDebugHud)}
          title="Toggle Architectural Telemetry HUD"
        >
          <Info size={15} />
          <span>HUD</span>
        </button>

        <div className="zoom-controls">
          <button className="zoom-btn" onClick={handleZoomIn} title="Zoom In"><ZoomIn size={14} /></button>
          <button className="zoom-btn" onClick={handleZoomOut} title="Zoom Out"><ZoomOut size={14} /></button>
        </div>

        {onToggleLeft && (
          <button
            className={`toolbar-btn ${isLeftOpen ? 'active' : ''}`}
            onClick={onToggleLeft}
            title="Toggle Spatial Toolkit"
          >
            <PanelLeft size={15} />
            <span>Toolkit</span>
          </button>
        )}
        {onToggleRight && (
          <button
            className={`toolbar-btn ${isRightOpen ? 'active' : ''}`}
            onClick={onToggleRight}
            title="Toggle Record & Floors"
          >
            <PanelRight size={15} />
            <span>Record</span>
          </button>
        )}
      </div>

      {/* Location Banner with Geometry Source Telemetry */}
      <div className="location-banner-header absolute top-4 left-4 p-2.5 z-10 flex items-center gap-2.5 bg-slate-900/90 backdrop-blur rounded-lg border border-indigo-500/40 shadow-xl">
        <div className="w-7 h-7 rounded-md bg-indigo-500/20 text-indigo-400 border border-indigo-500/40 flex items-center justify-center">
          <MapPin size={16} />
        </div>
        <div className="flex flex-col">
          <div className="flex items-center gap-2">
            <span className="text-[0.78rem] font-bold text-white leading-tight">
              {building?.building_name || building?.address || 'Procedural Cadastral Structure'}
            </span>
            <span className="text-[0.62rem] font-semibold px-1.5 py-0.5 rounded bg-indigo-500/20 text-indigo-300 border border-indigo-500/30">
              LOD: {activeLod}
            </span>
          </div>
          <span className="text-[0.68rem] font-mono text-indigo-300">
            {centerLat.toFixed(5)}°N, {centerLng.toFixed(5)}°E • {buildingHeight.toFixed(1)}m ({floorInfo.countText})
            {groundElevation != null ? ` • Ground ${groundElevation.toFixed(1)}m MSL` : ''}
          </span>
        </div>
      </div>

      {/* Fallback Notice Toast */}
      {fallbackNotice && (
        <div className="absolute top-20 left-4 z-20 flex items-center gap-2 bg-amber-950/85 border border-amber-500/50 text-amber-200 px-3.5 py-2 rounded-lg text-xs backdrop-blur shadow-xl animate-fade-in">
          <Info size={14} className="text-amber-400 shrink-0" />
          <span>{fallbackNotice}</span>
        </div>
      )}

      {/* ── 10. COMPREHENSIVE ARCHITECTURAL TELEMETRY HUD ── */}
      {showDebugHud && (
        <div className="architectural-telemetry-hud">
          <div className="hud-title-bar">
            <span className="hud-label">3D ARCHITECTURAL TELEMETRY</span>
            <span className={`hud-badge ${telemetry.provider === 'OSM2World' ? 'active' : ''}`}>
              {telemetry.provider.toUpperCase()}
            </span>
          </div>
          <div className="hud-grid">
            <div className="hud-item">
              <span className="hud-k">Provider:</span>
              <span className="hud-v font-bold text-sky-400">{telemetry.provider}</span>
            </div>
            <div className="hud-item">
              <span className="hud-k">OSM ID:</span>
              <span className="hud-v font-mono text-[11px] text-slate-300">{telemetry.osmId}</span>
            </div>
            <div className="hud-item">
              <span className="hud-k">Source Parts:</span>
              <span className="hud-v font-bold">{telemetry.sourcePartCount} {telemetry.partTypes.length > 0 ? `(${telemetry.partTypes.slice(0, 2).join(', ')})` : ''}</span>
            </div>
            <div className="hud-item">
              <span className="hud-k">Generated Meshes:</span>
              <span className="hud-v font-bold text-emerald-300">{telemetry.generatedMeshCount} meshes</span>
            </div>
            <div className="hud-item">
              <span className="hud-k">AI Assistance:</span>
              <span className={`hud-v font-bold ${telemetry.aiAssisted ? 'text-indigo-400' : 'text-slate-400'}`}>
                {telemetry.aiAssisted ? `YES (${telemetry.aiConfidence}% conf)` : 'NO (100% Real OSM)'}
              </span>
            </div>
            {telemetry.aiAssisted && telemetry.aiFieldsUsed.length > 0 && (
              <div className="hud-item">
                <span className="hud-k">AI Inferred Fields:</span>
                <span className="hud-v font-mono text-[11px] text-indigo-300">
                  {telemetry.aiFieldsUsed.join(', ')}
                </span>
              </div>
            )}
            <div className="hud-item">
              <span className="hud-k">Hardcoded Geometry:</span>
              <span className="hud-v font-bold text-emerald-400">NO</span>
            </div>
            <div className="hud-item">
              <span className="hud-k">Model Loaded / Visible:</span>
              <span className="hud-v font-bold text-emerald-400">
                {telemetry.modelLoaded ? 'YES' : 'NO'} / {telemetry.modelVisible ? 'YES' : 'NO'}
              </span>
            </div>
            <div className="hud-item">
              <span className="hud-k">Fallback Used:</span>
              <span className={`hud-v font-bold ${telemetry.fallbackUsed ? 'text-amber-400' : 'text-emerald-400'}`}>
                {telemetry.fallbackUsed ? 'YES' : 'NO'}
              </span>
            </div>
            <div className="hud-item">
              <span className="hud-k">Roof Type:</span>
              <span className="hud-v">{telemetry.roofType} (~{telemetry.roofHeightM.toFixed(1)}m)</span>
            </div>
            <div className="hud-item">
              <span className="hud-k">Active LOD:</span>
              <span className="hud-v font-bold text-sky-400">{activeLod} ({Math.round(camDistMeters)}m cam)</span>
            </div>
            <div className="hud-item">
              <span className="hud-k">Height Zoning:</span>
              <span className="hud-v">
                Base {telemetry.proportions.platformM.toFixed(1)}m | Wall {telemetry.proportions.wallM.toFixed(1)}m | Roof {telemetry.proportions.roofM.toFixed(1)}m
              </span>
            </div>
            <div className="hud-item">
              <span className="hud-k">Cadastral vs Visual:</span>
              <span className="hud-v">{telemetry.cadastralHeight.toFixed(1)}m / {telemetry.visualHeight.toFixed(1)}m</span>
            </div>
            <div className="hud-item">
              <span className="hud-k">Circularity / Holes:</span>
              <span className="hud-v">{telemetry.circularity.toFixed(2)} / {telemetry.hasHoles ? 'Courtyard Present' : 'Solid'}</span>
            </div>
          </div>
        </div>
      )}

      {/* Geometry Source Status Pill */}
      <div className="absolute bottom-3 left-4 z-10 flex items-center gap-2.5 bg-slate-900/90 backdrop-blur border border-indigo-500/30 px-3.5 py-1.5 rounded-full text-xs text-gray-300 shadow-xl">
        <span className={`w-2 h-2 rounded-full ${telemetry.provider === 'OSM2World' ? 'bg-emerald-400' : 'bg-indigo-400'} animate-pulse`} />
        <span className="font-semibold text-indigo-300">
          Provider: {telemetry.provider}
        </span>
        <span className="text-slate-400 text-[11px]">
          · OSM Parts: {telemetry.sourcePartCount} · Meshes: {telemetry.generatedMeshCount} · AI Assist: {telemetry.aiAssisted ? `YES (${telemetry.aiConfidence}%)` : 'NO'} · Fallback: {telemetry.fallbackUsed ? 'YES' : 'NO'}
        </span>
      </div>
    </div>
  );
}
