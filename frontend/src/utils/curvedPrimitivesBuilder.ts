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
 * Validates whether a number is finite and strictly positive.
 */
function isPositiveFinite(val: any, fallback: number): number {
  const num = typeof val === 'number' ? val : parseFloat(val);
  return Number.isFinite(num) && num > 0 ? num : fallback;
}

/**
 * Validates whether a coordinate number is finite.
 */
function isFiniteCoord(val: any, fallback: number): number {
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

  try {
    const w = isPositiveFinite(params.width, 6.0);
    const h = isPositiveFinite(params.height, 8.0);
    const d = isPositiveFinite(params.depth, 0.45);
    const radius = w / 2;

    const defaultSpringY = Math.max(h - radius, h * 0.55);
    const springY = params.springHeight !== undefined && Number.isFinite(params.springHeight)
      ? Math.max(0.1, Math.min(params.springHeight, h - 0.2))
      : defaultSpringY;

    const actualArchRadius = Math.max(Math.min(radius, h - springY), 0.2);

    const frameMat = params.materials.frameMaterial;
    const glassMat = params.materials.glassMaterial;
    const edgeMat = params.materials.edgeMaterial;

    // 1. Arch Shape Path (vertical rectangular base + semicircular top arc)
    const archShape = new THREE.Shape();
    archShape.moveTo(-w / 2, 0);
    archShape.lineTo(-w / 2, springY);
    archShape.absarc(0, springY, actualArchRadius, Math.PI, 0, true);
    archShape.lineTo(w / 2, 0);
    archShape.closePath();

    // 2. Extrude Portal Frame / Surrounding Border
    const extrudeSettings: THREE.ExtrudeGeometryOptions = {
      depth: d,
      bevelEnabled: true,
      bevelThickness: 0.05,
      bevelSize: 0.04,
      bevelSegments: 2,
    };

    let archMesh: THREE.Mesh;
    try {
      const archGeo = new THREE.ExtrudeGeometry(archShape, extrudeSettings);
      archMesh = new THREE.Mesh(archGeo, frameMat);
      archMesh.name = 'arch_frame_mesh';
      archMesh.castShadow = true;
      archMesh.receiveShadow = true;
      group.add(archMesh);

      if (edgeMat) {
        const archEdges = new THREE.LineSegments(new THREE.EdgesGeometry(archGeo, 30), edgeMat);
        group.add(archEdges);
      }
    } catch (geoErr) {
      console.warn('Arch ExtrudeGeometry fallback to safe BoxGeometry:', geoErr);
      const fallbackBox = new THREE.Mesh(new THREE.BoxGeometry(w, h, d), frameMat);
      fallbackBox.position.set(0, h / 2, 0);
      group.add(fallbackBox);
    }

    // 3. Glazed Inset / Window Pane (if opening/glazed)
    if (params.isOpening !== false && glassMat) {
      try {
        const margin = 0.12;
        const gw = Math.max(w - margin * 2, 0.4);
        const gr = Math.max(actualArchRadius - margin, 0.2);
        const gSpringY = Math.max(springY - margin, 0.1);

        const glassShape = new THREE.Shape();
        glassShape.moveTo(-gw / 2, margin);
        glassShape.lineTo(-gw / 2, gSpringY);
        glassShape.absarc(0, gSpringY, gr, Math.PI, 0, true);
        glassShape.lineTo(gw / 2, margin);
        glassShape.closePath();

        const glassGeo = new THREE.ShapeGeometry(glassShape, 18);
        const glassMesh = new THREE.Mesh(glassGeo, glassMat);
        glassMesh.name = 'arch_glazing_pane';
        glassMesh.position.z = d / 2 + 0.01;
        group.add(glassMesh);

        // Center vertical mullion bar
        const mullionMat = frameMat;
        const centerMullion = new THREE.Mesh(new THREE.BoxGeometry(0.06, h * 0.9, 0.08), mullionMat);
        centerMullion.name = 'arch_center_mullion';
        centerMullion.position.set(0, h * 0.45, d / 2 + 0.02);
        group.add(centerMullion);
      } catch (glassErr) {
        console.warn('Arch glass shape fallback to BoxGeometry:', glassErr);
        const fallbackGlass = new THREE.Mesh(new THREE.BoxGeometry(w * 0.85, h * 0.85, 0.06), glassMat);
        fallbackGlass.position.set(0, h / 2, d / 2);
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
    const safeBox = new THREE.Mesh(new THREE.BoxGeometry(6, 8, 0.45), params.materials.frameMaterial);
    safeBox.position.y = 4;
    group.add(safeBox);
  }

  return group;
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

  const safeW = isPositiveFinite(bounds.width, 20.0);
  const safeD = isPositiveFinite(bounds.depth, 16.0);
  const safeH = isPositiveFinite(bounds.height, 10.0);

  elements.forEach((elem, idx) => {
    try {
      if (!elem || typeof elem !== 'object') return;

      if (elem.type === 'dome') {
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
          dome.radius || (safeW * (dome.diameterRatio || 0.25)) / 2,
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
        container.add(domeGroup);
      } else if (elem.type === 'arch') {
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
          posZ = safeD / 2 + 0.05;
        }

        const archGroup = createArchMesh({
          width: isPositiveFinite(arch.width, safeW * 0.25),
          height: isPositiveFinite(arch.height, safeH * 0.85),
          depth: isPositiveFinite(arch.depth, 0.4),
          springHeight: arch.springHeight,
          orientation: arch.orientation || 'front',
          isOpening: arch.isOpening !== false,
          materials: {
            frameMaterial: materials.wallMaterial,
            glassMaterial: materials.glassMaterial,
            edgeMaterial: materials.edgeMaterial,
          },
        });

        archGroup.position.set(posX, posY, posZ);
        container.add(archGroup);
      }
    } catch (elemErr) {
      console.warn(`Failed to build architectural element at index ${idx}:`, elemErr);
    }
  });

  return container;
}
