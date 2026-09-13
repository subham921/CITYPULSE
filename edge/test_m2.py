"""Deterministic checks for the CITYPULSE M2 simulation layer.

Run from the repository root: python edge/test_m2.py
"""

import sys
from datetime import datetime, timezone
from pathlib import Path

sys.path.insert(0, str(Path(__file__).parent))

from gps.gps_simulator import GPSSimulator
from imu.imu_simulator import IMUSimulator
from imu.shock_detector import detect_shock


def check(condition, message):
    if not condition:
        raise AssertionError(message)
    print(f"PASS: {message}")


def main():
    gps = GPSSimulator()
    first, second = gps.get_location(), gps.get_location()
    check(first["bus_id"] == "BUS101", "GPS has the configured bus ID")
    check(second["latitude"] > first["latitude"], "GPS latitude advances")
    check(second["longitude"] > first["longitude"], "GPS longitude advances")
    check(second["speed"] >= 0, "GPS speed is never negative")

    reading = IMUSimulator().read()
    check(set(reading) == {"accel_x", "accel_y", "accel_z", "gyro_x", "gyro_y", "gyro_z", "timestamp"}, "IMU has all required fields")
    timestamp = datetime.now(timezone.utc).isoformat()
    expected = [(1.1, "NORMAL", False), (2.0, "MODERATE", False), (2.7, "HIGH", False), (3.0, "HIGH", True), (3.7, "SEVERE", True)]
    for acceleration, level, detected in expected:
        result = detect_shock({"accel_z": acceleration, "timestamp": timestamp})
        check(result["shock_level"] == level and result["shock_detected"] is detected, f"{acceleration}g -> {level}, detected={detected}")

    print("\nM2 simulator checks passed.")


if __name__ == "__main__":
    main()
