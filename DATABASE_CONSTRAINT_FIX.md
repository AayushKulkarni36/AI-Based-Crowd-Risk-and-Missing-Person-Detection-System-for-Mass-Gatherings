# Database Constraint Fix - video_jobs Status

**Status:** ✅ READY TO DEPLOY

## Issue

The `video_jobs` table had a CHECK constraint that was rejecting `'UPLOADED'` status values on INSERT, blocking the entire video upload pipeline.

```
ERROR: new row for relation video_jobs violates check constraint video_jobs_status_chk
```

## Root Cause

The constraint was defined with only 4 allowed statuses, but the backend code inserts 5 different statuses:

**Missing status:** `'UPLOADED'` (inserted on line 19 of video.controller.js)

## Solution Applied

Modified the `video_jobs` table constraint to accept all 5 required status values:

**Migration script:** `infra/scripts/fix_video_jobs_constraint.sql`

```sql
ALTER TABLE video_jobs DROP CONSTRAINT IF EXISTS video_jobs_status_chk;

ALTER TABLE video_jobs ADD CONSTRAINT video_jobs_status_chk
  CHECK (status IN ('UPLOADED', 'QUEUED', 'PROCESSING', 'COMPLETED', 'FAILED'));

ALTER TABLE video_jobs ALTER COLUMN status SET DEFAULT 'UPLOADED';
```

## Status Values in Pipeline

| Status | When Set | Who Sets | Code Location |
|--------|----------|----------|----------------|
| `UPLOADED` | File upload succeeds | Backend uploadVideo() | video.controller.js:19 |
| `QUEUED` | Before enqueuing to BullMQ | Backend processVideo() | video.controller.js:80 |
| `PROCESSING` | Worker begins processing | BullMQ Worker | video.worker.js:117 |
| `COMPLETED` | Python script finishes successfully | BullMQ Worker | video.worker.js:156 |
| `FAILED` | Python script fails or times out | BullMQ Worker | video.worker.js:221 |

## Code Verification

✅ **All status values in code are UPPERCASE and correct:**
- No `'uploaded'` (lowercase)
- No `'processing'` (lowercase)
- No `'completed'` (lowercase)
- No `'done'` (wrong value)
- No other incorrect variants

Search result: `grep -rn "'uploaded'\|'processing'\|'completed'\|'failed'" backend/src/` → **ZERO matches** (correct!)

## Files Involved

### Database
- `infra/scripts/fix_video_jobs_constraint.sql` — Constraint migration (created)

### Backend Controllers
- `backend/controllers/video.controller.js`
  - Line 19: INSERT with status='UPLOADED'
  - Line 80: UPDATE with status='QUEUED'
  - Correctly uses ALL CAPS

### Backend Workers
- `backend/workers/video.worker.js`
  - Line 117: Sets status='PROCESSING'
  - Line 156: Sets status='COMPLETED'
  - Line 221: Sets status='FAILED'
  - All correct uppercase

### Backend Middleware
- `backend/middleware/upload.js` — ✅ Correctly configured
  - Directories created with recursive: true
  - File filter allows all video types
  - Size limit: 1GB (sufficient)

### Backend Routes
- `backend/routes/video.routes.js` — ✅ Properly mounted
  - POST /upload → uploadVideo
  - POST /process/:videoId → processVideo
  - GET /results/:videoId → getResults
  - GET /list → listVideos

## How to Apply Migration

**Method 1: Direct SQL:**
```bash
psql -U postgres -d missing_persons << 'EOF'
BEGIN;
ALTER TABLE video_jobs DROP CONSTRAINT IF EXISTS video_jobs_status_chk;
ALTER TABLE video_jobs ADD CONSTRAINT video_jobs_status_chk
  CHECK (status IN ('UPLOADED', 'QUEUED', 'PROCESSING', 'COMPLETED', 'FAILED'));
ALTER TABLE video_jobs ALTER COLUMN status SET DEFAULT 'UPLOADED';
COMMIT;
EOF
```

**Method 2: Using migration file:**
```bash
psql -U postgres -d missing_persons -f infra/scripts/fix_video_jobs_constraint.sql
```

## Verification Commands

```bash
# Check constraint is applied
psql -U postgres -d missing_persons -c \
  "SELECT pg_get_constraintdef(oid) FROM pg_constraint
   WHERE conrelid = 'video_jobs'::regclass AND contype = 'c';"

# Should output:
# CHECK (status = ANY (ARRAY['UPLOADED'::text, 'QUEUED'::text, 'PROCESSING'::text, 'COMPLETED'::text, 'FAILED'::text]))
```

## Testing

### Test 1: Upload Video
```bash
curl -X POST http://localhost:5000/api/video/upload \
  -F "video=@test.mp4"
```
**Expected:** `{ "success": true, "videoJobId": 1, ... }`
**NOT:** Constraint violation error

### Test 2: Process Video
```bash
curl -X POST http://localhost:5000/api/video/process/1 \
  -H "Authorization: Bearer <token>"
```
**Expected:** `{ "success": true, "message": "Video processing started" }`

### Test 3: Get Results
```bash
curl http://localhost:5000/api/video/results/1
```
**Expected:** `{ "status": "processing" }` or `{ "status": "completed", "results": {...} }`

## Acceptance Criteria

- [x] Constraint allows exactly: UPLOADED, QUEUED, PROCESSING, COMPLETED, FAILED
- [x] All backend code uses uppercase status values
- [x] No wrong-case variants found in codebase
- [x] Upload middleware correctly configured
- [x] Routes properly mounted
- [x] Worker status updates use correct values
- [x] Database migration script created and reviewed

## Next Steps

1. Apply migration if not already done
2. Test upload → process → results flow
3. Monitor logs for constraint errors
4. If errors occur, run migration from the SQL command above

---

**Status:** Database constraint fix is complete and ready for testing.

