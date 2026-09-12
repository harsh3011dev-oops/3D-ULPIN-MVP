/**
 * cadastralVolumeBuilder.ts
 * Generates transparent volumetric cadastre models for deck.gl Geospatial mode.
 * 
 * Strict Principle:
 * - Three.js Studio renders the high-detail architectural model (visualBuildingGroup).
 * - deck.gl Geospatial renders the transparent volumetric cadastral envelope (cadastralULPINGroup).
 * 
 * Converts any building/monument/landmark into:
 * - parcelBoundary
 * - buildingEnvelope
 * - floorVolumes[] (stacked transparent floor strata blocks)
 * - unitVolumes[] (logical unit property subdivisions)
 * - undergroundVolumes[] (subsurface infrastructure)
 */

import { Building, Unit } from '../types';
import { getBuildingCenter, getBuildingHeight, getFloorCountInfo } from './footprintUtils';
import { findCustomModel } from '../data/customModels';

export interface FloorVolume {
  floorIndex: number;
  floorLabel: string;
  polygon: any; // GeoJSON Polygon
  zMin: number;
  zMax: number;
  sliceHeight: number;
  zBase: number;
  zCenter: number;
}

export interface UnitVolume {
  unitId: string;
  unitNumber?: string;
  floorNumber: number;
  polygon: any;
  zMin: number;
  zMax: number;
  sliceHeight: number;
  zBase: number;
  zCenter: number;
  useType?: string;
  ulpin?: string;
  areaSqm?: number;
  rawUnit?: Unit;
}

export interface CadastralVolumesResult {
  parcelBoundary: any | null;
  buildingEnvelope: any | null;
  floorVolumes: FloorVolume[];
  unitVolumes: UnitVolume[];
  undergroundVolumes: any[];
  totalFloors: number;
  totalHeightM: number;
  floorHeightM: number;
  centerLng: number;
  centerLat: number;
}

/**
 * Creates a fallback square GeoJSON polygon around coordinates if no footprint is available
 */
function createFallbackFootprint(lng: number, lat: number, radiusDeg = 0.00025): any {
  return {
    type: 'Polygon',
    coordinates: [[
      [lng - radiusDeg, lat - radiusDeg],
      [lng + radiusDeg, lat - radiusDeg],
      [lng + radiusDeg, lat + radiusDeg],
      [lng - radiusDeg, lat + radiusDeg],
      [lng - radiusDeg, lat - radiusDeg],
    ]],
  };
}

/**
 * Builds the complete cadastral volume hierarchy for a building.
 * Guaranteed to generate stacked volumetric floor blocks and units for ANY structure.
 */
export function buildCadastralVolumes(building: Building): CadastralVolumesResult {
  const customModelConfig = findCustomModel(building);
  const { lat: centerLat, lng: centerLng } = getBuildingCenter(building);
  const rawFirstUnit = building?.units?.[0];
  const mapLng = centerLng !== 0 ? centerLng : Number(rawFirstUnit?.centroid?.[1]) || 77.0886;
  const mapLat = centerLat !== 0 ? centerLat : Number(rawFirstUnit?.centroid?.[0]) || 28.4942;

  // 1. Determine Floor Count & Heights
  const totalFloors = Math.max(
    building.floor_count || 0,
    customModelConfig?.floorCount || 0,
    building.units?.length ? Math.max(...building.units.map(u => u.floor_number ?? u.floor ?? 1)) : 0,
    1
  );

  const totalHeightM = Math.max(
    getBuildingHeight(building),
    customModelConfig?.calibratedHeightM || 0,
    totalFloors * (customModelConfig?.floorHeight || 3.5)
  );

  const floorHeightM = totalHeightM > 0 && totalFloors > 0
    ? totalHeightM / totalFloors
    : (customModelConfig?.floorHeight || 3.5);

  // 2. Base Footprint Geometry
  const baseFootprint = building.footprint || createFallbackFootprint(mapLng, mapLat);

  // 3. Generate Stacked Floor Strata Blocks
  const floorVolumes: FloorVolume[] = [];
  for (let f = 1; f <= totalFloors; f++) {
    const zMin = (f - 1) * floorHeightM;
    const zMax = f * floorHeightM;
    const sliceHeight = zMax - zMin;

    floorVolumes.push({
      floorIndex: f,
      floorLabel: `Floor ${f}`,
      polygon: baseFootprint,
      zMin,
      zMax,
      sliceHeight,
      zBase: zMin,
      zCenter: (zMin + zMax) / 2,
    });
  }

  // 4. Generate Unit Volumes (from database units or logical strata subdivisions)
  const unitVolumes: UnitVolume[] = [];
  const rawUnits = building.units || [];

  if (rawUnits.length > 0) {
    rawUnits.forEach((u, idx) => {
      const floorNum = u.floor_number ?? u.floor ?? 1;
      const zMin = u.z_min ?? (floorNum - 1) * floorHeightM;
      const zMax = u.z_max ?? floorNum * floorHeightM;
      const sliceHeight = zMax - zMin;

      unitVolumes.push({
        unitId: u.unit_id || `unit_${idx + 1}`,
        unitNumber: u.unit_number || `U-${floorNum}0${(idx % 4) + 1}`,
        floorNumber: floorNum,
        polygon: u.polygon_2d || baseFootprint,
        zMin,
        zMax,
        sliceHeight,
        zBase: zMin,
        zCenter: (zMin + zMax) / 2,
        useType: u.use_type || 'Strata Property',
        ulpin: u.ulpin,
        areaSqm: u.area_sqm,
        rawUnit: u,
      });
    });
  } else {
    // Generate at least 1 logical property parcel per floor
    floorVolumes.forEach((fv) => {
      unitVolumes.push({
        unitId: `strata_unit_f${fv.floorIndex}`,
        unitNumber: `FL-${fv.floorIndex}01`,
        floorNumber: fv.floorIndex,
        polygon: fv.polygon,
        zMin: fv.zMin,
        zMax: fv.zMax,
        sliceHeight: fv.sliceHeight,
        zBase: fv.zBase,
        zCenter: fv.zCenter,
        useType: totalFloors <= 3 ? 'Monument / Public Sanctum' : 'Cadastral Strata Unit',
        ulpin: `${building.building_id || 'ULPIN'}-F${fv.floorIndex}-01`,
        areaSqm: 450,
      });
    });
  }

  // 5. Parcel Boundary
  const parcelBoundary = building.parcel_boundary || baseFootprint;

  // 6. Subsurface Underground Volumes
  const undergroundVolumes: any[] = building.underground?.ulpin_details || [];

  return {
    parcelBoundary,
    buildingEnvelope: baseFootprint,
    floorVolumes,
    unitVolumes,
    undergroundVolumes,
    totalFloors,
    totalHeightM,
    floorHeightM,
    centerLng: mapLng,
    centerLat: mapLat,
  };
}
