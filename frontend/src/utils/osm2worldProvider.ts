/**
 * osm2worldProvider.ts
 * Integrates the official OSM2World web engine to generate high-fidelity 3D meshes
 * from OpenStreetMap data and converts them into Three.js scene objects.
 */

import * as THREE from 'three';
import { OSMDataResponse } from './osmFetcher';

const OSM2WORLD_MODULE_URL =
  'https://osm2world.org/build/web/0.5.0-SNAPSHOT_2026-06-16/osm2world-core-web.mjs';
const OSM2WORLD_CONFIG_URL =
  'https://tiles.osm2world.org/default-style/standard.properties';
const TEXTURE_BASE_URL = 'https://tiles.osm2world.org/';

export interface OSM2WorldResult {
  group: THREE.Group;
  meshes: THREE.Mesh[];
  meshCount: number;
  buildingPartsCount: number;
  roofShapes: string[];
  bounds: THREE.Box3;
  source: 'OSM2World';
}

let _converterInstance: any = null;
let _converterInitPromise: Promise<any> | null = null;
const _textureCache = new Map<string, THREE.Texture>();
const _textureLoader = new THREE.TextureLoader();

/**
 * Lazy load and configure the official OSM2World Web converter module.
 */
export async function getOSM2WorldConverter(): Promise<any> {
  if (_converterInstance) return _converterInstance;
  if (_converterInitPromise) return _converterInitPromise;

  _converterInitPromise = (async () => {
    try {
      /* @vite-ignore */
      const o2wModule = await import(/* @vite-ignore */ OSM2WORLD_MODULE_URL);
      const { O2WConverter, loadO2WConfig } = o2wModule;

      return new Promise((resolve, reject) => {
        loadO2WConfig(
          OSM2WORLD_CONFIG_URL,
          { lod: '4' },
          (config: any) => {
            const converter = new O2WConverter();
            converter.setConfig(config);
            _converterInstance = converter;
            console.log('✅ [OSM2World] Web Converter initialized with LOD 4 styles');
            resolve(converter);
          },
          (err: any) => {
            console.warn('⚠️ [OSM2World] Failed to load remote style config, initializing base converter:', err);
            const converter = new O2WConverter();
            _converterInstance = converter;
            resolve(converter);
          }
        );
      });
    } catch (err) {
      _converterInitPromise = null;
      console.error('❌ [OSM2World] Failed to load OSM2World ES module:', err);
      throw err;
    }
  })();

  return _converterInitPromise;
}

/**
 * Load or retrieve cached texture for OSM2World materials.
 */
function getCachedTexture(path: string, clamp: boolean = false): THREE.Texture {
  const fullUrl = path.startsWith('http') ? path : TEXTURE_BASE_URL + path;
  if (_textureCache.has(fullUrl)) {
    return _textureCache.get(fullUrl)!;
  }
  const tex = _textureLoader.load(fullUrl);
  tex.wrapS = clamp ? THREE.ClampToEdgeWrapping : THREE.RepeatWrapping;
  tex.wrapT = clamp ? THREE.ClampToEdgeWrapping : THREE.RepeatWrapping;
  tex.colorSpace = THREE.SRGBColorSpace;
  _textureCache.set(fullUrl, tex);
  return tex;
}

/**
 * Convert raw OSM2World mesh objects to Three.js Mesh instances.
 */
function convertO2WMeshesToThree(rawMeshes: any[]): { group: THREE.Group; meshes: THREE.Mesh[] } {
  const group = new THREE.Group();
  group.name = 'osm2world_building_group';
  const threeMeshes: THREE.Mesh[] = [];

  rawMeshes.forEach((mesh: any, idx: number) => {
    try {
      const positions = mesh.positions();
      const indices = mesh.indices();
      const normals = mesh.normals ? mesh.normals() : null;
      const uvs = mesh.uvs ? mesh.uvs() : null;

      if (!positions || positions.length < 9) return;

      const geometry = new THREE.BufferGeometry();
      geometry.setAttribute(
        'position',
        new THREE.BufferAttribute(new Float32Array(positions), 3)
      );

      if (indices && indices.length > 0) {
        geometry.setIndex(new THREE.BufferAttribute(new Uint32Array(indices), 1));
      }

      if (normals && normals.length === positions.length) {
        geometry.setAttribute('normal', new THREE.BufferAttribute(new Float32Array(normals), 3));
      } else {
        geometry.computeVertexNormals();
      }

      if (uvs && uvs.length > 0) {
        geometry.setAttribute('uv', new THREE.BufferAttribute(new Float32Array(uvs), 2));
      }

      // Material properties
      const colorArr = mesh.color ? mesh.color() : [0.85, 0.85, 0.85];
      const color = new THREE.Color(colorArr[0], colorArr[1], colorArr[2]);
      const matName = (typeof mesh.materialName === 'function' ? mesh.materialName() : `mat_${idx}`) || '';

      const baseColorTex = typeof mesh.baseColorTexture === 'function' ? mesh.baseColorTexture() : null;
      const normalTex = typeof mesh.normalTexture === 'function' ? mesh.normalTexture() : null;
      const ormTex = typeof mesh.ormTexture === 'function' ? mesh.ormTexture() : null;
      const isTransparent = typeof mesh.transparency === 'function' ? mesh.transparency() : false;
      const isClamp = typeof mesh.clampTextures === 'function' ? mesh.clampTextures() : false;
      const matParams: THREE.MeshStandardMaterialParameters = {
        color,
        roughness: 0.65,
        metalness: 0.1,
        side: THREE.DoubleSide,
      };

      if (baseColorTex) {
        matParams.map = getCachedTexture(baseColorTex, isClamp);
      }
      if (normalTex) {
        matParams.normalMap = getCachedTexture(normalTex, isClamp);
      }
      if (ormTex) {
        matParams.roughnessMap = getCachedTexture(ormTex, isClamp);
        matParams.metalnessMap = getCachedTexture(ormTex, isClamp);
      }
      if (isTransparent) {
        matParams.transparent = true;
        matParams.opacity = 0.85;
      }

      const material = new THREE.MeshStandardMaterial(matParams);

      geometry.computeBoundingBox();
      geometry.computeBoundingSphere();

      const threeMesh = new THREE.Mesh(geometry, material);
      threeMesh.name = (typeof mesh.name === 'function' ? mesh.name() : `mesh_${idx}`) || `part_${idx}`;
      threeMesh.castShadow = true;
      threeMesh.receiveShadow = true;
      threeMesh.frustumCulled = false;

      group.add(threeMesh);
      threeMeshes.push(threeMesh);
    } catch (meshErr) {
      console.warn('Error converting individual OSM2World mesh:', meshErr);
    }
  });

  return { group, meshes: threeMeshes };
}

/**
 * Generate 3D building geometry using OSM2World from full OSM Overpass JSON.
 */
export async function generate3DBuildingOSM2World(
  osmData: OSMDataResponse,
  options?: { targetElementId?: string | number }
): Promise<OSM2WorldResult | null> {
  if (!osmData || !Array.isArray(osmData.elements) || osmData.elements.length === 0) {
    return null;
  }

  const converter = await getOSM2WorldConverter();
  if (!converter) return null;

  return new Promise((resolve) => {
    const convertOptions: any = {};
    if (options?.targetElementId) {
      convertOptions.filterIds = [String(options.targetElementId)];
    }

    try {
      // 1. Filter out unrelated buildings to avoid massive neighborhood complexes taking over the camera
      let filteredData = { ...osmData };
      if (options?.targetElementId && String(options.targetElementId) !== 'osm/auto') {
        const targetId = String(options.targetElementId);
        // Find the target element
        const targetEl = osmData.elements.find((el) => {
          if (targetId.includes('/')) {
            const [type, idStr] = targetId.split('/');
            return el.type === type && String(el.id) === idStr;
          }
          return String(el.id) === targetId;
        });
        
        if (targetEl) {
          // Keep target element and its parts/members, plus any node references
          const allowedIds = new Set<string>();
          allowedIds.add(`${targetEl.type}/${targetEl.id}`);
          
          const isRelation = targetEl.type === 'relation';
          if (isRelation && targetEl.members) {
             targetEl.members.forEach((m: any) => allowedIds.add(`${m.type}/${m.ref}`));
          }
          
          osmData.elements.forEach(el => {
            if (el.tags && (el.tags['building:part'] || el.tags['building'] === 'part')) {
              allowedIds.add(`${el.type}/${el.id}`);
            }
          });

          // Build filtered elements
          const filteredElements = osmData.elements.filter(el => {
             // Let nodes through as they are used by ways
             if (el.type === 'node') return true; 
             if (allowedIds.has(`${el.type}/${el.id}`)) return true;
             // Reject other buildings
             if (el.tags && el.tags['building'] && el.tags['building'] !== 'no') {
               return false;
             }
             return true; 
          });
          filteredData = { ...osmData, elements: filteredElements };
        }
      } else {
        // If no target ID, try to find the main building and strip other named standalone buildings
        const filteredElements = osmData.elements.filter(el => {
          if (el.type === 'node') return true;
          if (el.tags && el.tags['building:part']) return true;
          // Filter out explicitly named foreign buildings that aren't parts
          if (el.tags && el.tags['building'] && el.tags['name']) {
             // Keep it if it has no name, but strip if it has a foreign name
             return false;
          }
          return true;
        });
        filteredData = { ...osmData, elements: filteredElements };
      }

      converter.convertJson(
        JSON.stringify(filteredData),
        (rawMeshes: any[]) => {
          if (!rawMeshes || rawMeshes.length === 0) {
            console.warn('[OSM2World] Converter returned 0 meshes');
            resolve(null);
            return;
          }

          const { group, meshes } = convertO2WMeshesToThree(rawMeshes);
          if (meshes.length === 0) {
            resolve(null);
            return;
          }

          // Compute bounding box & center model
          const bbox = new THREE.Box3().setFromObject(group);
          const center = bbox.getCenter(new THREE.Vector3());

          // Offset geometry to center at (0, 0, 0) locally and rest on ground (Y=0)
          group.position.set(-center.x, -bbox.min.y, -center.z);

          // Extract unique roofs and building parts from OSM data
          const roofShapes: string[] = [];
          let buildingPartsCount = 0;

          osmData.elements.forEach((el) => {
            if (el.tags) {
              if (el.tags['building:part'] || el.tags['building'] === 'part') {
                buildingPartsCount++;
              }
              if (el.tags['roof:shape']) {
                roofShapes.push(el.tags['roof:shape']);
              }
            }
          });

          if (buildingPartsCount === 0) {
            buildingPartsCount = osmData.elements.filter((e) => e.tags && e.tags['building']).length;
          }

          const result: OSM2WorldResult = {
            group,
            meshes,
            meshCount: meshes.length,
            buildingPartsCount,
            roofShapes: Array.from(new Set(roofShapes)),
            bounds: bbox,
            source: 'OSM2World',
          };

          resolve(result);
        },
        (error: any) => {
          console.warn('⚠️ [OSM2World] convertJson error:', error);
          resolve(null);
        },
        convertOptions
      );
    } catch (err) {
      console.warn('⚠️ [OSM2World] Exception during conversion:', err);
      resolve(null);
    }
  });
}
