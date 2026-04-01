# face_recognition/face_processor.py
"""
Face processing pipeline for mass-gathering surveillance.

Design (academically standard, viva-safe):
- Crowd / person density: handled by crowd module (e.g. YOLOv8 person detector)
- Face detection + alignment: MTCNN
- Face embeddings: FaceNet (InceptionResnetV1, pretrained='vggface2')
- Similarity matching: cosine similarity against PostgreSQL embeddings
"""

import time
from typing import Any, Dict, List, Optional

import cv2
import numpy as np
import torch
import torch.nn.functional as F
from facenet_pytorch import MTCNN, InceptionResnetV1
from PIL import Image

from face_recognition.database import MissingPersonDB  # PostgreSQL DB


class FaceProcessor:
    """Missing person identification via face similarity matching."""

    MATCH_THRESHOLD: float = 0.6  # cosine similarity threshold

    def __init__(self, db_config: Optional[Any] = None):
        # DB instance (connection pool handled inside MissingPersonDB)
        self.db = MissingPersonDB(db_config)

        # Device with CUDA fallback
        self.device = torch.device("cuda" if torch.cuda.is_available() else "cpu")

        # MTCNN for face detection + alignment, FaceNet for embeddings
        self.mtcnn = MTCNN(
            image_size=160,
            margin=20,
            keep_all=True,
            device=self.device,
        )
        self.facenet = InceptionResnetV1(pretrained="vggface2").eval().to(self.device)

        # Cache active persons to avoid DB hit per face
        self._cached_persons: List[Dict[str, Any]] = []
        self._cache_last_refresh: float = 0.0
        self._cache_ttl_seconds: float = 5.0
    
    def process_cctv_frame(
        self,
        frame: np.ndarray,
        camera_location: str = "Main Gate",
        crowd_density: float = 0.0,
    ) -> List[Dict[str, Any]]:
        """
        COMPLETE PIPELINE: Detect → Embed → Match → Log → Alert.

        Returns a list of detection dicts for overlay/dashboards.
        """
        detections: List[Dict[str, Any]] = []

        # 1. FACE DETECTION (MTCNN: boxes + aligned tensors)
        faces = self._detect_and_align_faces(frame)
        if not faces:
            return detections

        # Check DB health (non-fatal)
        db_healthy = False
        try:
            db_healthy = self.db.health_check()
        except Exception:
            db_healthy = False

        # 2. PROCESS EACH FACE
        for face_data in faces:
            bbox = face_data["bbox"]
            aligned = face_data["aligned"]
            det_conf = 1.0  # nominal detection confidence

            # 3. GENERATE EMBEDDING FROM ALIGNED FACE
            embedding = self._generate_embedding(aligned)
            if embedding is None:
                # Poor embedding → skip face
                continue

            # 4. FIND MATCH (PostgreSQL; cosine similarity)
            match = self._find_best_match(embedding)
            if match and match["confidence"] >= 0.6:
                person_id = match["person_id"]
                if match.get("status") != "FOUND":
                    self.db.mark_person_found(person_id)
                    print(f"ALERT: Missing person detected → {match['name']}")

            # 5. RISK ASSESSMENT
            risk_level = self._assess_risk(crowd_density, match)

            # 6. Log detection (best-effort)
            detection_id = None
            if db_healthy:
                try:
                    detection_id = self.db.log_detection(
                        person_id=match["id"] if match else None,
                        location=camera_location,
                        confidence=float(match["confidence"]) if match else det_conf,
                        crowd_density=f"{crowd_density:.0f}/100m²",
                        image_path=f"cctv_frame_{int(time.time())}",
                        notes=risk_level,
                    )
                except Exception:
                    detection_id = None

            # 7. CRITICAL alerts (>800 density + high similarity match)
            if (
                db_healthy
                and match is not None
                and match["confidence"] >= 0.8
                and risk_level == "CRITICAL"
            ):
                try:
                    self.db.log_alert(
                        alert_type="MISSING_PERSON_FOUND",
                        risk_level="CRITICAL",
                        person_count=1,
                        message=(
                            f"{match['name']} ({match['confidence']*100:.1f}%) "
                            f"in CRITICAL density zone @ {camera_location}"
                        ),
                        location=camera_location,
                    )
                except Exception:
                    pass

            detections.append(
                {
                    "id": detection_id,
                    "bbox": bbox,
                    "match": match,
                    "risk_level": risk_level,
                    "crowd_density": crowd_density,
                    "confidence": det_conf,
                }
            )

        return detections

    def _detect_and_align_faces(self, frame: np.ndarray) -> List[Dict[str, Any]]:
        """
        Detect faces using MTCNN and return list of:
        {'bbox': (x1, y1, x2, y2), 'aligned': tensor[3,160,160]}.
        """
        rgb = cv2.cvtColor(frame, cv2.COLOR_BGR2RGB)
        boxes, _ = self.mtcnn.detect(rgb)
        aligned_faces = self.mtcnn(rgb)

        if boxes is None or aligned_faces is None:
            return []

        results: List[Dict[str, Any]] = []
        num = min(len(boxes), aligned_faces.shape[0])
        for i in range(num):
            x1, y1, x2, y2 = map(int, boxes[i])
            aligned = aligned_faces[i]
            results.append({"bbox": (x1, y1, x2, y2), "aligned": aligned})

        return results

    def _generate_embedding(self, aligned_face) -> Optional[np.ndarray]:
        """FaceNet 512-D embedding (L2-normalized) for face similarity matching."""
        if aligned_face is None:
            return None

        aligned_face = aligned_face.to(self.device)

        with torch.no_grad():
            emb = self.facenet(aligned_face.unsqueeze(0))  # [1,3,160,160]
            emb = F.normalize(emb, p=2, dim=1)

        emb = emb.squeeze(0).cpu().numpy()  # shape: (512,)
        return emb

    def _refresh_cache_if_needed(self) -> None:
        """Refresh active missing persons cache (with embeddings)."""
        now = time.time()
        if now - self._cache_last_refresh < self._cache_ttl_seconds:
            return

        try:
            persons = self.db.get_active_missing_persons()
        except Exception:
            # Keep old cache if DB fetch fails
            return

        cleaned: List[Dict[str, Any]] = []
        for p in persons:
            emb_bytes = p.get("embedding")
            if emb_bytes is None:
                continue
            try:
                emb_vec = np.frombuffer(emb_bytes, dtype=np.float32)
            except Exception:
                continue
            if emb_vec.size == 0:
                continue

            cleaned.append({**p, "embedding_vector": emb_vec})

        self._cached_persons = cleaned
        self._cache_last_refresh = now

    def _find_best_match(self, embedding: np.ndarray) -> Optional[Dict[str, Any]]:
        """
        Match against PostgreSQL database using cosine similarity.

        Returns the best high-confidence similarity match if similarity ≥ 0.6,
        otherwise returns None (treated as Unknown).
        """
        self._refresh_cache_if_needed()
        if not self._cached_persons:
            return None

        best_match: Optional[Dict[str, Any]] = None
        best_similarity: float = -1.0

        for person in self._cached_persons:
            person_emb = person["embedding_vector"]
            if person_emb.shape != embedding.shape:
                continue

            # Convert to tensors and compute cosine similarity
            emb_probe = torch.from_numpy(embedding.astype(np.float32))
            emb_db = torch.from_numpy(person_emb.astype(np.float32))

            # Ensure 1-D tensors and renormalize for safety
            if emb_probe.ndim > 1:
                emb_probe = emb_probe.view(-1)
            if emb_db.ndim > 1:
                emb_db = emb_db.view(-1)

            emb_probe = F.normalize(emb_probe, p=2, dim=0)
            emb_db = F.normalize(emb_db, p=2, dim=0)

            similarity = float(F.cosine_similarity(emb_probe, emb_db, dim=0).item())

            if similarity > best_similarity:
                best_similarity = similarity
                best_match = {
                    "id": person["id"],
                    "person_id": person["id"],
                    "name": person["name"],
                    "status": person.get("status"),
                    "confidence": max(0.0, min(1.0, similarity)),  # use similarity as confidence
                    "similarity": similarity,
                }

        if not best_match:
            return None

        # Only treat as high-confidence similarity match if similarity ≥ MATCH_THRESHOLD
        return best_match if best_match["confidence"] >= self.MATCH_THRESHOLD else None

    def _assess_risk(self, crowd_density: float, match: Optional[Dict[str, Any]]) -> str:
        """Risk = Crowd Density + Missing Person Context."""
        conf = match["confidence"] if match else 0.0
        if crowd_density > 800 or conf > 0.95:
            return "CRITICAL"
        if crowd_density > 500 or conf > 0.9:
            return "HIGH"
        return "NORMAL"

    def add_missing_person(
        self,
        name: str,
        age: int,
        gender: str,
        photo_path: str,
        description: str = "",
        last_seen_location: Optional[str] = None,
        contact_info: Optional[str] = None,
        **kwargs,
    ) -> int:
        """Add person to PostgreSQL with embedding computed from photo_path."""
        img = cv2.imread(photo_path)
        if img is None:
            raise FileNotFoundError(f"Could not read photo at: {photo_path}")

        # Use the same MTCNN alignment pipeline as for CCTV frames
        rgb = cv2.cvtColor(img, cv2.COLOR_BGR2RGB)
        faces = self.mtcnn(rgb)
        if faces is None or faces.shape[0] == 0:
            raise RuntimeError("No face detected in the provided photo.")
        aligned_face = faces[0]

        embedding = self._generate_embedding(aligned_face)
        if embedding is None:
            raise RuntimeError("Failed to generate embedding for given photo.")

        person_id = self.db.add_missing_person(
            name=name,
            age=age,
            gender=gender,
            description=description,
            photo_path=photo_path,
            last_seen_location=last_seen_location,
            contact_info=contact_info,
            embedding=embedding.tobytes(),
            **kwargs,
        )

        # Force cache refresh so new person is immediately matchable
        self._cache_last_refresh = 0.0

        return person_id
