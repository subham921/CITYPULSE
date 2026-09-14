"""CITYPULSE Bus-Mounted Ultrasonic Sonar Sensor Simulator.

Simulates a waterproof ultrasonic transducer (e.g. JSN-SR04T / HC-SR04) mounted
on the bus front bumper pointing downward at the roadway.
Measures the acoustic echo time-of-flight to determine water depth. When water level
rises above the bus bumper clearance threshold (35.0 cm), it triggers an immediate
authoritative WATERLOGGED hazard alert.
"""

from datetime import datetime, timezone
import json
import os
from pathlib import Path
import random
import sys
import time
from typing import Any, Dict, Optional
import requests

if sys.stdout and hasattr(sys.stdout, "reconfigure"):
    try:
        sys.stdout.reconfigure(encoding="utf-8")
    except Exception:
        pass

ROOT_DIR = Path(__file__).parent.parent.parent
if str(ROOT_DIR) not in sys.path:
    sys.path.insert(0, str(ROOT_DIR))

SPEED_OF_SOUND_CM_PER_US = 0.0346

SIMULATION_CORRIDORS = [
    {"name": "College Street / MG Road Crossing", "lat": 22.5744, "lng": 88.3629, "route": "ROUTE_32"},
    {"name": "Amherst Street (St. Paul's Cathedral Road)", "lat": 22.5802, "lng": 88.3711, "route": "ROUTE_12"},
    {"name": "Park Circus Seven Point Crossing", "lat": 22.5448, "lng": 88.3672, "route": "ROUTE_24"},
    {"name": "Central Avenue (CR Avenue / Chittaranjan)", "lat": 22.5835, "lng": 88.3582, "route": "ROUTE_08"},
    {"name": "Thanthania Kalibari / Bidhan Sarani", "lat": 22.5861, "lng": 88.3667, "route": "ROUTE_15"},
    {"name": "EM Bypass - Chingrighata Flyover Base", "lat": 22.5612, "lng": 88.4024, "route": "ROUTE_AC47"},
    {"name": "Behala Chowrasta / Diamond Harbour Rd", "lat": 22.4988, "lng": 88.3114, "route": "ROUTE_14"},
]


class UltrasonicSensorSimulator:
    def __init__(
        self,
        sensor_id: str = "US-SONAR-01",
        bus_id: str = "BUS101",
        baseline_clearance_cm: float = 50.0,
        bumper_clearance_cm: float = 35.0,
        api_base_url: str = "http://127.0.0.1:8000/api/v1",
    ):
        self.sensor_id = sensor_id
        self.bus_id = bus_id
        self.baseline_clearance_cm = baseline_clearance_cm
        self.bumper_clearance_cm = bumper_clearance_cm
        self.api_base_url = api_base_url.rstrip("/")
        self.corridor = random.choice(SIMULATION_CORRIDORS)

    def ping(self, water_depth_cm: Optional[float] = None) -> Dict[str, Any]:
        if water_depth_cm is not None:
            depth = max(0.0, float(water_depth_cm))
        else:
            if random.random() < 0.60:
                depth = round(random.uniform(36.0, 58.0), 1)
            else:
                depth = round(random.uniform(5.0, 32.0), 1)

        distance_to_surface = max(0.0, self.baseline_clearance_cm - depth)
        flight_time_us = round((2.0 * distance_to_surface) / SPEED_OF_SOUND_CM_PER_US, 1)

        above_bumper = depth >= self.bumper_clearance_cm
        overflow_cm = round(depth - self.bumper_clearance_cm, 1) if above_bumper else 0.0
        risk_level = "CRITICAL" if above_bumper else ("WARNING" if depth >= 15.0 else "NORMAL")

        lat = round(self.corridor["lat"] + random.uniform(-0.001, 0.001), 6)
        lng = round(self.corridor["lng"] + random.uniform(-0.001, 0.001), 6)

        return {
            "sensor_id": self.sensor_id,
            "bus_id": self.bus_id,
            "route_id": self.corridor["route"],
            "corridor_name": self.corridor["name"],
            "timestamp": datetime.now(timezone.utc).isoformat(),
            "echo_flight_time_us": flight_time_us,
            "distance_to_surface_cm": round(distance_to_surface, 1),
            "baseline_clearance_cm": self.baseline_clearance_cm,
            "bumper_clearance_cm": self.bumper_clearance_cm,
            "water_depth_cm": depth,
            "above_bumper": above_bumper,
            "clearance_overflow_cm": overflow_cm,
            "flood_risk_level": risk_level,
            "latitude": lat,
            "longitude": lng,
            "speed_kmh": round(random.uniform(15.0, 28.0), 1),
        }

    def dispatch(self, reading: Dict[str, Any]) -> Dict[str, Any]:
        url = f"{self.api_base_url}/sensors/ultrasonic/reading"
        payload = {
            "bus_id": reading["bus_id"],
            "route_id": reading["route_id"],
            "latitude": reading["latitude"],
            "longitude": reading["longitude"],
            "water_depth_cm": reading["water_depth_cm"],
            "bumper_clearance_cm": reading["bumper_clearance_cm"],
            "sensor_id": reading["sensor_id"],
            "speed_kmh": reading["speed_kmh"],
        }
        try:
            res = requests.post(url, json=payload, timeout=5)
            if res.ok:
                return res.json()
            return {"status": "error", "code": res.status_code, "text": res.text}
        except Exception as err:
            return {"status": "error", "message": str(err)}

    def run_simulation(self, pings: int = 5, interval_sec: float = 0.8):
        print("=" * 60)
        print("  CITYPULSE ULTRASONIC WATERLOGGING SENSOR SIMULATOR")
        print(f"  Bus: {self.bus_id} | Sensor: {self.sensor_id} | Corridor: {self.corridor['name']}")
        print(f"  Bumper Ground Clearance Threshold: {self.bumper_clearance_cm} cm")
        print("=" * 60)

        for i in range(1, pings + 1):
            reading = self.ping()
            depth = reading["water_depth_cm"]
            above = reading["above_bumper"]

            status_symbol = "🚨 [FLOOD ALERT]" if above else "🌊 [NORMAL/WET]"
            print(f"\n[Ping #{i:02d}] {status_symbol} Depth: {depth} cm | Clearance: {self.bumper_clearance_cm} cm | Above Bumper: {above}")
            print(f"  Coordinates: ({reading['latitude']}, {reading['longitude']}) on {reading['route_id']}")

            dispatch_res = self.dispatch(reading)
            if dispatch_res.get("alert_created"):
                print(f"  >>> ALERT CREATED: Event ID {dispatch_res.get('event_id')} | Severity: {dispatch_res.get('severity')}")
                print(f"      Address: {dispatch_res.get('address')}")
            else:
                print(f"  --> Telemetry logged: {dispatch_res.get('message') or dispatch_res.get('status')}")

            if i < pings:
                time.sleep(interval_sec)


if __name__ == "__main__":
    import argparse
    parser = argparse.ArgumentParser(description="Simulate bus ultrasonic sonar water level sensor.")
    parser.add_argument("--pings", type=int, default=5, help="Number of sonar pings to simulate")
    parser.add_argument("--depth", type=float, default=None, help="Explicit water depth to simulate in cm")
    parser.add_argument("--force-above", action="store_true", help="Force water depth above bumper threshold")
    parser.add_argument("--api", type=str, default="http://127.0.0.1:8000/api/v1", help="Backend API base URL")
    args = parser.parse_args()

    sim = UltrasonicSensorSimulator(api_base_url=args.api)
    if args.depth is not None:
        r = sim.ping(water_depth_cm=args.depth)
        res = sim.dispatch(r)
        print(json.dumps(res, indent=2))
    elif args.force_above:
        r = sim.ping(water_depth_cm=44.5)
        res = sim.dispatch(r)
        print(json.dumps(res, indent=2))
    else:
        sim.run_simulation(pings=args.pings, interval_sec=0.8)
