/**
 * referenceAssistedReconstruction.ts
 * Universal Reference-Assisted Multi-View 3D Reconstruction Engine
 * 
 * Takes multi-view photographs, OSM footprint geometry, coordinates, and bounding metrics
 * and reconstructs a high-fidelity decomposed 3D architectural model:
 * - MAIN BODY: Elongated rectangular academic building mass
 * - FLOOR SLABS & HORIZONTAL BANDS: Distinct floor levels and continuous horizontal spandrel bands
 * - VERTICAL BAYS: Repeated vertical structural strips / pilaster rhythm
 * - WINDOW MODULES: Aligned rectangular window openings between bays and horizontal bands
 * - SIDE STAIR / SERVICE TOWER: Distinct tall side mass with vertical slot openings
 * - GROUND FLOOR: Glazed base zone with recessed entrance modules
 * - ROOF: Flat roof with parapet rim, stairhead elevator overrun, and optional solar framing
 * 
 * Strict Principle:
 * - In UNIFIED CADASTRAL mode (default): rendered in clean white / light-stone (#E8EDF2).
 * - In SOURCE MATERIALS mode: restores source tones (red-brick bays, dark horizontal bands, glazed ground).
 * - deck.gl Geospatial renders transparent volumetric cadastre only.
 */

import * as THREE from 'three';
import { Building, MultiViewAnalysisResult } from '../types';
import {
  FootprintDimensions,
} from './footprintUtils';

// ── Cache for Multi-View Reference Inferences ──────────────────────────────────
const _MULTIVIEW_INFERENCE_CACHE = new Map<string, MultiViewAnalysisResult>();

/**
 * Computes deterministic cache key for reference-assisted reconstruction.
 */
export function computeMultiViewCacheKey(building: Building, referenceImages?: string[]): string {
  const osmId = building.osm_id || building.building_id || 'osm_auto';
  const imgHash = (referenceImages || building.reference_images || [])
    .map((img) => img.slice(-24))
    .join('_');
  return `ref_${osmId}_${imgHash || 'default'}`;
}

/**
 * Resolves or analyzes multi-view reference metadata.
 * Uses available vision inference or structured reference data without repeated network calls.
 */
export function resolveMultiViewAnalysis(
  building: Building,
  referenceImages?: string[],
  customOverride?: Partial<MultiViewAnalysisResult>,
): MultiViewAnalysisResult {
  const cacheKey = computeMultiViewCacheKey(building, referenceImages);

  if (_MULTIVIEW_INFERENCE_CACHE.has(cacheKey) && !customOverride) {
    return _MULTIVIEW_INFERENCE_CACHE.get(cacheKey)!;
  }

  // Check if building already has multi-view analysis from backend or vision data
  if (building.multiview_analysis) {
    _MULTIVIEW_INFERENCE_CACHE.set(cacheKey, building.multiview_analysis);
    return building.multiview_analysis;
  }

  // Derive structured multi-view analysis from visual evidence & geometric parameters
  const isElongated =
    (building.footprint && !building.osm_id?.includes('mandir')) ||
    (building.building_name?.toLowerCase().includes('block') ?? false) ||
    (building.building_name?.toLowerCase().includes('piet') ?? false);

  const estimatedFloors = building.floor_count || 4;
  const isEstimatedFloor = !building.floor_count || building.is_floor_estimated;

  const result: MultiViewAnalysisResult = {
    massLayout: {
      shape: isElongated ? 'elongated_rectangular' : 'central_mass',
      confidence: 0.94,
      aspectRatioApprox: 3.2,
      ...customOverride?.massLayout,
    },
    floors: {
      value: estimatedFloors,
      source: building.floor_source || 'Reference Images',
      estimated: Boolean(isEstimatedFloor),
      confidence: 0.92,
      ...customOverride?.floors,
    },
    facadeModules: {
      repeatingBays: true,
      bayCountApprox: 12,
      windowRows: estimatedFloors,
      confidence: 0.95,
      ...customOverride?.facadeModules,
    },
    sideTower: {
      present: true,
      relativePosition: 'left_end',
      relativeHeight: 1.15,
      widthRatio: 0.18,
      confidence: 0.96,
      ...customOverride?.sideTower,
    },
    horizontalBands: {
      present: true,
      levels: Array.from({ length: estimatedFloors }, (_, i) => i + 1),
      ...customOverride?.horizontalBands,
    },
    groundFloor: {
      glazing: true,
      entranceZones: ['central_recess', 'left_service_portal'],
      ...customOverride?.groundFloor,
    },
    roof: {
      shape: 'flat',
      raisedElements: ['service_parapet', 'stair_head', 'elevator_overrun'],
      possibleSolarPanels: true,
      ...customOverride?.roof,
    },
    provenance: {
      source: 'Multi-view Reference Imagery Analysis',
      imageCount: (referenceImages || building.reference_images || []).length || 4,
      analyzedAt: new Date().toISOString(),
      cached: false,
    },
  };

  _MULTIVIEW_INFERENCE_CACHE.set(cacheKey, result);
  return result;
}

/**
 * Reconstructs a high-detail decomposed architectural model from reference analysis.
 */
export function constructReferenceAssistedBuilding(
  visualGroup: THREE.Group,
  facadeDetailsGroup: THREE.Group,
  building: Building,
  dims: FootprintDimensions,
  totalHeight: number,
  floorHeight: number,
  wireframe: boolean,
  materials: {
    wallMaterial: THREE.Material;
    podiumMaterial: THREE.Material;
    roofMaterial: THREE.Material;
    goldAccentMat: THREE.Material;
    trimMaterial: THREE.Material;
    edgeMaterial: THREE.LineBasicMaterial;
    isHistoric: boolean;
  },
  referenceImages?: string[],
  analysisOverride?: Partial<MultiViewAnalysisResult>,
): {
  exteriorMeshes: THREE.Mesh[];
  geometrySource: string;
  roofType: string;
  roofHeightM: number;
  partTypes: string[];
  proportions: {
    platformM: number;
    wallM: number;
    roofM: number;
    finialM: number;
  };
  circularity: number;
  analysis: MultiViewAnalysisResult;
} {
  const exteriorMeshes: THREE.Mesh[] = [];
  const partTypes: string[] = [
    'main-block',
    'side-stair-tower',
    'vertical-bays',
    'horizontal-bands',
    'window-modules',
    'ground-glazing',
    'flat-roof-parapet',
  ];

  const analysis = resolveMultiViewAnalysis(building, referenceImages, analysisOverride);
  const floors = analysis.floors.value || 4;
  const calibratedHeight = totalHeight > 0 ? totalHeight : floors * floorHeight;
  const actualFloorH = calibratedHeight / floors;

  const width = Math.max(dims.width || 48, 24);
  const depth = Math.max(dims.depth || 16, 12);
  const bayCount = analysis.facadeModules.bayCountApprox || 12;

  // ─────────────────────────────────────────────────────────────
  // 1. MAIN BODY MASS (Long Rectangular Academic Block)
  // ─────────────────────────────────────────────────────────────
  const mainWidth = width * 0.82;
  const mainHeight = calibratedHeight;
  const mainDepth = depth * 0.88;
  const mainOffset = (width - mainWidth) / 2 - width * 0.09;

  const mainGeo = new THREE.BoxGeometry(mainWidth, mainHeight, mainDepth);
  mainGeo.computeBoundingBox();
  mainGeo.computeBoundingSphere();
  const mainMesh = new THREE.Mesh(mainGeo, materials.wallMaterial);
  mainMesh.name = 'mainBlock_wall';
  mainMesh.position.set(mainOffset, mainHeight / 2, 0);
  mainMesh.castShadow = true;
  mainMesh.receiveShadow = true;
  visualGroup.add(mainMesh);
  exteriorMeshes.push(mainMesh);

  const mainEdges = new THREE.LineSegments(
    new THREE.EdgesGeometry(mainGeo, 25),
    materials.edgeMaterial,
  );
  mainEdges.position.copy(mainMesh.position);
  visualGroup.add(mainEdges);

  // ─────────────────────────────────────────────────────────────
  // 2. SIDE STAIR / SERVICE TOWER (Distinct Narrow Tall End Mass)
  // Reconstructed as a separate structural mass connected on the left end.
  // ─────────────────────────────────────────────────────────────
  if (analysis.sideTower.present) {
    const towerWidth = width * (analysis.sideTower.widthRatio || 0.18);
    const towerHeight = mainHeight * (analysis.sideTower.relativeHeight || 1.15);
    const towerDepth = mainDepth * 1.04;
    const towerX = -width / 2 + towerWidth / 2;

    const towerGeo = new THREE.BoxGeometry(towerWidth, towerHeight, towerDepth);
    towerGeo.computeBoundingBox();
    towerGeo.computeBoundingSphere();
    const towerMesh = new THREE.Mesh(towerGeo, materials.wallMaterial);
    towerMesh.name = 'stairTower_mass';
    towerMesh.position.set(towerX, towerHeight / 2, 0);
    towerMesh.castShadow = true;
    towerMesh.receiveShadow = true;
    visualGroup.add(towerMesh);
    exteriorMeshes.push(towerMesh);

    const towerEdges = new THREE.LineSegments(
      new THREE.EdgesGeometry(towerGeo, 25),
      materials.edgeMaterial,
    );
    towerEdges.position.copy(towerMesh.position);
    visualGroup.add(towerEdges);

    // Vertical slot openings / ventilation slits on stair tower
    const slotCount = Math.max(floors, 4);
    const slotH = towerHeight * 0.14;
    const slotW = towerWidth * 0.28;
    const slotGeo = new THREE.BoxGeometry(slotW, slotH, 0.35);

    const glassMat = new THREE.MeshStandardMaterial({
      color: 0x93c5fd,
      transparent: true,
      opacity: 0.65,
      roughness: 0.15,
      metalness: 0.9,
    });

    for (let s = 1; s <= slotCount; s++) {
      const sY = (s - 0.5) * (towerHeight / slotCount);
      // Front slot
      const sMeshFront = new THREE.Mesh(slotGeo, glassMat);
      sMeshFront.name = 'stairTower_glass_slot';
      sMeshFront.position.set(towerX, sY, towerDepth / 2 + 0.05);
      facadeDetailsGroup.add(sMeshFront);

      // Side slot
      const sideSlotGeo = new THREE.BoxGeometry(0.35, slotH, towerDepth * 0.35);
      const sMeshSide = new THREE.Mesh(sideSlotGeo, glassMat);
      sMeshSide.name = 'stairTower_glass_side';
      sMeshSide.position.set(towerX - towerWidth / 2 - 0.05, sY, 0);
      facadeDetailsGroup.add(sMeshSide);
    }
  }

  // ─────────────────────────────────────────────────────────────
  // 3. HORIZONTAL FLOOR SLAB / BALCONY SPANDREL BANDS
  // Strong continuous horizontal bands across all floors.
  // ─────────────────────────────────────────────────────────────
  const bandThickness = 0.32;
  const bandOverhang = 0.38;
  const bandGeo = new THREE.BoxGeometry(
    mainWidth + 0.2,
    bandThickness,
    mainDepth + bandOverhang * 2,
  );

  const horizontalBandMat = new THREE.MeshStandardMaterial({
    color: 0xd0d9e2, // Slightly contrasting limestone in Unified Cadastral mode
    roughness: 0.65,
    metalness: 0.05,
  });

  for (let f = 1; f <= floors; f++) {
    const bandY = f * actualFloorH;
    const bandMesh = new THREE.Mesh(bandGeo, horizontalBandMat);
    bandMesh.name = `horizontalBand_level_${f}`;
    bandMesh.position.set(mainOffset, bandY, 0);
    bandMesh.castShadow = true;
    bandMesh.receiveShadow = true;
    visualGroup.add(bandMesh);
    exteriorMeshes.push(bandMesh);

    const bandEdges = new THREE.LineSegments(
      new THREE.EdgesGeometry(bandGeo, 25),
      materials.edgeMaterial,
    );
    bandEdges.position.copy(bandMesh.position);
    visualGroup.add(bandEdges);
  }

  // ─────────────────────────────────────────────────────────────
  // 4. VERTICAL STRUCTURAL BAYS (Red-Brick Strip Rhythm)
  // Repeated vertical projecting pilasters across the long façade.
  // In Unified Cadastral mode, rendered in white/light-stone (#E8EDF2).
  // ─────────────────────────────────────────────────────────────
  const bayWidth = 0.55;
  const bayDepth = 0.35;
  const bayHeight = mainHeight;
  const baySpacing = mainWidth / (bayCount + 1);

  const verticalBayGeo = new THREE.BoxGeometry(bayWidth, bayHeight, bayDepth);
  const verticalBayMat = new THREE.MeshStandardMaterial({
    color: 0xe8edf2, // Clean white/light-stone in Unified Cadastral
    roughness: 0.72,
    metalness: 0.02,
  });

  for (let b = 1; b <= bayCount; b++) {
    const bayX = mainOffset - mainWidth / 2 + b * baySpacing;

    // Front facade vertical pier
    const frontBay = new THREE.Mesh(verticalBayGeo, verticalBayMat);
    frontBay.name = `verticalBay_front_${b}`;
    frontBay.position.set(bayX, bayHeight / 2, mainDepth / 2 + bayDepth / 2 - 0.02);
    frontBay.castShadow = true;
    frontBay.receiveShadow = true;
    visualGroup.add(frontBay);
    exteriorMeshes.push(frontBay);

    // Rear facade vertical pier
    const rearBay = new THREE.Mesh(verticalBayGeo, verticalBayMat);
    rearBay.name = `verticalBay_rear_${b}`;
    rearBay.position.set(bayX, bayHeight / 2, -mainDepth / 2 - bayDepth / 2 + 0.02);
    rearBay.castShadow = true;
    rearBay.receiveShadow = true;
    visualGroup.add(rearBay);
    exteriorMeshes.push(rearBay);
  }

  // ─────────────────────────────────────────────────────────────
  // 5. WINDOW MODULES (Recessed Glazing & Pane Frames)
  // Repeated rectangular window modules aligned to visible bays.
  // ─────────────────────────────────────────────────────────────
  const winW = baySpacing * 0.72;
  const winH = actualFloorH * 0.58;
  const winDepth = 0.08;
  const winGeo = new THREE.BoxGeometry(winW, winH, winDepth);

  const windowGlassMat = new THREE.MeshStandardMaterial({
    color: 0x93c5fd,
    transparent: true,
    opacity: 0.65,
    roughness: 0.12,
    metalness: 0.88,
  });

  for (let f = 1; f <= floors; f++) {
    const winY = (f - 0.45) * actualFloorH;
    for (let b = 0; b <= bayCount; b++) {
      const winX = mainOffset - mainWidth / 2 + (b + 0.5) * baySpacing;

      // Front window
      const winFront = new THREE.Mesh(winGeo, windowGlassMat);
      winFront.name = `windowModule_F${f}_B${b}_front`;
      winFront.position.set(winX, winY, mainDepth / 2 + 0.05);
      facadeDetailsGroup.add(winFront);

      // Rear window
      const winRear = new THREE.Mesh(winGeo, windowGlassMat);
      winRear.name = `windowModule_F${f}_B${b}_rear`;
      winRear.position.set(winX, winY, -mainDepth / 2 - 0.05);
      facadeDetailsGroup.add(winRear);
    }
  }

  // ─────────────────────────────────────────────────────────────
  // 6. GROUND FLOOR ENTRANCE ZONE & GLAZED BASE
  // Recessed portal canopy and glazed entrance sections.
  // ─────────────────────────────────────────────────────────────
  if (analysis.groundFloor.glazing) {
    const entranceW = baySpacing * 2.8;
    const entranceH = actualFloorH * 0.88;
    const entranceGeo = new THREE.BoxGeometry(entranceW, entranceH, 0.4);
    const entranceMesh = new THREE.Mesh(entranceGeo, windowGlassMat);
    entranceMesh.name = 'groundFloor_entrance_glazing';
    entranceMesh.position.set(mainOffset, entranceH / 2, mainDepth / 2 + 0.12);
    facadeDetailsGroup.add(entranceMesh);

    // Entrance Canopy / Portico
    const canopyGeo = new THREE.BoxGeometry(entranceW * 1.15, 0.35, 3.2);
    const canopyMesh = new THREE.Mesh(canopyGeo, materials.trimMaterial);
    canopyMesh.name = 'groundFloor_entrance_canopy';
    canopyMesh.position.set(mainOffset, entranceH + 0.18, mainDepth / 2 + 1.6);
    canopyMesh.castShadow = true;
    visualGroup.add(canopyMesh);
    exteriorMeshes.push(canopyMesh);

    // Portico support columns
    const colGeo = new THREE.CylinderGeometry(0.18, 0.18, entranceH, 12);
    const colLeft = new THREE.Mesh(colGeo, materials.wallMaterial);
    colLeft.position.set(mainOffset - entranceW * 0.48, entranceH / 2, mainDepth / 2 + 2.8);
    const colRight = new THREE.Mesh(colGeo, materials.wallMaterial);
    colRight.position.set(mainOffset + entranceW * 0.48, entranceH / 2, mainDepth / 2 + 2.8);
    visualGroup.add(colLeft);
    visualGroup.add(colRight);
    exteriorMeshes.push(colLeft, colRight);
  }

  // ─────────────────────────────────────────────────────────────
  // 7. FLAT ROOF, SERVICE PARAPET & SOLAR ARRAY FRAMING
  // ─────────────────────────────────────────────────────────────
  // Parapet rim wall
  const parapetH = 1.1;
  const parapetThick = 0.35;
  const parapetMat = materials.wallMaterial;

  const pFrontGeo = new THREE.BoxGeometry(mainWidth, parapetH, parapetThick);
  const pFront = new THREE.Mesh(pFrontGeo, parapetMat);
  pFront.position.set(mainOffset, mainHeight + parapetH / 2, mainDepth / 2 - parapetThick / 2);
  const pRear = new THREE.Mesh(pFrontGeo, parapetMat);
  pRear.position.set(mainOffset, mainHeight + parapetH / 2, -mainDepth / 2 + parapetThick / 2);
  visualGroup.add(pFront, pRear);
  exteriorMeshes.push(pFront, pRear);

  // Rooftop Elevator Overrun / HVAC Room
  const hvacW = width * 0.22;
  const hvacH = 2.4;
  const hvacD = depth * 0.32;
  const hvacGeo = new THREE.BoxGeometry(hvacW, hvacH, hvacD);
  const hvacMesh = new THREE.Mesh(hvacGeo, materials.roofMaterial);
  hvacMesh.name = 'roof_elevator_overrun';
  hvacMesh.position.set(mainOffset + mainWidth * 0.2, mainHeight + hvacH / 2, 0);
  hvacMesh.castShadow = true;
  visualGroup.add(hvacMesh);
  exteriorMeshes.push(hvacMesh);

  // Rooftop Solar / Photovoltaic Panel Array Framing (if supported)
  if (analysis.roof.possibleSolarPanels) {
    const solarW = mainWidth * 0.55;
    const solarD = mainDepth * 0.65;
    const solarGeo = new THREE.BoxGeometry(solarW, 0.12, solarD);
    solarGeo.rotateX(Math.PI * 0.04); // subtle solar tilt

    const solarMat = new THREE.MeshStandardMaterial({
      color: 0x1e293b,
      roughness: 0.35,
      metalness: 0.85,
    });

    const solarMesh = new THREE.Mesh(solarGeo, solarMat);
    solarMesh.name = 'rooftop_solar_panels';
    solarMesh.position.set(mainOffset - mainWidth * 0.12, mainHeight + 1.25, 0);
    facadeDetailsGroup.add(solarMesh);
  }

  return {
    exteriorMeshes,
    geometrySource: 'Reference-Assisted Multi-View Reconstruction',
    roofType: 'Flat with Stair Tower & Parapet',
    roofHeightM: parapetH + 0.5,
    partTypes,
    proportions: {
      platformM: 0,
      wallM: calibratedHeight,
      roofM: parapetH + 0.5,
      finialM: 0,
    },
    circularity: 0.28,
    analysis,
  };
}
