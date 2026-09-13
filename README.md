# CITYPULSE

Pilot implementation for SIH26124: bus-mounted edge vision, sensor fusion,
offline event forwarding, a central GIS/event API, and a responsive authority
dashboard.

## Run the central platform

```powershell
python -m pip install -r backend/requirements.txt
python -m uvicorn backend.main:app --reload
```

Open `dashboard/index.html` in a browser (or serve the repository with a static
file server). The command-center dashboard refreshes automatically every 30
seconds. The REST API documentation is at `http://127.0.0.1:8000/docs`.

## Pilot safeguards

- Events are de-duplicated within 30 metres and 10 minutes.
- The immutable, edge-originated evidence packet for each event is linked to the
  preceding packet through a SHA-256 hash. Workflow updates remain separate;
  `GET /api/v1/events/integrity` verifies the chain.
- Incident status changes require an `X-CityPulse-Role` header; the roles are
  Transport Authority, Roads Department, Traffic Police, and Depot Admin.
- The API accepts evidence references, not full raw footage.
