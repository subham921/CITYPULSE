"""CITYPULSE Edge Computing Node.

Mounted on the transit bus, this node coordinates:
1. Real-time Camera Vision Pipeline (Potholes, Near-Misses, Missing Dividers)
2. GPS Telemetry (geotagging, bus velocity)
3. IMU Telemetry (vertical shocks, harsh braking)
4. Multi-Modal Sensor Fusion
5. Offline-resilient event dispatch to the central CITYPULSE backend
"""

import argparse
from pathlib import Path
import sys
import time

# Ensure repository root is in python path
ROOT_DIR = Path(__file__).parent.parent
if str(ROOT_DIR) not in sys.path:
    sys.path.insert(0, str(ROOT_DIR))

from ai.vision_engine import VisionEngine, generate_synthetic_road_scene
from edge.communication.event_sender import send_event
from edge.fusion.sensor_fusion import fuse_event
from edge.gps.gps_simulator import GPSSimulator
from edge.imu.imu_simulator import IMUSimulator
from edge.imu.shock_detector import detect_shock
from edge.offline.event_queue import add_event, load_events, clear_events


class EdgeNode:
    def __init__(self, camera_source="sim", upload=True):
        self.camera_source = camera_source
        self.upload = upload
        self.gps = GPSSimulator()
        self.imu = IMUSimulator()
        self.vision = VisionEngine(camera_source=camera_source if camera_source != "sim" else 0)
        self.is_sim = (camera_source == "sim")

    def run_step(self, frame=None, step_idx=0, sim_hazard=None):
        """Execute one complete edge cycle across vision, GPS, and IMU."""
        # 1. Read Sensors
        gps_data = self.gps.get_location()
        imu_raw = self.imu.read()
        shock_info = detect_shock(imu_raw)

        # Merge raw imu with shock info for fusion
        imu_data = {**imu_raw, **shock_info}

        # 2. Acquire Video Frame
        if self.is_sim:
            frame = generate_synthetic_road_scene(sim_hazard, step=step_idx)
        elif frame is None and self.vision.cap:
            ret, frame = self.vision.cap.read()
            if not ret:
                return None

        # 3. Vision Inference
        bus_speed = gps_data.get("speed", 30.0)
        detected_vision_events, annotated_frame = self.vision.process_frame(
            frame, bus_speed_kmh=bus_speed, timestamp=gps_data["timestamp"]
        )

        fused_events = []
        # 4. Multi-Modal Fusion
        for v_event in detected_vision_events:
            fused = fuse_event(v_event, gps_data, imu_data)
            fused_events.append(fused)

            # 5. Dispatch Event
            self._dispatch_event(fused)

        return fused_events

    def _dispatch_event(self, event):
        """Dispatch event to backend with offline queue fallback."""
        event_type = event.get("event_type")
        conf = event.get("fusion", {}).get("confidence", 0)
        loc = event.get("location", {})
        print(f"[*] ALERT DETECTED: [{event_type}] Conf: {conf*100:.1f}% | Lat: {loc.get('latitude')}, Lon: {loc.get('longitude')}")

        if not self.upload:
            add_event(event)
            print("    -> Saved to local offline queue (upload disabled).")
            return

        # Attempt upload
        result = send_event(event)
        if result.get("success"):
            print("    -> Uploaded to central backend successfully.")
            # If backend is back online, flush offline queue
            self._flush_offline_queue()
        else:
            print(f"    -> Backend unreachable ({result.get('error')}). Storing in offline queue.")
            add_event(event)

    def _flush_offline_queue(self):
        """Flush pending offline events once backend connectivity is confirmed."""
        pending = load_events()
        if not pending:
            return

        print(f"    -> Syncing {len(pending)} pending offline events...")
        failed = []
        for pending_event in pending:
            res = send_event(pending_event)
            if not res.get("success"):
                failed.append(pending_event)

        if failed:
            clear_events()
            for item in failed:
                add_event(item)
        else:
            clear_events()
            print("    -> All offline events synced.")

    def run_live_or_sim(self, duration_steps=50):
        """Run loop for specified steps or until interrupted."""
        print("====================================================")
        print("           CITYPULSE BUS EDGE NODE")
        print(f" Source: {self.camera_source} | Upload: {self.upload}")
        print(" Monitoring: Potholes, Near-Misses, Missing Dividers")
        print("====================================================")

        if not self.is_sim:
            if not self.vision.start_capture():
                print(f"[Error] Could not open camera source: {self.camera_source}")
                return

        scenarios = [
            (5, None, "Cruising - Clear roadway"),
            (8, "POTHOLE", "Approaching road surface distress (Pothole)"),
            (8, "NEAR_MISS", "Vehicle cutting in / Forward collision risk"),
            (8, "MISSING_DIVIDER", "Median divider discontinuity / Missing barrier"),
            (5, None, "Cruising - Normal traffic"),
        ]

        step = 0
        try:
            if self.is_sim:
                for count, hazard, description in scenarios:
                    print(f"\n--- Scene: {description} ---")
                    for i in range(count):
                        step += 1
                        events = self.run_step(step_idx=i, sim_hazard=hazard)
                        time.sleep(0.1)
            else:
                print(f"Streaming from input source: {self.camera_source}...")
                while True:
                    step += 1
                    events = self.run_step(step_idx=step)
                    if events is None:
                        print("End of video stream reached.")
                        break
                    time.sleep(0.01)

            print("\nEdge run completed successfully.")

        except KeyboardInterrupt:
            print("\nEdge node stopped by user.")
        finally:
            if not self.is_sim:
                self.vision.stop_capture()


def main():
    parser = argparse.ArgumentParser(description="CITYPULSE Bus Edge Node")
    parser.add_argument("--camera", default="sim", help="Camera source (0, video file path, or 'sim')")
    parser.add_argument("--no-upload", action="store_true", help="Disable uploading and store offline only")
    args = parser.parse_args()

    node = EdgeNode(camera_source=args.camera, upload=not args.no_upload)
    node.run_live_or_sim()


if __name__ == "__main__":
    main()
