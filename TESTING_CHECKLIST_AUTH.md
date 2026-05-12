# Auth/Session Fix Testing Checklist

## Pre-Testing Setup

### 1. Verify Build Status
```bash
cd C:\Users\ayush\FinalYearProject\frontend_v2
npm run build
```
**Expected:** Build succeeds with no TypeScript errors

### 2. Start Backend Server
```bash
cd C:\Users\ayush\FinalYearProject\backend
npm start
```
**Expected:** 
- "✅ Backend running on http://localhost:5000"
- "✅ PostgreSQL pool ready" (only ONCE, not 10x)
- "📡 Socket.io listening on /events namespace"

### 3. Start Frontend Dev Server
```bash
cd C:\Users\ayush\FinalYearProject\frontend_v2
npm run dev
```
**Expected:** Frontend running on http://localhost:5173

---

## Test Suite

### ✅ Test 1: Basic Login and Session Persistence
**Steps:**
1. Open browser to http://localhost:5173
2. Login with valid credentials
3. Navigate to dashboard
4. Open DevTools → Console
5. Check for Socket.io connection messages

**Expected Results:**
- ✅ User successfully logged in
- ✅ Redirected to dashboard
- ✅ Console shows: `[Socket] Connected: <socket-id>`
- ✅ No error messages in console
- ✅ Token stored in LocalStorage (DevTools → Application → Local Storage)

**Pass/Fail:** _______

---

### ✅ Test 2: Token Auto-Refresh (Short Interval Test)
**Purpose:** Verify token refresh works without logging out user

**Setup Modification:** 
Temporarily modify `frontend_v2/src/context/AuthContext.tsx`:
```typescript
// Change refresh interval from 6 hours to 30 seconds for testing
const refreshInterval = 30 * 1000; // 30 seconds (was: 6 * 60 * 60 * 1000)
```

**Steps:**
1. Login to the app
2. Stay on dashboard
3. Wait 30 seconds
4. Check browser console for refresh messages
5. Open DevTools → Application → Local Storage → authToken
6. Copy the token value
7. Wait another 30 seconds
8. Check if token value changed

**Expected Results:**
- ✅ After 30 seconds: "Token refreshed successfully" in console
- ✅ Token value in LocalStorage changes
- ✅ User remains logged in
- ✅ Dashboard still loads data
- ✅ No logout or redirect to login page

**Pass/Fail:** _______

**Cleanup:** Revert the refresh interval back to 6 hours after test

---

### ✅ Test 3: Socket.io Disconnect Does NOT Trigger Logout
**Steps:**
1. Login to the app
2. Stay on dashboard
3. Open DevTools → Console
4. Stop the backend server (Ctrl+C in backend terminal)
5. Wait 5 seconds
6. Check console messages
7. Check if user is still on dashboard

**Expected Results:**
- ✅ Console shows: `[Socket] Disconnected: <reason>`
- ✅ User **NOT** redirected to login page
- ✅ User stays on dashboard
- ✅ Token still in LocalStorage
- ✅ Socket shows "Reconnection attempt..." messages

**Pass/Fail:** _______

**Cleanup:** Restart backend server

---

### ✅ Test 4: Socket.io Auto-Reconnect
**Steps:**
1. Login to the app
2. Stay on dashboard
3. Stop backend server
4. Wait 5 seconds (should see disconnect)
5. Restart backend server
6. Wait 10 seconds
7. Check console messages

**Expected Results:**
- ✅ Console shows: `[Socket] Disconnected: <reason>`
- ✅ Console shows: `[Socket] Reconnection attempt...`
- ✅ Console shows: `[Socket] Connected: <socket-id>`
- ✅ User never logged out during disconnect/reconnect cycle
- ✅ Dashboard functionality restored after reconnect

**Pass/Fail:** _______

---

### ✅ Test 5: Network Error Does NOT Logout User
**Steps:**
1. Login to the app
2. Stay on dashboard
3. Stop backend server
4. Try to upload a video (will fail due to no backend)
5. Check if user is logged out

**Expected Results:**
- ✅ Upload fails with error message (network/server error)
- ✅ User **NOT** logged out
- ✅ User stays on dashboard
- ✅ Token still in LocalStorage
- ✅ After restarting backend, user can retry upload without re-login

**Pass/Fail:** _______

---

### ✅ Test 6: Invalid Token (401) Does Trigger Logout
**Steps:**
1. Login to the app
2. Stay on dashboard
3. Open DevTools → Application → Local Storage
4. Modify the `authToken` value (corrupt it by adding "INVALID" at the end)
5. Refresh the page or navigate to another page

**Expected Results:**
- ✅ User redirected to login page
- ✅ Token removed from LocalStorage
- ✅ Message shown: "Session expired" or similar

**Pass/Fail:** _______

---

### ✅ Test 7: Video Upload and Processing (Session Persistence)
**Steps:**
1. Login to the app
2. Navigate to Video Upload page
3. Upload a test video
4. Wait for processing to complete (watch progress)
5. View results
6. Check if user is still logged in

**Expected Results:**
- ✅ Video uploads successfully
- ✅ Processing progress shown via Socket.io
- ✅ User stays logged in throughout upload and processing
- ✅ Results displayed successfully
- ✅ Output video available (MP4 or AVI format)
- ✅ No logout during or after processing

**Pass/Fail:** _______

---

### ✅ Test 8: Video Codec Fallback (Python Script)
**Steps:**
1. Process a video through the system
2. Check backend console/logs for codec messages
3. Verify output video file exists

**Expected Results:**
- ✅ Console shows: "INFO: Using codec avc1/H264/mp4v for output video"
- ✅ OR: "INFO: MP4 codecs failed, trying AVI format..."
- ✅ OR: "INFO: Using XVID codec (AVI format)"
- ✅ **NO** "Failed to load OpenH264 library" error
- ✅ Output video file exists in `data/results/` directory
- ✅ File extension is .mp4 or .avi (depending on codec)

**Pass/Fail:** _______

---

### ✅ Test 9: PostgreSQL Connection Pool (No Spam)
**Steps:**
1. Restart backend server
2. Check console output during startup
3. Make 5-10 API calls (navigate pages, upload video, view stats)
4. Check console output

**Expected Results:**
- ✅ On startup: "✅ PostgreSQL pool ready" appears **ONCE**
- ✅ During API calls: **NO** repeated "PostgreSQL connected" messages
- ✅ Only one database pool created and reused

**Pass/Fail:** _______

---

### ✅ Test 10: 30+ Minute Session Persistence
**Steps:**
1. Login to the app
2. Stay on dashboard (or minimize browser)
3. Wait 30 minutes
4. Return to browser
5. Navigate to different pages (Stats, Video Upload, Missing Persons)

**Expected Results:**
- ✅ User still logged in after 30 minutes
- ✅ All pages load successfully
- ✅ Socket.io still connected
- ✅ No redirect to login page
- ✅ Token still in LocalStorage

**Pass/Fail:** _______

---

### ✅ Test 11: Browser Refresh Preserves Session
**Steps:**
1. Login to the app
2. Navigate to any page (e.g., Dashboard)
3. Press F5 or Ctrl+R to refresh
4. Check if user is still logged in

**Expected Results:**
- ✅ Page refreshes
- ✅ User still logged in
- ✅ Same page shown (not redirected to login)
- ✅ Token validated successfully from LocalStorage

**Pass/Fail:** _______

---

### ✅ Test 12: Multiple Tab Session Sharing
**Steps:**
1. Login in Tab 1
2. Open Tab 2 to the same app (http://localhost:5173)
3. Check if Tab 2 is also logged in
4. Logout in Tab 1
5. Refresh Tab 2

**Expected Results:**
- ✅ Tab 2 automatically logged in (token in shared LocalStorage)
- ✅ After logout in Tab 1, Tab 2 still shows logged-in state (until refresh)
- ✅ After refresh, Tab 2 redirects to login (token removed)

**Pass/Fail:** _______

---

### ✅ Test 13: No Logout in Socket Event Handlers
**Manual Code Inspection:**
```bash
cd C:\Users\ayush\FinalYearProject\frontend_v2\src
grep -r "logout()" --include="*.ts" --include="*.tsx" | grep -i "socket"
```

**Expected Results:**
- ✅ Command returns **ZERO** results
- ✅ No `logout()` calls inside socket event handlers
- ✅ `disconnect`, `connect_error`, `error` events do NOT call logout

**Pass/Fail:** _______

---

## Summary Checklist

| Test | Status | Notes |
|------|--------|-------|
| 1. Basic Login | ☐ Pass ☐ Fail | |
| 2. Token Auto-Refresh | ☐ Pass ☐ Fail | |
| 3. Socket Disconnect No Logout | ☐ Pass ☐ Fail | |
| 4. Socket Auto-Reconnect | ☐ Pass ☐ Fail | |
| 5. Network Error No Logout | ☐ Pass ☐ Fail | |
| 6. Invalid Token (401) Logout | ☐ Pass ☐ Fail | |
| 7. Video Upload Session | ☐ Pass ☐ Fail | |
| 8. Video Codec Fallback | ☐ Pass ☐ Fail | |
| 9. PostgreSQL No Spam | ☐ Pass ☐ Fail | |
| 10. 30+ Min Session | ☐ Pass ☐ Fail | |
| 11. Browser Refresh | ☐ Pass ☐ Fail | |
| 12. Multiple Tabs | ☐ Pass ☐ Fail | |
| 13. No Logout in Socket | ☐ Pass ☐ Fail | |

**Overall Status:** ☐ All Tests Passed ☐ Some Tests Failed

---

## Known Issues / Notes
_Add any observations, errors, or unexpected behavior here:_

---

## Environment Information
- OS: Windows
- Node Version: _______
- PostgreSQL Version: _______
- Python Version: _______
- Browser: _______
- Date Tested: _______
- Tester: _______
