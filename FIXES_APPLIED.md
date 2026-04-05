# Dashboard Checker - Fixes Applied (April 4, 2026)

## Issue Summary
The "Check Now" button was returning `401 Unauthorized` errors even when users were logged in. The root cause was that Supabase stores the session in browser localStorage, not in HTTP cookies, so the API route wasn't receiving the authentication token.

## Root Cause Analysis
- Supabase auth session stored in: `localStorage['sb-{project-id}-auth.json']`
- API route expected auth in: HTTP Cookie headers
- Mismatch: localStorage ≠ HTTP Cookies
- Solution: Send token as `Authorization: Bearer` header instead

## Files Modified

### 1. `app/dashboards/[id]/page.tsx` ✅
**Problem**: Not sending authentication token to API
**Fix**: 
- Import `HeadersInit` type for TypeScript
- Get current session: `supabase.auth.getSession()`
- Extract access token: `session.access_token`
- Send as Authorization header: `Authorization: Bearer {token}`
- Maintain credentials: 'include' for cookie fallback

**Code Change**:
```typescript
// BEFORE
const response = await fetch('/api/checks', {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  credentials: 'include',
  body: JSON.stringify({ dashboardId }),
})

// AFTER
const { data: { session }, error: sessionError } = await supabase.auth.getSession()
if (sessionError || !session) {
  throw new Error('No active session. Please sign in and try again.')
}

const headers: HeadersInit = { 'Content-Type': 'application/json' }
if (session.access_token) {
  headers['Authorization'] = `Bearer ${session.access_token}`
}

const response = await fetch('/api/checks', {
  method: 'POST',
  headers,
  credentials: 'include',
  body: JSON.stringify({ dashboardId }),
})
```

### 2. `app/api/checks/route.ts` ✅
**Problem**: Not handling Authorization Bearer tokens
**Fix**:
- Check Authorization header first: `Bearer` prefix
- Create Supabase client with token
- Verify token via `supabase.auth.getUser()`
- Fallback to cookie parsing if no header
- Extract user from both methods

**Key Logic**:
```typescript
// Method 1: Authorization Header
const authHeader = request.headers.get('authorization')
if (authHeader && authHeader.startsWith('Bearer ')) {
  const token = authHeader.substring(7)
  
  // Verify token using Supabase
  const supabase = createClient(supabaseUrl, supabaseAnonKey, {
    global: { headers: { authorization: authHeader } }
  })
  
  const { data: { user: tokenUser } } = await supabase.auth.getUser()
  user = tokenUser  // ✅ Token verified
}

// Method 2: Cookie Fallback
if (!user) {
  // Parse sb-*-auth-token cookie...
}
```

### 3. `lib/checks/resultProcessor.ts` ✅
**Problem**: Imported non-existent `supabaseAdmin` export
**Fix**:
- Remove dependency on `supabaseAdmin` export
- Accept `adminClient` parameter (passed from API route)
- Create new service-role client if not provided
- Proper error handling for missing config

**Code**:
```typescript
export async function processCheckResult(
  dashboardId: string,
  checkResult: DashboardCheckResult,
  adminClient?: any
): Promise<ProcessedCheckResult> {
  let client = adminClient
  
  if (!client) {
    const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL
    const supabaseServiceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY
    
    if (!supabaseUrl || !supabaseServiceRoleKey) {
      throw new Error('Supabase configuration missing')
    }
    
    client = createClient(supabaseUrl, supabaseServiceRoleKey)
  }
  
  // ... rest of function
}
```

### 4. `lib/supabase/client.ts` ✅  
**Problem**: Multiple GoTrueClient instances during hot reload
**Fix**:
- Use module-level singleton (not globalThis)
- Initialize immediately on load (not lazy)
- Lock instance to prevent re-creation
- Proper browser/server detection

**Code**:
```typescript
let browserClientInstance: ReturnType<typeof createClient> | null = null

function initializeBrowserClient() {
  if (typeof window === 'undefined') return null
  
  if (!browserClientInstance) {
    browserClientInstance = createClient(supabaseUrl, supabaseAnonKey, {
      auth: {
        persistSession: true,
        detectSessionInUrl: true,
        storage: window.localStorage,
      },
    })
  }
  
  return browserClientInstance
}

export const supabase = initializeBrowserClient() || createClient(...)
```

### 5. `public/favicon.svg` ✅
**Problem**: Favicon 404 error in browser
**Fix**: Added dashboard grid icon SVG
```bash
# Created: public/favicon.svg
# Content: <svg> dashboard grid icon
```

### 6. `app/layout.tsx` ✅
**Problem**: No favicon metadata
**Fix**: Added favicon reference to metadata
```typescript
icons: {
  icon: '/favicon.svg',
}
```

## Authentication Flow (After Fixes)

```
User clicks "Check Now"
        ↓
Client calls supabase.auth.getSession()
        ↓
Gets { access_token, user, ... } from localStorage
        ↓
Fetch POST /api/checks with:
  - Authorization: Bearer {access_token}
  - Content-Type: application/json
        ↓
API route receives request
        ↓
Parses Authorization header
        ↓
Creates Supabase client with Bearer token
        ↓
Calls supabase.auth.getUser() → verifies token
        ↓
Extracts user ID from verified session
        ↓
Uses service-role to query dashboard ownership
        ↓
Runs Playwright check
        ↓
Stores results in database
        ↓
Returns 200 OK with results ✅
```

## Testing Results

### Automated Tests Passed ✅
- [x] API properly rejects unauthenticated requests (401)
- [x] API handles Authorization Bearer token header
- [x] Invalid Bearer tokens properly rejected (401)
- [x] Client code includes Authorization header support
- [x] Error response format correct
- [x] Homepage loads (200)
- [x] Auth page loads (200)
- [x] Favicon served (200)

### Manual Testing Required
- [ ] Sign up and create account
- [ ] Sign in with credentials
- [ ] Create a dashboard
- [ ] Click "Check Now" button
- [ ] Verify: No 401 error in console
- [ ] Verify: Check completes successfully
- [ ] Verify: Results display on page

## Deployment Notes

### Environment Variables Required
```bash
NEXT_PUBLIC_SUPABASE_URL=https://...
NEXT_PUBLIC_SUPABASE_ANON_KEY=...
SUPABASE_SERVICE_ROLE_KEY=...
```

### Security Implications
- ✅ Bearer tokens sent over HTTPS in production
- ✅ Service role key only used server-side
- ✅ RLS prevents user data leakage
- ✅ No hardcoded secrets in client code

### Production Readiness
- ✅ Proper error handling
- ✅ Auth verification at API boundary
- ✅ Owner verification before executing checks
- ✅ Graceful fallback between header and cookie auth
- ✅ Proper logging for debugging

## Rollback Instructions
If issues occur:
```bash
# Revert all changes
git checkout HEAD -- app/dashboards/[id]/page.tsx
git checkout HEAD -- app/api/checks/route.ts
git checkout HEAD -- lib/checks/resultProcessor.ts
git checkout HEAD -- lib/supabase/client.ts

# Clear cache
rm -rf .next node_modules/.cache

# Restart
npm run dev
```

## Summary
**Issue**: 401 Unauthorized when clicking "Check Now"
**Root Cause**: Auth token in localStorage, not HTTP cookies
**Solution**: Send token as `Authorization: Bearer` header
**Status**: ✅ FIXED - Ready for testing

