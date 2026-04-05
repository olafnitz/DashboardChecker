#!/bin/bash

# Test 1: Check if auth cookies exist
echo "🔍 Checking browser cookies after login..."
echo "Looking for session in localStorage/cookies..."
echo ""

# Test 2: Check what the API is actually receiving
echo "🔍 Testing API endpoint directly..."
curl -v -X POST http://localhost:3000/api/checks \
  -H "Content-Type: application/json" \
  -H "Cookie: test=value" \
  -d '{"dashboardId":"test"}' 2>&1 | head -50

