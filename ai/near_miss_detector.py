"""Near-Miss Accident and Collision Risk Detector for bus camera.

Tracks forward vehicles and pedestrians, calculates optical Time-to-Collision (TTC),
and detects sudden lateral cut-ins and collision envelopes.
"""

from datetime import datetime, timezone
import math
from pathlib import Path
import cv2
import numpy as np

from ai.config import (
    LATERAL_CUT_IN_VELOCITY_THRESH,
    NEAR_MISS_MIN_CONFIDENCE,
    TRACKER_MAX_DISAPPEARED,
    TTC_CRITICAL_THRESHOLD,
    TTC_WARNING_THRESHOLD,
)


class TrackedEntity:
    def __init__(self, track_id, bbox, object_type="vehicle"):
        self.track_id = track_id
        self.object_type = object_type
        self.history = []  # list of (timestamp_float, bbox [x, y, w, h], centroid (cx, cy))
        self.disappeared = 0
        self.update(bbox, 0.0)

    def update(self, bbox, t):
        cx = bbox[0] + bbox[2] / 2.0
        cy = bbox[1] + bbox[3] / 2.0
        self.history.append((t, bbox, (cx, cy)))
        if len(self.history) > 30:
            self.history.pop(0)
        self.disappeared = 0

    @property
    def latest_bbox(self):
        return self.history[-1][1]

    @property
    def latest_centroid(self):
        return self.history[-1][2]


class NearMissDetector:
    def __init__(self, model_path=None):
        self.next_id = 1
        self.tracks = {}
        self.frame_count = 0
        self.net = None

        if model_path and Path(model_path).exists():
            try:
                self.net = cv2.dnn.readNet(str(model_path))
            except Exception:
                self.net = None

    def detect(self, frame, bus_speed_kmh=30.0, timestamp=None):
        """Process frame and return near-miss hazard events."""
        if frame is None or frame.size == 0:
            return []

        if timestamp is None:
            timestamp = datetime.now(timezone.utc).isoformat()

        self.frame_count += 1
        t_sec = self.frame_count / 30.0
        height, width = frame.shape[:2]

        ego_corridor_left = int(width * 0.20)
        ego_corridor_right = int(width * 0.80)
        horizon_y = int(height * 0.30)

        # 1. Detect candidate forward obstacles
        candidates = self._detect_obstacles(frame, horizon_y, width, height)

        # 2. Update tracking
        self._match_and_update_tracks(candidates, t_sec)

        # 3. Analyze collision physics
        events = []
        for track_id, entity in list(self.tracks.items()):
            if len(entity.history) < 2:
                continue

            event = self._analyze_collision_risk(
                entity, bus_speed_kmh, ego_corridor_left, ego_corridor_right, width, height, timestamp
            )
            if event:
                events.append(event)

        return events

    def _detect_obstacles(self, frame, horizon_y, width, height):
        """Extract obstacle bounding boxes in the forward camera perspective."""
        candidates = []
        roi = frame[horizon_y:int(height * 0.95), :]
        roi_h, roi_w = roi.shape[:2]

        if roi_h < 30 or roi_w < 30:
            return []

        gray = cv2.cvtColor(roi, cv2.COLOR_BGR2GRAY)
        hsv = cv2.cvtColor(roi, cv2.COLOR_BGR2HSV)

        # 1. Edge & structure map
        blurred = cv2.GaussianBlur(gray, (5, 5), 0)
        edges = cv2.Canny(blurred, 40, 140)

        # 2. Color saturation (vehicles, brake lights, signs vs asphalt)
        sat = hsv[:, :, 1]
        _, sat_mask = cv2.threshold(sat, 30, 255, cv2.THRESH_BINARY)

        # 3. Undercarriage dark shadow
        _, dark_mask = cv2.threshold(blurred, 40, 255, cv2.THRESH_BINARY_INV)

        combined = cv2.bitwise_or(edges, cv2.bitwise_or(sat_mask, dark_mask))
        kernel = cv2.getStructuringElement(cv2.MORPH_RECT, (15, 11))
        closed = cv2.morphologyEx(combined, cv2.MORPH_CLOSE, kernel)

        contours, _ = cv2.findContours(closed, cv2.RETR_EXTERNAL, cv2.CHAIN_APPROX_SIMPLE)

        for cnt in contours:
            area = cv2.contourArea(cnt)
            if area < 1200:
                continue

            x, y, w, h = cv2.boundingRect(cnt)
            aspect_ratio = float(w) / max(h, 1)

            # Reject full-screen bands
            if w > width * 0.85 or h > height * 0.80:
                continue

            obj_type = "pedestrian" if (aspect_ratio < 0.55 and h > 45) else "vehicle"

            candidates.append({
                "bbox": [int(x), int(horizon_y + y), int(w), int(h)],
                "type": obj_type,
            })

        return candidates

    def _match_and_update_tracks(self, candidates, t_sec):
        """Distance-based centroid tracker with IoU fallback."""
        matched_tracks = set()
        matched_candidates = set()

        for track_id, entity in list(self.tracks.items()):
            prev_cx, prev_cy = entity.latest_centroid
            best_cand_idx = None
            min_dist = 160.0

            for idx, cand in enumerate(candidates):
                if idx in matched_candidates:
                    continue
                bx, by, bw, bh = cand["bbox"]
                cx = bx + bw / 2.0
                cy = by + bh / 2.0
                dist = math.hypot(cx - prev_cx, cy - prev_cy)
                if dist < min_dist:
                    min_dist = dist
                    best_cand_idx = idx

            if best_cand_idx is not None:
                entity.update(candidates[best_cand_idx]["bbox"], t_sec)
                matched_tracks.add(track_id)
                matched_candidates.add(best_cand_idx)
            else:
                entity.disappeared += 1
                if entity.disappeared > TRACKER_MAX_DISAPPEARED:
                    del self.tracks[track_id]

        for idx, cand in enumerate(candidates):
            if idx not in matched_candidates:
                new_entity = TrackedEntity(self.next_id, cand["bbox"], cand["type"])
                self.tracks[self.next_id] = new_entity
                self.next_id += 1

    def _analyze_collision_risk(self, entity, bus_speed_kmh, corridor_left, corridor_right, frame_w, frame_h, timestamp):
        """Compute Time-To-Collision (TTC) and cut-in behavior."""
        t_first, bbox_first, (cx_first, cy_first) = entity.history[0]
        t_last, bbox_last, (cx_last, cy_last) = entity.history[-1]
        dt = max(0.01, t_last - t_first)

        w_last, h_last = bbox_last[2], bbox_last[3]
        h_first = bbox_first[3]

        scale_rate = (h_last - h_first) / dt
        lateral_velocity = (cx_last - cx_first) / dt

        in_ego_corridor = (corridor_left <= cx_last <= corridor_right)
        cutting_in = (
            abs(lateral_velocity) > LATERAL_CUT_IN_VELOCITY_THRESH
            and ((cx_first < corridor_left and cx_last >= corridor_left) or
                 (cx_first > corridor_right and cx_last <= corridor_right))
        )

        proximity_ratio = (bbox_last[1] + h_last) / float(frame_h)

        if scale_rate > 6.0:
            optical_ttc = h_last / scale_rate
        else:
            optical_ttc = 99.0

        bus_speed_mps = bus_speed_kmh / 3.6
        if proximity_ratio > 0.65 and bus_speed_mps > 3.0:
            optical_ttc = min(optical_ttc, 1.8)

        hazard_type = None
        risk_level = None

        if cutting_in and proximity_ratio > 0.45:
            hazard_type = "SUDDEN_CUT_IN"
            risk_level = "CRITICAL" if optical_ttc < TTC_CRITICAL_THRESHOLD else "WARNING"
        elif entity.object_type == "pedestrian" and in_ego_corridor and proximity_ratio > 0.55:
            hazard_type = "PEDESTRIAN_IN_PATH"
            risk_level = "CRITICAL"
        elif in_ego_corridor and optical_ttc <= TTC_CRITICAL_THRESHOLD:
            hazard_type = "FORWARD_COLLISION_TTC"
            risk_level = "CRITICAL"
        elif in_ego_corridor and optical_ttc <= TTC_WARNING_THRESHOLD and proximity_ratio > 0.50:
            hazard_type = "FORWARD_COLLISION_TTC"
            risk_level = "WARNING"

        if not hazard_type:
            return None

        confidence = 0.70 + (0.25 if risk_level == "CRITICAL" else 0.15)
        confidence = round(min(0.98, max(NEAR_MISS_MIN_CONFIDENCE, confidence)), 3)

        return {
            "event_type": "NEAR_MISS",
            "confidence": confidence,
            "risk_level": risk_level,
            "hazard_sub_type": hazard_type,
            "ttc_seconds": round(float(optical_ttc), 2) if optical_ttc < 90 else None,
            "object_type": entity.object_type,
            "track_id": entity.track_id,
            "bbox": [int(x) for x in bbox_last],
            "proximity_score": round(proximity_ratio, 3),
            "timestamp": timestamp,
        }
