import { Building, SpatialValidation } from '../types';
import { mockUnits } from './mockUnits';

export const mockBuilding: Building = {
  status: "success",
  building_id: "550e8400-e29b-41d4-a716-446655440000",
  parcel_id: "PARCEL_001_DELHI_DWARKA",
  aerial_image_url: "https://images.unsplash.com/photo-1541888946425-d0fbb186a5b7?q=80&w=1200",
  building_name: "Dwarka Sector 14 Cadastral Complex",
  address: "Plot 42, Sector 14, Dwarka, New Delhi, 110078",
  footprint: {
    type: "Polygon",
    coordinates: [
      [
        [77.0490, 28.5920],
        [77.0500, 28.5920],
        [77.0500, 28.5930],
        [77.0490, 28.5930],
        [77.0490, 28.5920]
      ]
    ]
  },
  height: 14.0,
  floor_count: 4,
  total_units: mockUnits.length,
  units: mockUnits,
  validation: {
    valid: true,
    overlaps_detected: false,
    overlapping_units: [],
    out_of_bounds: [],
    errors: []
  },
  created_at: new Date().toISOString()
};

export const mockValidationInvalid: SpatialValidation = {
  valid: false,
  overlaps_detected: true,
  overlapping_units: [
    ["UNIT_F2_A01", "UNIT_F2_A02"]
  ],
  out_of_bounds: [
    "UNIT_F4_PH02"
  ],
  errors: [
    "Volumetric overlap detected between Unit 201 and Unit 202 on Level 2 (Elevation: +3.5m to +7.0m).",
    "Unit F4_PH02 cantilever extends 0.85m beyond official 2D plot boundary."
  ]
};
