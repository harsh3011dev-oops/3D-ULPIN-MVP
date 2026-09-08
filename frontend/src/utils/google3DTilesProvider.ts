import { Building } from '../types';
import { getBuildingCenter, getFootprintVertexCount } from './footprintUtils';

/**
 * Google Photorealistic 3D Tiles Provider & Geometry Selection Layer
 * Provides access to Google 3D Tiles API using safe environment configuration
 * and executes priority-based fallback resolution.
 */

export type GeometryProviderType =
  | 'Google 3D Tiles'
  | 'OSM building:part'
  | 'OSM Footprint (Procedural Mass Decomposition)'
  | 'Procedural Extrusion'
  | 'Rectangular Fallback';

export type Photorealistic3DStatus =
  | 'idle'
  | 'loading'
  | 'available'
  | 'unavailable'
  | 'osm_fallback';

export interface BestGeometryResult {
  provider: GeometryProviderType;
  hasGoogle3DKey: boolean;
  google3DTilesUrl: string | null;
  buildingPartsCount: number;
  vertexCount: number;
  fallbackUsed: boolean;
  statusMessage: string;
}

/**
 * Safely extracts Google Maps API Key from Vite or Next.js environment
 */
export function getGoogleMapsApiKey(): string | null {
  try {
    // 1. Vite environment variables
    if (typeof import.meta !== 'undefined' && import.meta.env) {
      const viteKey =
        import.meta.env.VITE_GOOGLE_MAPS_API_KEY ||
        import.meta.env.VITE_GOOGLE_3D_TILES_KEY ||
        import.meta.env.VITE_GOOGLE_API_KEY;
      if (viteKey && typeof viteKey === 'string' && viteKey.trim().length > 0) {
        return viteKey.trim();
      }
    }

    // 2. Next.js / Process env fallback if present
    if (typeof process !== 'undefined' && process.env) {
      const processKey =
        process.env.NEXT_PUBLIC_GOOGLE_MAPS_API_KEY ||
        process.env.REACT_APP_GOOGLE_MAPS_API_KEY;
      if (processKey && typeof processKey === 'string' && processKey.trim().length > 0) {
        return processKey.trim();
      }
    }
  } catch {
    // Fail silently in environments where import.meta is restricted
  }
  return null;
}

/**
 * Returns whether Google 3D Tiles API Key is configured in environment
 */
export function hasGoogle3DTilesKey(): boolean {
  const key = getGoogleMapsApiKey();
  return Boolean(key && key.length > 5);
}

/**
 * Generates Google Photorealistic 3D Tiles Root Tileset URL
 */
export function getGoogle3DTilesUrl(sessionKey?: string): string | null {
  const key = sessionKey || getGoogleMapsApiKey();
  if (!key) return null;
  return `https://tile.googleapis.com/v1/3dtiles/root.json?key=${encodeURIComponent(key)}`;
}

/**
 * Priority-based Geometry Selection:
 * 1. Google Photorealistic 3D Tiles
 * 2. OSM building:part
 * 3. OSM Footprint (Procedural Mass Decomposition)
 * 4. Procedural Extrusion
 * 5. Rectangular Fallback
 */
export function getBestBuildingGeometry(
  building: Building | null,
  forceGoogleTilesIfAvailable = true,
): BestGeometryResult {
  const apiKey = getGoogleMapsApiKey();
  const hasKey = Boolean(apiKey && apiKey.length > 5);
  const tilesUrl = getGoogle3DTilesUrl(apiKey || undefined);

  const partsCount = building?.building_parts?.length || 0;
  const vertexCount = getFootprintVertexCount(building?.footprint);
  const hasFootprint = Boolean(building?.footprint && vertexCount >= 3);

  let provider: GeometryProviderType = 'Rectangular Fallback';
  let statusMessage = 'Photorealistic 3D unavailable — using procedural fallback';

  if (hasKey && forceGoogleTilesIfAvailable) {
    provider = 'Google 3D Tiles';
    statusMessage = 'Photorealistic 3D available';
  } else if (partsCount > 0) {
    provider = 'OSM building:part';
    statusMessage = 'Photorealistic 3D unavailable — using OSM building:part reconstruction';
  } else if (hasFootprint) {
    provider = 'OSM Footprint (Procedural Mass Decomposition)';
    statusMessage = 'Photorealistic 3D unavailable — using OSM footprint reconstruction';
  } else if (building?.footprint) {
    provider = 'Procedural Extrusion';
    statusMessage = 'Photorealistic 3D unavailable — using basic procedural extrusion';
  } else {
    provider = 'Rectangular Fallback';
    statusMessage = 'Photorealistic 3D unavailable — using cadastral bounding volume';
  }

  const fallbackUsed = provider === 'Rectangular Fallback';

  return {
    provider,
    hasGoogle3DKey: hasKey,
    google3DTilesUrl: tilesUrl,
    buildingPartsCount: partsCount,
    vertexCount,
    fallbackUsed,
    statusMessage,
  };
}

/**
 * Diagnostic logger as specified by requirements
 */
export function logGeometryDiagnostics(params: {
  buildingName: string;
  geometryProvider: string;
  latitude: number;
  longitude: number;
  google3DTilesLoaded: boolean;
  osmBuildingParts: number;
  proceduralFallbackUsed: boolean;
}) {
  console.log('[3D Building Pipeline Diagnostics]', {
    buildingName: params.buildingName,
    geometryProvider: params.geometryProvider,
    latitude: params.latitude,
    longitude: params.longitude,
    google3DTilesLoaded: params.google3DTilesLoaded,
    osmBuildingParts: params.osmBuildingParts,
    proceduralFallbackUsed: params.proceduralFallbackUsed,
  });
}
