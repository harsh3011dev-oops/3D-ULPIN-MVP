import { PresetBuilding, Building, Unit } from '../types';

export const PRESET_BUILDINGS: PresetBuilding[] = [
  {
    name: 'PIET Main Academic Block',
    parcel_id: 'PARCEL_PIET_ACADEMIC_01',
    address: 'Panipat Institute of Engineering & Technology, Samalkha, Haryana',
    height_meters: 18,
    floor_count: 5,
    lat: 29.2386,
    lon: 76.9943,
  },
  {
    name: 'PIET Engineering & Robotics Hub',
    parcel_id: 'PARCEL_PIET_ENGG_02',
    address: 'Department of CSE & AI, PIET Campus, Samalkha, Panipat',
    height_meters: 22,
    floor_count: 6,
    lat: 29.2392,
    lon: 76.9948,
  },
  {
    name: 'PIET Innovation & Auditorium Complex',
    parcel_id: 'PARCEL_PIET_AUDI_03',
    address: 'Incubation Center, PIET Campus, Samalkha, Panipat',
    height_meters: 15,
    floor_count: 3,
    lat: 29.2380,
    lon: 76.9938,
  },
  {
    name: 'PIET Campus Student Residency Block',
    parcel_id: 'PARCEL_PIET_HOSTEL_04',
    address: 'Hostel Zone, PIET Campus, Samalkha, Panipat',
    height_meters: 28,
    floor_count: 8,
    lat: 29.2398,
    lon: 76.9955,
  },
];

export const MOCK_BUILDING: Building = {
  building_id: 'bldg-piet-academic',
  parcel_id: 'PARCEL_PIET_ACADEMIC_01',
  building_name: 'PIET Main Academic Block',
  address: 'Panipat Institute of Engineering & Technology, 70 Milestone, GT Road, Samalkha, Panipat, Haryana 132102',
  footprint: {
    type: 'Polygon',
    coordinates: [[
      [76.9938, 29.2382],
      [76.9948, 29.2382],
      [76.9948, 29.2390],
      [76.9938, 29.2390],
      [76.9938, 29.2382],
    ]],
  },
  height_meters: 18,
  floor_count: 5,
  total_units: 20,
  units: Array.from({ length: 20 }, (_, i) => ({
    unit_id: `UNIT_F0${Math.floor(i / 4) + 1}_${String.fromCharCode(65 + (i % 2))}${String((i % 2) + 1).padStart(2, '0')}`,
    ulpin: `PARCEL_PIET_ACADEMIC_01-BLDGPIET-F0${Math.floor(i / 4) + 1}-UA${i + 1}-geohash`,
    floor: Math.floor(i / 4) + 1,
    floor_number: Math.floor(i / 4) + 1,
    z_min: Math.floor(i / 4) * 3.6,
    z_max: (Math.floor(i / 4) + 1) * 3.6,
    centroid: [29.2386 + (i % 2) * 0.0003, 76.9943 + Math.floor(i / 4) * 0.0001],
    polygon_2d: {
      type: 'Polygon',
      coordinates: [[
        [76.9938 + (i % 2) * 0.0005, 29.2382 + Math.floor(i / 4) * 0.00015],
        [76.9943 + (i % 2) * 0.0005, 29.2382 + Math.floor(i / 4) * 0.00015],
        [76.9943 + (i % 2) * 0.0005, 29.2386 + Math.floor(i / 4) * 0.00015],
        [76.9938 + (i % 2) * 0.0005, 29.2386 + Math.floor(i / 4) * 0.00015],
        [76.9938 + (i % 2) * 0.0005, 29.2382 + Math.floor(i / 4) * 0.00015],
      ]],
    },
    area_sqft: 1200,
    area_sqm: 111.48,
  })),
};
