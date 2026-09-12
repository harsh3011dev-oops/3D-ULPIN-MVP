/**
 * buildingPartMesher.ts
 * Universal parametric 3D mesh generator for OSM building parts, multi-polygons, and roofs.
 * 
 * Converts geographic BuildingPartData into high-fidelity Three.js scene meshes.
 * Dynamic materials derived strictly from OSM material/color tags or neutral architectural PBR shaders.
 */

import * as THREE from 'three';
import { BuildingPartData } from '../types';

export interface BuildingMesherResult {
  group: THREE.Group;
  meshes: THREE.Mesh[];
  meshCount: number;
  buildingPartsCount: number;
  roofShapes: string[];
  bounds: THREE.Box3;
}

/**
 * Universal mesh generator for multiple building parts
 */
export function generateBuildingPartsMeshes(
  parts: BuildingPartData[],
  centerLng: number,
  centerLat: number
): BuildingMesherResult {
  const group = new THREE.Group();
  group.name = 'osm_building_parts_group';
  const meshes: THREE.Mesh[] = [];
  const roofShapesSet = new Set<string>();

  const latRad = (centerLat * Math.PI) / 180;
  const metersPerDegreeLon = 111320 * Math.cos(latRad);
  const metersPerDegreeLat = 110540;

  parts.forEach((part, partIdx) => {
    try {
      const geometry = part.footprint;
      if (!geometry) return;

      const rings: number[][][] =
        geometry.type === 'MultiPolygon'
          ? geometry.coordinates[0] || []
          : geometry.coordinates || [];

      if (!rings || rings.length === 0 || !rings[0] || rings[0].length < 3) return;

      const outerRing = rings[0];
      const holes = rings.slice(1);

      // Convert outer ring to local metric 2D coordinates (X, Z)
      const outerPoints: THREE.Vector2[] = outerRing.map(([lon, lat]: number[]) => {
        const x = (lon - centerLng) * metersPerDegreeLon;
        const y = (lat - centerLat) * metersPerDegreeLat;
        return new THREE.Vector2(x, y);
      });

      if (outerPoints.length < 3) return;

      // Ensure counter-clockwise winding
      if (THREE.ShapeUtils.isClockWise(outerPoints)) {
        outerPoints.reverse();
      }

      const shape = new THREE.Shape(outerPoints);

      // Process inner hole rings
      holes.forEach((holeRing) => {
        if (holeRing.length >= 3) {
          const holePoints = holeRing.map(([lon, lat]: number[]) => {
            const x = (lon - centerLng) * metersPerDegreeLon;
            const y = (lat - centerLat) * metersPerDegreeLat;
            return new THREE.Vector2(x, y);
          });
          if (!THREE.ShapeUtils.isClockWise(holePoints)) {
            holePoints.reverse();
          }
          shape.holes.push(new THREE.Path(holePoints));
        }
      });

      const totalHeight = Math.max(part.height || 10, 2.5);
      const minHeight = Math.max(part.min_height || 0, 0);
      const rawRoofShape = (part.roof_shape || '').toLowerCase().trim();
      const roofHeight = part.roof_height && part.roof_height > 0
        ? Math.min(part.roof_height, totalHeight * 0.5)
        : rawRoofShape && rawRoofShape !== 'flat'
        ? Math.min(totalHeight * 0.28, 8.0)
        : 0;

      const wallHeight = Math.max(totalHeight - minHeight - roofHeight, 1.0);

      // 1. Extrude Body Walls
      const extrudeSettings: THREE.ExtrudeGeometryOptions = {
        depth: wallHeight,
        bevelEnabled: false,
      };

      const bodyGeometry = new THREE.ExtrudeGeometry(shape, extrudeSettings);
      // Rotate geometry so depth goes along +Y (Up)
      bodyGeometry.rotateX(-Math.PI / 2);
      bodyGeometry.translate(0, minHeight, 0);
      bodyGeometry.computeVertexNormals();

      const bodyMat = createDynamicMaterial(part.material, part.color, false);
      const bodyMesh = new THREE.Mesh(bodyGeometry, bodyMat);
      bodyMesh.name = `part_body_${partIdx}_${part.id}`;
      bodyMesh.castShadow = true;
      bodyMesh.receiveShadow = true;

      group.add(bodyMesh);
      meshes.push(bodyMesh);

      // 2. Build Roof Geometry
      if (roofHeight > 0.1 && rawRoofShape && rawRoofShape !== 'flat') {
        roofShapesSet.add(rawRoofShape);
        const roofMesh = generateRoofMesh(shape, outerPoints, minHeight + wallHeight, roofHeight, rawRoofShape, part);
        if (roofMesh) {
          roofMesh.name = `part_roof_${partIdx}_${rawRoofShape}`;
          group.add(roofMesh);
          meshes.push(roofMesh);
        }
      }
    } catch (err) {
      console.warn(`[BuildingPartMesher] Error meshing part ${part.id}:`, err);
    }
  });

  const bbox = new THREE.Box3().setFromObject(group);

  return {
    group,
    meshes,
    meshCount: meshes.length,
    buildingPartsCount: parts.length,
    roofShapes: Array.from(roofShapesSet),
    bounds: bbox,
  };
}

/**
 * Generates parametric 3D roof geometry
 */
function generateRoofMesh(
  shape: THREE.Shape,
  outerPoints: THREE.Vector2[],
  baseAltitude: number,
  roofHeight: number,
  roofShape: string,
  part: BuildingPartData
): THREE.Mesh | null {
  const roofMat = createDynamicMaterial(part.roof_material || part.material, part.roof_color || part.color, true);

  // Compute centroid of the roof base
  let cx = 0;
  let cy = 0;
  outerPoints.forEach((pt) => {
    cx += pt.x;
    cy += pt.y;
  });
  cx /= outerPoints.length;
  cy /= outerPoints.length;

  if (roofShape.includes('pyramid') || roofShape.includes('hipped')) {
    // Pyramidal apex roof
    const geom = new THREE.BufferGeometry();
    const vertices: number[] = [];
    const apex = [cx, baseAltitude + roofHeight, -cy];

    for (let i = 0; i < outerPoints.length; i++) {
      const p1 = outerPoints[i];
      const p2 = outerPoints[(i + 1) % outerPoints.length];

      // Base triangle face to apex
      vertices.push(
        p1.x, baseAltitude, -p1.y,
        p2.x, baseAltitude, -p2.y,
        apex[0], apex[1], apex[2]
      );
    }

    geom.setAttribute('position', new THREE.Float32BufferAttribute(vertices, 3));
    geom.computeVertexNormals();

    const mesh = new THREE.Mesh(geom, roofMat);
    mesh.castShadow = true;
    mesh.receiveShadow = true;
    return mesh;
  } else if (roofShape.includes('dome') || roofShape.includes('onion')) {
    // Spheroidal / dome cap
    let maxRadius = 0;
    outerPoints.forEach((pt) => {
      const dist = Math.sqrt((pt.x - cx) ** 2 + (pt.y - cy) ** 2);
      if (dist > maxRadius) maxRadius = dist;
    });
    maxRadius = Math.max(maxRadius * 0.85, 1.5);

    const domeGeom = new THREE.SphereGeometry(
      maxRadius,
      20,
      14,
      0,
      Math.PI * 2,
      0,
      Math.PI * 0.5
    );
    domeGeom.scale(1, roofHeight / maxRadius, 1);
    domeGeom.translate(cx, baseAltitude, -cy);
    domeGeom.computeVertexNormals();

    const mesh = new THREE.Mesh(domeGeom, roofMat);
    mesh.castShadow = true;
    mesh.receiveShadow = true;
    return mesh;
  } else if (roofShape.includes('cone') || roofShape.includes('round')) {
    // Conical roof
    let maxRadius = 0;
    outerPoints.forEach((pt) => {
      const dist = Math.sqrt((pt.x - cx) ** 2 + (pt.y - cy) ** 2);
      if (dist > maxRadius) maxRadius = dist;
    });

    const coneGeom = new THREE.ConeGeometry(Math.max(maxRadius * 0.9, 1.5), roofHeight, 18);
    coneGeom.translate(cx, baseAltitude + roofHeight / 2, -cy);
    coneGeom.computeVertexNormals();

    const mesh = new THREE.Mesh(coneGeom, roofMat);
    mesh.castShadow = true;
    mesh.receiveShadow = true;
    return mesh;
  } else {
    // Standard extruded roof slab
    const roofGeom = new THREE.ExtrudeGeometry(shape, { depth: roofHeight, bevelEnabled: false });
    roofGeom.rotateX(-Math.PI / 2);
    roofGeom.translate(0, baseAltitude, 0);
    roofGeom.computeVertexNormals();

    const mesh = new THREE.Mesh(roofGeom, roofMat);
    mesh.castShadow = true;
    mesh.receiveShadow = true;
    return mesh;
  }
}

/**
 * Creates dynamic PBR Standard material strictly derived from OSM tags
 */
export function createDynamicMaterial(
  materialTag?: string,
  colorTag?: string,
  isRoof = false
): THREE.MeshStandardMaterial {
  const mat = (materialTag || '').toLowerCase().trim();
  const col = (colorTag || '').toLowerCase().trim();

  let hexColor = isRoof ? 0x334155 : 0xe2e8f0; // Slate roof vs warm limestone
  let roughness = isRoof ? 0.55 : 0.65;
  let metalness = 0.08;

  // 1. Color tag matching (named or hex)
  if (col.startsWith('#')) {
    const parsed = parseInt(col.replace('#', ''), 16);
    if (!isNaN(parsed)) hexColor = parsed;
  } else if (col === 'red' || col.includes('brick') || col.includes('terracotta')) {
    hexColor = 0xb91c1c;
  } else if (col === 'white' || col.includes('marble') || col.includes('ivory')) {
    hexColor = 0xf8fafc;
    roughness = 0.35;
    metalness = 0.02;
  } else if (col === 'gold' || col === 'yellow' || col.includes('brass')) {
    hexColor = 0xf59e0b;
    roughness = 0.22;
    metalness = 0.90;
  } else if (col === 'grey' || col === 'gray' || col === 'concrete') {
    hexColor = 0x94a3b8;
    roughness = 0.75;
  } else if (col === 'blue' || col.includes('glass')) {
    hexColor = 0x38bdf8;
    roughness = 0.20;
    metalness = 0.40;
  } else if (col === 'brown' || col.includes('sandstone') || col.includes('wood')) {
    hexColor = 0x92400e;
    roughness = 0.78;
  }

  // 2. Material tag nuances
  if (mat.includes('marble') || mat.includes('granite')) {
    roughness = 0.30;
    metalness = 0.05;
  } else if (mat.includes('glass')) {
    roughness = 0.15;
    metalness = 0.60;
  } else if (mat.includes('metal') || mat.includes('copper') || mat.includes('zinc') || mat.includes('tin')) {
    roughness = 0.35;
    metalness = 0.85;
  } else if (mat.includes('brick') || mat.includes('stone') || mat.includes('masonry')) {
    roughness = 0.85;
    metalness = 0.02;
  }

  return new THREE.MeshStandardMaterial({
    color: hexColor,
    roughness,
    metalness,
    side: THREE.DoubleSide,
  });
}
