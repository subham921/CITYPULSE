"""Unit tests for Mappls API client and enrichment service.

Tests run without real API credentials by mocking the HTTP layer.
"""

import unittest
from unittest.mock import patch, MagicMock
import sys
from pathlib import Path

ROOT_DIR = Path(__file__).parent.parent
sys.path.insert(0, str(ROOT_DIR))

from mappls.client import MapplsClient
from mappls.enrichment import enrich_event_with_address


class TestMapplsClient(unittest.TestCase):
    def setUp(self):
        self.client = MapplsClient(client_id="test_id", client_secret="test_secret")

    @patch("mappls.client.requests.post")
    def test_token_generation(self, mock_post):
        mock_response = MagicMock()
        mock_response.json.return_value = {"access_token": "test_token_123", "expires_in": 86400}
        mock_response.raise_for_status = MagicMock()
        mock_post.return_value = mock_response

        token = self.client._get_access_token()
        self.assertEqual(token, "test_token_123")
        mock_post.assert_called_once()

        # Second call should use cached token
        token2 = self.client._get_access_token()
        self.assertEqual(token2, "test_token_123")
        mock_post.assert_called_once()  # Still only 1 call

    @patch("mappls.client.requests.get")
    @patch("mappls.client.requests.post")
    def test_reverse_geocode(self, mock_post, mock_get):
        # Mock token
        mock_post.return_value = MagicMock(
            json=MagicMock(return_value={"access_token": "tok", "expires_in": 86400}),
            raise_for_status=MagicMock(),
        )
        # Mock reverse geocode response
        mock_get.return_value = MagicMock(
            status_code=200,
            json=MagicMock(return_value={
                "results": [{
                    "formatted_address": "EM Bypass, Kolkata, West Bengal 700107",
                    "area": "Salt Lake",
                    "city": "Kolkata",
                    "district": "Kolkata",
                    "state": "West Bengal",
                    "pincode": "700107",
                    "locality": "Sector V",
                    "street": "EM Bypass Road",
                }]
            }),
            raise_for_status=MagicMock(),
        )

        result = self.client.reverse_geocode(22.5726, 88.3639)
        self.assertTrue(result["success"])
        self.assertEqual(result["city"], "Kolkata")
        self.assertEqual(result["pincode"], "700107")
        self.assertIn("EM Bypass", result["formatted_address"])

    @patch("mappls.client.requests.get")
    @patch("mappls.client.requests.post")
    def test_nearby_search(self, mock_post, mock_get):
        mock_post.return_value = MagicMock(
            json=MagicMock(return_value={"access_token": "tok", "expires_in": 86400}),
            raise_for_status=MagicMock(),
        )
        mock_get.return_value = MagicMock(
            status_code=200,
            json=MagicMock(return_value={
                "suggestedLocations": [
                    {
                        "placeName": "AMRI Hospital",
                        "placeAddress": "JC Block, Salt Lake",
                        "latitude": "22.5750",
                        "longitude": "88.3680",
                        "distance": "0.5",
                        "type": "hospital",
                        "eLoc": "ABC123",
                    }
                ]
            }),
            raise_for_status=MagicMock(),
        )

        result = self.client.nearby_search(22.5726, 88.3639, keywords="hospital")
        self.assertTrue(result["success"])
        self.assertEqual(result["count"], 1)
        self.assertEqual(result["places"][0]["name"], "AMRI Hospital")

    @patch("mappls.client.requests.get")
    @patch("mappls.client.requests.post")
    def test_route_calculation(self, mock_post, mock_get):
        mock_post.return_value = MagicMock(
            json=MagicMock(return_value={"access_token": "tok", "expires_in": 86400}),
            raise_for_status=MagicMock(),
        )
        mock_get.return_value = MagicMock(
            status_code=200,
            json=MagicMock(return_value={
                "routes": [{
                    "distance": 5200,
                    "duration": 900,
                    "geometry": "encoded_polyline_string",
                }]
            }),
            raise_for_status=MagicMock(),
        )

        result = self.client.get_route(22.5726, 88.3639, 22.5800, 88.3700)
        self.assertTrue(result["success"])
        self.assertEqual(result["distance_km"], 5.2)
        self.assertEqual(result["duration_minutes"], 15.0)

    @patch("mappls.client.requests.get")
    @patch("mappls.client.requests.post")
    def test_live_traffic_route(self, mock_post, mock_get):
        mock_post.return_value = MagicMock(
            json=MagicMock(return_value={"access_token": "tok", "expires_in": 86400}),
            raise_for_status=MagicMock(),
        )
        mock_get.return_value = MagicMock(
            status_code=200,
            json=MagicMock(return_value={
                "routes": [{
                    "distance": 6000,
                    "duration": 1200,
                    "duration_typical": 900,
                    "geometry": "poly_traffic_encoded",
                }]
            }),
            raise_for_status=MagicMock(),
        )

        result = self.client.get_live_traffic(22.5726, 88.3639, 22.5850, 88.3750)
        self.assertTrue(result["success"])
        self.assertEqual(result["distance_km"], 6.0)
        self.assertEqual(result["live_duration_minutes"], 20.0)
        self.assertEqual(result["typical_duration_minutes"], 15.0)
        self.assertEqual(result["delay_minutes"], 5.0)
        self.assertEqual(result["congestion_level"], "MODERATE")

    def test_unconfigured_client(self):
        client = MapplsClient(api_key="", client_id="", client_secret="")
        self.assertFalse(client.is_configured)
        result = client.reverse_geocode(22.5726, 88.3639)
        self.assertFalse(result["success"])

    @patch("mappls.client.requests.get")
    @patch("mappls.client.requests.post")
    def test_geocode(self, mock_post, mock_get):
        mock_post.return_value = MagicMock(
            json=MagicMock(return_value={"access_token": "tok", "expires_in": 86400}),
            raise_for_status=MagicMock(),
        )
        mock_get.return_value = MagicMock(
            status_code=200,
            json=MagicMock(return_value={
                "copResults": {
                    "latitude": "22.5726",
                    "longitude": "88.3639",
                    "formattedAddress": "Howrah Bridge, Kolkata",
                    "eLoc": "XYZ789",
                }
            }),
            raise_for_status=MagicMock(),
        )

        result = self.client.geocode("Howrah Bridge, Kolkata")
        self.assertTrue(result["success"])
        self.assertAlmostEqual(result["latitude"], 22.5726)


class TestMapplsEnrichment(unittest.TestCase):
    def test_enrich_skips_when_not_configured(self):
        """Enrichment should complete gracefully with address information."""
        event = {
            "event_type": "POTHOLE",
            "location": {"latitude": 22.5726, "longitude": 88.3639},
            "timestamp": "2026-09-01T12:00:00+00:00",
        }
        result = enrich_event_with_address(event)
        self.assertEqual(result["event_type"], "POTHOLE")
        self.assertIn("location", result)

    def test_enrich_handles_missing_location(self):
        event = {"event_type": "POTHOLE", "location": {}}
        result = enrich_event_with_address(event)
        self.assertEqual(result["event_type"], "POTHOLE")


if __name__ == "__main__":
    unittest.main()
