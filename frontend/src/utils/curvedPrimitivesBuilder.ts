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
 * Strict Principle:
 * - NO hardcoding by landmark name or building type.
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
 * Generates an architectural Onion / Bulbous Dome profile spline points.
 * Returns normalized Vector2 profile points for THREE.LatheGeometry.
 */
export function createOnionProfilePoints(
  radius: number,
  height: number,
  baseElevation: number = 0,
  segments: number = 32,
): THREE.Vector2[] {
  const pts: THREE.Vector2[] = [];
  const bulbousR = radius * 1.12;

  for (let i = 0; i <= segments; i++) {
    const t = i / segments;
    const y = baseElevation + t * height;
    let r: number;

    if (t < 0.20) {
      // Base outward flare from drum ring
      const k = t / 0.20;
      r = radius * 0.96 + (bulbousR - radius * 0.96) * Math.sin(k * (Math.PI / 2));
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

  const normShape: DomeShapeType = (
    params.shape === 'onion' ||
    params.shape === 'ellipsoid' ||
    params.shape === 'shallow_dome' ||
    params.shape === 'cupola'
      ? params.shape
      : 'hemisphere'
  );

  const baseElevation = params.baseElevation || 0;
  const rx = params.radiusX || params.radius || 5;
  const rz = params.radiusZ || params.radius || 5;
  const primaryRadius = (rx + rz) / 2;
  const totalHeight = Math.max(params.height, 1.5);
  const segments = params.segments || 36;

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
    drumH = params.drumHeight || Math.min(totalHeight * 0.28, 3.5);
    drumR = params.drumRadius || primaryRadius * 0.96;
    const drumSides = params.drumSides || segments;

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
    const trimGeo = new THREE.CylinderGeometry(drumR * 1.04, drumR * 1.02, drumH * 0.12, drumSides);
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
    // Onion / Bulbous Dome via Revolved LatheGeometry
    const profilePts = createOnionProfilePoints(primaryRadius, domeActualH, 0, 28);
    const latheGeo = new THREE.LatheGeometry(profilePts, segments);

    // If anisotropic X/Z radii, scale geometry
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
  } else if (normShape === 'ellipsoid') {
    // Ellipsoid Dome via non-uniformly scaled upper hemisphere
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
    // Shallow / Flattened Dome
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
    // Cupola / Roof Pavilion: supporting arcade ring + miniature dome + spire
    const cupolaDrumH = Math.max(domeActualH * 0.45, 1.2);
    const cupolaDrumGeo = new THREE.CylinderGeometry(primaryRadius * 0.85, primaryRadius * 0.85, cupolaDrumH, 16);
    const cupolaDrumMesh = new THREE.Mesh(cupolaDrumGeo, drumMat);
    cupolaDrumMesh.name = 'cupola_drum_mesh';
    cupolaDrumMesh.position.y = domeBaseY + cupolaDrumH / 2;
    cupolaDrumMesh.castShadow = true;
    group.add(cupolaDrumMesh);

    const cupolaCapH = domeActualH - cupolaDrumH;
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
    const finialH = params.finialHeight || Math.max(totalHeight * 0.35, primaryRadius * 0.4, 2.0);
    const apexY = domeBaseY + domeActualH;
    const finialGroup = new THREE.Group();
    finialGroup.name = 'dome_apex_finial';

    if (params.finialStyle === 'kalash' || normShape === 'onion') {
      // Tiered kalash beads + pointed needle
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
      // Classical Spire Cone & Needle
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
    group.position.set(params.position.x, params.position.y, params.position.z);
  }

  return group;
}

/**
 * Creates an Architectural Semicircular Arch geometry for vertical façade openings/entrances.
 * Distinct from roof domes: this represents a vertical arched portal or window opening.
 */
export function createArchMesh(params: CreateArchParams): THREE.Group {
  const group = new THREE.Group();
  group.name = 'arch_primitive';

  const w = Math.max(params.width, 1.0);
  const h = Math.max(params.height, 1.5);
  const d = params.depth || 0.45;
  const radius = w / 2;
  const springY = params.springHeight !== undefined ? params.springHeight : Math.max(h - radius, h * 0.55);
  const actualArchRadius = Math.min(radius, h - springY);

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
    bevelThickness: 0.06,
    bevelSize: 0.05,
    bevelSegments: 2,
  };

  const archGeo = new THREE.ExtrudeGeometry(archShape, extrudeSettings);
  const archMesh = new THREE.Mesh(archGeo, frameMat);
  archMesh.name = 'arch_frame_mesh';
  archMesh.castShadow = true;
  archMesh.receiveShadow = true;
  group.add(archMesh);

  if (edgeMat) {
    const archEdges = new THREE.LineSegments(new THREE.EdgesGeometry(archGeo, 30), edgeMat);
    group.add(archEdges);
  }

  // 3. Glazed Inset / Window Pane (if opening/glazed)
  if (params.isOpening !== false && glassMat) {
    const glassShape = new THREE.Shape();
    const margin = 0.12;
    const gw = w - margin * 2;
    const gr = gw / 2;
    const gSpringY = Math.max(springY - margin, 0);

    glassShape.moveTo(-gw / 2, margin);
    glassShape.lineTo(-gw / 2, gSpringY);
    glassShape.absarc(0, gSpringY, gr, Math.PI, 0, true);
    glassShape.lineTo(gw / 2, margin);
    glassShape.closePath();

    const glassGeo = new THREE.ShapeGeometry(glassShape, 18);
    const glassMesh = new THREE.Mesh(glassGeo, glassMat);
    glassMesh.name = 'arch_glazing_pane';
    glassMesh.position.z = d / 2;
    group.add(glassMesh);

    // Subtle vertical and radiating sunburst mullion bars on arch
    const mullionMat = frameMat;
    const centerMullion = new THREE.Mesh(new THREE.BoxGeometry(0.06, h * 0.9, 0.08), mullionMat);
    centerMullion.name = 'arch_center_mullion';
    centerMullion.position.set(0, h * 0.45, d / 2 + 0.02);
    group.add(centerMullion);
  }

  // Handle orientation / rotation
  if (params.orientation) {
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
    group.position.set(params.position.x, params.position.y, params.position.z);
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

  elements.forEach((elem) => {
    if (elem.type === 'dome') {
      const dome = elem as DomeElement;
      let posX = 0;
      let posZ = 0;
      const posY = dome.baseElevation !== undefined ? dome.baseElevation : bounds.height;

      if (dome.position) {
        posX = dome.position.x;
        posZ = dome.position.z;
      } else if (dome.relativePosition) {
        // [relX, relZ] normalized 0..1 relative to building bounds
        posX = (dome.relativePosition[0] - 0.5) * bounds.width;
        posZ = (dome.relativePosition[1] - 0.5) * bounds.depth;
      }

      const domeRadius = dome.radius || (bounds.width * (dome.diameterRatio || 0.25)) / 2;
      const domeHeight = dome.height || bounds.height * (dome.heightRatio || 0.18);

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
      let posZ = bounds.depth / 2 + 0.05;

      if (arch.position) {
        posX = arch.position.x;
        posY = arch.position.y;
        posZ = arch.position.z;
      } else if (arch.relativePosition) {
        posX = (arch.relativePosition[0] - 0.5) * bounds.width;
        posY = arch.relativePosition[1] * bounds.height;
        posZ = (arch.relativePosition[2] - 0.5) * bounds.depth;
      }

      const archGroup = createArchMesh({
        width: arch.width || bounds.width * 0.25,
        height: arch.height || bounds.height * 0.45,
        depth: arch.depth || 0.4,
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
  });

  return container;
}
