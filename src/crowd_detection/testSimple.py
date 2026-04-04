#!/usr/bin/env python3
"""
CrowdSafe YOLOv8 Crowd Detection Pipeline
Processes video frames, detects people, classifies crowd risk, outputs JSON
"""

import sys
import json
import argparse
import cv2
import numpy as np
import time
from pathlib import Path
from datetime import datetime
from ultralytics import YOLO
import torch

# ============================================================================
# CONFIG
# ============================================================================
MODEL_NAME = 'yolov8n.pt'  # nano model for RTX 3050 Ti
PERSON_CLASS = 0  # COCO class for person
CONF_THRESHOLD = 0.45
IOU_THRESHOLD = 0.45

# Risk classification thresholds
RISK_THRESHOLDS = {
    'SAFE': 10,
    'MODERATE': 25,
    'RISKY': 50,
    'CRITICAL': float('inf')
}

# ============================================================================
# LOGGING (stderr only - stdout reserved for JSON)
# ============================================================================
def log_error(msg):
    """Log error to stderr"""
    print(f'ERROR: {msg}', file=sys.stderr, flush=True)

def log_info(msg):
    """Log info to stderr"""
    print(f'INFO: {msg}', file=sys.stderr, flush=True)

# ============================================================================
# RISK CLASSIFICATION
# ============================================================================
def classify_risk(person_count):
    """Classify crowd risk based on person count"""
    if person_count < RISK_THRESHOLDS['SAFE']:
        return 'SAFE'
    elif person_count < RISK_THRESHOLDS['MODERATE']:
        return 'MODERATE'
    elif person_count < RISK_THRESHOLDS['RISKY']:
        return 'RISKY'
    else:
        return 'CRITICAL'

def get_risk_color(risk_level):
    """Get BGR color for risk visualization"""
    colors = {
        'SAFE': (0, 255, 0),       # Green
        'MODERATE': (0, 165, 255), # Orange
        'RISKY': (0, 69, 255),     # Dark orange/red
        'CRITICAL': (0, 0, 255)    # Red
    }
    return colors.get(risk_level, (255, 255, 255))

# ============================================================================
# VIDEO PROCESSING
# ============================================================================
def process_video(video_path, output_path=None, device='cpu', skip_frames=3,
                  output_json=False):
    """
    Process video file with YOLOv8, detect people, classify risk

    Args:
        video_path: Input video file path
        output_path: Optional output video path (with annotations)
        device: 'cuda' or 'cpu'
        skip_frames: Process every Nth frame (default 3)
        output_json: If True, print JSON to stdout

    Returns:
        dict: Processing results
    """

    # ========================================================================
    # VALIDATION
    # ========================================================================
    video_file = Path(video_path)
    if not video_file.exists():
        log_error(f'Video file not found: {video_path}')
        sys.exit(1)

    log_info(f'Loading YOLOv8 model: {MODEL_NAME}')
    try:
        model = YOLO(MODEL_NAME)
        # Move to device
        if device == 'cuda':
            model = model.to(device)
            use_fp16 = torch.cuda.is_available()
            log_info(f'YOLOv8 loaded on CUDA (FP16={use_fp16})')
        else:
            model = model.to('cpu')
            log_info('YOLOv8 loaded on CPU')
    except Exception as e:
        log_error(f'Failed to load YOLOv8: {e}')
        sys.exit(1)

    # ========================================================================
    # OPEN VIDEO
    # ========================================================================
    log_info(f'Opening video: {video_path}')
    cap = cv2.VideoCapture(str(video_path))

    if not cap.isOpened():
        log_error(f'Cannot open video file: {video_path}')
        sys.exit(1)

    # Get video properties
    fps = cap.get(cv2.CAP_PROP_FPS)
    width = int(cap.get(cv2.CAP_PROP_FRAME_WIDTH))
    height = int(cap.get(cv2.CAP_PROP_FRAME_HEIGHT))
    total_frames = int(cap.get(cv2.CAP_PROP_FRAME_COUNT))

    log_info(f'Video: {width}x{height} @ {fps:.1f}fps, {total_frames} frames')

    # ========================================================================
    # VIDEO WRITER (optional)
    # ========================================================================
    writer = None
    if output_path:
        fourcc = cv2.VideoWriter_fourcc(*'mp4v')
        writer = cv2.VideoWriter(
            output_path,
            fourcc,
            fps,
            (width, height)
        )
        if not writer.isOpened():
            log_error(f'Cannot create output video: {output_path}')
        else:
            log_info(f'Output video: {output_path}')

    # ========================================================================
    # PROCESS FRAMES
    # ========================================================================
    start_time = time.time()
    frame_count = 0
    person_counts = []  # Track counts for statistics

    try:
        while True:
            ret, frame = cap.read()
            if not ret:
                break

            frame_count += 1

            # Skip frames based on --skip parameter
            if frame_count % skip_frames != 0:
                continue

            # Detect people
            try:
                results = model.predict(
                    frame,
                    classes=[PERSON_CLASS],
                    conf=CONF_THRESHOLD,
                    iou=IOU_THRESHOLD,
                    verbose=False,
                    device=device if device == 'cuda' else None
                )
            except Exception as e:
                log_error(f'Detection failed at frame {frame_count}: {e}')
                continue

            # Count people in this frame
            person_count = len(results[0].boxes) if results[0].boxes is not None else 0
            person_counts.append(person_count)

            # Classify risk
            risk_level = classify_risk(person_count)
            risk_color = get_risk_color(risk_level)

            # Draw bounding boxes on frame
            if results[0].boxes is not None:
                for box in results[0].boxes:
                    x1, y1, x2, y2 = map(int, box.xyxy[0])
                    cv2.rectangle(frame, (x1, y1), (x2, y2), risk_color, 2)

            # Draw text overlay
            text = f'People: {person_count} | Risk: {risk_level}'
            cv2.putText(
                frame, text,
                (10, 30),
                cv2.FONT_HERSHEY_SIMPLEX,
                1.0,
                risk_color,
                2
            )

            # Write frame to output video
            if writer:
                writer.write(frame)

            # Emit progress (every 10 frames)
            if frame_count % (skip_frames * 10) == 0:
                progress_pct = int((frame_count / total_frames) * 100)
                print(f'PROGRESS:{progress_pct}', flush=True)
                log_info(f'Progress: {progress_pct}% ({frame_count}/{total_frames} frames)')

        # ====================================================================
        # CLEANUP & STATISTICS
        # ====================================================================
        cap.release()
        if writer:
            writer.release()

        elapsed = time.time() - start_time

        # Calculate statistics
        if person_counts:
            avg_people = np.mean(person_counts)
            max_people = int(np.max(person_counts))
            min_people = int(np.min(person_counts))
        else:
            avg_people = 0
            max_people = 0
            min_people = 0

        overall_risk = classify_risk(max_people)
        frames_processed = len(person_counts) * skip_frames  # Actual frames analyzed
        avg_fps = frames_processed / elapsed if elapsed > 0 else 0

        # ====================================================================
        # BUILD RESULTS
        # ====================================================================
        results_data = {
            'totalPeople': max_people,
            'avgPeoplePerFrame': round(avg_people, 1),
            'totalFrames': int(total_frames),
            'maxPeople': max_people,
            'minPeople': min_people,
            'riskLevel': overall_risk,
            'averageFPS': round(avg_fps, 1),
            'processingTimeSeconds': round(elapsed, 1),
            'frameWidth': int(width),
            'frameHeight': int(height),
            'videoSource': str(video_path),
            'timestamp': datetime.utcnow().isoformat() + 'Z',
            'outputVideoPath': output_path if writer else None
        }

        # ====================================================================
        # OUTPUT RESULTS
        # ====================================================================
        if output_json:
            # Print ONLY JSON as last output (Node.js requirement)
            print(json.dumps(results_data), flush=True)
        else:
            log_info(f'Processing complete: {overall_risk} ({max_people} people)')

        return results_data

    except Exception as e:
        log_error(f'Fatal error during processing: {e}')
        sys.exit(1)

    finally:
        cap.release()
        if writer:
            writer.release()

# ============================================================================
# CLI
# ============================================================================
def main():
    parser = argparse.ArgumentParser(
        description='CrowdSafe YOLOv8 Crowd Detection'
    )
    parser.add_argument(
        '--video',
        type=str,
        required=True,
        help='Input video file path'
    )
    parser.add_argument(
        '--output',
        type=str,
        default=None,
        help='Optional output video path (with annotations)'
    )
    parser.add_argument(
        '--device',
        type=str,
        choices=['cuda', 'cpu'],
        default='cuda' if torch.cuda.is_available() else 'cpu',
        help='Device: cuda or cpu (auto-detect by default)'
    )
    parser.add_argument(
        '--skip',
        type=int,
        default=3,
        help='Process every Nth frame (default 3)'
    )
    parser.add_argument(
        '--json',
        action='store_true',
        help='Output results as JSON to stdout'
    )

    args = parser.parse_args()

    try:
        process_video(
            video_path=args.video,
            output_path=args.output,
            device=args.device,
            skip_frames=args.skip,
            output_json=args.json
        )
    except Exception as e:
        log_error(f'Unexpected error: {e}')
        sys.exit(1)

if __name__ == '__main__':
    main()

