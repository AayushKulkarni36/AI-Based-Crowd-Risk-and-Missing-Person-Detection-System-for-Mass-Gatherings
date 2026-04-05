#!/usr/bin/env python3
"""
CrowdSafe YOLOv8 Crowd Detection
Simple, focused pipeline: video → detect → classify → JSON
"""
import sys
import json
import argparse
import cv2
import numpy as np
import time
from datetime import datetime
from pathlib import Path

try:
    from ultralytics import YOLO
    import torch
except ImportError as e:
    print(json.dumps({"error": f"Missing dependency: {e}"}))
    sys.exit(1)


def main():
    parser = argparse.ArgumentParser(description='Crowd detection via YOLOv8')
    parser.add_argument('--video', required=True, help='Video file path')
    parser.add_argument('--json', action='store_true', help='Output JSON')
    parser.add_argument('--skip', type=int, default=3, help='Frame skip interval')
    args = parser.parse_args()

    # Validate file
    video_path = Path(args.video)
    if not video_path.exists():
        print(json.dumps({"error": f"File not found: {args.video}"}))
        sys.exit(1)

    try:
        # Load model
        device = 'cuda' if torch.cuda.is_available() else 'cpu'
        print(f'INFO: Loading YOLOv8n on {device}', file=sys.stderr, flush=True)
        model = YOLO('yolov8n.pt')

        # Open video
        cap = cv2.VideoCapture(str(video_path))
        if not cap.isOpened():
            print(json.dumps({"error": f"Cannot open video: {args.video}"}))
            sys.exit(1)

        # Get video properties
        total_frames = int(cap.get(cv2.CAP_PROP_FRAME_COUNT))
        fps = cap.get(cv2.CAP_PROP_FPS) or 25.0
        width = int(cap.get(cv2.CAP_PROP_FRAME_WIDTH))
        height = int(cap.get(cv2.CAP_PROP_FRAME_HEIGHT))

        # Process frames
        counts = []
        frame_num = 0
        start_time = time.time()

        while True:
            ret, frame = cap.read()
            if not ret:
                break

            frame_num += 1

            # Skip frames
            if frame_num % args.skip != 0:
                continue

            # Detect people (class 0 in COCO)
            results = model.predict(
                frame,
                classes=[0],
                conf=0.45,
                verbose=False,
                device=device
            )

            person_count = len(results[0].boxes)
            counts.append(person_count)

            # Emit progress
            progress = int((frame_num / total_frames) * 100) if total_frames > 0 else 0
            print(f'PROGRESS:{progress}', flush=True)

        cap.release()

        # Ensure we have data
        if not counts:
            counts = [0]

        elapsed = time.time() - start_time

        # Classify risk
        max_people = int(max(counts))
        avg_people = round(sum(counts) / len(counts), 1) if counts else 0

        if max_people < 10:
            risk_level = 'SAFE'
        elif max_people < 25:
            risk_level = 'MODERATE'
        elif max_people < 50:
            risk_level = 'RISKY'
        else:
            risk_level = 'CRITICAL'

        # Build output
        output = {
            "totalPeople": max_people,
            "avgPeoplePerFrame": avg_people,
            "totalFrames": len(counts),
            "maxPeople": max_people,
            "minPeople": int(min(counts)) if counts else 0,
            "riskLevel": risk_level,
            "averageFPS": round(len(counts) / elapsed, 1) if elapsed > 0 else 0,
            "processingTimeSeconds": round(elapsed, 1),
            "frameWidth": width,
            "frameHeight": height,
            "videoSource": str(video_path),
            "timestamp": datetime.utcnow().isoformat() + "Z"
        }

        # Output JSON as last line
        print(json.dumps(output), flush=True)
        sys.exit(0)

    except Exception as e:
        output = {"error": str(e)}
        print(json.dumps(output))
        sys.exit(1)


if __name__ == '__main__':
    main()
