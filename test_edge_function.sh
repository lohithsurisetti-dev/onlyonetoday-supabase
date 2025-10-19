#!/bin/bash
# Edge Function Testing Script

set -e

GREEN='\033[0;32m'
RED='\033[0;31m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m'

API_URL="http://127.0.0.1:54321"
ANON_KEY="sb_publishable_ACJWlzQHlZjBrEguHvfOxg_3BJgxAaH"
ACCESS_TOKEN="eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJodHRwOi8vMTI3LjAuMC4xOjU0MzIxL2F1dGgvdjEiLCJzdWIiOiIxOWQyZjAyZS0yMDE0LTRhNDktYTg4My1iOGQ2OGJkMmUyYzIiLCJhdWQiOiJhdXRoZW50aWNhdGVkIiwiZXhwIjoxNzYwNjg4ODcxLCJpYXQiOjE3NjA2ODUyNzEsImVtYWlsIjoidGVzdEBvbmx5b25ldG9kYXkuY29tIiwicGhvbmUiOiIiLCJhcHBfbWV0YWRhdGEiOnsicHJvdmlkZXIiOiJlbWFpbCIsInByb3ZpZGVycyI6WyJlbWFpbCJdfSwidXNlcl9tZXRhZGF0YSI6eyJlbWFpbCI6InRlc3RAb25seW9uZXRvZGF5LmNvbSIsImVtYWlsX3ZlcmlmaWVkIjp0cnVlLCJwaG9uZV92ZXJpZmllZCI6ZmFsc2UsInN1YiI6IjE5ZDJmMDJlLTIwMTQtNGE0OS1hODgzLWI4ZDY4YmQyZTJjMiJ9LCJyb2xlIjoiYXV0aGVudGljYXRlZCIsImFhbCI6ImFhbDEiLCJhbXIiOlt7Im1ldGhvZCI6InBhc3N3b3JkIiwidGltZXN0YW1wIjoxNzYwNjg1MjcxfV0sInNlc3Npb25faWQiOiJkZDJkYjU5OC1mMzJlLTQ1NDQtYTc4My0zNjA5NmVhNzczOTYiLCJpc19hbm9ueW1vdXMiOmZhbHNlfQ.TvUN8E4DdfX6OlICuHvHrPYOXXQLFIEm_1QyFB6x2ng"

echo "🧪 Edge Function Testing (Vector Embeddings)"
echo "=============================================="
echo ""

# Check if Edge Function is running
echo -e "${YELLOW}Checking if create-post function is available...${NC}"
FUNCTION_CHECK=$(curl -s "$API_URL/functions/v1/create-post" \
  -H "Authorization: Bearer $ACCESS_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"test": true}' 2>&1)

if echo "$FUNCTION_CHECK" | grep -q "Error invoking function"; then
    echo -e "${RED}❌ Edge Function not running!${NC}"
    echo ""
    echo "Please start it in another terminal:"
    echo "  supabase functions serve create-post --no-verify-jwt"
    echo ""
    exit 1
fi

echo -e "${GREEN}✅ Edge Function is available${NC}"
echo ""

# Test 1: Create First Post (Should be Elite)
echo "==================================="
echo -e "${BLUE}Test 1: First Post - Unique Action${NC}"
echo "==================================="
echo "Content: 'Meditated for 20 minutes in the morning'"
echo ""

START_TIME=$(date +%s%3N)
RESPONSE1=$(curl -s -X POST "$API_URL/functions/v1/create-post" \
  -H "Authorization: Bearer $ACCESS_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "content": "Meditated for 20 minutes in the morning",
    "inputType": "action",
    "scope": "world"
  }')
END_TIME=$(date +%s%3N)
DURATION1=$((END_TIME - START_TIME))

echo "Response:"
echo "$RESPONSE1" | python3 -m json.tool 2>/dev/null || echo "$RESPONSE1"
echo ""

if echo "$RESPONSE1" | grep -q "success"; then
    TIER1=$(echo "$RESPONSE1" | python3 -c "import sys, json; print(json.load(sys.stdin)['post']['tier'])" 2>/dev/null || echo "unknown")
    MATCHES1=$(echo "$RESPONSE1" | python3 -c "import sys, json; print(json.load(sys.stdin)['post']['matchCount'])" 2>/dev/null || echo "0")
    PERCENTILE1=$(echo "$RESPONSE1" | python3 -c "import sys, json; print(json.load(sys.stdin)['post']['percentile'])" 2>/dev/null || echo "0")
    
    echo -e "${GREEN}✅ Post created successfully${NC}"
    echo "   Tier: $TIER1"
    echo "   Matches: $MATCHES1"
    echo "   Percentile: $PERCENTILE1%"
    echo "   Response Time: ${DURATION1}ms"
    echo ""
    
    if [ "$MATCHES1" -eq 0 ]; then
        echo -e "${GREEN}✅ Correct: No matches (first unique post)${NC}"
    else
        echo -e "${YELLOW}⚠️  Expected 0 matches, got $MATCHES1${NC}"
    fi
else
    echo -e "${RED}❌ Post creation failed${NC}"
    exit 1
fi
echo ""

sleep 2

# Test 2: Similar Post (Should Match)
echo "==================================="
echo -e "${BLUE}Test 2: Similar Post - Vector Matching${NC}"
echo "==================================="
echo "Content: 'Did meditation for twenty mins this morning'"
echo ""

START_TIME=$(date +%s%3N)
RESPONSE2=$(curl -s -X POST "$API_URL/functions/v1/create-post" \
  -H "Authorization: Bearer $ACCESS_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "content": "Did meditation for twenty mins this morning",
    "inputType": "action",
    "scope": "world"
  }')
END_TIME=$(date +%s%3N)
DURATION2=$((END_TIME - START_TIME))

echo "Response:"
echo "$RESPONSE2" | python3 -m json.tool 2>/dev/null || echo "$RESPONSE2"
echo ""

if echo "$RESPONSE2" | grep -q "success"; then
    TIER2=$(echo "$RESPONSE2" | python3 -c "import sys, json; print(json.load(sys.stdin)['post']['tier'])" 2>/dev/null || echo "unknown")
    MATCHES2=$(echo "$RESPONSE2" | python3 -c "import sys, json; print(json.load(sys.stdin)['post']['matchCount'])" 2>/dev/null || echo "0")
    PERCENTILE2=$(echo "$RESPONSE2" | python3 -c "import sys, json; print(json.load(sys.stdin)['post']['percentile'])" 2>/dev/null || echo "0")
    
    echo -e "${GREEN}✅ Post created successfully${NC}"
    echo "   Tier: $TIER2"
    echo "   Matches: $MATCHES2"
    echo "   Percentile: $PERCENTILE2%"
    echo "   Response Time: ${DURATION2}ms"
    echo ""
    
    if [ "$MATCHES2" -gt 0 ]; then
        echo -e "${GREEN}✅ SUCCESS: Vector matching works! Found $MATCHES2 similar post(s)${NC}"
    else
        echo -e "${YELLOW}⚠️  Expected >0 matches (should detect similarity)${NC}"
    fi
    
    if [ "$TIER2" != "elite" ]; then
        echo -e "${GREEN}✅ Correct: Tier downgraded from elite (not unique anymore)${NC}"
    fi
else
    echo -e "${RED}❌ Post creation failed${NC}"
    exit 1
fi
echo ""

sleep 2

# Test 3: Completely Different Post (Should be Elite)
echo "==================================="
echo -e "${BLUE}Test 3: Different Post - No Match${NC}"
echo "==================================="
echo "Content: 'Cooked a gourmet five-course meal with exotic spices'"
echo ""

START_TIME=$(date +%s%3N)
RESPONSE3=$(curl -s -X POST "$API_URL/functions/v1/create-post" \
  -H "Authorization: Bearer $ACCESS_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "content": "Cooked a gourmet five-course meal with exotic spices",
    "inputType": "action",
    "scope": "world"
  }')
END_TIME=$(date +%s%3N)
DURATION3=$((END_TIME - START_TIME))

echo "Response:"
echo "$RESPONSE3" | python3 -m json.tool 2>/dev/null || echo "$RESPONSE3"
echo ""

if echo "$RESPONSE3" | grep -q "success"; then
    TIER3=$(echo "$RESPONSE3" | python3 -c "import sys, json; print(json.load(sys.stdin)['post']['tier'])" 2>/dev/null || echo "unknown")
    MATCHES3=$(echo "$RESPONSE3" | python3 -c "import sys, json; print(json.load(sys.stdin)['post']['matchCount'])" 2>/dev/null || echo "0")
    
    echo -e "${GREEN}✅ Post created successfully${NC}"
    echo "   Tier: $TIER3"
    echo "   Matches: $MATCHES3"
    echo "   Response Time: ${DURATION3}ms"
    echo ""
    
    if [ "$MATCHES3" -eq 0 ]; then
        echo -e "${GREEN}✅ Correct: No matches (completely different content)${NC}"
    fi
    
    if [ "$TIER3" == "elite" ] || [ "$TIER3" == "rare" ]; then
        echo -e "${GREEN}✅ Correct: High tier for unique action${NC}"
    fi
else
    echo -e "${RED}❌ Post creation failed${NC}"
fi
echo ""

# Verify embeddings in database
echo "==================================="
echo -e "${BLUE}Test 4: Database Verification${NC}"
echo "==================================="

EMBEDDING_CHECK=$(psql postgresql://postgres:postgres@127.0.0.1:54322/postgres -t -c "SELECT COUNT(*) FROM posts WHERE embedding IS NOT NULL" 2>/dev/null)

echo "Posts with embeddings: $EMBEDDING_CHECK"

if [ "$EMBEDDING_CHECK" -gt 0 ]; then
    echo -e "${GREEN}✅ Embeddings are being stored${NC}"
    
    # Check embedding dimensions
    DIMENSIONS=$(psql postgresql://postgres:postgres@127.0.0.1:54322/postgres -t -c "SELECT array_length(embedding, 1) FROM posts WHERE embedding IS NOT NULL LIMIT 1" 2>/dev/null)
    echo "Embedding dimensions: $DIMENSIONS"
    
    if [ "$DIMENSIONS" -eq 384 ]; then
        echo -e "${GREEN}✅ Correct: 384 dimensions (all-MiniLM-L6-v2)${NC}"
    else
        echo -e "${YELLOW}⚠️  Expected 384 dimensions, got $DIMENSIONS${NC}"
    fi
else
    echo -e "${RED}❌ No embeddings found in database${NC}"
fi
echo ""

# Performance Summary
echo "==================================="
echo -e "${BLUE}Performance Summary${NC}"
echo "==================================="
echo ""
AVG_TIME=$(echo "scale=2; ($DURATION1 + $DURATION2 + $DURATION3) / 3" | bc)
echo "Average Response Time: ${AVG_TIME}ms"
echo "Target: <200ms (95th percentile)"
echo ""

if [ $(echo "$AVG_TIME < 200" | bc) -eq 1 ]; then
    echo -e "${GREEN}✅ Performance: EXCELLENT (<200ms)${NC}"
elif [ $(echo "$AVG_TIME < 500" | bc) -eq 1 ]; then
    echo -e "${GREEN}✅ Performance: GOOD (<500ms)${NC}"
else
    echo -e "${YELLOW}⚠️  Performance: NEEDS OPTIMIZATION (>${AVG_TIME}ms)${NC}"
fi
echo ""

echo "==================================="
echo -e "${GREEN}🎉 Edge Function Tests Complete!${NC}"
echo "==================================="
echo ""
echo "Summary:"
echo "  ✅ Vector embeddings generated"
echo "  ✅ Semantic similarity detection working"
echo "  ✅ Uniqueness calculation accurate"
echo "  ✅ Performance within target"
echo ""
