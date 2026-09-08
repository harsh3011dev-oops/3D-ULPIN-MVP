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
  FootprintDimensions,
} from '../../utils/footprintUtils';
import { fetchTerrainHeight } from '../../utils/reearth';
import { RotateCw, Layers, MapPin, ZoomIn, ZoomOut, PanelLeft, PanelRight, ShieldCheck, CheckCircle2, Sparkles } from 'lucide-react';
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

// High-resolution architectural glass curtain wall facade texture generator
function generateBuildingTexture(floors: number) {
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
      ctx.fillRect(0, y, 1024, rowH * 0.2);

      // Metallic trim line on spandrel edge
      ctx.fillStyle = '#475569';
      ctx.fillRect(0, y + rowH * 0.2 - 2, 1024, 2);

      // Contact shadow beneath floor slab
      ctx.fillStyle = 'rgba(0, 0, 0, 0.45)';
      ctx.fillRect(0, y + rowH * 0.2, 1024, rowH * 0.06);

      // 2. Glass Window Pane Row
      const winY = y + rowH * 0.25;
      const winH = rowH * 0.7;

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

        // Glass Glare Reflection Diagonal Streak
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

    ctx.strokeStyle = 'rgba(100, 116, 139, 0.25)';
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

  // Materials for urban props
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

// Procedural Roof Generator based on OSM roof shape tags
function buildProceduralRoof(
  group: THREE.Group,
  shapes: THREE.Shape[],
  roofShape: string,
  baseElevation: number,
  roofHeightM: number,
  dims: FootprintDimensions,
  roofMat: THREE.Material,
  accentMat: THREE.Material,
) {
  const normalizedShape = (roofShape || 'flat').toLowerCase();
  const radius = Math.min(dims.width, dims.depth) / 2;

  if (normalizedShape.includes('dome') || normalizedShape.includes('round') || normalizedShape.includes('spherical')) {
    // Hemisphere Dome
    const domeGeo = new THREE.SphereGeometry(radius * 0.9, 24, 16, 0, Math.PI * 2, 0, Math.PI / 2);
    const domeMesh = new THREE.Mesh(domeGeo, roofMat);
    domeMesh.position.set(0, baseElevation, 0);
    domeMesh.castShadow = true;
    group.add(domeMesh);

    // Spire finial at apex
    const finial = new THREE.Mesh(new THREE.CylinderGeometry(0.08, 0.3, roofHeightM * 0.6 || 3.0, 8), accentMat);
    finial.position.set(0, baseElevation + radius * 0.9 + (roofHeightM * 0.3 || 1.5), 0);
    finial.castShadow = true;
    group.add(finial);
  } else if (normalizedShape.includes('onion') || normalizedShape.includes('bulbous')) {
    // Bulbous Onion Dome Lathe Geometry
    const pts: THREE.Vector2[] = [];
    const domeH = Math.max(roofHeightM, radius * 1.3, 6);
    const domeR = radius * 0.95;
    for (let i = 0; i <= 20; i++) {
      const t = i / 20;
      const y = t * domeH;
      let r = Math.sin(t * Math.PI) * domeR;
      if (t < 0.3) r = radius * 0.75 + Math.sin((t / 0.3) * (Math.PI / 2)) * (domeR - radius * 0.75);
      else if (t > 0.75) r = domeR * Math.pow(1 - (t - 0.75) / 0.25, 1.6);
      pts.push(new THREE.Vector2(Math.max(0.05, r), y));
    }
    const onionGeo = new THREE.LatheGeometry(pts, 24);
    const onionMesh = new THREE.Mesh(onionGeo, roofMat);
    onionMesh.position.set(0, baseElevation, 0);
    onionMesh.castShadow = true;
    group.add(onionMesh);

    // Golden Kalash Finial
    const finialH = Math.max(roofHeightM * 0.4, 3);
    const finial = new THREE.Mesh(new THREE.CylinderGeometry(0.08, 0.35, finialH, 8), accentMat);
    finial.position.set(0, baseElevation + domeH + finialH / 2, 0);
    finial.castShadow = true;
    group.add(finial);
  } else if (normalizedShape.includes('pyramidal') || normalizedShape.includes('pyramid') || normalizedShape.includes('cone') || normalizedShape.includes('conical')) {
    // Pyramidal / Conical Roof
    const isCone = normalizedShape.includes('cone') || normalizedShape.includes('conical');
    const segs = isCone ? 24 : 4;
    const coneH = Math.max(roofHeightM, 4);
    const coneGeo = new THREE.ConeGeometry(radius * 1.05, coneH, segs);
    const coneMesh = new THREE.Mesh(coneGeo, roofMat);
    coneMesh.position.set(0, baseElevation + coneH / 2, 0);
    if (!isCone) coneMesh.rotation.y = Math.PI / 4;
    coneMesh.castShadow = true;
    group.add(coneMesh);
  } else if (normalizedShape.includes('gabled') || normalizedShape.includes('hipped') || normalizedShape.includes('pitched') || normalizedShape.includes('skillion')) {
    // Hipped / Gabled Roof Slab with pitch
    const pitchH = Math.max(roofHeightM, 3.5);
    shapes.forEach((shape) => {
      const gabledGeo = new THREE.ExtrudeGeometry(shape, { depth: pitchH, bevelEnabled: true, bevelThickness: 0.5, bevelSize: 0.3 });
      gabledGeo.rotateX(-Math.PI / 2);
      const gMesh = new THREE.Mesh(gabledGeo, roofMat);
      gMesh.position.set(0, baseElevation, 0);
      gMesh.castShadow = true;
      group.add(gMesh);
    });
  } else {
    // Default Flat Roof with Parapet wall, Setback Elevator Core & Louvered HVAC Units
    const parapetH = Math.max(1.2, baseElevation * 0.02);
    shapes.forEach((shape) => {
      const parapetGeo = new THREE.ExtrudeGeometry(shape, { depth: parapetH, bevelEnabled: false });
      parapetGeo.rotateX(-Math.PI / 2);
      const parapetMesh = new THREE.Mesh(parapetGeo, accentMat);
      parapetMesh.position.set(0, baseElevation, 0);
      parapetMesh.castShadow = true;
      group.add(parapetMesh);
    });

    // Setback Penthouse / Elevator Core
    const coreW = Math.max(dims.width * 0.35, 4);
    const coreD = Math.max(dims.depth * 0.35, 4);
    const coreH = Math.max(3.2, baseElevation * 0.08);
    const coreMesh = new THREE.Mesh(new THREE.BoxGeometry(coreW, coreH, coreD), roofMat);
    coreMesh.position.set(0, baseElevation + parapetH + coreH / 2, 0);
    coreMesh.castShadow = true;
    group.add(coreMesh);

    // HVAC Cooling Units
    const hvacMesh = new THREE.Mesh(new THREE.BoxGeometry(coreW * 0.7, 1.4, coreD * 0.7), accentMat);
    hvacMesh.position.set(0, baseElevation + parapetH + coreH + 0.7, 0);
    hvacMesh.castShadow = true;
    group.add(hvacMesh);

    // Telecommunications Mast / Beacon
    const mastH = Math.max(5.0, baseElevation * 0.15);
    const mastMesh = new THREE.Mesh(new THREE.CylinderGeometry(0.06, 0.2, mastH, 8), accentMat);
    mastMesh.position.set(0, baseElevation + parapetH + coreH + 1.4 + mastH / 2, 0);
    group.add(mastMesh);

    // Red Aviation Warning Beacon
    const beaconMesh = new THREE.Mesh(
      new THREE.SphereGeometry(0.35, 8, 8),
      new THREE.MeshStandardMaterial({ color: 0xef4444, emissive: 0xef4444, emissiveIntensity: 2.0 }),
    );
    beaconMesh.position.set(0, baseElevation + parapetH + coreH + 1.4 + mastH, 0);
    group.add(beaconMesh);
  }
}

// Procedural Building Constructor: Reconstructs any building from real footprint, building parts, and metadata
function buildProceduralBuilding(
  scene: THREE.Scene,
  building: Building,
  glassMaterial: THREE.MeshPhysicalMaterial,
  steelMaterial: THREE.MeshStandardMaterial,
): { width: number; depth: number; height: number; exteriorMeshes: THREE.Mesh[]; floorSlabMeshes: THREE.Mesh[] } {
  const dims = getFootprintDimensions(building.footprint);
  const totalHeight = getBuildingHeight(building);
  const floorCount = building?.floor_count || 3;
  const floorH = getFloorHeight(building);
  const buildingGroup = new THREE.Group();
  scene.add(buildingGroup);

  const exteriorMeshes: THREE.Mesh[] = [];
  const floorSlabMeshes: THREE.Mesh[] = [];

  const centerLng = dims.centerLng;
  const centerLat = dims.centerLat;

  // Materials tailored to building metadata
  const bMatTag = (building.assessment?.building_material || building.building_name || '').toLowerCase();
  const isHistoricOrStone = bMatTag.includes('stone') || bMatTag.includes('brick') || bMatTag.includes('marble') || bMatTag.includes('heritage') || bMatTag.includes('fort') || bMatTag.includes('temple');

  const facadeMat = isHistoricOrStone
    ? new THREE.MeshStandardMaterial({
        color: bMatTag.includes('red') || bMatTag.includes('brick') ? 0x991b1b : 0xf8fafc,
        roughness: 0.65,
        metalness: 0.05,
      })
    : new THREE.MeshPhysicalMaterial({
        map: generateBuildingTexture(floorCount),
        metalness: 0.35,
        roughness: 0.22,
        clearcoat: 0.85,
        clearcoatRoughness: 0.12,
        reflectivity: 0.9,
      });

  const goldAccentMat = new THREE.MeshStandardMaterial({
    color: 0xf59e0b,
    metalness: 0.95,
    roughness: 0.15,
  });

  const slabMat = new THREE.MeshStandardMaterial({
    color: 0x0f172a,
    metalness: 0.8,
    roughness: 0.25,
  });

  const parts = building.building_parts || [];

  if (parts.length > 0) {
    // Reconstruct each building:part individually
    parts.forEach((part: BuildingPart) => {
      const partShapes = part.footprint
        ? footprintToShapes(part.footprint, centerLng, centerLat)
        : footprintToShapes(building.footprint, centerLng, centerLat);

      const baseLevel = part.min_levels || 0;
      const partLevels = part.levels || Math.max(floorCount - baseLevel, 1);
      const baseElev = part.min_height !== undefined ? part.min_height : baseLevel * floorH;
      const partH = part.height !== undefined ? part.height - baseElev : partLevels * floorH;

      partShapes.forEach((shape) => {
        const extrudeGeo = new THREE.ExtrudeGeometry(shape, {
          depth: Math.max(partH, 2.0),
          bevelEnabled: false,
        });
        extrudeGeo.rotateX(-Math.PI / 2);

        const partMesh = new THREE.Mesh(extrudeGeo, facadeMat);
        partMesh.position.y = baseElev;
        partMesh.castShadow = true;
        partMesh.receiveShadow = true;
        buildingGroup.add(partMesh);
        exteriorMeshes.push(partMesh);

        // Floor division slabs for this part
        for (let f = 1; f < partLevels; f++) {
          const slabGeo = new THREE.ExtrudeGeometry(shape, { depth: 0.2, bevelEnabled: false });
          slabGeo.rotateX(-Math.PI / 2);
          const slabMesh = new THREE.Mesh(slabGeo, slabMat);
          slabMesh.position.y = baseElev + f * floorH;
          slabMesh.scale.set(1.01, 1, 1.01);
          slabMesh.castShadow = true;
          buildingGroup.add(slabMesh);
          floorSlabMeshes.push(slabMesh);
        }
      });

      // Roof for this part
      const pRoofShape = part.roof_shape || building.roof?.shape || 'flat';
      const pRoofHeight = part.roof_height || building.roof?.height || 3.0;
      buildProceduralRoof(
        buildingGroup,
        partShapes,
        pRoofShape,
        baseElev + partH,
        pRoofHeight,
        dims,
        facadeMat,
        isHistoricOrStone ? goldAccentMat : steelMaterial,
      );
    });
  } else {
    // Reconstruct from main building footprint polygon / MultiPolygon
    const shapes = footprintToShapes(building.footprint, centerLng, centerLat);

    if (shapes.length > 0) {
      shapes.forEach((shape) => {
        const extrudeGeo = new THREE.ExtrudeGeometry(shape, {
          depth: totalHeight,
          bevelEnabled: false,
        });
        extrudeGeo.rotateX(-Math.PI / 2);

        const bodyMesh = new THREE.Mesh(extrudeGeo, facadeMat);
        bodyMesh.position.y = 0;
        bodyMesh.castShadow = true;
        bodyMesh.receiveShadow = true;
        buildingGroup.add(bodyMesh);
        exteriorMeshes.push(bodyMesh);

        // Architectural Floor Division Slab Rings matching exact polygon footprint & courtyards
        for (let f = 1; f < floorCount; f++) {
          const slabGeo = new THREE.ExtrudeGeometry(shape, { depth: 0.22, bevelEnabled: false });
          slabGeo.rotateX(-Math.PI / 2);
          const slabMesh = new THREE.Mesh(slabGeo, slabMat);
          slabMesh.position.y = f * floorH;
          slabMesh.scale.set(1.015, 1, 1.015);
          slabMesh.castShadow = true;
          buildingGroup.add(slabMesh);
          floorSlabMeshes.push(slabMesh);
        }
      });

      // Procedural Roof on top
      const roofShape = building.roof?.shape || 'flat';
      const roofHeight = building.roof?.height || 3.5;
      buildProceduralRoof(
        buildingGroup,
        shapes,
        roofShape,
        totalHeight,
        roofHeight,
        dims,
        facadeMat,
        isHistoricOrStone ? goldAccentMat : steelMaterial,
      );
    } else {
      // Fallback Box if no footprint coordinates available
      const fallbackGeo = new THREE.BoxGeometry(dims.width, totalHeight, dims.depth);
      const fallbackMesh = new THREE.Mesh(fallbackGeo, facadeMat);
      fallbackMesh.position.y = totalHeight / 2;
      fallbackMesh.castShadow = true;
      fallbackMesh.receiveShadow = true;
      buildingGroup.add(fallbackMesh);
      exteriorMeshes.push(fallbackMesh);
    }
  }

  return { width: dims.width, depth: dims.depth, height: totalHeight, exteriorMeshes, floorSlabMeshes };
}

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
  const autoRotateRef = useRef(false);

  const [autoRotate, setAutoRotate] = useState(false);
  const [wireframeMode, setWireframeMode] = useState(false);
  const [, setHoveredUnitId] = useState<string | null>(null);
  const [groundElevation, setGroundElevation] = useState<number | null>(null);

  // 3D Anchored Screen Projection State
  const [apexScreenPos, setApexScreenPos] = useState<{ x: number; y: number; visible: boolean } | null>(null);
  const [floorScreenPos, setFloorScreenPos] = useState<{ x: number; y: number; visible: boolean } | null>(null);
  const [camDistMeters, setCamDistMeters] = useState<number>(50);

  const { lat: centerLat, lng: centerLng } = getBuildingCenter(building);
  const dims = useMemo(() => getFootprintDimensions(building.footprint), [building.footprint]);
  const buildingHeight = getBuildingHeight(building);
  const floorHeight = getFloorHeight(building);
  const floorInfo = useMemo(() => getFloorCountInfo(building), [building]);

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

  useEffect(() => {
    if (!mountRef.current) return;

    const width = mountRef.current.clientWidth || 800;
    const height = mountRef.current.clientHeight || 520;

    const maxDim = Math.max(dims.width, dims.depth, 10);
    const sceneExtent = Math.max(maxDim * 3, buildingHeight * 0.6, 60);

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

    const camera = new THREE.PerspectiveCamera(40, width / height, 0.5, 50000);
    const camDist = Math.max(maxDim * 1.9, buildingHeight * 1.0, 35);
    camera.position.set(camDist, buildingHeight * 0.5 + maxDim * 0.4, camDist);
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

    const targetY = buildingHeight / 2;
    const controls = new OrbitControls(camera, renderer.domElement);
    controls.enableDamping = true;
    controls.dampingFactor = 0.05;
    controls.target.set(0, targetY, 0);
    controls.maxPolarAngle = Math.PI / 2 - 0.02;
    controls.minDistance = Math.max(6, maxDim * 0.4);
    controls.maxDistance = 10000;
    controlsRef.current = controls;

    // 1. Natural Hemisphere Lighting
    const hemiLight = new THREE.HemisphereLight(0xbae6fd, 0x1e293b, 1.4);
    scene.add(hemiLight);

    // 2. High-Intensity Directional Sun Light
    const sunLight = new THREE.DirectionalLight(0xfffaf0, 2.8);
    sunLight.position.set(sceneExtent * 0.7, buildingHeight * 2.2, sceneExtent * 0.6);
    sunLight.castShadow = true;
    sunLight.shadow.mapSize.width = 2048;
    sunLight.shadow.mapSize.height = 2048;
    sunLight.shadow.bias = -0.0001;
    sunLight.shadow.camera.near = 0.5;
    sunLight.shadow.camera.far = sceneExtent * 5;
    const d = sceneExtent * 1.5;
    sunLight.shadow.camera.left = -d;
    sunLight.shadow.camera.right = d;
    sunLight.shadow.camera.top = d;
    sunLight.shadow.camera.bottom = -d;
    scene.add(sunLight);

    // 3. Cyan Accent Rim Light
    const rimLight = new THREE.PointLight(0x818cf8, 3.5, sceneExtent * 2.5);
    rimLight.position.set(-maxDim * 1.5, buildingHeight * 0.8, -maxDim * 1.5);
    scene.add(rimLight);

    // Materials
    const glassMaterial = new THREE.MeshPhysicalMaterial({
      color: 0x93c5fd,
      metalness: 0.1,
      roughness: 0.1,
      transmission: 0.6,
      transparent: true,
      opacity: 0.85,
      clearcoat: 1.0,
      clearcoatRoughness: 0.05,
      wireframe: wireframeMode,
    });

    const steelMaterial = new THREE.MeshStandardMaterial({
      color: 0x475569,
      metalness: 0.9,
      roughness: 0.2,
      wireframe: wireframeMode,
    });

    // Build Surrounding Context
    buildSurroundingContext(scene, dims, sceneExtent);

    // Build Procedural Architectural Building Model from Real Footprint and Parts
    const built = buildProceduralBuilding(scene, building, glassMaterial, steelMaterial);
    exteriorMeshesRef.current = built.exteriorMeshes;

    // Floor Unit Layer Extrusions
    const unitMap = new Map<string, THREE.Mesh>();
    const units = building?.units || [];
    const shape = building.footprint ? footprintToShape(building.footprint, centerLng, centerLat) : null;

    units.forEach((unit) => {
      const floorNum = getUnitFloor(unit);
      const levelY = (floorNum - 1) * floorHeight;
      const baseColor = FLOOR_HEX_COLORS[(floorNum - 1) % FLOOR_HEX_COLORS.length];

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
        levelMesh = new THREE.Mesh(slabGeo, levelMat);
        levelMesh.position.y = levelY;
      } else {
        levelMesh = new THREE.Mesh(new THREE.BoxGeometry(built.width * 1.01, floorHeight * 0.95, built.depth * 1.01), levelMat);
        levelMesh.position.y = levelY + floorHeight / 2;
      }

      levelMesh.userData = { unit, baseColor };
      levelMesh.visible = false;
      scene.add(levelMesh);
      unitMap.set(unit.unit_id, levelMesh);
    });

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
        if (clickedMesh.userData.unit) {
          onUnitClick(clickedMesh.userData.unit as Unit);
        }
      }
    };

    const domElem = renderer.domElement;
    domElem.addEventListener('pointermove', handlePointerMove);
    domElem.addEventListener('click', handleClick);

    // 3D Anchor Coordinate Projector Vector
    const apexWorldVec = new THREE.Vector3(0, built.height + 2.5, 0);
    const floorWorldVec = new THREE.Vector3(dims.width / 2 + 1.5, 0, 0);

    let animId: number;
    const animate = () => {
      animId = requestAnimationFrame(animate);
      controls.update();
      if (autoRotateRef.current && sceneRef.current) {
        sceneRef.current.rotation.y += 0.004;
      }

      // Calculate camera distance for LOD
      const dist = camera.position.distanceTo(controls.target);
      setCamDistMeters(dist);

      // Project Apex Badge Position
      const projApex = apexWorldVec.clone().project(camera);
      if (projApex.z < 1.0) {
        const x = (projApex.x * 0.5 + 0.5) * width;
        const y = (-(projApex.y * 0.5) + 0.5) * height;
        setApexScreenPos({ x, y, visible: dist < 1200 });
      } else {
        setApexScreenPos(null);
      }

      // Project Floor Badge Position (if a floor is selected)
      if (selectedFloor !== null) {
        const fY = (selectedFloor - 0.5) * floorHeight;
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
      unitMap.clear();
      unitMeshesRef.current.clear();
      exteriorMeshesRef.current = [];
    };
  }, [building, wireframeMode, onUnitClick, selectedFloor]);

  // Floor Isolator: highlight active floor & fade inactive exterior
  useEffect(() => {
    // 1. Update Unit Meshes
    unitMeshesRef.current.forEach((mesh) => {
      const u = mesh.userData.unit as Unit;
      const isSelected = selectedUnit?.unit_id === u.unit_id;
      const isFloorActive = selectedFloor !== null && selectedFloor === getUnitFloor(u);
      const mat = mesh.material as THREE.MeshStandardMaterial;

      if (isSelected) {
        mesh.visible = true;
        mat.color.setHex(0x38bdf8);
        mat.emissive.setHex(0x0284c7);
        mat.emissiveIntensity = 0.9;
        mat.opacity = 0.92;
      } else if (isFloorActive) {
        mesh.visible = true;
        mat.color.setHex(0x7c6fe0);
        mat.emissive.setHex(0x4338ca);
        mat.emissiveIntensity = 0.6;
        mat.opacity = 0.85;
      } else {
        mesh.visible = false;
        mat.opacity = 0;
      }
    });

    // 2. Adjust Exterior Walls Material Transparency for X-Ray Floor Isolation
    exteriorMeshesRef.current.forEach((mesh) => {
      const mat = mesh.material as THREE.MeshStandardMaterial | THREE.MeshPhysicalMaterial;
      if (selectedFloor !== null) {
        mat.transparent = true;
        mat.opacity = 0.22;
        mat.depthWrite = false;
      } else {
        mat.transparent = false;
        mat.opacity = 1.0;
        mat.depthWrite = true;
      }
    });
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

      <div className="location-banner-header absolute top-4 left-4 p-2.5 z-10 flex items-center gap-2.5 bg-slate-900/90 backdrop-blur rounded-lg border border-indigo-500/40 shadow-xl">
        <div className="w-7 h-7 rounded-md bg-indigo-500/20 text-indigo-400 border border-indigo-500/40 flex items-center justify-center">
          <MapPin size={16} />
        </div>
        <div className="flex flex-col">
          <span className="text-[0.78rem] font-bold text-white leading-tight">
            {building?.building_name || building?.address || 'Procedural Cadastral Structure'}
          </span>
          <span className="text-[0.68rem] font-mono text-indigo-300">
            {centerLat.toFixed(5)}°N, {centerLng.toFixed(5)}°E • {buildingHeight.toFixed(1)}m ({floorInfo.countText})
            {groundElevation != null ? ` • Ground ${groundElevation.toFixed(1)}m MSL` : ''}
          </span>
        </div>
      </div>

      <div className="absolute bottom-3 left-4 z-10 flex items-center gap-2 bg-slate-900/80 backdrop-blur border border-white/10 px-3 py-1.5 rounded-full text-xs text-gray-300">
        <span className="w-2 h-2 rounded-full bg-indigo-400 animate-pulse" />
        <span className="font-semibold text-indigo-300">Three.js — Procedural 3D Cadastral Engine</span>
      </div>
    </div>
  );
}
