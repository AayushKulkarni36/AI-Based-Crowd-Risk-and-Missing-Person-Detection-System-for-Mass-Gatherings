#!/usr/bin/env python3
"""
FastAPI Face Recognition Microservice
Handles face enrollment, search, and integration with PostgreSQL + pgvector

Endpoints:
  GET  /health          → service status check
  POST /face/enroll     → enroll face for missing person
  POST /face/search     → search for similar faces
  DELETE /face/embedding/:id → delete face vector for person

Integration:
  - PostgreSQL 15 with pgvector extension for storing normalized 512-dim face embeddings
  - InsightFace buffalo_l model for face detection + ArcFace embeddings
  - asyncpg for async database operations
  - CUDA support via InsightFace

Run:
  uvicorn face_api:app --host 0.0.0.0 --port 5001 --workers 1
"""

import asyncio
import base64
import io
import logging
import os
from contextlib import asynccontextmanager
from typing import Optional

import asyncpg
import cv2
import numpy as np
from fastapi import FastAPI, HTTPException
from fastapi.responses import JSONResponse
from PIL import Image
from pydantic import BaseModel

try:
    from insightface.app import FaceAnalysis
    INSIGHTFACE_AVAILABLE = True
except ImportError:
    INSIGHTFACE_AVAILABLE = False

# ============================================================================
# CONFIGURATION & LOGGING
# ============================================================================

logging.basicConfig(
    level=logging.INFO,
    format='[%(levelname)s] %(asctime)s - %(message)s'
)
logger = logging.getLogger(__name__)

DB_HOST = os.getenv("DB_HOST", "localhost")
DB_PORT = int(os.getenv("DB_PORT", "5432"))
DB_NAME = os.getenv("DB_NAME", "missing_persons")
DB_USER = os.getenv("DB_USER", "postgres")
DB_PASSWORD = os.getenv("DB_PASSWORD", "postgres123")

FACE_MATCH_THRESHOLD = 0.60  # InsightFace buffalo_l recommended


# ============================================================================
# PYDANTIC MODELS
# ============================================================================

class EnrollRequest(BaseModel):
    """Request to enroll a face"""
    person_id: int
    image_base64: str


class SearchRequest(BaseModel):
    """Request to search for similar faces"""
    image_base64: str
    top_k: Optional[int] = 3


class FaceMatch(BaseModel):
    """Single face match result"""
    person_id: int
    name: Optional[str] = None
    similarity: float
    status: Optional[str] = None


class SearchResponse(BaseModel):
    """Face search response"""
    matches: list[FaceMatch]
    threshold: float


class HealthResponse(BaseModel):
    """Health check response"""
    status: str
    model: str
    device: str
    db_connected: bool


class EnrollResponse(BaseModel):
    """Face enrollment response"""
    success: bool
    person_id: int
    embedding_dim: int = 512
    stored: bool


# ============================================================================
# SINGLETON SERVICES
# ============================================================================

class FaceAnalysisService:
    """Load InsightFace model once at startup"""

    def __init__(self):
        self.app = None
        self._initialized = False

    async def initialize(self):
        """Load model once at startup"""
        if self._initialized:
            return

        if not INSIGHTFACE_AVAILABLE:
            logger.error("InsightFace not available. Install: pip install insightface onnxruntime-gpu")
            return

        try:
            logger.info("Loading InsightFace buffalo_l model...")
            self.app = FaceAnalysis(
                name='buffalo_l',
                providers=['CUDAExecutionProvider', 'CPUExecutionProvider']
            )
            self.app.prepare(ctx_id=0, det_size=(640, 640))
            self._initialized = True
            logger.info("✓ InsightFace buffalo_l loaded (CUDA enabled)")
        except Exception as e:
            logger.error(f"Failed to load InsightFace: {e}")

    def get_embedding(self, frame: np.ndarray) -> Optional[np.ndarray]:
        """
        Extract face embedding from BGR frame.
        Returns 512-dim float32 L2-normalized embedding or None if no face.
        """
        if self.app is None:
            return None

        try:
            faces = self.app.get(frame)
            if not faces:
                return None

            # Use first detected face
            embedding = faces[0].embedding.astype(np.float32)

            # Normalize to unit length (L2)
            norm = np.linalg.norm(embedding)
            if norm > 0:
                embedding = embedding / norm

            return embedding
        except Exception as e:
            logger.error(f"Embedding extraction failed: {e}")
            return None


class DatabaseService:
    """Manage PostgreSQL async connection pool"""

    def __init__(self):
        self.pool = None

    async def initialize(self):
        """Create connection pool"""
        if self.pool:
            return

        try:
            logger.info(f"Connecting to PostgreSQL at {DB_HOST}:{DB_PORT}/{DB_NAME}...")
            self.pool = await asyncpg.create_pool(
                host=DB_HOST,
                port=DB_PORT,
                database=DB_NAME,
                user=DB_USER,
                password=DB_PASSWORD,
                min_size=2,
                max_size=10,
                command_timeout=60
            )
            logger.info("✓ PostgreSQL connection pool initialized")
        except Exception as e:
            logger.error(f"Database init failed: {e}")

    async def close(self):
        """Close connection pool"""
        if self.pool:
            await self.pool.close()
            logger.info("✓ Database pool closed")

    async def get_person(self, person_id: int) -> Optional[dict]:
        """Fetch person record"""
        if not self.pool:
            return None

        query = "SELECT id, name, status FROM missing_persons WHERE id = $1"
        try:
            row = await self.pool.fetchrow(query, person_id)
            return dict(row) if row else None
        except Exception as e:
            logger.error(f"Person fetch failed: {e}")
            return None

    async def store_face_vector(self, person_id: int, embedding: np.ndarray) -> bool:
        """Store normalized face vector in pgvector column"""
        if not self.pool:
            return False

        embedding_list = embedding.tolist()

        query = """
        UPDATE missing_persons
        SET face_vector = $1, updated_at = NOW()
        WHERE id = $2
        RETURNING id
        """

        try:
            result = await self.pool.fetchval(query, embedding_list, person_id)
            if result:
                logger.info(f"✓ Face vector stored for person {person_id}")
                return True
            else:
                logger.warning(f"Person {person_id} not found in database")
                return False
        except Exception as e:
            logger.error(f"Vector storage failed: {e}")
            return False

    async def search_similar_faces(
        self,
        embedding: np.ndarray,
        limit: int = 3
    ) -> list[dict]:
        """
        Search pgvector using cosine distance.
        Returns matches with person_id, name, similarity score.
        """
        if not self.pool:
            return []

        embedding_list = embedding.tolist()

        query = """
        SELECT
            id,
            name,
            status,
            1 - (face_vector <=> %s) as similarity
        FROM missing_persons
        WHERE face_vector IS NOT NULL AND status = 'ACTIVE'
        ORDER BY face_vector <=> %s
        LIMIT %s
        """

        try:
            # Use psycopg2-compatible param placeholders with asyncpg
            rows = await self.pool.fetch(
                """
                SELECT
                    id,
                    name,
                    status,
                    1 - (face_vector <=> $1) as similarity
                FROM missing_persons
                WHERE face_vector IS NOT NULL AND status = 'ACTIVE'
                ORDER BY face_vector <=> $1
                LIMIT $2
                """,
                embedding_list,
                limit
            )

            results = []
            for row in rows:
                results.append({
                    "person_id": row["id"],
                    "name": row["name"],
                    "similarity": float(row["similarity"]),
                    "status": row["status"]
                })
            return results
        except Exception as e:
            logger.error(f"Face search failed: {e}")
            return []

    async def delete_face_vector(self, person_id: int) -> bool:
        """Delete face vector for a person"""
        if not self.pool:
            return False

        query = """
        UPDATE missing_persons
        SET face_vector = NULL, updated_at = NOW()
        WHERE id = $1
        RETURNING id
        """

        try:
            result = await self.pool.fetchval(query, person_id)
            if result:
                logger.info(f"✓ Face vector deleted for person {person_id}")
                return True
            else:
                logger.warning(f"Person {person_id} not found")
                return False
        except Exception as e:
            logger.error(f"Vector deletion failed: {e}")
            return False


# ============================================================================
# GLOBAL SERVICE INSTANCES
# ============================================================================

face_service = FaceAnalysisService()
db_service = DatabaseService()


# ============================================================================
# FASTAPI LIFESPAN
# ============================================================================

@asynccontextmanager
async def lifespan(app: FastAPI):
    """Initialize on startup, cleanup on shutdown"""
    logger.info("🚀 Starting CrowdSafe Face API...")
    await face_service.initialize()
    await db_service.initialize()

    yield

    logger.info("🛑 Shutting down...")
    await db_service.close()


# ============================================================================
# FASTAPI APP
# ============================================================================

app = FastAPI(
    title="CrowdSafe Face Recognition API",
    version="1.0.0",
    description="Face enrollment and similarity search service",
    lifespan=lifespan
)


# ============================================================================
# ENDPOINTS
# ============================================================================

@app.get("/health", response_model=HealthResponse, tags=["health"])
async def health_check():
    """Service health and readiness check"""
    return HealthResponse(
        status="ok",
        model="buffalo_l",
        device="cuda",
        db_connected=db_service.pool is not None
    )


@app.post("/face/enroll", response_model=EnrollResponse, tags=["face"])
async def enroll_face(request: EnrollRequest):
    """
    Enroll face for a missing person.

    Takes a base64-encoded image, extracts 512-dim ArcFace embedding,
    and stores normalized vector in missing_persons.face_vector (pgvector).

    Args:
      person_id: missing person database ID
      image_base64: base64 encoded JPEG/PNG image

    Returns:
      success, person_id, embedding_dim (512), stored flag
    """
    try:
        # Decode base64 image
        try:
            image_bytes = base64.b64decode(request.image_base64)
            img = Image.open(io.BytesIO(image_bytes))
            frame = cv2.cvtColor(np.array(img), cv2.COLOR_RGB2BGR)
        except Exception as e:
            raise HTTPException(status_code=400, detail=f"Invalid image format: {str(e)}")

        # Extract embedding
        embedding = face_service.get_embedding(frame)
        if embedding is None:
            raise HTTPException(status_code=400, detail="No face detected in image")

        # Verify person exists
        person = await db_service.get_person(request.person_id)
        if not person:
            raise HTTPException(status_code=404, detail=f"Person {request.person_id} not found")

        # Store vector in database
        stored = await db_service.store_face_vector(request.person_id, embedding)
        if not stored:
            raise HTTPException(status_code=500, detail="Failed to store face vector")

        return EnrollResponse(
            success=True,
            person_id=request.person_id,
            embedding_dim=512,
            stored=True
        )

    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Enrollment failed: {e}", exc_info=True)
        raise HTTPException(status_code=500, detail=f"Enrollment error: {str(e)}")


@app.post("/face/search", response_model=SearchResponse, tags=["face"])
async def search_faces(request: SearchRequest):
    """
    Search for missing persons matching detected face.

    Takes a base64-encoded image, extracts embedding, and searches
    PostgreSQL pgvector for similar faces with cosine distance.

    Returns matches with similarity scores and person details only if
    similarity >= FACE_MATCH_THRESHOLD (0.6).

    Args:
      image_base64: base64 encoded JPEG/PNG
      top_k: max number of results (default 3)

    Returns:
      List of matches with person_id, name, similarity, status
    """
    try:
        # Decode image
        try:
            image_bytes = base64.b64decode(request.image_base64)
            img = Image.open(io.BytesIO(image_bytes))
            frame = cv2.cvtColor(np.array(img), cv2.COLOR_RGB2BGR)
        except Exception as e:
            raise HTTPException(status_code=400, detail=f"Invalid image format: {str(e)}")

        # Extract embedding
        embedding = face_service.get_embedding(frame)
        if embedding is None:
            raise HTTPException(status_code=400, detail="No face detected in image")

        # Search database
        all_matches = await db_service.search_similar_faces(
            embedding,
            limit=request.top_k or 3
        )

        # Filter by threshold
        matches = [
            FaceMatch(**m) for m in all_matches
            if m["similarity"] >= FACE_MATCH_THRESHOLD
        ]

        logger.info(f"Found {len(matches)} matches (threshold: {FACE_MATCH_THRESHOLD})")

        return SearchResponse(
            matches=matches,
            threshold=FACE_MATCH_THRESHOLD
        )

    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Search failed: {e}", exc_info=True)
        raise HTTPException(status_code=500, detail=f"Search error: {str(e)}")


@app.delete("/face/embedding/{person_id}", tags=["face"])
async def delete_embedding(person_id: int):
    """
    Delete face embedding for a person.

    Clears the face_vector column in missing_persons table for person_id.

    Returns:
      success flag and person_id
    """
    try:
        deleted = await db_service.delete_face_vector(person_id)
        if not deleted:
            raise HTTPException(status_code=404, detail=f"Person {person_id} not found")

        return JSONResponse(
            status_code=200,
            content={"success": True, "person_id": person_id}
        )

    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Deletion failed: {e}")
        raise HTTPException(status_code=500, detail=str(e))


# ============================================================================
# MAIN (for direct execution)
# ============================================================================

if __name__ == "__main__":
    import uvicorn

    uvicorn.run(
        app,
        host="0.0.0.0",
        port=5001,
        workers=1,  # GPU is shared; single worker only
        log_level="info"
    )
