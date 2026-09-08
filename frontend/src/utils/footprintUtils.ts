import * as THREE from 'three';
import { Building, GeoJSONPolygon, Unit } from '../types';

const METERS_PER_DEG_LAT = 111320;

export function metersPerDegLng(lat: number): number {
  return METERS_PER_DEG_LAT * Math.cos((lat * Math.PI) / 180);
}

export interface FootprintDimensions {
  width: number;
  depth: number;
  areaSqm: number;
  centerLat: number;
  centerLng: number;
}

export function getFootprintDimensions(footprint?: GeoJSONPolygon | any | null): FootprintDimensions {
  const fallback = { width: 30, depth: 30, areaSqm: 900, centerLat: 0, centerLng: 0 };
  if (!footprint) return fallback;

  let rings: number[][][] = [];
  if (footprint.type === 'MultiPolygon' && Array.isArray(footprint.coordinates)) {
    rings = footprint.coordinates.flatMap((poly: number[][][]) => poly);
  } else if (footprint.coordinates && Array.isArray(footprint.coordinates)) {
    rings = footprint.coordinates;
  }

  if (!rings.length || !rings[0]?.length) return fallback;

  const allPoints = rings.flatMap((r) => r);
  const lngs = allPoints.map((p) => p[0]);
  const lats = allPoints.map((p) => p[1]);
  const centerLng = lngs.reduce((a, b) => a + b, 0) / lngs.length;
  const centerLat = lats.reduce((a, b) => a + b, 0) / lats.length;
  const mLng = metersPerDegLng(centerLat);

  const xs = allPoints.map((p) => (p[0] - centerLng) * mLng);
  const zs = allPoints.map((p) => (p[1] - centerLat) * METERS_PER_DEG_LAT);

  const width = Math.max(...xs) - Math.min(...xs);
  const depth = Math.max(...zs) - Math.min(...zs);

  // Approximate polygonal area
  let areaSqm = width * depth;
  try {
    const extRing = rings[0];
    let sum = 0;
    for (let i = 0; i < extRing.length - 1; i++) {
      const x1 = (extRing[i][0] - centerLng) * mLng;
      const y1 = (extRing[i][1] - centerLat) * METERS_PER_DEG_LAT;
      const x2 = (extRing[i + 1][0] - centerLng) * mLng;
      const y2 = (extRing[i + 1][1] - centerLat) * METERS_PER_DEG_LAT;
      sum += x1 * y2 - x2 * y1;
    }
    const realArea = Math.abs(sum) / 2;
    if (realArea > 10) areaSqm = realArea;
  } catch {
    // fallback to bounding box area
  }

  return {
    width: Math.max(width, 8),
    depth: Math.max(depth, 8),
    areaSqm: Math.round(areaSqm),
    centerLat,
    centerLng,
  };
}

/**
 * Convert a GeoJSON Polygon to a THREE.Shape with full support for inner holes / courtyards.
 */
export function footprintToShape(
  footprint: GeoJSONPolygon | any,
  originLng?: number,
  originLat?: number,
): THREE.Shape | null {
  if (!footprint) return null;

  let polyCoords: number[][][] = [];
  if (footprint.type === 'MultiPolygon' && footprint.coordinates?.[0]) {
    polyCoords = footprint.coordinates[0];
  } else if (footprint.coordinates) {
    polyCoords = footprint.coordinates;
  }

  const extRing = polyCoords[0];
  if (!extRing || extRing.length < 3) return null;

  const centerLng = originLng !== undefined ? originLng : extRing.map((p) => p[0]).reduce((a, b) => a + b, 0) / extRing.length;
  const centerLat = originLat !== undefined ? originLat : extRing.map((p) => p[1]).reduce((a, b) => a + b, 0) / extRing.length;
  const mLng = metersPerDegLng(centerLat);

  const shape = new THREE.Shape();
  extRing.forEach((pt, i) => {
    const x = (pt[0] - centerLng) * mLng;
    const y = -(pt[1] - centerLat) * METERS_PER_DEG_LAT;
    if (i === 0) shape.moveTo(x, y);
    else shape.lineTo(x, y);
  });

  // Parse inner courtyard / atrium holes
  if (polyCoords.length > 1) {
    for (let h = 1; h < polyCoords.length; h++) {
      const holeRing = polyCoords[h];
      if (holeRing.length >= 3) {
        const holePath = new THREE.Path();
        holeRing.forEach((pt, i) => {
          const x = (pt[0] - centerLng) * mLng;
          const y = -(pt[1] - centerLat) * METERS_PER_DEG_LAT;
          if (i === 0) holePath.moveTo(x, y);
          else holePath.lineTo(x, y);
        });
        shape.holes.push(holePath);
      }
    }
  }

  return shape;
}

/**
 * Convert Polygon or MultiPolygon to array of THREE.Shape
 */
export function footprintToShapes(
  footprint: GeoJSONPolygon | any,
  originLng?: number,
  originLat?: number,
): THREE.Shape[] {
  if (!footprint) return [];
  if (footprint.type === 'MultiPolygon' && Array.isArray(footprint.coordinates)) {
    const shapes: THREE.Shape[] = [];
    footprint.coordinates.forEach((polyCoords: number[][][]) => {
      const singlePoly = { type: 'Polygon', coordinates: polyCoords };
      const s = footprintToShape(singlePoly, originLng, originLat);
      if (s) shapes.push(s);
    });
    return shapes;
  }
  const s = footprintToShape(footprint, originLng, originLat);
  return s ? [s] : [];
}

export function getBuildingHeight(building: Building): number {
  if (building.height_meters && building.height_meters > 0) return building.height_meters;
  if (building.height && building.height > 0) return building.height;
  return Math.max((building.floor_count || 3) * 3.5, 10.5);
}

export function getFloorHeight(building: Building): number {
  if (building.extrusion_3d?.floor_height_m) return building.extrusion_3d.floor_height_m;
  const h = getBuildingHeight(building);
  const floors = building.floor_count || 3;
  return h / floors;
}

export function getUnitFloor(unit: Unit): number {
  return unit.floor_number ?? unit.floor ?? 1;
}

export function getBuildingCenter(building: Building): { lat: number; lng: number } {
  const dims = getFootprintDimensions(building.footprint);
  if (dims.centerLat !== 0 || dims.centerLng !== 0) {
    return { lat: dims.centerLat, lng: dims.centerLng };
  }
  const firstUnit = building.units?.[0];
  if (firstUnit?.centroid?.length === 2) {
    return { lat: Number(firstUnit.centroid[0]), lng: Number(firstUnit.centroid[1]) };
  }
  return { lat: 0, lng: 0 };
}

export function getFloorCountInfo(building: Building): {
  countText: string;
  isEstimated: boolean;
  sourceText: string;
} {
  const floors = building.floor_count || 1;
  const isEstimated = building.is_floor_estimated ?? (building.floor_source?.toLowerCase().includes('estimated') || false);
  const sourceText = building.floor_source || (isEstimated ? 'Height estimation' : 'OSM building:levels');
  const countText = isEstimated ? `Estimated Floors: ${floors}` : `Floors: ${floors}`;
  return { countText, isEstimated, sourceText };
}

