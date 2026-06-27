#!/usr/bin/env python3
"""
CrowdNexis AI – YOLOv8 Crowd Detection + Tracker-Accelerated Face Matching
===========================================================================

Optimisation strategy (v2 — no spatial face-person association):
  1. Frame sampling   : YOLO runs every --skip raw frames  (unchanged)
  2. Face sampling    : MTCNN+FaceNet runs every --face-skip processed frames
  3. Batch FaceNet    : ALL faces in the sampled frame are stacked into one
                        GPU batch and embedded in a single resnet() call
  4. Best-score cache : best cosine similarity seen for each person_id is kept
                        across the whole video — accuracy never regresses
  5. Alert cooldown   : DB inserts / stdout matches respect --face-cooldown
  6. Tracker (bonus)  : persistent track_id per person for downstream use;
                        does NOT gate which faces are processed (avoids the
                        face-person spatial-association accuracy bug)
"""

import sys
import json
import argparse
import cv2
import numpy as np
import time
import os
from datetime import datetime, timezone
from pathlib import Path
from typing import Any, Dict, List, Optional, Tuple

# ── env setup ──────────────────────────────────────────────────────────────
try:
    from dotenv import load_dotenv
    project_root = Path(__file__).resolve().parents[2]
    load_dotenv(dotenv_path=project_root / '.env',         override=True)
    load_dotenv(dotenv_path=project_root / 'backend' / '.env', override=True)
except Exception:
    pass

try:
    from ultralytics import YOLO
    import torch
except ImportError as e:
    print(json.dumps({"error": f"Missing dependency: {e}"}))
    sys.exit(1)

try:
    from facenet_pytorch import MTCNN, InceptionResnetV1
    from PIL import Image
    import psycopg2
    FACENET_AVAILABLE = True
except Exception:
    FACENET_AVAILABLE = False

FAISS_AVAILABLE = False
try:
    if os.getenv('ENABLE_FAISS', 'false').lower() == 'true':
        import faiss
        FAISS_AVAILABLE = True
except Exception:
    FAISS_AVAILABLE = False

# ── local tracker (for track_id assignment) ────────────────────────────────
try:
    from .tracker import CentroidIOUTracker
except ImportError:
    _here = Path(__file__).resolve().parent
    sys.path.insert(0, str(_here))
    from tracker import CentroidIOUTracker


# ===========================================================================
# Utilities
# ===========================================================================

def _l2_normalize(vec: np.ndarray) -> np.ndarray:
    vec = np.asarray(vec, dtype=np.float32).reshape(-1)
    n   = np.linalg.norm(vec)
    return vec if n == 0 else (vec / n)


def _info(msg: str) -> None:
    print(f"INFO: {msg}", file=sys.stderr, flush=True)


def _warn(msg: str) -> None:
    print(f"WARN: {msg}", file=sys.stderr, flush=True)


# ===========================================================================
# Vector index
# ===========================================================================

class VectorIndex:
    """Inner-product search (cosine on L2-normalised embeddings)."""

    def __init__(self, embeddings: np.ndarray, ids: List[int]):
        self.ids        = ids
        self.embeddings = embeddings.astype(np.float32)
        self.index      = None

        if FAISS_AVAILABLE and len(ids) > 0:
            try:
                self.index = faiss.IndexFlatIP(self.embeddings.shape[1])
                self.index.add(self.embeddings)
            except Exception:
                self.index = None

    def search_best(self, query: np.ndarray) -> Tuple[Optional[int], float]:
        if not self.ids:
            return None, 0.0
        q = _l2_normalize(query).reshape(1, -1).astype(np.float32)
        if self.index is not None:
            D, I = self.index.search(q, 1)
            return self.ids[int(I[0][0])], float(D[0][0])
        sims     = np.dot(self.embeddings, q.reshape(-1))
        best_idx = int(np.argmax(sims))
        return self.ids[best_idx], float(sims[best_idx])


# ===========================================================================
# Database helpers
# ===========================================================================

def _get_db_conn():
    return psycopg2.connect(
        host     = os.getenv("DB_HOST",     "localhost"),
        port     = int(os.getenv("DB_PORT", "5432")),
        dbname   = os.getenv("DB_NAME",     "missing_persons"),
        user     = os.getenv("DB_USER",     "postgres"),
        password = os.getenv("DB_PASSWORD", ""),
    )


def _fetch_active_person_embeddings(db_conn) -> Tuple[List[int], List[str], np.ndarray]:
    with db_conn.cursor() as cur:
        cur.execute("""
            SELECT id, name, face_vector
            FROM missing_persons
            WHERE status != 'INACTIVE' AND face_vector IS NOT NULL
        """)
        rows = cur.fetchall()

    ids: List[int]         = []
    names: List[str]       = []
    embeddings: List[np.ndarray] = []

    for pid, name, face_vector in rows:
        if face_vector is None:
            continue
        try:
            raw = json.loads(face_vector) if isinstance(face_vector, str) \
                  else json.loads(str(face_vector))
            vec = _l2_normalize(np.asarray(raw, dtype=np.float32))
            if vec.size == 0:
                continue
            ids.append(int(pid))
            names.append(str(name))
            embeddings.append(vec)
        except Exception:
            continue

    if not embeddings:
        return [], [], np.array([])
    return ids, names, np.stack(embeddings, axis=0)


# ===========================================================================
# Face detection & BATCH embedding
# ===========================================================================

def _detect_and_batch_embed(
    frame_bgr: np.ndarray,
    mtcnn: Any,
    resnet: Any,
    device: Any,
) -> List[Dict[str, Any]]:
    """
    Detect ALL faces in the frame with MTCNN, then embed ALL of them with a
    single batched resnet() call.

    Returns list of { 'bbox': [x1,y1,x2,y2], 'embedding': np.ndarray(512,) }
    """
    rgb = cv2.cvtColor(frame_bgr, cv2.COLOR_BGR2RGB)
    img = Image.fromarray(rgb)

    # Detect face boxes + aligned tensors in one MTCNN pass
    boxes, _ = mtcnn.detect(img)
    if boxes is None or len(boxes) == 0:
        return []

    face_tensors = mtcnn(img)
    if face_tensors is None:
        return []
    if face_tensors.dim() == 3:
        face_tensors = face_tensors.unsqueeze(0)   # (1, 3, 160, 160)

    n = min(len(boxes), face_tensors.shape[0])
    if n == 0:
        return []

    # ── Single batched FaceNet call ────────────────────────────────────────
    batch = face_tensors[:n].to(device)             # (N, 3, 160, 160)
    with torch.no_grad():
        embs = resnet(batch)                        # (N, 512)
    embs_np = embs.cpu().numpy().astype(np.float32)

    # L2-normalise each row
    norms   = np.linalg.norm(embs_np, axis=1, keepdims=True)
    norms   = np.where(norms == 0, 1.0, norms)
    embs_np = embs_np / norms

    results = []
    for i in range(n):
        x1, y1, x2, y2 = boxes[i]
        results.append({
            'bbox':      [int(x1), int(y1), int(x2), int(y2)],
            'embedding': embs_np[i],
        })
    return results


# ===========================================================================
# Snapshot saver
# ===========================================================================

def _save_face_snapshot(
    frame_bgr: np.ndarray,
    bbox: List[int],
    out_dir: Path,
) -> Optional[str]:
    x1, y1, x2, y2 = bbox
    h, w = frame_bgr.shape[:2]
    pad  = 10
    x1   = max(0, x1 - pad);  y1 = max(0, y1 - pad)
    x2   = min(w, x2 + pad);  y2 = min(h, y2 + pad)
    if x2 <= x1 or y2 <= y1:
        return None
    crop = frame_bgr[y1:y2, x1:x2]
    if crop.size == 0:
        return None
    out_dir.mkdir(parents=True, exist_ok=True)
    fname    = f"det_{int(time.time())}_{x1}_{y1}_{x2}_{y2}.jpg"
    abs_path = out_dir / fname
    if not cv2.imwrite(str(abs_path), crop):
        return None
    return str(Path("results") / "detections" / fname).replace("\\", "/")


# ===========================================================================
# Drawing helpers
# ===========================================================================

def get_risk_color(risk_level):
    return {
        'SAFE':     (0, 200,   0),
        'MODERATE': (0, 200, 255),
        'RISKY':    (0, 100, 255),
        'CRITICAL': (0,   0, 255),
    }.get(risk_level, (255, 255, 255))


def draw_detections(frame, boxes, person_count, risk_level, frame_num):
    overlay = frame.copy()
    h, w    = frame.shape[:2]

    for box in boxes:
        x1, y1, x2, y2 = map(int, box.xyxy[0].tolist())
        conf  = float(box.conf[0])
        color = (0, 255, 0) if conf > 0.7 else (0, 200, 255) if conf > 0.5 else (0, 100, 255)
        cv2.rectangle(overlay, (x1, y1), (x2, y2), color, 2)
        label = f"{conf:.0%}"
        (lw, lh), _ = cv2.getTextSize(label, cv2.FONT_HERSHEY_SIMPLEX, 0.4, 1)
        cv2.rectangle(overlay, (x1, y1 - lh - 6), (x1 + lw + 4, y1), color, -1)
        cv2.putText(overlay, label, (x1 + 2, y1 - 4),
                    cv2.FONT_HERSHEY_SIMPLEX, 0.4, (0, 0, 0), 1, cv2.LINE_AA)

    risk_color = get_risk_color(risk_level)
    badge_text = f"People: {person_count}"
    (tw, th), _ = cv2.getTextSize(badge_text, cv2.FONT_HERSHEY_SIMPLEX, 0.9, 2)
    pad = 12
    cv2.rectangle(overlay, (10, 10), (10 + tw + pad*2, 10 + th + pad*2), (0, 0, 0), -1)
    cv2.rectangle(overlay, (10, 10), (10 + tw + pad*2, 10 + th + pad*2), risk_color, 2)
    cv2.putText(overlay, badge_text, (10 + pad, 10 + th + pad),
                cv2.FONT_HERSHEY_SIMPLEX, 0.9, (255, 255, 255), 2, cv2.LINE_AA)

    risk_text = f"Risk: {risk_level}"
    (rw, rh), _ = cv2.getTextSize(risk_text, cv2.FONT_HERSHEY_SIMPLEX, 0.7, 2)
    rx = w - rw - pad*2 - 10
    cv2.rectangle(overlay, (rx, 10), (w - 10, 10 + rh + pad*2), risk_color, -1)
    cv2.putText(overlay, risk_text, (rx + pad, 10 + rh + pad),
                cv2.FONT_HERSHEY_SIMPLEX, 0.7, (255, 255, 255), 2, cv2.LINE_AA)

    info_text = f"Frame: {frame_num}  |  CrowdNexis AI Detection"
    cv2.rectangle(overlay, (0, h - 35), (w, h), (0, 0, 0), -1)
    cv2.putText(overlay, info_text, (10, h - 10),
                cv2.FONT_HERSHEY_SIMPLEX, 0.5, (180, 180, 180), 1, cv2.LINE_AA)

    return cv2.addWeighted(overlay, 0.85, frame, 0.15, 0)


# ===========================================================================
# Risk classifier
# ===========================================================================

def classify_risk(max_people: int) -> str:
    if max_people < 10:  return 'SAFE'
    if max_people < 25:  return 'MODERATE'
    if max_people < 50:  return 'RISKY'
    return 'CRITICAL'


# ===========================================================================
# Main
# ===========================================================================

def main():
    parser = argparse.ArgumentParser(
        description='Crowd detection via YOLOv8 + batch-optimised face matching'
    )
    parser.add_argument('--video',          required=True)
    parser.add_argument('--json',           action='store_true')
    parser.add_argument('--skip',           type=int,   default=3,
                        help='Run YOLO every N raw frames (frame sampling)')
    parser.add_argument('--face-skip',      type=int,
                        default=int(os.getenv('SKIP_FRAMES_FACE', '8')),
                        help='Run MTCNN+FaceNet every N processed frames')
    parser.add_argument('--output-dir',     type=str,   default=None)
    parser.add_argument('--face-threshold', type=float,
                        default=float(os.getenv('MISSING_PERSON_THRESHOLD', '0.60')),
                        help='Pre-filter: ignore faces below this cosine similarity')
    parser.add_argument('--match-threshold', type=float,
                        default=float(os.getenv('MATCH_THRESHOLD', '0.65')),
                        help='Confirmation gate: only report/save a match at or above this similarity')
    parser.add_argument('--face-cooldown',  type=int,
                        default=int(os.getenv('MISSING_PERSON_COOLDOWN_SECONDS', '30')))
    parser.add_argument('--enable-missing-person', action='store_true',
                        default=os.getenv('ENABLE_MISSING_PERSON', 'true').lower() == 'true')
    parser.add_argument('--camera-location', type=str,
                        default=os.getenv('CAMERA_LOCATION', 'Main Gate'))
    args = parser.parse_args()

    FACE_EVERY      = max(1, args.face_skip)    # run face matching every N processed frames
    MATCH_THRESHOLD = args.match_threshold       # confirmed match gate (default 0.80)

    video_path = Path(args.video)
    if not video_path.exists():
        print(json.dumps({"error": f"File not found: {args.video}"}))
        sys.exit(1)

    if args.output_dir:
        output_dir = Path(args.output_dir)
    else:
        output_dir = Path(__file__).resolve().parent.parent.parent / 'data' / 'results'
    output_dir.mkdir(parents=True, exist_ok=True)

    try:
        device = 'cuda' if torch.cuda.is_available() else 'cpu'
        _info(f"Loading YOLOv8n on {device}")
        model = YOLO('yolov8n.pt')

        cap = cv2.VideoCapture(str(video_path))
        if not cap.isOpened():
            print(json.dumps({"error": f"Cannot open video: {args.video}"}))
            sys.exit(1)

        total_frames = int(cap.get(cv2.CAP_PROP_FRAME_COUNT))
        fps          = cap.get(cv2.CAP_PROP_FPS) or 25.0
        width        = int(cap.get(cv2.CAP_PROP_FRAME_WIDTH))
        height       = int(cap.get(cv2.CAP_PROP_FRAME_HEIGHT))
        _info(f"Video: {total_frames} frames @ {fps:.1f} fps ({width}x{height})")
        _info(f"YOLO frame-skip: {args.skip}  |  FaceNet frame-skip: {FACE_EVERY}")

        # ── Output video writer ───────────────────────────────────────────
        timestamp_str   = datetime.now().strftime('%Y%m%d_%H%M%S')
        output_filename = f"annotated_{timestamp_str}.mp4"
        output_path     = output_dir / output_filename
        out_fps         = max(1.0, fps / args.skip)

        writer = None
        for codec_str in ('avc1', 'H264', 'mp4v'):
            try:
                fourcc = cv2.VideoWriter_fourcc(*codec_str)
                w = cv2.VideoWriter(str(output_path), fourcc, out_fps, (width, height))
                if w.isOpened():
                    writer = w
                    _info(f"Output codec: {codec_str}")
                    break
                w.release()
            except Exception:
                continue
        if writer is None:
            fourcc = cv2.VideoWriter_fourcc(*'mp4v')
            writer = cv2.VideoWriter(str(output_path), fourcc, out_fps, (width, height))

        # ── Missing-person setup ──────────────────────────────────────────
        face_matches_output: List[Dict[str, Any]]  = []
        # best cosine similarity seen per person_id (any score >= face_threshold)
        best_per_person:     Dict[int, Dict]        = {}
        # last wall-clock time a DB alert was written for each person_id
        person_last_alert_ts: Dict[int, float]      = {}
        # person_ids confirmed at >= MATCH_THRESHOLD — skip re-evaluation after found
        confirmed_person_ids: set                   = set()

        detections_dir = output_dir / 'detections'

        missing_person_enabled = bool(args.enable_missing_person) and FACENET_AVAILABLE
        missing_person_db_conn = None
        vector_index: Optional[VectorIndex] = None
        person_id_to_name: Dict[int, str]   = {}
        mtcnn  = None
        resnet = None

        if missing_person_enabled:
            try:
                missing_person_db_conn = _get_db_conn()
                enrolled_ids, enrolled_names, emb_mat = \
                    _fetch_active_person_embeddings(missing_person_db_conn)

                if enrolled_ids:
                    person_id_to_name = dict(zip(enrolled_ids, enrolled_names))
                    vector_index      = VectorIndex(emb_mat, enrolled_ids)
                    mtcnn  = MTCNN(image_size=160, margin=20, min_face_size=20,
                                   thresholds=[0.6, 0.7, 0.7], keep_all=True, device=device)
                    resnet = InceptionResnetV1(pretrained='vggface2').eval().to(device)
                    _info(f"Missing-person matcher: {len(enrolled_ids)} enrolled  |  "
                          f"face-skip={FACE_EVERY}  |  "
                          f"face-threshold={args.face_threshold}  |  "
                          f"match-threshold={MATCH_THRESHOLD}")
                else:
                    _info("Missing-person matcher disabled (no enrolled embeddings)")
                    missing_person_enabled = False
            except Exception as e:
                _warn(f"Missing-person init failed: {e}")
                missing_person_enabled = False
                if missing_person_db_conn:
                    try: missing_person_db_conn.close()
                    except Exception: pass

        # ── Tracker (track_id per person, does NOT gate face detection) ───
        tracker = CentroidIOUTracker(iou_threshold=0.30, max_age=30)

        # ── Stats ─────────────────────────────────────────────────────────
        counts:       List[int] = []
        frame_num:    int       = 0
        processed:    int       = 0      # frames actually through YOLO
        last_progress: int      = -1
        start_time:   float     = time.time()
        facenet_frames: int     = 0      # frames where FaceNet actually ran
        facenet_skipped_frames: int = 0

        # ── Main loop ─────────────────────────────────────────────────────
        while True:
            ret, frame = cap.read()
            if not ret:
                break

            frame_num += 1

            # ── Frame sampling ─────────────────────────────────────────
            if frame_num % args.skip != 0:
                continue

            processed += 1

            # ── YOLO person detection ──────────────────────────────────
            results      = model.predict(frame, classes=[0], conf=0.45,
                                         verbose=False, device=device)
            yolo_boxes   = results[0].boxes
            person_count = len(yolo_boxes)
            counts.append(person_count)
            running_max  = max(counts)
            running_risk = classify_risk(running_max)

            # ── Tracker update (track_ids for context) ─────────────────
            det_bboxes = [box.xyxy[0].cpu().numpy() for box in yolo_boxes]
            tracker.update(det_bboxes, frame_num)

            # ── Draw + write annotated frame ───────────────────────────
            annotated = draw_detections(frame, yolo_boxes, person_count,
                                        running_risk, frame_num)
            writer.write(annotated)

            # ── Face matching (batch, every FACE_EVERY processed frames) ─
            should_run_face = (processed % FACE_EVERY == 0)

            if (should_run_face
                    and missing_person_enabled
                    and vector_index is not None
                    and mtcnn is not None
                    and resnet is not None):

                facenet_frames += 1
                try:
                    # One MTCNN pass + one batched FaceNet call for ALL faces
                    face_results = _detect_and_batch_embed(frame, mtcnn, resnet, device)

                    matched_this_frame: set = set()

                    for face in face_results:
                        emb       = face['embedding']
                        face_bbox = face['bbox']

                        person_id, similarity = vector_index.search_best(emb)
                        if person_id is None:
                            continue

                        # ── Pre-filter: ignore noise below face_threshold ──────
                        if similarity < args.face_threshold:
                            continue

                        # ── Dedup: skip persons already confirmed this video ───
                        if person_id in confirmed_person_ids:
                            continue

                        # ── Only take best face per person per frame ──────────
                        if person_id in matched_this_frame:
                            if similarity <= best_per_person.get(person_id, {}).get('confidence', 0):
                                continue

                        # Always track the best similarity seen (>= face_threshold)
                        # so we have context even if it never reaches match_threshold
                        prev_best = best_per_person.get(person_id, {}).get('confidence', 0.0)
                        if similarity > prev_best:
                            best_per_person[person_id] = {
                                'name':         person_id_to_name.get(person_id, f'Person {person_id}'),
                                'confidence':   round(float(similarity), 4),
                                'frame_number': frame_num,
                                'bbox':         face_bbox,
                            }

                        matched_this_frame.add(person_id)

                        # ── Confirmation gate: MATCH_THRESHOLD ────────────────
                        # Only proceed with snapshot / DB / output if similarity
                        # meets the stricter confirmation threshold.
                        if similarity < MATCH_THRESHOLD:
                            continue

                        person_name = person_id_to_name.get(person_id, f'Person {person_id}')
                        best_conf   = round(float(similarity), 4)

                        # Save face crop snapshot
                        snapshot_rel = _save_face_snapshot(frame, face_bbox, detections_dir)

                        # Update best record with snapshot path
                        best_per_person[person_id]['image_path'] = snapshot_rel
                        best_per_person[person_id]['confidence'] = best_conf

                        # ── Mark person as confirmed (dedup for future frames) ─
                        confirmed_person_ids.add(person_id)

                        # Cooldown check for DB writes
                        now_ts  = time.time()
                        last_ts = person_last_alert_ts.get(person_id)
                        if not (last_ts and (now_ts - last_ts) < args.face_cooldown):
                            # DB insert (best-effort)
                            try:
                                with missing_person_db_conn.cursor() as cur:
                                    cur.execute("""
                                        INSERT INTO detections
                                            (person_id, frame_id, similarity, image_path)
                                        VALUES (%s, %s, %s, %s)
                                    """, [person_id, frame_num, float(best_conf), snapshot_rel])

                                    message = f"{person_name}: {best_conf*100:.1f}% confirmed match"
                                    cur.execute("""
                                        INSERT INTO alert_logs
                                            (video_job_id, alert_type, risk_level,
                                             person_count, message, location, image_path)
                                        VALUES (%s, %s, %s, %s, %s, %s, %s)
                                    """, [None, 'MISSING_PERSON_DETECTED', running_risk,
                                          1, message, args.camera_location, snapshot_rel])
                                    missing_person_db_conn.commit()
                            except Exception as db_err:
                                _warn(f"DB insert failed for person {person_id}: {db_err}")

                            person_last_alert_ts[person_id] = now_ts

                        # ── Output list: one entry per person, best confidence ─
                        existing = next(
                            (x for x in face_matches_output if x['personId'] == person_id),
                            None,
                        )
                        entry = {
                            'personId':    person_id,
                            'name':        person_name,
                            'confidence':  best_conf,
                            'similarity':  best_conf,
                            'frameNumber': frame_num,
                            'imagePath':   snapshot_rel,
                            'timestamp':   datetime.now(timezone.utc).isoformat(),
                        }
                        if existing is None:
                            face_matches_output.append(entry)
                        elif best_conf > existing['confidence']:
                            face_matches_output[face_matches_output.index(existing)] = entry

                except Exception as mp_err:
                    _warn(f"Face matching failed at frame {frame_num}: {mp_err}")

            else:
                if missing_person_enabled:
                    facenet_skipped_frames += 1

            # ── Progress ───────────────────────────────────────────────
            progress = int((frame_num / total_frames) * 100) if total_frames > 0 else 0
            if progress != last_progress:
                print(f'PROGRESS:{progress}', flush=True)
                last_progress = progress

        # ── Cleanup ───────────────────────────────────────────────────────
        cap.release()
        writer.release()

        total_face_frames = facenet_frames + facenet_skipped_frames
        if total_face_frames > 0:
            pct_saved = int(100 * facenet_skipped_frames / total_face_frames)
            _info(f"[FACE] FaceNet ran on {facenet_frames} frames, "
                  f"skipped {facenet_skipped_frames} ({pct_saved}% reduction)")

        # ── FFmpeg H.264 conversion ───────────────────────────────────────
        try:
            import subprocess
            _info("FFmpeg H.264 conversion for browser streaming...")
            browser_out = str(output_path).replace('.mp4', '_browser.mp4')
            subprocess.run([
                'ffmpeg', '-y', '-i', str(output_path),
                '-c:v', 'libx264', '-preset', 'fast', '-crf', '23',
                '-c:a', 'aac', '-b:a', '128k',
                '-movflags', '+faststart', browser_out,
            ], check=True, stdout=subprocess.DEVNULL, stderr=subprocess.DEVNULL)
            os.remove(str(output_path))
            os.rename(browser_out, str(output_path))
            _info("FFmpeg conversion done")
        except Exception as e:
            _warn(f"FFmpeg conversion failed: {e}")

        if not counts:
            counts = [0]
        elapsed    = time.time() - start_time
        max_people = int(max(counts))
        avg_people = round(sum(counts) / len(counts), 1)
        risk_level = classify_risk(max_people)

        output = {
            "totalPeople":           max_people,
            "avgPeoplePerFrame":     avg_people,
            "totalFrames":           len(counts),
            "maxPeople":             max_people,
            "minPeople":             int(min(counts)) if counts else 0,
            "riskLevel":             risk_level,
            "averageFPS":            round(len(counts) / elapsed, 1) if elapsed > 0 else 0,
            "processingTimeSeconds": round(elapsed, 1),
            "frameWidth":            width,
            "frameHeight":           height,
            "videoSource":           str(video_path),
            "outputVideoPath":       f"results/{output_filename}",
            "faceMatches":           face_matches_output,
            "optimisationStats": {
                "yoloFrameSkip":       args.skip,
                "faceFrameSkip":       FACE_EVERY,
                "facenetFramesRan":    facenet_frames,
                "facenetFramesSkipped": facenet_skipped_frames,
            },
            "timestamp": datetime.now(timezone.utc).isoformat(),
        }

        print(json.dumps(output), flush=True)
        sys.exit(0)

    except Exception as e:
        print(json.dumps({"error": str(e)}))
        sys.exit(1)


if __name__ == '__main__':
    main()
