from __future__ import annotations
import argparse
import json
import logging
import sys
from pathlib import Path
from typing import Union
import cv2
from ultralytics import YOLO

LOGGER = logging.getLogger(__name__)

def parse_args() -> argparse.Namespace:
    parser = argparse.ArgumentParser(description="YOLOv5 crowd detection runner")
    parser.add_argument('--video', type=str, default='0', help='Video source path or webcam index (default: 0)')
    parser.add_argument('--output', type=str, default='', help='Output video file path (e.g., data/results/output.avi)')
    parser.add_argument('--json', action='store_true', help='Emit JSON summary to stdout for backend integration')
    parser.add_argument('--display', action='store_true', help='Display annotated frames in a window')
    parser.add_argument('--confidence', type=float, default=0.4, help='Detection confidence threshold')
    return parser.parse_args()

def resolve_video_source(source: str) -> Union[int, str]:
    if source.isdigit():
        return int(source)
    path = Path(source)
    if not path.exists():
        raise FileNotFoundError(f"Video file not found: {source}")
    return str(path)

def initialise_writer(output_path: str, width: int, height: int, fps: float) -> cv2.VideoWriter | None:
    if not output_path:
        return None
    output_file = Path(output_path)
    output_file.parent.mkdir(parents=True, exist_ok=True)
    fourcc = cv2.VideoWriter_fourcc(*('XVID' if output_file.suffix.lower() == '.avi' else 'mp4v'))
    writer = cv2.VideoWriter(str(output_file), fourcc, fps or 20.0, (width, height))
    if not writer.isOpened():
        raise RuntimeError(f"Failed to open video writer for {output_path}")
    return writer

def calculate_risk(max_people: int) -> str:
    capacity = 40
    occupancy_percent = (max_people / capacity) * 100
    if occupancy_percent < 80:
        return 'SAFE'
    elif occupancy_percent < 95:
        return 'MODERATE'
    elif occupancy_percent < 110:
        return 'RISKY'
    else:
        return 'CRITICAL'

def run_detection(args: argparse.Namespace) -> dict:
    LOGGER.info("Loading YOLOv5 model...")
    model = YOLO('yolov5s.pt')
    source = resolve_video_source(args.video)
    LOGGER.info("Opening video source: %s", source)
    cap = cv2.VideoCapture(source)
    if not cap.isOpened():
        raise RuntimeError(f"Unable to open video source: {args.video}")
    width = int(cap.get(cv2.CAP_PROP_FRAME_WIDTH) or 1280)
    height = int(cap.get(cv2.CAP_PROP_FRAME_HEIGHT) or 720)
    fps = cap.get(cv2.CAP_PROP_FPS) or 20.0
    writer = initialise_writer(args.output, width, height, fps) if args.output else None
    frame_count = 0
    cumulative_people = 0
    max_people = 0
    try:
        window_name = 'YOLOv5 Crowd Detection'
        if args.display:
            cv2.namedWindow(window_name, cv2.WINDOW_NORMAL)
            cv2.setWindowProperty(window_name, cv2.WND_PROP_AUTOSIZE, 1)
        while True:
            ret, frame = cap.read()
            if not ret:
                LOGGER.info("End of stream reached.")
                break
            if isinstance(source, int):
                frame = cv2.flip(frame, 1)
            results = model(frame, classes=[0], conf=args.confidence, verbose=False)
            annotated_frame = results[0].plot()
            person_count = len(results[0].boxes) if results[0].boxes is not None else 0
            cumulative_people += person_count
            frame_count += 1
            max_people = max(max_people, person_count)
            cv2.putText(annotated_frame, f"Persons: {person_count}", (20, 60), cv2.FONT_HERSHEY_SIMPLEX, 1.5, (0, 255, 0), 4)
            cv2.putText(annotated_frame, f"Frame: {frame_count}", (20, 120), cv2.FONT_HERSHEY_SIMPLEX, 1.0, (255, 255, 255), 3)
            if writer:
                writer.write(annotated_frame)
            if args.display:
                cv2.imshow(window_name, annotated_frame)
                if cv2.waitKey(1) & 0xFF == ord('q'):
                    LOGGER.info("User requested exit.")
                    break
    finally:
        cap.release()
        if writer:
            writer.release()
        if args.display:
            cv2.destroyAllWindows()
    avg_people = (cumulative_people / frame_count) if frame_count else 0
    risk_level = calculate_risk(max_people)
    LOGGER.info("Processed %s frames", frame_count)
    LOGGER.info("Average people per frame: %.2f", avg_people)
    LOGGER.info("Maximum people detected: %s", max_people)
    return {
        'totalPeople': max_people,
        'avgPeoplePerFrame': round(avg_people, 2),
        'totalFrames': frame_count,
        'maxPeople': max_people,
        'riskLevel': risk_level
    }

def main() -> int:
    args = parse_args()
    logging.basicConfig(level=logging.WARNING if args.json else logging.INFO, format='[%(levelname)s] %(message)s')
    try:
        results = run_detection(args)
    except Exception as exc:
        LOGGER.error("Detection failed: %s", exc)
        if args.json:
            error_payload = {'error': str(exc)}
            print(json.dumps(error_payload))
        return 1
    if args.json:
        print(json.dumps(results))
    else:
        print("\n=== Detection Summary ===")
        print(f"Frames processed: {results['totalFrames']}")
        print(f"Total people counted: {results['totalPeople']}")
        print(f"Average people per frame: {results['avgPeoplePerFrame']:.2f}")
        print(f"Maximum people in a frame: {results['maxPeople']}")
        print(f"Risk level: {results['riskLevel']}")
    return 0

if __name__ == '__main__':
    sys.exit(main())
