/**
 * Mock Units for 3D ULPIN Cadastral Visualization
 * Generated according to API_CONTRACT.md format:
 * ULPIN format: PARCEL_ID-BLDG_ID-F{floor}-U{unit}-{hash}
 */

export const mockUnits = [
  // FLOOR 1 (Ground Floor - 0.0m to 3.5m)
  {
    unit_id: "UNIT_F1_A01",
    ulpin: "PARCEL_001-BLDG_001-F01-U01-7704901",
    floor_number: 1,
    unit_name: "Flat 101 - Commercial Retail A",
    z_min: 0.0,
    z_max: 3.5,
    floor_height_m: 3.5,
    area_sqm: 142.5,
    centroid: [28.59225, 77.04925],
    polygon_2d: {
      type: "Polygon",
      coordinates: [
        [
          [77.0490, 28.5920],
          [77.0495, 28.5920],
          [77.0495, 28.5925],
          [77.0490, 28.5925],
          [77.0490, 28.5920]
        ]
      ]
    },
    status: "Registered",
    owner: "Urban Retail Ventures Pvt Ltd",
    use_type: "Commercial"
  },
  {
    unit_id: "UNIT_F1_A02",
    ulpin: "PARCEL_001-BLDG_001-F01-U02-7704902",
    floor_number: 1,
    unit_name: "Flat 102 - Commercial Retail B",
    z_min: 0.0,
    z_max: 3.5,
    floor_height_m: 3.5,
    area_sqm: 138.0,
    centroid: [28.59275, 77.04925],
    polygon_2d: {
      type: "Polygon",
      coordinates: [
        [
          [77.0490, 28.5925],
          [77.0495, 28.5925],
          [77.0495, 28.5930],
          [77.0490, 28.5930],
          [77.0490, 28.5925]
        ]
      ]
    },
    status: "Registered",
    owner: "Metro Coffee Roasters",
    use_type: "Commercial"
  },
  {
    unit_id: "UNIT_F1_B01",
    ulpin: "PARCEL_001-BLDG_001-F01-U03-7704903",
    floor_number: 1,
    unit_name: "Flat 103 - Office Suite West",
    z_min: 0.0,
    z_max: 3.5,
    floor_height_m: 3.5,
    area_sqm: 150.2,
    centroid: [28.59225, 77.04975],
    polygon_2d: {
      type: "Polygon",
      coordinates: [
        [
          [77.0495, 28.5920],
          [77.0500, 28.5920],
          [77.0500, 28.5925],
          [77.0495, 28.5925],
          [77.0495, 28.5920]
        ]
      ]
    },
    status: "Registered",
    owner: "Apex Logistics Ltd",
    use_type: "Office"
  },
  {
    unit_id: "UNIT_F1_B02",
    ulpin: "PARCEL_001-BLDG_001-F01-U04-7704904",
    floor_number: 1,
    unit_name: "Flat 104 - Entrance Lobby & Reception",
    z_min: 0.0,
    z_max: 3.5,
    floor_height_m: 3.5,
    area_sqm: 160.0,
    centroid: [28.59275, 77.04975],
    polygon_2d: {
      type: "Polygon",
      coordinates: [
        [
          [77.0495, 28.5925],
          [77.0500, 28.5925],
          [77.0500, 28.5930],
          [77.0495, 28.5930],
          [77.0495, 28.5925]
        ]
      ]
    },
    status: "Common Area",
    owner: "Building Owners Association",
    use_type: "Common Utility"
  },

  // FLOOR 2 (3.5m to 7.0m)
  {
    unit_id: "UNIT_F2_A01",
    ulpin: "PARCEL_001-BLDG_001-F02-U01-8815101",
    floor_number: 2,
    unit_name: "Flat 201 - Executive Suite A",
    z_min: 3.5,
    z_max: 7.0,
    floor_height_m: 3.5,
    area_sqm: 142.5,
    centroid: [28.59225, 77.04925],
    polygon_2d: {
      type: "Polygon",
      coordinates: [
        [
          [77.0490, 28.5920],
          [77.0495, 28.5920],
          [77.0495, 28.5925],
          [77.0490, 28.5925],
          [77.0490, 28.5920]
        ]
      ]
    },
    status: "Registered",
    owner: "Dr. Rajesh Sharma",
    use_type: "Residential"
  },
  {
    unit_id: "UNIT_F2_A02",
    ulpin: "PARCEL_001-BLDG_001-F02-U02-8815102",
    floor_number: 2,
    unit_name: "Flat 202 - Executive Suite B",
    z_min: 3.5,
    z_max: 7.0,
    floor_height_m: 3.5,
    area_sqm: 138.0,
    centroid: [28.59275, 77.04925],
    polygon_2d: {
      type: "Polygon",
      coordinates: [
        [
          [77.0490, 28.5925],
          [77.0495, 28.5925],
          [77.0495, 28.5930],
          [77.0490, 28.5930],
          [77.0490, 28.5925]
        ]
      ]
    },
    status: "Registered",
    owner: "Priya Malhotra",
    use_type: "Residential"
  },
  {
    unit_id: "UNIT_F2_B01",
    ulpin: "PARCEL_001-BLDG_001-F02-U03-8815103",
    floor_number: 2,
    unit_name: "Flat 203 - Luxury 3BHK Apartment",
    z_min: 3.5,
    z_max: 7.0,
    floor_height_m: 3.5,
    area_sqm: 150.2,
    centroid: [28.59225, 77.04975],
    polygon_2d: {
      type: "Polygon",
      coordinates: [
        [
          [77.0495, 28.5920],
          [77.0500, 28.5920],
          [77.0500, 28.5925],
          [77.0495, 28.5925],
          [77.0495, 28.5920]
        ]
      ]
    },
    status: "Registered",
    owner: "Vikramaditya Verma",
    use_type: "Residential"
  },
  {
    unit_id: "UNIT_F2_B02",
    ulpin: "PARCEL_001-BLDG_001-F02-U04-8815104",
    floor_number: 2,
    unit_name: "Flat 204 - Premium Corner Residence",
    z_min: 3.5,
    z_max: 7.0,
    floor_height_m: 3.5,
    area_sqm: 160.0,
    centroid: [28.59275, 77.04975],
    polygon_2d: {
      type: "Polygon",
      coordinates: [
        [
          [77.0495, 28.5925],
          [77.0500, 28.5925],
          [77.0500, 28.5930],
          [77.0495, 28.5930],
          [77.0495, 28.5925]
        ]
      ]
    },
    status: "Registered",
    owner: "Sunita & Amit Kapoor",
    use_type: "Residential"
  },

  // FLOOR 3 (7.0m to 10.5m)
  {
    unit_id: "UNIT_F3_A01",
    ulpin: "PARCEL_001-BLDG_001-F03-U01-9926201",
    floor_number: 3,
    unit_name: "Flat 301 - Skyline Residence 3A",
    z_min: 7.0,
    z_max: 10.5,
    floor_height_m: 3.5,
    area_sqm: 142.5,
    centroid: [28.59225, 77.04925],
    polygon_2d: {
      type: "Polygon",
      coordinates: [
        [
          [77.0490, 28.5920],
          [77.0495, 28.5920],
          [77.0495, 28.5925],
          [77.0490, 28.5925],
          [77.0490, 28.5920]
        ]
      ]
    },
    status: "Registered",
    owner: "Ananya Deshmukh",
    use_type: "Residential"
  },
  {
    unit_id: "UNIT_F3_A02",
    ulpin: "PARCEL_001-BLDG_001-F03-U02-9926202",
    floor_number: 3,
    unit_name: "Flat 302 - Skyline Residence 3B",
    z_min: 7.0,
    z_max: 10.5,
    floor_height_m: 3.5,
    area_sqm: 138.0,
    centroid: [28.59275, 77.04925],
    polygon_2d: {
      type: "Polygon",
      coordinates: [
        [
          [77.0490, 28.5925],
          [77.0495, 28.5925],
          [77.0495, 28.5930],
          [77.0490, 28.5930],
          [77.0490, 28.5925]
        ]
      ]
    },
    status: "Registered",
    owner: "Karan Singh",
    use_type: "Residential"
  },
  {
    unit_id: "UNIT_F3_B01",
    ulpin: "PARCEL_001-BLDG_001-F03-U03-9926203",
    floor_number: 3,
    unit_name: "Flat 303 - Park View Duplex (Lower)",
    z_min: 7.0,
    z_max: 10.5,
    floor_height_m: 3.5,
    area_sqm: 150.2,
    centroid: [28.59225, 77.04975],
    polygon_2d: {
      type: "Polygon",
      coordinates: [
        [
          [77.0495, 28.5920],
          [77.0500, 28.5920],
          [77.0500, 28.5925],
          [77.0495, 28.5925],
          [77.0495, 28.5920]
        ]
      ]
    },
    status: "Registered",
    owner: "Rohan & Sneha Mehta",
    use_type: "Residential"
  },
  {
    unit_id: "UNIT_F3_B02",
    ulpin: "PARCEL_001-BLDG_001-F03-U04-9926204",
    floor_number: 3,
    unit_name: "Flat 304 - Modern Studio East",
    z_min: 7.0,
    z_max: 10.5,
    floor_height_m: 3.5,
    area_sqm: 160.0,
    centroid: [28.59275, 77.04975],
    polygon_2d: {
      type: "Polygon",
      coordinates: [
        [
          [77.0495, 28.5925],
          [77.0500, 28.5925],
          [77.0500, 28.5930],
          [77.0495, 28.5930],
          [77.0495, 28.5925]
        ]
      ]
    },
    status: "Registered",
    owner: "Gurpreet Kaur",
    use_type: "Residential"
  },

  // FLOOR 4 (10.5m to 14.0m) - Penthouse Level
  {
    unit_id: "UNIT_F4_PH01",
    ulpin: "PARCEL_001-BLDG_001-F04-U01-3307301",
    floor_number: 4,
    unit_name: "Penthouse Suite 401 - Grand Horizon",
    z_min: 10.5,
    z_max: 14.0,
    floor_height_m: 3.5,
    area_sqm: 290.7,
    centroid: [28.5925, 77.0495],
    polygon_2d: {
      type: "Polygon",
      coordinates: [
        [
          [77.0490, 28.5920],
          [77.0500, 28.5920],
          [77.0500, 28.5928],
          [77.0490, 28.5928],
          [77.0490, 28.5920]
        ]
      ]
    },
    status: "Registered",
    owner: "Siddharth Roy",
    use_type: "Penthouse"
  },
  {
    unit_id: "UNIT_F4_PH02",
    ulpin: "PARCEL_001-BLDG_001-F04-U02-3307302",
    floor_number: 4,
    unit_name: "Terrace Garden & Solar Array",
    z_min: 10.5,
    z_max: 14.0,
    floor_height_m: 3.5,
    area_sqm: 290.0,
    centroid: [28.5925, 77.04975],
    polygon_2d: {
      type: "Polygon",
      coordinates: [
        [
          [77.0490, 28.5928],
          [77.0500, 28.5928],
          [77.0500, 28.5930],
          [77.0490, 28.5930],
          [77.0490, 28.5928]
        ]
      ]
    },
    status: "Common Utility",
    owner: "Building Owners Association",
    use_type: "Common Utility"
  }
];
