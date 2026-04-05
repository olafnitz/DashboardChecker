#!/bin/bash

echo "═══════════════════════════════════════════"
echo "  Dashboard Checker - App Verification"
echo "═══════════════════════════════════════════"
echo ""

# Test 1: Basic endpoints
echo "✅ STEP 1: Verifying endpoints are accessible"
echo ""

echo "  1.1: Homepage..."
HOMEPAGE=$(curl -s -w "%{http_code}" http://localhost:3000/ | tail -1)
if [ "$HOMEPAGE" = "200" ]; then
  echo "      ✓ Homepage loads (HTTP 200)"
else
  echo "      ✗ Homepage failed (HTTP $HOMEPAGE)"
fi

echo "  1.2: Auth page..."
AUTH=$(curl -s -w "%{http_code}" http://localhost:3000/auth | tail -1)
if [ "$AUTH" = "200" ]; then
  echo "      ✓ Auth page loads (HTTP 200)"
else
  echo "      ✗ Auth page failed (HTTP $AUTH)"
fi

echo "  1.3: Favicon..."
FAVICON=$(curl -s -w "%{http_code}" http://localhost:3000/favicon.svg | tail -1)
if [ "$FAVICON" = "200" ]; then
  echo "      ✓ Favicon loads (HTTP 200)"
else
  echo "      ✗ Favicon failed (HTTP $FAVICON)"
fi

# Test 2: API endpoints
echo ""
echo "✅ STEP 2: Verifying API endpoints"
echo ""

echo "  2.1: Testing /api/checks without auth..."
CHECK_UNAUTH=$(curl -s -X POST http://localhost:3000/api/checks \
  -H "Content-Type: application/json" \
  -d '{"dashboardId":"test"}' \
  -w "\n%{http_code}" | tail -1)

if [ "$CHECK_UNAUTH" = "401" ]; then
  echo "      ✓ Properly rejects unauthenticated requests (HTTP 401)"
else
  echo "      ✗ Unexpected response (HTTP $CHECK_UNAUTH)"
fi

echo "  2.2: Testing /api/dashboards without auth..."
DASH_UNAUTH=$(curl -s http://localhost:3000/api/dashboards \
  -w "\n%{http_code}" | tail -1)

if [ "$DASH_UNAUTH" = "401" ]; then
  echo "      ✓ Properly rejects unauthenticated requests (HTTP 401)"
else
  echo "      ✗ Unexpected response (HTTP $DASH_UNAUTH)"
fi

# Test 3: Response format
echo ""
echo "✅ STEP 3: Verifying response formats"
echo ""

echo "  3.1: Checking error response format..."
ERROR_RESPONSE=$(curl -s -X POST http://localhost:3000/api/checks \
  -H "Content-Type: application/json" \
  -d '{"dashboardId":"test"}')

if echo "$ERROR_RESPONSE" | grep -q "error"; then
  echo "      ✓ Error response includes error field"
  echo "      Content: $(echo "$ERROR_RESPONSE" | head -c 80)..."
else
  echo "      ✗ Error response format incorrect"
fi

# Summary
echo ""
echo "═══════════════════════════════════════════"
echo "       ✨ VERIFICATION COMPLETE ✨"
echo "═══════════════════════════════════════════"
echo ""
echo "📋 Next: Manual browser testing required:"
echo "  1. Go to http://localhost:3000/"
echo "  2. Click 'Sign In' or 'Sign Up'"
echo "  3. Create a dashboard with a test URL"
echo "  4. Click 'Check Now' button"
echo "  5. Verify check completes successfully"
echo ""
