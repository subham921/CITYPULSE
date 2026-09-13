"""Test AI Vision and Pothole Detector on a pre-recorded video file.

Usage:
    # Run and display live detection window:
    python ai/test_video.py --video path/to/dashcam.mp4

    # Run and save annotated output video:
    python ai/test_video.py --video path/to/dashcam.mp4 --output results/annotated.mp4

    # Run in headless mode (no GUI window):
    python ai/test_video.py --video path/to/dashcam.mp4 --no-display
"""

import argparse
from datetime import datetime, timezone
from pathlib import Path
import sys
import time
import cv2

# Add repository root to python path
ROOT_DIR = Path(__file__).parent.parent
if str(ROOT_DIR) not in sys.path:
    sys.path.insert(0, str(ROOT_DIR))

from ai.vision_engine import VisionEngine
from ai.pothole_detector import PotholeDetector


def process_video(
    video_path: str,
    output_path: str = None,
    display: bool = True,
    bus_speed_kmh: float = 35.0,
    detector_mode: str = "all",
    model_path: str = None,
):
    """Process a pre-recorded video and perform road hazard detection."""
    cap = cv2.VideoCapture(video_path)
    if not cap.isOpened():
        print(f"[Error] Failed to open video file: '{video_path}'")
        return

    # Video properties
    total_frames = int(cap.get(cv2.CAP_PROP_FRAME_COUNT))
    fps = cap.get(cv2.CAP_PROP_FPS) or 30.0
    width = int(cap.get(cv2.CAP_PROP_FRAME_WIDTH))
    height = int(cap.get(cv2.CAP_PROP_FRAME_HEIGHT))
    duration_sec = total_frames / fps if fps > 0 else 0

    print("=" * 60)
    print("      CITYPULSE PRE-RECORDED VIDEO TESTING TOOL")
    print("=" * 60)
    print(f" Source Video : {video_path}")
    print(f" Resolution   : {width} x {height}")
    print(f" Total Frames : {total_frames} (~{duration_sec:.1f}s at {fps:.1f} FPS)")
    print(f" Mode         : {detector_mode.upper()}")
    print(f" Display GUI  : {display}")
    if model_path:
        print(f" Neural Model : {model_path}")
    if output_path:
        print(f" Save Output  : {output_path}")
    print("=" * 60)
    print("Controls: Press 'q' to quit, 'space' to pause/resume playback.\n")

    # Initialize vision engine / pothole detector
    engine = VisionEngine(model_weights=model_path)
    pothole_only_detector = PotholeDetector(model_path=model_path) if detector_mode == "pothole" else None

    # Default output path if none provided
    if output_path is None:
        output_path = str(Path(video_path).parent / f"annotated_{Path(video_path).name}")

    # Video writer
    out_file = Path(output_path)
    out_file.parent.mkdir(parents=True, exist_ok=True)
    fourcc = cv2.VideoWriter_fourcc(*"mp4v")
    writer = cv2.VideoWriter(str(out_file), fourcc, fps, (width, height))

    frame_idx = 0
    start_time = time.time()
    all_detected_events = []
    paused = False
    has_gui = display

    try:
        while True:
            if not paused:
                ret, frame = cap.read()
                if not ret:
                    break

                frame_idx += 1
                timestamp = datetime.now(timezone.utc).isoformat()

                if detector_mode == "pothole":
                    # Direct Pothole Detector run
                    events = pothole_only_detector.detect(frame, timestamp=timestamp)
                    annotated = frame.copy()
                    h, w = annotated.shape[:2]

                    # Top HUD
                    cv2.rectangle(annotated, (0, 0), (w, 45), (20, 20, 20), -1)
                    cv2.putText(
                        annotated,
                        f"CITYPULSE ROAD DISTRESS & POTHOLE MONITOR | POTHOLES DETECTED: {len(events)}",
                        (15, 30),
                        cv2.FONT_HERSHEY_SIMPLEX,
                        0.65,
                        (0, 255, 200),
                        2,
                    )

                    # Draw Pothole Bounding Boxes
                    for pot in events:
                        x, y, pw, ph = pot["bbox"]
                        color = (0, 0, 255) if pot["severity"] == "SEVERE" else (0, 140, 255)
                        cv2.rectangle(annotated, (x, y), (x + pw, y + ph), color, 2)
                        label = f"POTHOLE ({pot['severity']} {pot['confidence']*100:.0f}%)"
                        cv2.putText(annotated, label, (x, max(20, y - 8)), cv2.FONT_HERSHEY_SIMPLEX, 0.5, color, 2)
                else:
                    # Full vision engine (Pothole + Near-Miss + Missing Divider)
                    events, annotated = engine.process_frame(
                        frame, bus_speed_kmh=bus_speed_kmh, timestamp=timestamp
                    )

                if events:
                    for ev in events:
                        ev_type = ev.get("event_type", "HAZARD")
                        conf = ev.get("confidence", 0) * 100
                        print(f"[Frame {frame_idx:04d}/{total_frames}] ALERT: {ev_type:<15} Conf: {conf:.1f}% | Details: {ev}")
                        all_detected_events.append((frame_idx, ev))

                # Write to annotated output video
                if writer:
                    writer.write(annotated)

            if has_gui:
                try:
                    cv2.imshow("CITYPULSE Road Hazard & Pothole Vision", annotated)
                    key = cv2.waitKey(1 if not paused else 30) & 0xFF
                    if key == ord("q"):
                        print("\n[!] Playback stopped by user.")
                        break
                    elif key == ord(" "):  # Space bar to toggle pause
                        paused = not paused
                        print(f"[{'PAUSED' if paused else 'RESUMED'}]")
                except cv2.error:
                    has_gui = False
                    print("[Note] Headless environment detected: saving output video directly without GUI window.")

    finally:
        cap.release()
        if writer:
            writer.release()
        if has_gui:
            try:
                cv2.destroyAllWindows()
            except Exception:
                pass

    elapsed = time.time() - start_time
    actual_fps = frame_idx / elapsed if elapsed > 0 else 0

    print("\n" + "=" * 60)
    print("                    PROCESSING SUMMARY")
    print("=" * 60)
    print(f" Frames Processed: {frame_idx} / {total_frames}")
    print(f" Processing Time : {elapsed:.2f}s ({actual_fps:.1f} FPS)")
    print(f" Total Incidents : {len(all_detected_events)}")

    # Incident counts by type
    counts = {}
    for _, ev in all_detected_events:
        t = ev.get("event_type", "OTHER")
        counts[t] = counts.get(t, 0) + 1

    for t, c in counts.items():
        print(f"   - {t:<16}: {c} events")

    if output_path:
        print(f" Annotated Video : {output_path}")
    print("=" * 60)


def main():
    parser = argparse.ArgumentParser(description="Test CITYPULSE AI Vision on a pre-recorded video")
    parser.add_argument("--video", "-v", required=True, help="Path to input video file (.mp4, .avi, .mov, etc.)")
    parser.add_argument("--output", "-o", default=None, help="Path to save annotated video output (.mp4)")
    parser.add_argument("--no-display", action="store_true", help="Disable GUI window preview")
    parser.add_argument("--speed", type=float, default=35.0, help="Simulated bus speed in km/h (default: 35.0)")
    parser.add_argument(
        "--detector",
        choices=["all", "pothole"],
        default="all",
        help="Detector mode: 'all' (Potholes + Near Miss + Dividers) or 'pothole' (default: all)",
    )
    parser.add_argument("--conf", type=float, default=None, help="Minimum confidence threshold (e.g. 0.65 to filter false positives)")
    parser.add_argument("--model", "-m", default=None, help="Path to custom ONNX deep learning weights (.onnx)")

    args = parser.parse_args()

    # Override config threshold if specified
    if args.conf is not None:
        import ai.config as cfg
        cfg.POTHOLE_CONFIDENCE_THRESHOLD = args.conf
        cfg.NEAR_MISS_MIN_CONFIDENCE = args.conf

    process_video(
        video_path=args.video,
        output_path=args.output,
        display=not args.no_display,
        bus_speed_kmh=args.speed,
        detector_mode=args.detector,
        model_path=args.model,
    )


if __name__ == "__main__":
    main()
