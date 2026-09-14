// CITYPULSE REST Client & Mappls MapmyIndia API
const DEFAULT_LOCAL_BASE = '/api/v1';
export const RENDER_CLOUD_BASE = 'https://citypulse-backend-i0kh.onrender.com/api/v1';

export function getApiBase() {
  if (typeof window !== 'undefined') {
    const saved = localStorage.getItem('citypulse_api_base');
    if (saved) return saved;
  }
  return DEFAULT_LOCAL_BASE;
}

export function setApiBase(url) {
  if (typeof window !== 'undefined') {
    if (!url || url === DEFAULT_LOCAL_BASE) {
      localStorage.removeItem('citypulse_api_base');
    } else {
      localStorage.setItem('citypulse_api_base', url.replace(/\/+$/, ''));
    }
  }
}

export async function checkBackendHealth() {
  const base = getApiBase();
  const startTime = Date.now();
  try {
    const res = await fetch(`${base}/events/stats`, { cache: 'no-store' });
    const latency = Date.now() - startTime;
    if (res.ok) {
      const data = await res.json();
      return { ok: true, latency, events: data.total_events, base };
    }
    return { ok: false, latency, error: `HTTP ${res.status}`, base };
  } catch (err) {
    return { ok: false, latency: Date.now() - startTime, error: err.message, base };
  }
}

export async function fetchEvents(limit = 100) {
  const base = getApiBase();
  try {
    const res = await fetch(`${base}/events?limit=${limit}`);
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    const data = await res.json();
    return Array.isArray(data) ? data : (data.events || []);
  } catch (err) {
    console.warn('[API fetchEvents Error]', err.message);
    return [];
  }
}

export async function fetchStats() {
  const base = getApiBase();
  const res = await fetch(`${base}/events/stats`);
  if (!res.ok) throw new Error(`HTTP ${res.status}`);
  return res.json();
}

export async function fetchIntegrity() {
  const base = getApiBase();
  const res = await fetch(`${base}/events/integrity`);
  if (!res.ok) throw new Error(`HTTP ${res.status}`);
  return res.json();
}

export async function simulateUltrasonic(forceAbove = false, depth = null, corridor = null) {
  const base = getApiBase();
  let url = `${base}/sensors/ultrasonic/simulate?force_above_bumper=${forceAbove}`;
  if (depth) url += `&depth_cm=${depth}`;
  if (corridor) url += `&corridor=${encodeURIComponent(corridor)}`;
  const res = await fetch(url);
  if (!res.ok) throw new Error(`HTTP ${res.status}`);
  return res.json();
}

export async function submitCitizenReport(payload) {
  const base = getApiBase();
  const res = await fetch(`${base}/reports/citizen`, {
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
  const base = getApiBase();
  const res = await fetch(`${base}/upload-photo`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ data: base64Data })
  });
  if (!res.ok) throw new Error(`Upload failed HTTP ${res.status}`);
  return res.json();
}

export async function updateEventStatus(eventId, newStatus, role = 'TRANSPORT_AUTHORITY', note = '') {
  const base = getApiBase();
  const res = await fetch(`${base}/events/${eventId}/status`, {
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
  const base = getApiBase();
  try {
    const res = await fetch(`${base}/mappls/traffic/live-network`);
    if (!res.ok) return null;
    return res.json();
  } catch (e) {
    return null;
  }
}

// ─── Admin Portal Authentication ────────────────────────────────────

export async function loginAdmin(password) {
  const base = getApiBase();
  const res = await fetch(`${base}/auth/admin-login`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ password })
  });
  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new Error(err.detail || 'Invalid administrator credentials');
  }
  return res.json();
}

export async function verifyAdminSession(token) {
  const base = getApiBase();
  try {
    const res = await fetch(`${base}/auth/verify?token=${encodeURIComponent(token)}`);
    if (!res.ok) return { valid: false };
    return res.json();
  } catch (e) {
    return { valid: false };
  }
}

// ─── Mappls API Functions ──────────────────────────────────────────

export async function fetchMapplsToken() {
  const base = getApiBase();
  try {
    const res = await fetch(`${base}/mappls/token`);
    if (!res.ok) return null;
    return res.json();
  } catch (e) {
    return null;
  }
}

export async function fetchMapplsStatus() {
  const base = getApiBase();
  try {
    const res = await fetch(`${base}/mappls/status`);
    if (!res.ok) return null;
    return res.json();
  } catch (e) {
    return null;
  }
}

export async function updateMapplsCredentials(apiKey) {
  const base = getApiBase();
  const res = await fetch(`${base}/mappls/config/key`, {
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
  const base = getApiBase();
  const res = await fetch(`${base}/mappls/geocode?address=${encodeURIComponent(address)}`);
  if (!res.ok) throw new Error(`Geocode failed HTTP ${res.status}`);
  return res.json();
}

export async function searchMapplsNearby(lat, lng, keywords = 'hospital', radius = 3000) {
  const base = getApiBase();
  const res = await fetch(`${base}/mappls/nearby?lat=${lat}&lng=${lng}&keywords=${encodeURIComponent(keywords)}&radius=${radius}`);
  if (!res.ok) throw new Error(`Nearby search failed HTTP ${res.status}`);
  return res.json();
}

export async function fetchMapplsRoute(originLat, originLng, destLat, destLng) {
  const base = getApiBase();
  const res = await fetch(`${base}/mappls/route?origin_lat=${originLat}&origin_lng=${originLng}&dest_lat=${destLat}&dest_lng=${destLng}`);
  if (!res.ok) throw new Error(`Routing failed HTTP ${res.status}`);
  return res.json();
}
