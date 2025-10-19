#!/bin/bash
# Comprehensive API Testing Script

set -e

# Colors
GREEN='\033[0;32m'
RED='\033[0;31m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m'

# Config
API_URL="http://127.0.0.1:54321"
ANON_KEY="sb_publishable_ACJWlzQHlZjBrEguHvfOxg_3BJgxAaH"

echo "🧪 Comprehensive Backend API Testing"
echo "====================================="
echo ""

# Save results
RESULTS_FILE="test_results.txt"
echo "Test Results - $(date)" > $RESULTS_FILE
echo "======================================" >> $RESULTS_FILE
echo "" >> $RESULTS_FILE

# Test counter
PASS=0
FAIL=0

# Helper function
test_api() {
    local name=$1
    local cmd=$2
    local expected=$3
    
    echo -e "${BLUE}Testing: $name${NC}"
    
    if result=$(eval $cmd 2>&1); then
        if echo "$result" | grep -q "$expected"; then
            echo -e "${GREEN}✅ PASS${NC}"
            echo "✅ $name - PASS" >> $RESULTS_FILE
            ((PASS++))
        else
            echo -e "${RED}❌ FAIL - Expected '$expected' not found${NC}"
            echo "❌ $name - FAIL" >> $RESULTS_FILE
            echo "   Response: $result" >> $RESULTS_FILE
            ((FAIL++))
        fi
    else
        echo -e "${RED}❌ FAIL - Command error${NC}"
        echo "❌ $name - FAIL (Command Error)" >> $RESULTS_FILE
        ((FAIL++))
    fi
    echo ""
}

echo "==================================="
echo "PHASE 1: AUTHENTICATION APIs"
echo "==================================="
echo ""

# Test 1.2: Login
echo -e "${YELLOW}Test 1.2: User Login${NC}"
LOGIN_RESPONSE=$(curl -s -X POST "$API_URL/auth/v1/token?grant_type=password" \
  -H "apikey: $ANON_KEY" \
  -H "Content-Type: application/json" \
  -d '{
    "email": "test@onlyonetoday.com",
    "password": "testpassword123"
  }')

if echo "$LOGIN_RESPONSE" | grep -q "access_token"; then
    echo -e "${GREEN}✅ Login successful${NC}"
    ACCESS_TOKEN=$(echo $LOGIN_RESPONSE | python3 -c "import sys, json; print(json.load(sys.stdin)['access_token'])")
    echo "✅ Test 1.2: Login - PASS" >> $RESULTS_FILE
    ((PASS++))
else
    echo -e "${RED}❌ Login failed${NC}"
    echo "Response: $LOGIN_RESPONSE"
    echo "❌ Test 1.2: Login - FAIL" >> $RESULTS_FILE
    ((FAIL++))
fi
echo ""

# Test 1.3: Get User
echo -e "${YELLOW}Test 1.3: Get Current User${NC}"
USER_RESPONSE=$(curl -s "$API_URL/auth/v1/user" \
  -H "apikey: $ANON_KEY" \
  -H "Authorization: Bearer $ACCESS_TOKEN")

if echo "$USER_RESPONSE" | grep -q "test@onlyonetoday.com"; then
    echo -e "${GREEN}✅ Get user successful${NC}"
    USER_ID=$(echo $USER_RESPONSE | python3 -c "import sys, json; print(json.load(sys.stdin)['id'])")
    echo "User ID: $USER_ID"
    echo "✅ Test 1.3: Get User - PASS" >> $RESULTS_FILE
    ((PASS++))
else
    echo -e "${RED}❌ Get user failed${NC}"
    echo "❌ Test 1.3: Get User - FAIL" >> $RESULTS_FILE
    ((FAIL++))
fi
echo ""

echo "==================================="
echo "PHASE 2: POST APIs (REST)"
echo "==================================="
echo ""

# Test 2.1: Create Post (REST API)
echo -e "${YELLOW}Test 2.1: Create Post via REST API${NC}"
POST_RESPONSE=$(curl -s -X POST "$API_URL/rest/v1/posts" \
  -H "apikey: $ANON_KEY" \
  -H "Authorization: Bearer $ACCESS_TOKEN" \
  -H "Content-Type: application/json" \
  -H "Prefer: return=representation" \
  -d "{
    \"content\": \"Meditated for 20 minutes this morning\",
    \"input_type\": \"action\",
    \"user_id\": \"$USER_ID\",
    \"scope\": \"world\",
    \"content_hash\": \"meditated:20:minutes\",
    \"match_count\": 0,
    \"percentile\": 5.0,
    \"tier\": \"elite\"
  }")

if echo "$POST_RESPONSE" | grep -q "id"; then
    echo -e "${GREEN}✅ Post created${NC}"
    POST_ID=$(echo $POST_RESPONSE | python3 -c "import sys, json; print(json.load(sys.stdin)[0]['id'])")
    echo "Post ID: $POST_ID"
    echo "✅ Test 2.1: Create Post - PASS" >> $RESULTS_FILE
    ((PASS++))
else
    echo -e "${RED}❌ Post creation failed${NC}"
    echo "Response: $POST_RESPONSE"
    echo "❌ Test 2.1: Create Post - FAIL" >> $RESULTS_FILE
    ((FAIL++))
    POST_ID=""
fi
echo ""

# Test 2.2: Get All Posts
echo -e "${YELLOW}Test 2.2: Get All Posts${NC}"
test_api "Get All Posts" \
  "curl -s '$API_URL/rest/v1/posts?select=*' -H 'apikey: $ANON_KEY'" \
  "content"

# Test 2.3: Get User's Posts
echo -e "${YELLOW}Test 2.3: Get User's Posts${NC}"
test_api "Get User Posts" \
  "curl -s '$API_URL/rest/v1/posts?user_id=eq.$USER_ID&select=*' -H 'apikey: $ANON_KEY' -H 'Authorization: Bearer $ACCESS_TOKEN'" \
  "Meditated"

# Test 2.4: Get Posts by Tier
echo -e "${YELLOW}Test 2.4: Get Posts by Tier (elite)${NC}"
test_api "Filter by Tier" \
  "curl -s '$API_URL/rest/v1/posts?tier=eq.elite&select=*' -H 'apikey: $ANON_KEY'" \
  "elite"

# Test 2.5: Get Posts by Scope
echo -e "${YELLOW}Test 2.5: Get Posts by Scope (world)${NC}"
test_api "Filter by Scope" \
  "curl -s '$API_URL/rest/v1/posts?scope=eq.world&select=*' -H 'apikey: $ANON_KEY'" \
  "world"

echo "==================================="
echo "PHASE 3: REACTION APIs"
echo "==================================="
echo ""

if [ -n "$POST_ID" ]; then
    # Test 3.1: Add Reaction
    echo -e "${YELLOW}Test 3.1: Add Reaction${NC}"
    REACTION_RESPONSE=$(curl -s -X POST "$API_URL/rest/v1/reactions" \
      -H "apikey: $ANON_KEY" \
      -H "Authorization: Bearer $ACCESS_TOKEN" \
      -H "Content-Type: application/json" \
      -H "Prefer: return=representation" \
      -d "{
        \"post_id\": \"$POST_ID\",
        \"user_id\": \"$USER_ID\",
        \"reaction_type\": \"funny\"
      }")
    
    if echo "$REACTION_RESPONSE" | grep -q "id"; then
        echo -e "${GREEN}✅ Reaction added${NC}"
        REACTION_ID=$(echo $REACTION_RESPONSE | python3 -c "import sys, json; print(json.load(sys.stdin)[0]['id'])")
        echo "✅ Test 3.1: Add Reaction - PASS" >> $RESULTS_FILE
        ((PASS++))
    else
        echo -e "${RED}❌ Reaction failed${NC}"
        echo "❌ Test 3.1: Add Reaction - FAIL" >> $RESULTS_FILE
        ((FAIL++))
    fi
    echo ""
    
    # Test 3.2: Get Post Reactions
    echo -e "${YELLOW}Test 3.2: Get Post Reactions${NC}"
    test_api "Get Reactions" \
      "curl -s '$API_URL/rest/v1/reactions?post_id=eq.$POST_ID&select=*' -H 'apikey: $ANON_KEY'" \
      "funny"
fi

echo "==================================="
echo "PHASE 4: PROFILE APIs"
echo "==================================="
echo ""

# Test 4.1: Create Profile
echo -e "${YELLOW}Test 4.1: Create/Update Profile${NC}"
PROFILE_RESPONSE=$(curl -s -X POST "$API_URL/rest/v1/profiles" \
  -H "apikey: $ANON_KEY" \
  -H "Authorization: Bearer $ACCESS_TOKEN" \
  -H "Content-Type: application/json" \
  -H "Prefer: return=representation" \
  -d "{
    \"id\": \"$USER_ID\",
    \"username\": \"testuser\",
    \"first_name\": \"Test\",
    \"last_name\": \"User\",
    \"bio\": \"Testing the backend!\"
  }")

if echo "$PROFILE_RESPONSE" | grep -q "username"; then
    echo -e "${GREEN}✅ Profile created${NC}"
    echo "✅ Test 4.1: Create Profile - PASS" >> $RESULTS_FILE
    ((PASS++))
else
    echo -e "${RED}❌ Profile creation failed${NC}"
    echo "Response: $PROFILE_RESPONSE"
    echo "❌ Test 4.1: Create Profile - FAIL" >> $RESULTS_FILE
    ((FAIL++))
fi
echo ""

# Test 4.2: Get Profile
echo -e "${YELLOW}Test 4.2: Get Profile${NC}"
test_api "Get Profile" \
  "curl -s '$API_URL/rest/v1/profiles?id=eq.$USER_ID&select=*' -H 'apikey: $ANON_KEY'" \
  "testuser"

echo "==================================="
echo "PHASE 5: NOTIFICATION APIs"
echo "==================================="
echo ""

# Test 5.1: Create Notification
echo -e "${YELLOW}Test 5.1: Create Notification${NC}"
NOTIF_RESPONSE=$(curl -s -X POST "$API_URL/rest/v1/notifications" \
  -H "apikey: $ANON_KEY" \
  -H "Authorization: Bearer $ACCESS_TOKEN" \
  -H "Content-Type: application/json" \
  -H "Prefer: return=representation" \
  -d "{
    \"user_id\": \"$USER_ID\",
    \"type\": \"achievement\",
    \"title\": \"Test Notification\",
    \"message\": \"Your post hit elite tier!\"
  }")

if echo "$NOTIF_RESPONSE" | grep -q "id"; then
    echo -e "${GREEN}✅ Notification created${NC}"
    NOTIF_ID=$(echo $NOTIF_RESPONSE | python3 -c "import sys, json; print(json.load(sys.stdin)[0]['id'])")
    echo "✅ Test 5.1: Create Notification - PASS" >> $RESULTS_FILE
    ((PASS++))
else
    echo -e "${RED}❌ Notification failed${NC}"
    echo "❌ Test 5.1: Create Notification - FAIL" >> $RESULTS_FILE
    ((FAIL++))
fi
echo ""

# Test 5.2: Get Notifications
echo -e "${YELLOW}Test 5.2: Get User Notifications${NC}"
test_api "Get Notifications" \
  "curl -s '$API_URL/rest/v1/notifications?user_id=eq.$USER_ID&select=*' -H 'apikey: $ANON_KEY' -H 'Authorization: Bearer $ACCESS_TOKEN'" \
  "Test Notification"

# Test 5.3: Mark as Read
if [ -n "$NOTIF_ID" ]; then
    echo -e "${YELLOW}Test 5.3: Mark Notification as Read${NC}"
    READ_RESPONSE=$(curl -s -X PATCH "$API_URL/rest/v1/notifications?id=eq.$NOTIF_ID" \
      -H "apikey: $ANON_KEY" \
      -H "Authorization: Bearer $ACCESS_TOKEN" \
      -H "Content-Type: application/json" \
      -d "{\"is_read\": true}")
    
    if [ -z "$READ_RESPONSE" ] || echo "$READ_RESPONSE" | grep -q "is_read"; then
        echo -e "${GREEN}✅ Notification marked as read${NC}"
        echo "✅ Test 5.3: Mark as Read - PASS" >> $RESULTS_FILE
        ((PASS++))
    else
        echo -e "${RED}❌ Mark as read failed${NC}"
        echo "❌ Test 5.3: Mark as Read - FAIL" >> $RESULTS_FILE
        ((FAIL++))
    fi
    echo ""
fi

echo "==================================="
echo "PHASE 6: DATABASE FUNCTIONS"
echo "==================================="
echo ""

# Test 6.1: Get User Stats Function
echo -e "${YELLOW}Test 6.1: Get User Stats (SQL Function)${NC}"
STATS=$(psql postgresql://postgres:postgres@127.0.0.1:54322/postgres -t -c "SELECT * FROM get_user_stats('$USER_ID')" 2>/dev/null || echo "")

if [ -n "$STATS" ]; then
    echo -e "${GREEN}✅ User stats function works${NC}"
    echo "Stats: $STATS"
    echo "✅ Test 6.1: Get User Stats - PASS" >> $RESULTS_FILE
    ((PASS++))
else
    echo -e "${RED}❌ User stats function failed${NC}"
    echo "❌ Test 6.1: Get User Stats - FAIL" >> $RESULTS_FILE
    ((FAIL++))
fi
echo ""

# Test 6.2: Get Global Stats
echo -e "${YELLOW}Test 6.2: Get Global Stats (SQL Function)${NC}"
GLOBAL_STATS=$(psql postgresql://postgres:postgres@127.0.0.1:54322/postgres -t -c "SELECT * FROM get_global_stats()" 2>/dev/null || echo "")

if [ -n "$GLOBAL_STATS" ]; then
    echo -e "${GREEN}✅ Global stats function works${NC}"
    echo "Stats: $GLOBAL_STATS"
    echo "✅ Test 6.2: Get Global Stats - PASS" >> $RESULTS_FILE
    ((PASS++))
else
    echo -e "${RED}❌ Global stats function failed${NC}"
    echo "❌ Test 6.2: Get Global Stats - FAIL" >> $RESULTS_FILE
    ((FAIL++))
fi
echo ""

echo "==================================="
echo "SUMMARY"
echo "==================================="
echo ""
echo "Total Tests: $((PASS + FAIL))"
echo -e "${GREEN}Passed: $PASS${NC}"
echo -e "${RED}Failed: $FAIL${NC}"
echo ""

SUCCESS_RATE=$(echo "scale=2; $PASS * 100 / ($PASS + $FAIL)" | bc)
echo "Success Rate: ${SUCCESS_RATE}%"
echo ""

echo "Detailed results saved to: $RESULTS_FILE"
echo ""

if [ $FAIL -eq 0 ]; then
    echo -e "${GREEN}🎉 ALL TESTS PASSED!${NC}"
    exit 0
else
    echo -e "${YELLOW}⚠️  Some tests failed. Review $RESULTS_FILE${NC}"
    exit 1
fi
