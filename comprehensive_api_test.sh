#!/bin/bash
# Comprehensive API Testing Suite for OnlyOne.Today Backend
# Tests all edge cases, moderation, scopes, tiers, and analytics

set -e

GREEN='\033[0;32m'
RED='\033[0;31m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
PURPLE='\033[0;35m'
NC='\033[0m'

echo "🧪 COMPREHENSIVE API TESTING SUITE"
echo "=================================="
echo ""

# Configuration
API_URL="http://127.0.0.1:54321"
ANON_KEY="sb_publishable_ACJWlzQHlZjBrEguHvfOxg_3BJgxAaH"
OPENAI_KEY="YOUR_OPENAI_API_KEY_HERE"

# Test counters
TOTAL_TESTS=0
PASSED_TESTS=0
FAILED_TESTS=0

# Helper functions
log_test() {
    local test_name="$1"
    local result="$2"
    TOTAL_TESTS=$((TOTAL_TESTS + 1))
    
    if [ "$result" = "PASS" ]; then
        echo -e "${GREEN}✅ $test_name${NC}"
        PASSED_TESTS=$((PASSED_TESTS + 1))
    else
        echo -e "${RED}❌ $test_name${NC}"
        FAILED_TESTS=$((FAILED_TESTS + 1))
    fi
}

make_request() {
    local endpoint="$1"
    local data="$2"
    local expected_status="$3"
    
    response=$(curl -s -w "\n%{http_code}" -X POST "$API_URL/functions/v1/$endpoint" \
        -H "Authorization: Bearer $ACCESS_TOKEN" \
        -H "Content-Type: application/json" \
        -d "$data")
    
    http_code=$(echo "$response" | tail -n1)
    body=$(echo "$response" | head -n -1)
    
    if [ "$http_code" = "$expected_status" ]; then
        echo "$body"
        return 0
    else
        echo "HTTP $http_code: $body"
        return 1
    fi
}

# Get access token
echo -e "${BLUE}Step 1: Authentication${NC}"
echo "========================"

LOGIN_RESPONSE=$(curl -s -X POST "$API_URL/auth/v1/token?grant_type=password" \
  -H "apikey: $ANON_KEY" \
  -H "Content-Type: application/json" \
  -d '{
    "email": "test@onlyonetoday.com",
    "password": "testpassword123"
  }')

if echo "$LOGIN_RESPONSE" | grep -q "access_token"; then
    ACCESS_TOKEN=$(echo $LOGIN_RESPONSE | python3 -c "import sys, json; print(json.load(sys.stdin)['access_token'])")
    echo -e "${GREEN}✅ Authentication successful${NC}"
else
    echo -e "${RED}❌ Authentication failed${NC}"
    exit 1
fi
echo ""

# Set environment variable for Edge Function
export OPENAI_API_KEY=$OPENAI_KEY

echo -e "${BLUE}Step 2: Content Moderation Tests${NC}"
echo "=================================="
echo ""

# Test 1: Toxicity Detection
echo -e "${YELLOW}Testing Toxicity Detection...${NC}"
TOXIC_POSTS=(
    'You are such a stupid idiot'
    'I hate everyone on this platform'
    'This app is garbage and worthless'
    'Kill yourself you moron'
    'You are ugly and fat'
)

for post in "${TOXIC_POSTS[@]}"; do
    echo "Testing: '$post'"
    response=$(make_request "create-post" "{\"content\": \"$post\", \"inputType\": \"action\", \"scope\": \"world\"}" "400")
    if echo "$response" | grep -q "rejected\|moderation\|inappropriate"; then
        log_test "Toxicity detection: '$post'" "PASS"
    else
        log_test "Toxicity detection: '$post'" "FAIL"
        echo "Response: $response"
    fi
done
echo ""

# Test 2: Spam Detection
echo -e "${YELLOW}Testing Spam Detection...${NC}"
SPAM_POSTS=(
    'BUY NOW!!! LIMITED TIME OFFER!!! CLICK HERE!!!'
    'FREE MONEY!!! GET RICH QUICK!!!'
    'aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa'
    'https://scam-site.com https://another-scam.com'
    'SELL SELL SELL PROFIT PROFIT PROFIT'
)

for post in "${SPAM_POSTS[@]}"; do
    echo "Testing: '$post'"
    response=$(make_request "create-post" "{\"content\": \"$post\", \"inputType\": \"action\", \"scope\": \"world\"}" "400")
    if echo "$response" | grep -q "rejected\|spam\|moderation"; then
        log_test "Spam detection: '$post'" "PASS"
    else
        log_test "Spam detection: '$post'" "FAIL"
        echo "Response: $response"
    fi
done
echo ""

# Test 3: Hate Speech Detection
echo -e "${YELLOW}Testing Hate Speech Detection...${NC}"
HATE_POSTS=(
    'All [group] are terrible people'
    'I wish [group] would just disappear'
    'This is why [group] are inferior'
    'Discriminatory content against minorities'
)

for post in "${HATE_POSTS[@]}"; do
    echo "Testing: '$post'"
    response=$(make_request "create-post" "{\"content\": \"$post\", \"inputType\": \"action\", \"scope\": \"world\"}" "400")
    if echo "$response" | grep -q "rejected\|hate\|moderation"; then
        log_test "Hate speech detection: '$post'" "PASS"
    else
        log_test "Hate speech detection: '$post'" "FAIL"
        echo "Response: $response"
    fi
done
echo ""

# Test 4: Scam Detection
echo -e "${YELLOW}Testing Scam Detection...${NC}"
SCAM_POSTS=(
    'Send me your credit card details for verification'
    'I can make you rich, just send me $1000'
    'Click this link to claim your prize'
    'Bitcoin investment opportunity, guaranteed returns'
)

for post in "${SCAM_POSTS[@]}"; do
    echo "Testing: '$post'"
    response=$(make_request "create-post" "{\"content\": \"$post\", \"inputType\": \"action\", \"scope\": \"world\"}" "400")
    if echo "$response" | grep -q "rejected\|scam\|moderation"; then
        log_test "Scam detection: '$post'" "PASS"
    else
        log_test "Scam detection: '$post'" "FAIL"
        echo "Response: $response"
    fi
done
echo ""

echo -e "${BLUE}Step 3: Scope Testing${NC}"
echo "====================="
echo ""

# Test all scopes
SCOPES=("city" "state" "country" "world")
LOCATIONS=(
    '{"locationCity": "Phoenix", "locationState": "Arizona", "locationCountry": "United States"}'
    '{"locationState": "California", "locationCountry": "United States"}'
    '{"locationCountry": "Canada"}'
    '{}'
)

for i in "${!SCOPES[@]}"; do
    scope="${SCOPES[$i]}"
    location="${LOCATIONS[$i]}"
    
    echo -e "${YELLOW}Testing $scope scope...${NC}"
    response=$(make_request "create-post" "{\"content\": \"Test post for $scope scope\", \"inputType\": \"action\", \"scope\": \"$scope\", $location}" "200")
    
    if echo "$response" | grep -q '"success":true'; then
        log_test "Scope test: $scope" "PASS"
    else
        log_test "Scope test: $scope" "FAIL"
        echo "Response: $response"
    fi
done
echo ""

echo -e "${BLUE}Step 4: Tier and Percentile Testing${NC}"
echo "====================================="
echo ""

# Test tier calculations with different scenarios
echo -e "${YELLOW}Testing Tier Calculations...${NC}"

# Create multiple similar posts to test percentile calculations
SIMILAR_POSTS=(
    'I went for a morning jog'
    'I did a 30-minute run this morning'
    'I went running at sunrise'
    'I jogged around the park'
    'I did my daily run'
)

echo "Creating similar posts to test percentile calculations..."
for post in "${SIMILAR_POSTS[@]}"; do
    response=$(make_request "create-post" "{\"content\": \"$post\", \"inputType\": \"action\", \"scope\": \"world\"}" "200")
    if echo "$response" | grep -q '"success":true'; then
        tier=$(echo "$response" | python3 -c "import sys, json; print(json.load(sys.stdin)['post']['tier'])" 2>/dev/null || echo "unknown")
        percentile=$(echo "$response" | python3 -c "import sys, json; print(json.load(sys.stdin)['post']['percentile'])" 2>/dev/null || echo "0")
        echo "Post: '$post' - Tier: $tier, Percentile: $percentile%"
    fi
done
echo ""

# Test unique posts (should get elite tier)
echo -e "${YELLOW}Testing Unique Posts (Elite Tier)...${NC}"
UNIQUE_POSTS=(
    'I built a custom mechanical keyboard with cherry mx switches'
    'I learned to play the theremin today'
    'I wrote a haiku in ancient Greek'
    'I solved a Rubik\'s cube blindfolded'
    'I made my own sourdough starter from scratch'
)

for post in "${UNIQUE_POSTS[@]}"; do
    response=$(make_request "create-post" "{\"content\": \"$post\", \"inputType\": \"action\", \"scope\": \"world\"}" "200")
    if echo "$response" | grep -q '"success":true'; then
        tier=$(echo "$response" | python3 -c "import sys, json; print(json.load(sys.stdin)['post']['tier'])" 2>/dev/null || echo "unknown")
        percentile=$(echo "$response" | python3 -c "import sys, json; print(json.load(sys.stdin)['post']['percentile'])" 2>/dev/null || echo "0")
        if [ "$tier" = "elite" ] || [ "$tier" = "rare" ]; then
            log_test "Unique post tier: '$post'" "PASS"
        else
            log_test "Unique post tier: '$post'" "FAIL"
            echo "Expected elite/rare, got: $tier"
        fi
    fi
done
echo ""

echo -e "${BLUE}Step 5: Positive AI Generation Testing${NC}"
echo "======================================"
echo ""

# Test positive, inspiring content
echo -e "${YELLOW}Testing Positive Content Generation...${NC}"
POSITIVE_POSTS=(
    'I helped an elderly person cross the street today'
    'I volunteered at the local food bank'
    'I learned a new language and practiced for 2 hours'
    'I wrote thank you letters to 5 people who helped me'
    'I meditated for 45 minutes and felt so peaceful'
    'I cooked a healthy meal for my family'
    'I read a book about personal growth'
    'I went for a nature walk and appreciated the beauty'
    'I called my grandparents to check on them'
    'I organized a community cleanup event'
)

for post in "${POSITIVE_POSTS[@]}"; do
    response=$(make_request "create-post" "{\"content\": \"$post\", \"inputType\": \"action\", \"scope\": \"world\"}" "200")
    if echo "$response" | grep -q '"success":true'; then
        tier=$(echo "$response" | python3 -c "import sys, json; print(json.load(sys.stdin)['post']['tier'])" 2>/dev/null || echo "unknown")
        log_test "Positive content: '$post'" "PASS"
    else
        log_test "Positive content: '$post'" "FAIL"
        echo "Response: $response"
    fi
done
echo ""

echo -e "${BLUE}Step 6: Day Summary Testing${NC}"
echo "============================="
echo ""

# Test day summary processing
echo -e "${YELLOW}Testing Day Summary Processing...${NC}"
DAY_SUMMARIES=(
    'Today I woke up early, went for a run, had breakfast, worked on my project, called my mom, and read a book before bed'
    'I had a productive day: exercised, studied Spanish, cooked dinner, and watched a documentary'
    'My day included: morning meditation, work meeting, lunch with friends, grocery shopping, and evening yoga'
    'I spent the day: hiking in the mountains, taking photos, having a picnic, and stargazing'
)

for summary in "${DAY_SUMMARIES[@]}"; do
    response=$(make_request "create-post" "{\"content\": \"$summary\", \"inputType\": \"day\", \"scope\": \"world\"}" "200")
    if echo "$response" | grep -q '"success":true'; then
        activities=$(echo "$response" | python3 -c "import sys, json; print(json.load(sys.stdin)['post'].get('activities', []))" 2>/dev/null || echo "[]")
        activityCount=$(echo "$response" | python3 -c "import sys, json; print(json.load(sys.stdin)['post'].get('activityCount', 0))" 2>/dev/null || echo "0")
        log_test "Day summary: '$summary'" "PASS"
        echo "  Activities extracted: $activityCount"
    else
        log_test "Day summary: '$summary'" "FAIL"
        echo "Response: $response"
    fi
done
echo ""

echo -e "${BLUE}Step 7: Edge Cases and Error Handling${NC}"
echo "====================================="
echo ""

# Test edge cases
echo -e "${YELLOW}Testing Edge Cases...${NC}"

# Empty content
response=$(make_request "create-post" "{\"content\": \"\", \"inputType\": \"action\", \"scope\": \"world\"}" "400")
if echo "$response" | grep -q "too short\|required"; then
    log_test "Empty content rejection" "PASS"
else
    log_test "Empty content rejection" "FAIL"
fi

# Very long content
long_content=$(printf 'a%.0s' {1..3000})
response=$(make_request "create-post" "{\"content\": \"$long_content\", \"inputType\": \"action\", \"scope\": \"world\"}" "400")
if echo "$response" | grep -q "too long\|exceeded"; then
    log_test "Long content rejection" "PASS"
else
    log_test "Long content rejection" "FAIL"
fi

# Invalid input type
response=$(make_request "create-post" "{\"content\": \"Test post\", \"inputType\": \"invalid\", \"scope\": \"world\"}" "400")
if echo "$response" | grep -q "invalid\|error"; then
    log_test "Invalid input type rejection" "PASS"
else
    log_test "Invalid input type rejection" "FAIL"
fi

# Invalid scope
response=$(make_request "create-post" "{\"content\": \"Test post\", \"inputType\": \"action\", \"scope\": \"invalid\"}" "400")
if echo "$response" | grep -q "invalid\|error"; then
    log_test "Invalid scope rejection" "PASS"
else
    log_test "Invalid scope rejection" "FAIL"
fi

# Missing required fields
response=$(make_request "create-post" "{\"inputType\": \"action\", \"scope\": \"world\"}" "400")
if echo "$response" | grep -q "required\|missing"; then
    log_test "Missing content field rejection" "PASS"
else
    log_test "Missing content field rejection" "FAIL"
fi
echo ""

echo -e "${BLUE}Step 8: Security Testing${NC}"
echo "======================="
echo ""

# Test SQL injection attempts
echo -e "${YELLOW}Testing SQL Injection Protection...${NC}"
SQL_INJECTION_POSTS=(
    'Test\'; DROP TABLE posts; --'
    'Test\"; DELETE FROM posts; --'
    'Test\'; UPDATE posts SET content = \'hacked\'; --'
    'Test\'; SELECT * FROM users; --'
)

for post in "${SQL_INJECTION_POSTS[@]}"; do
    response=$(make_request "create-post" "{\"content\": \"$post\", \"inputType\": \"action\", \"scope\": \"world\"}" "200")
    if echo "$response" | grep -q '"success":true'; then
        log_test "SQL injection protection: '$post'" "PASS"
    else
        log_test "SQL injection protection: '$post'" "FAIL"
        echo "Response: $response"
    fi
done
echo ""

# Test XSS attempts
echo -e "${YELLOW}Testing XSS Protection...${NC}"
XSS_POSTS=(
    'Test<script>alert("xss")</script>'
    'Test<img src=x onerror=alert("xss")>'
    'Test<iframe src="javascript:alert(\'xss\')"></iframe>'
    'Test<a href="javascript:alert(\'xss\')">Click</a>'
)

for post in "${XSS_POSTS[@]}"; do
    response=$(make_request "create-post" "{\"content\": \"$post\", \"inputType\": \"action\", \"scope\": \"world\"}" "200")
    if echo "$response" | grep -q '"success":true'; then
        log_test "XSS protection: '$post'" "PASS"
    else
        log_test "XSS protection: '$post'" "FAIL"
        echo "Response: $response"
    fi
done
echo ""

echo -e "${BLUE}Step 9: Fetch Posts API Testing${NC}"
echo "================================="
echo ""

# Test fetch posts with different filters
echo -e "${YELLOW}Testing Fetch Posts API...${NC}"

# Test basic fetch
response=$(curl -s "$API_URL/functions/v1/fetch-posts?limit=5")
if echo "$response" | grep -q '"success":true'; then
    log_test "Basic fetch posts" "PASS"
else
    log_test "Basic fetch posts" "FAIL"
fi

# Test with filters
response=$(curl -s "$API_URL/functions/v1/fetch-posts?tier=elite&limit=5")
if echo "$response" | grep -q '"success":true'; then
    log_test "Fetch posts with tier filter" "PASS"
else
    log_test "Fetch posts with tier filter" "FAIL"
fi

# Test with scope filter
response=$(curl -s "$API_URL/functions/v1/fetch-posts?scope=world&limit=5")
if echo "$response" | grep -q '"success":true'; then
    log_test "Fetch posts with scope filter" "PASS"
else
    log_test "Fetch posts with scope filter" "FAIL"
fi

# Test with input type filter
response=$(curl -s "$API_URL/functions/v1/fetch-posts?inputType=day&limit=5")
if echo "$response" | grep -q '"success":true'; then
    log_test "Fetch posts with input type filter" "PASS"
else
    log_test "Fetch posts with input type filter" "FAIL"
fi
echo ""

echo -e "${BLUE}Step 10: Analytics and Stats Testing${NC}"
echo "====================================="
echo ""

# Test analytics functions
echo -e "${YELLOW}Testing Analytics Functions...${NC}"

# Test global stats
response=$(curl -s "$API_URL/rest/v1/rpc/get_global_stats")
if echo "$response" | grep -q "total_posts_today\|total_users"; then
    log_test "Global stats function" "PASS"
else
    log_test "Global stats function" "FAIL"
fi

# Test user stats
response=$(curl -s "$API_URL/rest/v1/rpc/get_user_stats" \
  -H "apikey: $ANON_KEY" \
  -H "Authorization: Bearer $ACCESS_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"p_user_id": "dbaa1b33-e205-41c3-8a4a-9386d364b54c"}')
if echo "$response" | grep -q "total_posts\|elite_posts"; then
    log_test "User stats function" "PASS"
else
    log_test "User stats function" "FAIL"
fi
echo ""

echo -e "${BLUE}Step 11: Performance Testing${NC}"
echo "============================="
echo ""

# Test response times
echo -e "${YELLOW}Testing Response Times...${NC}"

start_time=$(date +%s%3N)
response=$(make_request "create-post" "{\"content\": \"Performance test post\", \"inputType\": \"action\", \"scope\": \"world\"}" "200")
end_time=$(date +%s%3N)
duration=$((end_time - start_time))

if [ $duration -lt 2000 ]; then  # Less than 2 seconds
    log_test "Response time: ${duration}ms" "PASS"
else
    log_test "Response time: ${duration}ms" "FAIL"
fi
echo ""

# Final Results
echo "===================================================="
echo -e "${BLUE}FINAL TEST RESULTS${NC}"
echo "===================================================="
echo ""
echo -e "Total Tests: $TOTAL_TESTS"
echo -e "${GREEN}Passed: $PASSED_TESTS${NC}"
echo -e "${RED}Failed: $FAILED_TESTS${NC}"
echo ""

if [ $FAILED_TESTS -eq 0 ]; then
    echo -e "${GREEN}🎉 ALL TESTS PASSED! Your backend is production-ready! 🚀${NC}"
    exit 0
else
    echo -e "${RED}⚠️  Some tests failed. Please review and fix before production deployment.${NC}"
    exit 1
fi
