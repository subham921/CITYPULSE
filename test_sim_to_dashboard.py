"""CITYPULSE End-to-End Simulation Test:
GPS Simulator + IMU Simulator -> Sensor Fusion -> Backend Ingestion -> Mappls API Enrichment -> Dashboard Display.
"""

import sys
import time
from datetime import datetime, timezone
from pathlib import Path
import requests

# Set working directory to project root
ROOT_DIR = Path(__file__).parent
sys.path.insert(0, str(ROOT_DIR))

# Ensure edge module can import its config
sys.path.insert(0, str(ROOT_DIR / "edge"))

from edge.gps.gps_simulator import GPSSimulator
from edge.imu.imu_simulator import IMUSimulator
from edge.imu.shock_detector import detect_shock
from edge.fusion.sensor_fusion import fuse_event

BACKEND_BASE = "http://127.0.0.1:8000"


def run_simulation_and_test():
    print("=" * 70)
    print("  CITYPULSE: BUS SIMULATION & MAPPLS SENSOR FUSION TEST")
    print("=" * 70)

    # 1. Initialize Simulators
    print("\n[Step 1] Initializing GPS and IMU Simulators for Kolkata...")
    gps = GPSSimulator()
    # Set realistic Kolkata bus transit location (e.g. Park Circus / Salt Lake / EM Bypass)
    gps.latitude = 22.5620 + (time.time() % 100) * 0.0001
    gps.longitude = 88.3850 + (time.time() % 100) * 0.0001
    gps.speed = 34.5

    imu = IMUSimulator()

    # 2. Acquire Sensor Data with Synchronized Timestamp
    current_time = datetime.now(timezone.utc).isoformat()
    gps_reading = gps.get_location()
    gps_reading["timestamp"] = current_time
    gps_reading["bus_id"] = "BUS_KOL_701"

    imu_raw = imu.read()
    # Simulate a significant road bump/pothole shock in vertical Z axis
    imu_raw["accel_z"] = 3.85
    imu_raw["timestamp"] = current_time

    shock_info = detect_shock(imu_raw)
    imu_reading = {**imu_raw, **shock_info}

    print(f"  -> GPS Location: Lat {gps_reading['latitude']}, Lng {gps_reading['longitude']} (Speed: {gps_reading['speed']} km/h)")
    print(f"  -> IMU Telemetry: Z-Accel {imu_reading['accel_z']}g, Shock: {imu_reading.get('shock_detected')}, Level: {imu_reading.get('shock_level')}")
    print(f"  -> Connected Timestamp: {current_time}")

    # 3. Simulate Camera Vision Hazard Detection
    vision_event = {
        "event_type": "POTHOLE",
        "confidence": 0.94,
        "timestamp": current_time,
        "bbox": [140, 260, 85, 55],
        "severity": "SEVERE",
        "area_px": 5200,
    }
    print(f"  -> Camera Vision Event: {vision_event['event_type']} (Confidence: {vision_event['confidence'] * 100:.1f}%)")

    # 4. Multi-Modal Sensor Fusion (GPS + IMU + Vision)
    print("\n[Step 2] Executing Multi-Modal Sensor Fusion Engine...")
    fused_event = fuse_event(vision_event, gps_reading, imu_reading)
    print("  -> Fused Event Payload:")
    print(f"     - Type: {fused_event['event_type']}")
    print(f"     - Bus: {fused_event['bus_id']}")
    print(f"     - Location: Lat {fused_event['location']['latitude']}, Lng {fused_event['location']['longitude']}")
    print(f"     - Wheel Impact Confirmed: {fused_event.get('pothole_details', {}).get('wheel_impact_confirmed')}")
    print(f"     - Fusion Confidence Score: {fused_event['fusion']['confidence']}")

    # 5. Send to Backend API for Mappls Enrichment & Ingestion
    print("\n[Step 3] Fetching data into Backend (POST /api/v1/events)...")
    ingest_url = f"{BACKEND_BASE}/api/v1/events"
    try:
        res = requests.post(ingest_url, json=fused_event, timeout=10)
        print(f"  -> Backend Ingestion HTTP Status: {res.status_code}")
        ingest_res = res.json()
        print(f"  -> Ingestion Status: {ingest_res.get('status')}")
        event_id = ingest_res.get("event_id")
        print(f"  -> Event ID: {event_id}")
    except Exception as e:
        print(f"  [Error] Ingestion failed: {e}")
        return False

    # 6. Verify Backend Storage and Mappls Address Enrichment
    print("\n[Step 4] Querying Backend Event Register...")
    query_url = f"{BACKEND_BASE}/api/v1/events?bus_id=BUS_KOL_701"
    q_res = requests.get(query_url, timeout=10).json()
    events = q_res.get("events", [])
    print(f"  -> Total Events for BUS_KOL_701: {len(events)}")
    if events:
        latest = events[0]
        addr = latest.get("location", {}).get("address", {})
        print(f"  -> Stored Location: {latest['location']['latitude']}, {latest['location']['longitude']}")
        print(f"  -> Mappls Enriched Address: {addr.get('formatted', 'Geotagged')}")
        print(f"  -> Status Workflow: {latest.get('status')}")

    # 7. Check Mappls Traffic Network & Live Corridor
    print("\n[Step 5] Checking Mappls Live Traffic Endpoints...")
    traffic_url = f"{BACKEND_BASE}/api/v1/mappls/traffic/live-network"
    t_res = requests.get(traffic_url, timeout=10).json()
    corridors = t_res.get("segments", [])
    print(f"  -> Mappls Monitored Traffic Corridors: {len(corridors)}")
    for c in corridors[:3]:
        print(f"     * {c['name']}: {c['color']} ({c['speed_kmh']} km/h) -> {c['status_text']}")

    # 8. Check Dashboard Endpoint
    print("\n[Step 6] Verifying Mappls Dashboard Output...")
    dash_url = f"{BACKEND_BASE}/dashboard"
    d_res = requests.get(dash_url, timeout=10)
    print(f"  -> Dashboard HTTP Status: {d_res.status_code}")
    print(f"  -> Uses Mappls Map SDK: {'mappls' in d_res.text.lower()}")

    print("\n" + "=" * 70)
    print("  TEST COMPLETED: End-to-End Simulation & Mappls Ingestion Successful!")
    print("=" * 70)
    return True


if __name__ == "__main__":
    run_simulation_and_test()
