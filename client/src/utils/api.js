// CITYPULSE REST Client
const API_BASE = '/api/v1';

export async function fetchEvents(limit = 100) {
  const res = await fetch(`${API_BASE}/events?limit=${limit}`);
  if (!res.ok) throw new Error(`HTTP ${res.status}`);
  return res.json();
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
