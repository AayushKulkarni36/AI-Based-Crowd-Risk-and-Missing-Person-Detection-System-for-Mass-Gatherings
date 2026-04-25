#!/usr/bin/env python3
"""
CrowdNexis AI YOLOv8 Crowd Detection
Pipeline: video → detect → annotate → output video + JSON
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

# Ensure DB configuration is loaded even when this script is invoked directly
try:
    from dotenv import load_dotenv
    project_root = Path(__file__).resolve().parents[2]
    load_dotenv(dotenv_path=project_root / '.env', override=True)
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
        import faiss  # optional accelerator
        FAISS_AVAILABLE = True
except Exception:
    FAISS_AVAILABLE = False


def _l2_normalize(vec: np.ndarray) -> np.ndarray:
    vec = np.asarray(vec, dtype=np.float32).reshape(-1)
    n = np.linalg.norm(vec)
    return vec if n == 0 else (vec / n)


class VectorIndex:
    """Vector search interface (FAISS if available, otherwise numpy)."""

    def __init__(self, embeddings: np.ndarray, ids: List[int]):
        self.ids = ids
        self.embeddings = embeddings.astype(np.float32)
        self.index = None

        # embeddings are expected to be L2-normalized → inner product == cosine similarity
        if FAISS_AVAILABLE and len(ids) > 0:
            try:
                self.index = faiss.IndexFlatIP(self.embeddings.shape[1])
                self.index.add(self.embeddings)
            except Exception:
                self.index = None

    def search_best(self, query_embedding: np.ndarray) -> Tuple[Optional[int], float]:
        if len(self.ids) == 0:
            return None, 0.0

        q = _l2_normalize(query_embedding).reshape(1, -1).astype(np.float32)
        if self.index is not None:
            D, I = self.index.search(q, 1)
            best_idx = int(I[0][0])
            return self.ids[best_idx], float(D[0][0])

        # numpy fallback
        sims = np.dot(self.embeddings, q.reshape(-1))
        best_idx = int(np.argmax(sims))
        return self.ids[best_idx], float(sims[best_idx])


def _get_db_conn():
    db_host = os.getenv("DB_HOST", "localhost")
    db_port = int(os.getenv("DB_PORT", "5432"))
    db_name = os.getenv("DB_NAME", "missing_persons")
    db_user = os.getenv("DB_USER", "postgres")
    db_password = os.getenv("DB_PASSWORD", "")

    return psycopg2.connect(
        host=db_host,
        port=db_port,
        dbname=db_name,
        user=db_user,
        password=db_password,
    )


def _fetch_active_person_embeddings(db_conn) -> Tuple[List[int], List[str], np.ndarray]:
    with db_conn.cursor() as cur:
        cur.execute(
            """
            SELECT id, name, face_vector
            FROM missing_persons
            WHERE status != 'INACTIVE' AND face_vector IS NOT NULL
            """
        )
        rows = cur.fetchall()

    ids: List[int] = []
    names: List[str] = []
    embeddings: List[np.ndarray] = []
    for pid, name, face_vector in rows:
        if face_vector is None:
            continue
        # face_vector is stored as a JSON list string in TEXT
        try:
            if isinstance(face_vector, str):
                vec_list = json.loads(face_vector)
            else:
                vec_list = json.loads(str(face_vector))

            vec = _l2_normalize(np.asarray(vec_list, dtype=np.float32))
            if vec.size == 0:
                continue
            ids.append(int(pid))
            names.append(str(name))
            embeddings.append(vec)
        except Exception:
            # Bad rows shouldn't break the whole pipeline
            continue

    if len(embeddings) == 0:
        return [], [], np.array([])

    emb_mat = np.stack(embeddings, axis=0)
    return ids, names, emb_mat


def _detect_faces_and_embeddings(
    frame_bgr: np.ndarray,
    mtcnn: Any,
    resnet: Any,
    device: Any,
    conf_min_faces: int = 0,
) -> List[Dict[str, Any]]:
    """
    Returns: [{'bbox': [x1,y1,x2,y2], 'embedding': np.ndarray(512,)}]
    """
    # Convert to RGB PIL for facenet_pytorch
    rgb = cv2.cvtColor(frame_bgr, cv2.COLOR_BGR2RGB)
    img = Image.fromarray(rgb)

    boxes, _ = mtcnn.detect(img)
    if boxes is None or len(boxes) == 0:
        return []

    # aligned faces tensor
    face_tensors = mtcnn(img)
    if face_tensors is None:
        return []
    if face_tensors.dim() == 3:
        face_tensors = face_tensors.unsqueeze(0)

    n = min(len(boxes), face_tensors.shape[0])
    if n <= conf_min_faces:
        n = min(n, face_tensors.shape[0])

    out: List[Dict[str, Any]] = []
    with torch.no_grad():
        for i in range(n):
            x1, y1, x2, y2 = boxes[i]
            x1i, y1i, x2i, y2i = map(int, [x1, y1, x2, y2])
            face = face_tensors[i].to(device)
            emb = resnet(face.unsqueeze(0))
            emb_np = emb.squeeze(0).cpu().numpy().astype(np.float32)
            emb_np = _l2_normalize(emb_np)
            out.append({"bbox": [x1i, y1i, x2i, y2i], "embedding": emb_np})

    return out


def _save_face_snapshot(frame_bgr: np.ndarray, bbox: List[int], out_dir: Path) -> Optional[str]:
    x1, y1, x2, y2 = bbox
    h, w = frame_bgr.shape[:2]

    # Pad slightly for better thumbnails
    pad = 10
    x1 = max(0, x1 - pad)
    y1 = max(0, y1 - pad)
    x2 = min(w, x2 + pad)
    y2 = min(h, y2 + pad)

    if x2 <= x1 or y2 <= y1:
        return None

    crop = frame_bgr[y1:y2, x1:x2]
    if crop.size == 0:
        return None

    out_dir.mkdir(parents=True, exist_ok=True)
    filename = f"det_{int(time.time())}_{x1}_{y1}_{x2}_{y2}.jpg"
    abs_path = out_dir / filename
    ok = cv2.imwrite(str(abs_path), crop)
    if not ok:
        return None

    # served via Express /results static mapping → data/results/
    return str(Path("results") / "detections" / filename).replace("\\", "/")


# ── Drawing helpers ──────────────────────────────────────────────────────────

def get_risk_color(risk_level):
    """Return BGR color for risk level."""
    colors = {
        'SAFE':     (0, 200, 0),      # green
        'MODERATE': (0, 200, 255),     # amber
        'RISKY':    (0, 100, 255),     # orange
        'CRITICAL': (0, 0, 255),       # red
    }
    return colors.get(risk_level, (255, 255, 255))


def draw_detections(frame, boxes, person_count, risk_level, frame_num):
    """Draw bounding boxes, count overlay, and risk badge on a frame."""
    overlay = frame.copy()
    h, w = frame.shape[:2]

    # ── Draw bounding boxes ──────────────────────────────────────────────
    for box in boxes:
        x1, y1, x2, y2 = map(int, box.xyxy[0].tolist())
        conf = float(box.conf[0])

        # Box color based on confidence
        if conf > 0.7:
            box_color = (0, 255, 0)     # green — high confidence
        elif conf > 0.5:
            box_color = (0, 200, 255)   # amber — medium
        else:
            box_color = (0, 100, 255)   # orange — low

        # Draw filled-corner rectangle style
        cv2.rectangle(overlay, (x1, y1), (x2, y2), box_color, 2)

        # Small confidence label
        label = f"{conf:.0%}"
        (lw, lh), _ = cv2.getTextSize(label, cv2.FONT_HERSHEY_SIMPLEX, 0.4, 1)
        cv2.rectangle(overlay, (x1, y1 - lh - 6), (x1 + lw + 4, y1), box_color, -1)
        cv2.putText(overlay, label, (x1 + 2, y1 - 4),
                    cv2.FONT_HERSHEY_SIMPLEX, 0.4, (0, 0, 0), 1, cv2.LINE_AA)

    # ── Top-left: person count badge ─────────────────────────────────────
    risk_color = get_risk_color(risk_level)
    badge_text = f"People: {person_count}"
    (tw, th), _ = cv2.getTextSize(badge_text, cv2.FONT_HERSHEY_SIMPLEX, 0.9, 2)
    pad = 12
    cv2.rectangle(overlay, (10, 10), (10 + tw + pad * 2, 10 + th + pad * 2), (0, 0, 0), -1)
    cv2.rectangle(overlay, (10, 10), (10 + tw + pad * 2, 10 + th + pad * 2), risk_color, 2)
    cv2.putText(overlay, badge_text, (10 + pad, 10 + th + pad),
                cv2.FONT_HERSHEY_SIMPLEX, 0.9, (255, 255, 255), 2, cv2.LINE_AA)

    # ── Top-right: risk level badge ──────────────────────────────────────
    risk_text = f"Risk: {risk_level}"
    (rw, rh), _ = cv2.getTextSize(risk_text, cv2.FONT_HERSHEY_SIMPLEX, 0.7, 2)
    rx = w - rw - pad * 2 - 10
    cv2.rectangle(overlay, (rx, 10), (w - 10, 10 + rh + pad * 2), risk_color, -1)
    cv2.putText(overlay, risk_text, (rx + pad, 10 + rh + pad),
                cv2.FONT_HERSHEY_SIMPLEX, 0.7, (255, 255, 255), 2, cv2.LINE_AA)

    # ── Bottom bar: frame info ───────────────────────────────────────────
    info_text = f"Frame: {frame_num}  |  CrowdNexis AI Detection"
    cv2.rectangle(overlay, (0, h - 35), (w, h), (0, 0, 0), -1)
    cv2.putText(overlay, info_text, (10, h - 10),
                cv2.FONT_HERSHEY_SIMPLEX, 0.5, (180, 180, 180), 1, cv2.LINE_AA)

    # Blend overlay for slight transparency effect on boxes
    result = cv2.addWeighted(overlay, 0.85, frame, 0.15, 0)
    return result


def classify_risk(max_people):
    """Classify risk level based on max person count."""
    if max_people < 10:
        return 'SAFE'
    elif max_people < 25:
        return 'MODERATE'
    elif max_people < 50:
        return 'RISKY'
    else:
        return 'CRITICAL'


def main():
    parser = argparse.ArgumentParser(description='Crowd detection via YOLOv8')
    parser.add_argument('--video', required=True, help='Video file path')
    parser.add_argument('--json', action='store_true', help='Output JSON')
    parser.add_argument('--skip', type=int, default=3, help='Frame skip interval')
    parser.add_argument('--face-skip', type=int, default=int(os.getenv('SKIP_FRAMES_FACE', '8')),
                        help='Run face matching every N processed frames')
    parser.add_argument('--output-dir', type=str, default=None,
                        help='Directory for output video (default: data/results)')
    parser.add_argument('--face-threshold', type=float, default=float(os.getenv('MISSING_PERSON_THRESHOLD', '0.60')))
    parser.add_argument('--face-cooldown', type=int, default=int(os.getenv('MISSING_PERSON_COOLDOWN_SECONDS', '30')))
    parser.add_argument('--enable-missing-person', action='store_true', default=os.getenv('ENABLE_MISSING_PERSON', 'true').lower() == 'true')
    parser.add_argument('--camera-location', type=str, default=os.getenv('CAMERA_LOCATION', 'Main Gate'))
    args = parser.parse_args()

    # Validate file
    video_path = Path(args.video)
    if not video_path.exists():
        print(json.dumps({"error": f"File not found: {args.video}"}))
        sys.exit(1)

    # Determine output directory
    if args.output_dir:
        output_dir = Path(args.output_dir)
    else:
        # Default: project_root/data/results
        script_dir = Path(__file__).resolve().parent
        output_dir = script_dir.parent.parent / 'data' / 'results'
    output_dir.mkdir(parents=True, exist_ok=True)

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

        # ── Setup output video writer ────────────────────────────────────
        timestamp_str = datetime.now().strftime('%Y%m%d_%H%M%S')
        output_filename = f"annotated_{timestamp_str}.mp4"
        output_path = output_dir / output_filename
        out_fps = max(1.0, fps / args.skip)  # adjusted for skipped frames, min 1 fps

        # Try codec chain: avc1 (H.264, browser-compatible) → H264 → mp4v
        writer = None
        for codec_str in ('avc1', 'H264', 'mp4v'):
            try:
                fourcc = cv2.VideoWriter_fourcc(*codec_str)
                w = cv2.VideoWriter(str(output_path), fourcc, out_fps, (width, height))
                if w.isOpened():
                    writer = w
                    print(f'INFO: Using codec {codec_str} for output video', file=sys.stderr, flush=True)
                    break
                w.release()
            except Exception:
                continue

        if writer is None:
            print('WARN: All codecs failed; video output may be broken', file=sys.stderr, flush=True)
            fourcc = cv2.VideoWriter_fourcc(*'mp4v')
            writer = cv2.VideoWriter(str(output_path), fourcc, out_fps, (width, height))

        # ── Missing-person identification (optional) ─────────────────────────
        face_matches_output: List[Dict[str, Any]] = []
        person_last_alert_ts: Dict[int, float] = {}
        detections_dir = output_dir / 'detections'

        missing_person_enabled = bool(args.enable_missing_person) and FACENET_AVAILABLE
        missing_person_db_conn = None
        vector_index: Optional[VectorIndex] = None
        person_id_to_name: Dict[int, str] = {}
        mtcnn = None
        resnet = None

        if missing_person_enabled:
            try:
                missing_person_db_conn = _get_db_conn()
                enrolled_ids, enrolled_names, emb_mat = _fetch_active_person_embeddings(missing_person_db_conn)

                if len(enrolled_ids) > 0:
                    person_id_to_name = {pid: name for pid, name in zip(enrolled_ids, enrolled_names)}
                    vector_index = VectorIndex(emb_mat, enrolled_ids)

                    mtcnn = MTCNN(
                        image_size=160,
                        margin=20,
                        min_face_size=20,
                        thresholds=[0.6, 0.7, 0.7],
                        keep_all=True,
                        device=device,
                    )
                    resnet = InceptionResnetV1(pretrained='vggface2').eval().to(device)
                    print(f'INFO: Missing-person matcher enabled: {len(enrolled_ids)} enrolled', file=sys.stderr, flush=True)
                else:
                    print('INFO: Missing-person matcher disabled (no enrolled embeddings found)', file=sys.stderr, flush=True)
                    missing_person_enabled = False
            except Exception as e:
                print(f'WARN: Missing-person init failed: {e}', file=sys.stderr, flush=True)
                missing_person_enabled = False
                if missing_person_db_conn:
                    try:
                        missing_person_db_conn.close()
                    except Exception:
                        pass

        # Process frames
        counts = []
        frame_num = 0
        start_time = time.time()
        last_progress = -1

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

            # Determine running risk level for display
            running_max = max(counts)
            running_risk = classify_risk(running_max)

            # Draw annotations on frame and write to output video
            annotated_frame = draw_detections(
                frame, results[0].boxes, person_count, running_risk, frame_num
            )
            writer.write(annotated_frame)

            # Missing-person identification (run less frequently for performance)
            should_run_face = (frame_num % max(1, args.face_skip) == 0)
            if should_run_face and missing_person_enabled and vector_index is not None and mtcnn is not None and resnet is not None and missing_person_db_conn is not None:
                try:
                    detected_faces = _detect_faces_and_embeddings(frame, mtcnn, resnet, device)
                    matched_this_frame: set[int] = set()

                    for face in detected_faces:
                        emb = face['embedding']
                        if emb is None:
                            continue

                        person_id, similarity = vector_index.search_best(emb)
                        if person_id is None:
                            continue
                        if similarity < args.face_threshold:
                            continue
                        if person_id in matched_this_frame:
                            continue

                        now_ts = time.time()
                        last_ts = person_last_alert_ts.get(person_id)
                        if last_ts is not None and (now_ts - last_ts) < args.face_cooldown:
                            continue

                        face_bbox = face.get('bbox')
                        snapshot_rel = _save_face_snapshot(frame, face_bbox, detections_dir) if face_bbox else None

                        # Best-effort DB inserts (don't fail crowd processing)
                        try:
                            with missing_person_db_conn.cursor() as cur:
                                cur.execute(
                                    """
                                    INSERT INTO detections (person_id, frame_id, similarity, image_path)
                                    VALUES (%s, %s, %s, %s)
                                    """,
                                    [person_id, frame_num, float(similarity), snapshot_rel]
                                )

                                person_name = person_id_to_name.get(person_id, f'Person {person_id}')
                                message = f'{person_name}: {similarity * 100:.1f}% similarity match'
                                cur.execute(
                                    """
                                    INSERT INTO alert_logs (video_job_id, alert_type, risk_level, person_count, message, location, image_path)
                                    VALUES (%s, %s, %s, %s, %s, %s, %s)
                                    """,
                                    [None, 'MISSING_PERSON_DETECTED', running_risk, 1, message, args.camera_location, snapshot_rel]
                                )

                                missing_person_db_conn.commit()
                        except Exception as db_ins_err:
                            print(f'WARN: DB insert failed for person {person_id}: {db_ins_err}', file=sys.stderr, flush=True)

                        person_last_alert_ts[person_id] = now_ts
                        matched_this_frame.add(person_id)

                        face_matches_output.append({
                            "personId": person_id,
                            "name": person_id_to_name.get(person_id, f'Person {person_id}'),
                            "confidence": round(float(similarity), 4),
                            "similarity": round(float(similarity), 4),
                            "frameNumber": frame_num,
                            "imagePath": snapshot_rel,
                            "timestamp": datetime.now(timezone.utc).isoformat()
                        })
                except Exception as mp_err:
                    print(f'WARN: Missing-person matching failed at frame {frame_num}: {mp_err}', file=sys.stderr, flush=True)

            # Emit progress (avoid flooding stdout)
            progress = int((frame_num / total_frames) * 100) if total_frames > 0 else 0
            if progress != last_progress:
                print(f'PROGRESS:{progress}', flush=True)
                last_progress = progress

        cap.release()
        writer.release()

        # Ensure we have data
        if not counts:
            counts = [0]

        elapsed = time.time() - start_time

        # Classify risk
        max_people = int(max(counts))
        avg_people = round(sum(counts) / len(counts), 1) if counts else 0
        risk_level = classify_risk(max_people)

        # Build relative path for serving via Express static
        # Backend serves /results → data/results/
        output_video_relative = f"results/{output_filename}"

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
            "outputVideoPath": output_video_relative,
            "faceMatches": face_matches_output,
            "timestamp": datetime.now(timezone.utc).isoformat()
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
