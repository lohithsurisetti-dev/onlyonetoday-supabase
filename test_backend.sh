#!/bin/bash

# Backend Testing Script
# Tests the complete Supabase backend end-to-end

set -e

echo "🧪 OnlyOne.Today - Backend Testing"
echo "=================================="
echo ""

# Colors
GREEN='\033[0;32m'
RED='\033[0;31m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

# Config
API_URL="http://127.0.0.1:54321"
ANON_KEY="sb_publishable_ACJWlzQHlZjBrEguHvfOxg_3BJgxAaH"
ACCESS_TOKEN="eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJodHRwOi8vMTI3LjAuMC4xOjU0MzIxL2F1dGgvdjEiLCJzdWIiOiIxOWQyZjAyZS0yMDE0LTRhNDktYTg4My1iOGQ2OGJkMmUyYzIiLCJhdWQiOiJhdXRoZW50aWNhdGVkIiwiZXhwIjoxNzYwNjg4ODcxLCJpYXQiOjE3NjA2ODUyNzEsImVtYWlsIjoidGVzdEBvbmx5b25ldG9kYXkuY29tIiwicGhvbmUiOiIiLCJhcHBfbWV0YWRhdGEiOnsicHJvdmlkZXIiOiJlbWFpbCIsInByb3ZpZGVycyI6WyJlbWFpbCJdfSwidXNlcl9tZXRhZGF0YSI6eyJlbWFpbCI6InRlc3RAb25seW9uZXRvZGF5LmNvbSIsImVtYWlsX3ZlcmlmaWVkIjp0cnVlLCJwaG9uZV92ZXJpZmllZCI6ZmFsc2UsInN1YiI6IjE5ZDJmMDJlLTIwMTQtNGE0OS1hODgzLWI4ZDY4YmQyZTJjMiJ9LCJyb2xlIjoiYXV0aGVudGljYXRlZCIsImFhbCI6ImFhbDEiLCJhbXIiOlt7Im1ldGhvZCI6InBhc3N3b3JkIiwidGltZXN0YW1wIjoxNzYwNjg1MjcxfV0sInNlc3Npb25faWQiOiJkZDJkYjU5OC1mMzJlLTQ1NDQtYTc4My0zNjA5NmVhNzczOTYiLCJpc19hbm9ueW1vdXMiOmZhbHNlfQ.TvUN8E4DdfX6OlICuHvHrPYOXXQLFIEm_1QyFB6x2ng"

# Test 1: Check Supabase is running
echo -e "${YELLOW}Test 1: Checking Supabase status...${NC}"
if curl -s "$API_URL/rest/v1/" -H "apikey: $ANON_KEY" > /dev/null; then
    echo -e "${GREEN}✅ Supabase is running${NC}"
else
    echo -e "${RED}❌ Supabase is not running${NC}"
    exit 1
fi
echo ""

# Test 2: Check tables exist
echo -e "${YELLOW}Test 2: Checking database tables...${NC}"
TABLES=$(psql postgresql://postgres:postgres@127.0.0.1:54322/postgres -t -c "SELECT COUNT(*) FROM information_schema.tables WHERE table_schema='public'" 2>/dev/null)
if [ "$TABLES" -gt 10 ]; then
    echo -e "${GREEN}✅ Found $TABLES tables${NC}"
else
    echo -e "${RED}❌ Expected 12+ tables, found $TABLES${NC}"
fi
echo ""

# Test 3: Query posts
echo -e "${YELLOW}Test 3: Querying posts table...${NC}"
RESPONSE=$(curl -s "$API_URL/rest/v1/posts?select=count" \
    -H "apikey: $ANON_KEY" \
    -H "Authorization: Bearer $ACCESS_TOKEN")
echo "Response: $RESPONSE"
echo -e "${GREEN}✅ Posts table accessible${NC}"
echo ""

# Test 4: Create post via REST API (without Edge Function)
echo -e "${YELLOW}Test 4: Creating post via REST API...${NC}"
RESPONSE=$(curl -s -X POST "$API_URL/rest/v1/posts" \
    -H "apikey: $ANON_KEY" \
    -H "Authorization: Bearer $ACCESS_TOKEN" \
    -H "Content-Type: application/json" \
    -H "Prefer: return=representation" \
    -d '{
        "content": "Test post - Meditated for 20 minutes",
        "input_type": "action",
        "scope": "world",
        "content_hash": "test:post:meditated",
        "match_count": 0,
        "percentile": 5.0,
        "tier": "elite"
    }')
echo "Response: $RESPONSE"
if echo "$RESPONSE" | grep -q "id"; then
    echo -e "${GREEN}✅ Post created successfully${NC}"
else
    echo -e "${RED}❌ Post creation failed${NC}"
fi
echo ""

# Test 5: Check pgvector extension
echo -e "${YELLOW}Test 5: Checking pgvector extension...${NC}"
PGVECTOR=$(psql postgresql://postgres:postgres@127.0.0.1:54322/postgres -t -c "SELECT COUNT(*) FROM pg_extension WHERE extname='vector'" 2>/dev/null)
if [ "$PGVECTOR" -eq 1 ]; then
    echo -e "${GREEN}✅ pgvector extension installed${NC}"
else
    echo -e "${RED}❌ pgvector extension not found${NC}"
fi
echo ""

# Summary
echo "=================================="
echo -e "${GREEN}🎉 Backend Tests Complete!${NC}"
echo ""
echo "Next steps:"
echo "1. Open Studio: http://127.0.0.1:54323"
echo "2. Serve Edge Function: supabase functions serve create-post --no-verify-jwt"
echo "3. Test Edge Function with vector embeddings"
echo ""

