import random
import time
from datetime import datetime, timezone

from config import BUS_ID, GPS_UPDATE_INTERVAL


class GPSSimulator:
    def __init__(self):
        self.latitude = 22.5726
        self.longitude = 88.3639
        self.speed = 30.0

    def get_location(self):
        # Simulate small movement
        self.latitude += random.uniform(0.00001, 0.00005)
        self.longitude += random.uniform(0.00001, 0.00005)

        self.speed = max(
            0,
            self.speed + random.uniform(-2.0, 2.0)
        )

        return {
            "bus_id": BUS_ID,
            "latitude": round(self.latitude, 6),
            "longitude": round(self.longitude, 6),
            "speed": round(self.speed, 2),
            "timestamp": datetime.now(timezone.utc).isoformat()
        }


if __name__ == "__main__":
    gps = GPSSimulator()

    print("CITYPULSE GPS Simulator")
    print("------------------------")

    try:
        while True:
            data = gps.get_location()
            print(data)
            time.sleep(GPS_UPDATE_INTERVAL)

    except KeyboardInterrupt:
        print("\nGPS simulator stopped.")