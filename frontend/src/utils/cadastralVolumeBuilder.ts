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
 * - floorVolumes[] (stacked transparent floor strata blocks, including below-ground B1..Bn and above-ground F1..Fn)
 * - unitVolumes[] (logical unit property subdivisions)
 * - undergroundVolumes[] (subsurface infrastructure utilities)
 */

import { Building, Unit } from '../types';
import { getBuildingCenter, getBuildingHeight, getFloorCountInfo } from './footprintUtils';
import { findCustomModel } from '../data/customModels';
import { applyVerifiedBuildingMetadata, getVerifiedBuildingMetadata } from './verifiedBuildingMetadata';

export interface FloorVolume {
  floorIndex: number;
  floorLabel: string;
  polygon: any; // GeoJSON Polygon
  zMin: number;
  zMax: number;
  sliceHeight: number;
  zBase: number;
  zCenter: number;
  isBasement?: boolean;
  useType?: string;
  source?: string;
  isEstimated?: boolean;
  confidence?: number;
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
  isBasement?: boolean;
  rawUnit?: Unit;
}

export interface CadastralVolumesResult {
  parcelBoundary: any | null;
  buildingEnvelope: any | null;
  floorVolumes: FloorVolume[];
  unitVolumes: UnitVolume[];
  undergroundVolumes: any[];
  totalFloors: number;
  basementFloors: number;
  totalStrata: number;
  totalHeightM: number;
  floorHeightM: number;
  basementDepthM: number;
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
 * 
 * Stratum Architecture:
 * - Below-Ground Strata: B1 (Basement Library / Property Cadastral Stratum: zMin = -3.5m, zMax = 0m)
 * - Above-Ground Strata: F1 (0 to 3.5m), F2 (3.5 to 7.0m), F3 (7.0 to 10.5m)
 * - Underground Infrastructure (Utilities/Pipes) remain separated as subsurface networks.
 */
export function buildCadastralVolumes(rawBuilding: Building): CadastralVolumesResult {
  const building = applyVerifiedBuildingMetadata(rawBuilding);
  const verified = getVerifiedBuildingMetadata(building);
  const customModelConfig = findCustomModel(building);
  const { lat: centerLat, lng: centerLng } = getBuildingCenter(building);
  const rawFirstUnit = building?.units?.[0];
  const mapLng = centerLng !== 0 ? centerLng : Number(rawFirstUnit?.centroid?.[1]) || 77.0886;
  const mapLat = centerLat !== 0 ? centerLat : Number(rawFirstUnit?.centroid?.[0]) || 28.4942;

  // 1. Determine Floor Count & Heights (Above-ground)
  const aboveGroundUnits = (building.units || []).filter(u => (u.floor_number ?? u.floor ?? 1) > 0);
  const aboveGroundMaxFloor = aboveGroundUnits.length > 0
    ? Math.max(...aboveGroundUnits.map(u => u.floor_number ?? u.floor ?? 1))
    : 0;

  const totalFloors = verified
    ? verified.aboveGroundFloors
    : Math.max(
        building.floor_count || 0,
        customModelConfig?.floorCount || 0,
        aboveGroundMaxFloor,
        3
      );

  const totalHeightM = Math.max(
    getBuildingHeight(building),
    customModelConfig?.calibratedHeightM || 0,
    totalFloors * (customModelConfig?.floorHeight || 3.5)
  );

  const floorHeightM = totalHeightM > 0 && totalFloors > 0
    ? totalHeightM / totalFloors
    : (customModelConfig?.floorHeight || 3.5);

  // 2. Determine Basement Strata (Cadastral Property Stratum)
  const basementFloors = verified !== null
    ? verified.basementFloors
    : (building.basement_count ?? building.assessment?.basement_levels ?? 0);

  // Conservative depth estimation when authoritative depth is not explicitly provided
  const basementDepthM = building.floor_height_m || (floorHeightM > 0 ? floorHeightM : 3.5);
  const isBasementEstimated = !building.floor_height_m;
  const basementSource = verified?.basementSource || building.basement_source || building.assessment?.basement_source || 'Authoritative Record';
  const basementUse = verified?.basementUse || building.basement_use || building.assessment?.basement_use || 'Basement';

  // 3. Base Footprint Geometry
  const baseFootprint = building.footprint || createFallbackFootprint(mapLng, mapLat);

  // 4. Generate Stacked Floor Strata Blocks (B1 + F1..Fn)
  const floorVolumes: FloorVolume[] = [];

  // 4a. Below-ground Strata: B1 (and Bn if any)
  for (let b = 1; b <= basementFloors; b++) {
    const zMin = -b * basementDepthM;
    const zMax = -(b - 1) * basementDepthM;
    const sliceHeight = zMax - zMin;

    floorVolumes.push({
      floorIndex: -b,
      floorLabel: b === 1 ? `B1 — ${basementUse}` : `B${b} Basement`,
      polygon: baseFootprint,
      zMin,
      zMax,
      sliceHeight,
      zBase: zMin,
      zCenter: (zMin + zMax) / 2,
      isBasement: true,
      useType: b === 1 ? basementUse : 'Basement Stratum',
      source: basementSource,
      isEstimated: isBasementEstimated,
      confidence: 0.95,
    });
  }

  // 4b. Above-ground Strata
  const isGBlockStyle = verified?.floorLabels && verified.floorLabels[0] === 'G';
  const FLOOR_NAMES = ['Ground Floor', 'First Floor', 'Second Floor', 'Third Floor', 'Fourth Floor'];
  for (let f = 1; f <= totalFloors; f++) {
    const zMin = (f - 1) * floorHeightM;
    const zMax = f * floorHeightM;
    const sliceHeight = zMax - zMin;
    const label = isGBlockStyle
      ? (verified?.floorLabels?.[f - 1] ? `${verified.floorLabels[f - 1]} (${FLOOR_NAMES[f - 1] || `Level ${f}`})` : `Level ${f}`)
      : `F${f}${FLOOR_NAMES[f - 1] ? ` ${FLOOR_NAMES[f - 1]}` : ''}`;

    floorVolumes.push({
      floorIndex: f,
      floorLabel: label,
      polygon: baseFootprint,
      zMin,
      zMax,
      sliceHeight,
      zBase: zMin,
      zCenter: (zMin + zMax) / 2,
      isBasement: false,
      useType: 'Academic / Administrative',
      source: verified ? 'Verified Project Input' : 'Building Survey',
      isEstimated: false,
      confidence: 0.98,
    });
  }

  // 5. Generate Unit Volumes (from database units or logical strata subdivisions)
  const unitVolumes: UnitVolume[] = [];
  const rawUnits = building.units || [];

  // Check if B1 unit is in rawUnits; if not, explicitly add B1 — Library cadastral unit
  const hasBasementUnitInDb = rawUnits.some(u => (u.floor_number ?? u.floor) < 0);

  if (!hasBasementUnitInDb && basementFloors > 0) {
    unitVolumes.push({
      unitId: `${building.building_id || 'admin'}-B1-LIB`,
      unitNumber: 'B1-LIB',
      floorNumber: -1,
      polygon: baseFootprint,
      zMin: -basementDepthM,
      zMax: 0,
      sliceHeight: basementDepthM,
      zBase: -basementDepthM,
      zCenter: -basementDepthM / 2,
      useType: basementUse,
      ulpin: `${building.building_id || 'ULPIN'}-B1-LIB-001`,
      areaSqm: 850,
      isBasement: true,
    });
  }

  if (rawUnits.length > 0) {
    rawUnits.forEach((u, idx) => {
      const floorNum = u.floor_number ?? u.floor ?? 1;
      const isBasement = floorNum < 0;
      const zMin = u.z_min ?? (isBasement ? floorNum * basementDepthM : (floorNum - 1) * floorHeightM);
      const zMax = u.z_max ?? (isBasement ? (floorNum + 1) * basementDepthM : floorNum * floorHeightM);
      const sliceHeight = zMax - zMin;

      unitVolumes.push({
        unitId: u.unit_id || `unit_${idx + 1}`,
        unitNumber: u.unit_number || (isBasement ? `B${Math.abs(floorNum)}-0${(idx % 4) + 1}` : `U-${floorNum}0${(idx % 4) + 1}`),
        floorNumber: floorNum,
        polygon: u.polygon_2d || baseFootprint,
        zMin,
        zMax,
        sliceHeight,
        zBase: zMin,
        zCenter: (zMin + zMax) / 2,
        useType: u.use_type || (isBasement ? basementUse : 'Strata Property'),
        ulpin: u.ulpin || `${building.building_id || 'ULPIN'}-F${floorNum}-0${idx + 1}`,
        areaSqm: u.area_sqm || 450,
        isBasement,
        rawUnit: u,
      });
    });
  } else {
    // Generate at least 1 logical property parcel per above-ground floor
    for (let f = 1; f <= totalFloors; f++) {
      const zMin = (f - 1) * floorHeightM;
      const zMax = f * floorHeightM;
      const sliceHeight = zMax - zMin;

      unitVolumes.push({
        unitId: `strata_unit_f${f}`,
        unitNumber: `FL-${f}01`,
        floorNumber: f,
        polygon: baseFootprint,
        zMin,
        zMax,
        sliceHeight,
        zBase: zMin,
        zCenter: (zMin + zMax) / 2,
        useType: f === 1 ? 'Ground Floor Reception & Offices' : f === 2 ? 'Faculty & Administration' : 'Dean & Directorate Offices',
        ulpin: `${building.building_id || 'ULPIN'}-F${f}-01`,
        areaSqm: 850,
        isBasement: false,
      });
    }
  }

  // 6. Parcel Boundary
  const parcelBoundary = building.parcel_boundary || baseFootprint;

  // 7. Subsurface Underground Volumes (Utilities only - distinct from cadastral basement)
  const undergroundVolumes: any[] = building.underground?.ulpin_details || [];

  return {
    parcelBoundary,
    buildingEnvelope: baseFootprint,
    floorVolumes,
    unitVolumes,
    undergroundVolumes,
    totalFloors,
    basementFloors,
    totalStrata: totalFloors + basementFloors,
    totalHeightM,
    floorHeightM,
    basementDepthM,
    centerLng: mapLng,
    centerLat: mapLat,
  };
}

