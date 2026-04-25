# CrowdNexis AI Face Matching Pipeline - IMPLEMENTATION SUMMARY
**Date:** 2026-04-04
**Status:** 90% Complete (Ready for Integration Testing)

---

## ✅ COMPLETED COMPONENTS

### 1. Database Schema Updates
**File:** `infra/scripts/add_face_matching_schema.sql`

**Changes:**
- ✅ Added `embedding_model`, `embedding_created_at` columns to `missing_persons`
- ✅ Added `found_timestamp` column to `missing_persons`
- ✅ Created `face_matches` table with all required columns (person_id, job_id, frame_number, confidence, bbox, confirmed)
- ✅ Added indexes on face_vector for fast similarity search
- ✅ Added indexes on person_id, job_id, matched_at for efficient queries
- ✅ Updated video_jobs constraint to include UPLOADED status

**Run Migration:**
```bash
psql -U postgres -d missing_persons -f infra/scripts/add_face_matching_schema.sql
```

### 2. Face Enrollment Pipeline
**File:** `src/face_recognition/enroll.py`

**Purpose:** Extract 512-dim FaceNet embedding from missing person photo

**CLI:**
```bash
python enroll.py --image /path/to/photo.jpg
```

**Output (JSON to stdout):**
```json
{
  "success": true,
  "embedding": [0.123, -0.456, ...],  ← 512 floats, L2-normalized
  "embedding_dim": 512,
  "face_detected": true,
  "error": null
}
```

**Key Features:**
- ✅ Uses facenet-pytorch (InceptionResnetV1 pretrained on VGGFace2)
- ✅ MTCNN face detection with margin
- ✅ L2 normalization for cosine similarity
- ✅ All errors logged to stderr only
- ✅ JSON to stdout only on success

### 3. Face Matching Pipeline
**File:** `src/face_recognition/match_video.py`

**Purpose:** Search video frames for matches against enrolled missing person faces

**CLI:**
```bash
python match_video.py --video /path/to/video.mp4 \
  --job-id {uuid} \
  --db-host localhost \
  --db-name missing_persons \
  --db-user postgres \
  --db-password {pwd} \
  --threshold 0.6 \
  --skip 6 \
  --json
```

**Output (to stdout):**
1. `MATCH:person_id:name:confidence:frame_num` - Real-time matches (one per line)
2. `PROGRESS:percent` - Processing progress updates
3. Final JSON with all results

**JSON Output:**
```json
{
  "matches": [
    {
      "person_id": 1,
      "person_name": "Rahul Sharma",
      "confidence": 0.847,
      "frame_number": 120
    }
  ],
  "total_frames_searched": 240,
  "total_faces_found": 12,
  "persons_searched": 3,
  "threshold_used": 0.6
}
```

**Key Features:**
- ✅ Fetches enrolled active persons from PostgreSQL
- ✅ Builds FAISS index for fast cosine similarity search
- ✅ Falls back to numpy if FAISS unavailable
- ✅ Processes every Nth frame (default 6, configurable)
- ✅ Real-time match emission for Socket.io updates
- ✅ Deduplicates matches (one best per person)
- ✅ All errors to stderr

### 4. Backend Face Matching Controller
**File:** `backend/controllers/facematch.controller.js`

**Endpoints:**

#### POST /api/facematch/run
- **Body:** `{ jobId: number }`
- **Results:** Spawns Python match_video.py process
- **Real-time updates:** Emits Socket.io events for matches and progress
- **Database:** Stores matches in face_matches table, updates person status to POSSIBLE_MATCH

#### GET /api/facematch/:jobId
- **Returns:** All face matches for a video job

#### PUT /api/facematch/:matchId/confirm
- **Action:** Marks match as confirmed, updates person status to FOUND

#### DELETE /api/facematch/:matchId
- **Action:** Removes match, reverts person status to ACTIVE

### 5. Backend Face Matching Routes
**File:** `backend/routes/facematch.routes.js`

**Mounted in:** `backend/server.js` at `/api/facematch`

### 6. Backend Person Controller Updates
**File:** `backend/controllers/person.controller.js`

**Changes:**
- ✅ Spawns `enroll.py` asynchronously when photo uploaded
- ✅ Parses JSON output from Python script
- ✅ Stores embedding in `face_vector` column using pgvector
- ✅ Non-blocking: person always saved, face enrollment happens in background
- ✅ Returns `faceEnrolled: true/false` and `faceError: string | null`

### 7. Frontend API Service Extensions
**File:** `frontend_v2/src/services/api.ts`

**New Methods:**
```typescript
runFaceMatch(jobId): Promise<{ matches, totalMatches }>
getMatchResults(jobId): Promise<{ matches }>
confirmMatch(matchId): Promise<void>
dismissMatch(matchId): Promise<void>
```

---

## 🎯 INTEGRATION FLOW

```
1. User completes video analysis on CrowdDetection page
   ↓
2. Results displayed (people count, risk level, FPS)
   ↓
3. "Search for Missing Persons" button appears
   ↓
4. User clicks button → POST /api/facematch/run { jobId }
   ↓
5. Backend spawns match_video.py process
   ↓
6. Python script:
   - Fetches enrolled active persons from DB
   - Builds FAISS index (512-dim face embeddings)
   - Processes video frames (every 6th)
   - Detects faces with MTCNN
   - Extracts embeddings with InceptionResnetV1
   - Searches against FAISS index
   ↓
7. For each match found:
   - Emits MATCH line to stdout (real-time)
   - Backend captures and emits Socket.io event
   - Toast notification shown to user: "Match found: NAME (92% confidence)"
   ↓
8. On completion:
   - Stores matches in face_matches table
   - Updates person status: ACTIVE → POSSIBLE_MATCH
   - Frontend shows match results with photos
   ↓
9. User clicks "Confirm Match" on match card
   - PUT /api/facematch/:matchId/confirm
   - Updates face_matches.confirmed = true
   - Updates person.status = FOUND
   - Alert shown on Dashboard
   ↓
10. User can view/manage found persons on Dashboard
```

---

## PENDING FRONTEND UPDATES

These updates need to be made to integrate face matching into the UI:

### CrowdDetection.tsx
- [ ] Add "Search for Missing Persons" button (appears when job status = COMPLETED)
- [ ] Add confirmation dialog
- [ ] Show "Searching..." progress with animated progress bar
- [ ] Listen for Socket.io `face:match` events → show toast notifications
- [ ] Display match results in collapsible panel
- [ ] "View Match" link for each person → /missing-persons?personId={id}

### MissingPersons.tsx
- [ ] Show URL param `jobId` if present → indicate video was just analyzed
- [ ] Update person cards to show POSSIBLE_MATCH status badge
- [ ] Add "Confirm Match" button on POSSIBLE_MATCH cards
- [ ] Add "View Match" button to open match confirmation dialog
- [ ] Show match confidence percentage on match cards

### Dashboard.tsx
- [ ] Add "Face Matches Found Today" stat card
- [ ] Show recent matches in "Recent Activity" section
- [ ] Show POSSIBLE_MATCH alerts differently (blue border, user icon)
- [ ] Add "Found Persons" count in stats cards
- [ ] Add action buttons to match alerts

---

## ⚙️ CONFIGURATION

### Environment Variables
```bash
# Python environment (optional, auto-detected)
PYTHON_PATH=/path/to/python.exe

# Database
DB_HOST=localhost
DB_NAME=missing_persons
DB_USER=postgres
DB_PASSWORD=postgres123

# Video processing
SKIP_FRAMES=3          # For crowd detection
DEFAULT_THRESHOLD=0.6  # For face matching (cosine similarity)
```

### Python Dependencies
Already in `requirements.txt`:
- ✅ facenet-pytorch==2.5.3
- ✅ faiss-cpu==1.8.0
- ✅ torch, torchvision
- ✅ opencv-python
- ✅ psycopg2-binary

---

## 🧪 TESTING CHECKLIST

### 1. Database Migration
```bash
psql -U postgres -d missing_persons -f infra/scripts/add_face_matching_schema.sql

# Verify:
psql -U postgres -d missing_persons -c "
  SELECT column_name FROM information_schema.columns
  WHERE table_name='missing_persons'
  ORDER BY column_name;
"
# Should include: embedding_model, embedding_created_at, face_vector, photo_path
```

### 2. Python Environment
```bash
cd C:\Users\ayush\FinalYearProject
venv\Scripts\python verify_env.py

# Check output - all should be OK:
# OK: YOLOv8
# OK: OpenCV
# OK: PyTorch CUDA=true
# OK: NumPy
```

### 3. Face Enrollment
```bash
# Create test image (or use existing photo)
# Copy JPG to a test location

venv\Scripts\python src/face_recognition/enroll.py --image test_photo.jpg

# Expected output:
# {"success": true, "embedding": [...], "embedding_dim": 512, ...}
```

### 4. Register Missing Person with Photo
```bash
# Via frontend:
# 1. Navigate to /missing-persons
# 2. Click "Register Missing Person"
# 3. Upload photo
# 4. Check DB:

psql -U postgres -d missing_persons -c "
  SELECT id, name, photo_path, face_vector IS NOT NULL as has_embedding
  FROM missing_persons
  ORDER BY id DESC LIMIT 1;
"
# face_vector should be NOT NULL
```

### 5. Complete Video Processing
```bash
# Via frontend:
# 1. Navigate to /crowd-detection
# 2. Upload .mp4 video
# 3. Click "Start Analysis"
# 4. Wait for completion (~2-5 min depending on video length)
# 5. Verify results shown (people count, risk level, FPS)
```

### 6. Face Matching Full Flow
```bash
# Via frontend (after video processing completes):
# 1. "Search for Missing Persons" button should appear
# 2. Click button
# 3. Confirmation dialog appears
# 4. Click "Search Now"
# 5. Progress bar shows (0-100%)
# 6. If matches found:
#    - Toast notifications show in real-time
#    - Results panel shows with person photos
#    - Person card now shows POSSIBLE_MATCH status
#    - Dashboard shows new face match alert
# 7. Click "Confirm Match" on result
# 8. Person status updates to FOUND
# 9. Check DB:

psql -U postgres -d missing_persons -c "
  SELECT id, name, status FROM missing_persons WHERE status='FOUND';
"
```

### 7. API Endpoint Tests
```bash
# Test face matching endpoint
curl -X POST http://localhost:5000/api/facematch/run \
  -H "Authorization: Bearer {valid_token}" \
  -H "Content-Type: application/json" \
  -d '{"jobId": 1}'

# Expected response:
# {"success": true, "matches": [...], "totalMatches": N}

# Get match results
curl -X GET http://localhost:5000/api/facematch/1 \
  -H "Authorization: Bearer {valid_token}"

# Confirm a match
curl -X PUT http://localhost:5000/api/facematch/{matchId}/confirm \
  -H "Authorization: Bearer {valid_token}" \
  -H "Content-Type: application/json"
```

---

## 🚨 CRITICAL NOTES

1. **Face embedding is pgvector format**
   - Stored as `vector(512)` in PostgreSQL
   - JSON passed as string: `[0.123, -0.456, ...]`
   - Frontend doesn't need to handle embedding data

2. **Async processing is NON-BLOCKING**
   - Person registered immediately (photo upload async)
   - Response: `faceEnrolled: false|true`
   - Face enrollment happens in background

3. **POSSIBLE_MATCH requires confirmation**
   - Matches NEVER auto-set status to FOUND
   - User must explicitly confirm match
   - This prevents false positives

4. **Real-time updates need Socket.io**
   - Backend emits `face:match` events
   - Frontend should listen on `/events` namespace
   - See socket.js for event names

5. **Similarity threshold is cosine (0.0-1.0)**
   - Default: 0.6 (60% similar)
   - Higher = more strict matching
   - Tune based on false positive rates

---

## 📊 DATA FLOW DIAGRAM

```
User Upload Photo
       ↓
[Multer saves file]
       ↓
[Create missing_person record]
       ↓
       ├→ [Spawn enroll.py async]
       │     ↓
       │  [Extract embedding]
       │     ↓
       │  [Update face_vector in DB]
       │
[Return immediately: person created, faceEnrolled=T/F]
       ↓
→ Process Video (separate flow)
       ↓
[Video Analysis Complete]
       ↓
User clicks "Search for Missing Persons"
       ↓
[POST /api/facematch/run]
       ↓
[Spawn match_video.py]
       ↓
[For each frame: detect faces → extract embeddings → search FAISS]
       ↓
[For each match > threshold:
       ├→ [Emit MATCH line to stdout]
       ├→ [Backend captures → Socket.io event]
       └→ [Toast notification to user]
]
       ↓
[Store matches in face_matches table]
       ↓
[Update person status: ACTIVE → POSSIBLE_MATCH]
       ↓
User sees "2 matches found" results
       ↓
User clicks "Confirm Match"
       ↓
[PUT /api/facematch/:matchId/confirm]
       ↓
[Update: confirmed=true, person.status=FOUND]
       ↓
Person appears in "Found Persons" list on Dashboard
```

---

## FILES CREATED/MODIFIED

### Created Files
- ✅ `infra/scripts/add_face_matching_schema.sql`
- ✅ `src/face_recognition/enroll.py`
- ✅ `src/face_recognition/match_video.py`
- ✅ `backend/controllers/facematch.controller.js`
- ✅ `backend/routes/facematch.routes.js`

### Modified Files
- ✅ `backend/controllers/person.controller.js` (added face enrollment)
- ✅ `backend/server.js` (added facematch routes)
- ✅ `frontend_v2/src/services/api.ts` (added face match API methods)

### No Changes Needed
- ✅ `App.tsx` (routing already correct)
- ✅ `requirements.txt` (dependencies already present)
- ✅ Auth system (100% complete, untouched)
- ✅ Database schema for users, video_jobs, etc.

---

## NEXT STEPS (For Frontend Developer)

1. **Run migration:** `psql -f infra/scripts/add_face_matching_schema.sql`
2. **Test enroll.py:** `python src/face_recognition/enroll.py --image test.jpg`
3. **Update CrowdDetection.tsx** with face match button and results display
4. **Update MissingPersons.tsx** with match confirmation UI
5. **Update Dashboard.tsx** to show face match alerts
6. **Fix TypeScript errors:** `npx tsc --noEmit`
7. **Test end-to-end:** Upload video → Search → Confirm match

---

## 🎓 ARCHITECTURE SUMMARY

**Technology Stack:**
- **Face Enrollment:** FaceNet-PyTorch (512-dim embeddings)
- **Face Matching:** FAISS (fast similarity search) or NumPy fallback
- **Video Processing:** OpenCV + MTCNN (face detection)
- **Database:** PostgreSQL + pgvector (for similarity search)
- **API Framework:** Express.js (Node.js backend)
- **Frontend:** React + TypeScript

**Processing Pipeline:**
```
Photo → MTCNN → InceptionResnetV1 → 512-dim embedding → Storage (pgvector)
Video → Frame extraction → MTCNN → InceptionResnetV1 → Search FAISS → Match found
```

**Similarity Metric:** Cosine distance on L2-normalized embeddings (0.0 = different, 1.0 = identical)

---

**Status:** 90% Complete - Ready for integration testing.
**Remaining:** Frontend UI integration + TypeScript compilation fixes

Generated: 2026-04-04T12:00:00Z
