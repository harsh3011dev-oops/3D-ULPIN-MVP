"""
Subsurface Validation
Detects conflicts, overlaps, and validates underground infrastructure
"""

from typing import List, Dict, Tuple
from dataclasses import dataclass
from .underground_ulpin import UndergroundULPIN
from .utility_mapper import UtilityNetwork

@dataclass
class ValidationIssue:
    """Validation issue/conflict found"""
    issue_type: str  # "overlap", "too_close", "conflict", "invalid_depth"
    severity: str  # "critical", "high", "medium", "low"
    ulpins_involved: List[str]
    description: str
    recommendation: str
    location: Tuple[float, float]

class SubsurfaceValidator:
    """Validate underground infrastructure"""
    
    def validate_underground_ulpins(self, ulpins: List[UndergroundULPIN],
                                   utilities: List[UtilityNetwork]) -> Tuple[List[ValidationIssue], float]:
        """
        Comprehensive validation of underground parcels
        
        Returns:
            (issues_list, overall_confidence_score)
        """
        
        issues = []
        
        # Check 1: Basement-Basement overlaps
        basement_issues = self._check_basement_overlaps(ulpins)
        issues.extend(basement_issues)
        
        # Check 2: Utility-Utility conflicts
        utility_issues = self._check_utility_conflicts(utilities)
        issues.extend(utility_issues)
        
        # Check 3: Basement-Utility spacing
        spacing_issues = self._check_basement_utility_spacing(ulpins, utilities)
        issues.extend(spacing_issues)
        
        # Check 4: Depth validity
        depth_issues = self._check_depth_validity(ulpins)
        issues.extend(depth_issues)
        
        # Calculate overall confidence
        confidence = self._calculate_confidence_score(len(issues))
        
        return issues, confidence
    
    def _check_basement_overlaps(self, ulpins: List[UndergroundULPIN]) -> List[ValidationIssue]:
        """Check if basement ULPINs overlap in space"""
        
        issues = []
        
        for i, ulpin1 in enumerate(ulpins):
            if 'B' not in ulpin1.subsurface_zone and 'P' not in ulpin1.subsurface_zone:
                continue
            
            for j, ulpin2 in enumerate(ulpins):
                if i >= j or ('B' not in ulpin2.subsurface_zone and 'P' not in ulpin2.subsurface_zone):
                    continue
                
                # Check spatial overlap
                if self._spatial_overlap(ulpin1.coordinates, ulpin2.coordinates, radius=50):
                    
                    # Check if same level (then overlap is critical)
                    if ulpin1.level_number == ulpin2.level_number:
                        issue = ValidationIssue(
                            issue_type="overlap",
                            severity="critical",
                            ulpins_involved=[ulpin1.ulpin, ulpin2.ulpin],
                            description=f"Basement units {ulpin1.unit_number} and {ulpin2.unit_number} overlap on level {ulpin1.level_number}",
                            recommendation="Adjust unit boundaries to avoid overlap",
                            location=ulpin1.coordinates
                        )
                        issues.append(issue)
        
        return issues
    
    def _check_utility_conflicts(self, utilities: List[UtilityNetwork]) -> List[ValidationIssue]:
        """Check for utility-utility conflicts"""
        
        issues = []
        
        for utility in utilities:
            for conflict in utility.conflict_zones:
                issue = ValidationIssue(
                    issue_type="conflict",
                    severity="high",
                    ulpins_involved=[utility.utility_type, conflict['conflicting_utility']],
                    description=f"{utility.utility_type} and {conflict['conflicting_utility']} at same depth",
                    recommendation=conflict['recommendation'],
                    location=conflict['location']
                )
                issues.append(issue)
        
        return issues
    
    def _check_basement_utility_spacing(self, ulpins: List[UndergroundULPIN],
                                       utilities: List[UtilityNetwork]) -> List[ValidationIssue]:
        """Check minimum spacing between basements and utilities"""
        
        issues = []
        min_spacing = 2.0  # meters
        
        for basement_ulpin in ulpins:
            if 'B' not in basement_ulpin.subsurface_zone:
                continue
            
            for utility in utilities:
                # Check if utility passes too close to basement
                distance = self._point_to_line_distance(
                    basement_ulpin.coordinates,
                    utility.start_point,
                    utility.end_point
                )
                
                if distance < min_spacing:
                    issue = ValidationIssue(
                        issue_type="too_close",
                        severity="high",
                        ulpins_involved=[basement_ulpin.ulpin, utility.utility_type],
                        description=f"Basement unit and {utility.utility_type} utility only {distance:.1f}m apart",
                        recommendation=f"Increase separation to minimum {min_spacing}m",
                        location=basement_ulpin.coordinates
                    )
                    issues.append(issue)
        
        return issues
    
    def _check_depth_validity(self, ulpins: List[UndergroundULPIN]) -> List[ValidationIssue]:
        """Check if depths are reasonable"""
        
        issues = []
        max_depth = 50.0  # meters (typical max for urban construction)
        
        for ulpin in ulpins:
            if ulpin.depth_range[1] > max_depth:
                issue = ValidationIssue(
                    issue_type="invalid_depth",
                    severity="medium",
                    ulpins_involved=[ulpin.ulpin],
                    description=f"Depth {ulpin.depth_range[1]:.1f}m exceeds typical maximum",
                    recommendation="Verify depth measurements",
                    location=ulpin.coordinates
                )
                issues.append(issue)
        
        return issues
    
    def _spatial_overlap(self, coord1: Tuple[float, float], 
                        coord2: Tuple[float, float], radius: float) -> bool:
        """Check if two coordinates are within radius (meters)"""
        
        # Simple approximation: 1 degree ≈ 111 km
        dlat = (coord2[0] - coord1[0]) * 111000
        dlon = (coord2[1] - coord1[1]) * 111000
        
        distance = (dlat**2 + dlon**2)**0.5
        return distance < radius
    
    def _point_to_line_distance(self, point: Tuple[float, float],
                               line_start: Tuple[float, float],
                               line_end: Tuple[float, float]) -> float:
        """Calculate perpendicular distance from point to line"""
        
        # Convert to meters
        px, py = point[0] * 111000, point[1] * 111000
        x1, y1 = line_start[0] * 111000, line_start[1] * 111000
        x2, y2 = line_end[0] * 111000, line_end[1] * 111000
        
        numerator = abs((y2-y1)*px - (x2-x1)*py + x2*y1 - y2*x1)
        denominator = ((y2-y1)**2 + (x2-x1)**2)**0.5
        
        if denominator == 0:
            return 0
        
        return numerator / denominator
    
    def _calculate_confidence_score(self, issue_count: int) -> float:
        """Calculate confidence based on number of issues"""
        
        if issue_count == 0:
            return 0.95
        elif issue_count <= 2:
            return 0.85
        elif issue_count <= 5:
            return 0.70
        else:
            return 0.50
