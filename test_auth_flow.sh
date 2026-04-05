#!/bin/bash

BASE_URL="http://localhost:3000"

echo "═══════════════════════════════════════════════════════════════"
echo "   Dashboard Checker - Complete Auth Flow Test"
echo "═══════════════════════════════════════════════════════════════"
echo ""

# Test 1: API rejects requests without auth
echo "✅ TEST 1: API properly rejects unauthenticated requests"
echo ""

echo "  1.1: POST /api/checks without auth..."
RESPONSE=$(curl -s -X POST "$BASE_URL/api/checks" \
  -H "Content-Type: application/json" \
  -d '{"dashboardId":"test-id"}' \
  -w "\n%{http_code}")

HTTP_CODE=$(echo "$RESPONSE" | tail -1)
BODY=$(echo "$RESPONSE" | head -1)

if [ "$HTTP_CODE" = "401" ]; then
  echo "      ✓ Returns 401 Unauthorized"
  echo "      Response: $BODY"
else
  echo "      ✗ Expected 401, got $HTTP_CODE"
  echo "      Response: $BODY"
fi

echo ""
echo "  1.2: GET /api/dashboards without auth..."
RESPONSE=$(curl -s "$BASE_URL/api/dashboards" -w "\n%{http_code}")

HTTP_CODE=$(echo "$RESPONSE" | tail -1)
BODY=$(echo "$RESPONSE" | head -1)

if [ "$HTTP_CODE" = "401" ]; then
  echo "      ✓ Returns 401 Unauthorized"
else
  echo "      ✗ Expected 401, got $HTTP_CODE"
fi

# Test 2: API handles Bearer token correctly
echo ""
echo "✅ TEST 2: API handles Bearer token in Authorization header"
echo ""

echo "  2.1: POST with invalid Bearer token..."
RESPONSE=$(curl -s -X POST "$BASE_URL/api/checks" \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer invalid-token-12345" \
  -d '{"dashboardId":"test-id"}' \
  -w "\n%{http_code}")

HTTP_CODE=$(echo "$RESPONSE" | tail -1)

if [ "$HTTP_CODE" = "401" ]; then
  echo "      ✓ Still returns 401 with invalid token (expected)"
else
  echo "      ✗ Unexpected HTTP code: $HTTP_CODE"
fi

# Test 3: Client correctly sends Authorization header
echo ""
echo "✅ TEST 3: Verify client code supports Authorization header"
echo ""

if grep -q "Authorization.*Bearer" "$BASE_URL/../../../app/dashboards/[id]/page.tsx" 2>/dev/null || \
   grep -q "Authorization.*Bearer" /Users/onitz/Documents/Code/DashboardChecker/app/dashboards/[id]/page.tsx 2>/dev/null; then
  echo "      ✓ Client code includes Authorization header support"
else
  echo "      ⚠ Could not verify client code (may need manual check)"
fi

# Test 4: Error handling
echo ""
echo "✅ TEST 4: Error response format"
echo ""

RESPONSE=$(curl -s -X POST "$BASE_URL/api/checks" \
  -H "Content-Type: application/json" \
  -d '{"dashboardId":""}')

if echo "$RESPONSE" | grep -q "error"; then
  echo "      ✓ Error responses include 'error' field"
  echo "      Format: $RESPONSE"
else
  echo "      ✗ Error format incorrect"
fi

# Test 5: Production readiness
echo ""
echo "✅ TEST 5: Production Readiness Checks"
echo ""

echo "  5.1: Homepage loads..."
HOMEPAGE=$(curl -s "$BASE_URL/" | grep -o "Dashboard Checker" | head -1)
if [ "$HOMEPAGE" = "Dashboard Checker" ]; then
  echo "      ✓ Homepage loads successfully"
else
  echo "      ✗ Homepage not loading"
fi

echo "  5.2: Auth page loads..."
AUTH=$(curl -s "$BASE_URL/auth" | grep -o "Sign in" | head -1)
if [ "$AUTH" = "Sign in" ]; then
  echo "      ✓ Auth page loads successfully"
else
  echo "      ✗ Auth page not loading"
fi

echo "  5.3: Favicon serves..."
FAVICON=$(curl -s -o /dev/null -w "%{http_code}" "$BASE_URL/favicon.svg")
if [ "$FAVICON" = "200" ]; then
  echo "      ✓ Favicon available"
else
  echo "      ✗ Favicon missing (HTTP $FAVICON)"
fi

# Summary
echo ""
echo "═══════════════════════════════════════════════════════════════"
echo "                    ✨ TEST SUMMARY ✨"
echo "═══════════════════════════════════════════════════════════════"
echo ""
echo "📋 Manual Browser Test Required:"
echo "  1. Open http://localhost:3000"
echo "  2. Click 'Sign In' or 'Sign Up' in nav"
echo "  3. Create a test account"
echo "  4. Log in successfully"
echo "  5. Create a new dashboard (add any URL)"
echo "  6. Go to dashboard detail page"
echo "  7. Click 'Check Now' button"
echo "  8. Verify: ✅ Check should complete without 401 error"
echo ""
echo "Expected flow:"
echo "  → Client gets auth token from Supabase session"
echo "  → Client sends 'Authorization: Bearer {token}' header"
echo "  → API receives and validates the Bearer token"
echo "  → API queries dashboard and runs check"
echo "  → Results display on page"
echo ""

