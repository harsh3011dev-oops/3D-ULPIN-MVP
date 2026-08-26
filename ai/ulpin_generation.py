import pygeohash as geohash

def generate_ulpin(
    parcel_id: str,
    building_id: str,
    floor_number: int,
    unit_label: str,
    centroid: list
) -> str:
    """
    Generate a globally unique 3D ULPIN (Unique Land Parcel Identification Number).

    Format: {PARCEL_ID}-{BLDG_SHORT}-F{FLOOR:02d}-U{UNIT}-{GEOHASH}

    The geohash (7 chars, ~76m precision) ensures geographic uniqueness even
    if two buildings share the same parcel/floor/unit labels.

    Args:
        parcel_id (str): Parcel identifier, e.g. "PARCEL_001".
        building_id (str): Building UUID.
        floor_number (int): Floor number (1-indexed).
        unit_label (str): Unit label within floor, e.g. "A01".
        centroid (list): [latitude, longitude] of the unit centroid.

    Returns:
        str: ULPIN string, e.g. "PARCEL_001-UUIDABC0-F01-UA01-ttnfv1h"
    """
    # Shorten building_id (remove dashes, uppercase, take first 8 chars)
    bldg_short = building_id.replace("-", "").upper()[:8]
    
    # Generate geohash from centroid (latitude, longitude)
    geo_hash = geohash.encode(centroid[0], centroid[1], precision=7)

    return f"{parcel_id}-{bldg_short}-F{floor_number:02d}-U{unit_label}-{geo_hash}"


def validate_ulpin_format(ulpin: str) -> bool:
    """
    Validate that a ULPIN string follows the expected format.
    """
    parts = ulpin.split("-")
    if len(parts) < 5:
        return False
    floor_part = parts[2]
    return floor_part.startswith("F") and floor_part[1:].isdigit()
