"""
Fine-Tuning Configuration Module for 3D ULPIN AI Pipeline
==========================================================
Centralized configuration settings for all 7 fine-tuning priorities:
1. Footprint Detection Enhancement
2. Robust Geocoding
3. Latency Optimization
4. Diverse Building Testing
5. Confidence Scoring Engine
6. Automated Quality Gates
"""

FINE_TUNING_CONFIG = {
    "priority_1": {
        "name": "Footprint Detection Enhancement",
        "enabled": True,
        "multi_scale_canny": {
            "fine_thresholds": (30, 90),
            "medium_thresholds": (50, 150),
            "coarse_thresholds": (100, 200)
        },
        "shadow_detection": {
            "enabled": True,
            "hsv_thresholds": {
                "shadow": {"s_max": 80, "v_max": 70},
                "cloud": {"s_max": 40, "v_min": 210}
            }
        },
        "hybrid_strategy": {
            "enabled": True,
            "cv_confidence_threshold_high": 85,
            "cv_confidence_threshold_low": 70,
            "blend_ratios": {
                "high_confidence": (1.0, 0.0),    # 100% CV, 0% OSM
                "medium_confidence": (0.7, 0.3),  # 70% CV, 30% OSM
                "low_confidence": (0.3, 0.7)      # 30% CV, 70% OSM
            }
        },
        "clahe": {
            "clip_limit": 2.0,
            "tile_grid_size": (8, 8)
        }
    },
    
    "priority_2": {
        "name": "Robust Geocoding",
        "enabled": True,
        "primary_api": "opencage",
        "fallback_apis": ["nominatim", "google"],
        "caching": {
            "enabled": True,
            "cache_dir": "cache/geocoding",
            "db_path": "cache/geocoding/geocode_cache.db",
            "cache_expiry_days": 30
        }
    },
    
    "priority_4": {
        "name": "Latency Optimization",
        "enabled": True,
        "tile_caching": {
            "enabled": True,
            "cache_dir": "cache/satellite_tiles",
            "max_age_days": 30
        },
        "parallel_download": {
            "enabled": True,
            "max_workers": 4
        },
        "compression": {
            "format": "jpeg",
            "quality": 85
        }
    },
    
    "priority_5": {
        "name": "Diverse Building Testing",
        "test_buildings_count": 10,
        "difficulty_levels": ["EASY", "MEDIUM", "HARD", "VERY_HARD"]
    },
    
    "priority_6": {
        "name": "Confidence Scoring",
        "enabled": True,
        "weight_distribution": {
            "footprint": 0.4,
            "floors": 0.2,
            "units": 0.3,
            "ulpin": 0.1
        },
        "risk_thresholds": {
            "low_risk": 85.0,
            "medium_risk": 70.0
        }
    },
    
    "priority_7": {
        "name": "Quality Gates",
        "enabled": True,
        "gates": {
            "footprint_iou_min": 0.30,
            "unit_boundary_check": True,
            "overlap_check": True,
            "ulpin_format_check": True
        }
    }
}
