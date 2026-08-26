def process_building(input_data: dict) -> dict:
    """
    Main entry point called by Backend.
    Currently returning a hardcoded STUB output so backend can test integration.
    """
    
    # Stub output matching the API_CONTRACT
    output_dict = {
        "status": "success",
        "building_id": input_data.get("building_id", "test-uuid"),
        "footprint": {
            "type": "Polygon",
            "coordinates": [[[77.049, 28.592], [77.0495, 28.5925], [77.050, 28.592]]]
        },
        "height": input_data.get("height_meters", 45.0),
        "floor_count": input_data.get("floor_count", 15),
        "extrusion_3d": {
            "type": "MultiPolygon",
            "coordinates": "...",
            "z_min": 0.0,
            "z_max": input_data.get("height_meters", 45.0)
        },
        "units": [
            {
                "unit_id": "UNIT_F01_A01",
                "floor": 1,
                "floor_height_m": 3.0,
                "z_min": 0.0,
                "z_max": 3.0,
                "polygon_2d": {
                    "type": "Polygon",
                    "coordinates": [[[77.049, 28.592], [77.0495, 28.592], [77.0495, 28.5925], [77.049, 28.5925], [77.049, 28.592]]]
                },
                "centroid": [28.5921, 77.0490],
                "ulpin": f"{input_data.get('parcel_id', 'PARCEL_TEST')}-BLDG001-F01-U01-2857739",
                "area_sqm": 75.4
            }
        ],
        "validation": {
            "overlaps_detected": False,
            "overlapping_units": [],
            "out_of_bounds": [],
            "valid": True,
            "errors": []
        }
    }
    
    return output_dict

if __name__ == "__main__":
    # Test the stub
    test_input = {
        "aerial_image_path": "dummy.jpg",
        "parcel_boundary": {},
        "height_meters": 30.0,
        "floor_count": 10,
        "parcel_id": "PARCEL_001",
        "building_id": "test-1234"
    }
    print(process_building(test_input))
