/**
 * geometryProviders.ts
 * Universal Dynamic Geometry Provider Hierarchy
 * 
 * Provider Priority:
 * 1. CUSTOM_MODEL (Pre-registered or URL-referenced GLB / GLTF)
 * 2. OSM2WORLD (LOD 4 textured mesh generation from full OSM vector graph)
 * 3. OSM_BUILDING_PARTS (Multi-part stepped podiums, towers, domes, and roofs)
 * 4. VISION_RECONSTRUCTION (Satellite / aerial vision-assisted geometric segmentation)
 * 5. OSM_FOOTPRINT (Parametric extrusion of outer footprint)
 * 6. CONSERVATIVE_FALLBACK (Honest bounding volume)
 * 
 * STRICT RULE: Only ONE visual geometry provider is active at any time.
 */

import {
  Building,
  GeometryProviderSource,
  GeometryQualityLevel,
  ProviderReconstructionResult,
  BuildingPartData,
} from '../types';
import { OSMDataResponse, extractBuildingPartsFromOSM } from './osmFetcher';
import { generate3DBuildingOSM2World } from './osm2worldProvider';
import { generateBuildingPartsMeshes } from './buildingPartMesher';
import { findCustomModel } from '../data/customModels';
import { getBuildingCenter } from './footprintUtils';

export interface GeometryProvider {
  id: GeometryProviderSource;
  name: string;
  qualityLevel: GeometryQualityLevel;
  priority: number;
  canHandle(building: Building, osmData?: OSMDataResponse | null): boolean | Promise<boolean>;
  generate(building: Building, osmData?: OSMDataResponse | null): Promise<ProviderReconstructionResult>;
}

// ── 1. Custom Model Provider (Priority 1) ──
const customModelProvider: GeometryProvider = {
  id: 'CUSTOM_MODEL',
  name: 'Custom Architectural Model (GLB/GLTF)',
  qualityLevel: 'HIGH',
  priority: 1,
  canHandle(building) {
    const config = findCustomModel(building);
    return Boolean(config || (building as any)?.custom_model_url);
  },
  async generate(building) {
    const config = findCustomModel(building);
    const modelUrl = config?.modelUrl || (building as any)?.custom_model_url || '';
    return {
      providerName: 'CUSTOM_MODEL',
      qualityLevel: 'HIGH',
      confidence: 0.98,
      estimatedFields: [],
      buildingPartsCount: config?.floorCount || 1,
      meshCount: 1,
      roofShapes: ['architectural'],
      fallbackUsed: false,
      statusMessage: `High-detail architectural model loaded (${config?.name || 'Imported Asset'})`,
      modelUrl,
    };
  },
};

// ── 2. OSM2World Web Provider (Priority 2) ──
const osm2WorldProvider: GeometryProvider = {
  id: 'OSM2WORLD',
  name: 'OSM2World 3D Engine',
  qualityLevel: 'HIGH',
  priority: 2,
  async canHandle(building, osmData) {
    return Boolean(osmData && Array.isArray(osmData.elements) && osmData.elements.length > 0);
  },
  async generate(building, osmData) {
    if (!osmData) throw new Error('No OSM data provided for OSM2World');

    const result = await generate3DBuildingOSM2World(osmData, {
      targetElementId: building.osm_id,
    });

    if (!result || result.meshes.length === 0) {
      throw new Error('OSM2World produced 0 meshes');
    }

    return {
      providerName: 'OSM2WORLD',
      qualityLevel: 'HIGH',
      confidence: 0.92,
      estimatedFields: [],
      group: result.group,
      meshes: result.meshes,
      buildingPartsCount: result.buildingPartsCount,
      meshCount: result.meshCount,
      roofShapes: result.roofShapes,
      fallbackUsed: false,
      statusMessage: `Detailed 3D mesh generated via OSM2World (${result.meshCount} meshes)`,
    };
  },
};

// ── 3. OSM Building:Part Mesher (Priority 3) ──
const osmBuildingPartProvider: GeometryProvider = {
  id: 'OSM_BUILDING_PARTS',
  name: 'OSM building:part Reconstruction',
  qualityLevel: 'DETAILED',
  priority: 3,
  canHandle(building, osmData) {
    if (building.building_parts && building.building_parts.length > 0) return true;
    if (osmData) {
      const parts = extractBuildingPartsFromOSM(osmData);
      return parts.length > 0;
    }
    return false;
  },
  async generate(building, osmData) {
    const { lat, lng } = getBuildingCenter(building);
    const centerLat = lat !== 0 ? lat : Number(building.latitude) || 28.4942;
    const centerLng = lng !== 0 ? lng : Number(building.longitude) || 77.0886;

    let parts: BuildingPartData[] = (building.building_parts as BuildingPartData[]) || [];
    if (parts.length === 0 && osmData) {
      parts = extractBuildingPartsFromOSM(osmData, building.height_meters || building.height || 25);
    }

    if (parts.length === 0) {
      throw new Error('No building parts extracted');
    }

    const meshResult = generateBuildingPartsMeshes(parts, centerLng, centerLat);

    const estimatedFields: string[] = [];
    if (!building.height_meters && !building.height) estimatedFields.push('height');

    return {
      providerName: 'OSM_BUILDING_PARTS',
      qualityLevel: 'DETAILED',
      confidence: 0.86,
      estimatedFields,
      group: meshResult.group,
      meshes: meshResult.meshes,
      buildingPartsCount: meshResult.buildingPartsCount,
      meshCount: meshResult.meshCount,
      roofShapes: meshResult.roofShapes,
      fallbackUsed: false,
      statusMessage: `Multi-part structural reconstruction (${parts.length} building parts)`,
    };
  },
};

// ── 4. Vision Reconstruction Provider (Priority 4) ──
const visionReconstructionProvider: GeometryProvider = {
  id: 'VISION_RECONSTRUCTION',
  name: 'Satellite Vision-Assisted Reconstruction',
  qualityLevel: 'STANDARD',
  priority: 4,
  canHandle(building) {
    return Boolean(building.gemini_vision_data || building.aerial_image_url);
  },
  async generate(building) {
    const { lat, lng } = getBuildingCenter(building);
    const centerLat = lat !== 0 ? lat : Number(building.latitude) || 28.4942;
    const centerLng = lng !== 0 ? lng : Number(building.longitude) || 77.0886;

    const visionData = building.gemini_vision_data || {};
    const roofShape = visionData.roof_shape?.value || 'flat';
    const height = building.height_meters || building.height || 22;

    const singlePart: BuildingPartData = {
      id: `vision_${building.building_id}`,
      footprint: building.footprint,
      height,
      min_height: 0,
      roof_shape: roofShape,
      roof_height: roofShape !== 'flat' ? Math.min(height * 0.25, 6) : 0,
      material: visionData.dominant_material?.value,
      color: visionData.dominant_color?.value,
      source: 'Vision assisted estimation',
    };

    const meshResult = generateBuildingPartsMeshes([singlePart], centerLng, centerLat);

    return {
      providerName: 'VISION_RECONSTRUCTION',
      qualityLevel: 'STANDARD',
      confidence: 0.74,
      estimatedFields: ['roof_shape', 'height'],
      group: meshResult.group,
      meshes: meshResult.meshes,
      buildingPartsCount: 1,
      meshCount: meshResult.meshCount,
      roofShapes: [roofShape],
      fallbackUsed: false,
      statusMessage: 'Vision-assisted structural segmentation and material estimation',
    };
  },
};

// ── 5. Footprint Extrusion Provider (Priority 5) ──
const footprintExtrusionProvider: GeometryProvider = {
  id: 'OSM_FOOTPRINT',
  name: 'OSM Footprint Parametric Extrusion',
  qualityLevel: 'BASIC',
  priority: 5,
  canHandle(building) {
    return Boolean(building.footprint);
  },
  async generate(building) {
    const { lat, lng } = getBuildingCenter(building);
    const centerLat = lat !== 0 ? lat : Number(building.latitude) || 28.4942;
    const centerLng = lng !== 0 ? lng : Number(building.longitude) || 77.0886;

    const height = building.height_meters || building.height || (building.floor_count ? building.floor_count * 3.5 : 20);

    const singlePart: BuildingPartData = {
      id: `footprint_${building.building_id}`,
      footprint: building.footprint,
      height,
      min_height: 0,
      roof_shape: building.roof?.shape || 'flat',
      material: building.building_material,
      color: building.building_color,
      source: 'OSM footprint extrusion',
    };

    const meshResult = generateBuildingPartsMeshes([singlePart], centerLng, centerLat);

    return {
      providerName: 'OSM_FOOTPRINT',
      qualityLevel: 'BASIC',
      confidence: 0.60,
      estimatedFields: ['height', 'roof'],
      group: meshResult.group,
      meshes: meshResult.meshes,
      buildingPartsCount: 1,
      meshCount: meshResult.meshCount,
      roofShapes: [building.roof?.shape || 'flat'],
      fallbackUsed: true,
      statusMessage: 'Basic parametric footprint extrusion',
    };
  },
};

// ── 6. Conservative Fallback Provider (Priority 6) ──
const conservativeFallbackProvider: GeometryProvider = {
  id: 'CONSERVATIVE_FALLBACK',
  name: 'Conservative Cadastral Bounding Volume',
  qualityLevel: 'ESTIMATED',
  priority: 6,
  canHandle() {
    return true; // Universal fallback
  },
  async generate(building) {
    const { lat, lng } = getBuildingCenter(building);
    const centerLat = lat !== 0 ? lat : Number(building.latitude) || 28.4942;
    const centerLng = lng !== 0 ? lng : Number(building.longitude) || 77.0886;

    const r = 0.00015;
    const fallbackFootprint = {
      type: 'Polygon',
      coordinates: [[
        [centerLng - r, centerLat - r],
        [centerLng + r, centerLat - r],
        [centerLng + r, centerLat + r],
        [centerLng - r, centerLat + r],
        [centerLng - r, centerLat - r],
      ]],
    };

    const height = building.height_meters || building.height || 18;
    const singlePart: BuildingPartData = {
      id: `fallback_${building.building_id}`,
      footprint: fallbackFootprint,
      height,
      min_height: 0,
      roof_shape: 'flat',
      source: 'Cadastral bounding volume',
    };

    const meshResult = generateBuildingPartsMeshes([singlePart], centerLng, centerLat);

    return {
      providerName: 'CONSERVATIVE_FALLBACK',
      qualityLevel: 'ESTIMATED',
      confidence: 0.40,
      estimatedFields: ['footprint', 'height', 'roof'],
      group: meshResult.group,
      meshes: meshResult.meshes,
      buildingPartsCount: 1,
      meshCount: meshResult.meshCount,
      roofShapes: ['flat'],
      fallbackUsed: true,
      statusMessage: 'Estimated cadastral bounding volume',
    };
  },
};

export const REGISTERED_PROVIDERS: GeometryProvider[] = [
  customModelProvider,
  osm2WorldProvider,
  osmBuildingPartProvider,
  visionReconstructionProvider,
  footprintExtrusionProvider,
  conservativeFallbackProvider,
].sort((a, b) => a.priority - b.priority);

/**
 * Executes the highest-priority viable geometry provider for a building.
 * Guaranteed to activate strictly ONE provider.
 */
export async function executeUniversalGeometryPipeline(
  building: Building,
  osmData?: OSMDataResponse | null
): Promise<ProviderReconstructionResult> {
  for (const provider of REGISTERED_PROVIDERS) {
    try {
      const can = await provider.canHandle(building, osmData);
      if (can) {
        const result = await provider.generate(building, osmData);
        if (result && (result.group || result.modelUrl)) {
          return result;
        }
      }
    } catch (err: any) {
      console.warn(`[GeometryProvider] ${provider.name} failed, falling back to next provider:`, err?.message || err);
    }
  }

  // Final fallback
  return conservativeFallbackProvider.generate(building, osmData);
}
