/**
 * utilityNetworkHelper.ts
 * Generates and validates subterranean 3D utility pipeline networks (Water, Sewage, Gas, Power, Telecom)
 * for both Deck.gl geospatial layers and Three.js 3D meshes.
 */

import * as THREE from 'three';
import { Building } from '../types';
import { getBuildingCenter, getFootprintDimensions } from './footprintUtils';

export interface UtilityPipeline {
  ulpin: string;
  type: 'water' | 'sewage' | 'gas' | 'power' | 'telecom';
  title: string;
  depth_m: number;
  diameter_mm: number;
  capacity: number;
  capacityUnit: string;
  color: [number, number, number, number]; // Deck.gl RGBA [0-255]
  hexColor: number; // Three.js Hex
  pathGeodetic: [number, number, number][]; // [lon, lat, depth_m]
  pathLocal3D: THREE.Vector3[]; // Local Three.js coordinates
  riserConnections: { from: THREE.Vector3; to: THREE.Vector3 }[];
}

export const UTILITY_COLORS: Record<string, { rgba: [number, number, number, number]; hex: number; hexCss: string }> = {
  water: {
    rgba: [56, 189, 248, 255], // Sky Blue / Cyan
    hex: 0x38bdf8,
    hexCss: '#38bdf8',
  },
  sewage: {
    rgba: [163, 230, 53, 255], // Lime Green
    hex: 0xa3e635,
    hexCss: '#a3e635',
  },
  gas: {
    rgba: [251, 146, 60, 255], // Amber / Orange
    hex: 0xfb923c,
    hexCss: '#fb923c',
  },
  power: {
    rgba: [250, 204, 21, 255], // Gold / Yellow
    hex: 0xfacc15,
    hexCss: '#facc15',
  },
  telecom: {
    rgba: [192, 132, 252, 255], // Purple / Violet
    hex: 0xc084fc,
    hexCss: '#c084fc',
  },
};

/**
 * Returns a comprehensive list of underground 3D utility networks for a building.
 * If backend utilities exist, enriches them; otherwise, synthesizes compliant 3D network paths.
 */
export function getBuildingUtilityPipelines(building: Building): UtilityPipeline[] {
  const { lat: centerLat, lng: centerLng } = getBuildingCenter(building);
  const dims = getFootprintDimensions(building?.footprint);
  const halfW = Math.max(dims.width / 2, 18);
  const halfD = Math.max(dims.depth / 2, 18);

  // Conversion: 1 degree latitude ~ 111,320m, longitude ~ 111,320 * cos(lat)
  const mToLat = 1 / 111320;
  const mToLng = 1 / (111320 * Math.max(Math.cos((centerLat * Math.PI) / 180), 0.2));

  const existingUtils: any[] = building?.underground?.utilities || [];

  const utilitySpecs: {
    type: 'water' | 'sewage' | 'gas' | 'power' | 'telecom';
    title: string;
    depth_m: number;
    diameter_mm: number;
    capacity: number;
    capacityUnit: string;
    localOffsets: [number, number, number][]; // [x, yDepth, z] in local meters
  }[] = [
    {
      type: 'water',
      title: 'Potable Water Distribution Main (DN200mm)',
      depth_m: 2.8,
      diameter_mm: 200,
      capacity: 120,
      capacityUnit: 'L/s',
      localOffsets: [
        [-halfW * 1.55, -2.8, -halfD * 1.35],
        [-halfW * 0.45, -2.8, -halfD * 1.35],
        [halfW * 0.75, -2.8, -halfD * 1.35],
        [halfW * 1.65, -2.8, -halfD * 1.35],
      ],
    },
    {
      type: 'sewage',
      title: 'Gravity Wastewater & Drainage Outfall (DN300mm)',
      depth_m: 4.6,
      diameter_mm: 300,
      capacity: 95,
      capacityUnit: 'L/s',
      localOffsets: [
        [-halfW * 1.65, -4.6, halfD * 1.45],
        [-halfW * 0.35, -4.7, halfD * 1.45],
        [halfW * 0.85, -4.8, halfD * 1.45],
        [halfW * 1.75, -4.9, halfD * 1.45],
      ],
    },
    {
      type: 'gas',
      title: 'High-Pressure Natural Gas Pipeline (DN100mm)',
      depth_m: 3.4,
      diameter_mm: 100,
      capacity: 450,
      capacityUnit: 'm³/h',
      localOffsets: [
        [-halfW * 1.45, -3.4, -halfD * 1.65],
        [-halfW * 1.45, -3.4, 0],
        [-halfW * 1.45, -3.4, halfD * 1.65],
      ],
    },
    {
      type: 'power',
      title: 'High-Voltage 11kV Electrical Conduits (DN150mm)',
      depth_m: 1.9,
      diameter_mm: 150,
      capacity: 2500,
      capacityUnit: 'kVA',
      localOffsets: [
        [halfW * 1.5, -1.9, -halfD * 1.6],
        [halfW * 1.5, -1.9, 0],
        [halfW * 1.5, -1.9, halfD * 1.6],
      ],
    },
    {
      type: 'telecom',
      title: 'Subterranean Optical Fiber Telecom Trunk (DN80mm)',
      depth_m: 1.4,
      diameter_mm: 80,
      capacity: 10000,
      capacityUnit: 'Gbps',
      localOffsets: [
        [-halfW * 1.5, -1.4, halfD * 1.3],
        [-halfW * 0.2, -1.4, halfD * 1.65],
        [halfW * 1.2, -1.4, halfD * 1.65],
        [halfW * 1.6, -1.4, halfD * 1.3],
      ],
    },
  ];

  return utilitySpecs.map((spec, idx) => {
    const existing = existingUtils.find((u) => u.type === spec.type);
    const depth_m = existing?.depth_m || spec.depth_m;
    const diameter_mm = existing?.diameter_mm || spec.diameter_mm;
    const capacity = existing?.capacity || spec.capacity;
    const title = existing?.title || spec.title;
    const colors = UTILITY_COLORS[spec.type] || UTILITY_COLORS.water;

    // Build Local 3D Vectors
    const pathLocal3D = spec.localOffsets.map(([x, y, z]) => new THREE.Vector3(x, -depth_m, z));

    // Calculate geodetic paths [lng, lat, depth_m]
    const pathGeodetic: [number, number, number][] = spec.localOffsets.map(([x, , z]) => {
      const lat = centerLat + z * mToLat;
      const lng = centerLng + x * mToLng;
      return [lng, lat, depth_m];
    });

    // Riser connection to building foundation
    const midpoint = pathLocal3D[Math.floor(pathLocal3D.length / 2)];
    const riserConnections = [
      {
        from: midpoint.clone(),
        to: new THREE.Vector3(midpoint.x * 0.45, 0.05, midpoint.z * 0.45),
      },
    ];

    const parcelPrefix = building?.parcel_id || 'PARCEL-3D';
    const ulpin = existing?.ulpin || `${parcelPrefix}-UTIL-${spec.type.toUpperCase()}-${idx + 1}`;

    return {
      ulpin,
      type: spec.type,
      title,
      depth_m,
      diameter_mm,
      capacity,
      capacityUnit: spec.capacityUnit,
      color: colors.rgba,
      hexColor: colors.hex,
      pathGeodetic,
      pathLocal3D,
      riserConnections,
    };
  });
}
