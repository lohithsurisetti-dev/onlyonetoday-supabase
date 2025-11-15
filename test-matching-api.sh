#!/bin/bash

# Test Dream Matching with Similar Dreams (Different Wordings)
# This script creates two similar dreams via API and checks if they match

SUPABASE_URL="http://127.0.0.1:54321"
API_URL="${SUPABASE_URL}/functions/v1/create-dream-post"

echo "🧪 Testing Dream Matching with Similar Dreams (Different Wordings)"
echo ""

# Get service key from environment
SERVICE_KEY="${SUPABASE_SERVICE_ROLE_KEY:-sb_secret_N7UND0UgjKTVK-Uodkm0Hg_xSvEMPvz}"

# Test Case 1: Very Similar Dreams
echo "📝 Creating Dream 1..."
DREAM1_RESPONSE=$(curl -s -X POST "${API_URL}" \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer ${SERVICE_KEY}" \
  -d '{
    "content": "I dreamt of meeting MS Dhoni and played cricket with him. He gave me a signed jersey and I hit a six in his bowling.",
    "dreamType": "night_dream",
    "clarity": 8,
    "scope": "world"
  }')

echo "Dream 1 Response:"
echo "$DREAM1_RESPONSE" | jq '.' 2>/dev/null || echo "$DREAM1_RESPONSE"
DREAM1_MATCH_COUNT=$(echo "$DREAM1_RESPONSE" | jq -r '.post.matchCount // 0' 2>/dev/null || echo "0")
echo "Match Count: $DREAM1_MATCH_COUNT"
echo ""

sleep 2

echo "📝 Creating Dream 2 (Similar but Different Wording)..."
DREAM2_RESPONSE=$(curl -s -X POST "${API_URL}" \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer ${SERVICE_KEY}" \
  -d '{
    "content": "I had a dream where I met MS Dhoni and we played cricket together. He presented me with an autographed jersey and I managed to hit a six off his bowling.",
    "dreamType": "night_dream",
    "clarity": 8,
    "scope": "world"
  }')

echo "Dream 2 Response:"
echo "$DREAM2_RESPONSE" | jq '.' 2>/dev/null || echo "$DREAM2_RESPONSE"
DREAM2_MATCH_COUNT=$(echo "$DREAM2_RESPONSE" | jq -r '.post.matchCount // 0' 2>/dev/null || echo "0")
echo "Match Count: $DREAM2_MATCH_COUNT"
echo ""

echo "✅ Test Complete!"
echo ""
echo "Expected: Dream 2 should show matchCount >= 2 (including Dream 1)"

