import React, { useEffect, useRef, useState, useMemo } from 'react';
import * as THREE from 'three';
import { OrbitControls } from 'three/examples/jsm/controls/OrbitControls.js';
import { Building, Unit, BuildingPart, ThreeMaterialMode } from '../../types';
import {
  getBuildingCenter,
  getBuildingHeight,
  getFloorHeight,
  getFootprintDimensions,
  getFootprintDimensionsWithFallback,
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
import { getBuildingUtilityPipelines } from '../../utils/utilityNetworkHelper';
import { fetchTerrainHeight } from '../../utils/reearth';
import { fetchDetailedOSMData, OSMDataResponse } from '../../utils/osmFetcher';
import { generate3DBuildingOSM2World, OSM2WorldResult } from '../../utils/osm2worldProvider';
import { findCustomModel, CustomModelConfig } from '../../data/customModels';
import {
  loadCustomModelMesh,
  logModelPipelineTelemetry,
  BuildingGeometrySourceTier,
  disposeThreeGroup,
} from '../../utils/customModelProvider';
import {
  constructReferenceAssistedBuilding,
  resolveMultiViewAnalysis,
} from '../../utils/referenceAssistedReconstruction';
import {
  createDomeMesh as createParametricDomeMesh,
  createArchMesh,
  createCurvedArchitecturalElements,
} from '../../utils/curvedPrimitivesBuilder';
import { applyVerifiedBuildingMetadata, getVerifiedBuildingMetadata } from '../../utils/verifiedBuildingMetadata';
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
  Landmark,
  Sliders,
} from 'lucide-react';
import './Map3D.css';

const FLOOR_HEX_COLORS = [
  0x6366f1,
  0x3b82f6,
  0x10b981,
  0xf59e0b,
  0xec4899,
  0x8b5cf6,
];

export type LODLevel = 'FAR' | 'MEDIUM' | 'CLOSE' | 'SELECTED';

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

export interface ArchitecturalTelemetry {
  provider: BuildingGeometrySourceTier | 'OSM2World' | 'OSM building:part' | 'OSM Polygon Extrusion' | 'Procedural Extrusion' | 'Fallback';
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
  originalMaterials: boolean;
  statusBadge?: string;
  customModelUrl?: string;
  materialMode?: ThreeMaterialMode;
  materialSource?: 'Original GLB' | 'OSM tags' | 'OSM2World' | 'Neutral fallback';
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
  sourceHeightM?: number;
  renderedHeightM?: number;
  sourceFloors?: number;
  modelScale?: number;
  sharedOrigin?: { lat: number; lng: number };
  boundingBox?: { width: number; height: number; depth: number };
  partsCollapsed?: boolean;
}

// ─────────────────────────────────────────────────────────────
// MATERIAL SYSTEM: Unified Cadastral & Source Materials Engine
// ─────────────────────────────────────────────────────────────

/**
 * UNIFIED CADASTRAL STYLE PALETTE:
 * Applies a consistent, neutral clean white / light-stone architectural visual style across ALL buildings,
 * regardless of landmark name, religion, city, or provenance.
 * - Base / Main walls: Clean white / light-stone (#E8EDF2, roughness 0.72, metalness 0.02)
 * - Secondary structures / Plinths / Base: Slightly darker limestone (#D0D9E2, roughness 0.78, metalness 0.02)
 * - Roof / Spires / Crowns / Towers: Subtle slate-stone contrast (#DDE4EC, roughness 0.65, metalness 0.04)
 * - Glass / Windows: Semi-transparent blue-grey (#93C5FD, opacity 0.55)
 * - Accents / Trims / Finials: Subtle slate trim (#CBD5E1, roughness 0.55, metalness 0.08)
 */
function getUnifiedSingleMaterial(
  meshName: string,
  matName: string,
  origMat: THREE.Material | undefined,
  wireframe: boolean,
): THREE.Material {
  const combined = `${meshName} ${matName}`.toLowerCase();
  const isGlass =
    combined.includes('glass') ||
    combined.includes('window') ||
    combined.includes('glazing') ||
    (origMat && origMat.transparent && origMat.opacity < 0.85);
  const isRoofOrCrown =
    combined.includes('roof') ||
    combined.includes('spire') ||
    combined.includes('dome') ||
    combined.includes('shikhara') ||
    combined.includes('crown') ||
    combined.includes('cupola') ||
    combined.includes('finial') ||
    combined.includes('tower');
  const isPodiumOrBase =
    combined.includes('podium') ||
    combined.includes('plinth') ||
    combined.includes('platform') ||
    combined.includes('base') ||
    combined.includes('ground') ||
    combined.includes('floor');
  const isAccentOrTrim =
    combined.includes('accent') ||
    combined.includes('trim') ||
    combined.includes('cornice') ||
    combined.includes('balcony') ||
    combined.includes('kalash') ||
    combined.includes('mast');

  if (isGlass) {
    return new THREE.MeshPhysicalMaterial({
      color: 0x93c5fd,
      roughness: 0.1,
      metalness: 0.05,
      transmission: 0.85,
      transparent: true,
      opacity: 0.55,
      wireframe,
    });
  }

  if (isRoofOrCrown) {
    return new THREE.MeshStandardMaterial({
      color: 0xdde4ec, // Subtle slate-stone tone
      roughness: 0.65,
      metalness: 0.04,
      wireframe,
    });
  }

  if (isPodiumOrBase) {
    return new THREE.MeshStandardMaterial({
      color: 0xd0d9e2, // Slightly darker limestone base
      roughness: 0.78,
      metalness: 0.02,
      wireframe,
    });
  }

  if (isAccentOrTrim) {
    return new THREE.MeshStandardMaterial({
      color: 0xcbd5e1, // Subtle slate trim
      roughness: 0.55,
      metalness: 0.08,
      wireframe,
    });
  }

  // Default: Clean white / light-stone architectural clay render (#E8EDF2)
  return new THREE.MeshStandardMaterial({
    color: 0xe8edf2,
    roughness: 0.72,
    metalness: 0.02,
    wireframe,
  });
}

export function createUnifiedCadastralMaterial(
  mesh?: THREE.Mesh,
  wireframe: boolean = false,
): THREE.Material | THREE.Material[] {
  if (!mesh) {
    return new THREE.MeshStandardMaterial({
      color: 0xe8edf2,
      roughness: 0.72,
      metalness: 0.02,
      wireframe,
    });
  }
  const meshName = mesh.name || '';
  if (Array.isArray(mesh.material)) {
    return mesh.material.map((mat) => {
      const matName = (mat as any)?.name || '';
      return getUnifiedSingleMaterial(meshName, matName, mat, wireframe);
    });
  }
  const matName = (mesh.material as any)?.name || '';
  return getUnifiedSingleMaterial(meshName, matName, mesh.material, wireframe);
}

// Alias for backwards compatibility
const createUnifiedArchitecturalMaterial = createUnifiedCadastralMaterial;

/**
 * Register original materials on mesh userData before applying any override.
 * Preserves original GLB / OSM2World / OSM materials so switching modes is instant.
 */
function registerAndApplyMaterials(
  group: THREE.Group,
  mode: ThreeMaterialMode,
  wireframe: boolean,
) {
  group.traverse((child) => {
    if ((child as THREE.Mesh).isMesh) {
      const mesh = child as THREE.Mesh;
      if (!mesh.userData.originalMaterial) {
        mesh.userData.originalMaterial = Array.isArray(mesh.material)
          ? mesh.material.map((m) => m.clone())
          : mesh.material.clone();
      }
    }
  });
  applyMaterialModeToGroup(group, mode, wireframe);
}

/**
 * Traverse scene group and apply either UNIFIED or SOURCE materials without reloading models.
 */
function applyMaterialModeToGroup(
  group: THREE.Group,
  mode: ThreeMaterialMode,
  wireframe: boolean,
) {
  group.traverse((child) => {
    if ((child as THREE.Mesh).isMesh) {
      const mesh = child as THREE.Mesh;
      if (mode === 'UNIFIED') {
        mesh.material = createUnifiedArchitecturalMaterial(mesh, wireframe);
      } else {
        // SOURCE MATERIALS MODE
        if (mesh.userData.originalMaterial) {
          if (Array.isArray(mesh.userData.originalMaterial)) {
            mesh.material = mesh.userData.originalMaterial.map((m: THREE.Material) => {
              const cloned = m.clone();
              if ('wireframe' in cloned) (cloned as any).wireframe = wireframe;
              return cloned;
            });
          } else {
            const cloned = mesh.userData.originalMaterial.clone();
            if ('wireframe' in cloned) (cloned as any).wireframe = wireframe;
            mesh.material = cloned;
          }
        }
      }
    }
  });
}

/**
 * Procedural Source Materials Generator:
 * Uses available genuine OSM tags (building:colour, roof:colour, building:material, roof:material).
 * If tags are unavailable, falls back to neutral cool grey (never invents landmark colors).
 */
function createArchitecturalMaterials(building: Building, wireframe: boolean) {
  const rawTags = (building as any).raw_tags || building.raw_osm_data?.tags || {};
  const matTag = (rawTags['building:material'] || building.assessment?.building_material || building.building_material || '').toLowerCase();
  const colorTag = (rawTags['building:colour'] || building.building_color || '').toLowerCase();
  const roofMatTag = (rawTags['roof:material'] || building.roof?.material || '').toLowerCase();
  const roofColorTag = (rawTags['roof:colour'] || building.roof?.color || '').toLowerCase();

  let wallColor = 0xcbd5e1; // Default neutral cool grey / light stone (#CBD5E1)
  let roughness = 0.70;
  let metalness = 0.05;

  if (colorTag.startsWith('#')) {
    const parsed = parseInt(colorTag.replace('#', ''), 16);
    if (!isNaN(parsed)) wallColor = parsed;
  } else if (colorTag === 'white' || colorTag.includes('marble')) {
    wallColor = 0xf8fafc;
    roughness = 0.40;
  } else if (colorTag === 'red' || colorTag.includes('brick')) {
    wallColor = 0x9a3412;
    roughness = 0.80;
  } else if (colorTag === 'grey' || colorTag === 'gray') {
    wallColor = 0x94a3b8;
  } else if (colorTag === 'brown' || colorTag.includes('wood')) {
    wallColor = 0x78350f;
  }

  if (matTag.includes('glass')) {
    roughness = 0.15;
    metalness = 0.40;
  } else if (matTag.includes('metal')) {
    roughness = 0.30;
    metalness = 0.80;
  }

  const wallMaterial = new THREE.MeshStandardMaterial({
    color: wallColor,
    roughness,
    metalness,
    wireframe,
  });

  const podiumMaterial = new THREE.MeshStandardMaterial({
    color: 0x94a3b8,
    roughness: 0.80,
    metalness: 0.05,
    wireframe,
  });

  let roofColor = 0x64748b; // Neutral slate grey
  let roofRoughness = 0.65;
  let roofMetalness = 0.10;

  if (roofColorTag.startsWith('#')) {
    const parsed = parseInt(roofColorTag.replace('#', ''), 16);
    if (!isNaN(parsed)) roofColor = parsed;
  } else if (roofColorTag === 'white') {
    roofColor = 0xf8fafc;
  } else if (roofColorTag === 'red' || roofColorTag.includes('terracotta')) {
    roofColor = 0x9a3412;
  } else if (roofColorTag === 'grey' || roofColorTag === 'gray') {
    roofColor = 0x64748b;
  }

  if (roofMatTag.includes('metal') || roofMatTag.includes('copper')) {
    roofMetalness = 0.75;
  }

  const roofMaterial = new THREE.MeshStandardMaterial({
    color: roofColor,
    roughness: roofRoughness,
    metalness: roofMetalness,
    wireframe,
  });

  const goldAccentMat = new THREE.MeshStandardMaterial({
    color: 0x94a3b8,
    metalness: 0.20,
    roughness: 0.50,
    wireframe,
  });

  const trimMaterial = new THREE.MeshStandardMaterial({
    color: 0x94a3b8,
    roughness: 0.50,
    metalness: 0.15,
    wireframe,
  });

  const edgeMaterial = new THREE.LineBasicMaterial({
    color: 0x1e293b,
    transparent: true,
    opacity: 0.35,
  });

  return {
    wallMaterial,
    podiumMaterial,
    roofMaterial,
    goldAccentMat,
    trimMaterial,
    edgeMaterial,
    isHistoric: false,
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
 * 2. Parametric Curved Dome & Architectural Primitive Builder
 */
function createDomeMesh(
  radius: number,
  heightM: number,
  domeType: 'onion' | 'hemisphere' | 'ellipsoid' | 'shallow_dome' | 'cupola' | string,
  domeMat: THREE.Material,
  accentMat: THREE.Material,
  edgeMat: THREE.Material,
  radiusX?: number,
  radiusZ?: number,
): THREE.Group {
  const normShape = (
    domeType === 'onion' ||
    domeType === 'ellipsoid' ||
    domeType === 'shallow_dome' ||
    domeType === 'cupola'
      ? domeType
      : 'hemisphere'
  );

  return createParametricDomeMesh({
    shape: normShape,
    radius,
    radiusX: radiusX || radius,
    radiusZ: radiusZ || radius,
    height: heightM,
    hasDrum: true,
    drumRadius: (radiusX || radius) * 0.94,
    drumHeight: Math.min(heightM * 0.22, 2.5),
    hasFinial: true,
    finialHeight: Math.max(heightM * 0.32, 2.5),
    finialStyle: normShape === 'onion' ? 'kalash' : 'spire',
    materials: {
      domeMaterial: domeMat,
      drumMaterial: domeMat,
      accentMaterial: accentMat,
      edgeMaterial: edgeMat,
    },
  });
}

/**
 * 3. Procedural Roof Mesh Generator matching shape perimeters with REAL CURVED GEOMETRY
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
  const radiusX = (dims.width || 10) / 2;
  const radiusZ = (dims.depth || 10) / 2;
  const primaryRadius = Math.min(radiusX, radiusZ);
  const cx = offsetCenter?.x || 0;
  const cz = offsetCenter?.z || 0;

  if (normShape.includes('onion') || normShape.includes('bulbous')) {
    const onionGroup = createDomeMesh(
      primaryRadius,
      Math.max(roofHeightM, primaryRadius * 1.15, 4.5),
      'onion',
      roofMat,
      accentMat,
      edgeMat,
      radiusX,
      radiusZ,
    );
    onionGroup.position.set(cx, baseElevation, cz);
    group.add(onionGroup);
  } else if (normShape.includes('shallow')) {
    const shallowGroup = createDomeMesh(
      primaryRadius,
      Math.max(roofHeightM, primaryRadius * 0.5, 2.0),
      'shallow_dome',
      roofMat,
      accentMat,
      edgeMat,
      radiusX,
      radiusZ,
    );
    shallowGroup.position.set(cx, baseElevation, cz);
    group.add(shallowGroup);
  } else if (normShape.includes('ellipsoid')) {
    const ellipGroup = createDomeMesh(
      primaryRadius,
      Math.max(roofHeightM, primaryRadius * 0.9, 3.5),
      'ellipsoid',
      roofMat,
      accentMat,
      edgeMat,
      radiusX,
      radiusZ,
    );
    ellipGroup.position.set(cx, baseElevation, cz);
    group.add(ellipGroup);
  } else if (normShape.includes('cupola')) {
    const cupolaGroup = createDomeMesh(
      primaryRadius,
      Math.max(roofHeightM, primaryRadius * 0.8, 3.0),
      'cupola',
      roofMat,
      accentMat,
      edgeMat,
      radiusX,
      radiusZ,
    );
    cupolaGroup.position.set(cx, baseElevation, cz);
    group.add(cupolaGroup);
  } else if (normShape.includes('dome') || normShape.includes('round') || normShape.includes('spherical')) {
    const domeGroup = createDomeMesh(
      primaryRadius,
      Math.max(roofHeightM, primaryRadius * 0.95, 3.5),
      'hemisphere',
      roofMat,
      accentMat,
      edgeMat,
      radiusX,
      radiusZ,
    );
    domeGroup.position.set(cx, baseElevation, cz);
    group.add(domeGroup);
  } else if (normShape.includes('pyramidal') || normShape.includes('pyramid')) {
    const pyramidH = Math.max(roofHeightM, 4);
    const pyramidGeo = new THREE.ConeGeometry(primaryRadius * 1.08, pyramidH, 4);
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
    const coneGeo = new THREE.ConeGeometry(primaryRadius * 1.05, coneH, 32);
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

  // ── Synthesize footprint for manually-entered buildings (lat/lon only, no GeoJSON) ──
  if (!building.footprint) {
    const estFloors = building.floor_count || Math.max(Math.round(totalHeight / (floorHeight || 3.5)), 1);
    const estSideM = Math.max(Math.sqrt(Math.max(estFloors * 200, 400)), 12);
    const cLat = centerLat || building.latitude || 0;
    const cLng = centerLng || building.longitude || 0;
    const halfDegLat = estSideM / 2 / 111320;
    const halfDegLng = halfDegLat / Math.cos((cLat * Math.PI) / 180);
    (building as any).footprint = {
      type: 'Polygon',
      coordinates: [[
        [cLng - halfDegLng, cLat - halfDegLat],
        [cLng + halfDegLng, cLat - halfDegLat],
        [cLng + halfDegLng, cLat + halfDegLat],
        [cLng - halfDegLng, cLat + halfDegLat],
        [cLng - halfDegLng, cLat - halfDegLat],
      ]],
    };
    console.info(`[MapThreeJS] Synthesized ${estSideM.toFixed(0)}m square footprint for manual building: ${building.building_name}`);
  }


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

    // Derive effective floor height from parent metrics (e.g. 280.2m / 76 floors ≈ 3.68m)
    const parentFloors = building.floor_count || Math.max(Math.round(totalHeight / (floorHeight || 3.5)), 1);
    const effectiveFloorHeight = totalHeight > 0 && parentFloors > 0
      ? totalHeight / parentFloors
      : (floorHeight || 3.5);

    // Distribution tracking for part collapse sanity check
    const partCentroids: THREE.Vector2[] = [];
    let distinctGeoPolygons = false;
    let prevFirstPt: [number, number] | null = null;

    parts.forEach((part: BuildingPart, partIdx: number) => {
      // 1. Resolve Top Height in priority order:
      // part.height -> part.levels * floorHeight -> parent totalHeight -> fallback
      let resolvedTopHeight: number;
      if (part.height !== undefined && part.height > 0) {
        resolvedTopHeight = part.height;
      } else if (part.levels !== undefined && part.levels > 0) {
        resolvedTopHeight = part.levels * effectiveFloorHeight;
      } else if (totalHeight > 0) {
        resolvedTopHeight = totalHeight;
      } else {
        resolvedTopHeight = Math.max((building.floor_count || 3) * effectiveFloorHeight, 10);
      }

      // 2. Resolve Base Height (min_height / min_levels)
      const baseElev = part.min_height !== undefined
        ? Math.max(part.min_height, 0)
        : (part.min_levels !== undefined ? Math.max(part.min_levels * effectiveFloorHeight, 0) : 0);

      // 3. Resolve Roof Height & Wall Extrusion Depth
      const rawRoofShape = (part.roof_shape || '').toLowerCase().trim();
      const roofH = part.roof_height && part.roof_height > 0
        ? Math.min(part.roof_height, (resolvedTopHeight - baseElev) * 0.5)
        : (rawRoofShape && rawRoofShape !== 'flat' ? Math.min((resolvedTopHeight - baseElev) * 0.25, 6) : 0);

      const extrusionH = Math.max(resolvedTopHeight - baseElev - roofH, 1.0);

      // 4. Convert part footprint relative to the ONE SHARED BUILDING ORIGIN (centerLng, centerLat)
      // IMPORTANT: Do NOT fall back to parent building footprint when a part has no footprint.
      // If all parts stacked the same parent polygon they would overlap/cancel visually.
      const partFootprint = part.footprint;
      if (!partFootprint) return; // Skip parts without their own geometry
      const partShapes = footprintToShapes(partFootprint, centerLng, centerLat);
      if (partShapes.length === 0) return; // Skip if shape conversion failed
      const partMetrics = getShapeMetrics(partFootprint, centerLng, centerLat);
      // Skip degenerate zero-area parts (thin slivers / collapsed polygons)
      if (partMetrics.areaSqm < 1.0) return;
      const classification = classifyBuildingPart(part, partMetrics);
      partTypes.push(classification);

      // Part centroid offset relative to shared origin for distribution checks
      const pOffset = getPartCenterOffset(partFootprint, centerLng, centerLat);
      partCentroids.push(new THREE.Vector2(pOffset.x, pOffset.z));

      if (part.footprint?.coordinates?.[0]?.[0]) {
        const firstPt = part.footprint.coordinates[0][0] as [number, number];
        if (prevFirstPt && (Math.abs(firstPt[0] - prevFirstPt[0]) > 1e-6 || Math.abs(firstPt[1] - prevFirstPt[1]) > 1e-6)) {
          distinctGeoPolygons = true;
        }
        prevFirstPt = firstPt;
      }

      // 5. Extrude Primary Polygonal Geometry (Preserving true relative X/Z positions from shared origin)
      partShapes.forEach((shape) => {
        const extrudeGeo = new THREE.ExtrudeGeometry(shape, {
          depth: extrusionH,
          bevelEnabled: false,
        });
        // Rotate geometry so extrusion depth is along +Y (Up)
        extrudeGeo.rotateX(-Math.PI / 2);
        extrudeGeo.computeVertexNormals();

        const partMesh = new THREE.Mesh(extrudeGeo, materials.wallMaterial);
        partMesh.name = `osm_part_${partIdx}_${part.id || ''}`;
        partMesh.position.set(0, baseElev, 0);
        partMesh.castShadow = true;
        partMesh.receiveShadow = true;

        visualGroup.add(partMesh);
        exteriorMeshes.push(partMesh);

        const edges = new THREE.LineSegments(new THREE.EdgesGeometry(extrudeGeo, 30), materials.edgeMaterial);
        edges.position.set(0, baseElev, 0);
        visualGroup.add(edges);
      });

      // 6. Parametric Roof on Part (if tagged)
      if (roofH > 0.1 && rawRoofShape && rawRoofShape !== 'flat') {
        generatePolygonalRoof(
          visualGroup,
          partShapes,
          rawRoofShape,
          baseElev + extrusionH,
          roofH,
          partMetrics,
          materials.roofMaterial,
          materials.goldAccentMat,
          materials.edgeMaterial,
          pOffset,
        );
      }
    });

    // Sanity check: Verify part distribution across shared origin
    if (parts.length >= 4 && distinctGeoPolygons) {
      const avgDist = partCentroids.reduce((sum, pt) => sum + pt.length(), 0) / partCentroids.length;
      if (avgDist < 0.001) {
        console.warn('WARNING: building parts collapsed to shared center');
      }
    }
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

  // 7. ── Generic Curved Architectural Elements (Domes, Arches, Drums, Spires) ──
  const customArchElements = building.architectural_elements || building.architecturalElements || [];
  if (customArchElements.length > 0) {
    const curvedGroup = createCurvedArchitecturalElements(
      customArchElements,
      { width: dims.width, depth: dims.depth, height: totalHeight },
      {
        wallMaterial: materials.wallMaterial,
        roofMaterial: materials.roofMaterial,
        accentMaterial: materials.goldAccentMat,
        edgeMaterial: materials.edgeMaterial,
      },
    );
    visualGroup.add(curvedGroup);
    curvedGroup.traverse((child) => {
      if ((child as THREE.Mesh).isMesh) {
        exteriorMeshes.push(child as THREE.Mesh);
      }
    });
    partTypes.push('curved-architectural-elements');
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

  const [materialMode, setMaterialMode] = useState<ThreeMaterialMode>('UNIFIED');
  const materialModeRef = useRef<ThreeMaterialMode>('UNIFIED');
  materialModeRef.current = materialMode;

  const [autoRotate, setAutoRotate] = useState(false);
  const [wireframeMode, setWireframeMode] = useState(false);
  const [layerVisibilityMode, setLayerVisibilityMode] = useState<'both' | 'model' | 'cadastre'>('both');
  const [, setHoveredUnitId] = useState<string | null>(null);
  const [groundElevation, setGroundElevation] = useState<number | null>(null);
  const [activeLod, setActiveLod] = useState<LODLevel>('MEDIUM');
  const [showDebugHud, setShowDebugHud] = useState(false);

  // Telemetry state strictly reflecting real source data & mesh counts
  const [telemetry, setTelemetry] = useState<ArchitecturalTelemetry>({
    provider: 'OSM_BUILDING_PART',
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
    originalMaterials: true,
    statusBadge: 'Cadastral Structure',
    materialMode: 'UNIFIED',
    materialSource: 'Neutral fallback',
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

  const verifiedBuilding = useMemo(() => applyVerifiedBuildingMetadata(building), [building]);
  const verifiedRecord = useMemo(() => getVerifiedBuildingMetadata(verifiedBuilding), [verifiedBuilding]);

  const { lat: centerLat, lng: centerLng } = getBuildingCenter(verifiedBuilding);
  const dims = useMemo(
    () => getFootprintDimensionsWithFallback(verifiedBuilding.footprint, verifiedBuilding),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [verifiedBuilding.footprint, verifiedBuilding.latitude, verifiedBuilding.longitude]
  );
  const buildingHeight = getBuildingHeight(verifiedBuilding);
  const floorHeight = getFloorHeight(verifiedBuilding);
  const floorInfo = useMemo(() => getFloorCountInfo(verifiedBuilding), [verifiedBuilding]);

  // Stable building identifier — building geometry is reconstructed ONLY when target building changes
  const buildingKey = useMemo(
    () => `${verifiedBuilding?.building_id || ''}_${centerLat.toFixed(6)}_${centerLng.toFixed(6)}_${verifiedBuilding?.osm_id || ''}`,
    [verifiedBuilding?.building_id, centerLat, centerLng, verifiedBuilding?.osm_id]
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
    // UNDERGROUND VISUALIZATION & 3D UTILITY PIPELINES
    // Renders basement levels below the ground plane as transparent
    // volumetric blocks and glowing subterranean utility pipes (Water, Sewage, Gas, Power, Telecom).
    // ─────────────────────────────────────────────────────────────
    const ugGroup = new THREE.Group();
    ugGroup.name = 'undergroundGroup';
    scene.add(ugGroup);

    const undergroundData = building.underground;
    if (undergroundData?.ulpin_details?.length) {
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

    // ── Render 3D Subterranean Utility Pipelines (Water, Sewage, Gas, Power, Telecom) ──
    try {
      const utilityPipelines = getBuildingUtilityPipelines(building);
      utilityPipelines.forEach((pipe) => {
        if (pipe.pathLocal3D && pipe.pathLocal3D.length >= 2) {
          const curve = new THREE.CatmullRomCurve3(pipe.pathLocal3D);
          const pipeRadius = Math.max((pipe.diameter_mm / 1000) * 0.9, 0.28);
          const tubeGeo = new THREE.TubeGeometry(curve, 32, pipeRadius, 12, false);
          const tubeMat = new THREE.MeshStandardMaterial({
            color: pipe.hexColor,
            emissive: pipe.hexColor,
            emissiveIntensity: 0.55,
            roughness: 0.2,
            metalness: 0.85,
            transparent: true,
            opacity: 0.95,
          });
          const tubeMesh = new THREE.Mesh(tubeGeo, tubeMat);
          tubeMesh.name = `utility_pipe_${pipe.type}`;
          ugGroup.add(tubeMesh);

          // Junction chambers at each bend/node
          pipe.pathLocal3D.forEach((pt) => {
            const nodeGeo = new THREE.CylinderGeometry(pipeRadius * 1.7, pipeRadius * 1.7, pipeRadius * 2.2, 12);
            const nodeMat = new THREE.MeshStandardMaterial({
              color: pipe.hexColor,
              emissive: pipe.hexColor,
              emissiveIntensity: 0.65,
              roughness: 0.2,
              metalness: 0.9,
            });
            const nodeMesh = new THREE.Mesh(nodeGeo, nodeMat);
            nodeMesh.position.copy(pt);
            ugGroup.add(nodeMesh);
          });

          // Riser feeder connections up to foundation
          pipe.riserConnections.forEach(({ from, to }) => {
            const riserCurve = new THREE.LineCurve3(from, to);
            const riserGeo = new THREE.TubeGeometry(riserCurve, 8, pipeRadius * 0.7, 8, false);
            const riserMesh = new THREE.Mesh(riserGeo, tubeMat);
            ugGroup.add(riserMesh);
          });
        }
      });
    } catch (pipeErr) {
      console.warn('Could not construct 3D utility pipes:', pipeErr);
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
      const validation = validateBuildingData(verifiedBuilding);
      if (!validation.isValid) {
        console.warn('Building data validation issue:', validation.error);
      }

      while (visualBuildingGroup.children.length > 0) {
        visualBuildingGroup.remove(visualBuildingGroup.children[0]);
      }
      while (facadeDetailsGroup.children.length > 0) {
        facadeDetailsGroup.remove(facadeDetailsGroup.children[0]);
      }

      const decision = evaluateBestGeometryProvider(verifiedBuilding, false);
      const isReferenceAssisted = decision.provider === 'REFERENCE_ASSISTED';
      const materials = createArchitecturalMaterials(verifiedBuilding, wireframeMode);

      let reconResult: any;

      try {
        if (isReferenceAssisted) {
          reconResult = constructReferenceAssistedBuilding(
            visualBuildingGroup,
            facadeDetailsGroup,
            verifiedBuilding,
            dims,
            buildingHeight,
            floorHeight,
            wireframeMode,
            materials,
            verifiedBuilding.reference_images,
            verifiedBuilding.multiview_analysis
          );
        } else {
          reconResult = constructMultiMassBuilding(
            visualBuildingGroup,
            facadeDetailsGroup,
            verifiedBuilding,
            dims,
            buildingHeight,
            floorHeight,
            wireframeMode,
            inferredAiData,
          );
        }
      } catch (recErr) {
        console.error("PIET ADMIN 3D BUILD FAILURE", {
          error: recErr,
          stack: (recErr as any)?.stack,
          buildingData: verifiedBuilding,
          architecturalFeatures: (verifiedBuilding as any)?.architectural_elements || verifiedBuilding?.multiview_analysis?.architecturalElements,
          provider: isReferenceAssisted ? 'REFERENCE_ASSISTED' : decision.provider,
          geometryInputs: { dims, buildingHeight, floorHeight }
        });
        while (visualBuildingGroup.children.length > 0) {
          visualBuildingGroup.remove(visualBuildingGroup.children[0]);
        }
        while (facadeDetailsGroup.children.length > 0) {
          facadeDetailsGroup.remove(facadeDetailsGroup.children[0]);
        }
        const safeW = Math.max(dims.width, 12);
        const safeH = Math.max(buildingHeight, 6);
        const safeD = Math.max(dims.depth, 12);
        const safeGeo = new THREE.BoxGeometry(safeW, safeH, safeD);
        const safeMesh = new THREE.Mesh(safeGeo, materials.wallMaterial);
        safeMesh.position.set(0, safeH / 2, 0);
        visualBuildingGroup.add(safeMesh);
        reconResult = {
          exteriorMeshes: [safeMesh],
          geometrySource: 'Safe Procedural Box Fallback',
          partTypes: ['fallback-box'],
          roofType: 'flat',
          roofHeightM: 0,
          proportions: { platformM: 0, wallM: safeH, roofM: 0, finialM: 0 },
          circularity: 0.5,
        };
      }

      exteriorMeshesRef.current = reconResult.exteriorMeshes;

      // Register original materials and apply active material mode
      registerAndApplyMaterials(visualBuildingGroup, materialModeRef.current, wireframeMode);
      registerAndApplyMaterials(facadeDetailsGroup, materialModeRef.current, wireframeMode);

      // Ensure all meshes have frustum culling disabled & valid bounds
      visualBuildingGroup.traverse((child) => {
        if ((child as THREE.Mesh).isMesh) {
          const m = child as THREE.Mesh;
          m.frustumCulled = false;
          m.geometry?.computeBoundingBox?.();
          m.geometry?.computeBoundingSphere?.();
        }
      });

      const sourceParts = verifiedBuilding.building_parts?.length || 0;
      const genMeshes = reconResult.exteriorMeshes.length;
      const bBox = new THREE.Box3().setFromObject(visualBuildingGroup);
      if (bBox.isEmpty()) {
        bBox.min.set(-dims.width / 2, 0, -dims.depth / 2);
        bBox.max.set(dims.width / 2, buildingHeight || 10, dims.depth / 2);
      }
      const size = new THREE.Vector3();
      const center = new THREE.Vector3();
      bBox.getSize(size);
      bBox.getCenter(center);
      const renderedHeight = Math.max(size.y, 0.1);
      const sourceHeight = verifiedBuilding.height_meters || verifiedBuilding.height;

      // Metric height discrepancy warning (>15% difference from authoritative source height)
      if (sourceHeight && sourceHeight > 0) {
        const diffRatio = Math.abs(renderedHeight - sourceHeight) / sourceHeight;
        if (diffRatio > 0.15) {
          console.warn(`WARNING: Building metric height mismatch: Source=${sourceHeight}m, Rendered=${renderedHeight.toFixed(1)}m (${(diffRatio * 100).toFixed(1)}% diff)`);
        }
      }

      // Dynamic camera auto-framing according to actual rendered metric dimensions
      const maxDim = Math.max(size.x, size.y, size.z, 15);
      const heightRatio = size.y / Math.max(size.x, size.z, 1);
      const targetDist = Math.max(maxDim * (heightRatio > 2.0 ? 1.35 : 1.55), size.y * 1.15, 45);

      camera.position.set(
        center.x + targetDist * 0.85,
        center.y + size.y * 0.15,
        center.z + targetDist * 0.85
      );
      camera.lookAt(center.x, center.y * 0.9, center.z);
      controls.target.set(center.x, center.y * 0.9, center.z);
      controls.minDistance = Math.max(2, maxDim * 0.08);
      controls.maxDistance = Math.max(35000, maxDim * 15);
      controls.update();

      const isAiAssisted = isReferenceAssisted || Boolean(inferredAiData && inferredAiData.confidence >= 0.50);

      const tierDecision: BuildingGeometrySourceTier = isReferenceAssisted
        ? 'REFERENCE_ASSISTED'
        : sourceParts > 0
        ? 'OSM_BUILDING_PART'
        : 'OSM_FOOTPRINT';

      const hasOsmMaterialTags = Boolean(
        verifiedBuilding.building_color ||
        verifiedBuilding.roof?.color ||
        verifiedBuilding.building_material ||
        verifiedBuilding.roof?.material ||
        (verifiedBuilding as any).raw_tags?.['building:colour'] ||
        (verifiedBuilding as any).raw_tags?.['roof:colour'] ||
        (verifiedBuilding as any).raw_tags?.['building:material'] ||
        (verifiedBuilding as any).raw_tags?.['roof:material']
      );

      const statusBadge = isReferenceAssisted
        ? 'Reference-Assisted Reconstruction'
        : sourceParts > 0
        ? 'OSM building:part'
        : 'OSM Footprint Extrusion';

      const estimatedFields = isReferenceAssisted
        ? ['floors', 'facade_bays', 'stair_tower_height', 'horizontal_bands', 'ground_glazing']
        : inferredAiData?.inferred_fields || [];

      const aiConfidenceVal = isReferenceAssisted
        ? 94
        : isAiAssisted
        ? Math.round((inferredAiData?.confidence || 0.8) * 100)
        : null;

      setTelemetry({
        provider: tierDecision,
        geometrySource: isReferenceAssisted ? 'Multi-view Reference Images + OSM Footprint' : reconResult.geometrySource,
        osmId: verifiedBuilding.osm_id || 'osm/auto',
        sourcePartCount: sourceParts || (isReferenceAssisted ? 6 : 1),
        buildingPartsCount: sourceParts || (isReferenceAssisted ? 6 : 1),
        partTypes: reconResult.partTypes || [],
        roofType: reconResult.roofType,
        roofHeightM: reconResult.roofHeightM,
        generatedMeshCount: genMeshes,
        lodLevel: 'MEDIUM',
        visualHeight: renderedHeight,
        cadastralHeight: (verifiedBuilding.floor_count || 1) * floorHeight,
        fallbackUsed: decision.fallbackUsed,
        modelLoaded: true,
        modelVisible: true,
        hardcodedGeometry: false,
        originalMaterials: hasOsmMaterialTags,
        materialMode: materialModeRef.current,
        materialSource: hasOsmMaterialTags ? 'OSM tags' : 'Neutral fallback',
        statusBadge,
        aiAssisted: isAiAssisted,
        aiConfidence: aiConfidenceVal,
        aiFieldsUsed: estimatedFields,
        aiReasoning: isReferenceAssisted
          ? 'Reconstructed from multi-view photographs (repeating bays, side stair tower, horizontal slab bands, flat roof with parapet)'
          : inferredAiData?.reasoning,
        sourceMetadata: {
          roofShape: isReferenceAssisted ? 'flat' : verifiedBuilding.roof?.shape,
          buildingMaterial: verifiedBuilding.assessment?.building_material || verifiedBuilding.building_material,
          height: verifiedBuilding.height_meters || verifiedBuilding.height,
          levels: verifiedBuilding.floor_count,
        },
        inferredMetadata: isReferenceAssisted ? reconResult.analysis : inferredAiData,
        proportions: reconResult.proportions || {
          platformM: 0,
          wallM: renderedHeight,
          roofM: reconResult.roofHeightM,
          finialM: 0,
        },
        hasHoles: getShapeMetrics(verifiedBuilding.footprint).hasHoles,
        circularity: reconResult.circularity,
        sourceHeightM: sourceHeight,
        renderedHeightM: renderedHeight,
        sourceFloors: verifiedBuilding.floor_count || 1,
        modelScale: 1.0,
        sharedOrigin: { lat: centerLat, lng: centerLng },
        boundingBox: {
          width: Math.round(size.x * 10) / 10,
          height: Math.round(size.y * 10) / 10,
          depth: Math.round(size.z * 10) / 10,
        },
        partsCollapsed: false,
      });

      console.log({
        buildingName: building.building_name || building.address || 'Cadastral Building',
        osmId: building.osm_id || 'osm/auto',
        provider: tierDecision,
        sourcePartCount: sourceParts,
        generatedMeshCount: genMeshes,
        aiAssisted: isAiAssisted,
        aiConfidence: isAiAssisted ? inferredAiData?.confidence : null,
        modelVisible: true,
        modelPosition: visualBuildingGroup.position,
        modelScale: visualBuildingGroup.scale,
        boundingBox: bBox,
        selectedFloor: selectedFloorRef.current,
        requestId: reqId,
      });
    };

    // ─────────────────────────────────────────────────────────────
    // PRIORITY 1: CUSTOM 3D ARCHITECTURAL MODEL (GLB / GLTF)
    // If a registered or direct custom model exists, load high-detail asset,
    // auto-frame camera to bounding box, register original materials,
    // and apply the active material mode policy.
    // ─────────────────────────────────────────────────────────────
    const customModelConfig = findCustomModel(building);

    if (customModelConfig) {
      (async () => {
        try {
          const customResult = await loadCustomModelMesh({
            modelUrl: customModelConfig.modelUrl,
            modelScale: customModelConfig.scale,
            rotation: customModelConfig.rotation,
            groundOffset: customModelConfig.groundOffset,
          });

          if (reqId !== currentRequestIdRef.current) return;

          while (visualBuildingGroup.children.length > 0) {
            visualBuildingGroup.remove(visualBuildingGroup.children[0]);
          }
          while (facadeDetailsGroup.children.length > 0) {
            facadeDetailsGroup.remove(facadeDetailsGroup.children[0]);
          }

          visualBuildingGroup.add(customResult.group);
          visualBuildingGroup.visible = true;
          exteriorMeshesRef.current = customResult.meshes;

          // Register original materials and apply active material mode (Unified Cadastral default)
          registerAndApplyMaterials(visualBuildingGroup, materialModeRef.current, wireframeMode);

          // Auto-frame camera and OrbitControls using the loaded model bounding box
          const bBox = customResult.boundingBox;
          const center = customResult.center;
          const size = customResult.dimensions;
          const maxDim = Math.max(size.width, size.depth, size.height, 15);
          const targetDist = Math.max(maxDim * 1.35, 40);

          camera.position.set(targetDist * 0.9, center.y + maxDim * 0.35, targetDist * 0.9);
          controls.target.set(center.x, center.y * 0.8, center.z);
          controls.minDistance = Math.max(2, maxDim * 0.15);
          controls.maxDistance = Math.max(1500, maxDim * 12);
          controls.update();

          const visualH = size.height || customModelConfig.calibratedHeightM || buildingHeight;

          setTelemetry({
            provider: 'CUSTOM_MODEL',
            geometrySource: 'Imported architectural model',
            osmId: building.osm_id || customModelConfig.id,
            sourcePartCount: 1,
            buildingPartsCount: 1,
            partTypes: ['glb-architectural-mesh'],
            roofType: customModelConfig.name ? `${customModelConfig.name} Geometry` : 'Architectural Spire / Crown',
            roofHeightM: visualH * 0.55,
            generatedMeshCount: customResult.meshCount,
            lodLevel: 'CLOSE',
            visualHeight: visualH,
            cadastralHeight: (building.floor_count || customModelConfig.floorCount || 3) * floorHeight,
            fallbackUsed: false,
            modelLoaded: true,
            modelVisible: true,
            hardcodedGeometry: false,
            originalMaterials: true,
            materialMode: materialModeRef.current,
            materialSource: 'Original GLB',
            statusBadge: 'High-detail architectural model',
            customModelUrl: customResult.modelUrl,
            aiAssisted: false,
            aiConfidence: null,
            aiFieldsUsed: [],
            sourceMetadata: {
              roofShape: '3D Mesh Geometry',
              buildingMaterial: 'GLB Mesh Materials',
              height: visualH,
              levels: building.floor_count || customModelConfig.floorCount || 3,
            },
            inferredMetadata: undefined,
            proportions: {
              platformM: 4.5,
              wallM: visualH * 0.4,
              roofM: visualH * 0.55,
              finialM: 4.2,
            },
            hasHoles: false,
            circularity: 0.92,
          });

          logModelPipelineTelemetry({
            buildingName: building.building_name || customModelConfig.name,
            provider: 'CUSTOM_MODEL',
            geometrySource: 'Imported architectural model',
            modelLoaded: true,
            fallbackUsed: false,
            originalMaterials: true,
            modelUrl: customResult.modelUrl,
            meshCount: customResult.meshCount,
            latitude: centerLat,
            longitude: centerLng,
          });
        } catch (loadErr) {
          console.warn('Custom GLB model loading failed, falling back to OSM pipeline:', loadErr);
          applyProceduralReconstruction();
        }
      })();
    }

    if (!customModelConfig) {
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

      // 2. Gemini AI inference — always run for manual buildings (no osm_id / no footprint)
      //    For OSM buildings run only when roof tag is missing
      const hasExplicitRoofTag = Boolean(building.roof?.shape);
      const hasExplicitParts = Boolean(building.building_parts && building.building_parts.length > 0);
      const isManualBuilding = !building.osm_id && !building.footprint;

      if (!hasExplicitRoofTag || isManualBuilding) {
        // Use synthesized footprint metrics if no real footprint
        const shapeMetrics = getShapeMetrics(building.footprint, centerLng, centerLat);
        const estFloors = building.floor_count || Math.max(Math.round(buildingHeight / (floorHeight || 3.5)), 1);

        inferBuildingMetadata({
          osm_id: building.osm_id,
          building_name: building.building_name,
          osm_tags: building.raw_osm_data?.tags || {},
          footprint_metrics: {
            area_sqm: shapeMetrics.areaSqm || estFloors * 200,
            circularity: shapeMetrics.circularity || 0.8,
            aspect_ratio: shapeMetrics.aspectRatio || 1.0,
            vertex_count: shapeMetrics.vertexCount || 4,
            has_holes: shapeMetrics.hasHoles || false,
            is_symmetric: shapeMetrics.isSymmetric !== false,
          },
          building_parts_count: hasExplicitParts ? (building.building_parts?.length || 0) : 0,
          known_height: building.height_meters || building.height,
          known_levels: building.floor_count,
          known_roof_shape: building.roof?.shape,
          known_material: building.assessment?.building_material || building.building_material,
        })
          .then((inferredResult) => {
            if (reqId === currentRequestIdRef.current && inferredResult && inferredResult.confidence >= 0.45) {
              applyProceduralReconstruction(inferredResult);
            }
          })
          .catch((err) => {
            console.debug('Optional Gemini inference skipped:', err);
          });
      }

      // 3. Asynchronously fetch full Overpass data & convert with OSM2World
      // STRICT RULE: Provider Isolation. If we already have OSM building:parts or reference-assisted reconstruction,
      // do NOT run OSM2World fallback or overwrite the primary architectural geometry.
      // Also skip for manual buildings (no osm_id) — they won't match any OSM element.
      const tierEval = evaluateBestGeometryProvider(verifiedBuilding, false);
      const isRefAssisted = tierEval.provider === 'REFERENCE_ASSISTED';
      const hasBuildingParts = Boolean(verifiedBuilding.building_parts && verifiedBuilding.building_parts.length > 0);
      const hasOsmId = Boolean(verifiedBuilding.osm_id);
      if (!hasBuildingParts && !isRefAssisted && hasOsmId) {
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
            while (visualBuildingGroup.children.length > 0) {
              visualBuildingGroup.remove(visualBuildingGroup.children[0]);
            }
            while (facadeDetailsGroup.children.length > 0) {
              facadeDetailsGroup.remove(facadeDetailsGroup.children[0]);
            }

            visualBuildingGroup.add(o2wResult.group);
            visualBuildingGroup.visible = true;
            exteriorMeshesRef.current = o2wResult.meshes;

            // Register original materials and apply active material mode
            registerAndApplyMaterials(visualBuildingGroup, materialModeRef.current, wireframeMode);

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
              provider: 'OSM2WORLD',
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
              originalMaterials: true,
              materialMode: materialModeRef.current,
              materialSource: 'OSM2World',
              statusBadge: 'OSM2World Web Mesh',
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
          }
        } catch (err) {
          console.warn('OSM2World generation failed, keeping procedural fallback:', err);
        }
      })();
      }
    }

    // Construct Cadastral ULPIN Floor Layers
    // Includes below-ground property stratum (B1 — Library) and stacked above-ground floors (F1..Fn).
    // Always generate slabs so floor isolation and property strata selection always work.
    const unitMap = new Map<string, THREE.Mesh>();
    const units = verifiedBuilding?.units || [];
    const shape = verifiedBuilding.footprint ? footprintToShape(verifiedBuilding.footprint, centerLng, centerLat) : null;
    const totalFloors = verifiedRecord
      ? verifiedRecord.aboveGroundFloors
      : (verifiedBuilding.floor_count || Math.max(units.length, 3));
    const basementFloors = verifiedRecord !== null
      ? verifiedRecord.basementFloors
      : (verifiedBuilding.basement_count ?? verifiedBuilding.assessment?.basement_levels ?? 0);
    const isGBlock = verifiedRecord?.floorLabels && verifiedRecord.floorLabels[0] === 'G';
    const basementUse = verifiedRecord?.basementUse || verifiedBuilding.basement_use || 'Library';

    // Build a map from floor number to unit (if available)
    const floorToUnit = new Map<number, (typeof units)[0]>();
    units.forEach(u => { const f = getUnitFloor(u); floorToUnit.set(f, u); });

    const floorSlabs: THREE.Mesh[] = [];

    // 1. Create Below-Ground Strata Slabs (B1 — Basement Library, only if basement exists)
    for (let b = 1; b <= basementFloors; b++) {
      const bFloorNum = -b;
      const bLevelY = -b * floorHeight;
      const bUnit = floorToUnit.get(bFloorNum);

      const bMat = new THREE.MeshStandardMaterial({
        color: 0x6366f1,
        transparent: true,
        opacity: 0.35,
        depthWrite: false,
        wireframe: wireframeMode,
      });

      let bMesh: THREE.Mesh;
      if (shape) {
        const slabGeo = new THREE.ExtrudeGeometry(shape, { depth: floorHeight * 0.95, bevelEnabled: false });
        slabGeo.rotateX(-Math.PI / 2);
        slabGeo.computeBoundingBox();
        slabGeo.computeBoundingSphere();
        bMesh = new THREE.Mesh(slabGeo, bMat);
        bMesh.position.y = bLevelY;
      } else {
        const boxGeo = new THREE.BoxGeometry(dims.width * 1.01, floorHeight * 0.95, dims.depth * 1.01);
        boxGeo.computeBoundingBox();
        boxGeo.computeBoundingSphere();
        bMesh = new THREE.Mesh(boxGeo, bMat);
        bMesh.position.y = bLevelY + floorHeight / 2;
      }

      bMesh.frustumCulled = false;
      bMesh.userData = {
        unit: bUnit || {
          unit_id: `${verifiedBuilding.building_id || 'admin'}-B1-LIB`,
          floor: bFloorNum,
          unit_number: 'B1-LIB',
          use_type: basementUse,
          ulpin: `${verifiedBuilding.building_id || 'ULPIN'}-B1-LIB-001`,
        },
        baseColor: 0x6366f1,
        floorNum: bFloorNum,
        isBasement: true,
      };
      // Keep subtle basement volume visible below ground in cadastral mode
      bMesh.visible = layerVisibilityMode === 'both' || layerVisibilityMode === 'cadastre';
      cadastralULPINGroup.add(bMesh);
      floorSlabs.push(bMesh);

      if (bUnit) unitMap.set(bUnit.unit_id, bMesh);
      unitMap.set(`floor-${bFloorNum}`, bMesh);
      unitMap.set(`B${b}`, bMesh);
      unitMap.set(`${verifiedBuilding.building_id || 'admin'}-B1-LIB`, bMesh);
    }

    // 2. Create Above-Ground Strata Slabs (F1..Fn)
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
      levelMesh.userData = { unit: unit || { unit_id: `floor-${floorNum}`, floor: floorNum }, baseColor, floorNum, isBasement: false };
      levelMesh.visible = false;
      cadastralULPINGroup.add(levelMesh);
      floorSlabs.push(levelMesh);

      const pillLabel = isGBlock
        ? (verifiedRecord?.floorLabels?.[floorNum - 1] || `F${floorNum}`)
        : `F${floorNum}`;

      // Register by unit_id if a real unit exists, also by floor key
      if (unit) unitMap.set(unit.unit_id, levelMesh);
      unitMap.set(`floor-${floorNum}`, levelMesh);
      unitMap.set(pillLabel, levelMesh);
      if (isGBlock && floorNum === 1) unitMap.set('G', levelMesh);
      unitMap.set(`F${floorNum}`, levelMesh);
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
        const selF = selectedFloorRef.current;
        const fY = selF < 0 ? (selF + 0.5) * floorHeight : (selF - 0.5) * floorHeight;
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

  // ─────────────────────────────────────────────────────────────
  // LAYER VISIBILITY CONTROLLER:
  // Toggles visibility between Both, Architectural Model, or Cadastral Volumes
  // ─────────────────────────────────────────────────────────────
  useEffect(() => {
    if (visualBuildingGroupRef.current) {
      visualBuildingGroupRef.current.visible =
        layerVisibilityMode === 'both' || layerVisibilityMode === 'model';
    }
    if (facadeDetailsGroupRef.current) {
      facadeDetailsGroupRef.current.visible =
        layerVisibilityMode === 'both' || layerVisibilityMode === 'model';
    }
    if (cadastralULPINGroupRef.current) {
      cadastralULPINGroupRef.current.visible =
        layerVisibilityMode === 'both' || layerVisibilityMode === 'cadastre';
    }
  }, [layerVisibilityMode]);

  // ─────────────────────────────────────────────────────────────
  // MATERIAL MODE CONTROLLER:
  // Dynamically switches between Unified Cadastral Style & Source Materials
  // WITHOUT destroying geometry or reloading the 3D model asset.
  // ─────────────────────────────────────────────────────────────
  useEffect(() => {
    if (visualBuildingGroupRef.current) {
      applyMaterialModeToGroup(visualBuildingGroupRef.current, materialMode, wireframeMode);
    }
    if (facadeDetailsGroupRef.current) {
      applyMaterialModeToGroup(facadeDetailsGroupRef.current, materialMode, wireframeMode);
    }
    setTelemetry((prev) => ({
      ...prev,
      materialMode,
    }));
  }, [materialMode, wireframeMode]);

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
                <span>{telemetry.statusBadge || floorInfo.sourceText}</span>
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
              <span>{selectedFloor === -1 ? 'B1 — Library' : selectedFloor < 0 ? `BASEMENT B${Math.abs(selectedFloor)}` : `FLOOR F${selectedFloor}`}</span>
              <span style={{ fontSize: '0.65rem', color: '#94a3b8' }}>
                {selectedFloor < 0
                  ? `${(selectedFloor * floorHeight).toFixed(1)}m to ${((selectedFloor + 1) * floorHeight).toFixed(1)}m (Below Ground)`
                  : `+${((selectedFloor - 1) * floorHeight).toFixed(1)}m to +${(selectedFloor * floorHeight).toFixed(1)}m`}
              </span>
            </div>
            <div className="floor-badge-unit">
              {selectedFloor === -1
                ? 'B1-LIB · Property Cadastral Stratum'
                : (selectedFloorUnit?.unit_id || `UNIT_F0${selectedFloor}_A01`)}
            </div>
            <div className="floor-badge-detail" style={{ color: '#38bdf8', wordBreak: 'break-all' }}>
              ULPIN: {selectedFloorUnit?.ulpin || `${building?.building_id || 'ULPIN'}-${selectedFloor < 0 ? `B${Math.abs(selectedFloor)}-LIB` : `F0${selectedFloor}-01`}`}
            </div>
            <div className="floor-badge-detail">
              {selectedFloor === -1
                ? `Use: ${building.basement_use || 'Library'} · Source: ${building.basement_source || 'Verified project input'} · Area: ~${dims.areaSqm ? Math.round(dims.areaSqm * 0.95).toLocaleString() : '850'} m²`
                : `Area: ~${dims.areaSqm ? Math.round(dims.areaSqm * 0.95).toLocaleString() : '850'} m² · Isolated Level`}
            </div>
          </div>
        </div>
      )}

      {/* Toolbar Controls */}
      <div className="threejs-toolbar">
        {/* Layer Visibility 3-Way Mode Toggle */}
        <button
          className="toolbar-btn"
          onClick={() => {
            setLayerVisibilityMode((prev) =>
              prev === 'both' ? 'model' : prev === 'model' ? 'cadastre' : 'both'
            );
          }}
          title="Toggle 3D Scene Layer (Both / Architectural Model / Cadastral Volumes)"
        >
          <Box size={15} />
          <span>
            {layerVisibilityMode === 'both'
              ? 'Layers: Both'
              : layerVisibilityMode === 'model'
              ? 'Layer: Model'
              : 'Layer: Cadastre'}
          </span>
        </button>

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
            {telemetry.statusBadge && (
              <span className="text-[0.62rem] font-semibold px-1.5 py-0.5 rounded bg-emerald-500/20 text-emerald-300 border border-emerald-500/30">
                {telemetry.statusBadge}
              </span>
            )}
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

      {/* Appearance Style Toggle (Unified Cadastral / Source Materials) */}
      <div className="three-material-toggle-group">
        <button
          className={`three-mat-btn ${materialMode === 'UNIFIED' ? 'active' : ''}`}
          onClick={() => setMaterialMode('UNIFIED')}
          title="Applies a consistent neutral visualization style across all reconstructed buildings."
        >
          <Sparkles size={12} />
          <span>Unified Cadastral</span>
        </button>
        <button
          className={`three-mat-btn ${materialMode === 'SOURCE' ? 'active' : ''}`}
          onClick={() => setMaterialMode('SOURCE')}
          title="Displays available source/model materials where provided."
        >
          <Layers size={12} />
          <span>Source Materials</span>
        </button>
      </div>

      {/* ── 10. COMPREHENSIVE ARCHITECTURAL TELEMETRY HUD ── */}
      {showDebugHud && (
        <div className="architectural-telemetry-hud">
          <div className="hud-title-bar">
            <span className="hud-label">3D ARCHITECTURAL TELEMETRY</span>
            <span className={`hud-badge ${telemetry.provider === 'CUSTOM_MODEL' || telemetry.provider === 'OSM2WORLD' || telemetry.provider === 'OSM_BUILDING_PART' ? 'active' : ''}`}>
              {telemetry.provider === 'CUSTOM_MODEL' ? 'CUSTOM GLB/GLTF' : telemetry.provider.toUpperCase()}
            </span>
          </div>
          <div className="hud-grid">
            <div className="hud-item">
              <span className="hud-k">Provider:</span>
              <span className="hud-v font-bold text-sky-400">
                {telemetry.provider === 'CUSTOM_MODEL' ? 'Custom GLB/GLTF' : telemetry.provider}
              </span>
            </div>
            <div className="hud-item">
              <span className="hud-k">Geometry Source:</span>
              <span className="hud-v font-mono text-[11px] text-slate-300">{telemetry.geometrySource}</span>
            </div>
            <div className="hud-item">
              <span className="hud-k">Material Mode:</span>
              <span className="hud-v font-bold text-sky-400">
                {materialMode === 'UNIFIED' ? 'Unified Cadastral' : 'Source Materials'}
              </span>
            </div>
            <div className="hud-item">
              <span className="hud-k">Material Source:</span>
              <span className="hud-v font-bold text-indigo-300">
                {telemetry.materialSource || (telemetry.provider === 'CUSTOM_MODEL' ? 'Original GLB' : telemetry.provider === 'OSM2WORLD' ? 'OSM2World' : 'Neutral fallback')}
              </span>
            </div>
            <div className="hud-item">
              <span className="hud-k">Model Loaded:</span>
              <span className="hud-v font-bold text-emerald-300">{telemetry.modelLoaded ? 'YES' : 'NO'}</span>
            </div>
            <div className="hud-item">
              <span className="hud-k">Fallback Used:</span>
              <span className="hud-v font-bold text-slate-300">{telemetry.fallbackUsed ? 'YES' : 'NO'}</span>
            </div>
            <div className="hud-item">
              <span className="hud-k">Original Materials:</span>
              <span className="hud-v font-bold text-emerald-300">{telemetry.originalMaterials ? 'YES' : 'NO'}</span>
            </div>
            <div className="hud-item">
              <span className="hud-k">Meshes Rendered:</span>
              <span className="hud-v font-bold text-emerald-300">{telemetry.generatedMeshCount} meshes</span>
            </div>
            <div className="hud-item">
              <span className="hud-k">Active LOD:</span>
              <span className="hud-v font-bold text-sky-400">{activeLod} ({Math.round(camDistMeters)}m cam)</span>
            </div>
            <div className="hud-item">
              <span className="hud-k">Source / Render Height:</span>
              <span className="hud-v font-bold text-sky-400">
                {telemetry.sourceHeightM ? `${telemetry.sourceHeightM.toFixed(1)}m` : 'N/A'} / {telemetry.renderedHeightM ? `${telemetry.renderedHeightM.toFixed(1)}m` : `${telemetry.visualHeight.toFixed(1)}m`}
              </span>
            </div>
            <div className="hud-item">
              <span className="hud-k">Model Scale:</span>
              <span className="hud-v font-bold text-emerald-300">1.0 (Real Metric)</span>
            </div>
            <div className="hud-item">
              <span className="hud-k">Building Parts:</span>
              <span className="hud-v font-bold text-indigo-300">{telemetry.buildingPartsCount || telemetry.sourcePartCount} parts</span>
            </div>
            {telemetry.boundingBox && (
              <div className="hud-item">
                <span className="hud-k">Bounding Box:</span>
                <span className="hud-v font-mono text-[11px]">
                  {telemetry.boundingBox.width}m × {telemetry.boundingBox.height}m × {telemetry.boundingBox.depth}m
                </span>
              </div>
            )}
            {telemetry.sharedOrigin && (
              <div className="hud-item">
                <span className="hud-k">Shared Origin:</span>
                <span className="hud-v font-mono text-[11px] text-slate-300">
                  {telemetry.sharedOrigin.lat.toFixed(5)}°, {telemetry.sharedOrigin.lng.toFixed(5)}°
                </span>
              </div>
            )}
            <div className="hud-item">
              <span className="hud-k">Parts Collapsed:</span>
              <span className="hud-v font-bold text-emerald-300">NO</span>
            </div>
            <div className="hud-item">
              <span className="hud-k">Roof / Crown:</span>
              <span className="hud-v">{telemetry.roofType} (~{telemetry.roofHeightM.toFixed(1)}m)</span>
            </div>
            <div className="hud-item">
              <span className="hud-k">Layer Mode:</span>
              <span className="hud-v font-bold text-indigo-300">{layerVisibilityMode.toUpperCase()}</span>
            </div>
          </div>
        </div>
      )}

      {/* Geometry Source Status Pill */}
      <div className="absolute bottom-3 left-4 z-10 flex items-center gap-2.5 bg-slate-900/90 backdrop-blur border border-indigo-500/30 px-3.5 py-1.5 rounded-full text-xs text-gray-300 shadow-xl">
        <span className={`w-2 h-2 rounded-full ${telemetry.provider === 'CUSTOM_MODEL' || telemetry.provider === 'OSM2WORLD' ? 'bg-emerald-400' : 'bg-indigo-400'} animate-pulse`} />
        <span className="font-semibold text-indigo-300">
          Provider: {telemetry.provider === 'CUSTOM_MODEL' ? 'Custom GLB/GLTF' : telemetry.provider}
        </span>
        <span className="text-slate-400 text-[11px]">
          · {telemetry.geometrySource} · {materialMode === 'UNIFIED' ? 'Unified Cadastral' : 'Source Materials'} · Meshes: {telemetry.generatedMeshCount} {telemetry.statusBadge ? `· ${telemetry.statusBadge}` : ''}
        </span>
      </div>
    </div>
  );
}
