"""CITYPULSE Multi-Modal Sensor Fusion Engine.

Fuses camera vision detections (Potholes, Near-Misses, Missing Dividers) with
bus telemetry from GPS (location, velocity) and IMU (vertical shocks, harsh braking).
"""

from datetime import datetime
from config import FUSION_TIME_WINDOW, IMU_WEIGHT, VISION_WEIGHT


def parse_timestamp(timestamp):
    return datetime.fromisoformat(timestamp.replace("Z", "+00:00"))


def timestamps_match(vision_timestamp, imu_timestamp):
    difference = abs((parse_timestamp(vision_timestamp) - parse_timestamp(imu_timestamp)).total_seconds())
    return difference <= FUSION_TIME_WINDOW


def fuse_event(vision_data, gps_data, imu_data):
    """Combine a vision event with the nearest GPS and IMU readings.

    Handles POTHOLE (vertical shock correlation), NEAR_MISS (harsh deceleration correlation),
    and MISSING_DIVIDER (geotagged infrastructure defect).
    """
    event_type = vision_data.get("event_type", "UNKNOWN")
    vision_confidence = float(vision_data.get("confidence", 0.0))
    time_match = timestamps_match(vision_data["timestamp"], imu_data["timestamp"])

    # Base payload structure
    fused = {
        "event_type": event_type,
        "bus_id": gps_data.get("bus_id", "BUS101"),
        "timestamp": vision_data.get("timestamp"),
        "location": {
            "latitude": float(gps_data.get("latitude", 0.0)),
            "longitude": float(gps_data.get("longitude", 0.0)),
        },
        "gps": {
            "speed_kmh": float(gps_data.get("speed", 0.0)),
        },
        "imu": {
            "acceleration_z": imu_data.get("acceleration_z", imu_data.get("accel_z", 1.0)),
            "shock_detected": imu_data.get("shock_detected", False),
            "shock_level": imu_data.get("shock_level", "NORMAL"),
        },
        "vision": {
            "confidence": vision_confidence,
            "bbox": vision_data.get("bbox", []),
        },
    }

    # Specialized multi-modal fusion scoring per hazard type
    if event_type == "POTHOLE":
        # IMU vertical shock confirms wheel impact
        imu_shock = imu_data.get("shock_detected", False)
        imu_confidence = 1.0 if imu_shock else 0.4
        fusion_conf = (VISION_WEIGHT * vision_confidence) + (IMU_WEIGHT * imu_confidence)
        fused["pothole_details"] = {
            "severity": vision_data.get("severity", "MODERATE"),
            "area_px": vision_data.get("area_px", 0),
            "wheel_impact_confirmed": imu_shock,
        }

    elif event_type == "NEAR_MISS":
        # Check for harsh deceleration in IMU Y-axis or speed drops
        accel_y = imu_data.get("accel_y", 0.0)
        harsh_braking = accel_y < -0.25 or imu_data.get("shock_level") in ("HIGH", "SEVERE")
        fusion_conf = vision_confidence if not harsh_braking else min(0.99, vision_confidence + 0.15)
        fused["near_miss_details"] = {
            "risk_level": vision_data.get("risk_level", "WARNING"),
            "hazard_sub_type": vision_data.get("hazard_sub_type", "FORWARD_COLLISION_TTC"),
            "ttc_seconds": vision_data.get("ttc_seconds"),
            "object_type": vision_data.get("object_type", "vehicle"),
            "emergency_braking": harsh_braking,
        }

    elif event_type == "MISSING_DIVIDER":
        fusion_conf = vision_confidence
        fused["divider_details"] = {
            "hazard_level": vision_data.get("hazard_level", "HIGH"),
            "hazard_description": vision_data.get("hazard_description", "Missing median divider"),
            "estimated_gap_meters": vision_data.get("estimated_gap_meters", 0.0),
        }

    else:
        imu_confidence = 1.0 if imu_data.get("shock_detected", False) else 0.0
        fusion_conf = (VISION_WEIGHT * vision_confidence) + (IMU_WEIGHT * imu_confidence)

    fused["fusion"] = {
        "time_match": time_match,
        "confidence": round(float(fusion_conf), 3),
    }

    return fused
