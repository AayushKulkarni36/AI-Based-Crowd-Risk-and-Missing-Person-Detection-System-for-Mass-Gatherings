#!/usr/bin/env python3
"""
AI-Based Crowd Risk & Missing Person Detection Pipeline
YOLOv8n + InsightFace buffalo_l + FAISS

Supports:
  - Real-time person detection (YOLOv8n)
  - Face detection & embedding (InsightFace buffalo_l)
  - Face similarity search (FAISS)
  - Crowd density heatmap generation
  - Skip-frame strategy for VRAM optimization

Usage:
  python testSimple.py --video sample.mp4 --output result.avi --json --face-match --device cuda
"""

from __future__ import annotations
import argparse
import json
import logging
import sys
import time
from collections import deque
from pathlib import Path
from typing import Union
import cv2
import numpy as np
from ultralytics import YOLO

try:
    from insightface.app import FaceAnalysis
    INSIGHTFACE_AVAILABLE = True
except ImportError:
    INSIGHTFACE_AVAILABLE = False
    logging.warning("InsightFace not installed. Face matching disabled.")

try:
    import faiss
    FAISS_AVAILABLE = True
except ImportError:
    FAISS_AVAILABLE = False
    logging.warning("FAISS not installed. Face search disabled.")

# Configuration
SKIP_FRAMES_CROWD = 3       # Process every 3rd frame for YOLOv8 (crowd counting)
SKIP_FRAMES_FACE = 6        # Process every 6th frame for InsightFace (face matching)
FACE_MATCH_THRESHOLD = 0.60 # InsightFace buffalo_l recommended threshold
HEATMAP_GRID_SIZE = (15, 20)  # (height, width) for density heatmap
DEVICE = 'cuda:0'         # CUDA device

LOGGER = logging.getLogger(__name__)


class PersonDetector:
    """Wrapper for YOLOv8n person detection with CUDA FP16 support"""

    def __init__(self, model_name: str = 'yolov8n.pt', device: str = 'cuda:0'):
        LOGGER.info(f"Loading YOLOv8n model: {model_name}")
        self.model = YOLO(model_name)
        self.model.to(device)
        self.device = device

    def detect(self, frame: np.ndarray, conf: float = 0.45, half: bool = True) -> tuple[int, list]:
        """
        Detect persons in frame using YOLOv8n with FP16.

        Returns:
          (person_count, detections_list)
          where detections_list = [{"x": int, "y": int, "conf": float}, ...]
        """
        results = self.model.predict(
            frame,
            classes=[0],  # COCO person class
            conf=conf,
            device=self.device,
            half=True,  # FP16 mode for RTX 3050 Ti
            verbose=False
        )

        detections = []
        if results[0].boxes is not None:
            for box in results[0].boxes:
                x_center = int((box.xyxy[0][0] + box.xyxy[0][2]) / 2)
                y_center = int((box.xyxy[0][1] + box.xyxy[0][3]) / 2)
                conf = float(box.conf[0])
                detections.append({
                    "x": x_center,
                    "y": y_center,
                    "conf": conf
                })

        return len(detections), detections


class FaceRecognitionPipeline:
    """InsightFace buffalo_l + FAISS similarity search"""

    def __init__(self, faiss_index_path: str | None = None):
        if not INSIGHTFACE_AVAILABLE:
            LOGGER.warning("InsightFace not available. Face matching disabled.")
            self.app = None
            self.faiss_index = None
            return

        LOGGER.info("Initializing InsightFace buffalo_l model...")
        self.app = FaceAnalysis(
            name='buffalo_l',
            providers=['CUDAExecutionProvider']
        )
        self.app.prepare(ctx_id=0, det_size=(640, 640))

        # FAISS index (will be loaded from DB or initialized empty)
        self.faiss_index = None
        self.person_ids = []  # Parallel array for reverse lookup
        self.embeddings_db = {}  # In-memory cache: person_id -> embedding

        if faiss_index_path and Path(faiss_index_path).exists():
            self._load_faiss_index(faiss_index_path)

    def detect_faces(self, frame: np.ndarray) -> list[dict]:
        """
        Detect faces and extract embeddings.

        Returns:
          [{"embedding": [512-dim float32], "bbox": (x1, y1, x2, y2)}, ...]
        """
        if self.app is None:
            return []

        faces = self.app.get(frame)
        results = []
        for face in faces:
            results.append({
                "embedding": face.embedding.astype(np.float32),
                "bbox": face.bbox.astype(int).tolist()
            })

        return results

    def search_similar_faces(self, embedding: np.ndarray, top_k: int = 3) -> list[dict]:
        """
        Search FAISS index for similar face embeddings.

        Args:
          embedding: 512-dim normalized face embedding
          top_k: number of results to return

        Returns:
          [{"person_id": int, "similarity": float}, ...]
        """
        if self.faiss_index is None or len(self.person_ids) == 0:
            return []

        # Normalize embedding (L2)
        norm = np.linalg.norm(embedding)
        if norm > 0:
            embedding = embedding / norm

        # Search FAISS (IndexFlatIP does inner product = cosine on normalized vectors)
        distances, indices = self.faiss_index.search(
            embedding.reshape(1, -1),
            min(top_k, len(self.person_ids))
        )

        results = []
        for idx, distance in zip(indices[0], distances[0]):
            if idx >= 0:  # -1 indicates no result
                results.append({
                    "person_id": int(self.person_ids[idx]),
                    "similarity": float(distance)  # cosine similarity in [0, 1]
                })

        return results

    def add_embedding_to_index(self, person_id: int, embedding: np.ndarray):
        """Add a face embedding to the FAISS index"""
        if embedding is None:
            return

        # Normalize
        norm = np.linalg.norm(embedding)
        if norm > 0:
            embedding = embedding / norm

        self.embeddings_db[person_id] = embedding
        self._rebuild_faiss_index()

    def _rebuild_faiss_index(self):
        """Rebuild FAISS index from embeddings_db"""
        if not self.embeddings_db:
            self.faiss_index = None
            self.person_ids = []
            return

        person_ids = sorted(self.embeddings_db.keys())
        embeddings = np.array([self.embeddings_db[pid] for pid in person_ids])

        # Create Flat index with inner product (cosine distance on normalized vectors)
        self.faiss_index = faiss.IndexFlatIP(512)
        self.faiss_index.add(embeddings.astype(np.float32))
        self.person_ids = person_ids
        LOGGER.info(f"FAISS index rebuilt with {len(person_ids)} embeddings")

    def _load_faiss_index(self, path: str):
        """Load FAISS index from disk"""
        try:
            self.faiss_index = faiss.read_index(path)
            LOGGER.info(f"Loaded FAISS index from {path}")
        except Exception as e:
            LOGGER.warning(f"Failed to load FAISS index: {e}")


class HeatmapGenerator:
    """Generate crowd density heatmap from detection coordinates"""

    def __init__(self, grid_size: tuple[int, int], frame_size: tuple[int, int]):
        self.grid_h, self.grid_w = grid_size
        self.frame_h, self.frame_w = frame_size
        self.grid = np.zeros((self.grid_h, self.grid_w), dtype=np.float32)

    def add_detections(self, detections: list[dict]):
        """Add person detections to heatmap grid"""
        for det in detections:
            x = det["x"]
            y = det["y"]
            # Map frame coords to grid coords
            grid_x = int((x / self.frame_w) * self.grid_w)
            grid_y = int((y / self.frame_h) * self.grid_h)

            # Clamp
            grid_x = max(0, min(grid_x, self.grid_w - 1))
            grid_y = max(0, min(grid_y, self.grid_h - 1))

            self.grid[grid_y, grid_x] += 1

    def get_normalized_heatmap(self) -> np.ndarray:
        """Return normalized heatmap [0, 1]"""
        max_val = np.max(self.grid)
        if max_val <= 0:
            return self.grid
        return self.grid / max_val

    def apply_gaussian_blur(self, sigma: float = 1.5):
        """Apply Gaussian smoothing for visual heatmap"""
        from scipy.ndimage import gaussian_filter
        self.grid = gaussian_filter(self.grid, sigma=sigma)

    def reset(self):
        """Clear grid for next processing window"""
        self.grid.fill(0)


def calculate_risk_level(max_people: int, capacity: int = 40) -> str:
    """Determine risk level based on occupancy"""
    occupancy = (max_people / capacity) * 100
    if occupancy < 80:
        return 'SAFE'
    elif occupancy < 95:
        return 'MODERATE'
    elif occupancy < 110:
        return 'RISKY'
    else:
        return 'CRITICAL'


def parse_args() -> argparse.Namespace:
    parser = argparse.ArgumentParser(
        description="YOLOv8n + InsightFace crowd and missing person detection"
    )
    parser.add_argument(
        '--video',
        type=str,
        default='0',
        help='Video source path or webcam index (default: 0)'
    )
    parser.add_argument(
        '--output',
        type=str,
        default='',
        help='Output video file path'
    )
    parser.add_argument(
        '--json',
        action='store_true',
        help='Emit JSON summary to stdout'
    )
    parser.add_argument(
        '--face-match',
        action='store_true',
        help='Enable face matching against missing persons DB'
    )
    parser.add_argument(
        '--device',
        type=str,
        default='cuda:0',
        help='CUDA device (default: cuda:0)'
    )
    parser.add_argument(
        '--confidence',
        type=float,
        default=0.45,
        help='YOLO detection confidence threshold'
    )
    parser.add_argument(
        '--display',
        action='store_true',
        help='Display annotated frames in window'
    )
    return parser.parse_args()


def resolve_video_source(source: str) -> Union[int, str]:
    if source.isdigit():
        return int(source)
    path = Path(source)
    if not path.exists():
        raise FileNotFoundError(f"Video file not found: {source}")
    return str(path)


def initialize_video_writer(
    output_path: str,
    width: int,
    height: int,
    fps: float
) -> cv2.VideoWriter | None:
    if not output_path:
        return None
    output_file = Path(output_path)
    output_file.parent.mkdir(parents=True, exist_ok=True)
    fourcc = cv2.VideoWriter_fourcc(
        *('XVID' if output_file.suffix.lower() == '.avi' else 'mp4v')
    )
    writer = cv2.VideoWriter(str(output_file), fourcc, fps or 20.0, (width, height))
    if not writer.isOpened():
        raise RuntimeError(f"Failed to open video writer for {output_path}")
    return writer


def run_detection(args: argparse.Namespace) -> dict:
    """Main detection pipeline"""

    # Initialize models
    crowd_detector = PersonDetector(device=args.device)
    face_pipeline = FaceRecognitionPipeline() if args.face_match else None

    # Open video source
    source = resolve_video_source(args.video)
    LOGGER.info(f"Opening video source: {source}")
    cap = cv2.VideoCapture(source)
    if not cap.isOpened():
        raise RuntimeError(f"Unable to open video source: {args.video}")

    width = int(cap.get(cv2.CAP_PROP_FRAME_WIDTH) or 1280)
    height = int(cap.get(cv2.CAP_PROP_FRAME_HEIGHT) or 720)
    fps = cap.get(cv2.CAP_PROP_FPS) or 20.0

    # Initialize output
    writer = initialize_video_writer(args.output, width, height, fps) if args.output else None

    # Initialize heatmap
    heatmap_gen = HeatmapGenerator(HEATMAP_GRID_SIZE, (height, width))

    # Processing state
    frame_count = 0
    processed_frames = 0
    cumulative_people = 0
    max_people = 0
    fps_history = deque(maxlen=30)
    frame_times = []
    face_matches = []

    try:
        while True:
            frame_start = time.time()
            ret, frame = cap.read()
            if not ret:
                LOGGER.info("End of stream reached.")
                break

            frame_count += 1

            # =====================================================================
            # CROWD DETECTION (every SKIP_FRAMES_CROWD)
            # =====================================================================
            if frame_count % SKIP_FRAMES_CROWD == 0:
                person_count, detections = crowd_detector.detect(
                    frame,
                    conf=args.confidence,
                    half=True
                )
                cumulative_people += person_count
                max_people = max(max_people, person_count)
                processed_frames += 1

                # Add to heatmap
                heatmap_gen.add_detections(detections)
            else:
                person_count = 0
                detections = []

            # =====================================================================
            # FACE MATCHING (every SKIP_FRAMES_FACE, only if enabled)
            # =====================================================================
            if args.face_match and frame_count % SKIP_FRAMES_FACE == 0 and face_pipeline:
                face_results = face_pipeline.detect_faces(frame)
                for face_data in face_results:
                    embedding = face_data["embedding"]
                    matches = face_pipeline.search_similar_faces(embedding, top_k=3)

                    if matches and matches[0]["similarity"] > FACE_MATCH_THRESHOLD:
                        face_matches.append({
                            "frameNumber": frame_count,
                            "personId": matches[0]["person_id"],
                            "confidence": matches[0]["similarity"],
                            "status": "POSSIBLE_MATCH"
                        })

            # =====================================================================
            # VISUALIZATION & TIMING
            # =====================================================================
            annotated_frame = frame.copy()

            # Draw person count
            risk = calculate_risk_level(max_people) if max_people > 0 else 'SAFE'
            risk_color = {
                'SAFE': (0, 255, 0),
                'MODERATE': (0, 255, 255),
                'RISKY': (0, 165, 255),
                'CRITICAL': (0, 0, 255)
            }.get(risk, (128, 128, 128))

            cv2.putText(
                annotated_frame,
                f"Persons: {max_people}",
                (20, 60),
                cv2.FONT_HERSHEY_SIMPLEX,
                1.5,
                risk_color,
                4
            )
            cv2.putText(
                annotated_frame,
                f"Risk: {risk}",
                (20, 120),
                cv2.FONT_HERSHEY_SIMPLEX,
                1.0,
                risk_color,
                3
            )
            cv2.putText(
                annotated_frame,
                f"Frame: {frame_count}",
                (20, 170),
                cv2.FONT_HERSHEY_SIMPLEX,
                0.8,
                (255, 255, 255),
                2
            )

            if writer:
                writer.write(annotated_frame)

            if args.display:
                cv2.imshow('YOLOv8n Detection', annotated_frame)
                if cv2.waitKey(1) & 0xFF == ord('q'):
                    LOGGER.info("User requested exit.")
                    break

            # FPS tracking
            frame_elapsed = time.time() - frame_start
            if frame_elapsed > 0:
                frame_fps = 1.0 / frame_elapsed
                fps_history.append(frame_fps)
                frame_times.append(frame_elapsed)

            # Progress reporting (for Node.js job queue)
            if frame_count % 30 == 0:
                progress = int((frame_count * 100) / (cap.get(cv2.CAP_PROP_FRAME_COUNT)))
                print(f"PROGRESS:{progress}", flush=True)
                LOGGER.info(f"Progress: {progress}%")

    finally:
        cap.release()
        if writer:
            writer.release()
        if args.display:
            cv2.destroyAllWindows()

    # =========================================================================
    # FINAL STATISTICS
    # =========================================================================
    avg_people = (cumulative_people / processed_frames) if processed_frames > 0 else 0
    risk_level = calculate_risk_level(max_people)

    # FPS metrics
    if frame_times:
        overall_avg_fps = len(frame_times) / sum(frame_times)
        overall_min_fps = np.min(frame_times)
        overall_max_fps = np.max(frame_times)
        overall_min_fps = 1.0 / overall_min_fps if overall_min_fps > 0 else 0
        overall_max_fps = 1.0 / overall_max_fps if overall_max_fps > 0 else 0
    else:
        overall_avg_fps = 0.0
        overall_min_fps = 0.0
        overall_max_fps = 0.0

    # FPS rating
    if overall_avg_fps >= 25:
        fps_rating = "Excellent (Professional)"
    elif overall_avg_fps >= 20:
        fps_rating = "Very Good"
    elif overall_avg_fps >= 15:
        fps_rating = "Good"
    elif overall_avg_fps >= 10:
        fps_rating = "Acceptable"
    else:
        fps_rating = "Poor"

    # Heatmap normalization
    heatmap_gen.apply_gaussian_blur(sigma=1.5)
    heatmap_normalized = heatmap_gen.get_normalized_heatmap()
    heatmap_grid = heatmap_normalized.tolist()

    results = {
        'totalPeople': int(max_people),
        'avgPeoplePerFrame': float(round(avg_people, 2)),
        'totalFrames': int(frame_count),
        'processedFrames': int(processed_frames),
        'riskLevel': str(risk_level),
        'averageFPS': float(round(overall_avg_fps, 2)),
        'minFPS': float(round(overall_min_fps, 2)),
        'maxFPS': float(round(overall_max_fps, 2)),
        'fpsRating': str(fps_rating),
        'crowdHeatmapGrid': heatmap_grid,
        'faceMatches': face_matches
    }

    LOGGER.info(f"Detection complete: {results}")
    return results


def main() -> int:
    args = parse_args()

    # Configure logging
    log_level = logging.WARNING if args.json else logging.INFO
    logging.basicConfig(
        level=log_level,
        format='[%(levelname)s] %(message)s'
    )

    try:
        results = run_detection(args)
    except Exception as exc:
        LOGGER.error(f"Detection failed: {exc}", exc_info=True)
        if args.json:
            print(json.dumps({'error': str(exc)}))
        return 1

    if args.json:
        print(json.dumps(results))
    else:
        print("\n" + "=" * 60)
        print("DETECTION SUMMARY")
        print("=" * 60)
        print(f"Frames processed: {results['totalFrames']}")
        print(f"Max people in frame: {results['totalPeople']}")
        print(f"Avg people per frame: {results['avgPeoplePerFrame']:.2f}")
        print(f"Risk level: {results['riskLevel']}")
        print(f"\nPerformance: {results['averageFPS']:.2f} FPS ({results['fpsRating']})")
        if results.get('faceMatches'):
            print(f"\nFace matches found: {len(results['faceMatches'])}")
            for match in results['faceMatches']:
                print(f"  - Person ID {match['personId']}: {match['confidence']:.2%}")
        print("=" * 60 + "\n")

    return 0


if __name__ == '__main__':
    sys.exit(main())
