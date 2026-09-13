"""Unit tests for AI Vision Detectors (Pothole, Near-Miss, Missing Divider)."""

import unittest
from ai.pothole_detector import PotholeDetector
from ai.near_miss_detector import NearMissDetector
from ai.divider_detector import DividerDetector
from ai.vision_engine import VisionEngine, generate_synthetic_road_scene


class TestAIVisionDetectors(unittest.TestCase):
    def setUp(self):
        self.pothole_detector = PotholeDetector()
        self.near_miss_detector = NearMissDetector()
        self.divider_detector = DividerDetector()
        self.engine = VisionEngine()

    def test_pothole_detection_on_synthetic_frame(self):
        frame = generate_synthetic_road_scene("POTHOLE")
        events = self.pothole_detector.detect(frame)
        self.assertGreater(len(events), 0, "Should detect at least one pothole in synthetic frame")
        evt = events[0]
        self.assertEqual(evt["event_type"], "POTHOLE")
        self.assertGreaterEqual(evt["confidence"], 0.50)
        self.assertIn(evt["severity"], ["MODERATE", "SEVERE"])
        self.assertEqual(len(evt["bbox"]), 4)

    def test_clean_road_no_false_pothole(self):
        clean_frame = generate_synthetic_road_scene(None)
        events = self.pothole_detector.detect(clean_frame)
        self.assertEqual(len(events), 0, "Should not detect potholes on clean road")

    def test_near_miss_detection_on_approaching_vehicle(self):
        # Feed sequence of approaching vehicle frames
        events = []
        for step in range(8):
            frame = generate_synthetic_road_scene("NEAR_MISS", step=step)
            evts = self.near_miss_detector.detect(frame, bus_speed_kmh=35.0)
            events.extend(evts)

        self.assertGreater(len(events), 0, "Should detect near-miss collision risk on rapid approach")
        evt = events[0]
        self.assertEqual(evt["event_type"], "NEAR_MISS")
        self.assertIn(evt["risk_level"], ["WARNING", "CRITICAL"])
        self.assertIsNotNone(evt.get("ttc_seconds"))

    def test_missing_divider_detection(self):
        # 1. Establish baseline of present barrier
        for _ in range(5):
            f = generate_synthetic_road_scene(None)
            self.divider_detector.detect(f)

        # 2. Feed broken barrier frame with gap
        events = []
        for step in range(20):
            f = generate_synthetic_road_scene("MISSING_DIVIDER", step=step)
            evts = self.divider_detector.detect(f)
            events.extend(evts)

        self.assertGreater(len(events), 0, "Should detect missing/damaged divider section")
        evt = events[0]
        self.assertEqual(evt["event_type"], "MISSING_DIVIDER")
        self.assertIn(evt["hazard_level"], ["MODERATE", "HIGH"])
        self.assertGreater(evt.get("estimated_gap_meters", 0), 0)

    def test_vision_engine_annotated_frame(self):
        frame = generate_synthetic_road_scene("POTHOLE")
        events, annotated = self.engine.process_frame(frame, bus_speed_kmh=30.0)
        self.assertEqual(annotated.shape, frame.shape, "Annotated frame must preserve input resolution")
        self.assertGreater(len(events), 0)


if __name__ == "__main__":
    unittest.main()
