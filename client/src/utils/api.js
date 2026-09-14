// CITYPULSE REST Client & Mappls MapmyIndia API
const API_BASE = '/api/v1';

export async function fetchEvents(limit = 100) {
  try {
    const res = await fetch(`${API_BASE}/events?limit=${limit}`);
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    const data = await res.json();
    return Array.isArray(data) ? data : (data.events || []);
  } catch (err) {
    console.warn('[API fetchEvents Error]', err.message);
    return [];
  }
}

export async function fetchStats() {
  const res = await fetch(`${API_BASE}/events/stats`);
  if (!res.ok) throw new Error(`HTTP ${res.status}`);
  return res.json();
}

export async function fetchIntegrity() {
  const res = await fetch(`${API_BASE}/events/integrity`);
  if (!res.ok) throw new Error(`HTTP ${res.status}`);
  return res.json();
}

export async function simulateUltrasonic(forceAbove = false, depth = null, corridor = null) {
  let url = `${API_BASE}/sensors/ultrasonic/simulate?force_above_bumper=${forceAbove}`;
  if (depth) url += `&depth_cm=${depth}`;
  if (corridor) url += `&corridor=${encodeURIComponent(corridor)}`;
  const res = await fetch(url);
  if (!res.ok) throw new Error(`HTTP ${res.status}`);
  return res.json();
}

export async function submitCitizenReport(payload) {
  const res = await fetch(`${API_BASE}/reports/citizen`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(payload)
  });
  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new Error(err.detail || `HTTP ${res.status}`);
  }
  return res.json();
}

export async function uploadEvidencePhoto(base64Data) {
  const res = await fetch(`${API_BASE}/upload-photo`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ data: base64Data })
  });
  if (!res.ok) throw new Error(`Upload failed HTTP ${res.status}`);
  return res.json();
}

export async function updateEventStatus(eventId, newStatus, role = 'TRANSPORT_AUTHORITY', note = '') {
  const res = await fetch(`${API_BASE}/events/${eventId}/status`, {
    method: 'PATCH',
    headers: {
      'Content-Type': 'application/json',
      'X-CityPulse-Role': role
    },
    body: JSON.stringify({ status: newStatus, note })
  });
  if (!res.ok) throw new Error(`Update status failed HTTP ${res.status}`);
  return res.json();
}

export async function fetchCorridorTraffic() {
  try {
    const res = await fetch(`${API_BASE}/mappls/traffic/live-network`);
    if (!res.ok) return null;
    return res.json();
  } catch (e) {
    return null;
  }
}

// ─── Mappls API Functions ──────────────────────────────────────────

export async function fetchMapplsToken() {
  try {
    const res = await fetch(`${API_BASE}/mappls/token`);
    if (!res.ok) return null;
    return res.json();
  } catch (e) {
    return null;
  }
}

export async function fetchMapplsStatus() {
  try {
    const res = await fetch(`${API_BASE}/mappls/status`);
    if (!res.ok) return null;
    return res.json();
  } catch (e) {
    return null;
  }
}

export async function updateMapplsCredentials(apiKey) {
  const res = await fetch(`${API_BASE}/mappls/config/key`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ api_key: apiKey })
  });
  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new Error(err.detail || `HTTP ${res.status}`);
  }
  return res.json();
}

export async function searchMapplsGeocode(address) {
  const res = await fetch(`${API_BASE}/mappls/geocode?address=${encodeURIComponent(address)}`);
  if (!res.ok) throw new Error(`Geocode failed HTTP ${res.status}`);
  return res.json();
}

export async function searchMapplsNearby(lat, lng, keywords = 'hospital', radius = 3000) {
  const res = await fetch(`${API_BASE}/mappls/nearby?lat=${lat}&lng=${lng}&keywords=${encodeURIComponent(keywords)}&radius=${radius}`);
  if (!res.ok) throw new Error(`Nearby search failed HTTP ${res.status}`);
  return res.json();
}

export async function fetchMapplsRoute(originLat, originLng, destLat, destLng) {
  const res = await fetch(`${API_BASE}/mappls/route?origin_lat=${originLat}&origin_lng=${originLng}&dest_lat=${destLat}&dest_lng=${destLng}`);
  if (!res.ok) throw new Error(`Routing failed HTTP ${res.status}`);
  return res.json();
}
