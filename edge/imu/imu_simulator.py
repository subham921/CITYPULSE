import random
import time
from datetime import datetime, timezone

from config import IMU_UPDATE_INTERVAL


class IMUSimulator:
    """Generate accelerometer and gyroscope readings for development."""

    def read(self):
        # A stationary, correctly-oriented IMU measures approximately 1g on Z.
        # Five percent of readings simulate a bump or pothole.
        acceleration_z = (
            random.uniform(2.5, 4.5)
            if random.random() < 0.05
            else random.uniform(0.85, 1.15)
        )

        return {
            "accel_x": round(random.uniform(-0.3, 0.3), 3),
            "accel_y": round(random.uniform(-0.3, 0.3), 3),
            "accel_z": round(acceleration_z, 3),
            "gyro_x": round(random.uniform(-0.5, 0.5), 3),
            "gyro_y": round(random.uniform(-0.5, 0.5), 3),
            "gyro_z": round(random.uniform(-0.5, 0.5), 3),
            "timestamp": datetime.now(timezone.utc).isoformat(),
        }


if __name__ == "__main__":
    imu = IMUSimulator()
    print("CITYPULSE IMU Simulator")
    print("-----------------------")
    try:
        while True:
            print(imu.read())
            time.sleep(IMU_UPDATE_INTERVAL)
    except KeyboardInterrupt:
        print("\nIMU simulator stopped.")
