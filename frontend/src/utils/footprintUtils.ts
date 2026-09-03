import * as THREE from 'three';
import { Building, GeoJSONPolygon, Unit } from '../types';

const METERS_PER_DEG_LAT = 111320;

function metersPerDegLng(lat: number): number {
  return METERS_PER_DEG_LAT * Math.cos((lat * Math.PI) / 180);
}

export interface FootprintDimensions {
  width: number;
  depth: number;
  areaSqm: number;
  centerLat: number;
  centerLng: number;
}

export function getFootprintDimensions(footprint?: GeoJSONPolygon | null): FootprintDimensions {
  const fallback = { width: 30, depth: 30, areaSqm: 900, centerLat: 0, centerLng: 0 };
  if (!footprint?.coordinates?.[0]?.length) return fallback;

  const ring = footprint.coordinates[0];
  const lngs = ring.map((p) => p[0]);
  const lats = ring.map((p) => p[1]);
  const centerLng = lngs.reduce((a, b) => a + b, 0) / lngs.length;
  const centerLat = lats.reduce((a, b) => a + b, 0) / lats.length;
  const mLng = metersPerDegLng(centerLat);

  const xs = ring.map((p) => (p[0] - centerLng) * mLng);
  const zs = ring.map((p) => (p[1] - centerLat) * METERS_PER_DEG_LAT);

  const width = Math.max(...xs) - Math.min(...xs);
  const depth = Math.max(...zs) - Math.min(...zs);

  return {
    width: Math.max(width, 8),
    depth: Math.max(depth, 8),
    areaSqm: width * depth,
    centerLat,
    centerLng,
  };
}

export function footprintToShape(footprint: GeoJSONPolygon): THREE.Shape | null {
  const ring = footprint?.coordinates?.[0];
  if (!ring || ring.length < 3) return null;

  const lngs = ring.map((p) => p[0]);
  const lats = ring.map((p) => p[1]);
  const centerLng = lngs.reduce((a, b) => a + b, 0) / lngs.length;
  const centerLat = lats.reduce((a, b) => a + b, 0) / lats.length;
  const mLng = metersPerDegLng(centerLat);

  const shape = new THREE.Shape();
  ring.forEach((pt, i) => {
    const x = (pt[0] - centerLng) * mLng;
    const y = -(pt[1] - centerLat) * METERS_PER_DEG_LAT;
    if (i === 0) shape.moveTo(x, y);
    else shape.lineTo(x, y);
  });
  return shape;
}

export function getBuildingHeight(building: Building): number {
  if (building.height_meters && building.height_meters > 0) return building.height_meters;
  if (building.height && building.height > 0) return building.height;
  return Math.max((building.floor_count || 4) * 3.5, 12);
}

export function getFloorHeight(building: Building): number {
  if (building.extrusion_3d?.floor_height_m) return building.extrusion_3d.floor_height_m;
  const h = getBuildingHeight(building);
  const floors = building.floor_count || 4;
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
