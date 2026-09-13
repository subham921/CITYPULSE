# CITYPULSE AI Camera Vision System

Edge AI computer vision pipeline mounted on city transit buses to monitor road safety and infrastructure health in real time.

## Capabilities

1. **Pothole Detection (`ai/pothole_detector.py`)**
   - Detects asphalt depressions, cracks, and surface distress in the vehicle's driving path.
   - Categorizes severity into `MODERATE` or `SEVERE`.
   - Multi-modal verification: Correlates camera detections with IMU vertical shock telemetry (`acceleration_z > 3.0g`).

2. **Near-Miss Accident Detection (`ai/near_miss_detector.py`)**
   - Real-time vehicle and pedestrian obstacle tracking.
   - Optical Time-to-Collision (TTC) estimation.
   - Triggers `CRITICAL` alert for TTC < 1.5s or sudden lateral cut-ins into the bus corridor.
   - Correlates with bus speed and IMU emergency braking deceleration.

3. **Missing / Damaged Divider Detection (`ai/divider_detector.py`)**
   - Monitors central median barrier and divider continuity.
   - Detects broken barriers, abrupt gaps, and missing divider spans that expose oncoming traffic.
   - Estimates gap length in meters and geotags the exact hazardous stretch.

## Architecture

```
ai/
├── config.py              # Camera, ROI, and detection threshold settings
├── pothole_detector.py    # Road surface distress and pothole detector
├── near_miss_detector.py  # Obstacle tracking, TTC, and cut-in detector
├── divider_detector.py    # Median barrier continuity and gap detector
├── vision_engine.py       # Master vision engine & HUD visualization
└── requirements.txt       # Computer vision dependencies
```

## Running the System

### 1. Start the Backend Ingestion API
```bash
python -m uvicorn backend.main:app --host 127.0.0.1 --port 8000
```

### 2. Run Edge Bus Node
- **Simulation mode (synthetic road hazards):**
  ```bash
  python edge/edge_node.py --camera sim
  ```
- **Live USB webcam (e.g. camera 0):**
  ```bash
  python edge/edge_node.py --camera 0
  ```
- **Recorded dashcam / road test video:**
  ```bash
  python edge/edge_node.py --camera path/to/bus_video.mp4
  ```
- **Offline testing (queue locally without uploading):**
  ```bash
  python edge/edge_node.py --no-upload
  ```

### 3. Run Automated Tests
```bash
python -m unittest discover -s tests -v
```
