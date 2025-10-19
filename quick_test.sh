#!/bin/bash

GREEN='\033[0;32m'
RED='\033[0;31m'
YELLOW='\033[1;33m'
NC='\033[0m'

API_URL="http://127.0.0.1:54321"
ANON_KEY="sb_publishable_ACJWlzQHlZjBrEguHvfOxg_3BJgxAaH"

echo "🧪 Quick Backend Test with HuggingFace"
echo "======================================="
echo ""

# Get token
echo "Getting auth token..."
LOGIN_RESPONSE=$(curl -s -X POST "$API_URL/auth/v1/token?grant_type=password" \
  -H "apikey: $ANON_KEY" \
  -H "Content-Type: application/json" \
  -d '{"email": "test@onlyonetoday.com", "password": "testpassword123"}')

ACCESS_TOKEN=$(echo $LOGIN_RESPONSE | python3 -c "import sys, json; print(json.load(sys.stdin)['access_token'])" 2>/dev/null)

if [ -z "$ACCESS_TOKEN" ]; then
    echo -e "${RED}❌ Failed to get token${NC}"
    exit 1
fi

echo -e "${GREEN}✅ Authenticated${NC}"
echo ""

# Test 1: Create post with embeddings
echo -e "${YELLOW}Test: Creating post with HuggingFace embeddings...${NC}"
echo "Content: 'Practiced yoga for 45 minutes at sunrise'"
echo ""

START=$(date +%s%N)
RESPONSE=$(curl -s -X POST "$API_URL/functions/v1/create-post" \
  -H "Authorization: Bearer $ACCESS_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "content": "Practiced yoga for 45 minutes at sunrise",
    "inputType": "action",
    "scope": "world"
  }')
END=$(date +%s%N)
DURATION=$(( ($END - $START) / 1000000 ))

echo "Response:"
echo "$RESPONSE" | python3 -m json.tool 2>/dev/null || echo "$RESPONSE"
echo ""
echo "Response time: ${DURATION}ms"
echo ""

if echo "$RESPONSE" | grep -q '"success":true'; then
    echo -e "${GREEN}✅ SUCCESS! Post created with HuggingFace embeddings!${NC}"
    
    TIER=$(echo "$RESPONSE" | python3 -c "import sys, json; print(json.load(sys.stdin)['post']['tier'])" 2>/dev/null)
    MATCHES=$(echo "$RESPONSE" | python3 -c "import sys, json; print(json.load(sys.stdin)['post']['matchCount'])" 2>/dev/null)
    
    echo "   Tier: $TIER"
    echo "   Matches: $MATCHES"
    echo ""
    echo -e "${GREEN}🎉 Backend is fully operational with FREE embeddings!${NC}"
else
    echo -e "${RED}❌ Failed${NC}"
    echo ""
    echo "Checking logs..."
    tail -30 hf_function.log | grep -i "error"
fi
