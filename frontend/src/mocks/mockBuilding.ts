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

function generateULPIN(parcelId: string, buildingId: string, floorNum: number, unitLabel: string, centroid: [number, number]): string {
  const bldgShort = buildingId.replace(/[^a-zA-Z0-9]/g, '').toUpperCase().substring(0, 8);
  const geoHash = simpleGeoHash(centroid[0], centroid[1]);
  const floorStr = floorNum.toString().padStart(2, '0');
  return `${parcelId}-${bldgShort}-F${floorStr}-U${unitLabel}-${geoHash}`;
}

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

  const locationName = 'PIET Campus Department';

  // 4 quadrant grid per floor
  const quadrants = [
    { col: 'A', row: 1, label: 'A01', name: 'South Wing Lab', coords: [[minLng, minLat], [midLng, minLat], [midLng, midLat], [minLng, midLat], [minLng, minLat]], centroid: [(minLat + midLat) / 2, (minLng + midLng) / 2] },
    { col: 'A', row: 2, label: 'A02', name: 'North Wing Lecture Hall', coords: [[minLng, midLat], [midLng, midLat], [midLng, maxLat], [minLng, maxLat], [minLng, midLat]], centroid: [(midLat + maxLat) / 2, (minLng + midLng) / 2] },
    { col: 'B', row: 1, label: 'B01', name: 'East Wing Faculty Suite', coords: [[midLng, minLat], [maxLng, minLat], [maxLng, midLat], [midLng, midLat], [midLng, minLat]], centroid: [(minLat + midLat) / 2, (midLng + maxLng) / 2] },
    { col: 'B', row: 2, label: 'B02', name: 'West Wing Research Hub', coords: [[midLng, midLat], [maxLng, midLat], [maxLng, maxLat], [midLng, maxLat], [midLng, midLat]], centroid: [(midLat + maxLat) / 2, (midLng + maxLng) / 2] },
  ];

  for (let f = 1; f <= floorCount; f++) {
    const z_min = parseFloat(((f - 1) * floorHeight).toFixed(2));
    const z_max = parseFloat((f * floorHeight).toFixed(2));
    const floorLabel = f === 1 ? 'Ground Floor' : `Floor ${f}`;

    quadrants.forEach((q) => {
      const unitLabel = q.label;
      const floorStr = f.toString().padStart(2, '0');
      const unit_id = `UNIT_F${floorStr}_${unitLabel}`;
      const centroid: [number, number] = [q.centroid[0], q.centroid[1]];
      const ulpin = generateULPIN(parcelId, bId, f, unitLabel, centroid);

      units.push({
        unit_id,
        ulpin,
        floor_number: f,
        unit_name: `${locationName} ${floorLabel} - ${q.name}`,
        z_min,
        z_max,
        floor_height_m: parseFloat(floorHeight.toFixed(2)),
        area_sqm: parseFloat((120 + Math.random() * 40).toFixed(1)),
        centroid,
        polygon_2d: { type: "Polygon", coordinates: [q.coords] },
        status: "Verified Cadastre",
        owner: "Panipat Institute of Engineering & Technology",
        use_type: f === 1 ? "Administrative & Reception" : f === floorCount ? "Advanced AI Research Center" : "Smart Classrooms & Labs"
      });
    });
  }

  return units;
}

// ── PIET Campus Presets ────────────────────────────────────────────────────────

// 1. PIET Main Academic Block (GT Road, Panipat)
const pietAcademicCoords = [
  [76.9938, 29.2382], [76.9948, 29.2382], [76.9948, 29.2390], [76.9938, 29.2390], [76.9938, 29.2382]
];
export const mockBuildingPietAcademic: Building = {
  status: "success",
  building_id: "bldg-piet-academic",
  parcel_id: "PARCEL_PIET_ACADEMIC_01",
  aerial_image_url: "https://images.unsplash.com/photo-1562774053-701939374585?q=80&w=1200",
  building_name: "PIET Main Academic Block",
  address: "70 Milestone, GT Road, Samalkha, Panipat, Haryana 132102",
  footprint: { type: "Polygon", coordinates: [pietAcademicCoords] },
  height: 18.0,
  floor_count: 5,
  extrusion_3d: { type: "Building3D", z_min: 0.0, z_max: 18.0, floor_height_m: 3.6, floor_count: 5, volume_m3: 32400 },
  units: generateUnitsForBounds("PARCEL_PIET_ACADEMIC_01", pietAcademicCoords, 18.0, 5, "bldg-piet-academic"),
  validation: { valid: true, overlaps_detected: false, overlapping_units: [], out_of_bounds: [], errors: [] },
  created_at: new Date().toISOString()
};

// 2. PIET Tech & Engineering Labs Block
const pietEngineeringCoords = [
  [76.9949, 29.2385], [76.9959, 29.2385], [76.9959, 29.2394], [76.9949, 29.2394], [76.9949, 29.2385]
];
export const mockBuildingPietEngineering: Building = {
  status: "success",
  building_id: "bldg-piet-engineering",
  parcel_id: "PARCEL_PIET_ENGG_02",
  aerial_image_url: "https://images.unsplash.com/photo-1541888946425-d0fbb186a5b7?q=80&w=1200",
  building_name: "PIET Engineering & Robotics Hub",
  address: "Department of CSE & AI, PIET Campus, Samalkha, Panipat, Haryana",
  footprint: { type: "Polygon", coordinates: [pietEngineeringCoords] },
  height: 22.0,
  floor_count: 6,
  extrusion_3d: { type: "Building3D", z_min: 0.0, z_max: 22.0, floor_height_m: 3.66, floor_count: 6, volume_m3: 44000 },
  units: generateUnitsForBounds("PARCEL_PIET_ENGG_02", pietEngineeringCoords, 22.0, 6, "bldg-piet-engineering"),
  validation: { valid: true, overlaps_detected: false, overlapping_units: [], out_of_bounds: [], errors: [] },
  created_at: new Date().toISOString()
};

// 3. PIET Innovation & Auditorium Complex
const pietAuditoriumCoords = [
  [76.9932, 29.2375], [76.9942, 29.2375], [76.9942, 29.2381], [76.9932, 29.2381], [76.9932, 29.2375]
];
export const mockBuildingPietAuditorium: Building = {
  status: "success",
  building_id: "bldg-piet-auditorium",
  parcel_id: "PARCEL_PIET_AUDI_03",
  aerial_image_url: "https://images.unsplash.com/photo-1486406146926-c627a92ad1ab?q=80&w=1200",
  building_name: "PIET Innovation & Convention Centre",
  address: "Incubation Center, PIET Campus, Samalkha, Panipat",
  footprint: { type: "Polygon", coordinates: [pietAuditoriumCoords] },
  height: 15.0,
  floor_count: 3,
  extrusion_3d: { type: "Building3D", z_min: 0.0, z_max: 15.0, floor_height_m: 5.0, floor_count: 3, volume_m3: 37500 },
  units: generateUnitsForBounds("PARCEL_PIET_AUDI_03", pietAuditoriumCoords, 15.0, 3, "bldg-piet-auditorium"),
  validation: { valid: true, overlaps_detected: false, overlapping_units: [], out_of_bounds: [], errors: [] },
  created_at: new Date().toISOString()
};

// 4. PIET Campus Student Residency
const pietHostelCoords = [
  [76.9952, 29.2395], [76.9962, 29.2395], [76.9962, 29.2403], [76.9952, 29.2403], [76.9952, 29.2395]
];
export const mockBuildingPietHostel: Building = {
  status: "success",
  building_id: "bldg-piet-hostel",
  parcel_id: "PARCEL_PIET_HOSTEL_04",
  aerial_image_url: "https://images.unsplash.com/photo-1577495508048-b635879837f1?q=80&w=1200",
  building_name: "PIET Campus Student Residency Block",
  address: "Hostel Zone, PIET Campus, Samalkha, Panipat",
  footprint: { type: "Polygon", coordinates: [pietHostelCoords] },
  height: 28.0,
  floor_count: 8,
  extrusion_3d: { type: "Building3D", z_min: 0.0, z_max: 28.0, floor_height_m: 3.5, floor_count: 8, volume_m3: 70000 },
  units: generateUnitsForBounds("PARCEL_PIET_HOSTEL_04", pietHostelCoords, 28.0, 8, "bldg-piet-hostel"),
  validation: { valid: true, overlaps_detected: false, overlapping_units: [], out_of_bounds: [], errors: [] },
  created_at: new Date().toISOString()
};

export const PRESETS: Record<string, { building: Building }> = {
  'piet-academic': { building: mockBuildingPietAcademic },
  'piet-engineering': { building: mockBuildingPietEngineering },
  'piet-auditorium': { building: mockBuildingPietAuditorium },
  'piet-hostel': { building: mockBuildingPietHostel },
};

// Default export for initial load
export const mockBuildingTajMahal = mockBuildingPietAcademic;
export const mockBuildingDelhi = mockBuildingPietEngineering;
export const mockBuildingGurugram = mockBuildingPietAuditorium;
export const mockBuildingMumbai = mockBuildingPietHostel;
export const mockBuilding = mockBuildingPietAcademic;
