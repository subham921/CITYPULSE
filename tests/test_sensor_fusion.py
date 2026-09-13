"""Unit tests for multi-modal sensor fusion logic."""

import unittest
from datetime import datetime, timezone
import sys
from pathlib import Path

ROOT_DIR = Path(__file__).parent.parent
sys.path.insert(0, str(ROOT_DIR / "edge"))

from fusion.sensor_fusion import fuse_event, timestamps_match


class TestSensorFusion(unittest.TestCase):
    def setUp(self):
        self.now = datetime.now(timezone.utc).isoformat()
        self.gps = {
            "bus_id": "BUS101",
            "latitude": 22.5726,
            "longitude": 88.3639,
            "speed": 35.0,
            "timestamp": self.now,
        }

    def test_pothole_with_shock_confirmation(self):
        vision = {
            "event_type": "POTHOLE",
            "confidence": 0.90,
            "severity": "SEVERE",
            "bbox": [100, 200, 50, 40],
            "timestamp": self.now,
        }
        imu = {
            "acceleration_z": 3.4,
            "shock_detected": True,
            "shock_level": "SEVERE",
            "timestamp": self.now,
        }
        fused = fuse_event(vision, self.gps, imu)
        self.assertEqual(fused["event_type"], "POTHOLE")
        self.assertTrue(fused["pothole_details"]["wheel_impact_confirmed"])
        self.assertGreater(fused["fusion"]["confidence"], 0.90)

    def test_near_miss_with_emergency_braking(self):
        vision = {
            "event_type": "NEAR_MISS",
            "confidence": 0.80,
            "risk_level": "CRITICAL",
            "hazard_sub_type": "FORWARD_COLLISION_TTC",
            "ttc_seconds": 1.2,
            "timestamp": self.now,
        }
        imu = {
            "accel_y": -0.45,  # Strong braking deceleration
            "shock_detected": False,
            "shock_level": "HIGH",
            "timestamp": self.now,
        }
        fused = fuse_event(vision, self.gps, imu)
        self.assertEqual(fused["event_type"], "NEAR_MISS")
        self.assertTrue(fused["near_miss_details"]["emergency_braking"])
        self.assertGreaterEqual(fused["fusion"]["confidence"], 0.85)

    def test_missing_divider_geotagging(self):
        vision = {
            "event_type": "MISSING_DIVIDER",
            "confidence": 0.86,
            "hazard_level": "HIGH",
            "estimated_gap_meters": 6.5,
            "timestamp": self.now,
        }
        imu = {
            "acceleration_z": 1.0,
            "shock_detected": False,
            "shock_level": "NORMAL",
            "timestamp": self.now,
        }
        fused = fuse_event(vision, self.gps, imu)
        self.assertEqual(fused["event_type"], "MISSING_DIVIDER")
        self.assertEqual(fused["location"]["latitude"], 22.5726)
        self.assertEqual(fused["divider_details"]["estimated_gap_meters"], 6.5)


if __name__ == "__main__":
    unittest.main()
