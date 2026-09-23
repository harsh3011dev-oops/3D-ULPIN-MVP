/**
 * utilityNetworkHelper.ts
 * Generates and validates subterranean 3D utility pipeline networks (Water, Sewage, Gas, Power, Telecom)
 * for both Deck.gl geospatial layers and Three.js 3D meshes.
 *
 * Implements a structured, hierarchical urban utility infrastructure:
 * 1. Municipal Arterial Trunk Ring: Stratified multi-utility corridor encircling the block.
 * 2. Dedicated Main Building Service Intakes: Clean perpendicular lateral feeders with risers into the foundation vault.
 * 3. Surrounding Buildings Distribution Grid: Orthogonal street lateral tie-ins to the municipal ring (never crossing the central parcel).
 * 4. Inspection Chambers & Meter Stations: 3D manholes at junctions and service termination points.
 */

import * as THREE from 'three';
import { Building } from '../types';
import { getBuildingCenter, getFootprintDimensions } from './footprintUtils';

export type UtilityDomainType = 'water' | 'sewage' | 'gas' | 'power' | 'telecom';

export interface UtilityPipeline {
  ulpin: string;
  type: UtilityDomainType;
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
  isTrunk?: boolean;
  buildingName?: string;
}

export interface UtilityServiceNode {
  position: [number, number, number]; // [lon, lat, -depth]
  local3D: THREE.Vector3;
  type: UtilityDomainType;
  color: [number, number, number, number];
  hexColor: number;
  buildingName: string;
  nodeType: 'manhole' | 'meter_station' | 'intake_chamber' | 'corridor_junction';
  title: string;
  ulpin: string;
  depth_m: number;
}

export const UTILITY_COLORS: Record<UtilityDomainType, { rgba: [number, number, number, number]; hex: number; hexCss: string; name: string }> = {
  telecom: {
    rgba: [192, 132, 252, 255], // Purple / Violet
    hex: 0xc084fc,
    hexCss: '#c084fc',
    name: 'Telecom (Optical Fiber)',
  },
  power: {
    rgba: [250, 204, 21, 255], // Gold / Yellow
    hex: 0xfacc15,
    hexCss: '#facc15',
    name: 'Power (11kV Grid)',
  },
  water: {
    rgba: [56, 189, 248, 255], // Sky Blue / Cyan
    hex: 0x38bdf8,
    hexCss: '#38bdf8',
    name: 'Potable Water Main',
  },
  gas: {
    rgba: [251, 146, 60, 255], // Amber / Orange
    hex: 0xfb923c,
    hexCss: '#fb923c',
    name: 'Pressurized Natural Gas',
  },
  sewage: {
    rgba: [163, 230, 53, 255], // Lime Green
    hex: 0xa3e635,
    hexCss: '#a3e635',
    name: 'Drainage & Wastewater Outfall',
  },
};

/**
 * Standard municipal utility specifications with strict vertical depth stratification
 * to ensure realistic separation without vertical collisions.
 */
export const UTILITY_DOMAIN_SPECS: Array<{
  type: UtilityDomainType;
  title: string;
  trunkTitle: string;
  serviceTitle: string;
  depth_m: number;
  diameter_mm: number;
  capacity: number;
  capacityUnit: string;
  corridorTrackOffset: number; // Lateral offset in the street trench (meters)
  pipeWidthPx: number;
}> = [
  {
    type: 'telecom',
    title: 'Metro Optical Fiber Duct (DN100mm)',
    trunkTitle: 'Municipal Optical Fiber Backbone Trunk',
    serviceTitle: 'Telecom Service Fiber Lateral',
    depth_m: 1.4,
    diameter_mm: 100,
    capacity: 40000,
    capacityUnit: 'Gbps',
    corridorTrackOffset: -2.4,
    pipeWidthPx: 3.0,
  },
  {
    type: 'power',
    title: 'Subterranean 11kV Power Feeder (DN160mm)',
    trunkTitle: 'District 11kV Primary Power Ring Main',
    serviceTitle: 'Substation 11kV Feeder Lateral',
    depth_m: 2.2,
    diameter_mm: 160,
    capacity: 5000,
    capacityUnit: 'kVA',
    corridorTrackOffset: -1.2,
    pipeWidthPx: 3.5,
  },
  {
    type: 'water',
    title: 'Potable Water Distribution Main (DN250mm)',
    trunkTitle: 'Municipal Potable Water Distribution Ring',
    serviceTitle: 'Water Distribution Lateral Feed',
    depth_m: 3.2,
    diameter_mm: 250,
    capacity: 350,
    capacityUnit: 'L/s',
    corridorTrackOffset: 0.0,
    pipeWidthPx: 4.0,
  },
  {
    type: 'gas',
    title: 'Urban High-Pressure Gas Main (DN125mm)',
    trunkTitle: 'District Pressurized Gas Loop',
    serviceTitle: 'Natural Gas Supply Service Lateral',
    depth_m: 4.2,
    diameter_mm: 125,
    capacity: 850,
    capacityUnit: 'm³/h',
    corridorTrackOffset: 1.2,
    pipeWidthPx: 3.2,
  },
  {
    type: 'sewage',
    title: 'Gravity Sanitary & Storm Drainage Outfall (DN350mm)',
    trunkTitle: 'Regional Wastewater & Storm Drainage Trunk',
    serviceTitle: 'Sanitary Sewer Gravity Discharge',
    depth_m: 5.4,
    diameter_mm: 350,
    capacity: 280,
    capacityUnit: 'L/s',
    corridorTrackOffset: 2.4,
    pipeWidthPx: 4.5,
  },
];

/**
 * Returns structured subterranean 3D utility pipelines for the primary building.
 * The building connects cleanly to the municipal utility perimeter via dedicated
 * orthogonal intake shafts with vertical risers into the foundation vault.
 */
export function getBuildingUtilityPipelines(building: Building): UtilityPipeline[] {
  const { lat: centerLat, lng: centerLng } = getBuildingCenter(building);
  const dims = getFootprintDimensions(building?.footprint);
  const halfW = Math.max(dims.width / 2, 20);
  const halfD = Math.max(dims.depth / 2, 20);

  const mToLat = 1 / 111320;
  const mToLng = 1 / (111320 * Math.max(Math.cos((centerLat * Math.PI) / 180), 0.2));

  const existingUtils: any[] = building?.underground?.utilities || [];
  const parcelPrefix = building?.parcel_id || 'PARCEL-3D';

  // Municipal corridor setback from building perimeter
  const corridorW = halfW * 1.55 + 24;
  const corridorD = halfD * 1.55 + 24;

  return UTILITY_DOMAIN_SPECS.map((spec, idx) => {
    const existing = existingUtils.find((u) => u.type === spec.type);
    const depth_m = existing?.depth_m || spec.depth_m;
    const diameter_mm = existing?.diameter_mm || spec.diameter_mm;
    const capacity = existing?.capacity || spec.capacity;
    const title = existing?.title || `${building?.building_name || 'Primary Building'} ${spec.serviceTitle}`;
    const colors = UTILITY_COLORS[spec.type];

    // Dedicated orthogonal intake routes from the municipal corridor to the building's intake manifold
    let localOffsets: [number, number, number][] = [];
    let riserFrom: THREE.Vector3;
    let riserTo: THREE.Vector3;

    switch (spec.type) {
      case 'water':
        // West Intake Port: Enters from West municipal corridor directly to building West basement manifold
        localOffsets = [
          [-corridorW, -depth_m, -halfD * 0.35],
          [-halfW * 1.1, -depth_m, -halfD * 0.35],
          [-halfW * 0.45, -depth_m, -halfD * 0.35],
        ];
        riserFrom = new THREE.Vector3(-halfW * 0.45, -depth_m, -halfD * 0.35);
        riserTo = new THREE.Vector3(-halfW * 0.45, 0.05, -halfD * 0.35);
        break;

      case 'power':
        // East Intake Port: High-voltage feed enters from East municipal corridor to building transformer room
        localOffsets = [
          [corridorW, -depth_m, halfD * 0.35],
          [halfW * 1.1, -depth_m, halfD * 0.35],
          [halfW * 0.45, -depth_m, halfD * 0.35],
        ];
        riserFrom = new THREE.Vector3(halfW * 0.45, -depth_m, halfD * 0.35);
        riserTo = new THREE.Vector3(halfW * 0.45, 0.05, halfD * 0.35);
        break;

      case 'telecom':
        // South Intake Port: Fiber trunk enters from South municipal corridor to basement server room
        localOffsets = [
          [-halfW * 0.35, -depth_m, corridorD],
          [-halfW * 0.35, -depth_m, halfD * 1.1],
          [-halfW * 0.35, -depth_m, halfD * 0.4],
        ];
        riserFrom = new THREE.Vector3(-halfW * 0.35, -depth_m, halfD * 0.4);
        riserTo = new THREE.Vector3(-halfW * 0.35, 0.05, halfD * 0.4);
        break;

      case 'gas':
        // North Intake Port: Gas feeder enters from North corridor to building boiler/utility vault
        localOffsets = [
          [halfW * 0.35, -depth_m, -corridorD],
          [halfW * 0.35, -depth_m, -halfD * 1.1],
          [halfW * 0.35, -depth_m, -halfD * 0.4],
        ];
        riserFrom = new THREE.Vector3(halfW * 0.35, -depth_m, -halfD * 0.4);
        riserTo = new THREE.Vector3(halfW * 0.35, 0.05, -halfD * 0.4);
        break;

      case 'sewage':
      default:
        // Southwest Gravity Outfall: Discharges out from building basement manifold to municipal interceptor
        localOffsets = [
          [-halfW * 0.4, -depth_m, halfD * 0.4],
          [-halfW * 1.1, -depth_m, halfD * 0.75],
          [-corridorW, -depth_m, halfD * 0.75],
        ];
        riserFrom = new THREE.Vector3(-halfW * 0.4, -depth_m, halfD * 0.4);
        riserTo = new THREE.Vector3(-halfW * 0.4, 0.05, halfD * 0.4);
        break;
    }

    const pathLocal3D = localOffsets.map(([x, y, z]) => new THREE.Vector3(x, y, z));

    const pathGeodetic: [number, number, number][] = localOffsets.map(([x, , z]) => {
      const lat = centerLat + (-z) * mToLat;
      const lng = centerLng + x * mToLng;
      return [lng, lat, depth_m];
    });

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
      riserConnections: [{ from: riserFrom, to: riserTo }],
      isTrunk: false,
      buildingName: building?.building_name || 'Primary Building',
    };
  });
}

export interface NeighborhoodUtilityNetworkResult {
  pipelines: UtilityPipeline[];
  pathLayerData: Array<{
    path: [number, number, number][];
    color: [number, number, number, number];
    width: number;
    type: UtilityDomainType;
    title: string;
    ulpin: string;
    depth_m: number;
    diameter_mm: number;
    capacity: number;
    capacityUnit: string;
    isTrunk: boolean;
    buildingName?: string;
  }>;
  serviceNodes: UtilityServiceNode[];
}

/**
 * Generates an interconnected, structured neighborhood 3D subterranean utility network:
 * 1. Municipal Arterial Ring Corridor (surrounds the parcel along perimeter street easements).
 * 2. Structured Orthogonal Building Laterals (each nearby building connects cleanly to the municipal ring,
 *    never piercing into the central building's vault).
 * 3. Inspection manholes & building meter chambers at all turns and tie-in points.
 */
export function getNeighborhoodUtilityPipelines(
  targetBuilding: Building,
  surroundingBuildings: Array<{
    id: string | number;
    name?: string;
    centroid: [number, number];
    localX: number;
    localZ: number;
    height: number;
  }>
): NeighborhoodUtilityNetworkResult {
  const { lat: centerLat, lng: centerLng } = getBuildingCenter(targetBuilding);
  const dims = getFootprintDimensions(targetBuilding?.footprint);
  const halfW = Math.max(dims.width / 2, 20);
  const halfD = Math.max(dims.depth / 2, 20);

  const mToLat = 1 / 111320;
  const mToLng = 1 / (111320 * Math.max(Math.cos((centerLat * Math.PI) / 180), 0.2));

  // Setback municipal utility corridor dimensions around the main parcel
  const corridorW = halfW * 1.55 + 24;
  const corridorD = halfD * 1.55 + 24;

  const nearby = (surroundingBuildings || []).slice(0, 36);
  const pipelines: UtilityPipeline[] = [];
  const pathLayerData: NeighborhoodUtilityNetworkResult['pathLayerData'] = [];
  const serviceNodes: UtilityServiceNode[] = [];

  const parcelPrefix = targetBuilding?.parcel_id || 'DISTRICT-CADASTRE';

  // ─────────────────────────────────────────────────────────────
  // PART 1: MUNICIPAL ARTERIAL TRUNK RING (Perimeter Utility Corridor)
  // ─────────────────────────────────────────────────────────────
  UTILITY_DOMAIN_SPECS.forEach((domain, dIdx) => {
    const colorInfo = UTILITY_COLORS[domain.type];
    const depth = domain.depth_m;
    const offset = domain.corridorTrackOffset;

    const ringW = corridorW + offset;
    const ringD = corridorD + offset;

    // 4 Corner Vertices of the Municipal Corridor Loop (Northwest, Northeast, Southeast, Southwest)
    const nw = new THREE.Vector3(-ringW, -depth, -ringD);
    const ne = new THREE.Vector3(ringW, -depth, -ringD);
    const se = new THREE.Vector3(ringW, -depth, ringD);
    const sw = new THREE.Vector3(-ringW, -depth, ringD);

    const trunkLocalPoints = [nw, ne, se, sw, nw.clone()];

    const trunkGeodetic: [number, number, number][] = trunkLocalPoints.map((vec) => {
      const lat = centerLat + (-vec.z) * mToLat;
      const lng = centerLng + vec.x * mToLng;
      return [lng, lat, -depth];
    });

    const trunkUlpin = `ULPIN-TRUNK-${domain.type.toUpperCase()}-LOOP-0${dIdx + 1}`;

    const trunkPipe: UtilityPipeline = {
      ulpin: trunkUlpin,
      type: domain.type,
      title: `${domain.trunkTitle} (DN${domain.diameter_mm}mm)`,
      depth_m: depth,
      diameter_mm: domain.diameter_mm,
      capacity: domain.capacity * 4,
      capacityUnit: domain.capacityUnit,
      color: colorInfo.rgba,
      hexColor: colorInfo.hex,
      pathGeodetic: trunkGeodetic,
      pathLocal3D: trunkLocalPoints,
      riserConnections: [],
      isTrunk: true,
      buildingName: 'Municipal Utility Easement Corridor',
    };

    pipelines.push(trunkPipe);

    pathLayerData.push({
      path: trunkGeodetic,
      color: colorInfo.rgba,
      width: domain.pipeWidthPx * 1.35, // Prominent trunk line width
      type: domain.type,
      title: trunkPipe.title,
      ulpin: trunkUlpin,
      depth_m: depth,
      diameter_mm: domain.diameter_mm,
      capacity: trunkPipe.capacity,
      capacityUnit: domain.capacityUnit,
      isTrunk: true,
      buildingName: 'Municipal Corridor',
    });

    // Place Municipal Inspection Junction Chambers (Manholes) at the 4 corridor corners
    [nw, ne, se, sw].forEach((cornerVec, cIdx) => {
      const cornerGeo: [number, number, number] = [
        centerLng + cornerVec.x * mToLng,
        centerLat + (-cornerVec.z) * mToLat,
        -depth,
      ];

      const cornerNames = ['NW', 'NE', 'SE', 'SW'];
      serviceNodes.push({
        position: cornerGeo,
        local3D: cornerVec,
        type: domain.type,
        color: colorInfo.rgba,
        hexColor: colorInfo.hex,
        buildingName: 'Municipal Utility Corridor',
        nodeType: 'corridor_junction',
        title: `${cornerNames[cIdx]} Corridor Manhole Chamber · ${domain.title}`,
        ulpin: `ULPIN-MH-${domain.type.toUpperCase()}-${cornerNames[cIdx]}`,
        depth_m: depth,
      });
    });
  });

  // ─────────────────────────────────────────────────────────────
  // PART 2: SURROUNDING BUILDINGS ORTHOGONAL SERVICE LATERALS
  // Each neighboring building connects to the nearest municipal corridor side.
  // Lines NEVER penetrate into the main building's parcel or vault.
  // ─────────────────────────────────────────────────────────────
  nearby.forEach((bld, bIdx) => {
    const bX = bld.localX;
    const bZ = bld.localZ;

    // Determine the primary utility domain assigned to this building's service connection
    const domain = UTILITY_DOMAIN_SPECS[bIdx % UTILITY_DOMAIN_SPECS.length];
    const colorInfo = UTILITY_COLORS[domain.type];
    const depth = domain.depth_m;
    const offset = domain.corridorTrackOffset;

    const ringW = corridorW + offset;
    const ringD = corridorD + offset;

    // Calculate the closest point on the municipal utility ring corridor
    // (West, East, North, or South corridor segment)
    let tieInX: number;
    let tieInZ: number;
    let pathLocal3D: THREE.Vector3[];

    const absX = Math.abs(bX);
    const absZ = Math.abs(bZ);

    if (absX >= absZ) {
      // Connect to East or West corridor segment
      tieInX = Math.sign(bX || 1) * ringW;
      // Clamp tie-in Z within the corridor span
      tieInZ = Math.max(-ringD, Math.min(ringD, bZ));

      // 90-degree orthogonal street trenching (dogleg path)
      const doglegX = tieInX + (bX - tieInX) * 0.4;

      pathLocal3D = [
        new THREE.Vector3(tieInX, -depth, tieInZ),
        new THREE.Vector3(doglegX, -depth, tieInZ),
        new THREE.Vector3(doglegX, -depth, bZ),
        new THREE.Vector3(bX, -depth, bZ),
      ];
    } else {
      // Connect to North or South corridor segment
      tieInZ = Math.sign(bZ || 1) * ringD;
      // Clamp tie-in X within the corridor span
      tieInX = Math.max(-ringW, Math.min(ringW, bX));

      // 90-degree orthogonal street trenching (dogleg path)
      const doglegZ = tieInZ + (bZ - tieInZ) * 0.4;

      pathLocal3D = [
        new THREE.Vector3(tieInX, -depth, tieInZ),
        new THREE.Vector3(tieInX, -depth, doglegZ),
        new THREE.Vector3(bX, -depth, doglegZ),
        new THREE.Vector3(bX, -depth, bZ),
      ];
    }

    const pathGeodetic: [number, number, number][] = pathLocal3D.map((vec) => {
      const lat = centerLat + (-vec.z) * mToLat;
      const lng = centerLng + vec.x * mToLng;
      return [lng, lat, -depth];
    });

    const buildingTitle = bld.name || `Parcel ${bld.id}`;
    const lateralUlpin = `ULPIN-LATERAL-${domain.type.toUpperCase()}-B${bIdx + 1}`;

    const pipeObj: UtilityPipeline = {
      ulpin: lateralUlpin,
      type: domain.type,
      title: `${domain.serviceTitle} ➔ ${buildingTitle}`,
      depth_m: depth,
      diameter_mm: domain.diameter_mm * 0.7, // Service lateral diameter is standard ratio of trunk
      capacity: domain.capacity,
      capacityUnit: domain.capacityUnit,
      color: colorInfo.rgba,
      hexColor: colorInfo.hex,
      pathGeodetic,
      pathLocal3D,
      riserConnections: [
        {
          from: new THREE.Vector3(bX, -depth, bZ),
          to: new THREE.Vector3(bX, 0.05, bZ),
        },
      ],
      isTrunk: false,
      buildingName: buildingTitle,
    };

    pipelines.push(pipeObj);

    pathLayerData.push({
      path: pathGeodetic,
      color: colorInfo.rgba,
      width: domain.pipeWidthPx,
      type: domain.type,
      title: pipeObj.title,
      ulpin: lateralUlpin,
      depth_m: depth,
      diameter_mm: Math.round(domain.diameter_mm * 0.7),
      capacity: domain.capacity,
      capacityUnit: domain.capacityUnit,
      isTrunk: false,
      buildingName: buildingTitle,
    });

    // 1. Service Intake Node / Meter Pit at Building Base
    const terminusGeodetic: [number, number, number] = [
      centerLng + bX * mToLng,
      centerLat + (-bZ) * mToLat,
      -depth,
    ];

    serviceNodes.push({
      position: terminusGeodetic,
      local3D: new THREE.Vector3(bX, -depth, bZ),
      type: domain.type,
      color: colorInfo.rgba,
      hexColor: colorInfo.hex,
      buildingName: buildingTitle,
      nodeType: 'meter_station',
      title: `${buildingTitle} · Utility Intake Station (${domain.type.toUpperCase()})`,
      ulpin: `ULPIN-METER-${domain.type.toUpperCase()}-B${bIdx + 1}`,
      depth_m: depth,
    });

    // 2. Corridor Tie-in Junction Chamber (Manhole) where lateral taps into municipal trunk
    const tieInGeodetic: [number, number, number] = [
      centerLng + tieInX * mToLng,
      centerLat + (-tieInZ) * mToLat,
      -depth,
    ];

    serviceNodes.push({
      position: tieInGeodetic,
      local3D: new THREE.Vector3(tieInX, -depth, tieInZ),
      type: domain.type,
      color: colorInfo.rgba,
      hexColor: colorInfo.hex,
      buildingName: 'Municipal Utility Easement',
      nodeType: 'manhole',
      title: `Corridor Tie-In Manhole #${bIdx + 1} (${domain.type.toUpperCase()})`,
      ulpin: `ULPIN-TIEIN-${domain.type.toUpperCase()}-B${bIdx + 1}`,
      depth_m: depth,
    });
  });

  return {
    pipelines,
    pathLayerData,
    serviceNodes,
  };
}
