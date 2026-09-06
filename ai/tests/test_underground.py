"""
Tests for underground infrastructure detection
"""

import unittest
from ai.underground_detection import UndergroundDetector
from ai.utility_mapper import UtilityMapper
from ai.underground_ulpin import UndergroundULPINGenerator
from ai.subsurface_validation import SubsurfaceValidator

class TestUndergroundDetection(unittest.TestCase):
    
    def setUp(self):
        # G-Block coordinates
        self.lat = 29.21147
        self.lon = 77.01607
        self.height = 20.0
    
    def test_basement_detection(self):
        """Test basement level detection"""
        
        detector = UndergroundDetector(self.lat, self.lon, self.height)
        basements = detector.detect_basements()
        
        self.assertGreater(len(basements), 0)
        self.assertLessEqual(len(basements), 5)
        
        # Check basement properties
        for basement in basements:
            self.assertLess(basement.level_number, 0)  # Should be negative
            self.assertGreater(basement.depth_meters, 0)
            self.assertGreater(basement.area_sqm, 0)
    
    def test_subsurface_volume_calculation(self):
        """Test volume calculations"""
        
        detector = UndergroundDetector(self.lat, self.lon, self.height)
        basements = detector.detect_basements()
        volume, depth = detector.calculate_subsurface_volume(basements)
        
        self.assertGreater(volume, 0)
        self.assertGreater(depth, 0)
    
    def test_utility_mapping(self):
        """Test utility network mapping"""
        
        mapper = UtilityMapper(self.lat, self.lon, (self.lat, self.lon))
        utilities = mapper.map_utilities()
        
        # Should have at least water, sewage, power
        utility_types = {u.utility_type for u in utilities}
        self.assertIn('water', utility_types)
        self.assertIn('sewage', utility_types)
        self.assertIn('power', utility_types)
    
    def test_underground_ulpin_generation(self):
        """Test ULPIN generation for underground"""
        
        detector = UndergroundDetector(self.lat, self.lon, self.height)
        underground = detector.get_underground_structure()
        
        gen = UndergroundULPINGenerator("PARCEL-001", "BLDG-001")
        ulpins = gen.generate_basement_ulpins(underground, "te7g9k7")
        
        self.assertGreater(len(ulpins), 0)
        
        # Check ULPIN format
        for ulpin in ulpins:
            self.assertIn('-B', ulpin.ulpin)  # Basement marker
            self.assertIn('te7g9k7', ulpin.ulpin)  # Geohash
    
    def test_conflict_validation(self):
        """Test conflict detection"""
        
        detector = UndergroundDetector(self.lat, self.lon, self.height)
        underground = detector.get_underground_structure()
        
        mapper = UtilityMapper(self.lat, self.lon, (self.lat, self.lon))
        utilities = mapper.map_utilities()
        
        gen = UndergroundULPINGenerator("PARCEL-001", "BLDG-001")
        ulpins = gen.generate_basement_ulpins(underground, "te7g9k7")
        
        validator = SubsurfaceValidator()
        issues, confidence = validator.validate_underground_ulpins(ulpins, utilities)
        
        # Should have reasonable confidence
        self.assertGreater(confidence, 0.4)
        self.assertLess(confidence, 1.0)

if __name__ == '__main__':
    unittest.main()
