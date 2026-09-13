"""Master AI Vision Engine for CITYPULSE bus camera system.

Orchestrates PotholeDetector, NearMissDetector, and DividerDetector,
handles frame capture, event debouncing, and on-screen HUD visualization.
"""
from datetime import datetime, timezone
import time
import cv2
import numpy as np

from ai.config import (
    COOLDOWN_DIVIDER,
    COOLDOWN_NEAR_MISS,
    COOLDOWN_POTHOLE,
    DEFAULT_CAMERA_INDEX,
    DEFAULT_FRAME_HEIGHT,
    DEFAULT_FRAME_WIDTH,
)
from ai.divider_detector import DividerDetector
from ai.near_miss_detector import NearMissDetector
from ai.pothole_detector import PotholeDetector


class VisionEngine:
    def __init__(self, camera_source=DEFAULT_CAMERA_INDEX, model_weights=None):
        self.camera_source = camera_source
        self.pothole_detector = PotholeDetector(model_weights)
        self.near_miss_detector = NearMissDetector()
        self.divider_detector = DividerDetector()

        # Cooldown tracking (event_type -> last_triggered_time)
        self.last_event_time = {
            "POTHOLE": 0.0,
            "NEAR_MISS": 0.0,
            "MISSING_DIVIDER": 0.0,
        }
        self.cooldowns = {
            "POTHOLE": COOLDOWN_POTHOLE,
            "NEAR_MISS": COOLDOWN_NEAR_MISS,
            "MISSING_DIVIDER": COOLDOWN_DIVIDER,
        }

        self.cap = None

    def start_capture(self):
        """Initialize video capture."""
        if isinstance(self.camera_source, str) and not self.camera_source.isdigit():
            self.cap = cv2.VideoCapture(self.camera_source)
        else:
            cam_id = int(self.camera_source)
            self.cap = cv2.VideoCapture(cam_id)

        if self.cap.isOpened():
            self.cap.set(cv2.CAP_PROP_FRAME_WIDTH, DEFAULT_FRAME_WIDTH)
            self.cap.set(cv2.CAP_PROP_FRAME_HEIGHT, DEFAULT_FRAME_HEIGHT)
            return True
        return False

    def stop_capture(self):
        if self.cap and self.cap.isOpened():
            self.cap.release()

    def process_frame(self, frame, bus_speed_kmh=30.0, timestamp=None):
        """Run all detectors on a single frame and return debounced events & annotated frame.

        Args:
            frame (np.ndarray): BGR image frame.
            bus_speed_kmh (float): Current bus speed from GPS.
            timestamp (str, optional): ISO timestamp.

        Returns:
            tuple[list[dict], np.ndarray]: (detected_events, annotated_frame)
        """
        if frame is None or frame.size == 0:
            return [], frame

        if timestamp is None:
            timestamp = datetime.now(timezone.utc).isoformat()

        now = time.time()
        detected_events = []

        # 1. Pothole Detection
        potholes = self.pothole_detector.detect(frame, timestamp)
        for pot in potholes:
            if now - self.last_event_time["POTHOLE"] >= self.cooldowns["POTHOLE"]:
                self.last_event_time["POTHOLE"] = now
                detected_events.append(pot)

        # 2. Near-Miss Accident Detection
        near_misses = self.near_miss_detector.detect(frame, bus_speed_kmh, timestamp)
        for nm in near_misses:
            if now - self.last_event_time["NEAR_MISS"] >= self.cooldowns["NEAR_MISS"]:
                self.last_event_time["NEAR_MISS"] = now
                detected_events.append(nm)

        # 3. Missing / Damaged Divider Detection
        dividers = self.divider_detector.detect(frame, timestamp)
        for div in dividers:
            if now - self.last_event_time["MISSING_DIVIDER"] >= self.cooldowns["MISSING_DIVIDER"]:
                self.last_event_time["MISSING_DIVIDER"] = now
                detected_events.append(div)

        # 4. Generate visual overlay
        annotated_frame = self.annotate_frame(frame, potholes, near_misses, dividers, bus_speed_kmh)

        return detected_events, annotated_frame

    def annotate_frame(self, frame, potholes, near_misses, dividers, bus_speed):
        """Draw HUD and detection bounding boxes onto a copy of the frame."""
        vis = frame.copy()
        h, w = vis.shape[:2]

        # Top HUD Bar
        cv2.rectangle(vis, (0, 0), (w, 45), (20, 20, 20), -1)
        hud_text = f"CITYPULSE BUS AI CAMERA | SPEED: {bus_speed:.1f} km/h | FPS: 30"
        cv2.putText(vis, hud_text, (15, 30), cv2.FONT_HERSHEY_SIMPLEX, 0.7, (0, 255, 200), 2)

        # Potholes (Orange / Red boxes)
        for pot in potholes:
            x, y, pw, ph = pot["bbox"]
            color = (0, 0, 255) if pot["severity"] == "SEVERE" else (0, 140, 255)
            cv2.rectangle(vis, (x, y), (x + pw, y + ph), color, 2)
            label = f"POTHOLE ({pot['severity']} {pot['confidence']*100:.0f}%)"
            cv2.putText(vis, label, (x, max(20, y - 8)), cv2.FONT_HERSHEY_SIMPLEX, 0.5, color, 2)

        # Near Misses (Red Alert Box with TTC)
        for nm in near_misses:
            x, y, nw, nh = nm["bbox"]
            color = (0, 0, 255) if nm["risk_level"] == "CRITICAL" else (0, 165, 255)
            cv2.rectangle(vis, (x, y), (x + nw, y + nh), color, 3)
            ttc_str = f"TTC: {nm['ttc_seconds']}s" if nm.get("ttc_seconds") else "CUT-IN"
            label = f"ALERT: {nm['hazard_sub_type']} [{ttc_str}]"
            cv2.putText(vis, label, (x, max(25, y - 10)), cv2.FONT_HERSHEY_SIMPLEX, 0.6, (0, 0, 255), 2)

        # Missing / Damaged Dividers (Yellow / Magenta dash lines)
        for div in dividers:
            x, y, dw, dh = div["bbox"]
            cv2.rectangle(vis, (x, y), (x + dw, y + dh), (255, 0, 255), 2)
            cv2.putText(vis, f"HAZARD: {div['hazard_description']}", (x, max(20, y - 8)), cv2.FONT_HERSHEY_SIMPLEX, 0.5, (255, 0, 255), 2)

        return vis


def generate_synthetic_road_scene(hazard_type=None, frame_w=DEFAULT_FRAME_WIDTH, frame_h=DEFAULT_FRAME_HEIGHT, step=0):
    """Generate a realistic synthetic road frame for unit testing and headless validation."""
    frame = np.full((frame_h, frame_w, 3), 40, dtype=np.uint8)  # Dark background / asphalt

    # Horizon and Sky
    horizon_y = int(frame_h * 0.40)
    frame[:horizon_y, :] = (180, 150, 120)  # Daytime sky

    # Road perspective (trapezoid)
    road_pts = np.array([
        [int(frame_w * 0.45), horizon_y],
        [int(frame_w * 0.55), horizon_y],
        [frame_w, frame_h],
        [0, frame_h]
    ], np.int32)
    cv2.fillPoly(frame, [road_pts], (75, 75, 75))

    # Median Divider (left/center)
    divider_x_top = int(frame_w * 0.48)
    divider_x_bot = int(frame_w * 0.28)
    cv2.line(frame, (divider_x_top, horizon_y), (divider_x_bot, frame_h), (220, 220, 220), 4)

    # Lane markings (dashed center lines)
    dash_top = int(frame_w * 0.52)
    dash_bot = int(frame_w * 0.65)
    for i in range(5):
        y1 = int(horizon_y + (frame_h - horizon_y) * (i / 5.0))
        y2 = int(horizon_y + (frame_h - horizon_y) * ((i + 0.5) / 5.0))
        x1 = int(dash_top + (dash_bot - dash_top) * (i / 5.0))
        x2 = int(dash_top + (dash_bot - dash_top) * ((i + 0.5) / 5.0))
        cv2.line(frame, (x1, y1), (x2, y2), (255, 255, 255), 3)

    if hazard_type == "POTHOLE":
        # Draw dark elliptical road pothole with rough perimeter
        p_center = (int(frame_w * 0.58), int(frame_h * 0.75))
        cv2.ellipse(frame, p_center, (55, 30), 10, 0, 360, (25, 25, 25), -1)
        # Add texture / depth shadow
        cv2.ellipse(frame, (p_center[0] - 5, p_center[1] - 2), (40, 20), 10, 0, 360, (15, 15, 15), -1)

    elif hazard_type == "NEAR_MISS":
        # Vehicle in front moving closer (expanding bounding box over steps)
        scale = 1.0 + (step * 0.15)
        vw = int(90 * scale)
        vh = int(70 * scale)
        vx = int(frame_w * 0.50 - vw / 2.0)
        vy = int(frame_h * 0.60 + step * 8)
        # Vehicle body
        cv2.rectangle(frame, (vx, vy), (vx + vw, vy + vh), (30, 30, 180), -1)
        # Rear windshield
        cv2.rectangle(frame, (vx + 10, vy + 10), (vx + vw - 10, vy + int(vh * 0.45)), (60, 60, 60), -1)
        # Tail lights
        cv2.circle(frame, (vx + 12, vy + vh - 15), 6, (0, 0, 255), -1)
        cv2.circle(frame, (vx + vw - 12, vy + vh - 15), 6, (0, 0, 255), -1)

    elif hazard_type == "MISSING_DIVIDER":
        # Erase a chunk of the median divider barrier to simulate broken/missing divider
        erase_center = (int((divider_x_top + divider_x_bot) / 2), int((horizon_y + frame_h) / 2))
        cv2.circle(frame, erase_center, 65, (75, 75, 75), -1)

    return frame
