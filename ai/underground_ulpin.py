"""
Underground ULPIN Generation
Generates unique IDs for underground parcels (basements, parking, utilities)
"""

import hashlib
import numpy as np
from typing import List, Tuple, Dict
from dataclasses import dataclass
from .underground_detection import BasementLevel, UndergroundStructure
from .utility_mapper import UtilityNetwork

@dataclass
class UndergroundULPIN:
    """Underground parcel identifier"""
    ulpin: str  # Format: PARCEL-BLDG-SUB-LEVEL-UNIT-GEOHASH
    parcel_id: str
    building_id: str
    subsurface_zone: str  # "B1", "B2", "P1", "P2", "M1", "U1" (utility)
    level_number: int  # -1, -2, -3 (basement levels)
    unit_number: int
    geohash: str
    volume_cubic_meters: float
    depth_range: Tuple[float, float]
    ownership_type: str  # "residential", "commercial", "utility", "parking", "metro"
    coordinates: Tuple[float, float]
    title: str = ""

class UndergroundULPINGenerator:
    """Generate ULPINs for underground infrastructure"""
    
    def __init__(self, parcel_id: str, building_id: str):
        self.parcel_id = parcel_id
        self.building_id = building_id
    
    def generate_basement_ulpins(self, underground_structure: UndergroundStructure,
                                 geohash: str) -> List[UndergroundULPIN]:
        """
        Generate ULPINs for basement levels
        """
        ulpins = []
        
        for basement in underground_structure.basement_levels:
            # Subdivide basement into units (grid-based)
            units = self._subdivide_basement(basement)
            
            for unit_idx, unit in enumerate(units, 1):
                # Determine subsurface zone code
                if basement.type == "basement":
                    zone_code = f"B{abs(basement.level_number)}"
                elif basement.type == "parking":
                    zone_code = f"P{max(1, abs(basement.level_number) - 1)}"
                elif basement.type == "metro":
                    zone_code = "M1"
                elif basement.type == "museum":
                    zone_code = "MUS1"
                else:
                    zone_code = f"S{abs(basement.level_number)}"
                
                # Generate ULPIN
                ulpin_str = self._create_ulpin_string(
                    zone_code=zone_code,
                    unit_number=unit_idx,
                    geohash=geohash,
                    level=basement.level_number
                )
                
                unit_title = basement.name if hasattr(basement, 'name') and basement.name else f"Underground Structure {zone_code}"
                
                ulpin_obj = UndergroundULPIN(
                    ulpin=ulpin_str,
                    parcel_id=self.parcel_id,
                    building_id=self.building_id,
                    subsurface_zone=zone_code,
                    level_number=basement.level_number,
                    unit_number=unit_idx,
                    geohash=geohash,
                    volume_cubic_meters=unit['volume'],
                    depth_range=(basement.depth_meters - basement.estimated_dimensions['height_m'],
                                basement.depth_meters),
                    ownership_type=basement.type,
                    coordinates=unit['centroid'],
                    title=unit_title
                )
                
                ulpins.append(ulpin_obj)
        
        return ulpins
    
    def generate_utility_ulpins(self, utilities: List[UtilityNetwork],
                               geohash: str) -> List[UndergroundULPIN]:
        """
        Generate ULPINs for utility corridors
        
        Format: PARCEL-BLDG-U{type}-{segment}-GEOHASH
        Example: PARCEL-001-UW-01-te7g9k7 (Water utility, segment 01)
        """
        
        ulpins = []
        
        utility_codes = {
            'water': 'W',
            'sewage': 'S',
            'power': 'E',
            'telecom': 'T',
            'gas': 'G'
        }
        
        for utility in utilities:
            code = utility_codes.get(utility.utility_type, 'X')
            
            # Segment utility corridor into sections
            segments = self._segment_utility_corridor(utility)
            
            for seg_idx, segment in enumerate(segments, 1):
                ulpin_str = self._create_utility_ulpin_string(
                    utility_code=code,
                    segment_number=seg_idx,
                    geohash=geohash
                )
                
                # Volume for utility: length * width * depth (approximation)
                utility_volume = segment['length'] * 0.5 * utility.depth_meters
                
                ulpin_obj = UndergroundULPIN(
                    ulpin=ulpin_str,
                    parcel_id=self.parcel_id,
                    building_id=self.building_id,
                    subsurface_zone=f"U{code}",
                    level_number=int(-utility.depth_meters),
                    unit_number=seg_idx,
                    geohash=geohash,
                    volume_cubic_meters=utility_volume,
                    depth_range=(utility.depth_meters, utility.depth_meters + 1.0),
                    ownership_type='utility',
                    coordinates=segment['midpoint'],
                    title=f"{utility.utility_type.capitalize()} Line (DN{utility.diameter_mm}mm, -{utility.depth_meters}m)"
                )
                
                ulpins.append(ulpin_obj)
        
        return ulpins
    
    def _subdivide_basement(self, basement: BasementLevel, 
                           cols: int = 3, rows: int = 3) -> List[Dict]:
        """Subdivide basement level into grid units"""
        
        units = []
        
        length = basement.estimated_dimensions.get('length_m', 20)
        width = basement.estimated_dimensions.get('width_m', 15)
        height = basement.estimated_dimensions.get('height_m', 3.0)
        
        unit_length = length / cols
        unit_width = width / rows
        
        for row in range(rows):
            for col in range(cols):
                unit = {
                    'row': row,
                    'col': col,
                    'length': unit_length,
                    'width': unit_width,
                    'height': height,
                    'volume': unit_length * unit_width * height,
                    'centroid': (
                        basement.coordinates[0] + (col - cols/2) * 0.0002,
                        basement.coordinates[1] + (row - rows/2) * 0.0002
                    )
                }
                units.append(unit)
        
        return units
    
    def _segment_utility_corridor(self, utility: UtilityNetwork, 
                                 segment_length: float = 100.0) -> List[Dict]:
        """Segment utility corridor into manageable sections"""
        
        # Calculate total corridor length
        dlat = utility.end_point[0] - utility.start_point[0]
        dlon = utility.end_point[1] - utility.start_point[1]
        
        # Approximate distance (degree to meters: 1 degree ≈ 111km)
        total_distance = np.sqrt(dlat**2 + dlon**2) * 111000
        
        num_segments = max(1, int(np.ceil(total_distance / segment_length)))
        
        segments = []
        
        for i in range(num_segments):
            start_frac = i / num_segments
            end_frac = (i + 1) / num_segments
            
            start = (
                utility.start_point[0] + dlat * start_frac,
                utility.start_point[1] + dlon * start_frac
            )
            end = (
                utility.start_point[0] + dlat * end_frac,
                utility.start_point[1] + dlon * end_frac
            )
            
            segment = {
                'start': start,
                'end': end,
                'midpoint': ((start[0] + end[0])/2, (start[1] + end[1])/2),
                'length': segment_length
            }
            segments.append(segment)
        
        return segments
    
    def _create_ulpin_string(self, zone_code: str, unit_number: int,
                            geohash: str, level: int) -> str:
        """
        Create ULPIN string for basement/parking
        Format: PARCEL-BLDG-ZONE-UNIT-GEOHASH
        """
        
        unit_str = f"{unit_number:02d}"
        return f"{self.parcel_id}-{self.building_id}-{zone_code}-{unit_str}-{geohash}"
    
    def _create_utility_ulpin_string(self, utility_code: str, segment_number: int,
                                   geohash: str) -> str:
        """
        Create ULPIN string for utility
        Format: PARCEL-BLDG-UTYPE-SEGMENT-GEOHASH
        """
        
        segment_str = f"{segment_number:03d}"
        return f"{self.parcel_id}-{self.building_id}-U{utility_code}-{segment_str}-{geohash}"
