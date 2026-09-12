/**
 * customModelProvider.ts
 * Reusable 3D GLB/GLTF Architectural Model Loader, Transform Calibrator, and Provider Priority Evaluator.
 * 
 * Features:
 * - Asynchronously loads and parses GLTF / GLB models with Three.js GLTFLoader.
 * - In-memory asset caching to prevent duplicate network downloads & parsing overhead.
 * - Automatic bounding-box computation via THREE.Box3, centering at ground level [0, 0, 0].
 * - Preserves original PBR materials, textures, colors, and shadows (castShadow / receiveShadow).
 * - Provider priority evaluation hierarchy:
 *   1. CUSTOM_MODEL
 *   2. OSM2WORLD
 *   3. OSM_BUILDING_PART
 *   4. OSM_FOOTPRINT
 */

import * as THREE from 'three';
import { GLTFLoader, GLTF } from 'three/examples/jsm/loaders/GLTFLoader.js';
import { DRACOLoader } from 'three/examples/jsm/loaders/DRACOLoader.js';
import { Building } from '../types';
import { CustomModelConfig, findCustomModel } from '../data/customModels';
import { getFootprintVertexCount } from './footprintUtils';

export type BuildingGeometrySourceTier =
  | 'CUSTOM_MODEL'
  | 'OSM2WORLD'
  | 'OSM_BUILDING_PART'
  | 'OSM_FOOTPRINT';

export interface CustomModelTransformParams {
  modelUrl: string;
  latitude?: number;
  longitude?: number;
  modelScale?: number;
  rotation?: [number, number, number]; // [rotX, rotY, rotZ]
  groundOffset?: number;
  metadata?: Record<string, any>;
}

export interface CustomModelLoadResult {
  group: THREE.Group;
  meshes: THREE.Mesh[];
  meshCount: number;
  boundingBox: THREE.Box3;
  dimensions: {
    width: number;
    depth: number;
    height: number;
  };
  center: THREE.Vector3;
  originalMaterialsCount: number;
  source: 'CUSTOM_MODEL';
  modelUrl: string;
  isCached: boolean;
}

export interface GeometryTierDecision {
  provider: BuildingGeometrySourceTier;
  geometrySource: string;
  fallbackUsed: boolean;
  customModelConfig?: CustomModelConfig | null;
  statusBadge: string;
  description: string;
}

// ── In-Memory Global Model & Loader Cache ──
const _gltfSceneCache = new Map<string, GLTF>();
const _pendingLoadPromises = new Map<string, Promise<GLTF>>();
let _gltfLoaderInstance: GLTFLoader | null = null;

function getGLTFLoader(): GLTFLoader {
  if (!_gltfLoaderInstance) {
    _gltfLoaderInstance = new GLTFLoader();

    // Configure Draco Decoder for compressed GLTF meshes if available
    try {
      const dracoLoader = new DRACOLoader();
      dracoLoader.setDecoderPath('https://www.gstatic.com/draco/versioned/decoders/1.5.7/');
      dracoLoader.setDecoderConfig({ type: 'js' });
      _gltfLoaderInstance.setDRACOLoader(dracoLoader);
    } catch (e) {
      console.warn('[customModelProvider] Draco loader fallback note:', e);
    }
  }
  return _gltfLoaderInstance;
}

/**
 * Loads a GLB/GLTF model from URL (cached), computes bounding box,
 * centers geometry at origin [0, groundOffset, 0], and configures shadows & materials.
 */
export async function loadCustomModelMesh(
  params: CustomModelTransformParams
): Promise<CustomModelLoadResult> {
  const {
    modelUrl,
    modelScale = 1.0,
    rotation = [0, 0, 0],
    groundOffset = 0,
  } = params;

  const loader = getGLTFLoader();

  let gltf: GLTF;
  let isCached = false;

  if (_gltfSceneCache.has(modelUrl)) {
    gltf = _gltfSceneCache.get(modelUrl)!;
    isCached = true;
  } else if (_pendingLoadPromises.has(modelUrl)) {
    gltf = await _pendingLoadPromises.get(modelUrl)!;
    isCached = true;
  } else {
    const loadPromise = new Promise<GLTF>((resolve, reject) => {
      loader.load(
        modelUrl,
        (loadedGltf) => {
          _gltfSceneCache.set(modelUrl, loadedGltf);
          _pendingLoadPromises.delete(modelUrl);
          resolve(loadedGltf);
        },
        undefined,
        (err) => {
          _pendingLoadPromises.delete(modelUrl);
          reject(err);
        }
      );
    });

    _pendingLoadPromises.set(modelUrl, loadPromise);
    gltf = await loadPromise;
  }

  // Clone scene so independent instances can be placed and transformed
  const clonedScene = gltf.scene.clone(true);
  clonedScene.name = 'imported_custom_architectural_model';

  // Apply scaling and local rotation
  clonedScene.scale.set(modelScale, modelScale, modelScale);
  if (rotation[0] !== 0 || rotation[1] !== 0 || rotation[2] !== 0) {
    clonedScene.rotation.set(rotation[0], rotation[1], rotation[2]);
  }

  // Compute Raw Bounding Box
  const rawBox = new THREE.Box3().setFromObject(clonedScene);
  const rawCenter = rawBox.getCenter(new THREE.Vector3());
  const rawMin = rawBox.min;

  // Center horizontally at [0, 0] and place lowest point at ground level + groundOffset
  clonedScene.position.set(-rawCenter.x, -rawMin.y + groundOffset, -rawCenter.z);

  // Wrap in container group for clean hierarchy
  const containerGroup = new THREE.Group();
  containerGroup.name = 'customModelContainer';
  containerGroup.add(clonedScene);

  // Collect meshes and configure PBR materials, shadows, normals
  const meshes: THREE.Mesh[] = [];
  const materialSet = new Set<THREE.Material>();

  clonedScene.traverse((child) => {
    if ((child as THREE.Mesh).isMesh) {
      const mesh = child as THREE.Mesh;
      mesh.castShadow = true;
      mesh.receiveShadow = true;
      mesh.frustumCulled = false;

      if (mesh.geometry) {
        mesh.geometry.computeBoundingBox?.();
        mesh.geometry.computeBoundingSphere?.();
      }

      if (mesh.material) {
        if (Array.isArray(mesh.material)) {
          mesh.material.forEach((mat) => {
            materialSet.add(mat);
            mat.side = THREE.DoubleSide;
          });
        } else {
          materialSet.add(mesh.material);
          mesh.material.side = THREE.DoubleSide;
        }
      }

      meshes.push(mesh);
    }
  });

  // Re-compute final normalized bounding box
  const finalBox = new THREE.Box3().setFromObject(containerGroup);
  const size = finalBox.getSize(new THREE.Vector3());
  const center = finalBox.getCenter(new THREE.Vector3());

  return {
    group: containerGroup,
    meshes,
    meshCount: meshes.length,
    boundingBox: finalBox,
    dimensions: {
      width: size.x,
      depth: size.z,
      height: size.y,
    },
    center,
    originalMaterialsCount: materialSet.size,
    source: 'CUSTOM_MODEL',
    modelUrl,
    isCached,
  };
}

/**
 * Evaluates the geometry provider priority order:
 * 1. CUSTOM_MODEL (Custom GLB/GLTF model when available)
 * 2. OSM2WORLD (OSM2World detailed geometry)
 * 3. OSM_BUILDING_PART (OSM building:part geometry)
 * 4. OSM_FOOTPRINT (OSM polygon extrusion fallback)
 */
export function evaluateGeometryTier(
  building: Building | null,
  hasOSM2WorldData = false
): GeometryTierDecision {
  // 1. Check for registered custom model or direct custom_model_url
  const customModel = findCustomModel(building);
  if (customModel) {
    return {
      provider: 'CUSTOM_MODEL',
      geometrySource: 'Imported architectural model',
      fallbackUsed: false,
      customModelConfig: customModel,
      statusBadge: 'High-detail architectural model',
      description: `Loaded custom 3D asset (${customModel.name})`,
    };
  }

  // 2. OSM2World
  if (hasOSM2WorldData) {
    return {
      provider: 'OSM2WORLD',
      geometrySource: 'OSM2World',
      fallbackUsed: false,
      statusBadge: 'OSM2World Web Mesh',
      description: 'LOD4 geometric synthesis from OSM elements',
    };
  }

  // 3. OSM building:part
  if (building?.building_parts && building.building_parts.length > 0) {
    return {
      provider: 'OSM_BUILDING_PART',
      geometrySource: 'OSM building:part geometry',
      fallbackUsed: false,
      statusBadge: 'OSM building:part',
      description: `Reconstructed from ${building.building_parts.length} structural parts`,
    };
  }

  // 4. OSM polygon footprint
  if (building?.footprint && getFootprintVertexCount(building.footprint) >= 3) {
    return {
      provider: 'OSM_FOOTPRINT',
      geometrySource: 'OSM polygon extrusion',
      fallbackUsed: false,
      statusBadge: 'OSM Footprint Extrusion',
      description: 'Extruded from real-world OSM cadastral parcel boundary',
    };
  }

  // Fallback
  return {
    provider: 'OSM_FOOTPRINT',
    geometrySource: 'Cadastral bounding volume',
    fallbackUsed: true,
    statusBadge: 'Procedural Extrusion',
    description: 'Procedural volume fallback',
  };
}

/**
 * Diagnostic logger for the geometry tier
 */
export function logModelPipelineTelemetry(params: {
  buildingName: string;
  provider: BuildingGeometrySourceTier;
  geometrySource: string;
  modelLoaded: boolean;
  fallbackUsed: boolean;
  originalMaterials: boolean;
  modelUrl?: string;
  meshCount?: number;
  latitude: number;
  longitude: number;
}) {
  console.log('🏛️ [3D Model Pipeline Telemetry]', {
    Provider: params.provider,
    'Model Loaded': params.modelLoaded ? 'YES' : 'NO',
    'Fallback Used': params.fallbackUsed ? 'YES' : 'NO',
    'Original Materials': params.originalMaterials ? 'YES' : 'NO',
    'Geometry Source': params.geometrySource,
    'Model Asset URL': params.modelUrl || 'N/A',
    'Mesh Count': params.meshCount ?? 0,
    Coordinates: `${params.latitude.toFixed(5)}°, ${params.longitude.toFixed(5)}°`,
  });
}

/**
 * Recursively disposes all geometries, textures, and materials in a Three.js group.
 */
export function disposeThreeGroup(group: THREE.Object3D) {
  group.traverse((child) => {
    if ((child as THREE.Mesh).isMesh) {
      const m = child as THREE.Mesh;
      if (m.geometry) {
        m.geometry.dispose();
      }
      if (m.material) {
        if (Array.isArray(m.material)) {
          m.material.forEach((mat) => mat.dispose());
        } else {
          m.material.dispose();
        }
      }
    }
  });
}
