import requests

from config import BACKEND_URL, REQUEST_TIMEOUT


def send_event(event):
    """Upload one fused event, returning a result instead of raising network errors."""
    try:
        response = requests.post(BACKEND_URL, json=event, timeout=REQUEST_TIMEOUT)
        response.raise_for_status()
        return {"success": True, "status_code": response.status_code, "message": "Event uploaded successfully"}
    except requests.exceptions.RequestException as error:
        return {"success": False, "error": str(error)}
