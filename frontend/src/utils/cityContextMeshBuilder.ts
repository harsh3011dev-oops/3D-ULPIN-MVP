/**
 * cityContextMeshBuilder.ts
 * GPU-Accelerated 3D City Context Instanced Mesh Generator for Three.js.
 * 
 * Batches hundreds of surrounding neighborhood buildings into a single draw call
 * using THREE.InstancedMesh, with procedural night skyscraper materials,
 * randomized glowing window grids, and crisp cadastral wireframe edge accents.
 */

import * as THREE from 'three';
import { SurroundingBuildingData } from './cityContextFetcher';

let _cachedWindowTexture: THREE.CanvasTexture | null = null;

/**
 * Creates or reuses a high-resolution procedural skyscraper night window texture.
 */
export function getSkyscraperWindowTexture(): THREE.CanvasTexture {
  if (_cachedWindowTexture) return _cachedWindowTexture;

  const width = 512;
  const height = 512;
  const canvas = document.createElement('canvas');
  canvas.width = width;
  canvas.height = height;
  const ctx = canvas.getContext('2d');

  if (!ctx) {
    const fallback = new THREE.CanvasTexture(canvas);
    return fallback;
  }

  // 1. Dark midnight slate building facade base
  ctx.fillStyle = '#0F172A';
  ctx.fillRect(0, 0, width, height);

  // 2. Window Grid parameters
  const cols = 16;
  const rows = 32;
  const paddingX = 6;
  const paddingY = 4;
  const cellW = (width - paddingX * (cols + 1)) / cols;
  const cellH = (height - paddingY * (rows + 1)) / rows;

  const litWindowPalette = [
    'rgba(56, 189, 248, 0.95)',   // Neon Cyan
    'rgba(125, 211, 252, 0.85)',  // Soft Sky Blue
    'rgba(245, 158, 11, 0.92)',   // Warm Amber Gold
    'rgba(253, 230, 138, 0.90)',  // Soft Cream Light
    'rgba(45, 212, 191, 0.88)',   // Cadastral Teal
  ];

  const unlitWindow = 'rgba(30, 41, 59, 0.95)';

  for (let r = 0; r < rows; r++) {
    for (let c = 0; c < cols; c++) {
      const x = paddingX + c * (cellW + paddingX);
      const y = paddingY + r * (cellH + paddingY);

      // Randomized window state (approx 42% lit at night)
      const rand = Math.random();
      if (rand < 0.42) {
        const color = litWindowPalette[Math.floor(Math.random() * litWindowPalette.length)];
        ctx.fillStyle = color;
        ctx.shadowColor = '#38BDF8';
        ctx.shadowBlur = 4;
      } else {
        ctx.fillStyle = unlitWindow;
        ctx.shadowColor = 'transparent';
        ctx.shadowBlur = 0;
      }

      ctx.fillRect(x, y, cellW, cellH);
    }
  }

  // 3. Subtle vertical mullion dividers
  ctx.shadowBlur = 0;
  ctx.fillStyle = 'rgba(15, 23, 42, 0.8)';
  for (let c = 0; c <= cols; c++) {
    ctx.fillRect(c * (cellW + paddingX), 0, 2, height);
  }

  const texture = new THREE.CanvasTexture(canvas);
  texture.wrapS = THREE.RepeatWrapping;
  texture.wrapT = THREE.RepeatWrapping;
  texture.repeat.set(2, 4);
  _cachedWindowTexture = texture;
  return texture;
}

/**
 * Builds a single-draw-call THREE.InstancedMesh representing the surrounding city skyline.
 */
export function buildCityContextInstancedMesh(
  buildings: SurroundingBuildingData[],
  radiusMeters: number = 750
): THREE.Group {
  const group = new THREE.Group();
  group.name = 'city_context_neighborhood_skyline';

  if (!buildings || buildings.length === 0) return group;

  const count = buildings.length;
  const geometry = new THREE.BoxGeometry(1, 1, 1);
  const texture = getSkyscraperWindowTexture();

  // Cyberpunk dark skyscraper material with emissive window grids
  const material = new THREE.MeshStandardMaterial({
    color: 0x111827,
    map: texture,
    emissive: 0x38bdf8,
    emissiveMap: texture,
    emissiveIntensity: 0.45,
    roughness: 0.35,
    metalness: 0.25,
    transparent: true,
    opacity: 0.92,
  });

  const instancedMesh = new THREE.InstancedMesh(geometry, material, count);
  instancedMesh.name = 'city_context_instanced_mesh';
  instancedMesh.castShadow = false;
  instancedMesh.receiveShadow = true;

  const dummy = new THREE.Object3D();
  const dummyMatrix = new THREE.Matrix4();

  for (let i = 0; i < count; i++) {
    const b = buildings[i];
    const posX = b.localX;
    const posZ = b.localZ;
    const h = b.height;
    const posY = h / 2;
    const w = b.width;
    const d = b.depth;

    dummy.position.set(posX, posY, posZ);
    dummy.rotation.set(0, 0, 0);
    dummy.scale.set(w, h, d);
    dummy.updateMatrix();

    instancedMesh.setMatrixAt(i, dummy.matrix);
  }

  instancedMesh.instanceMatrix.needsUpdate = true;
  group.add(instancedMesh);

  // 2. Subtle Glowing Base Boundary / Radial Grid Ring
  const ringGeom = new THREE.RingGeometry(radiusMeters * 0.92, radiusMeters * 0.98, 64);
  ringGeom.rotateX(-Math.PI / 2);
  const ringMat = new THREE.MeshBasicMaterial({
    color: 0x00c8ff,
    transparent: true,
    opacity: 0.35,
    side: THREE.DoubleSide,
  });
  const ringMesh = new THREE.Mesh(ringGeom, ringMat);
  ringMesh.position.y = 0.2;
  group.add(ringMesh);

  return group;
}
