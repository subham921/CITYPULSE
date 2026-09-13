"""CITYPULSE Location Enrichment Service (Mappls Exclusive).

Enriches raw GPS coordinates from bus events with human-readable address
information, nearby infrastructure, and live traffic strictly using the Mappls API.
"""

from mappls.client import get_mappls_client


def enrich_event_with_address(event):
    """Add street address information to a fused event's location field using Mappls.

    Args:
        event (dict): A fused CITYPULSE event with location.latitude/longitude.

    Returns:
        dict: The event dict enriched with Mappls address data if available.
    """
    location = event.get("location", {})
    lat = location.get("latitude")
    lng = location.get("longitude")
    if lat is None or lng is None:
        return event

    try:
        client = get_mappls_client()
        if client.is_configured:
            result = client.reverse_geocode(lat, lng)
            if result.get("success"):
                event["location"]["address"] = {
                    "formatted": result.get("formatted_address", f"{lat:.5f}, {lng:.5f}"),
                    "street": result.get("street", ""),
                    "area": result.get("area", ""),
                    "locality": result.get("locality", ""),
                    "city": result.get("city", ""),
                    "district": result.get("district", ""),
                    "state": result.get("state", ""),
                    "pincode": result.get("pincode", ""),
                }
    except Exception:
        pass

    return event


def find_nearby_infrastructure(lat, lng, radius=2000):
    """Find emergency and civic infrastructure near an incident location using Mappls."""
    client = get_mappls_client()
    categories = {
        "hospitals": "hospital",
        "police_stations": "police station",
        "bus_stops": "bus stop",
        "petrol_pumps": "petrol pump",
    }

    result = {"configured": client.is_configured, "latitude": lat, "longitude": lng, "radius_m": radius}

    if client.is_configured:
        for key, keyword in categories.items():
            search = client.nearby_search(lat, lng, keywords=keyword, radius=radius)
            if search.get("success"):
                result[key] = search.get("places", [])[:5]

    return result


def get_route_between_incidents(lat1, lng1, lat2, lng2):
    """Calculate driving route between two incident locations using Mappls."""
    client = get_mappls_client()
    if not client.is_configured:
        return {"configured": False, "message": "Mappls API not configured."}

    return client.get_route(lat1, lng1, lat2, lng2)


def get_live_traffic_info(lat1, lng1, lat2, lng2):
    """Get live traffic condition and delay between two points using Mappls."""
    client = get_mappls_client()
    if not client.is_configured:
        return {"configured": False, "message": "Mappls API not configured."}

    return client.get_live_traffic(lat1, lng1, lat2, lng2)
