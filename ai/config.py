"""CITYPULSE AI Vision Configuration.

Thresholds, ROI boundaries, and model parameters for bus camera analysis.
"""

from pathlib import Path

# Base Paths
AI_DIR = Path(__file__).parent
MODELS_DIR = AI_DIR / "models"
MODELS_DIR.mkdir(exist_ok=True)

# Video / Camera Stream
DEFAULT_CAMERA_INDEX = 0
DEFAULT_FRAME_WIDTH = 1280
DEFAULT_FRAME_HEIGHT = 720
DEFAULT_FPS = 30

# Pothole Detection Parameters
# Road surface Region of Interest (percentage from top to bottom)
POTHOLE_ROI_Y_START = 0.55  # Lower 45% of the frame (road surface)
POTHOLE_MIN_AREA = 800      # Minimum contour area in pixels
POTHOLE_MAX_AREA = 60000    # Maximum contour area in pixels
POTHOLE_DARKNESS_RATIO = 0.78  # Relative darkness compared to surrounding road
POTHOLE_CONFIDENCE_THRESHOLD = 0.50

# Near-Miss Accident Detection Parameters
# TTC (Time To Collision in seconds) = distance / relative_velocity
TTC_CRITICAL_THRESHOLD = 1.5   # Under 1.5s is an imminent collision risk
TTC_WARNING_THRESHOLD = 2.5    # Under 2.5s is a hazardous near-miss warning
NEAR_MISS_MIN_CONFIDENCE = 0.60
TRACKER_MAX_DISAPPEARED = 10   # Frames to keep lost track before discarding
LATERAL_CUT_IN_VELOCITY_THRESH = 45.0  # Pixels per frame lateral shift toward ego-lane center

# Missing Divider Detection Parameters
# Central / Median Divider Region of Interest (lateral zone where median barrier is expected)
DIVIDER_ROI_X_MIN = 0.25      # 25% across frame width
DIVIDER_ROI_X_MAX = 0.55      # 55% across frame width
DIVIDER_ROI_Y_START = 0.40    # Middle-lower road perspective
DIVIDER_MIN_CONTINUITY_FRAMES = 15  # Number of frames of missing barrier before raising alert
DIVIDER_GAP_PIXELS_MIN = 80   # Minimum spatial gap length in pixels to qualify as broken/missing

# Event Cooldowns (seconds) to prevent spamming duplicate events
COOLDOWN_POTHOLE = 3.0
COOLDOWN_NEAR_MISS = 4.0
COOLDOWN_DIVIDER = 5.0
