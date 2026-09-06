"""
Utility Network Mapper
Maps underground utilities: water, sewage, power, telecom, gas
"""

import numpy as np
from typing import Dict, List, Tuple
from dataclasses import dataclass
import requests

@dataclass
class UtilityNetwork:
    """Utility corridor/network representation"""
    utility_type: str  # "water", "sewage", "power", "telecom", "gas"
    start_point: Tuple[float, float]  # lat, lon
    end_point: Tuple[float, float]
    depth_meters: float
    diameter_mm: int  # For pipes
    capacity: float  # Flow rate or power capacity
    age_years: int
    condition: str  # "good", "fair", "poor"
    conflict_zones: List[Dict]  # Overlaps with other utilities
    maintenance_urgency: float  # 0-1 score
    path: List[Tuple[float, float, float]] = None  # [(lat, lon, depth), ...]

class UtilityMapper:
    """Map underground utility networks"""
    
    def __init__(self, lat: float, lon: float, building_coords: Tuple[float, float]):
        self.lat = lat
        self.lon = lon
        self.building_coords = building_coords
        self.search_radius = 500  # meters
        
    def map_utilities(self) -> List[UtilityNetwork]:
        """
        Map all utilities in area
        """
        utilities = []
        
        # Standard utilities in Indian cities
        utility_types = [
            ("water", 3.0, 150, "main supply"),
            ("sewage", 4.5, 200, "wastewater"),
            ("power", 2.0, 50, "electrical"),
            ("telecom", 1.5, 50, "fiber/copper"),
            ("gas", 3.5, 25, "natural gas")
        ]
        
        for utility_type, depth, diameter, capacity_info in utility_types:
            network = self._create_utility_network(utility_type, depth, diameter, capacity_info)
            utilities.append(network)
        
        # Detect conflicts
        conflicts = self._detect_utility_conflicts(utilities)
        for i, utility in enumerate(utilities):
            utility.conflict_zones = conflicts[i]
        
        return utilities
    
    def _create_utility_network(self, utility_type: str, depth: float, 
                               diameter: int, capacity_info: str) -> UtilityNetwork:
        """Create individual utility network with multi-segment 3D path"""
        lat, lon = self.building_coords
        
        # Unique 3D path patterns for each utility surrounding the parcel
        path_offsets = {
            "water": [(-0.0006, -0.0006), (-0.0006, 0.0006), (0.0005, 0.0006)],
            "sewage": [(-0.0007, -0.0003), (0.0007, -0.0003), (0.0007, 0.0005)],
            "power": [(-0.0004, 0.0005), (-0.0004, -0.0005), (0.0005, -0.0005)],
            "telecom": [(0.0005, -0.0005), (0.0005, 0.0005)],
            "gas": [(-0.0003, -0.0007), (0.0003, 0.0007)]
        }
        
        offsets = path_offsets.get(utility_type, [(-0.0005, -0.0005), (0.0005, 0.0005)])
        path_coords = [(lat + dlat, lon + dlon, depth) for dlat, dlon in offsets]
        
        start = (path_coords[0][0], path_coords[0][1])
        end = (path_coords[-1][0], path_coords[-1][1])
        
        # Calculate capacity based on type
        capacity_map = {
            "water": 50.0,  # liters/sec
            "sewage": 40.0,
            "power": 100.0,  # kW
            "telecom": 1000.0,  # Mbps
            "gas": 30.0  # cubic meters/hour
        }
        
        return UtilityNetwork(
            utility_type=utility_type,
            start_point=start,
            end_point=end,
            depth_meters=depth,
            diameter_mm=diameter,
            capacity=capacity_map.get(utility_type, 50.0),
            age_years=np.random.randint(5, 30),
            condition=self._assess_condition(utility_type),
            conflict_zones=[],
            maintenance_urgency=np.random.uniform(0.2, 0.9),
            path=path_coords
        )
    
    def _assess_condition(self, utility_type: str) -> str:
        """Assess utility condition (simplified)"""
        
        if utility_type in ["water", "sewage"]:
            return "fair"  # Pipes usually degrade over time
        else:
            return "good"
    
    def _detect_utility_conflicts(self, utilities: List[UtilityNetwork]) -> Dict:
        """Detect overlapping utilities and conflicts"""
        
        conflicts = {}
        
        for i, util1 in enumerate(utilities):
            conflicts[i] = []
            
            for j, util2 in enumerate(utilities):
                if i >= j:
                    continue
                
                # Check if utilities overlap in space
                # Simplified: check if depth ranges overlap and routes intersect
                
                depth_overlap = abs(util1.depth_meters - util2.depth_meters) < 1.0
                
                if depth_overlap:
                    conflicts[i].append({
                        'conflicting_utility': util2.utility_type,
                        'severity': 'high',
                        'location': util1.start_point,
                        'recommendation': f'Separate {util1.utility_type} from {util2.utility_type}'
                    })
        
        return conflicts
