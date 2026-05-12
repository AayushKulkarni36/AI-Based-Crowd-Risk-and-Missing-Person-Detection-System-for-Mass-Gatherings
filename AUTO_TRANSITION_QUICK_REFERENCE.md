# Auto State Transition - Quick Reference

## 🎯 What Changed

**Before:** Manual button click required to mark person as "FOUND"  
**After:** Automatic transition when face detected in video

---

## 🚀 Quick Deploy

```bash
# 1. Run migration
cd backend
psql -U postgres -d missing_persons -f auto_state_transition_migration.sql

# 2. Restart backend
npm start

# 3. Rebuild frontend
cd ../frontend_v2
npm run build
```

---

## 📊 Flow Diagram

```
Video Upload → Face Detection → Match Found
                                    ↓
                    ┌───────────────┴─────────────────┐
                    ↓                                 ↓
            DB: Status='FOUND'              Socket.io Event
            found_timestamp=NOW             'person:found'
            matched_frame_id set                    ↓
                                          Frontend Updates
                                          Toast Notification
```

---

## 🔧 New API Features

### Status Filtering
```bash
GET /api/persons?status=active        # Only active
GET /api/persons?status=found         # Only found
GET /api/persons?status=active,found  # Multiple
```

### New Response Fields
```json
{
  "matched_frame_id": "job_123_frame_456",
  "last_matched_at": "2026-04-07T18:00:00Z"
}
```

---

## 📡 Socket.IO Event

**Event Name:** `person:found`

**Payload:**
```javascript
{
  personId: 1,
  personName: "John Doe",
  jobId: 123,
  frameNumber: 456,
  confidence: 0.95,
  matchId: 789,
  frameId: "job_123_frame_456",
  timestamp: "2026-04-07T18:00:00Z"
}
```

**Frontend Listener:**
```typescript
socket.on('person:found', (data) => {
  // Update person status
  // Show toast notification
});
```

---

## 🧪 Quick Test

### Test Auto-Detection
1. Register person with photo
2. Upload video with that person
3. Wait for processing
4. **Expected:** Status → FOUND automatically ✅

### Test Real-Time
1. Open MissingPersons page
2. In another tab: upload/process video
3. **Expected:** Instant notification + status update ✅

### Test Filtering
```bash
curl http://localhost:5000/api/persons?status=active
curl http://localhost:5000/api/persons?status=found
```

---

## 🔍 Debug Checklist

| Check | Command/Action |
|-------|---------------|
| Migration ran | `\d missing_persons` in psql |
| Trigger exists | `\df update_found_timestamp` |
| Socket.io injected | Check backend logs for "Socket.io instance registered" |
| Frontend listens | Check browser console for "Person found event" |

---

## ⚠️ Important

### Backend = Source of Truth
- ✅ Status transitions happen ONLY in backend
- ✅ Frontend listens and updates UI
- ✅ No manual "Mark as Found" needed

### Idempotency
- ✅ Same person detected twice → Only one match created
- ✅ Status doesn't change if already FOUND

### Status Flow
```
ACTIVE → FOUND (automatic on detection)
POSSIBLE_MATCH → FOUND (automatic on detection)
FOUND → stays FOUND (immutable)
```

---

## 📁 Modified Files

**Backend:**
- `auto_state_transition_migration.sql` - DB migration
- `controllers/facematch.controller.js` - Auto-transition logic
- `controllers/person.controller.js` - Status filtering
- `server.js` - Socket.io injection

**Frontend:**
- `pages/MissingPersons.tsx` - Real-time listener

---

## ✅ Success Criteria

- [x] Auto-transition on detection
- [x] No manual button needed
- [x] Real-time Socket.io events
- [x] Frontend updates automatically
- [x] Status filtering API
- [x] Idempotency implemented
- [x] Database trigger working

---

*Full docs: AUTO_STATE_TRANSITION_IMPLEMENTATION.md*  
*Last Updated: 2026-04-07*  
*Status: ✅ COMPLETE*
