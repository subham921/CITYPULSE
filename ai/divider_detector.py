"""Missing or Damaged Road Divider Detector for bus-mounted camera.

Identifies road median barriers, monitors longitudinal continuity, and detects
dangerous breaks or absent divider sections exposing oncoming traffic.
"""

from datetime import datetime, timezone
import cv2
import numpy as np

from ai.config import (
    DIVIDER_GAP_PIXELS_MIN,
    DIVIDER_MIN_CONTINUITY_FRAMES,
    DIVIDER_ROI_X_MAX,
    DIVIDER_ROI_X_MIN,
    DIVIDER_ROI_Y_START,
)


class DividerDetector:
    def __init__(self):
        self.consecutive_missing_frames = 0
        self.median_previously_present = False
        self.min_edge_pixels_per_row = 4

    def detect(self, frame, timestamp=None):
        """Analyze frame for missing or damaged divider barriers.

        Args:
            frame (np.ndarray): BGR image frame.
            timestamp (str, optional): ISO timestamp.

        Returns:
            list[dict]: List containing missing divider event if detected, else empty.
        """
        if frame is None or frame.size == 0:
            return []

        if timestamp is None:
            timestamp = datetime.now(timezone.utc).isoformat()

        height, width = frame.shape[:2]

        # Extract Median Divider Corridor ROI
        x_start = int(width * DIVIDER_ROI_X_MIN)
        x_end = int(width * DIVIDER_ROI_X_MAX)
        y_start = int(height * DIVIDER_ROI_Y_START)
        roi = frame[y_start:, x_start:x_end]

        roi_h, roi_w = roi.shape[:2]
        if roi_h < 20 or roi_w < 20:
            return []

        # Convert to grayscale
        gray = cv2.cvtColor(roi, cv2.COLOR_BGR2GRAY)

        # Sobel vertical & diagonal edge filter to catch barrier lines/posts
        sobel_x = cv2.Sobel(gray, cv2.CV_64F, 1, 0, ksize=3)
        edge_active = (np.absolute(sobel_x) > 30).astype(np.uint8)

        # Longitudinal profile along depth: count edge pixels per row
        active_px_per_row = np.sum(edge_active, axis=1)

        # A row has barrier edge if active edge pixels >= min_edge_pixels_per_row
        row_has_barrier = active_px_per_row >= self.min_edge_pixels_per_row
        barrier_row_ratio = np.count_nonzero(row_has_barrier) / float(roi_h)

        has_barrier_now = barrier_row_ratio > 0.35

        # Check for internal physical gap within an otherwise present barrier
        if has_barrier_now:
            self.median_previously_present = True
            self.consecutive_missing_frames = 0
            gap_event = self._find_spatial_gap(row_has_barrier, x_start, y_start, roi_w, roi_h, timestamp)
            if gap_event:
                return [gap_event]
            return []

        # If a median barrier was previously present on this stretch and is suddenly missing
        if self.median_previously_present:
            self.consecutive_missing_frames += 1

            if self.consecutive_missing_frames >= DIVIDER_MIN_CONTINUITY_FRAMES:
                confidence = min(0.92, 0.65 + (self.consecutive_missing_frames * 0.015))
                event = {
                    "event_type": "MISSING_DIVIDER",
                    "confidence": round(confidence, 3),
                    "hazard_level": "HIGH",
                    "hazard_description": "Central median barrier discontinuity / missing barrier",
                    "bbox": [x_start, y_start, roi_w, roi_h],
                    "consecutive_frames": self.consecutive_missing_frames,
                    "timestamp": timestamp,
                }
                if self.consecutive_missing_frames > 45:
                    self.median_previously_present = False
                    self.consecutive_missing_frames = 0
                return [event]

        return []

    def _find_spatial_gap(self, row_has_barrier, x_offset, y_offset, roi_w, roi_h, timestamp):
        """Find interior gaps within the visible divider barrier (broken or removed section)."""
        is_barrier = row_has_barrier.astype(int)
        diffs = np.diff(is_barrier)
        falling_edges = np.where(diffs == -1)[0]
        rising_edges = np.where(diffs == 1)[0]

        for fall in falling_edges:
            next_rises = rising_edges[rising_edges > fall]
            if len(next_rises) > 0:
                gap_len = next_rises[0] - fall
                if gap_len >= DIVIDER_GAP_PIXELS_MIN:
                    gap_y = y_offset + fall
                    est_meters = float(round(gap_len * 0.08, 1))
                    return {
                        "event_type": "MISSING_DIVIDER",
                        "confidence": 0.86,
                        "hazard_level": "HIGH" if est_meters > 3.0 else "MODERATE",
                        "hazard_description": f"Damaged/Missing divider section: ~{est_meters}m gap",
                        "gap_pixels": int(gap_len),
                        "estimated_gap_meters": est_meters,
                        "bbox": [x_offset, int(gap_y), roi_w, int(gap_len)],
                        "timestamp": timestamp,
                    }
        return None
