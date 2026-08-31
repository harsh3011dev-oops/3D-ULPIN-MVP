import { PresetBuilding, Building, Unit } from '../types';

export const PRESET_BUILDINGS: PresetBuilding[] = [
  {
    name: 'College Academic Block',
    parcel_id: 'COLLEGE_001',
    address: 'Your College Name, Delhi',
    height_meters: 45,
    floor_count: 5,
    lat: 28.5244,
    lon: 77.1996,
  },
  {
    name: 'College Hostel',
    parcel_id: 'COLLEGE_002',
    address: 'College Hostel Building, Delhi',
    height_meters: 60,
    floor_count: 10,
    lat: 28.5245,
    lon: 77.1997,
  },
  {
    name: 'Cyber Hub, Gurugram',
    parcel_id: 'CYBER_HUB_001',
    address: 'DLF Cyber City, Gurugram',
    height_meters: 70,
    floor_count: 20,
    lat: 28.4595,
    lon: 77.0872,
  },
  {
    name: 'India Gate, Delhi',
    parcel_id: 'INDIA_GATE_001',
    address: 'India Gate, New Delhi',
    height_meters: 42,
    floor_count: 8,
    lat: 28.6129,
    lon: 77.2295,
  },
];

export const MOCK_BUILDING: Building = {
  building_id: 'bldg-001',
  parcel_id: 'COLLEGE_001',
  footprint: {
    type: 'Polygon',
    coordinates: [[
      [77.1996, 28.5244],
      [77.2000, 28.5244],
      [77.2000, 28.5248],
      [77.1996, 28.5248],
      [77.1996, 28.5244],
    ]],
  },
  height_meters: 45,
  floor_count: 5,
  total_units: 80,
  units: Array.from({ length: 80 }, (_, i) => ({
    unit_id: `UNIT_F0${Math.floor(i / 16) + 1}_${String.fromCharCode(65 + (i % 4))}${String(Math.floor(i / 4) % 4).padStart(2, '0')}`,
    ulpin: `COLLEGE_001-bldg-001-F0${Math.floor(i / 16) + 1}-UA${i + 1}-geohash`,
    floor: Math.floor(i / 16) + 1,
    floor_number: Math.floor(i / 16) + 1,
    z_min: Math.floor(i / 16) * 9,
    z_max: (Math.floor(i / 16) + 1) * 9,
    centroid: [77.1996 + Math.random() * 0.0004, 28.5244 + Math.random() * 0.0004],
    polygon_2d: {
      type: 'Polygon',
      coordinates: [[
        [77.1996, 28.5244],
        [77.1998, 28.5244],
        [77.1998, 28.5246],
        [77.1996, 28.5246],
        [77.1996, 28.5244],
      ]],
    },
    area_sqft: 850,
    area_sqm: 78.96,
  })),
};
