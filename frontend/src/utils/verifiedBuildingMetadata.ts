/**
 * verifiedBuildingMetadata.ts
 * Authoritative Registry for User-Verified and Survey-Confirmed Building Metadata
 * 
 * Provides an immutable, deterministic lookup for verified building facts (floor counts,
 * basement configurations, strata labels, and verified uses).
 * 
 * Strict Priority Order:
 * 1. User-Verified Project Metadata (this registry)
 * 2. Authoritative GIS / OSM Metadata
 * 3. Multi-View Reference Imagery Estimates
 * 4. Height-Based Inferences
 * 5. Conservative Fallback
 * 
 * Invariant: Never mutate shared global building objects. Always return immutable copies.
 */

import { Building } from '../types';

export interface VerifiedBuildingRecord {
  /** Unique key (OSM ID or canonical identifier) */
  id: string;
  name: string;
  aboveGroundFloors: number;
  basementFloors: number;
  basementUse?: string;
  basementSource?: string;
  floorLabels?: string[];
  totalLevels: number;
  strataDisplay: string;
  isUndergroundSimulated?: boolean;
  verifiedBy: string;
  verifiedDate?: string;
}

/**
 * Registry of authoritative, user-verified building facts.
 * Keyed by normalized identifier / OSM ID.
 */
export const VERIFIED_BUILDING_REGISTRY: Record<string, VerifiedBuildingRecord> = {
  // ── PIET Admin Block ──────────────────────────────────────────────────────────
  // User-verified fact: 2 above-ground storeys + 1 real basement level (Library)
  // Total vertical strata = 3 (B1 + F1 + F2)
  piet_admin_block: {
    id: 'piet_admin_block',
    name: 'PIET Admin Block',
    aboveGroundFloors: 2,
    basementFloors: 1,
    basementUse: 'Library',
    basementSource: 'Verified Project Input',
    floorLabels: ['B1', 'F1', 'F2'],
    totalLevels: 3,
    strataDisplay: 'B1 + 2F (3 Strata)',
    isUndergroundSimulated: false,
    verifiedBy: 'Project Survey',
    verifiedDate: '2026-09-12',
  },

  // ── PIET G Block ──────────────────────────────────────────────────────────────
  // User-verified fact: 5 above-ground storeys (G + 4 floors), NO basement / library
  // Total vertical strata = 5 (G + F1 + F2 + F3 + F4)
  piet_g_block: {
    id: 'piet_g_block',
    name: 'PIET G Block',
    aboveGroundFloors: 5,
    basementFloors: 0,
    floorLabels: ['G', 'F1', 'F2', 'F3', 'F4'],
    totalLevels: 5,
    strataDisplay: '5 Floors (G + 4F)',
    isUndergroundSimulated: true,
    verifiedBy: 'Project Survey',
    verifiedDate: '2026-09-12',
  },
};

/**
 * Resolves verified metadata for a given building.
 * Matches by OSM ID / Building ID first, then by normalized canonical name token.
 */
export function getVerifiedBuildingMetadata(
  building: Partial<Building> | null | undefined,
): VerifiedBuildingRecord | null {
  if (!building) return null;

  // 1. Direct Building ID / OSM ID match
  const osmId = (building.osm_id || '').toLowerCase().trim();
  const bldgId = (building.building_id || '').toLowerCase().trim();

  if (osmId && VERIFIED_BUILDING_REGISTRY[osmId]) {
    return VERIFIED_BUILDING_REGISTRY[osmId];
  }
  if (bldgId && VERIFIED_BUILDING_REGISTRY[bldgId]) {
    return VERIFIED_BUILDING_REGISTRY[bldgId];
  }

  // 2. Canonical Name & Address Token Resolution
  const name = (building.building_name || '').toLowerCase().trim();
  const address = (building.address || '').toLowerCase().trim();
  const combined = `${name} ${address} ${bldgId} ${osmId}`;

  // Check G Block first (must NOT match Admin Block)
  if (combined.includes('g block') || combined.includes('block g') || combined.includes('g-block') || combined.includes('piet_g')) {
    return VERIFIED_BUILDING_REGISTRY.piet_g_block;
  }

  if (combined.includes('admin') || combined.includes('administrative') || combined.includes('piet_admin')) {
    return VERIFIED_BUILDING_REGISTRY.piet_admin_block;
  }

  return null;
}

/**
 * Immutably merges verified metadata into a building entity.
 * Guarantees verified project metadata takes precedence over uncertain AI / OSM estimates.
 */
export function applyVerifiedBuildingMetadata(building: Building): Building {
  if (!building) return building;

  const verified = getVerifiedBuildingMetadata(building);
  if (!verified) return { ...building };

  return {
    ...building,
    floor_count: verified.aboveGroundFloors,
    basement_count: verified.basementFloors,
    basement_use: verified.basementUse,
    basement_source: verified.basementSource,
    floor_source: `Verified Project Input (${verified.verifiedBy})`,
    is_floor_estimated: false,
    underground_floors: verified.basementFloors,
    assessment: {
      ...building.assessment,
      basement_levels: verified.basementFloors,
      basement_use: verified.basementUse,
      basement_source: verified.basementSource,
    },
  };
}
