import * as THREE from 'three';

export interface StudioMaterials {
  surroundingMaterial: THREE.MeshStandardMaterial;
  surroundingWireframeMaterial: THREE.LineBasicMaterial;
  targetElectricBlueMaterial: THREE.MeshPhysicalMaterial;
  targetNeonGoldMaterial: THREE.MeshPhysicalMaterial;
  targetEdgeGlowMaterial: THREE.LineBasicMaterial;
  groundGridMaterial: THREE.LineBasicMaterial;
}

/**
 * Creates curated PBR materials for the Studio Mode Digital Twin
 */
export function createStudioMaterials(): StudioMaterials {
  // 1. Monochromatic Blueprint Surrounding Buildings (Dark Slate Grey #2F4F4F with 0.6 opacity)
  const surroundingMaterial = new THREE.MeshStandardMaterial({
    color: new THREE.Color('#2F4F4F'),
    roughness: 0.85,
    metalness: 0.15,
    transparent: true,
    opacity: 0.60,
    depthWrite: true,
    side: THREE.DoubleSide,
  });

  const surroundingWireframeMaterial = new THREE.LineBasicMaterial({
    color: new THREE.Color('#4A6B6B'),
    transparent: true,
    opacity: 0.45,
    linewidth: 1,
  });

  // 2. High-Gloss Vibrant Electric Blue Target Material (#00D2FF)
  const targetElectricBlueMaterial = new THREE.MeshPhysicalMaterial({
    color: new THREE.Color('#00D2FF'),
    emissive: new THREE.Color('#005B94'),
    emissiveIntensity: 0.65,
    roughness: 0.10, // High-gloss reflection
    metalness: 0.80,
    clearcoat: 1.0,
    clearcoatRoughness: 0.1,
    transmission: 0.20,
    transparent: true,
    opacity: 0.95,
  });

  // 3. High-Gloss Vibrant Neon Gold Target Material (#FFD700)
  const targetNeonGoldMaterial = new THREE.MeshPhysicalMaterial({
    color: new THREE.Color('#FFD700'),
    emissive: new THREE.Color('#B8860B'),
    emissiveIntensity: 0.55,
    roughness: 0.15,
    metalness: 0.90,
    clearcoat: 1.0,
    clearcoatRoughness: 0.08,
    transparent: true,
    opacity: 0.95,
  });

  // 4. Luminous Edge Accent for Target
  const targetEdgeGlowMaterial = new THREE.LineBasicMaterial({
    color: new THREE.Color('#7DF9FF'),
    linewidth: 2,
  });

  // 5. Subtle Dark Tactical Ground Grid
  const groundGridMaterial = new THREE.LineBasicMaterial({
    color: new THREE.Color('#1E293B'),
    transparent: true,
    opacity: 0.35,
  });

  return {
    surroundingMaterial,
    surroundingWireframeMaterial,
    targetElectricBlueMaterial,
    targetNeonGoldMaterial,
    targetEdgeGlowMaterial,
    groundGridMaterial,
  };
}

/**
 * Attaches the Studio Three-Point Lighting + Atmospheric Glow
 */
export function setupStudioLighting(scene: THREE.Scene, targetPosition: [number, number, number] = [0, 0, 0]) {
  // Ambient Soft Blueprint Fill
  const ambientLight = new THREE.AmbientLight(0x0f172a, 1.8);
  scene.add(ambientLight);

  // Studio Key Point Light (Vibrant Cyan Cast)
  const keyLight = new THREE.PointLight(0x38bdf8, 4.5, 800);
  keyLight.position.set(targetPosition[0] + 120, 200, targetPosition[2] + 150);
  scene.add(keyLight);

  // Studio Rim Light (High Contrast Electric Blue)
  const rimLight = new THREE.PointLight(0x00d2ff, 6.0, 600);
  rimLight.position.set(targetPosition[0] - 140, 160, targetPosition[2] - 120);
  scene.add(rimLight);

  // Ground Bounce Warmth
  const bounceLight = new THREE.DirectionalLight(0x1e293b, 1.2);
  bounceLight.position.set(0, -100, 0);
  scene.add(bounceLight);
}
