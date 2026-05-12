# Auth/Session Logout Fix - Quick Reference

## 🔥 The Problem
Users being logged out automatically after ~8 hours or during video processing.

## ✅ The Solution
Implemented **automatic token refresh** every 6 hours + extended dev tokens to 30 days.

---

## 📁 Changed Files (4 total)

### Backend (2 files)
```
backend/middleware/auth.js         → Added refreshToken() + 30-day dev expiry
backend/routes/auth.routes.js      → Added POST /api/auth/refresh route
```

### Frontend (1 file)
```
frontend_v2/src/context/AuthContext.tsx → Auto-refresh every 6h, better 401 handling
```

### Python (1 file)
```
src/crowd_detection/testSimple.py → Enhanced codec fallback (MP4→AVI)
```

---

## 🚀 Quick Deploy

```bash
# 1. Build frontend
cd frontend_v2
npm run build

# 2. Restart backend
cd ../backend
npm start

# 3. Test login
# - Login to app
# - Wait 30 minutes
# - Should still be logged in ✅
```

---

## 🧪 Quick Test

### Test 1: Token Persists
```bash
1. Login to app
2. Wait 30 minutes
3. Refresh page
✅ Should still be logged in
```

### Test 2: Socket Disconnect OK
```bash
1. Login to app
2. Stop backend (Ctrl+C)
3. Check console
✅ Should show disconnect but NOT logout
```

### Test 3: Auto-Refresh Works
```bash
1. Login to app
2. Open DevTools → Application → Local Storage
3. Copy authToken value
4. Wait 6 hours (or modify refreshInterval to 30s for testing)
5. Check authToken value again
✅ Should be different (refreshed)
```

---

## 🔍 Debugging

### User Still Logging Out?
```bash
# Check 1: Browser console
# Look for: "Token refreshed successfully"
# If missing: refresh not working

# Check 2: Backend logs
# Look for: POST /api/auth/refresh
# If missing: endpoint not being called

# Check 3: LocalStorage
# DevTools → Application → Local Storage → authToken
# If empty: token was cleared (check for 401 errors)

# Check 4: Network tab
# Filter: /auth/refresh
# Status should be: 200 OK
# If 401: token is invalid
```

### PostgreSQL Connection Spam?
```bash
# Check backend console during startup:
# Should see: "✅ PostgreSQL pool ready" ONCE
# Should NOT see: repeated "PostgreSQL connected" messages
```

### Video Codec Errors?
```bash
# Check backend console during video processing:
# Should see: "INFO: Using codec avc1/H264/mp4v"
# OR: "INFO: Using XVID codec (AVI format)"
# Should NOT see: "Failed to load OpenH264"
```

---

## 📊 Status Check

Run this checklist to verify fix is working:

| Check | Expected | Status |
|-------|----------|--------|
| Login works | ✅ Redirects to dashboard | ☐ |
| Token in LocalStorage | ✅ Present after login | ☐ |
| 30 min session | ✅ Still logged in | ☐ |
| Socket disconnect | ✅ No logout | ☐ |
| Video processing | ✅ No logout | ☐ |
| Browser refresh | ✅ Still logged in | ☐ |

---

## 🐛 Common Issues

### Issue: TypeScript Build Errors
**Symptom:** `npm run build` fails  
**Fix:** Check for TypeScript errors in AuthContext.tsx  
**Status:** Fixed (NodeJS.Timeout → ReturnType<typeof setInterval>)

### Issue: Token Not Refreshing
**Symptom:** User logged out after 8 hours (or 30 days in dev)  
**Cause:** Auto-refresh not running  
**Fix:** Check console for "Token refreshed successfully" messages  
**Debug:** Verify `/api/auth/refresh` endpoint returns 200 OK

### Issue: User Logged Out on Network Error
**Symptom:** Temporary network issue logs out user  
**Cause:** 401 handling too aggressive  
**Fix:** Already implemented - only logout on 401, not on 500/network errors  
**Verify:** Stop backend, try upload → should show error but NOT logout

---

## 💡 Key Points

### Token Expiry
- **Dev:** 30 days (NODE_ENV=development)
- **Prod:** 8 hours (NODE_ENV=production)

### Auto-Refresh
- **Interval:** 6 hours
- **Trigger:** Runs in background while user logged in
- **Failure:** Only logout on 401, keep session on other errors

### Socket.io
- **Reconnection:** Infinite attempts
- **Disconnect:** Never triggers logout
- **Already correct:** No changes needed

### Error Handling
- **401 (Unauthorized):** Logout user
- **500 (Server Error):** Keep session
- **Network timeout:** Keep session

---

## 📞 Need Help?

### Read These First:
1. `AUTH_FIX_SUMMARY.md` - High-level overview
2. `AUTH_LOGOUT_FIXES.md` - Technical details
3. `TESTING_CHECKLIST_AUTH.md` - Detailed test steps

### Still Stuck?
Check these files for implementation:
- `backend/middleware/auth.js` - Token refresh logic
- `frontend_v2/src/context/AuthContext.tsx` - Auto-refresh implementation
- `backend/routes/auth.routes.js` - API endpoint

---

## ✅ Success Criteria

All must be TRUE:
- [ ] Login → stay logged in 30+ minutes
- [ ] Upload video → no logout during processing
- [ ] Socket disconnect → no logout
- [ ] Browser refresh → stay logged in
- [ ] Network error → no logout (error shown instead)
- [ ] Token auto-refreshes every 6 hours
- [ ] No "PostgreSQL connected" spam in logs
- [ ] No OpenH264 errors in Python output

---

*Last Updated: 2026-04-07*  
*Version: 1.0*  
*Status: ✅ COMPLETE*
