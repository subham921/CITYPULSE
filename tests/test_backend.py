"""Integration tests for CITYPULSE backend API endpoints."""

import unittest
from datetime import datetime, timezone
import requests

BASE_URL = "http://127.0.0.1:8000"


class TestBackendAPI(unittest.TestCase):
    def test_health(self):
        res = requests.get(f"{BASE_URL}/health", timeout=5)
        self.assertEqual(res.status_code, 200)
        data = res.json()
        self.assertEqual(data.get("status"), "healthy")

    def test_ingest_and_query_event(self):
        payload = {
            "event_type": "POTHOLE",
            "bus_id": "TEST_BUS_99",
            "timestamp": datetime.now(timezone.utc).isoformat(),
            "location": {"latitude": 22.5800, "longitude": 88.3700},
            "gps": {"speed_kmh": 28.5},
            "imu": {"acceleration_z": 3.2, "shock_detected": True, "shock_level": "SEVERE"},
            "vision": {"confidence": 0.94, "bbox": [120, 240, 60, 40]},
            "fusion": {"time_match": True, "confidence": 0.96},
            "pothole_details": {"severity": "SEVERE", "area_px": 4500, "wheel_impact_confirmed": True},
        }

        res = requests.post(f"{BASE_URL}/api/v1/events", json=payload, timeout=5)
        self.assertEqual(res.status_code, 201)
        self.assertIn(res.json().get("status"), ["success", "deduplicated"])

        # Query back filtered by bus_id
        q_res = requests.get(f"{BASE_URL}/api/v1/events?bus_id=TEST_BUS_99", timeout=5)
        self.assertEqual(q_res.status_code, 200)
        events = q_res.json().get("events", [])
        self.assertGreater(len(events), 0)
        self.assertEqual(events[0]["bus_id"], "TEST_BUS_99")

    def test_stats_and_geojson(self):
        stats_res = requests.get(f"{BASE_URL}/api/v1/events/stats", timeout=5)
        self.assertEqual(stats_res.status_code, 200)
        stats = stats_res.json()
        self.assertIn("total_events", stats)
        self.assertIn("by_type", stats)

        geojson_res = requests.get(f"{BASE_URL}/api/v1/events/geojson", timeout=5)
        self.assertEqual(geojson_res.status_code, 200)
        geojson = geojson_res.json()
        self.assertEqual(geojson.get("type"), "FeatureCollection")
        self.assertIsInstance(geojson.get("features"), list)

    def test_photo_upload_endpoint(self):
        # 1x1 transparent PNG base64
        sample_b64 = "data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNk+M9QDwADhgGAWjR9awAAAABJRU5ErkJggg=="
        res = requests.post(f"{BASE_URL}/api/v1/upload-photo", json={"data": sample_b64, "filename": "test.png"}, timeout=5)
        self.assertEqual(res.status_code, 200)
        data = res.json()
        self.assertEqual(data.get("status"), "success")
        self.assertTrue(data.get("photo_url", "").startswith("/static/uploads/"))

    def test_admin_auth_endpoints(self):
        # Incorrect password
        bad_res = requests.post(f"{BASE_URL}/api/v1/auth/admin-login", json={"password": "wrongpassword"}, timeout=5)
        self.assertEqual(bad_res.status_code, 401)

        # Correct password
        good_res = requests.post(f"{BASE_URL}/api/v1/auth/admin-login", json={"password": "admin123"}, timeout=5)
        self.assertEqual(good_res.status_code, 200)
        self.assertEqual(good_res.json().get("status"), "authenticated")
        token = good_res.json().get("token")
        self.assertTrue(bool(token))

        # Verify valid token
        verify_res = requests.get(f"{BASE_URL}/api/v1/auth/verify?token={token}", timeout=5)
        self.assertEqual(verify_res.status_code, 200)
        self.assertTrue(verify_res.json().get("valid"))
        self.assertEqual(verify_res.json().get("role"), "TRANSPORT_AUTHORITY")

        # Verify invalid token
        bad_verify = requests.get(f"{BASE_URL}/api/v1/auth/verify?token=invalid_token_123", timeout=5)
        self.assertEqual(bad_verify.status_code, 200)
        self.assertFalse(bad_verify.json().get("valid"))
        self.assertIsNone(bad_verify.json().get("role"))


if __name__ == "__main__":
    unittest.main()
