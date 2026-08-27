import { Building, SpatialValidation, Unit } from '../types';

/**
 * Dynamic volumetric 3D unit generator for any GeoJSON coordinates
 */
export function generateUnitsForBounds(
  parcelId: string,
  coords: number[][],
  heightMeters: number,
  floorCount: number
): Unit[] {
  // Extract bounding box
  const lngs = coords.map(c => c[0]);
  const lats = coords.map(c => c[1]);
  const minLng = Math.min(...lngs);
  const maxLng = Math.max(...lngs);
  const minLat = Math.min(...lats);
  const maxLat = Math.max(...lats);

  const midLng = (minLng + maxLng) / 2;
  const midLat = (minLat + maxLat) / 2;

  const floorHeight = heightMeters / floorCount;
  const units: Unit[] = [];

  let locationName = 'Cadastral Unit';
  if (parcelId.includes('TAJMAHAL')) locationName = 'Taj Mahal Dome Level';
  else if (parcelId.includes('GURUGRAM')) locationName = 'Cyber City Tech Suite';
  else if (parcelId.includes('MUMBAI')) locationName = 'BKC Financial Office';
  else if (parcelId.includes('DELHI')) locationName = 'Dwarka Residential Unit';

  for (let f = 1; f <= floorCount; f++) {
    const z_min = parseFloat(((f - 1) * floorHeight).toFixed(1));
    const z_max = parseFloat((f * floorHeight).toFixed(1));

    // Quadrant 1 (SW)
    const q1Coords = [
      [minLng, minLat],
      [midLng, minLat],
      [midLng, midLat],
      [minLng, midLat],
      [minLng, minLat]
    ];
    // Quadrant 2 (NW)
    const q2Coords = [
      [minLng, midLat],
      [midLng, midLat],
      [midLng, maxLat],
      [minLng, maxLat],
      [minLng, midLat]
    ];
    // Quadrant 3 (SE)
    const q3Coords = [
      [midLng, minLat],
      [maxLng, minLat],
      [maxLng, midLat],
      [midLng, midLat],
      [midLng, minLat]
    ];
    // Quadrant 4 (NE)
    const q4Coords = [
      [midLng, midLat],
      [maxLng, midLat],
      [maxLng, maxLat],
      [midLng, maxLat],
      [midLng, midLat]
    ];

    const quads = [
      { coords: q1Coords, id: `F${f}_01`, name: `${locationName} ${f}01 (South-West)`, c: [minLat + (midLat - minLat) / 2, minLng + (midLng - minLng) / 2] },
      { coords: q2Coords, id: `F${f}_02`, name: `${locationName} ${f}02 (North-West)`, c: [midLat + (maxLat - midLat) / 2, minLng + (midLng - minLng) / 2] },
      { coords: q3Coords, id: `F${f}_03`, name: `${locationName} ${f}03 (South-East)`, c: [minLat + (midLat - minLat) / 2, midLng + (maxLng - midLng) / 2] },
      { coords: q4Coords, id: `F${f}_04`, name: `${locationName} ${f}04 (North-East)`, c: [midLat + (maxLat - midLat) / 2, midLng + (maxLng - midLng) / 2] },
    ];

    quads.forEach((q, idx) => {
      const unitHash = Math.floor(1000000 + Math.random() * 9000000);
      units.push({
        unit_id: `UNIT_${q.id}`,
        ulpin: `${parcelId}-F0${f}-U0${idx + 1}-${unitHash}`,
        floor_number: f,
        unit_name: q.name,
        z_min,
        z_max,
        floor_height_m: parseFloat(floorHeight.toFixed(1)),
        area_sqm: parseFloat((180 + Math.random() * 60).toFixed(1)),
        centroid: [q.c[0], q.c[1]],
        polygon_2d: {
          type: "Polygon",
          coordinates: [q.coords]
        },
        status: "Registered",
        owner: parcelId.includes('TAJMAHAL') ? "Archaeological Survey of India (ASI)" : `Owner ${parcelId.substring(0, 8)} #${f}${idx + 1}`,
        use_type: parcelId.includes('TAJMAHAL') ? "Heritage Monument Zone" : f === 1 ? "Commercial" : f === floorCount ? "Penthouse" : "Residential"
      });
    });
  }

  return units;
}

// Preset 1: Taj Mahal, Agra
const tajMahalCoords = [
  [78.0416, 27.1746],
  [78.0426, 27.1746],
  [78.0426, 27.1756],
  [78.0416, 27.1756],
  [78.0416, 27.1746]
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
  units: generateUnitsForBounds("PARCEL_777_TAJMAHAL_AGRA", tajMahalCoords, 73.0, 6),
  validation: { valid: true, overlaps_detected: false, overlapping_units: [], out_of_bounds: [], errors: [] },
  created_at: new Date().toISOString()
};

// Preset 2: Delhi Dwarka Sector 14
const delhiCoords = [
  [77.0490, 28.5920],
  [77.0500, 28.5920],
  [77.0500, 28.5930],
  [77.0490, 28.5930],
  [77.0490, 28.5920]
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
  units: generateUnitsForBounds("PARCEL_001_DELHI", delhiCoords, 14.0, 4),
  validation: { valid: true, overlaps_detected: false, overlapping_units: [], out_of_bounds: [], errors: [] },
  created_at: new Date().toISOString()
};

// Preset 3: Gurugram Cyber City
const gurugramCoords = [
  [77.0880, 28.4940],
  [77.0900, 28.4940],
  [77.0900, 28.4960],
  [77.0880, 28.4960],
  [77.0880, 28.4940]
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
  units: generateUnitsForBounds("PARCEL_108_GURUGRAM", gurugramCoords, 45.0, 12),
  validation: { valid: true, overlaps_detected: false, overlapping_units: [], out_of_bounds: [], errors: [] },
  created_at: new Date().toISOString()
};

// Preset 4: Mumbai BKC
const mumbaiCoords = [
  [72.8680, 19.0650],
  [72.8700, 19.0650],
  [72.8700, 19.0670],
  [72.8680, 19.0670],
  [72.8680, 19.0650]
];

export const mockBuildingMumbai: Building = {
  status: "success",
  building_id: "bldg-mumbai-502",
  parcel_id: "PARCEL_502_MUMBAI",
  aerial_image_url: "https://images.unsplash.com/photo-1577495508048-b635879837f1?q=80&w=1200",
  building_name: "BKC Financial Center Tower",
  address: "G-Block, Bandra Kurla Complex, Mumbai, Maharashtra, 400051",
  footprint: { type: "Polygon", coordinates: [mumbaiCoords] },
  height: 32.0,
  floor_count: 8,
  units: generateUnitsForBounds("PARCEL_502_MUMBAI", mumbaiCoords, 32.0, 8),
  validation: { valid: true, overlaps_detected: false, overlapping_units: [], out_of_bounds: [], errors: [] },
  created_at: new Date().toISOString()
};

export const mockBuilding = mockBuildingTajMahal;
