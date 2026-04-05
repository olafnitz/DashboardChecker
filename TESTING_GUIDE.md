# Dashboard Checker - Testing Guide

## Architecture Overview

### Authentication Flow
1. **Client-side (Browser)**
   - User signs in via `/auth` page
   - Supabase stores session in localStorage (as `sb-{project-id}-auth.json`)
   - Session contains `access_token` and user `id`

2. **Network Request**
   - Client calls `/api/checks` endpoint
   - Extracts `access_token` from Supabase session
   - Sends as `Authorization: Bearer {token}` header
   - Also sends `credentials: 'include'` for cookie fallback

3. **Server-side (API Route)**
   - Receives request with Authorization header
   - **Method 1**: Parses Bearer token and verifies via Supabase
   - **Method 2**: Fallback to parsing `sb-*-auth-token` cookie
   - Extracts user ID from verified session
   - Uses Service Role Key to bypass RLS and verify dashboard ownership
   - Runs Playwright check && stores results

### Security Measures
- ✅ RLS (Row Level Security) - Users only see their own dashboards
- ✅ Authorization header verification - API verifies auth token
- ✅ User ownership check - Service role verifies dashboard belongs to user
- ✅ 401 responses - Unauthenticated requests rejected
- ✅ No hardcoded secrets - Service role key only in server environment

## API Endpoints

### POST /api/checks
Triggers a manual dashboard check.

**Authentication Required**: YES (Bearer token or cookie)

**Request**:
```json
{
  "dashboardId": "uuid"
}
```

**Response (Success - 200)**:
```json
{
  "success": true,
  "result": {
    "checkId": "uuid",
    "status": "ok",
    "timestamp": "2026-04-04T17:00:00Z",
    "pageResults": [...]
  }
}
```

**Response (Unauthorized - 401)**:
```json
{
  "error": "Unauthorized - No session found"
}
```

### GET /api/dashboards
Lists user's dashboards.

**Authentication Required**: YES (Bearer token or cookie)

**Response (Unauthorized - 401)**:
```json
{
  "error": "Unauthorized"
}
```

## Manual Test Steps

### 1. Sign Up
1. Go to http://localhost:3000
2. Click navigation link to go to `/auth`
3. Click "Sign Up"
4. Enter email: `test@example.com`
5. Enter password: `TestPassword123!`
6. Submit form
7. ✅ Expect: Redirected to dashboard list (may be empty)

### 2. Create Dashboard
1. Click "New Dashboard" button
2. Enter name: `Test Dashboard`
3. Enter URL: `https://lookerstu...` (any Looker URL)
4. Click "Create Dashboard"
5. ✅ Expect: Dashboard created and listed

### 3. Trigger Manual Check (THE CRITICAL TEST)
1. Click on the dashboard to view details
2. Look for "Check Now" button (green, with refresh icon)
3. Click "Check Now" button
4. ✅ **Expected Result**:
   - Button shows spinning icon (loading)
   - No 401 error in browser console
   - Message displays: "✅ Check completed successfully!"
   - Check results appear below

### 4. Verify Authorization Header Sent
1. Open Browser DevTools (F12)
2. Go to Network tab
3. Click "Check Now" again
4. Find the POST request to `api/checks`
5. Click it and go to Headers tab
6. ✅ Verify in Request Headers:
   - `Authorization: Bearer eyJhbGc...` (actual token)
   - `Content-Type: application/json`

## Debugging Guide

### Issue: "Check failed: Unauthorized - No session found"

**Symptoms**:
- Red error message on dashboard page
- Browser console shows status 401
- ❌ Button click fails

**Causes & Solutions**:
1. **Not logged in**
   - Go to `/auth` and sign in first
   
2. **Session expired**
   - Sign out and sign back in
   
3. **Authorization header not sent**
   - Open DevTools → Network tab
   - Check Request Headers for `Authorization: Bearer`
   - If missing, check browser localStorage for `sb-*-auth.json`
   
4. **Invalid token**
   - Clear localStorage and sign in again
   - Look for error message: "This endpoint requires a valid Bearer token"

### Issue: No error but check doesn't complete

**Symptoms**:
- Loading spinner keeps spinning
- No error message appears

**Causes**:
1. Dashboard URL invalid - Playwright can't load it
2. Network timeout - Check takes too long
3. Server error - Check server logs for details

**Solution**:
1. Open browser console (F12)
2. Look for actual error message
3. Check terminal logs where `npm run dev` is running

### Issue: 500 Internal Server Error

**Symptoms**:
- API returns 500 error
- Server logs show stack trace

**Causes**:
1. Playwright crash - Check failed to load dashboard
2. Database error - Problem storing results
3. Missing environment variable

**Solution**:
```bash
# Check environment variables are set
cat .env.local

# Look for errors in dev server terminal
# Restart dev server with clean cache
pkill -f "npm run dev"
rm -rf .next node_modules/.cache
npm run dev
```

## API Testing via curl

### Test unauthenticated request (should fail with 401)
```bash
curl -X POST http://localhost:3000/api/checks \
  -H "Content-Type: application/json" \
  -d '{"dashboardId":"test-id"}'
```

### Test with valid Bearer token
```bash
TARGET_USER_TOKEN="eyJhbGc..."  # From browser session
curl -X POST http://localhost:3000/api/checks \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer $TARGET_USER_TOKEN" \
  -d '{"dashboardId":"actual-dashboard-uuid"}'
```

## Success Criteria

✅ **Complete when all conditions met**:
- [ ] Homepage loads at http://localhost:3000
- [ ] Auth page loads at http://localhost:3000/auth
- [ ] Can sign up and create account
- [ ] Can sign in with credentials
- [ ] Dashboard list shows after login
- [ ] Can create new dashboard
- [ ] "Check Now" button exists on dashboard page
- [ ] Click "Check Now" returns 200 (not 401)
- [ ] Check results display successfully
- [ ] No errors in browser console
- [ ] Authorization header visible in Network tab

## Architecture Diagram

```
┌─────────────────────────────────────────────────────────────┐
│                       Browser                                 │
├─────────────────────────────────────────────────────────────┤
│                                                               │
│  1. User signs in at /auth                                   │
│  2. Supabase stores session in localStorage                  │
│  3. localStorage: {"access_token": "...", "user": {...}}    │
│                                                               │
│  4. User clicks "Check Now" button                           │
│  5. Client queries supabase.auth.getSession()                │
│  6. Extracts access_token from session                       │
│  7. Sends POST /api/checks with:                             │
│     - Authorization: Bearer {access_token}                   │
│     - credentials: include (for cookie fallback)             │
│                                                               │
└─────────────────────────────────────────────────────────────┘
                              ↓
                    Network Request → Server
                              ↓
┌─────────────────────────────────────────────────────────────┐
│                    API Route: /api/checks                     │
├─────────────────────────────────────────────────────────────┤
│                                                               │
│  1. Check Authorization header for Bearer token             │
│  2. Fallback to parsing cookies if no header                │
│  3. Create Supabase client with token                       │
│  4. Call supabase.auth.getUser() to verify                  │
│  5. Extract user.id from verified session                   │
│                                                               │
│  6. Parse request body for dashboardId                      │
│  7. Create service-role Supabase client                      │
│  8. Query: SELECT * FROM dashboards                          │
│     WHERE id = ? AND user_id = ?                             │
│  9. Verify dashboard ownership                              │
│                                                               │
│  10. Execute Playwright check on dashboard.url              │
│  11. Store results in check_results table                    │
│  12. Return success response with checkId                    │
│                                                               │
│  ❌ If any step fails:                                        │
│     - Step 1-5: Return 401 Unauthorized                      │
│     - Step 6-9: Return 404 Not Found                         │
│     - Step 10-11: Return 500 Server Error                    │
│                                                               │
└─────────────────────────────────────────────────────────────┘
```

