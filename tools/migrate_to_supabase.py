"""CITYPULSE: Seed and Migrate Local events.json into Supabase (PostGIS).

Usage:
    python tools/migrate_to_supabase.py

Environment variables required in .env or environment:
    SUPABASE_URL=https://your-project-ref.supabase.co
    SUPABASE_KEY=your-anon-or-service-role-key
"""

import json
import os
from pathlib import Path
import sys
import requests

# Load environment variables from .env if present
ROOT_DIR = Path(__file__).resolve().parent.parent
ENV_PATH = ROOT_DIR / ".env"
DATA_PATH = ROOT_DIR / "data" / "events.json"

if ENV_PATH.exists():
    with open(ENV_PATH, "r", encoding="utf-8") as f:
        for line in f:
            line = line.strip()
            if line and not line.startswith("#") and "=" in line:
                k, v = line.split("=", 1)
                os.environ.setdefault(k.strip(), v.strip())

SUPABASE_URL = os.getenv("SUPABASE_URL", "").rstrip("/")
# Prefer secret key for database migration / upsert
SUPABASE_KEY = os.getenv("SUPABASE_SERVICE_ROLE_KEY") or os.getenv("SUPABASE_KEY", "")


def normalize_severity(sev):
    s = str(sev or "").upper()
    if s in ("CRITICAL", "HIGH", "SEVERE"):
        return "SEVERE"
    if s in ("LOW", "MINOR"):
        return "LOW"
    return "MODERATE"


def migrate():
    print("=" * 65)
    print("  CITYPULSE -> SUPABASE DATABASE MIGRATOR")
    print("=" * 65)

    if not SUPABASE_URL or not SUPABASE_KEY:
        print("\n[ERROR] Missing Supabase credentials.")
        print("Please ensure your .env file contains:")
        print("  SUPABASE_URL=https://your-project-ref.supabase.co")
        print("  SUPABASE_KEY=your-supabase-service-role-or-anon-key\n")
        sys.exit(1)

    if not DATA_PATH.exists():
        print(f"[ERROR] Local data file not found: {DATA_PATH}")
        sys.exit(1)

    with open(DATA_PATH, "r", encoding="utf-8") as f:
        events = json.load(f)

    print(f"[*] Found {len(events)} events in {DATA_PATH.name}")
    print(f"[*] Target Supabase project: {SUPABASE_URL}")

    headers = {
        "apikey": SUPABASE_KEY,
        "Authorization": f"Bearer {SUPABASE_KEY}",
        "Content-Type": "application/json",
        "Prefer": "resolution=merge-duplicates",  # Upsert matching event_id
    }

    # Format records for public.events table
    records = []
    for ev in events:
        loc = ev.get("location") or {}
        lat = loc.get("latitude") or 22.5726
        lng = loc.get("longitude") or 88.3639
        addr = loc.get("address", {}).get("formatted") or ev.get("address") or f"{lat:.5f}, {lng:.5f}"

        record = {
            "event_id": ev["event_id"],
            "event_type": ev.get("event_type", "POTHOLE"),
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
            "citizen_details": ev.get("citizen_details"),
            "report_count": ev.get("report_count", 1),
            "status_history": ev.get("status_history", []),
            "evidence_hash": ev.get("evidence_hash"),
            "previous_evidence_hash": ev.get("previous_evidence_hash"),
            "timestamp": ev.get("timestamp"),
            "last_reported_at": ev.get("last_reported_at") or ev.get("timestamp"),
        }
        records.append(record)

    # Batch upsert in chunks of 50
    endpoint = f"{SUPABASE_URL}/rest/v1/events"
    success_count = 0
    chunk_size = 50

    for i in range(0, len(records), chunk_size):
        chunk = records[i:i + chunk_size]
        res = requests.post(endpoint, headers=headers, json=chunk)

        if res.status_code in (200, 201):
            success_count += len(chunk)
            print(f"  -> Successfully migrated records {i + 1} to {min(i + chunk_size, len(records))} (Total: {success_count}/{len(records)})")
        else:
            print(f"  [!] Failed chunk {i}-{i+chunk_size}: {res.status_code}")
            print(f"      Response: {res.text}")

    print("\n" + "=" * 65)
    print(f"  MIGRATION COMPLETE: {success_count}/{len(records)} events synced to Supabase!")
    print("=" * 65 + "\n")


if __name__ == "__main__":
    migrate()
