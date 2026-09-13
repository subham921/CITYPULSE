from config import SHOCK_THRESHOLD


def calculate_shock_level(acceleration_z):
    """Classify vertical acceleration; thresholds need hardware calibration."""
    magnitude = abs(acceleration_z)
    if magnitude < 1.5:
        return "NORMAL"
    if magnitude < 2.5:
        return "MODERATE"
    if magnitude < 3.5:
        return "HIGH"
    return "SEVERE"


def detect_shock(imu_data):
    """Return a compact shock assessment for one IMU reading."""
    acceleration_z = imu_data["accel_z"]
    return {
        "shock_detected": abs(acceleration_z) >= SHOCK_THRESHOLD,
        "shock_level": calculate_shock_level(acceleration_z),
        "acceleration_z": acceleration_z,
        "timestamp": imu_data["timestamp"],
    }
