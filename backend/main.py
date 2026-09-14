"""CITYPULSE central API: trusted event ingestion, workflow, and GIS analytics.

This service is deliberately usable without cloud infrastructure for a pilot. The
JSON repository can be replaced by PostGIS/message-broker adapters at deployment
time without changing its public REST contract.
"""

import base64
import copy
from datetime import datetime, timedelta, timezone
from enum import Enum
import hashlib
import json
import math
import os
from pathlib import Path
import random
import time
from typing import Any, Dict, List, Optional
from uuid import uuid4
import requests

from fastapi import FastAPI, Header, HTTPException, Query
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import FileResponse
from fastapi.staticfiles import StaticFiles
from pydantic import BaseModel, Field, field_validator

from mappls.client import get_mappls_client
from mappls.enrichment import enrich_event_with_address, find_nearby_infrastructure, get_route_between_incidents, get_live_traffic_info
from mappls.traffic_engine import get_live_corridor_network

# Auto-load .env if present
ENV_PATH = Path(__file__).parent.parent / ".env"
if ENV_PATH.exists():
    with ENV_PATH.open("r", encoding="utf-8") as _f:
        for _line in _f:
            _line = _line.strip()
            if _line and not _line.startswith("#") and "=" in _line:
                _k, _v = _line.split("=", 1)
                _k = _k.strip()
                _v = _v.strip().strip('"').strip("'")
                if _k not in os.environ:
                    os.environ[_k] = _v

app = FastAPI(title="CITYPULSE Urban Intelligence API", description="Bandwidth-efficient event ingestion, evidence workflow, and map analytics.", version="1.1.0")
app.add_middleware(CORSMiddleware, allow_origins=["*"], allow_credentials=True, allow_methods=["*"], allow_headers=["*"])

# Local Uploads Directory for Evidence & Citizen Photos
UPLOADS_DIR = Path(__file__).parent.parent / "dashboard" / "uploads"
UPLOADS_DIR.mkdir(parents=True, exist_ok=True)

DASHBOARD_DIR = Path(__file__).parent.parent / "dashboard"
if DASHBOARD_DIR.exists():
    app.mount("/static", StaticFiles(directory=str(DASHBOARD_DIR)), name="static")
    app.mount("/uploads", StaticFiles(directory=str(UPLOADS_DIR)), name="uploads")
    app.mount("/app", StaticFiles(directory=str(DASHBOARD_DIR), html=True), name="dashboard_app")
    assets_dir = DASHBOARD_DIR / "assets"
    assets_dir.mkdir(exist_ok=True)
    app.mount("/assets", StaticFiles(directory=str(assets_dir)), name="assets")

DATA_FILE = Path(__file__).parent.parent / "data" / "events.json"
DATA_FILE.parent.mkdir(exist_ok=True)
DEDUP_RADIUS_METERS, DEDUP_WINDOW_MINUTES = 30, 10
MUTABLE_WORKFLOW_FIELDS = {"status", "status_history", "report_count", "last_reported_at", "evidence_hash", "previous_evidence_hash"}

# Supabase (PostgreSQL / PostGIS) configuration
SUPABASE_URL = os.getenv("SUPABASE_URL", "").rstrip("/")
SUPABASE_KEY = os.getenv("SUPABASE_SERVICE_ROLE_KEY") or os.getenv("SUPABASE_KEY", "")

# Admin Portal Authentication Secret
ADMIN_PASSWORD = os.getenv("ADMIN_PASSWORD", "admin123")
ADMIN_SESSION_TOKEN = hashlib.sha256(ADMIN_PASSWORD.encode()).hexdigest()


def normalize_severity(sev: Optional[str]) -> str:
    s = str(sev or "").upper()
    if s in ("CRITICAL", "HIGH", "SEVERE"):
        return "SEVERE"
    if s in ("LOW", "MINOR"):
        return "LOW"
    return "MODERATE"


class EventStatus(str, Enum):
    NEW = "NEW"
    UNDER_REVIEW = "UNDER_REVIEW"
    ACTIONED = "ACTIONED"
    DISMISSED = "DISMISSED"


class Role(str, Enum):
    TRANSPORT_AUTHORITY = "TRANSPORT_AUTHORITY"
    ROADS_DEPARTMENT = "ROADS_DEPARTMENT"
    TRAFFIC_POLICE = "TRAFFIC_POLICE"
    DEPOT_ADMIN = "DEPOT_ADMIN"


class LocationModel(BaseModel):
    latitude: float = Field(ge=-90, le=90)
    longitude: float = Field(ge=-180, le=180)


class GPSModel(BaseModel):
    speed_kmh: float = Field(default=0.0, ge=0)


class IMUModel(BaseModel):
    acceleration_z: float = 1.0
    shock_detected: bool = False
    shock_level: str = "NORMAL"


class VisionModel(BaseModel):
    confidence: float = Field(ge=0, le=1)
    bbox: List[int] = Field(default_factory=list)


class FusionModel(BaseModel):
    time_match: bool = True
    confidence: float = Field(ge=0, le=1)


class EvidenceModel(BaseModel):
    """Compact evidence references only; raw footage remains on the edge unit."""
    thumbnail_url: Optional[str] = None
    clip_url: Optional[str] = None
    plate_number: Optional[str] = None
    plate_confidence: Optional[float] = Field(default=None, ge=0, le=1)


class UltrasonicModel(BaseModel):
    """Real-time ultrasonic sonar telemetry for road flood and waterlogging detection."""
    water_depth_cm: float = Field(default=0.0, ge=0, description="Detected water depth in centimeters")
    bumper_clearance_cm: float = Field(default=35.0, ge=0, description="Bus bumper ground clearance in cm (typically 35cm)")
    above_bumper: bool = Field(default=False, description="True if water level exceeds bus bumper clearance")
    flood_risk_level: str = Field(default="NORMAL", description="NORMAL, WARNING, or CRITICAL")
    sensor_id: str = Field(default="US-SONAR-01", description="Ultrasonic transducer hardware ID")
    ping_interval_ms: int = Field(default=250, description="Sonar echo pulse interval in milliseconds")


class RoadEvent(BaseModel):
    event_type: str
    bus_id: str = Field(default="BUS101", min_length=1, max_length=64)
    route_id: Optional[str] = Field(default=None, max_length=64)
    timestamp: str
    location: LocationModel
    gps: GPSModel = Field(default_factory=GPSModel)
    imu: IMUModel = Field(default_factory=IMUModel)
    vision: VisionModel
    fusion: FusionModel
    severity: Optional[str] = None
    evidence: Optional[EvidenceModel] = None
    pothole_details: Optional[Dict[str, Any]] = None
    near_miss_details: Optional[Dict[str, Any]] = None
    divider_details: Optional[Dict[str, Any]] = None
    congestion_details: Optional[Dict[str, Any]] = None
    pedestrian_details: Optional[Dict[str, Any]] = None
    ultrasonic: Optional[UltrasonicModel] = None
    waterlogged_details: Optional[Dict[str, Any]] = None

    @field_validator("event_type")
    @classmethod
    def normalize_event_type(cls, value: str) -> str:
        return value.strip().upper().replace(" ", "_")


class StatusUpdate(BaseModel):
    status: EventStatus
    note: Optional[str] = Field(default=None, max_length=1000)


class CitizenReport(BaseModel):
    event_type: str
    latitude: float = Field(ge=-90, le=90)
    longitude: float = Field(ge=-180, le=180)
    severity: str = "MODERATE"
    description: Optional[str] = None
    reporter_name: Optional[str] = "Citizen"
    photo_url: Optional[str] = None


class PhotoUploadRequest(BaseModel):
    data: str  # Base64 data URI (e.g. data:image/jpeg;base64,...) or raw base64
    filename: Optional[str] = None


class AdminAuthRequest(BaseModel):
    password: str


class UltrasonicReadingRequest(BaseModel):
    """Payload sent by edge bus ultrasonic sensor unit."""
    bus_id: str = Field(default="BUS101")
    route_id: Optional[str] = Field(default="ROUTE_12")
    latitude: Optional[float] = Field(default=22.5726, ge=-90, le=90)
    longitude: Optional[float] = Field(default=88.3639, ge=-180, le=180)
    water_depth_cm: float = Field(..., ge=0, description="Sonar sensed water level above road surface in cm")
    bumper_clearance_cm: float = Field(default=35.0, ge=0, description="Bus bumper ground clearance in cm (typically 35cm)")
    sensor_id: str = Field(default="US-SONAR-01", description="Ultrasonic transducer ID")
    speed_kmh: Optional[float] = Field(default=24.0, ge=0)


def utc_now() -> str:
    return datetime.now(timezone.utc).isoformat()


def parse_time(value: str) -> Optional[datetime]:
    try:
        return datetime.fromisoformat(value.replace("Z", "+00:00"))
    except (AttributeError, ValueError):
        return None


_EVENTS_CACHE: Dict[str, Any] = {"timestamp": 0.0, "events": []}
_CACHE_TTL_SECONDS = 3.0


def invalidate_events_cache() -> None:
    global _EVENTS_CACHE
    _EVENTS_CACHE = {"timestamp": 0.0, "events": []}


def load_all_events() -> List[dict]:
    global _EVENTS_CACHE
    now = time.time()
    if _EVENTS_CACHE["events"] and (now - _EVENTS_CACHE["timestamp"]) < _CACHE_TTL_SECONDS:
        return [dict(e) for e in _EVENTS_CACHE["events"]]

    # 1. Load local events first
    local_events: List[dict] = []
    if DATA_FILE.exists():
        try:
            with DATA_FILE.open("r", encoding="utf-8") as file:
                payload = json.load(file)
                if isinstance(payload, list):
                    local_events = payload
        except Exception as err:
            print(f"[CITYPULSE] Local events read error: {err}")
            local_events = []

    # 2. If Supabase credentials are provided, fetch from Supabase and merge
    if SUPABASE_URL and SUPABASE_KEY:
        try:
            headers = {"apikey": SUPABASE_KEY, "Authorization": f"Bearer {SUPABASE_KEY}"}
            res = requests.get(f"{SUPABASE_URL}/rest/v1/events?select=*&order=timestamp.desc", headers=headers, timeout=2.5)
            if res.ok:
                items = res.json()
                if isinstance(items, list):
                    merged: Dict[str, dict] = {}
                    # Index Supabase events by event_id
                    for item in items:
                        eid = item.get("event_id") or item.get("id")
                        if not eid:
                            continue
                        if not item.get("evidence"):
                            thumb = (item.get("citizen_details") or {}).get("photo_url")
                            if thumb:
                                item["evidence"] = {"thumbnail_url": thumb, "clip_url": None, "plate_number": None}
                        c_info = item.get("citizen_details") or {}
                        if c_info.get("real_event_type") == "WATERLOGGED" or c_info.get("ultrasonic") or item.get("ultrasonic"):
                            item["event_type"] = "WATERLOGGED"
                            if c_info.get("ultrasonic") and not item.get("ultrasonic"):
                                item["ultrasonic"] = c_info["ultrasonic"]
                            if c_info.get("waterlogged_details") and not item.get("waterlogged_details"):
                                item["waterlogged_details"] = c_info["waterlogged_details"]
                        merged[eid] = item

                    # Merge local events (local records are authoritative for sealed cryptographic evidence)
                    for lev in local_events:
                        eid = lev.get("event_id") or lev.get("id")
                        if not eid:
                            continue
                        if eid in merged:
                            remote = merged[eid]
                            if remote.get("status") and remote.get("status") != lev.get("status"):
                                lev["status"] = remote["status"]
                            if remote.get("status_history") and len(remote.get("status_history", [])) > len(lev.get("status_history", [])):
                                lev["status_history"] = remote["status_history"]
                        merged[eid] = lev

                    all_events = list(merged.values())
                    all_events.sort(key=lambda x: str(x.get("timestamp", "")))
                    _EVENTS_CACHE = {"timestamp": now, "events": all_events}
                    return [dict(e) for e in all_events]
        except Exception as e:
            print(f"[CITYPULSE] Supabase query fallback to local: {e}")

    # Fallback to local events (ensure evidence thumbnail is populated)
    for lev in local_events:
        if not lev.get("evidence"):
            thumb = (lev.get("citizen_details") or {}).get("photo_url")
            if thumb:
                lev["evidence"] = {"thumbnail_url": thumb, "clip_url": None, "plate_number": None}
    local_events.sort(key=lambda x: str(x.get("timestamp", "")))
    _EVENTS_CACHE = {"timestamp": now, "events": local_events}
    return [dict(e) for e in local_events]


def save_all_events(events: List[dict]) -> None:
    """Write through a temporary file to avoid corrupting the local store."""
    invalidate_events_cache()
    temp_file = DATA_FILE.with_suffix(".tmp")
    with temp_file.open("w", encoding="utf-8") as file:
        json.dump(events, file, indent=2)
    temp_file.replace(DATA_FILE)

    # Sync to Supabase if configured (matching exact columns of Supabase events table)
    if SUPABASE_URL and SUPABASE_KEY and events:
        try:
            headers = {
                "apikey": SUPABASE_KEY,
                "Authorization": f"Bearer {SUPABASE_KEY}",
                "Content-Type": "application/json",
                "Prefer": "resolution=merge-duplicates"
            }
            recent = events[-10:]
            payload = []
            for ev in recent:
                loc = ev.get("location") or {}
                lat = loc.get("latitude") or ev.get("latitude", 22.5726)
                lng = loc.get("longitude") or ev.get("longitude", 88.3639)
                addr = loc.get("address", {}).get("formatted") or ev.get("address") or f"{lat:.5f}, {lng:.5f}"

                citizen_info = copy.deepcopy(ev.get("citizen_details") or {})
                # Capture photo_url in citizen_details JSONB for Supabase persistence
                photo_url = (ev.get("evidence") or {}).get("thumbnail_url")
                if photo_url and not citizen_info.get("photo_url"):
                    citizen_info["photo_url"] = photo_url
                if ev.get("ultrasonic") and "ultrasonic" not in citizen_info:
                    citizen_info["ultrasonic"] = ev["ultrasonic"]
                if ev.get("waterlogged_details") and "waterlogged_details" not in citizen_info:
                    citizen_info["waterlogged_details"] = ev["waterlogged_details"]

                raw_ev_type = ev.get("event_type", "POTHOLE")
                supa_ev_type = raw_ev_type
                if raw_ev_type == "WATERLOGGED":
                    supa_ev_type = "ROAD_DISTRESS"
                    citizen_info["real_event_type"] = "WATERLOGGED"

                payload.append({
                    "event_id": ev["event_id"],
                    "event_type": supa_ev_type,
                    "status": ev.get("status", "NEW"),
                    "severity": normalize_severity(ev.get("severity")),
                    "bus_id": ev.get("bus_id", "CITIZEN_PORTAL"),
                    "route_id": ev.get("route_id", "PUBLIC_FEED"),
                    "latitude": float(lat),
                    "longitude": float(lng),
                    "address": addr,
                    "location": loc,
                    "gps": ev.get("gps", {}),
                    "imu": ev.get("imu", {}),
                    "vision": ev.get("vision", {}),
                    "fusion": ev.get("fusion", {}),
                    "pothole_details": ev.get("pothole_details"),
                    "near_miss_details": ev.get("near_miss_details"),
                    "divider_details": ev.get("divider_details"),
                    "citizen_details": citizen_info,
                    "report_count": ev.get("report_count", 1),
                    "status_history": ev.get("status_history", []),
                    "evidence_hash": ev.get("evidence_hash"),
                    "previous_evidence_hash": ev.get("previous_evidence_hash"),
                    "timestamp": ev.get("timestamp"),
                    "last_reported_at": ev.get("last_reported_at") or ev.get("timestamp"),
                })
            res = requests.post(f"{SUPABASE_URL}/rest/v1/events", headers=headers, json=payload, timeout=4)
            if not res.ok:
                print(f"[CITYPULSE] Supabase sync returned status {res.status_code}: {res.text}")
        except Exception as err:
            print(f"[CITYPULSE] Supabase sync error: {err}")


def distance_meters(first: dict, second: dict) -> float:
    if not all(key in first for key in ("latitude", "longitude")) or not all(key in second for key in ("latitude", "longitude")):
        return float("inf")
    lat1, lon1 = math.radians(first["latitude"]), math.radians(first["longitude"])
    lat2, lon2 = math.radians(second["latitude"]), math.radians(second["longitude"])
    a = math.sin((lat2 - lat1) / 2) ** 2 + math.cos(lat1) * math.cos(lat2) * math.sin((lon2 - lon1) / 2) ** 2
    return 6_371_000 * 2 * math.atan2(math.sqrt(a), math.sqrt(1 - a))


def event_severity(event: dict) -> str:
    # Check ultrasonic sensor or waterlogged details first for physical flood risks
    if event.get("event_type") == "WATERLOGGED" or event.get("ultrasonic") or event.get("waterlogged_details"):
        us = event.get("ultrasonic") or event.get("waterlogged_details") or {}
        depth = float(us.get("water_depth_cm", 0.0))
        clearance = float(us.get("bumper_clearance_cm", 35.0))
        above = us.get("above_bumper", depth >= clearance)
        if above or depth >= clearance:
            return "SEVERE"
        if event.get("severity"):
            return str(event["severity"]).upper()
        return "MODERATE" if depth >= 15.0 else "LOW"

    if event.get("severity"):
        return str(event["severity"]).upper()
    details = event.get("pothole_details") or event.get("near_miss_details") or event.get("divider_details") or {}
    return str(details.get("severity") or details.get("risk_level") or details.get("hazard_level") or "MODERATE").upper()


def find_duplicate(event: dict, events: List[dict]) -> Optional[dict]:
    incoming_time = parse_time(event.get("timestamp", ""))
    if not incoming_time:
        return None
    for existing in reversed(events):
        if existing.get("event_type") != event["event_type"]:
            continue
        previous_time = parse_time(existing.get("timestamp", ""))
        if not previous_time or abs(incoming_time - previous_time) > timedelta(minutes=DEDUP_WINDOW_MINUTES):
            continue
        if distance_meters(event["location"], existing.get("location", {})) <= DEDUP_RADIUS_METERS:
            return existing
    return None


DATABASE_INJECTED_FIELDS = {"id", "geom", "created_at"}


def get_sealed_event(event: dict) -> dict:
    return {
        key: value for key, value in event.items()
        if key not in MUTABLE_WORKFLOW_FIELDS and key not in DATABASE_INJECTED_FIELDS and value is not None
    }


def append_integrity_fields(event: dict, events: List[dict]) -> dict:
    previous_hash = events[-1].get("evidence_hash", "GENESIS") if events else "GENESIS"
    # Workflow state is deliberately excluded: authorities can progress a case
    # without altering the edge-originated evidence packet it refers to.
    sealed_event = get_sealed_event(event)
    canonical = json.dumps(sealed_event, sort_keys=True, separators=(",", ":"))
    event["evidence_hash"] = hashlib.sha256(f"{previous_hash}:{canonical}".encode()).hexdigest()
    event["previous_evidence_hash"] = previous_hash
    return event


@app.get("/api/v1/events/integrity")
def verify_evidence_chain():
    """Verify the immutable evidence portion of every current pilot event."""
    previous_hash = "GENESIS"
    invalid_event_ids = []
    verified = 0
    for event in load_all_events():
        if not event.get("evidence_hash"):
            continue
        sealed_event = get_sealed_event(event)
        canonical = json.dumps(sealed_event, sort_keys=True, separators=(",", ":"))
        calculated = hashlib.sha256(f"{previous_hash}:{canonical}".encode()).hexdigest()
        prev_specified = event.get("previous_evidence_hash", "GENESIS")
        calculated_with_specified = hashlib.sha256(f"{prev_specified}:{canonical}".encode()).hexdigest()

        if event.get("evidence_hash") == calculated or event.get("evidence_hash") == calculated_with_specified:
            verified += 1
            previous_hash = event.get("evidence_hash", previous_hash)
        else:
            # Check legacy sealed formatting
            legacy_sealed = {key: value for key, value in event.items() if key not in MUTABLE_WORKFLOW_FIELDS}
            legacy_canon = json.dumps(legacy_sealed, sort_keys=True, separators=(",", ":"))
            if event.get("evidence_hash") in (
                hashlib.sha256(f"{previous_hash}:{legacy_canon}".encode()).hexdigest(),
                hashlib.sha256(f"{prev_specified}:{legacy_canon}".encode()).hexdigest()
            ):
                verified += 1
                previous_hash = event.get("evidence_hash", previous_hash)
            else:
                invalid_event_ids.append(event.get("event_id", "UNKNOWN"))
                previous_hash = event.get("evidence_hash", previous_hash)
    return {"valid": not invalid_event_ids, "verified_events": verified, "invalid_event_ids": invalid_event_ids}


def require_role(x_citypulse_role: Optional[str]) -> Role:
    """Pilot RBAC guard. Replace header trust with OIDC claims in production."""
    if not x_citypulse_role:
        raise HTTPException(status_code=401, detail="X-CityPulse-Role header is required")
    try:
        return Role(x_citypulse_role.upper())
    except ValueError as exc:
        raise HTTPException(status_code=403, detail="Unknown CITYPULSE role") from exc


@app.get("/health")
@app.get("/api/v1/health")
def health_check():
    return {"status": "healthy", "service": "CITYPULSE-backend", "timestamp": utc_now()}


@app.post("/api/v1/events", status_code=201)
def ingest_event(event: RoadEvent):
    """Accept a compact event and deduplicate fleet reports for the same location."""
    events = load_all_events()
    event_dict = event.model_dump(exclude_none=True)
    duplicate = find_duplicate(event_dict, events)
    if duplicate:
        duplicate["report_count"] = int(duplicate.get("report_count", 1)) + 1
        duplicate["last_reported_at"] = event_dict["timestamp"]
        save_all_events(events)
        return {"status": "deduplicated", "event_id": duplicate.get("event_id"), "report_count": duplicate["report_count"]}
    event_dict.update({"event_id": str(uuid4()), "status": EventStatus.NEW.value, "status_history": [{"status": EventStatus.NEW.value, "at": utc_now(), "note": "Received from edge unit"}], "report_count": 1, "last_reported_at": event_dict["timestamp"], "severity": event_severity(event_dict)})
    # Enrich with Mappls reverse geocoding (street address, area, city, pincode)
    enrich_event_with_address(event_dict)
    events.append(append_integrity_fields(event_dict, events))
    save_all_events(events)
    return {"status": "success", "event_id": event_dict["event_id"], "event_type": event_dict["event_type"], "total_events": len(events)}


@app.post("/api/v1/reports/citizen", status_code=201)
def submit_citizen_report(report: CitizenReport):
    """Ingest citizen hazard report from user reporting dashboard."""
    raw_type = report.event_type.strip().upper().replace(" ", "_")
    event_dict = {
        "event_id": str(uuid4()),
        "event_type": raw_type,
        "bus_id": "CITIZEN_PORTAL",
        "route_id": "PUBLIC_FEED",
        "timestamp": utc_now(),
        "location": {
            "latitude": report.latitude,
            "longitude": report.longitude,
        },
        "gps": {"speed_kmh": 0.0},
        "imu": {
            "acceleration_z": 1.0,
            "shock_detected": False,
            "shock_level": "NORMAL",
        },
        "vision": {
            "confidence": 0.90,
            "bbox": [],
        },
        "fusion": {
            "time_match": True,
            "confidence": 0.90,
        },
        "severity": report.severity.upper(),
        "evidence": {
            "thumbnail_url": report.photo_url,
            "clip_url": None,
            "plate_number": None,
        },
        "status": EventStatus.NEW.value,
        "status_history": [{
            "status": EventStatus.NEW.value,
            "at": utc_now(),
            "note": f"Reported by {report.reporter_name or 'Citizen'}: {report.description or 'Hazard spotted on road'}",
        }],
        "report_count": 1,
        "last_reported_at": utc_now(),
        "citizen_details": {
            "reporter_name": report.reporter_name or "Citizen Reporter",
            "description": report.description or "",
            "photo_url": report.photo_url,
        },
    }

    # Enrich with Mappls reverse geocoding
    enrich_event_with_address(event_dict)

    events = load_all_events()
    event_dict = append_integrity_fields(event_dict, events)
    events.append(event_dict)
    save_all_events(events)

    return {
        "status": "success",
        "event_id": event_dict["event_id"],
        "event_type": event_dict["event_type"],
        "block_hash": event_dict.get("block_hash", ""),
        "address": event_dict.get("location", {}).get("address", {}).get("formatted", f"{report.latitude:.5f}, {report.longitude:.5f}"),
        "timestamp": event_dict["timestamp"],
        "event": event_dict,
    }


KOLKATA_FLOOD_CORRIDORS = [
    {"name": "College Street / MG Road Crossing", "lat": 22.5744, "lng": 88.3629, "route": "ROUTE_32"},
    {"name": "Amherst Street (St. Paul's Cathedral Road)", "lat": 22.5802, "lng": 88.3711, "route": "ROUTE_12"},
    {"name": "Park Circus Seven Point Crossing", "lat": 22.5448, "lng": 88.3672, "route": "ROUTE_24"},
    {"name": "Central Avenue (CR Avenue / Chittaranjan)", "lat": 22.5835, "lng": 88.3582, "route": "ROUTE_08"},
    {"name": "Thanthania Kalibari / Bidhan Sarani", "lat": 22.5861, "lng": 88.3667, "route": "ROUTE_15"},
    {"name": "EM Bypass - Chingrighata Flyover Base", "lat": 22.5612, "lng": 88.4024, "route": "ROUTE_AC47"},
    {"name": "Behala Chowrasta / Diamond Harbour Rd", "lat": 22.4988, "lng": 88.3114, "route": "ROUTE_14"},
]


@app.post("/api/v1/sensors/ultrasonic/reading", status_code=200)
def ingest_ultrasonic_reading(req: UltrasonicReadingRequest):
    """Receive live telemetry from edge bus ultrasonic sonar sensor.
    
    If water depth exceeds bus bumper ground clearance (35cm), an automatic
    authoritative WATERLOGGED hazard alert is created and ingested.
    """
    above_bumper = req.water_depth_cm >= req.bumper_clearance_cm
    depth_diff = round(req.water_depth_cm - req.bumper_clearance_cm, 1)
    risk_level = "CRITICAL" if above_bumper else ("WARNING" if req.water_depth_cm >= 15.0 else "NORMAL")

    telemetry = {
        "sensor_id": req.sensor_id,
        "water_depth_cm": req.water_depth_cm,
        "bumper_clearance_cm": req.bumper_clearance_cm,
        "above_bumper": above_bumper,
        "clearance_overflow_cm": depth_diff if above_bumper else 0.0,
        "flood_risk_level": risk_level,
        "timestamp": utc_now(),
        "bus_id": req.bus_id,
        "route_id": req.route_id,
    }

    if not above_bumper:
        return {
            "status": "telemetry_logged",
            "alert_created": False,
            "above_bumper": False,
            "water_depth_cm": req.water_depth_cm,
            "bumper_clearance_cm": req.bumper_clearance_cm,
            "flood_risk_level": risk_level,
            "message": f"Water depth {req.water_depth_cm}cm is within safe clearance (< {req.bumper_clearance_cm}cm bus bumper).",
            "telemetry": telemetry,
        }

    # Water is above bus bumper -> Create and ingest WATERLOGGED incident
    event_dict = {
        "event_id": str(uuid4()),
        "event_type": "WATERLOGGED",
        "bus_id": req.bus_id,
        "route_id": req.route_id or "ROUTE_WATERLOGGED",
        "timestamp": utc_now(),
        "location": {
            "latitude": req.latitude or 22.5726,
            "longitude": req.longitude or 88.3639,
        },
        "gps": {"speed_kmh": req.speed_kmh or 15.0},
        "imu": {
            "acceleration_z": 1.0,
            "shock_detected": False,
            "shock_level": "NORMAL",
        },
        "vision": {
            "confidence": 0.94,
            "bbox": [],
        },
        "fusion": {
            "time_match": True,
            "confidence": 0.96,
        },
        "severity": "SEVERE",
        "ultrasonic": {
            "water_depth_cm": req.water_depth_cm,
            "bumper_clearance_cm": req.bumper_clearance_cm,
            "above_bumper": True,
            "flood_risk_level": "CRITICAL",
            "sensor_id": req.sensor_id,
            "ping_interval_ms": 250,
        },
        "waterlogged_details": {
            "water_depth_cm": req.water_depth_cm,
            "bumper_clearance_cm": req.bumper_clearance_cm,
            "above_bumper": True,
            "clearance_overflow_cm": depth_diff,
            "flood_risk_level": "CRITICAL",
            "sensor_id": req.sensor_id,
            "engine_immersion_risk": True,
            "hazard_advisory": f"WATERLOGGED: Sonar detects {req.water_depth_cm}cm water level (+{depth_diff}cm above {req.bumper_clearance_cm}cm bumper). High risk of engine hydro-lock and brake fade.",
        },
        "status": EventStatus.NEW.value,
        "status_history": [{
            "status": EventStatus.NEW.value,
            "at": utc_now(),
            "note": f"Ultrasonic Sonar ({req.sensor_id}) triggered WATERLOGGED alert: {req.water_depth_cm}cm water level exceeds {req.bumper_clearance_cm}cm bumper clearance by +{depth_diff}cm on {req.bus_id}."
        }],
        "report_count": 1,
        "last_reported_at": utc_now(),
    }

    # Enrich with Mappls address
    enrich_event_with_address(event_dict)

    events = load_all_events()
    event_dict = append_integrity_fields(event_dict, events)
    events.append(event_dict)
    save_all_events(events)

    return {
        "status": "alert_created",
        "alert_created": True,
        "above_bumper": True,
        "water_depth_cm": req.water_depth_cm,
        "bumper_clearance_cm": req.bumper_clearance_cm,
        "clearance_overflow_cm": depth_diff,
        "flood_risk_level": "CRITICAL",
        "event_id": event_dict["event_id"],
        "event_type": "WATERLOGGED",
        "severity": "SEVERE",
        "address": event_dict.get("location", {}).get("address", {}).get("formatted", f"{req.latitude:.5f}, {req.longitude:.5f}"),
        "telemetry": telemetry,
        "event": event_dict,
    }


@app.get("/api/v1/sensors/ultrasonic/simulate")
@app.post("/api/v1/sensors/ultrasonic/simulate")
def simulate_ultrasonic_sensor(
    force_above_bumper: Optional[bool] = Query(None, description="Force water depth above 35cm bumper threshold"),
    water_depth_cm: Optional[float] = Query(None, description="Explicit water depth in cm"),
    bus_id: Optional[str] = Query(None, description="Simulated bus identifier")
):
    """Simulate a random ultrasonic sensor reading along Kolkata transit corridors."""
    target_bus = bus_id or f"BUS{random.choice(['101', '104', '204', '308', '412', '505'])}"
    corridor = random.choice(KOLKATA_FLOOD_CORRIDORS)

    # Small geographic jitter (+- 0.0015 deg ~ 120m)
    lat = round(corridor["lat"] + random.uniform(-0.0015, 0.0015), 6)
    lng = round(corridor["lng"] + random.uniform(-0.0015, 0.0015), 6)

    bumper_clearance = 35.0

    if water_depth_cm is not None:
        depth = round(float(water_depth_cm), 1)
    elif force_above_bumper is True:
        depth = round(random.uniform(36.5, 62.0), 1)
    elif force_above_bumper is False:
        depth = round(random.uniform(8.0, 31.0), 1)
    else:
        # Default random simulator: 65% chance above bumper during monsoon simulation
        if random.random() < 0.65:
            depth = round(random.uniform(36.0, 58.5), 1)
        else:
            depth = round(random.uniform(10.0, 33.0), 1)

    reading_req = UltrasonicReadingRequest(
        bus_id=target_bus,
        route_id=corridor["route"],
        latitude=lat,
        longitude=lng,
        water_depth_cm=depth,
        bumper_clearance_cm=bumper_clearance,
        sensor_id="US-SONAR-01",
        speed_kmh=round(random.uniform(12.0, 26.0), 1),
    )

    res = ingest_ultrasonic_reading(reading_req)
    res["corridor_name"] = corridor["name"]
    res["simulation"] = True
    return res


@app.post("/api/v1/upload-photo")
def upload_photo(upload: PhotoUploadRequest):
    """Save an evidence photo uploaded from Citizen or Admin portal."""
    data_str = upload.data.strip()
    if not data_str:
        raise HTTPException(status_code=400, detail="No image data provided")

    # Detect extension and strip data URI header if present
    ext = "jpg"
    if data_str.startswith("data:image/"):
        header, base64_data = data_str.split(",", 1)
        if "png" in header:
            ext = "png"
        elif "webp" in header:
            ext = "webp"
        elif "gif" in header:
            ext = "gif"
    else:
        base64_data = data_str

    try:
        image_bytes = base64.b64decode(base64_data)
    except Exception as err:
        raise HTTPException(status_code=400, detail=f"Invalid base64 image data: {err}")

    # Enforce maximum 10MB limit
    if len(image_bytes) > 10 * 1024 * 1024:
        raise HTTPException(status_code=413, detail="Image file exceeds 10MB limit")

    file_id = f"photo_{uuid4().hex[:12]}.{ext}"
    target_path = UPLOADS_DIR / file_id
    with open(target_path, "wb") as f:
        f.write(image_bytes)

    # Return accessible relative URL
    photo_url = f"/static/uploads/{file_id}"
    return {
        "status": "success",
        "photo_url": photo_url,
        "filename": file_id,
        "size_bytes": len(image_bytes)
    }


@app.post("/api/v1/auth/admin-login")
def admin_login(req: AdminAuthRequest):
    """Verify administrator password to unlock command center."""
    if req.password == ADMIN_PASSWORD:
        return {
            "status": "authenticated",
            "token": ADMIN_SESSION_TOKEN,
            "role": "TRANSPORT_AUTHORITY"
        }
    raise HTTPException(status_code=401, detail="Invalid administrator credentials")


@app.get("/api/v1/auth/verify")
def verify_admin_session(token: str = Query(...)):
    """Verify if a provided session token is valid."""
    if token == ADMIN_SESSION_TOKEN:
        return {"valid": True, "role": "TRANSPORT_AUTHORITY"}
    return {"valid": False, "role": None}


@app.get("/api/v1/events")
def get_events(event_type: Optional[str] = None, status: Optional[EventStatus] = None, bus_id: Optional[str] = None, route_id: Optional[str] = None, min_confidence: float = Query(0.0, ge=0, le=1), limit: int = Query(100, ge=1, le=1000)):
    filtered = []
    for event in reversed(load_all_events()):
        if event_type and event.get("event_type") != event_type.upper():
            continue
        if status and event.get("status", "NEW") != status.value:
            continue
        if bus_id and event.get("bus_id") != bus_id:
            continue
        if route_id and event.get("route_id") != route_id:
            continue
        if event.get("fusion", {}).get("confidence", 0) < min_confidence:
            continue
        filtered.append(event)
        if len(filtered) == limit:
            break
    return {"count": len(filtered), "events": filtered}


@app.patch("/api/v1/events/{event_id}/status")
def update_event_status(event_id: str, update: StatusUpdate, x_citypulse_role: Optional[str] = Header(default="TRANSPORT_AUTHORITY")):
    role = require_role(x_citypulse_role or "TRANSPORT_AUTHORITY")
    events = load_all_events()
    for event in events:
        if event.get("event_id") == event_id or event.get("id") == event_id:
            if role == Role.DEPOT_ADMIN and update.status in (EventStatus.ACTIONED, EventStatus.DISMISSED):
                raise HTTPException(status_code=403, detail="Depot Admin cannot close authority cases")
            event["status"] = update.status.value
            event.setdefault("status_history", []).append({"status": update.status.value, "at": utc_now(), "by_role": role.value, "note": update.note})
            save_all_events(events)

            # Targeted Supabase sync via PATCH so status persists in cloud database
            if SUPABASE_URL and SUPABASE_KEY:
                try:
                    sb_headers = {
                        "apikey": SUPABASE_KEY,
                        "Authorization": f"Bearer {SUPABASE_KEY}",
                        "Content-Type": "application/json",
                    }
                    patch_body = {
                        "status": event["status"],
                        "status_history": event.get("status_history", [])
                    }
                    eid = event.get("event_id")
                    if eid:
                        requests.patch(f"{SUPABASE_URL}/rest/v1/events?event_id=eq.{eid}", headers=sb_headers, json=patch_body, timeout=3)
                    row_id = event.get("id")
                    if row_id:
                        requests.patch(f"{SUPABASE_URL}/rest/v1/events?id=eq.{row_id}", headers=sb_headers, json=patch_body, timeout=3)
                except Exception as sb_err:
                    print(f"[CITYPULSE] Supabase status sync error: {sb_err}")

            return event
    raise HTTPException(status_code=404, detail="Event not found")


@app.get("/api/v1/events/stats")
def get_event_stats():
    events = load_all_events()
    by_type: Dict[str, int] = {}
    by_status: Dict[str, int] = {item.value: 0 for item in EventStatus}
    critical = 0
    for event in events:
        kind = event.get("event_type", "OTHER")
        by_type[kind] = by_type.get(kind, 0) + 1
        state = event.get("status", "NEW")
        by_status[state] = by_status.get(state, 0) + 1
        if event_severity(event) in ("CRITICAL", "SEVERE", "HIGH"):
            critical += 1
    return {"total_events": len(events), "by_type": by_type, "by_status": by_status, "high_priority": critical, "buses_reporting": sorted({event.get("bus_id", "UNKNOWN") for event in events})}


@app.get("/api/v1/events/geojson")
def get_events_geojson():
    features = []
    for event in load_all_events():
        location = event.get("location", {})
        if location.get("latitude") is None or location.get("longitude") is None:
            continue
        features.append({"type": "Feature", "geometry": {"type": "Point", "coordinates": [location["longitude"], location["latitude"]]}, "properties": {"event_id": event.get("event_id"), "event_type": event.get("event_type"), "severity": event_severity(event), "status": event.get("status", "NEW"), "bus_id": event.get("bus_id"), "route_id": event.get("route_id"), "timestamp": event.get("timestamp"), "confidence": event.get("fusion", {}).get("confidence"), "report_count": event.get("report_count", 1)}})
    return {"type": "FeatureCollection", "features": features}


@app.get("/api/v1/analytics/congestion")
def congestion_analytics():
    """Aggregate edge traffic-density reports by route and hour for a heatmap client."""
    buckets: Dict[str, dict] = {}
    for event in load_all_events():
        details = event.get("congestion_details")
        if not details:
            continue
        stamp = parse_time(event.get("timestamp", ""))
        hour = stamp.hour if stamp else 0
        key = f"{event.get('route_id', 'UNASSIGNED')}:{hour}"
        bucket = buckets.setdefault(key, {"route_id": event.get("route_id", "UNASSIGNED"), "hour": hour, "observations": 0, "density_total": 0.0, "speed_total": 0.0})
        bucket["observations"] += 1
        bucket["density_total"] += float(details.get("vehicle_density", 0))
        bucket["speed_total"] += float(event.get("gps", {}).get("speed_kmh", 0))
    segments = []
    for bucket in buckets.values():
        count = bucket["observations"]
        segments.append({"route_id": bucket["route_id"], "hour": bucket["hour"], "observations": count, "average_vehicle_density": round(bucket["density_total"] / count, 2), "average_speed_kmh": round(bucket["speed_total"] / count, 2)})
    return {"segments": sorted(segments, key=lambda item: (item["route_id"], item["hour"]))}


# ── Mappls API Endpoints ─────────────────────────────────────────────


@app.get("/api/v1/enrich/address")
@app.get("/api/v1/mappls/reverse-geocode")
def reverse_geocode(lat: float = Query(..., ge=-90, le=90), lng: float = Query(..., ge=-180, le=180)):
    """Reverse geocode GPS coordinates to a street address using Mappls."""
    client = get_mappls_client()
    if not client.is_configured:
        return {"success": False, "formatted": f"{lat:.5f}, {lng:.5f} (Kolkata Municipal Area)", "area": "Kolkata"}
    result = client.reverse_geocode(lat, lng)
    if not result.get("success"):
        return {"success": False, "formatted": f"{lat:.5f}, {lng:.5f} (Kolkata Municipal Area)", "area": "Kolkata"}
    return result


@app.get("/api/v1/mappls/nearby")
def nearby_search(
    lat: float = Query(..., ge=-90, le=90),
    lng: float = Query(..., ge=-180, le=180),
    keywords: str = Query("hospital", description="Search keyword: hospital, police station, bus stop, petrol pump"),
    radius: int = Query(2000, ge=100, le=50000, description="Search radius in meters"),
):
    """Find nearby points of interest around incident coordinates using Mappls."""
    client = get_mappls_client()
    if not client.is_configured:
        raise HTTPException(status_code=503, detail="Mappls API not configured")
    return client.nearby_search(lat, lng, keywords=keywords, radius=radius)


@app.get("/api/v1/mappls/nearby-infrastructure")
def nearby_infrastructure(
    lat: float = Query(..., ge=-90, le=90),
    lng: float = Query(..., ge=-180, le=180),
    radius: int = Query(2000, ge=100, le=50000),
):
    """Find hospitals, police stations, bus stops, and petrol pumps near an incident."""
    result = find_nearby_infrastructure(lat, lng, radius=radius)
    if not result.get("configured"):
        raise HTTPException(status_code=503, detail=result.get("message", "Mappls API not configured"))
    return result


@app.get("/api/v1/mappls/route")
def route_between(
    origin_lat: float = Query(..., ge=-90, le=90),
    origin_lng: float = Query(..., ge=-180, le=180),
    dest_lat: float = Query(..., ge=-90, le=90),
    dest_lng: float = Query(..., ge=-180, le=180),
):
    """Calculate driving route between two incident locations using Mappls."""
    result = get_route_between_incidents(origin_lat, origin_lng, dest_lat, dest_lng)
    if not result.get("configured", True):
        raise HTTPException(status_code=503, detail=result.get("message", "Mappls API not configured"))
    if not result.get("success"):
        raise HTTPException(status_code=502, detail=result.get("error", "Route calculation failed"))
    return result


@app.get("/api/v1/mappls/geocode")
def geocode_address(address: str = Query(..., min_length=3, description="Address to geocode")):
    """Convert a text address to GPS coordinates using Mappls."""
    client = get_mappls_client()
    if not client.is_configured:
        raise HTTPException(status_code=503, detail="Mappls API not configured")
    result = client.geocode(address)
    if not result.get("success"):
        raise HTTPException(status_code=502, detail=result.get("error", "Geocoding failed"))
    return result


@app.get("/api/v1/mappls/traffic")
def get_live_traffic_endpoint(
    origin_lat: float = Query(..., ge=-90, le=90),
    origin_lng: float = Query(..., ge=-180, le=180),
    dest_lat: float = Query(..., ge=-90, le=90),
    dest_lng: float = Query(..., ge=-180, le=180),
):
    """Request live traffic conditions, delays, and ETA from Mappls."""
    result = get_live_traffic_info(origin_lat, origin_lng, dest_lat, dest_lng)
    if not result.get("success"):
        raise HTTPException(status_code=502, detail=result.get("error", "Traffic request failed"))
    return result


@app.get("/api/v1/mappls/traffic/fleet-corridor")
def get_fleet_corridor_traffic():
    """Aggregate real-time bus speeds and live road congestion along city routes."""
    events = load_all_events()
    recent_speeds = [e.get("gps", {}).get("speed_kmh", 0) for e in events[-20:] if e.get("gps", {}).get("speed_kmh") is not None]
    avg_speed = round(sum(recent_speeds) / max(1, len(recent_speeds)), 1) if recent_speeds else 28.5
    segments = get_live_corridor_network()
    return {"average_fleet_speed_kmh": avg_speed, "corridors": len(segments), "segments": segments, "timestamp": utc_now()}


@app.get("/api/v1/mappls/traffic/live-network")
def get_live_traffic_network():
    """Return all city transit corridors with live traffic speed, delay, and universal congestion color codes."""
    segments = get_live_corridor_network()
    return {
        "status": "LIVE",
        "timestamp": utc_now(),
        "corridors_monitored": len(segments),
        "segments": segments,
    }


class MapplsKeyUpdate(BaseModel):
    api_key: Optional[str] = None
    client_id: Optional[str] = None
    client_secret: Optional[str] = None


@app.get("/api/v1/mappls/token")
def get_mappls_token():
    """Retrieve an active Mappls access token for the Web Map SDK."""
    client = get_mappls_client()
    try:
        token = client._get_access_token()
        return {"success": True, "token": token}
    except Exception as e:
        return {"success": False, "error": str(e)}


@app.get("/api/v1/mappls/status")
def get_mappls_status():
    """Check Mappls API credentials and server connection health."""
    client = get_mappls_client()
    key = client.api_key or ""
    cid = client.client_id or ""
    masked_key = f"{key[:6]}...{key[-4:]}" if len(key) >= 10 else (key or "Not configured")
    masked_cid = f"{cid[:6]}...{cid[-4:]}" if len(cid) >= 10 else (cid or "Not configured")
    test_res = client.reverse_geocode(22.5726, 88.3639)
    is_valid = test_res.get("success", False)
    err_desc = test_res.get("error", "")
    is_expired = "Client Credentials Expired" in str(err_desc) or "401" in str(err_desc)
    return {
        "configured": client.is_configured,
        "api_key_masked": masked_key,
        "client_id_masked": masked_cid,
        "valid": is_valid,
        "key_expired": is_expired,
        "message": "Valid Mappls Connection" if is_valid else (err_desc or "Invalid or expired credentials"),
    }


@app.post("/api/v1/mappls/config/key")
def update_mappls_key(payload: MapplsKeyUpdate):
    """Update Mappls credentials dynamically in runtime and persist to .env."""
    import os
    from mappls import config as mappls_cfg

    new_key = (payload.api_key or "").strip()
    new_cid = (payload.client_id or "").strip()
    new_sec = (payload.client_secret or "").strip()

    if not new_key and not (new_cid and new_sec):
        raise HTTPException(status_code=400, detail="Provide an API Key or Client ID + Client Secret")

    env_file = Path(__file__).parent.parent / ".env"
    lines = []
    if env_file.exists():
        with open(env_file, "r", encoding="utf-8") as f:
            lines = f.readlines()

    updates = {}
    if new_key:
        mappls_cfg.MAPPLS_API_KEY = new_key
        os.environ["MAPPLS_API_KEY"] = new_key
        updates["MAPPLS_API_KEY"] = new_key

    if new_cid and new_sec:
        mappls_cfg.MAPPLS_CLIENT_ID = new_cid
        mappls_cfg.MAPPLS_CLIENT_SECRET = new_sec
        os.environ["MAPPLS_CLIENT_ID"] = new_cid
        os.environ["MAPPLS_CLIENT_SECRET"] = new_sec
        updates["MAPPLS_CLIENT_ID"] = new_cid
        updates["MAPPLS_CLIENT_SECRET"] = new_sec

    # Update .env
    new_lines = []
    seen = set()
    for line in lines:
        matched = False
        for k, v in updates.items():
            if line.strip().startswith(f"{k}="):
                new_lines.append(f"{k}={v}\n")
                seen.add(k)
                matched = True
                break
        if not matched:
            new_lines.append(line)
    for k, v in updates.items():
        if k not in seen:
            new_lines.append(f"{k}={v}\n")

    try:
        with open(env_file, "w", encoding="utf-8") as f:
            f.writelines(new_lines)
    except Exception as e:
        print(f"Error saving to .env: {e}")

    # Reset client
    client = get_mappls_client(
        api_key=new_key if new_key else None,
        client_id=new_cid if new_cid else None,
        client_secret=new_sec if new_sec else None,
    )
    test_res = client.reverse_geocode(22.5726, 88.3639)
    is_valid = test_res.get("success", False)
    
    token = None
    try:
        token = client._get_access_token()
    except Exception:
        pass

    return {
        "success": True,
        "valid": is_valid,
        "token": token,
        "message": "Connected to Mappls successfully" if is_valid else f"Mappls response: {test_res.get('error')}",
    }


# ── Interactive Map Dashboard & Standalone Servicing ─────────────────


@app.get("/")
@app.get("/dashboard")
@app.get("/admin")
def map_dashboard():
    """Serve the interactive CITYPULSE authority admin dashboard."""
    index_path = DASHBOARD_DIR / "index.html"
    if index_path.exists():
        return FileResponse(str(index_path), media_type="text/html")
    raise HTTPException(status_code=404, detail="Dashboard not found. Ensure dashboard/index.html exists.")


@app.get("/report")
@app.get("/user")
def user_report_dashboard():
    """Serve the Citizen / User Hazard Reporting Portal (React SPA)."""
    index_path = DASHBOARD_DIR / "index.html"
    if index_path.exists():
        return FileResponse(str(index_path), media_type="text/html")
    report_path = DASHBOARD_DIR / "report.html"
    if report_path.exists():
        return FileResponse(str(report_path), media_type="text/html")
    raise HTTPException(status_code=404, detail="Reporting portal not found. Ensure dashboard/index.html exists.")


@app.get("/styles.css")
def serve_root_styles_css():
    """Serve styles.css for root dashboard and reporting portals."""
    css_path = DASHBOARD_DIR / "styles.css"
    if css_path.exists():
        return FileResponse(str(css_path), media_type="text/css")
    raise HTTPException(status_code=404, detail="styles.css not found")


@app.get("/app.js")
def serve_root_app_js():
    """Serve app.js for root dashboard and reporting portals."""
    js_path = DASHBOARD_DIR / "app.js"
    if js_path.exists():
        return FileResponse(str(js_path), media_type="application/javascript")
    raise HTTPException(status_code=404, detail="app.js not found")

