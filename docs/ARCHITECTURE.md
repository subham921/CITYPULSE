# CITYPULSE pilot architecture

`ai/` processes camera frames; `edge/` fuses those detections with GPS and IMU,
buffers them while offline, and sends compact events to `backend/`. The backend
deduplicates nearby same-type reports, hash-chains evidence metadata, tracks the
authority review workflow, and exposes REST/GeoJSON feeds. `dashboard/` renders
the live command-center view using those feeds.

Raw footage is intentionally not uploaded by the API. An event can carry only a
thumbnail or short-clip reference, keeping the edge-to-cloud connection within
the PRD's bandwidth and privacy constraints.
