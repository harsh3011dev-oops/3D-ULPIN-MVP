import { Building, SpatialValidation, Unit } from '../types';

/**
 * Generate a ULPIN hash matching the AI Blueprint format:
 * {PARCEL_ID}-{BLDG_SHORT}-F{FLOOR:02d}-U{UNIT_LABEL}-{GEOHASH}
 */
function simpleGeoHash(lat: number, lng: number): string {
  const chars = '0123456789bcdefghjkmnpqrstuvwxyz';
  let hash = '';
  let minLat = -90, maxLat = 90, minLng = -180, maxLng = 180;
  let even = true, bit = 0, hashBit = 0;
  while (hash.length < 7) {
    if (even) {
      const mid = (minLng + maxLng) / 2;
      if (lng >= mid) { hashBit = (hashBit << 1) | 1; minLng = mid; }
      else { hashBit = hashBit << 1; maxLng = mid; }
    } else {
      const mid = (minLat + maxLat) / 2;
      if (lat >= mid) { hashBit = (hashBit << 1) | 1; minLat = mid; }
      else { hashBit = hashBit << 1; maxLat = mid; }
    }
    even = !even;
    if (++bit === 5) { hash += chars[hashBit]; hashBit = 0; bit = 0; }
  }
  return hash;
}

/**
 * Generate ULPIN in exact AI Blueprint format:
 * {PARCEL_ID}-{BLDG_SHORT}-F{FLOOR:02d}-U{UNIT_LABEL}-{GEOHASH}
 */
function generateULPIN(parcelId: string, buildingId: string, floorNum: number, unitLabel: string, centroid: [number, number]): string {
  const bldgShort = buildingId.replace(/-/g, '').toUpperCase().substring(0, 8);
  const geoHash = simpleGeoHash(centroid[0], centroid[1]);
  const floorStr = floorNum.toString().padStart(2, '0');
  return `${parcelId}-${bldgShort}-F${floorStr}-U${unitLabel}-${geoHash}`;
}

/**
 * Dynamic volumetric 3D unit generator — matches AI Blueprint output format exactly.
 * Unit IDs: UNIT_F01_A01, UNIT_F01_B01 etc.
 * ULPINs: PARCEL_001-BLDGA1B2-F01-UA01-ttnfv1h
 */
export function generateUnitsForBounds(
  parcelId: string,
  coords: number[][],
  heightMeters: number,
  floorCount: number,
  buildingId?: string
): Unit[] {
  const lngs = coords.map(c => c[0]);
  const lats = coords.map(c => c[1]);
  const minLng = Math.min(...lngs);
  const maxLng = Math.max(...lngs);
  const minLat = Math.min(...lats);
  const maxLat = Math.max(...lats);
  const midLng = (minLng + maxLng) / 2;
  const midLat = (minLat + maxLat) / 2;

  const floorHeight = heightMeters / floorCount;
  const bId = buildingId || parcelId.toLowerCase().replace(/_/g, '-');
  const units: Unit[] = [];

  let locationName = 'Cadastral Unit';
  if (parcelId.includes('TAJMAHAL')) locationName = 'Taj Mahal Heritage Zone';
  else if (parcelId.includes('GURUGRAM')) locationName = 'Cyber City Tech Suite';
  else if (parcelId.includes('MUMBAI')) locationName = 'BKC IFSC Financial Office';
  else if (parcelId.includes('DELHI')) locationName = 'Dwarka Sector Unit';

  // 4 quadrant grid per floor (matching blueprint: cols=2, rows=2 grid)
  const quadrants = [
    { col: 'A', row: 1, label: 'A01', name: 'South-West', coords: [[minLng, minLat], [midLng, minLat], [midLng, midLat], [minLng, midLat], [minLng, minLat]], centroid: [(minLat + midLat) / 2, (minLng + midLng) / 2] },
    { col: 'A', row: 2, label: 'A02', name: 'North-West', coords: [[minLng, midLat], [midLng, midLat], [midLng, maxLat], [minLng, maxLat], [minLng, midLat]], centroid: [(midLat + maxLat) / 2, (minLng + midLng) / 2] },
    { col: 'B', row: 1, label: 'B01', name: 'South-East', coords: [[midLng, minLat], [maxLng, minLat], [maxLng, midLat], [midLng, midLat], [midLng, minLat]], centroid: [(minLat + midLat) / 2, (midLng + maxLng) / 2] },
    { col: 'B', row: 2, label: 'B02', name: 'North-East', coords: [[midLng, midLat], [maxLng, midLat], [maxLng, maxLat], [midLng, maxLat], [midLng, midLat]], centroid: [(midLat + maxLat) / 2, (midLng + maxLng) / 2] },
  ];

  for (let f = 1; f <= floorCount; f++) {
    const z_min = parseFloat(((f - 1) * floorHeight).toFixed(2));
    const z_max = parseFloat((f * floorHeight).toFixed(2));
    const floorLabel = f === 1 ? 'G' : `${f - 1}F`;

    quadrants.forEach((q) => {
      const unitLabel = q.label;
      // Blueprint UNIT ID format: UNIT_F01_A01
      const floorStr = f.toString().padStart(2, '0');
      const unit_id = `UNIT_F${floorStr}_${unitLabel}`;
      const centroid: [number, number] = [q.centroid[0], q.centroid[1]];
      const ulpin = generateULPIN(parcelId, bId, f, unitLabel, centroid);

      units.push({
        unit_id,
        ulpin,
        floor_number: f,
        unit_name: `${locationName} ${floorLabel}-${unitLabel} (${q.name})`,
        z_min,
        z_max,
        floor_height_m: parseFloat(floorHeight.toFixed(2)),
        area_sqm: parseFloat((180 + Math.random() * 60).toFixed(1)),
        centroid,
        polygon_2d: { type: "Polygon", coordinates: [q.coords] },
        status: "Registered",
        owner: parcelId.includes('TAJMAHAL')
          ? "Archaeological Survey of India (ASI)"
          : `Owner ${parcelId.substring(0, 8).replace(/_/g, '')} #${f}${unitLabel}`,
        use_type: parcelId.includes('TAJMAHAL')
          ? "Heritage Monument Zone"
          : f === 1 ? "Commercial Lobby (Ground Floor)"
          : f === floorCount ? "Penthouse Executive Suite"
          : "Commercial Office"
      });
    });
  }

  return units;
}

// Preset 1: Taj Mahal, Agra (73m — UNESCO World Heritage)
const tajMahalCoords = [
  [78.0416, 27.1746], [78.0426, 27.1746], [78.0426, 27.1756], [78.0416, 27.1756], [78.0416, 27.1746]
];
export const mockBuildingTajMahal: Building = {
  status: "success",
  building_id: "bldg-tajmahal-007",
  parcel_id: "PARCEL_777_TAJMAHAL_AGRA",
  aerial_image_url: "https://images.unsplash.com/photo-1564507592333-c60657eea523?q=80&w=1200",
  building_name: "Taj Mahal World Heritage Monument",
  address: "Dharmapuri, Forest Colony, Tajganj, Agra, Uttar Pradesh 282001",
  footprint: { type: "Polygon", coordinates: [tajMahalCoords] },
  height: 73.0,
  floor_count: 6,
  extrusion_3d: { type: "Building3D", z_min: 0.0, z_max: 73.0, floor_height_m: 12.17, floor_count: 6, volume_m3: 158340 },
  units: generateUnitsForBounds("PARCEL_777_TAJMAHAL_AGRA", tajMahalCoords, 73.0, 6, "bldg-tajmahal-007"),
  validation: { valid: true, overlaps_detected: false, overlapping_units: [], out_of_bounds: [], errors: [] },
  created_at: new Date().toISOString()
};

// Preset 2: Delhi Dwarka Sector 14 (14m — 4-floor residential)
const delhiCoords = [
  [77.0490, 28.5920], [77.0500, 28.5920], [77.0500, 28.5930], [77.0490, 28.5930], [77.0490, 28.5920]
];
export const mockBuildingDelhi: Building = {
  status: "success",
  building_id: "550e8400-e29b-41d4-a716-446655440000",
  parcel_id: "PARCEL_001_DELHI_DWARKA",
  aerial_image_url: "https://images.unsplash.com/photo-1541888946425-d0fbb186a5b7?q=80&w=1200",
  building_name: "Dwarka Sector 14 Cadastral Complex",
  address: "Plot 42, Sector 14, Dwarka, New Delhi, 110078",
  footprint: { type: "Polygon", coordinates: [delhiCoords] },
  height: 14.0,
  floor_count: 4,
  extrusion_3d: { type: "Building3D", z_min: 0.0, z_max: 14.0, floor_height_m: 3.5, floor_count: 4, volume_m3: 12544 },
  units: generateUnitsForBounds("PARCEL_001_DELHI_DWARKA", delhiCoords, 14.0, 4, "550e8400-e29b-41d4-a716-446655440000"),
  validation: { valid: true, overlaps_detected: false, overlapping_units: [], out_of_bounds: [], errors: [] },
  created_at: new Date().toISOString()
};

// Preset 3: Gurugram Cyber City (45m — 12-floor IT Tower)
const gurugramCoords = [
  [77.0880, 28.4940], [77.0900, 28.4940], [77.0900, 28.4960], [77.0880, 28.4960], [77.0880, 28.4940]
];
export const mockBuildingGurugram: Building = {
  status: "success",
  building_id: "bldg-gurugram-108",
  parcel_id: "PARCEL_108_GURUGRAM",
  aerial_image_url: "https://images.unsplash.com/photo-1486406146926-c627a92ad1ab?q=80&w=1200",
  building_name: "Cyber City IT Hub Tower 4",
  address: "DLF Cyber City, Sector 24, Gurugram, Haryana, 122002",
  footprint: { type: "Polygon", coordinates: [gurugramCoords] },
  height: 45.0,
  floor_count: 12,
  extrusion_3d: { type: "Building3D", z_min: 0.0, z_max: 45.0, floor_height_m: 3.75, floor_count: 12, volume_m3: 178200 },
  units: generateUnitsForBounds("PARCEL_108_GURUGRAM", gurugramCoords, 45.0, 12, "bldg-gurugram-108"),
  validation: { valid: true, overlaps_detected: false, overlapping_units: [], out_of_bounds: [], errors: [] },
  created_at: new Date().toISOString()
};

// Preset 4: Mumbai BKC IFSC Tower (96m approved height — 24 floors)
const mumbaiCoords = [
  [72.8680, 19.0650], [72.8700, 19.0650], [72.8700, 19.0670], [72.8680, 19.0670], [72.8680, 19.0650]
];
export const mockBuildingMumbai: Building = {
  status: "success",
  building_id: "bldg-mumbai-502",
  parcel_id: "PARCEL_502_MUMBAI",
  aerial_image_url: "https://images.unsplash.com/photo-1577495508048-b635879837f1?q=80&w=1200",
  building_name: "BKC IFSC Financial Center Tower",
  address: "G-Block, Bandra Kurla Complex, Mumbai, Maharashtra, 400051",
  footprint: { type: "Polygon", coordinates: [mumbaiCoords] },
  height: 96.0,
  floor_count: 24,
  extrusion_3d: { type: "Building3D", z_min: 0.0, z_max: 96.0, floor_height_m: 4.0, floor_count: 24, volume_m3: 768000 },
  units: generateUnitsForBounds("PARCEL_502_MUMBAI", mumbaiCoords, 96.0, 24, "bldg-mumbai-502"),
  validation: { valid: true, overlaps_detected: false, overlapping_units: [], out_of_bounds: [], errors: [] },
  created_at: new Date().toISOString()
};

export const mockBuilding = mockBuildingTajMahal;
