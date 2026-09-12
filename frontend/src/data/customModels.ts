/**
 * customModels.ts
 * Registry and matching engine for custom 3D architectural model assets (GLB / GLTF).
 * 
 * IMPORTANT:
 * - This configuration ONLY selects pre-built/imported model assets.
 * - It never synthesizes geometry based on building names.
 * - If no custom model exists, the pipeline continues through OSM2World / OSM fallbacks.
 */

import { Building } from '../types';

export interface CustomModelConfig {
  id: string;
  name: string;
  aliases: string[];
  lat: number;
  lon: number;
  modelUrl: string;
  scale: number;
  /** Euler rotation in radians or degrees [x, y, z] for local / scenegraph alignment */
  rotation: [number, number, number];
  groundOffset: number;
  elevation?: number;
  description?: string;
  category?: string;
  buildingType?: string;
  floorCount?: number;
  floorHeight?: number;
  calibratedHeightM?: number;
  calibratedDimensions?: { width: number; depth: number; height: number };
  attribution?: string;

  /** Renderer-specific transform overrides */
  threeTransform?: {
    scale?: number;
    rotation?: [number, number, number];
    offset?: [number, number, number];
  };
  deckTransform?: {
    scale?: number;
    orientation?: [number, number, number]; // [pitch, yaw, roll] in degrees for ScenegraphLayer
    elevation?: number;
    groundOffset?: number;
  };
}

/**
 * Shared transform metadata interface consumed by both Three.js Studio and deck.gl
 */
export interface SharedModelTransform {
  modelUrl: string;
  latitude: number;
  longitude: number;
  elevation: number;
  scale: number;
  rotationX: number;
  rotationY: number;
  rotationZ: number;
  groundOffset: number;
}

/**
 * Registered repository of high-detail architectural 3D models
 */
export const REGISTERED_CUSTOM_MODELS: CustomModelConfig[] = [
  {
    id: 'ayodhya-ram-mandir-demo',
    name: 'Ayodhya Ram Mandir',
    aliases: [
      'ram mandir',
      'ayodhya ram mandir',
      'shri ram janmabhoomi mandir',
      'ram janmabhoomi',
      'shree ram mandir',
      'ram temple',
      'ayodhya temple',
      'ram janmabhoomi temple',
    ],
    lat: 26.7956,
    lon: 82.1944,
    modelUrl: '/models/ram-mandir.glb',
    scale: 1.0,
    rotation: [0, 0, 0],
    groundOffset: 0,
    elevation: 0,
    calibratedHeightM: 49.2, // ~161 ft
    floorCount: 3,
    floorHeight: 4.8,
    category: 'Sacred Architecture / Nagara Temple',
    buildingType: 'temple',
    description: 'High-detail 3D Nagara-style architectural model of Shri Ram Janmabhoomi Mandir with multi-tiered Shikhara, Mandapas, and colonnaded ardha-mandapas.',
    attribution: 'Architectural Reference Model',
    threeTransform: {
      scale: 1.0,
      rotation: [0, 0, 0],
      offset: [0, 0, 0],
    },
    deckTransform: {
      scale: 1.0,
      orientation: [0, 0, 0],
      elevation: 0,
      groundOffset: 0,
    },
  },
];

/**
 * Calculates geodetic distance in meters using the Haversine formula
 */
function haversineDistanceMeters(lat1: number, lon1: number, lat2: number, lon2: number): number {
  const R = 6371000; // Earth radius in meters
  const dLat = ((lat2 - lat1) * Math.PI) / 180;
  const dLon = ((lon2 - lon1) * Math.PI) / 180;
  const a =
    Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.cos((lat1 * Math.PI) / 180) *
      Math.cos((lat2 * Math.PI) / 180) *
      Math.sin(dLon / 2) *
      Math.sin(dLon / 2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  return R * c;
}

/**
 * Finds a matching custom model asset for a building by URL, proximity, or alias lookup.
 * Pure asset matching — never generates geometry dynamically from building names.
 */
export function findCustomModel(
  building?: Building | null,
  searchQuery?: string,
  targetLat?: number,
  targetLon?: number
): CustomModelConfig | null {
  // 1. Direct explicit model URL on building object
  if (building && (building as any).custom_model_url) {
    const customUrl = (building as any).custom_model_url;
    const directMatch = REGISTERED_CUSTOM_MODELS.find((m) => m.modelUrl === customUrl);
    if (directMatch) return directMatch;

    // Return dynamic config for custom model URL
    return {
      id: `custom-${building.building_id || 'model'}`,
      name: building.building_name || 'Custom Architectural Model',
      aliases: [],
      lat: building.latitude || targetLat || 0,
      lon: building.longitude || targetLon || 0,
      modelUrl: customUrl,
      scale: (building as any).custom_model_scale || 1.0,
      rotation: (building as any).custom_model_rotation || [0, 0, 0],
      groundOffset: (building as any).custom_model_ground_offset || 0,
      calibratedHeightM: building.height_meters || building.height || 30,
      floorCount: building.floor_count || 3,
      floorHeight: 3.5,
    };
  }

  const query = (searchQuery || building?.building_name || building?.address || '').toLowerCase().trim();
  const bLat = building?.latitude ?? targetLat;
  const bLon = building?.longitude ?? targetLon;

  for (const model of REGISTERED_CUSTOM_MODELS) {
    // 2. Exact or alias name matching
    if (query.length > 0) {
      if (model.name.toLowerCase() === query) return model;
      if (model.id.toLowerCase() === query) return model;
      if (model.aliases.some((alias) => query.includes(alias) || alias.includes(query))) {
        return model;
      }
    }

    // 3. Geographic coordinate proximity matching (within 1.5 km of registered landmark coordinate)
    if (bLat != null && bLon != null && !isNaN(bLat) && !isNaN(bLon) && bLat !== 0 && bLon !== 0) {
      const dist = haversineDistanceMeters(bLat, bLon, model.lat, model.lon);
      if (dist < 1500) {
        return model;
      }
    }
  }

  return null;
}

/**
 * Builds the normalized shared transform metadata between deck.gl and Three.js Studio
 */
export function getSharedModelTransform(
  model: CustomModelConfig,
  overrides?: Partial<SharedModelTransform>
): SharedModelTransform {
  return {
    modelUrl: overrides?.modelUrl || model.modelUrl,
    latitude: overrides?.latitude ?? model.lat,
    longitude: overrides?.longitude ?? model.lon,
    elevation: overrides?.elevation ?? model.elevation ?? 0,
    scale: overrides?.scale ?? model.scale,
    rotationX: overrides?.rotationX ?? model.rotation[0],
    rotationY: overrides?.rotationY ?? model.rotation[1],
    rotationZ: overrides?.rotationZ ?? model.rotation[2],
    groundOffset: overrides?.groundOffset ?? model.groundOffset,
  };
}
