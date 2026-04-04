#!/usr/bin/env python3
"""
Face Matching Pipeline
Search video frames for matches against enrolled missing person faces using FAISS

Usage:
  python match_video.py --video /path/to/video.mp4 \
    --db-host localhost --db-name missing_persons \
    --db-user postgres --db-password {pwd} \
    --job-id {uuid} --threshold 0.6 --skip 6 --json

Outputs:
  - MATCH:person_id:name:confidence:frame_num lines (real-time matches)
  - PROGRESS:percent lines (processing progress)
  - Final JSON to stdout with all matches

Errors go to stderr only.
"""

import sys
import json
import argparse
import cv2
import torch
import numpy as np
from pathlib import Path
from datetime import datetime

try:
    from facenet_pytorch import MTCNN, InceptionResnetV1
    from PIL import Image
    FACENET_AVAILABLE = True
except ImportError:
    FACENET_AVAILABLE = False
    print("ERROR: FaceNet not installed", file=sys.stderr)

try:
    import faiss
    FAISS_AVAILABLE = True
except ImportError:
    FAISS_AVAILABLE = False
    print("WARNING: FAISS not available, will fall back to numpy", file=sys.stderr)

try:
    import psycopg2
    PSYCOPG2_AVAILABLE = True
except ImportError:
    PSYCOPG2_AVAILABLE = False
    print("ERROR: psycopg2 not installed", file=sys.stderr)

# ============================================================================
# CONFIG
# ============================================================================
DEFAULT_THRESHOLD = 0.6
DEFAULT_SKIP_FRAMES = 6

def log_error(msg):
    """Log to stderr"""
    print(f"ERROR: {msg}", file=sys.stderr, flush=True)

def log_info(msg):
    """Log to stderr"""
    print(f"INFO: {msg}", file=sys.stderr, flush=True)

# ============================================================================
# DATABASE
# ============================================================================

def fetch_enrolled_persons(db_conn):
    """
    Fetch all ACTIVE persons with face embeddings from DB
    Returns: { person_id: { name: str, embedding: np.array } }
    """
    try:
        cursor = db_conn.cursor()
        cursor.execute("""
            SELECT id, name, face_vector
            FROM missing_persons
            WHERE status = 'ACTIVE' AND face_vector IS NOT NULL
        """)
        rows = cursor.fetchall()
        cursor.close()

        enrolled = {}
        for person_id, name, face_vector in rows:
            if face_vector:
                try:
                    # Parse pgvector format or array
                    if isinstance(face_vector, str):
                        # pgvector returns as string like "[0.1,0.2,...]"
                        emb = np.array(json.loads(face_vector.replace('[', '[').replace(']', ']')))
                    else:
                        emb = np.array(face_vector, dtype=np.float32)

                    # Normalize
                    norm = np.linalg.norm(emb)
                    if norm > 0:
                        emb = emb / norm

                    enrolled[person_id] = {
                        'name': name,
                        'embedding': emb.astype(np.float32)
                    }
                except Exception as e:
                    log_error(f"Failed to parse embedding for person {person_id}: {e}")
                    continue

        return enrolled

    except Exception as e:
        log_error(f"Failed to fetch enrolled persons: {e}")
        return {}

def build_faiss_index(enrolled):
    """
    Build FAISS index from enrolled embeddings
    Returns: (faiss_index, person_id_list, embeddings_array)
    """
    if not enrolled:
        return None, [], np.array([])

    person_ids = sorted(enrolled.keys())
    embeddings = np.array([enrolled[pid]['embedding'] for pid in person_ids]).astype(np.float32)

    if FAISS_AVAILABLE:
        try:
            index = faiss.IndexFlatIP(512)  # inner product = cosine on L2-norm
            index.add(embeddings)
            log_info(f"Built FAISS index with {len(person_ids)} embeddings")
            return index, person_ids, embeddings
        except Exception as e:
            log_error(f"Failed to build FAISS index: {e}, falling back to numpy")

    # Fallback: use numpy
    return None, person_ids, embeddings

def search_numpy(query_emb, embeddings):
    """Fallback numpy search (when FAISS not available)"""
    similarities = np.dot(embeddings, query_emb)
    best_idx = np.argmax(similarities)
    best_score = float(similarities[best_idx])
    return best_idx, best_score

# ============================================================================
# FACE DETECTION
# ============================================================================

def load_models():
    """Load MTCNN and InceptionResnetV1"""
    try:
        device = torch.device('cuda' if torch.cuda.is_available() else 'cpu')

        mtcnn = MTCNN(
            image_size=160,
            margin=20,
            min_face_size=20,
            thresholds=[0.6, 0.7, 0.7],
            keep_all=True,  # Keep all detected faces
            device=device
        )

        resnet = InceptionResnetV1(pretrained='vggface2').eval().to(device)

        log_info(f"Models loaded on {device}")
        return mtcnn, resnet, device

    except Exception as e:
        log_error(f"Failed to load models: {e}")
        return None, None, None

def get_face_embeddings(frame, mtcnn, resnet, device):
    """
    Detect all faces in frame and extract embeddings
    Returns: list of { bbox: [x1,y1,x2,y2], embedding: [...] }
    """
    try:
        img = Image.fromarray(frame)

        # Detect faces (batch mode)
        face_tensors = mtcnn(img)

        if face_tensors is None or len(face_tensors) == 0:
            return []

        # Ensure batch dimension
        if face_tensors.dim() == 3:
            face_tensors = face_tensors.unsqueeze(0)
        face_tensors = face_tensors.to(device)

        # Extract embeddings
        with torch.no_grad():
            embeddings = resnet(face_tensors)

        results = []
        for i, emb in enumerate(embeddings):
            emb_np = emb.cpu().numpy()
            norm = np.linalg.norm(emb_np)
            if norm > 0:
                emb_np = emb_np / norm

            results.append({
                'embedding': emb_np.astype(np.float32),
                'bbox': [0, 0, 0, 0]  # Simplified - MTCNN doesn't return bbox directly
            })

        return results

    except Exception as e:
        log_error(f"Error extracting faces: {e}")
        return []

# ============================================================================
# MAIN PIPELINE
# ============================================================================

def process_video(video_path, db_conn, job_id, threshold, skip_frames, output_json):
    """Main video processing pipeline"""
    try:
        # Open video
        log_info(f"Opening video: {video_path}")
        cap = cv2.VideoCapture(str(video_path))

        if not cap.isOpened():
            log_error(f"Cannot open video: {video_path}")
            return None

        total_frames = int(cap.get(cv2.CAP_PROP_FRAME_COUNT))
        fps = cap.get(cv2.CAP_PROP_FPS)
        log_info(f"Video: {total_frames} frames @ {fps:.1f} fps")

        # Fetch enrolled persons
        log_info("Fetching enrolled missing persons...")
        enrolled = fetch_enrolled_persons(db_conn)
        log_info(f"Found {len(enrolled)} enrolled persons")

        if not enrolled:
            # No persons to match against
            if output_json:
                print(json.dumps({
                    "job_id": job_id,
                    "matches": [],
                    "total_frames_searched": 0,
                    "total_faces_found": 0,
                    "persons_searched": 0,
                    "threshold_used": threshold,
                    "message": "No enrolled persons to match against"
                }))
            cap.release()
            return None

        # Build search index
        index, person_ids, embeddings = build_faiss_index(enrolled)

        # Load face models
        log_info("Loading face detection models...")
        mtcnn, resnet, device = load_models()
        if mtcnn is None:
            log_error("Failed to load face models")
            cap.release()
            return None

        # Process frames
        log_info("Starting frame processing...")
        frame_count = 0
        frames_searched = 0
        total_faces = 0
        matches = {}  # person_id -> best confidence for this person

        try:
            while True:
                ret, frame = cap.read()
                if not ret:
                    break

                frame_count += 1

                # Skip frames
                if frame_count % skip_frames != 0:
                    continue

                frames_searched += 1

                # Detect faces
                face_results = get_face_embeddings(frame, mtcnn, resnet, device)
                total_faces += len(face_results)

                # Match each face
                for face_data in face_results:
                    query_emb = face_data['embedding'].reshape(1, -1)

                    # Search
                    if index is not None:
                        # FAISS search
                        D, I = index.search(query_emb, k=1)
                        best_idx = I[0][0]
                        best_score = float(D[0][0])
                    else:
                        # Numpy fallback
                        best_idx, best_score = search_numpy(query_emb[0], embeddings)

                    # Check threshold
                    if best_score > threshold and best_idx >= 0:
                        person_id = person_ids[best_idx]
                        person_name = enrolled[person_id]['name']

                        # Emit match immediately (real-time)
                        match_msg = f"MATCH:{person_id}:{person_name}:{best_score:.4f}:{frame_count}"
                        print(match_msg, flush=True)
                        log_info(match_msg)

                        # Store best match for this person
                        if person_id not in matches or best_score > matches[person_id]['confidence']:
                            matches[person_id] = {
                                'name': person_name,
                                'confidence': best_score,
                                'frame_number': frame_count
                            }

                # Emit progress
                if frames_searched % 10 == 0:
                    progress = int((frame_count / total_frames) * 100)
                    print(f"PROGRESS:{progress}", flush=True)

        finally:
            cap.release()

        # Build final results
        matches_list = [
            {
                'person_id': pid,
                'person_name': m['name'],
                'confidence': round(m['confidence'], 4),
                'frame_number': m['frame_number']
            }
            for pid, m in sorted(matches.items())
        ]

        if output_json:
            print(json.dumps({
                "job_id": job_id,
                "matches": matches_list,
                "total_frames_searched": frames_searched,
                "total_faces_found": total_faces,
                "persons_searched": len(enrolled),
                "threshold_used": threshold,
                "timestamp": datetime.utcnow().isoformat() + 'Z'
            }))

        return matches_list

    except Exception as e:
        log_error(f"Fatal error: {e}")
        return None

# ============================================================================
# CLI
# ============================================================================

def main():
    if not all([FACENET_AVAILABLE, PSYCOPG2_AVAILABLE]):
        log_error("Missing required dependencies: facenet-pytorch, psycopg2")
        sys.exit(1)

    parser = argparse.ArgumentParser(description='Face matching pipeline')
    parser.add_argument('--video', type=str, required=True, help='Video file path')
    parser.add_argument('--job-id', type=str, required=True, help='Job UUID')
    parser.add_argument('--db-host', type=str, default='localhost')
    parser.add_argument('--db-name', type=str, default='missing_persons')
    parser.add_argument('--db-user', type=str, default='postgres')
    parser.add_argument('--db-password', type=str, default='postgres123')
    parser.add_argument('--threshold', type=float, default=DEFAULT_THRESHOLD)
    parser.add_argument('--skip', type=int, default=DEFAULT_SKIP_FRAMES)
    parser.add_argument('--json', action='store_true', help='Output JSON')

    args = parser.parse_args()

    try:
        # Connect to DB
        db_conn = psycopg2.connect(
            host=args.db_host,
            database=args.db_name,
            user=args.db_user,
            password=args.db_password
        )

        # Process
        process_video(
            args.video,
            db_conn,
            args.job_id,
            args.threshold,
            args.skip,
            args.json
        )

        db_conn.close()

    except Exception as e:
        log_error(f"Setup failed: {e}")
        sys.exit(1)

if __name__ == '__main__':
    main()
