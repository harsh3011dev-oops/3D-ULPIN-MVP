/**
 * curvedPrimitivesBuilder.ts
 * Universal Curved Architectural Primitives Builder for Three.js Studio
 * 
 * Provides procedural, generic parametric builders for curved architectural elements:
 * - DOMES: Real curved geometry (hemisphere, ellipsoid, shallow_dome, onion, cupola)
 * - DRUMS: Cylindrical or polygonal supporting drum bases
 * - FINIALS / SPIRES: Apex decorative pinnacles, kalash, and needle spires
 * - ARCHES: Vertical semicircular façade openings, portals, and window modules
 * 
 * Strict Invariants:
 * - 100% Geometry Validation (finite, positive dimensions; no NaN / Infinity).
 * - Fail-Safe Fallbacks: If an arch/dome calculation fails, falls back gracefully to
 *   safe rectangular framing rather than throwing an exception.
 * - Standardized to Unified Cadastral white (#E8EDF2) by default with support for Source Materials.
 * - Deck.gl Geospatial mode is NEVER touched by decorative primitives.
 * - Floor isolator and building floor counts remain strictly cadastral (not extra floors).
 */

import * as THREE from 'three';
import { DomeElement, ArchElement, ArchitecturalElement, DomeShapeType } from '../types';

export interface CreateDomeParams {
  shape?: DomeShapeType | string;
  radius?: number;
  radiusX?: number;
  radiusZ?: number;
  height: number;
  position?: { x: number; y: number; z: number };
  baseElevation?: number;
  hasDrum?: boolean;
  drumRadius?: number;
  drumHeight?: number;
  drumSides?: number;
  hasFinial?: boolean;
  finialHeight?: number;
  finialStyle?: 'spire' | 'kalash' | 'cross' | 'crescent' | 'pin';
  segments?: number;
  materials: {
    domeMaterial: THREE.Material;
    drumMaterial?: THREE.Material;
    accentMaterial: THREE.Material;
    edgeMaterial?: THREE.Material;
  };
}

export interface CreateArchParams {
  width: number;
  height: number;
  depth?: number;
  springHeight?: number;
  wallThickness?: number;
  isOpening?: boolean;
  orientation?: 'front' | 'rear' | 'left' | 'right' | number;
  position?: { x: number; y: number; z: number };
  materials: {
    frameMaterial: THREE.Material;
    glassMaterial?: THREE.Material;
    edgeMaterial?: THREE.Material;
  };
}

/**
 * Sanitizes numbers to guarantee finite, non-NaN values with safe fallbacks.
 */
export function safeNumber(val: any, fallback: number = 0): number {
  const num = typeof val === 'number' ? val : parseFloat(val);
  return Number.isFinite(num) ? num : fallback;
}

/**
 * Validates whether a number is finite and strictly positive (> 0).
 */
export function isPositiveFinite(val: any, fallback: number = 1.0): number {
  const num = typeof val === 'number' ? val : parseFloat(val);
  return Number.isFinite(num) && num > 0 ? num : fallback;
}

/**
 * Validates whether a coordinate number is finite.
 */
export function isFiniteCoord(val: any, fallback: number = 0.0): number {
  const num = typeof val === 'number' ? val : parseFloat(val);
  return Number.isFinite(num) ? num : fallback;
}

/**
 * Generates an architectural Onion / Bulbous Dome profile spline points.
 * Returns normalized Vector2 profile points for THREE.LatheGeometry.
 */
export function createOnionProfilePoints(
  radius: number,
  height: number,
  baseElevation: number = 0,
  segments: number = 32,
): THREE.Vector2[] {
  const safeRadius = isPositiveFinite(radius, 4.0);
  const safeHeight = isPositiveFinite(height, 5.0);
  const safeBaseY = isFiniteCoord(baseElevation, 0.0);
  const safeSegments = Math.max(isPositiveFinite(segments, 32), 8);

  const pts: THREE.Vector2[] = [];
  const bulbousR = safeRadius * 1.12;

  for (let i = 0; i <= safeSegments; i++) {
    const t = i / safeSegments;
    const y = safeBaseY + t * safeHeight;
    let r: number;

    if (t < 0.20) {
      // Base outward flare from drum ring
      const k = t / 0.20;
      r = safeRadius * 0.96 + (bulbousR - safeRadius * 0.96) * Math.sin(k * (Math.PI / 2));
    } else if (t < 0.65) {
      // Bulbous swelling equator curve
      const k = (t - 0.20) / 0.45;
      r = bulbousR * Math.cos(k * 0.72);
    } else {
      // Ogee inward pointed tip
      const k = (t - 0.65) / 0.35;
      r = bulbousR * Math.cos(0.72) * Math.pow(1 - k, 1.85);
    }

    pts.push(new THREE.Vector2(Math.max(0.02, r), y));
  }

  return pts;
}

/**
 * Creates a generic Dome Mesh with optional Drum Base and Apex Finial.
 * Uses real curved geometry:
 * - 'hemisphere' -> THREE.SphereGeometry (0 to PI/2 theta)
 * - 'ellipsoid' -> Scaled THREE.SphereGeometry with independent X, Y, Z radii
 * - 'shallow_dome' -> Flattened SphereGeometry
 * - 'onion' -> THREE.LatheGeometry with smooth S-curve spline
 * - 'cupola' -> Arched drum pavilion with curved dome cap and spire
 */
export function createDomeMesh(params: CreateDomeParams): THREE.Group {
  const group = new THREE.Group();
  group.name = `dome_primitive_${params.shape || 'hemisphere'}`;

  try {
    const normShape: DomeShapeType = (
      params.shape === 'onion' ||
      params.shape === 'ellipsoid' ||
      params.shape === 'shallow_dome' ||
      params.shape === 'cupola'
        ? params.shape
        : 'hemisphere'
    );

    const baseElevation = isFiniteCoord(params.baseElevation, 0);
    const rx = isPositiveFinite(params.radiusX || params.radius, 5.0);
    const rz = isPositiveFinite(params.radiusZ || params.radius, 5.0);
    const primaryRadius = (rx + rz) / 2;
    const totalHeight = isPositiveFinite(params.height, 3.5);
    const segments = Math.max(isPositiveFinite(params.segments, 36), 12);

    const domeMat = params.materials.domeMaterial;
    const drumMat = params.materials.drumMaterial || domeMat;
    const accentMat = params.materials.accentMaterial;
    const edgeMat = params.materials.edgeMaterial;

    let drumH = 0;
    let drumR = primaryRadius * 0.96;

    // ─────────────────────────────────────────────────────────────
    // 1. DRUM BELOW DOME (Cylindrical or Polygonal Drum)
    // ─────────────────────────────────────────────────────────────
    if (params.hasDrum || (params.drumHeight && params.drumHeight > 0)) {
      drumH = isPositiveFinite(params.drumHeight, Math.min(totalHeight * 0.28, 3.5));
      drumR = isPositiveFinite(params.drumRadius, primaryRadius * 0.96);
      const drumSides = Math.max(isPositiveFinite(params.drumSides, segments), 8);

      const drumGeo = new THREE.CylinderGeometry(drumR, drumR, drumH, drumSides);
      const drumMesh = new THREE.Mesh(drumGeo, drumMat);
      drumMesh.name = 'drum_base_mesh';
      drumMesh.position.y = baseElevation + drumH / 2;
      drumMesh.castShadow = true;
      drumMesh.receiveShadow = true;
      group.add(drumMesh);

      if (edgeMat) {
        const drumEdges = new THREE.LineSegments(new THREE.EdgesGeometry(drumGeo, 30), edgeMat);
        drumEdges.position.copy(drumMesh.position);
        group.add(drumEdges);
      }

      // Cornice Trim Ring atop drum
      const trimGeo = new THREE.CylinderGeometry(drumR * 1.04, drumR * 1.02, Math.max(drumH * 0.12, 0.2), drumSides);
      const trimMesh = new THREE.Mesh(trimGeo, accentMat);
      trimMesh.name = 'drum_cornice_trim';
      trimMesh.position.y = baseElevation + drumH;
      trimMesh.castShadow = true;
      group.add(trimMesh);
    }

    const domeBaseY = baseElevation + drumH;
    const domeActualH = Math.max(totalHeight - drumH, primaryRadius * 0.5, 1.0);

    // ─────────────────────────────────────────────────────────────
    // 2. REAL CURVED DOME GEOMETRY
    // ─────────────────────────────────────────────────────────────
    if (normShape === 'onion') {
      try {
        const profilePts = createOnionProfilePoints(primaryRadius, domeActualH, 0, 28);
        const latheGeo = new THREE.LatheGeometry(profilePts, segments);

        if (Math.abs(rx - rz) > 0.1) {
          latheGeo.scale(rx / primaryRadius, 1, rz / primaryRadius);
        }

        const onionMesh = new THREE.Mesh(latheGeo, domeMat);
        onionMesh.name = 'dome_onion_mesh';
        onionMesh.position.y = domeBaseY;
        onionMesh.castShadow = true;
        onionMesh.receiveShadow = true;
        group.add(onionMesh);

        if (edgeMat) {
          const onionEdges = new THREE.LineSegments(new THREE.EdgesGeometry(latheGeo, 35), edgeMat);
          onionEdges.position.copy(onionMesh.position);
          group.add(onionEdges);
        }
      } catch (err) {
        console.warn('LatheGeometry onion dome fallback to hemisphere:', err);
        const fallbackHemi = new THREE.SphereGeometry(primaryRadius, 24, 16, 0, Math.PI * 2, 0, Math.PI / 2);
        const fallbackMesh = new THREE.Mesh(fallbackHemi, domeMat);
        fallbackMesh.position.y = domeBaseY;
        group.add(fallbackMesh);
      }
    } else if (normShape === 'ellipsoid') {
      const ellipGeo = new THREE.SphereGeometry(1.0, segments, Math.round(segments * 0.6), 0, Math.PI * 2, 0, Math.PI / 2);
      ellipGeo.scale(rx, domeActualH, rz);

      const ellipMesh = new THREE.Mesh(ellipGeo, domeMat);
      ellipMesh.name = 'dome_ellipsoid_mesh';
      ellipMesh.position.y = domeBaseY;
      ellipMesh.castShadow = true;
      ellipMesh.receiveShadow = true;
      group.add(ellipMesh);

      if (edgeMat) {
        const ellipEdges = new THREE.LineSegments(new THREE.EdgesGeometry(ellipGeo, 30), edgeMat);
        ellipEdges.position.copy(ellipMesh.position);
        group.add(ellipEdges);
      }
    } else if (normShape === 'shallow_dome') {
      const shallowGeo = new THREE.SphereGeometry(1.0, segments, Math.round(segments * 0.5), 0, Math.PI * 2, 0, Math.PI / 2);
      const shallowH = Math.min(domeActualH, primaryRadius * 0.45);
      shallowGeo.scale(rx, shallowH, rz);

      const shallowMesh = new THREE.Mesh(shallowGeo, domeMat);
      shallowMesh.name = 'dome_shallow_mesh';
      shallowMesh.position.y = domeBaseY;
      shallowMesh.castShadow = true;
      shallowMesh.receiveShadow = true;
      group.add(shallowMesh);

      if (edgeMat) {
        const shallowEdges = new THREE.LineSegments(new THREE.EdgesGeometry(shallowGeo, 30), edgeMat);
        shallowEdges.position.copy(shallowMesh.position);
        group.add(shallowEdges);
      }
    } else if (normShape === 'cupola') {
      const cupolaDrumH = Math.max(domeActualH * 0.45, 1.2);
      const cupolaDrumGeo = new THREE.CylinderGeometry(primaryRadius * 0.85, primaryRadius * 0.85, cupolaDrumH, 16);
      const cupolaDrumMesh = new THREE.Mesh(cupolaDrumGeo, drumMat);
      cupolaDrumMesh.name = 'cupola_drum_mesh';
      cupolaDrumMesh.position.y = domeBaseY + cupolaDrumH / 2;
      cupolaDrumMesh.castShadow = true;
      group.add(cupolaDrumMesh);

      const cupolaCapH = Math.max(domeActualH - cupolaDrumH, 0.8);
      const cupolaCapGeo = new THREE.SphereGeometry(1.0, 24, 14, 0, Math.PI * 2, 0, Math.PI / 2);
      cupolaCapGeo.scale(rx * 0.9, cupolaCapH, rz * 0.9);

      const cupolaCapMesh = new THREE.Mesh(cupolaCapGeo, domeMat);
      cupolaCapMesh.name = 'cupola_cap_mesh';
      cupolaCapMesh.position.y = domeBaseY + cupolaDrumH;
      cupolaCapMesh.castShadow = true;
      group.add(cupolaCapMesh);
    } else {
      // Default: Classical Hemisphere Dome
      const hemiGeo = new THREE.SphereGeometry(primaryRadius, segments, Math.round(segments * 0.6), 0, Math.PI * 2, 0, Math.PI / 2);
      if (Math.abs(rx - primaryRadius) > 0.05 || Math.abs(rz - primaryRadius) > 0.05 || Math.abs(domeActualH - primaryRadius) > 0.05) {
        hemiGeo.scale(rx / primaryRadius, domeActualH / primaryRadius, rz / primaryRadius);
      }

      const hemiMesh = new THREE.Mesh(hemiGeo, domeMat);
      hemiMesh.name = 'dome_hemisphere_mesh';
      hemiMesh.position.y = domeBaseY;
      hemiMesh.castShadow = true;
      hemiMesh.receiveShadow = true;
      group.add(hemiMesh);

      if (edgeMat) {
        const hemiEdges = new THREE.LineSegments(new THREE.EdgesGeometry(hemiGeo, 30), edgeMat);
        hemiEdges.position.copy(hemiMesh.position);
        group.add(hemiEdges);
      }
    }

    // ─────────────────────────────────────────────────────────────
    // 3. FINIAL / SPIRE (Pinnacle atop dome)
    // ─────────────────────────────────────────────────────────────
    if (params.hasFinial || params.finialHeight) {
      const finialH = isPositiveFinite(params.finialHeight, Math.max(totalHeight * 0.35, primaryRadius * 0.4, 2.0));
      const apexY = domeBaseY + domeActualH;
      const finialGroup = new THREE.Group();
      finialGroup.name = 'dome_apex_finial';

      if (params.finialStyle === 'kalash' || normShape === 'onion') {
        const bead1R = primaryRadius * 0.16;
        const bead1 = new THREE.Mesh(new THREE.SphereGeometry(bead1R, 14, 14), accentMat);
        bead1.name = 'finial_bead_1';
        bead1.position.y = apexY + bead1R;
        finialGroup.add(bead1);

        const bead2R = primaryRadius * 0.10;
        const bead2 = new THREE.Mesh(new THREE.SphereGeometry(bead2R, 12, 12), accentMat);
        bead2.name = 'finial_bead_2';
        bead2.position.y = apexY + bead1R * 2 + bead2R;
        finialGroup.add(bead2);

        const needleH = finialH * 0.75;
        const needle = new THREE.Mesh(new THREE.CylinderGeometry(0.04, primaryRadius * 0.08, needleH, 8), accentMat);
        needle.name = 'finial_needle';
        needle.position.y = apexY + bead1R * 2 + bead2R * 2 + needleH / 2;
        finialGroup.add(needle);
      } else {
        const lanternH = finialH * 0.32;
        const lanternGeo = new THREE.CylinderGeometry(primaryRadius * 0.18, primaryRadius * 0.22, lanternH, 12);
        const lanternMesh = new THREE.Mesh(lanternGeo, accentMat);
        lanternMesh.name = 'finial_lantern_pedestal';
        lanternMesh.position.y = apexY + lanternH / 2;
        finialGroup.add(lanternMesh);

        const coneH = finialH * 0.68;
        const coneGeo = new THREE.ConeGeometry(primaryRadius * 0.16, coneH, 12);
        const coneMesh = new THREE.Mesh(coneGeo, accentMat);
        coneMesh.name = 'finial_spire_cone';
        coneMesh.position.y = apexY + lanternH + coneH / 2;
        finialGroup.add(coneMesh);
      }

      group.add(finialGroup);
    }

    if (params.position) {
      group.position.set(
        isFiniteCoord(params.position.x, 0),
        isFiniteCoord(params.position.y, 0),
        isFiniteCoord(params.position.z, 0),
      );
    }
  } catch (error) {
    console.error('Failed to create dome mesh primitive — using fallback:', error);
  }

  return group;
}

/**
 * Creates an Architectural Semicircular Arch geometry for vertical façade openings/entrances.
 * Distinct from roof domes: this represents a vertical arched portal or window opening.
 * Fully validated to guarantee no NaN, zero radius, or triangulation crashes.
 */
export function createArchMesh(params: CreateArchParams): THREE.Group {
  const group = new THREE.Group();
  group.name = 'arch_primitive';

  const w = isPositiveFinite(params.width, 6.0);
  const h = isPositiveFinite(params.height, 8.0);
  const d = isPositiveFinite(params.depth, 0.45);
  const frameMat = params.materials.frameMaterial;
  const glassMat = params.materials.glassMaterial;
  const edgeMat = params.materials.edgeMaterial;

  try {
    const radius = w / 2;
    // Straight lower section height: total height minus semicircular top radius
    const straightHeight = Math.max(0.1, h - radius);

    // 1. Precise, Continuous Semicircular Arch Contour
    const archShape = new THREE.Shape();
    archShape.moveTo(-w / 2, 0);
    archShape.lineTo(-w / 2, straightHeight);
    // Semicircular top arc from PI (left: -w/2, straightHeight) to 0 (right: +w/2, straightHeight)
    archShape.absarc(0, straightHeight, radius, Math.PI, 0, true);
    archShape.lineTo(w / 2, 0);
    archShape.closePath();

    // 2. Extrude Outer Frame
    const extrudeSettings: THREE.ExtrudeGeometryOptions = {
      depth: d,
      bevelEnabled: false,
    };

    let archGeo: THREE.ExtrudeGeometry;
    try {
      archGeo = new THREE.ExtrudeGeometry(archShape, extrudeSettings);
    } catch (extrudeErr) {
      console.warn('Arch ExtrudeGeometry failed — falling back to BoxGeometry:', extrudeErr);
      const fallbackBox = new THREE.Mesh(new THREE.BoxGeometry(w, h, d), frameMat);
      fallbackBox.position.set(0, h / 2, 0);
      group.add(fallbackBox);
      return group;
    }

    const archMesh = new THREE.Mesh(archGeo, frameMat);
    archMesh.name = 'arch_frame_mesh';
    archMesh.castShadow = true;
    archMesh.receiveShadow = true;
    group.add(archMesh);

    if (edgeMat) {
      try {
        const archEdges = new THREE.LineSegments(new THREE.EdgesGeometry(archGeo, 25), edgeMat);
        group.add(archEdges);
      } catch (e) {
        // ignore edge failure
      }
    }

    // 3. Glazed Inner Opening / Semicircular Window
    if (params.isOpening !== false && glassMat) {
      try {
        const margin = Math.min(0.18, w * 0.08);
        const gw = Math.max(w - margin * 2, 0.4);
        const gr = gw / 2;
        const gStraightHeight = Math.max(0.1, straightHeight - margin);

        const glassShape = new THREE.Shape();
        glassShape.moveTo(-gw / 2, margin);
        glassShape.lineTo(-gw / 2, gStraightHeight);
        glassShape.absarc(0, gStraightHeight, gr, Math.PI, 0, true);
        glassShape.lineTo(gw / 2, margin);
        glassShape.closePath();

        const glassGeo = new THREE.ShapeGeometry(glassShape, 24);
        const glassMesh = new THREE.Mesh(glassGeo, glassMat);
        glassMesh.name = 'arch_glazing_pane';
        glassMesh.position.z = d / 2 + 0.01;
        group.add(glassMesh);

        // Center vertical mullion bar
        const centerMullion = new THREE.Mesh(
          new THREE.BoxGeometry(0.08, h * 0.92, 0.1),
          frameMat
        );
        centerMullion.name = 'arch_center_mullion';
        centerMullion.position.set(0, h * 0.46, d / 2 + 0.02);
        group.add(centerMullion);

        // Horizontal transom bar at springline
        const transom = new THREE.Mesh(
          new THREE.BoxGeometry(gw, 0.08, 0.1),
          frameMat
        );
        transom.name = 'arch_transom_mullion';
        transom.position.set(0, straightHeight, d / 2 + 0.02);
        group.add(transom);
      } catch (glassErr) {
        console.warn('Arch glass creation failed — using safe planar glass:', glassErr);
        const fallbackGlass = new THREE.Mesh(new THREE.BoxGeometry(w * 0.85, h * 0.85, 0.05), glassMat);
        fallbackGlass.position.set(0, h / 2, d / 2 + 0.01);
        group.add(fallbackGlass);
      }
    }

    // Handle orientation / rotation
    if (params.orientation !== undefined) {
      if (typeof params.orientation === 'number') {
        group.rotation.y = params.orientation;
      } else if (params.orientation === 'rear') {
        group.rotation.y = Math.PI;
      } else if (params.orientation === 'left') {
        group.rotation.y = Math.PI / 2;
      } else if (params.orientation === 'right') {
        group.rotation.y = -Math.PI / 2;
      }
    }

    if (params.position) {
      group.position.set(
        isFiniteCoord(params.position.x, 0),
        isFiniteCoord(params.position.y, 0),
        isFiniteCoord(params.position.z, 0),
      );
    }
  } catch (error) {
    console.error('Failed to create arch mesh primitive — using fallback box:', error);
    const safeBox = new THREE.Mesh(new THREE.BoxGeometry(w, h, d), frameMat);
    safeBox.position.set(0, h / 2, 0);
    group.add(safeBox);
  }

  return group;
}

/**
 * Generic Safe Architectural Element Builder.
 * Wraps individual primitive construction (arch, dome, box, slab, tower, cylinder, canopy, window)
 * so that any single geometry failure logs a warning and skips safely without breaking the overall building model.
 */
export function safeCreateArchitecturalElement(
  elem: ArchitecturalElement | any,
  bounds: { width: number; depth: number; height: number },
  materials: {
    wallMaterial: THREE.Material;
    roofMaterial: THREE.Material;
    accentMaterial: THREE.Material;
    glassMaterial?: THREE.Material;
    edgeMaterial?: THREE.Material;
  },
): THREE.Object3D | null {
  if (!elem || typeof elem !== 'object') return null;

  const type = String(elem.type || 'box').toLowerCase();
  const safeW = isPositiveFinite(bounds.width, 20.0);
  const safeD = isPositiveFinite(bounds.depth, 16.0);
  const safeH = isPositiveFinite(bounds.height, 10.0);

  console.log('Building primitive:', {
    type,
    width: elem.width,
    height: elem.height,
    depth: elem.depth,
    radius: elem.radius || elem.radiusX,
    position: elem.position || elem.relativePosition,
  });

  try {
    switch (type) {
      case 'arch': {
        const arch = elem as ArchElement;
        let posX = 0;
        let posY = 0;
        let posZ = safeD / 2 + 0.05;

        if (arch.position && typeof arch.position === 'object') {
          posX = isFiniteCoord(arch.position.x, 0);
          posY = isFiniteCoord(arch.position.y, 0);
          posZ = isFiniteCoord(arch.position.z, safeD / 2 + 0.05);
        } else if (Array.isArray(arch.relativePosition)) {
          posX = (isFiniteCoord(arch.relativePosition[0], 0.5) - 0.5) * safeW;
          posY = isFiniteCoord(arch.relativePosition[1], 0) * safeH;
          posZ = arch.relativePosition.length > 2
            ? (isFiniteCoord(arch.relativePosition[2], 0.5) - 0.5) * safeD
            : safeD / 2 + 0.05;
        }

        const widthVal = isPositiveFinite(
          arch.width || (arch as any).widthRatio ? safeW * (arch as any).widthRatio : undefined,
          safeW * 0.25,
        );
        const heightVal = isPositiveFinite(
          arch.height || (arch as any).heightRatio ? safeH * (arch as any).heightRatio : undefined,
          safeH * 0.85,
        );
        const depthVal = isPositiveFinite(arch.depth, 0.45);

        const archMesh = createArchMesh({
          width: widthVal,
          height: heightVal,
          depth: depthVal,
          springHeight: arch.springHeight,
          orientation: arch.orientation || 'front',
          isOpening: arch.isOpening !== false,
          materials: {
            frameMaterial: materials.wallMaterial,
            glassMaterial: materials.glassMaterial,
            edgeMaterial: materials.edgeMaterial,
          },
        });

        archMesh.position.set(posX, posY, posZ);
        return archMesh;
      }

      case 'dome': {
        const dome = elem as DomeElement;
        let posX = 0;
        let posZ = 0;
        const posY = isFiniteCoord(dome.baseElevation, safeH);

        if (dome.position && typeof dome.position === 'object') {
          posX = isFiniteCoord(dome.position.x, 0);
          posZ = isFiniteCoord(dome.position.z, 0);
        } else if (Array.isArray(dome.relativePosition) && dome.relativePosition.length >= 2) {
          posX = (isFiniteCoord(dome.relativePosition[0], 0.5) - 0.5) * safeW;
          posZ = (isFiniteCoord(dome.relativePosition[1], 0.5) - 0.5) * safeD;
        }

        const domeRadius = isPositiveFinite(
          dome.radius ||
            (dome.radiusX ? (dome.radiusX + (dome.radiusZ || dome.radiusX)) / 2 : undefined) ||
            (safeW * (dome.diameterRatio || 0.25)) / 2,
          safeW * 0.15,
        );
        const domeHeight = isPositiveFinite(
          dome.height || safeH * (dome.heightRatio || 0.18),
          safeH * 0.2,
        );

        const domeGroup = createDomeMesh({
          shape: dome.shape || 'hemisphere',
          radius: domeRadius,
          radiusX: dome.radiusX || domeRadius,
          radiusZ: dome.radiusZ || domeRadius,
          height: domeHeight,
          baseElevation: posY,
          hasDrum: dome.hasDrum,
          drumRadius: dome.drumRadius || domeRadius * 0.95,
          drumHeight: dome.drumHeight || domeHeight * 0.25,
          drumSides: dome.drumSides || 32,
          hasFinial: dome.hasFinial,
          finialHeight: dome.finialHeight || domeHeight * 0.35,
          finialStyle: dome.finialStyle || (dome.shape === 'onion' ? 'kalash' : 'spire'),
          materials: {
            domeMaterial: materials.roofMaterial,
            drumMaterial: materials.wallMaterial,
            accentMaterial: materials.accentMaterial,
            edgeMaterial: materials.edgeMaterial,
          },
        });

        domeGroup.position.x = posX;
        domeGroup.position.z = posZ;
        return domeGroup;
      }

      case 'box':
      case 'slab': {
        const w = isPositiveFinite(elem.width || (elem.widthRatio ? safeW * elem.widthRatio : undefined), safeW * 0.3);
        const h = isPositiveFinite(elem.height || (elem.heightRatio ? safeH * elem.heightRatio : undefined), safeH * 0.2);
        const d = isPositiveFinite(elem.depth || (elem.depthRatio ? safeD * elem.depthRatio : undefined), safeD * 0.3);
        const geo = new THREE.BoxGeometry(w, h, d);
        const mesh = new THREE.Mesh(geo, materials.wallMaterial);
        mesh.name = `${type}_element`;
        mesh.castShadow = true;
        mesh.receiveShadow = true;

        let posX = 0;
        let posY = h / 2;
        let posZ = 0;
        if (elem.position) {
          posX = isFiniteCoord(elem.position.x, 0);
          posY = isFiniteCoord(elem.position.y, h / 2);
          posZ = isFiniteCoord(elem.position.z, 0);
        } else if (Array.isArray(elem.relativePosition)) {
          posX = (isFiniteCoord(elem.relativePosition[0], 0.5) - 0.5) * safeW;
          posY = isFiniteCoord(elem.relativePosition[1], 0) * safeH + h / 2;
          posZ = elem.relativePosition.length > 2 ? (isFiniteCoord(elem.relativePosition[2], 0.5) - 0.5) * safeD : 0;
        }
        mesh.position.set(posX, posY, posZ);
        return mesh;
      }

      case 'cylinder':
      case 'column': {
        const r = isPositiveFinite(elem.radius || elem.radiusX || (elem.diameterRatio ? (safeW * elem.diameterRatio) / 2 : undefined), 0.5);
        const h = isPositiveFinite(elem.height || (elem.heightRatio ? safeH * elem.heightRatio : undefined), safeH * 0.5);
        const sides = Math.max(isPositiveFinite(elem.segments, 16), 8);
        const geo = new THREE.CylinderGeometry(r, r, h, sides);
        const mesh = new THREE.Mesh(geo, materials.wallMaterial);
        mesh.name = `${type}_element`;
        mesh.castShadow = true;
        let posX = 0;
        let posY = h / 2;
        let posZ = 0;
        if (elem.position) {
          posX = isFiniteCoord(elem.position.x, 0);
          posY = isFiniteCoord(elem.position.y, h / 2);
          posZ = isFiniteCoord(elem.position.z, 0);
        }
        mesh.position.set(posX, posY, posZ);
        return mesh;
      }

      case 'tower': {
        const tw = isPositiveFinite(elem.width || (elem.widthRatio ? safeW * elem.widthRatio : undefined), safeW * 0.2);
        const th = isPositiveFinite(elem.height || (elem.heightRatio ? safeH * elem.heightRatio : undefined), safeH * 1.15);
        const td = isPositiveFinite(elem.depth || (elem.depthRatio ? safeD * elem.depthRatio : undefined), safeD * 0.9);
        const geo = new THREE.BoxGeometry(tw, th, td);
        const mesh = new THREE.Mesh(geo, materials.wallMaterial);
        mesh.name = 'tower_element';
        mesh.castShadow = true;
        mesh.receiveShadow = true;
        let posX = -safeW / 2 + tw / 2;
        let posY = th / 2;
        let posZ = 0;
        if (elem.position) {
          posX = isFiniteCoord(elem.position.x, posX);
          posY = isFiniteCoord(elem.position.y, posY);
          posZ = isFiniteCoord(elem.position.z, posZ);
        }
        mesh.position.set(posX, posY, posZ);
        return mesh;
      }

      case 'canopy': {
        const cw = isPositiveFinite(elem.width, safeW * 0.3);
        const ch = isPositiveFinite(elem.height, 0.35);
        const cd = isPositiveFinite(elem.depth, 3.0);
        const geo = new THREE.BoxGeometry(cw, ch, cd);
        const mesh = new THREE.Mesh(geo, materials.accentMaterial || materials.wallMaterial);
        mesh.name = 'canopy_element';
        mesh.castShadow = true;
        let posX = 0;
        let posY = safeH * 0.3;
        let posZ = safeD / 2 + cd / 2;
        if (elem.position) {
          posX = isFiniteCoord(elem.position.x, posX);
          posY = isFiniteCoord(elem.position.y, posY);
          posZ = isFiniteCoord(elem.position.z, posZ);
        }
        mesh.position.set(posX, posY, posZ);
        return mesh;
      }

      case 'window': {
        const ww = isPositiveFinite(elem.width, 1.8);
        const wh = isPositiveFinite(elem.height, 1.4);
        const wd = isPositiveFinite(elem.depth, 0.1);
        const geo = new THREE.BoxGeometry(ww, wh, wd);
        const mesh = new THREE.Mesh(geo, materials.glassMaterial || materials.wallMaterial);
        mesh.name = 'window_element';
        let posX = 0;
        let posY = safeH * 0.5;
        let posZ = safeD / 2 + 0.05;
        if (elem.position) {
          posX = isFiniteCoord(elem.position.x, posX);
          posY = isFiniteCoord(elem.position.y, posY);
          posZ = isFiniteCoord(elem.position.z, posZ);
        }
        mesh.position.set(posX, posY, posZ);
        return mesh;
      }

      default: {
        console.warn(`Unrecognized architectural element type "${type}" — skipped safely.`);
        return null;
      }
    }
  } catch (err) {
    console.warn(`safeCreateArchitecturalElement failed for type ${type}:`, err);
    return null;
  }
}

/**
 * Procedural Multi-Mass Architectural Elements Dispatcher.
 * Builds structured domes, corner cupolas, spires, and façade arches from an element list.
 */
export function createCurvedArchitecturalElements(
  elements: ArchitecturalElement[],
  bounds: { width: number; depth: number; height: number },
  materials: {
    wallMaterial: THREE.Material;
    roofMaterial: THREE.Material;
    accentMaterial: THREE.Material;
    glassMaterial?: THREE.Material;
    edgeMaterial?: THREE.Material;
  },
): THREE.Group {
  const container = new THREE.Group();
  container.name = 'curved_architectural_elements_container';

  if (!Array.isArray(elements) || elements.length === 0) {
    return container;
  }

  elements.forEach((elem, idx) => {
    try {
      const featureMesh = safeCreateArchitecturalElement(elem, bounds, materials);
      if (featureMesh) {
        container.add(featureMesh);
      }
    } catch (elemErr) {
      console.warn(`Failed to build architectural element at index ${idx}:`, elemErr);
    }
  });

  return container;
}

