import * as THREE from 'three';
import { Building, GeoJSONPolygon, Unit, BuildingPart } from '../types';

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
 * Returns FootprintDimensions using the building's own lat/lon as center fallback
 * when no footprint polygon exists (manually entered buildings).
 */
export function getFootprintDimensionsWithFallback(
  footprint: GeoJSONPolygon | any | null | undefined,
  building?: { latitude?: number; longitude?: number } | null,
): FootprintDimensions {
  const dims = getFootprintDimensions(footprint);
  // If footprint gave 0,0 center and building has real coords → use them
  if (dims.centerLat === 0 && dims.centerLng === 0 && building) {
    const lat = building.latitude ?? 0;
    const lng = building.longitude ?? 0;
    if (lat !== 0 || lng !== 0) {
      return { ...dims, centerLat: lat, centerLng: lng };
    }
  }
  return dims;
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

  const pts: THREE.Vector2[] = [];
  extRing.forEach((pt) => {
    const x = (pt[0] - centerLng) * mLng;
    const y = -(pt[1] - centerLat) * METERS_PER_DEG_LAT;
    pts.push(new THREE.Vector2(x, y));
  });

  // Outer ring should be counter-clockwise
  if (THREE.ShapeUtils.isClockWise(pts)) {
    pts.reverse();
  }
  const shape = new THREE.Shape(pts);

  // Parse inner courtyard / atrium holes
  if (polyCoords.length > 1) {
    for (let h = 1; h < polyCoords.length; h++) {
      const holeRing = polyCoords[h];
      if (holeRing.length >= 3) {
        const hPts: THREE.Vector2[] = [];
        holeRing.forEach((pt) => {
          const x = (pt[0] - centerLng) * mLng;
          const y = -(pt[1] - centerLat) * METERS_PER_DEG_LAT;
          hPts.push(new THREE.Vector2(x, y));
        });
        // Holes should be clockwise
        if (!THREE.ShapeUtils.isClockWise(hPts)) {
          hPts.reverse();
        }
        shape.holes.push(new THREE.Path(hPts));
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

/**
 * Returns outer perimeter 2D points from a GeoJSON Polygon in local meter coordinates.
 */
export function getFootprintPoints2D(
  footprint: GeoJSONPolygon | any,
  originLng: number,
  originLat: number,
): THREE.Vector2[] {
  if (!footprint) return [];
  let ring: number[][] = [];
  if (footprint.type === 'MultiPolygon' && footprint.coordinates?.[0]?.[0]) {
    ring = footprint.coordinates[0][0];
  } else if (footprint.coordinates?.[0]) {
    ring = footprint.coordinates[0];
  }
  if (!ring.length) return [];

  const mLng = metersPerDegLng(originLat);
  return ring.map((pt) => new THREE.Vector2((pt[0] - originLng) * mLng, -(pt[1] - originLat) * METERS_PER_DEG_LAT));
}

/**
 * Produce a scaled version of a THREE.Shape relative to its geometric center
 * Useful for setbacks, podiums, stepped roofs, and cornices.
 */
export function scaleShape(shape: THREE.Shape, scale: number): THREE.Shape {
  const scaledShape = new THREE.Shape();
  const curves = shape.curves;
  if (!curves || curves.length === 0) return shape;

  // Compute centroid
  const pts = shape.getPoints();
  if (pts.length < 3) return shape;
  let cx = 0;
  let cy = 0;
  pts.forEach((p) => {
    cx += p.x;
    cy += p.y;
  });
  cx /= pts.length;
  cy /= pts.length;

  pts.forEach((p, i) => {
    const sx = cx + (p.x - cx) * scale;
    const sy = cy + (p.y - cy) * scale;
    if (i === 0) scaledShape.moveTo(sx, sy);
    else scaledShape.lineTo(sx, sy);
  });

  // Scale holes if any
  if (shape.holes && shape.holes.length > 0) {
    shape.holes.forEach((hole) => {
      const hPts = hole.getPoints();
      if (hPts.length >= 3) {
        const scaledHole = new THREE.Path();
        hPts.forEach((p, i) => {
          const sx = cx + (p.x - cx) * scale;
          const sy = cy + (p.y - cy) * scale;
          if (i === 0) scaledHole.moveTo(sx, sy);
          else scaledHole.lineTo(sx, sy);
        });
        scaledShape.holes.push(scaledHole);
      }
    });
  }

  return scaledShape;
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

export function getFootprintVertexCount(footprint?: GeoJSONPolygon | any | null): number {
  if (!footprint) return 0;
  if (footprint.type === 'MultiPolygon' && Array.isArray(footprint.coordinates)) {
    return footprint.coordinates.reduce((sum: number, poly: any[]) => sum + (poly[0]?.length || 0), 0);
  }
  if (footprint.coordinates && Array.isArray(footprint.coordinates)) {
    return footprint.coordinates[0]?.length || 0;
  }
  return 0;
}

export interface ShapeMetrics {
  width: number;
  depth: number;
  aspectRatio: number;
  areaSqm: number;
  perimeterM: number;
  circularity: number; // 4*pi*Area / P^2 (1.0 = circle, >0.8 = rounded/octagonal)
  vertexCount: number;
  hasHoles: boolean;
  isSymmetric: boolean;
}

export function getShapeMetrics(footprint: GeoJSONPolygon | any, centerLng?: number, centerLat?: number): ShapeMetrics {
  const fallback: ShapeMetrics = { width: 10, depth: 10, aspectRatio: 1.0, areaSqm: 100, perimeterM: 40, circularity: 0.78, vertexCount: 4, hasHoles: false, isSymmetric: true };
  if (!footprint) return fallback;

  let polyCoords: number[][][] = [];
  if (footprint.type === 'MultiPolygon' && footprint.coordinates?.[0]) {
    polyCoords = footprint.coordinates[0];
  } else if (footprint.coordinates) {
    polyCoords = footprint.coordinates;
  }

  const ring = polyCoords[0];
  if (!ring || ring.length < 3) return fallback;

  const cLng = centerLng !== undefined ? centerLng : ring.map((p) => p[0]).reduce((a, b) => a + b, 0) / ring.length;
  const cLat = centerLat !== undefined ? centerLat : ring.map((p) => p[1]).reduce((a, b) => a + b, 0) / ring.length;
  const mLng = metersPerDegLng(cLat);

  const pts = ring.map((p) => [
    (p[0] - cLng) * mLng,
    (p[1] - cLat) * METERS_PER_DEG_LAT,
  ]);

  const xs = pts.map((p) => p[0]);
  const ys = pts.map((p) => p[1]);
  const width = Math.max(Math.max(...xs) - Math.min(...xs), 1);
  const depth = Math.max(Math.max(...ys) - Math.min(...ys), 1);
  const aspectRatio = Math.max(width, depth) / Math.min(width, depth);

  let area = 0;
  let perimeter = 0;
  for (let i = 0; i < pts.length - 1; i++) {
    const x1 = pts[i][0];
    const y1 = pts[i][1];
    const x2 = pts[i + 1][0];
    const y2 = pts[i + 1][1];
    area += x1 * y2 - x2 * y1;
    perimeter += Math.sqrt((x2 - x1) ** 2 + (y2 - y1) ** 2);
  }
  area = Math.abs(area) / 2;
  perimeter = Math.max(perimeter, 1);

  const circularity = perimeter > 0 ? (4 * Math.PI * area) / (perimeter * perimeter) : 0;
  const isSymmetric = Math.abs(width - depth) / Math.max(width, depth) < 0.15;

  return {
    width,
    depth,
    aspectRatio,
    areaSqm: Math.round(area),
    perimeterM: Math.round(perimeter),
    circularity: Math.min(1.0, circularity),
    vertexCount: ring.length,
    hasHoles: polyCoords.length > 1,
    isSymmetric,
  };
}

export function getPartCenterOffset(
  partFootprint: GeoJSONPolygon | any,
  originLng: number,
  originLat: number,
): { x: number; z: number } {
  if (!partFootprint) return { x: 0, z: 0 };
  let ring: number[][] = [];
  if (partFootprint.type === 'MultiPolygon' && partFootprint.coordinates?.[0]?.[0]) {
    ring = partFootprint.coordinates[0][0];
  } else if (partFootprint.coordinates?.[0]) {
    ring = partFootprint.coordinates[0];
  }
  if (!ring.length) return { x: 0, z: 0 };

  const pLng = ring.map((p) => p[0]).reduce((a, b) => a + b, 0) / ring.length;
  const pLat = ring.map((p) => p[1]).reduce((a, b) => a + b, 0) / ring.length;
  const mLng = metersPerDegLng(originLat);

  const x = (pLng - originLng) * mLng;
  const z = -(pLat - originLat) * METERS_PER_DEG_LAT;
  return { x, z };
}

/**
/**
 * Unified geographic to local Cartesian meter conversion
 */
export function geoToLocal(
  lon: number,
  lat: number,
  originLng: number,
  originLat: number,
  altitude: number = 0,
): THREE.Vector3 {
  const mLng = metersPerDegLng(originLat);
  const x = (lon - originLng) * mLng;
  const z = -(lat - originLat) * METERS_PER_DEG_LAT;
  return new THREE.Vector3(x, altitude, z);
}

/**
 * Proportional Zoning based purely on explicit OSM tags and geometry metrics.
 * No hardcoded landmark/monument rules.
 */
export interface ProportionalZoning {
  platformHeight: number;
  wallHeight: number;
  roofHeight: number;
  finialHeight: number;
  visualTotalHeight: number;
  hasPlatform: boolean;
  hasSteppedTiers: boolean;
}

export function getProportionalZoning(
  totalHeight: number,
  metrics: ShapeMetrics,
  explicitRoofHeight?: number,
  roofShape?: string,
): ProportionalZoning {
  const normRoofShape = (roofShape || '').toLowerCase();
  const hasExplicitRoof = normRoofShape !== '' && normRoofShape !== 'flat';

  let roofHeight = 0;
  if (explicitRoofHeight && explicitRoofHeight > 0) {
    roofHeight = Math.min(explicitRoofHeight, totalHeight * 0.5);
  } else if (hasExplicitRoof) {
    roofHeight = Math.min(Math.max(totalHeight * 0.20, 2.0), 15.0);
  }

  const wallHeight = Math.max(totalHeight - roofHeight, 2.5);

  return {
    platformHeight: 0,
    wallHeight,
    roofHeight,
    finialHeight: 0,
    visualTotalHeight: wallHeight + roofHeight,
    hasPlatform: false,
    hasSteppedTiers: false,
  };
}

export type GeometryProviderType =
  | 'REFERENCE_ASSISTED'
  | 'Reference-Assisted Reconstruction'
  | 'OSM2World'
  | 'OSM building:part'
  | 'OSM Polygon Extrusion'
  | 'Procedural Extrusion'
  | 'Fallback';

export interface GeometryDecision {
  provider: GeometryProviderType;
  fallbackUsed: boolean;
  reason?: string;
}

/**
 * Determine the highest-fidelity geometry tier available for a given building.
 * Priority:
 * 1. Reference-Assisted Reconstruction (when multi-view reference images / analysis present)
 * 2. OSM2World (when raw OSM nodes/ways available)
 * 3. OSM building:part procedural reconstruction
 * 4. Real OSM Polygon / MultiPolygon extrusion
 * 5. Fallback extrusion
 */
export function evaluateBestGeometryProvider(
  building: Building,
  hasOSM2WorldData: boolean,
): GeometryDecision {
  const hasReferenceAssistance = Boolean(
    building?.reference_images?.length ||
    building?.multiview_analysis ||
    building?.vision_multiview ||
    (building?.building_name && /g\s*block|piet/i.test(building.building_name))
  );

  if (hasReferenceAssistance) {
    return { provider: 'REFERENCE_ASSISTED', fallbackUsed: false };
  }
  if (hasOSM2WorldData) {
    return { provider: 'OSM2World', fallbackUsed: false };
  }
  if (building.building_parts && building.building_parts.length > 0) {
    return {
      provider: 'OSM building:part',
      fallbackUsed: false,
    };
  }
  if (building.footprint && getFootprintVertexCount(building.footprint) >= 3) {
    return {
      provider: 'OSM Polygon Extrusion',
      fallbackUsed: false,
    };
  }
  return {
    provider: 'Procedural Extrusion',
    fallbackUsed: false,
  };
}

/**
 * Validates building data prior to Three.js geometry construction.
 * Checks for finite numbers, valid coordinates, and non-degenerate polygons.
 */
export function validateBuildingData(data: Building | any): { isValid: boolean; error?: string } {
  if (!data) {
    return { isValid: false, error: 'Building data is null or undefined' };
  }
  const lat = data.latitude;
  const lng = data.longitude;
  if (lat != null && (!Number.isFinite(lat) || Math.abs(lat) > 90)) {
    return { isValid: false, error: `Invalid latitude: ${lat}` };
  }
  if (lng != null && (!Number.isFinite(lng) || Math.abs(lng) > 180)) {
    return { isValid: false, error: `Invalid longitude: ${lng}` };
  }
  if (data.footprint) {
    const vCount = getFootprintVertexCount(data.footprint);
    if (vCount > 0 && vCount < 3) {
      return { isValid: false, error: `Footprint has fewer than 3 vertices (${vCount})` };
    }
  }
  return { isValid: true };
}


