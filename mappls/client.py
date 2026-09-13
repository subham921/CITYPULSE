"""CITYPULSE Mappls (MapMyIndia) API Client.

Provides authentication and wrappers for:
- Reverse Geocoding (GPS → street address)
- Nearby Search (find hospitals, police stations, landmarks near incidents)
- Routing (bus route distance and ETA)
- Geocoding & Text Search
- Interactive Map SDK configuration
"""

import time
import requests

from mappls.config import (
    MAPPLS_API_KEY,
    MAPPLS_CLIENT_ID,
    MAPPLS_CLIENT_SECRET,
)


class MapplsClient:
    """Handles Mappls authentication (API Key & OAuth2) and API wrappers."""

    TOKEN_URL = "https://outpost.mappls.com/api/security/oauth/token"
    REVERSE_GEOCODE_URL = "https://apis.mappls.com/advancedmaps/v1/{access_token}/rev_geocode"
    NEARBY_URL = "https://atlas.mappls.com/api/places/nearby/json"
    GEOCODE_URL = "https://atlas.mappls.com/api/places/geocode"
    ROUTE_URL = "https://apis.mappls.com/advancedmaps/v1/{access_token}/route_adv/driving/{coords}"

    def __init__(self, api_key=None, client_id=None, client_secret=None):
        if api_key is not None:
            self.api_key = api_key
        elif client_id and client_secret:
            self.api_key = None
        else:
            self.api_key = MAPPLS_API_KEY

        self.client_id = client_id if client_id is not None else MAPPLS_CLIENT_ID
        self.client_secret = client_secret if client_secret is not None else MAPPLS_CLIENT_SECRET
        self._access_token = None
        self._token_expiry = 0
        self.timeout = 10

    @property
    def is_configured(self):
        """Check if any API credential (API key or OAuth credentials) is set."""
        return bool(self.api_key or (self.client_id and self.client_secret))

    def _get_access_token(self):
        """Obtain access token via REST API key or OAuth2 credentials."""
        # 1. If an explicit REST API key is configured, use it directly
        if self.api_key:
            return self.api_key

        # 2. If cached OAuth token is still valid
        if self._access_token and time.time() < (self._token_expiry - 60):
            return self._access_token

        # 3. Request OAuth token with Client ID & Secret
        if self.client_id and self.client_secret:
            response = requests.post(
                self.TOKEN_URL,
                data={
                    "grant_type": "client_credentials",
                    "client_id": self.client_id,
                    "client_secret": self.client_secret,
                },
                timeout=self.timeout,
            )
            response.raise_for_status()
            data = response.json()
            self._access_token = data["access_token"]
            self._token_expiry = time.time() + int(data.get("expires_in", 86400))
            return self._access_token

        raise ValueError(
            "Mappls API credentials not configured. "
            "Set MAPPLS_API_KEY, or MAPPLS_CLIENT_ID & MAPPLS_CLIENT_SECRET."
        )

    def _headers(self):
        """Build authorization headers for Atlas API calls."""
        token = self._get_access_token()
        return {"Authorization": f"Bearer {token}"}

    # ── Reverse Geocoding ────────────────────────────────────────────

    def reverse_geocode(self, lat, lng):
        """Convert GPS coordinates to a human-readable address."""
        try:
            token = self._get_access_token()
            url = self.REVERSE_GEOCODE_URL.format(access_token=token)
            params = {"lat": lat, "lng": lng}
            response = requests.get(url, params=params, timeout=self.timeout)
            response.raise_for_status()
            data = response.json()

            results = data.get("results", [])
            if not results:
                return {"success": False, "error": "No address found for coordinates"}

            result = results[0]
            return {
                "success": True,
                "formatted_address": result.get("formatted_address", ""),
                "area": result.get("area", ""),
                "city": result.get("city", ""),
                "district": result.get("district", ""),
                "state": result.get("state", ""),
                "pincode": result.get("pincode", ""),
                "locality": result.get("locality", ""),
                "street": result.get("street", ""),
                "sub_locality": result.get("subLocality", ""),
                "village": result.get("village", ""),
            }
        except Exception as e:
            return {"success": False, "error": str(e)}

    # ── Nearby Search ────────────────────────────────────────────────

    def nearby_search(self, lat, lng, keywords="hospital", radius=2000):
        """Find nearby points of interest around a location."""
        try:
            params = {
                "keywords": keywords,
                "refLocation": f"{lat},{lng}",
                "radius": min(radius, 50000),
                "page": 1,
                "sort": "dist:asc",
            }
            response = requests.get(
                self.NEARBY_URL,
                params=params,
                headers=self._headers(),
                timeout=self.timeout,
            )
            response.raise_for_status()
            data = response.json()

            places = []
            for item in data.get("suggestedLocations", []):
                places.append({
                    "name": item.get("placeName", ""),
                    "address": item.get("placeAddress", ""),
                    "latitude": float(item.get("latitude", 0)),
                    "longitude": float(item.get("longitude", 0)),
                    "distance_meters": float(item.get("distance", 0)) * 1000,
                    "type": item.get("type", ""),
                    "mappls_pin": item.get("eLoc", ""),
                })

            return {"success": True, "count": len(places), "places": places}
        except Exception as e:
            return {"success": False, "error": str(e), "count": 0, "places": []}

    # ── Geocode (Address → Coordinates) ──────────────────────────────

    def geocode(self, address):
        """Convert a text address to GPS coordinates."""
        try:
            params = {"address": address}
            response = requests.get(
                self.GEOCODE_URL,
                params=params,
                headers=self._headers(),
                timeout=self.timeout,
            )
            response.raise_for_status()
            data = response.json()
            cops = data.get("copResults", {})
            if cops:
                return {
                    "success": True,
                    "latitude": float(cops.get("latitude", 0)),
                    "longitude": float(cops.get("longitude", 0)),
                    "formatted_address": cops.get("formattedAddress", ""),
                    "mappls_pin": cops.get("eLoc", ""),
                }
            return {"success": False, "error": "No geocoding results"}
        except Exception as e:
            return {"success": False, "error": str(e)}

    # ── Routing ──────────────────────────────────────────────────────

    def get_route(self, origin_lat, origin_lng, dest_lat, dest_lng):
        """Calculate driving route between two points."""
        try:
            token = self._get_access_token()
            coords = f"{origin_lng},{origin_lat};{dest_lng},{dest_lat}"
            url = self.ROUTE_URL.format(access_token=token, coords=coords)
            params = {
                "geometries": "polyline",
                "overview": "full",
                "steps": "false",
            }
            response = requests.get(url, params=params, timeout=self.timeout)
            response.raise_for_status()
            data = response.json()

            routes = data.get("routes", [])
            if not routes:
                return {"success": False, "error": "No route found"}

            route = routes[0]
            return {
                "success": True,
                "distance_km": round(route.get("distance", 0) / 1000.0, 2),
                "duration_minutes": round(route.get("duration", 0) / 60.0, 1),
                "geometry": route.get("geometry", ""),
            }
        except Exception as e:
            return {"success": False, "error": str(e)}

    # ── Live Traffic & Congestion ────────────────────────────────────

    def get_live_traffic(self, origin_lat, origin_lng, dest_lat, dest_lng):
        """Request live traffic flow, delay, and congestion from Mappls."""
        try:
            token = self._get_access_token()
            coords = f"{origin_lng},{origin_lat};{dest_lng},{dest_lat}"
            url = f"https://apis.mappls.com/advancedmaps/v1/{token}/route_traffic/driving/{coords}"
            params = {"geometries": "polyline", "overview": "full", "steps": "false"}
            response = requests.get(url, params=params, timeout=self.timeout)
            response.raise_for_status()
            data = response.json()

            routes = data.get("routes", [])
            if not routes:
                return {"success": False, "error": "No traffic route found"}

            route = routes[0]
            dist_km = round(route.get("distance", 0) / 1000.0, 2)
            dur_min = round(route.get("duration", 0) / 60.0, 1)
            traffic_dur = round(route.get("duration_typical", route.get("duration", 0)) / 60.0, 1)
            delay_min = max(0.0, round(dur_min - traffic_dur, 1))

            congestion = "LOW"
            if delay_min > 10:
                congestion = "SEVERE"
            elif delay_min > 5:
                congestion = "HEAVY"
            elif delay_min > 2:
                congestion = "MODERATE"

            return {
                "success": True,
                "distance_km": dist_km,
                "live_duration_minutes": dur_min,
                "typical_duration_minutes": traffic_dur,
                "delay_minutes": delay_min,
                "congestion_level": congestion,
                "geometry": route.get("geometry", ""),
            }
        except Exception as e:
            return {"success": False, "error": str(e)}




# Singleton instance
_default_client = None


def get_mappls_client(api_key=None, client_id=None, client_secret=None):
    """Get or create the shared MapplsClient instance."""
    global _default_client
    if (
        _default_client is None
        or (api_key is not None and api_key != _default_client.api_key)
        or (client_id is not None and client_id != _default_client.client_id)
    ):
        _default_client = MapplsClient(api_key=api_key, client_id=client_id, client_secret=client_secret)
    return _default_client
