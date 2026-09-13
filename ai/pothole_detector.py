"""Pothole and road surface distress detector for bus-mounted forward camera.

Anti-False-Positive Pipeline:
1. Ego-Lane Perspective Trapezoid Mask: Focuses strictly on the driving corridor in front
   of the vehicle, eliminating side objects (trees, divider barriers, sidewalk pedestrians, buildings).
2. Vehicle Body & Taillight Anti-Shadow Filter: Checks the region directly above candidate
   dark blobs to reject car undercarriages, black bumpers, and wheel shadows.
3. Vertical Structure Rejection: Rejects tall vertical shapes (aspect ratio < 0.60), ensuring
   only horizontal/elliptical depressions on the ground plane are captured.
4. Perspective-aware Scale Envelope: Restricts maximum allowed size based on road distance
   (prevents large distant vehicles from being mistaken for giant potholes).
5. Deep Learning ONNX (YOLO/MobileNet) inference with automated NMS.
"""

from datetime import datetime, timezone
from pathlib import Path
import cv2
import numpy as np

from ai.config import (
    POTHOLE_CONFIDENCE_THRESHOLD,
    POTHOLE_DARKNESS_RATIO,
    POTHOLE_MAX_AREA,
    POTHOLE_MIN_AREA,
    POTHOLE_ROI_Y_START,
)


class PotholeDetector:
    def __init__(self, model_path=None):
        self.model_path = model_path
        self.net = None

        if model_path is None:
            default_onnx = Path(__file__).parent / "models" / "pothole_detector.onnx"
            if default_onnx.exists():
                model_path = str(default_onnx)

        if model_path and Path(model_path).exists():
            try:
                self.net = cv2.dnn.readNet(str(model_path))
                self.net.setPreferableBackend(cv2.dnn.DNN_BACKEND_OPENCV)
                self.net.setPreferableTarget(cv2.dnn.DNN_TARGET_CPU)
                print(f"[PotholeDetector] Loaded Deep Learning model: {model_path}")
            except Exception as e:
                print(f"[PotholeDetector] Could not load ONNX model ({e}), falling back to CV.")
                self.net = None

    def detect(self, frame, timestamp=None):
        """Analyze a frame and return verified road pothole events."""
        if frame is None or frame.size == 0:
            return []

        if timestamp is None:
            timestamp = datetime.now(timezone.utc).isoformat()

        height, width = frame.shape[:2]

        if self.net is not None:
            events = self._detect_dnn(frame, width, height, timestamp)
            if events:
                return events

        return self._detect_cv(frame, width, height, timestamp)

    def _detect_cv(self, frame, full_width, full_height, timestamp):
        """Advanced computer vision pipeline with strict false-positive rejection."""
        events = []

        roi_y_start = int(full_height * POTHOLE_ROI_Y_START)
        roi_y_end = int(full_height * 0.92)  # Exclude vehicle hood / bonnet at bottom
        roi = frame[roi_y_start:roi_y_end, :]
        roi_h, roi_w = roi.shape[:2]

        if roi_h < 30 or roi_w < 30:
            return []

        # 1. Ego-Lane Perspective Trapezoid Mask
        # Eliminates side trees, divider barriers, curbs, oncoming lanes, sky
        road_mask = np.zeros((roi_h, roi_w), dtype=np.uint8)
        trap_pts = np.array([
            [int(roi_w * 0.26), 0],
            [int(roi_w * 0.74), 0],
            [int(roi_w * 0.92), roi_h],
            [int(roi_w * 0.08), roi_h]
        ], np.int32)
        cv2.fillPoly(road_mask, [trap_pts], 255)

        gray = cv2.cvtColor(roi, cv2.COLOR_BGR2GRAY)
        blurred = cv2.bilateralFilter(gray, d=7, sigmaColor=50, sigmaSpace=50)

        # Calculate median road brightness inside the driving corridor
        road_pixels = blurred[road_mask > 0]
        if len(road_pixels) == 0:
            return []
        median_brightness = np.median(road_pixels)
        if median_brightness < 12:  # Pitch black
            return []

        # 2. Multi-Cue Depression Segmentation (Darkness + Morphological Black-Hat)
        dark_thresh = int(median_brightness * POTHOLE_DARKNESS_RATIO)
        _, thresh_dark = cv2.threshold(blurred, dark_thresh, 255, cv2.THRESH_BINARY_INV)
        thresh_dark = cv2.bitwise_and(thresh_dark, thresh_dark, mask=road_mask)

        k_big = cv2.getStructuringElement(cv2.MORPH_ELLIPSE, (35, 35))
        blackhat = cv2.morphologyEx(blurred, cv2.MORPH_BLACKHAT, k_big)
        blackhat = cv2.bitwise_and(blackhat, blackhat, mask=road_mask)
        _, thresh_bh = cv2.threshold(blackhat, 16, 255, cv2.THRESH_BINARY)

        combined = cv2.bitwise_or(thresh_dark, thresh_bh)

        # Consolidate candidate cavities
        close_k = cv2.getStructuringElement(cv2.MORPH_ELLIPSE, (9, 9))
        closed = cv2.morphologyEx(combined, cv2.MORPH_CLOSE, close_k)
        opened = cv2.morphologyEx(closed, cv2.MORPH_OPEN, cv2.getStructuringElement(cv2.MORPH_ELLIPSE, (5, 5)))

        contours, _ = cv2.findContours(opened, cv2.RETR_EXTERNAL, cv2.CHAIN_APPROX_SIMPLE)

        for cnt in contours:
            area = cv2.contourArea(cnt)
            if area < POTHOLE_MIN_AREA or area > POTHOLE_MAX_AREA:
                continue

            x, y, bw, bh = cv2.boundingRect(cnt)
            aspect_ratio = float(bw) / max(bh, 1)

            # --- FALSE POSITIVE REJECTION RULES ---

            # Rule 1: Vertical Structure Filter (Trees, Divider Posts, Pedestrians)
            # Potholes on the road plane are horizontal / elliptical (aspect ratio 0.55 to 4.2)
            if aspect_ratio < 0.55 or aspect_ratio > 4.5:
                continue

            # Rule 2: Perspective Size Envelope (Vehicles are too wide at distance)
            depth_ratio = y / float(roi_h)
            max_allowed_w = int(roi_w * (0.12 + 0.38 * depth_ratio))
            if bw > max_allowed_w:
                continue

            # Rule 3: Vehicle Body & Brake Light Check Above Shadow
            # Check region directly above the candidate for vehicle color / metal / lights
            global_y = roi_y_start + y
            check_y_top = max(0, global_y - int(bh * 1.3))
            above_patch = frame[check_y_top:global_y, x:x+bw]
            if above_patch.size > 0:
                above_hsv = cv2.cvtColor(above_patch, cv2.COLOR_BGR2HSV)
                above_sat = float(np.mean(above_hsv[:, :, 1]))
                # Vehicles exhibit high saturation (red taillights, paint, bumper reflections) vs asphalt (<15)
                if above_sat > 40.0:
                    continue

                # Also check vertical edge density above (car rear windshield / trunk edges)
                above_gray = cv2.cvtColor(above_patch, cv2.COLOR_BGR2GRAY)
                above_edges = cv2.Canny(above_gray, 50, 150)
                edge_density = np.count_nonzero(above_edges) / float(above_patch.shape[0] * above_patch.shape[1])
                if edge_density > 0.14:  # Complex vehicle body structure above
                    continue

            # Rule 4: Solidity & Convexity (Reject spindly tree shadows / lane lines)
            hull = cv2.convexHull(cnt)
            hull_area = cv2.contourArea(hull)
            solidity = float(area) / max(hull_area, 1.0)
            if solidity < 0.40:
                continue

            # Rule 5: Darkness Contrast vs Surrounding Asphalt
            cnt_mask = np.zeros(gray.shape, dtype=np.uint8)
            cv2.drawContours(cnt_mask, [cnt], -1, 255, -1)

            inside_mean = cv2.mean(gray, mask=cnt_mask)[0]
            contrast_drop = max(0.0, median_brightness - inside_mean)
            if contrast_drop < 4.0:
                continue

            contrast_score = min(1.0, contrast_drop / (median_brightness * (1.0 - POTHOLE_DARKNESS_RATIO) + 1e-5))
            confidence = 0.50 * contrast_score + 0.35 * min(1.0, area / 10000.0) + 0.15 * min(1.0, solidity / 0.85)
            confidence = round(float(max(0.50, min(0.97, confidence))), 3)

            if confidence < POTHOLE_CONFIDENCE_THRESHOLD:
                continue

            severity = "SEVERE" if (area > 5000 or contrast_drop > 25.0) else "MODERATE"

            events.append({
                "event_type": "POTHOLE",
                "confidence": confidence,
                "severity": severity,
                "bbox": [int(x), int(global_y), int(bw), int(bh)],
                "area_px": int(area),
                "norm_coords": [round(x / full_width, 3), round(global_y / full_height, 3)],
                "timestamp": timestamp,
            })

        return events

    def _detect_dnn(self, frame, full_width, full_height, timestamp):
        """Run deep learning forward pass (YOLOv5/v8 ONNX or MobileNet SSD) with NMS."""
        try:
            blob = cv2.dnn.blobFromImage(frame, 1 / 255.0, (640, 640), swapRB=True, crop=False)
            self.net.setInput(blob)
            outputs = self.net.forward()

            boxes = []
            confidences = []
            events = []

            if len(outputs.shape) == 3:
                output = outputs[0]
                if output.shape[0] < output.shape[1]:
                    output = output.T

                for row in output:
                    classes_scores = row[4:]
                    _, max_score, _, _ = cv2.minMaxLoc(classes_scores)
                    if max_score >= POTHOLE_CONFIDENCE_THRESHOLD:
                        cx, cy, w, h = row[0:4]
                        x = int((cx - w / 2) * (full_width / 640.0))
                        y = int((cy - h / 2) * (full_height / 640.0))
                        bw = int(w * (full_width / 640.0))
                        bh = int(h * (full_height / 640.0))
                        boxes.append([x, y, bw, bh])
                        confidences.append(float(max_score))

                indices = cv2.dnn.NMSBoxes(boxes, confidences, POTHOLE_CONFIDENCE_THRESHOLD, 0.45)
                if len(indices) > 0:
                    for i in indices.flatten():
                        bx, by, bw, bh = boxes[i]
                        conf = confidences[i]
                        area = bw * bh
                        events.append({
                            "event_type": "POTHOLE",
                            "confidence": round(conf, 3),
                            "severity": "SEVERE" if area > 6000 else "MODERATE",
                            "bbox": [bx, by, bw, bh],
                            "area_px": int(area),
                            "norm_coords": [round(bx / full_width, 3), round(by / full_height, 3)],
                            "timestamp": timestamp,
                        })

            return events
        except Exception:
            return []
