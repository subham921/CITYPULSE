# CITYPULSE Edge Configuration

BUS_ID = "BUS101"

# GPS
GPS_UPDATE_INTERVAL = 1.0  # seconds

# IMU
IMU_UPDATE_INTERVAL = 0.1  # seconds
SHOCK_THRESHOLD = 3.0

# Sensor fusion
VISION_WEIGHT = 0.60
IMU_WEIGHT = 0.40

# Events within this time difference can be associated
FUSION_TIME_WINDOW = 1.0  # seconds

import os

# Backend (can point to public domain when deployed on road)
BACKEND_URL = os.environ.get("CITYPULSE_BACKEND_URL", "http://localhost:8000/api/v1/events")
REQUEST_TIMEOUT = 5
