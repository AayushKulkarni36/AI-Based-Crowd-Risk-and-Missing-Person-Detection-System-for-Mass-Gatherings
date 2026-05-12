# Automatic State Transition Implementation

## 🎯 Overview
Implemented automatic state transition of missing persons from "ACTIVE" to "FOUND" when detected by the video processing pipeline, eliminating dependency on manual frontend actions.

---

## ✅ What Was Implemented

### 1. Database Schema Updates
**File:** `backend/auto_state_transition_migration.sql`

**New Fields Added to `missing_persons` table:**
- `matched_frame_id` (TEXT) - Reference to the frame where person was detected
- `last_matched_at` (TIMESTAMPTZ) - Timestamp of most recent detection

**New Fields Added to `face_matches` table:**
- `confirmed` (BOOLEAN) - Whether match was manually confirmed
- `confirmed_by` (INTEGER) - User ID who confirmed the match
- `confirmed_at` (TIMESTAMPTZ) - When match was confirmed
- `person_id` (INTEGER) - Fixed column name inconsistency
- `job_id` (INTEGER) - Fixed column name inconsistency

**Database Trigger:**
- Auto-updates `found_timestamp` when status changes to 'FOUND'

### 2. Backend Logic Updates

#### **Face Match Controller** (`backend/controllers/facematch.controller.js`)
**Changes:**
- Automatic status transition when face is detected
- Prevents duplicate matches (idempotent)
- Emits real-time Socket.io event `person:found`
- Stores frame reference in `matched_frame_id`

**Logic Flow:**
```
Face detected → Check for existing match → Insert face_match record
→ Update person status to 'FOUND' → Set found_timestamp & matched_frame_id
→ Emit Socket.io event 'person:found'
```

#### **Person Controller** (`backend/controllers/person.controller.js`)
**Changes:**
- Added status filtering: `GET /api/persons?status=active`
- Supports multiple statuses: `GET /api/persons?status=active,found`
- Returns additional fields: `matched_frame_id`, `last_matched_at`

### 3. Real-Time Socket.IO Integration

**Event:** `person:found`

**Payload:**
```javascript
{
  personId: number,
  personName: string,
  jobId: number,
  frameNumber: number,
  confidence: number,
  matchId: number,
  frameId: string,        // e.g., "job_123_frame_456"
  timestamp: string,      // ISO 8601
  confirmedBy?: number    // Only if manually confirmed
}
```

**Server Setup:** (`backend/server.js`)
- Socket.io instance injected into facematch controller
- Event emitted automatically on match detection

### 4. Frontend Real-Time Updates

**File:** `frontend_v2/src/pages/MissingPersons.tsx`

**Changes:**
- Listens for `person:found` Socket.io event
- Automatically updates person list when event received
- Shows toast notification with match details
- No manual "Mark as Found" button required

**User Experience:**
1. User uploads video
2. Video processing detects face
3. **Instant notification:** "🎉 John Doe has been found!"
4. Person card automatically updates to "FOUND" status
5. No page refresh required

---

## 🔧 Technical Details

### Idempotency
Duplicate matches are prevented by checking:
```sql
SELECT id FROM face_matches 
WHERE person_id = $1 AND job_id = $2 AND frame_number = $3
```

If match exists, skip processing.

### Status Transitions
```
ACTIVE → FOUND (automatic, on face detection)
POSSIBLE_MATCH → FOUND (automatic, on face detection)
FOUND → stays FOUND (immutable)
INACTIVE → no transitions
```

### Database Consistency
- `found_timestamp` automatically set by trigger
- `matched_frame_id` stores `job_{jobId}_frame_{frameNum}`
- `last_matched_at` tracks most recent detection

---

## 📡 API Changes

### GET /api/persons
**Query Parameters (NEW):**
- `status` - Filter by status (comma-separated)

**Examples:**
```bash
# Get only active persons
GET /api/persons?status=active

# Get active and possible matches
GET /api/persons?status=active,possible_match

# Get only found persons
GET /api/persons?status=found

# Get all (excluding inactive)
GET /api/persons
```

**Response Fields (NEW):**
```json
{
  "persons": [
    {
      "id": 1,
      "name": "John Doe",
      "status": "FOUND",
      "matched_frame_id": "job_123_frame_456",
      "last_matched_at": "2026-04-07T18:00:00Z",
      "found_timestamp": "2026-04-07T18:00:00Z"
    }
  ]
}
```

---

## 🧪 Testing

### Test 1: Automatic Detection
**Steps:**
1. Register a missing person with photo
2. Upload video containing that person
3. Wait for processing to complete

**Expected:**
- ✅ Person status automatically changes to 'FOUND'
- ✅ Toast notification appears
- ✅ Person card updates in real-time
- ✅ No manual action required

### Test 2: Real-Time Updates
**Steps:**
1. Open MissingPersons page in Browser Tab 1
2. Open another browser tab or device
3. Upload and process video that matches a person

**Expected:**
- ✅ Tab 1 receives Socket.io event
- ✅ Person status updates automatically in Tab 1
- ✅ Toast notification shown in Tab 1
- ✅ No page refresh needed

### Test 3: Idempotency
**Steps:**
1. Process video that matches person "John Doe"
2. Person marked as FOUND
3. Process SAME video again

**Expected:**
- ✅ Duplicate match NOT created
- ✅ Person remains FOUND
- ✅ No duplicate Socket.io events
- ✅ Database has only one match record

### Test 4: Status Filtering
**Steps:**
```bash
# In browser console or API testing tool
fetch('/api/persons?status=active')
fetch('/api/persons?status=found')
fetch('/api/persons?status=active,possible_match')
```

**Expected:**
- ✅ Returns only persons with specified status
- ✅ Multiple statuses work (comma-separated)
- ✅ Returns all fields including matched_frame_id

---

## 🚀 Deployment Instructions

### 1. Run Database Migration
```bash
cd backend
psql -U postgres -d missing_persons -f auto_state_transition_migration.sql
```

**Verify migration:**
```sql
-- Check new columns exist
\d missing_persons
\d face_matches

-- Check trigger exists
\df update_found_timestamp
```

### 2. Restart Backend
```bash
cd backend
npm start
```

**Verify logs:**
- ✅ "Socket.io instance registered in facematch controller"
- ✅ "Socket.io initialized on /events namespace"

### 3. Rebuild Frontend
```bash
cd frontend_v2
npm run build
```

### 4. Test End-to-End
1. Login to app
2. Register missing person with photo
3. Upload video
4. Watch for real-time notification

---

## 📊 Database Schema Changes

### Before
```sql
CREATE TABLE missing_persons (
    id SERIAL PRIMARY KEY,
    name VARCHAR(255),
    status VARCHAR(20),
    found_timestamp TIMESTAMPTZ
);
```

### After
```sql
CREATE TABLE missing_persons (
    id SERIAL PRIMARY KEY,
    name VARCHAR(255),
    status VARCHAR(20),
    found_timestamp TIMESTAMPTZ,
    matched_frame_id TEXT,              -- NEW
    last_matched_at TIMESTAMPTZ         -- NEW
);
```

### Before
```sql
CREATE TABLE face_matches (
    id SERIAL PRIMARY KEY,
    video_job_id INTEGER,
    missing_person_id INTEGER,
    confidence DECIMAL(5,4),
    frame_number INTEGER
);
```

### After
```sql
CREATE TABLE face_matches (
    id SERIAL PRIMARY KEY,
    video_job_id INTEGER,
    missing_person_id INTEGER,
    job_id INTEGER,                     -- NEW (alias)
    person_id INTEGER,                  -- NEW (alias)
    confidence DECIMAL(5,4),
    frame_number INTEGER,
    confirmed BOOLEAN DEFAULT false,    -- NEW
    confirmed_by INTEGER,               -- NEW
    confirmed_at TIMESTAMPTZ            -- NEW
);
```

---

## 🔍 Debugging

### Check Socket.io Events
**Frontend Console:**
```javascript
// Listen for all events
socket.onAny((event, ...args) => {
  console.log('Socket event:', event, args);
});
```

### Check Database State
```sql
-- Check person status
SELECT id, name, status, matched_frame_id, found_timestamp 
FROM missing_persons 
WHERE status = 'FOUND';

-- Check face matches
SELECT fm.id, fm.person_id, fm.job_id, fm.frame_number, 
       fm.confidence, mp.name
FROM face_matches fm
JOIN missing_persons mp ON fm.person_id = mp.id
ORDER BY fm.id DESC
LIMIT 10;
```

### Check Backend Logs
```bash
# Look for these messages:
grep "AUTO TRANSITION" backend/output.log
grep "Socket.io event emitted" backend/output.log
grep "person:found" backend/output.log
```

---

## ⚠️ Important Notes

### Backend is Single Source of Truth
- ✅ Status transitions happen ONLY in backend
- ✅ Frontend cannot manually mark as "FOUND" (removed button)
- ✅ All state changes triggered by video pipeline

### Manual Confirmation Still Available
- Endpoint: `PUT /api/facematch/:matchId/confirm`
- Use case: When match is flagged as POSSIBLE_MATCH
- After confirmation, status changes to FOUND

### Status Flow
```
Register → ACTIVE
  ↓
Face detected → FOUND (automatic)
  ↓
Stay FOUND (immutable)
```

---

## 📁 Files Modified

| File | Changes |
|------|---------|
| `backend/auto_state_transition_migration.sql` | Database migration script |
| `backend/controllers/facematch.controller.js` | Auto-transition logic + Socket.io |
| `backend/controllers/person.controller.js` | Status filtering |
| `backend/server.js` | Socket.io injection |
| `backend/socket.js` | Event documentation |
| `frontend_v2/src/pages/MissingPersons.tsx` | Real-time listener |

---

## ✅ Success Criteria

| Criteria | Status |
|----------|--------|
| Automatic state transition on detection | ✅ Implemented |
| No dependency on frontend button clicks | ✅ Removed |
| Real-time Socket.io event emission | ✅ Implemented |
| Frontend listens and updates UI | ✅ Implemented |
| Status filtering API | ✅ Implemented |
| Idempotency (no duplicates) | ✅ Implemented |
| Database trigger for found_timestamp | ✅ Implemented |
| Backward compatibility | ✅ Maintained |

---

## 🎉 Summary

The system now automatically transitions missing persons to "FOUND" status when detected in videos. The backend is the single source of truth, and all clients receive real-time updates via Socket.io. No manual intervention required!

**User Experience:**
1. Upload video → 2. Face detected → 3. Instant notification → 4. Person marked FOUND ✅

*Last Updated: 2026-04-07*  
*Version: 1.0*  
*Status: ✅ COMPLETE*
