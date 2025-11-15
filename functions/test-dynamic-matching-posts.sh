#!/bin/bash

# Test script for dynamic synonym matching in post creation
# Tests that posts with different verb tenses now match correctly

set -e

# Colors for output
GREEN='\033[0;32m'
RED='\033[0;31m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

# Get Supabase URL and service key from environment or .env.local
if [ -f .env.local ]; then
  export $(grep -v '^#' .env.local | xargs)
fi

SUPABASE_URL="${SUPABASE_URL:-http://localhost:54321}"
SERVICE_KEY="${SUPABASE_SERVICE_ROLE_KEY}"

if [ -z "$SERVICE_KEY" ]; then
  echo -e "${RED}❌ Error: SUPABASE_SERVICE_ROLE_KEY not found${NC}"
  echo "Please set SUPABASE_SERVICE_ROLE_KEY in .env.local or environment"
  exit 1
fi

echo -e "${YELLOW}🧪 Testing Dynamic Synonym Matching in Post Creation${NC}"
echo "============================================================"
echo ""

# Test cases: Posts that should match due to stemming/irregular verbs
test_cases=(
  # Test 1: Irregular verb - go/went
  '{"content":"I went to the gym today","inputType":"action","scope":"world","userId":null}'
  '{"content":"I go to the gym every day","inputType":"action","scope":"world","userId":null}'
  
  # Test 2: Irregular verb - run/ran
  '{"content":"I ran 5 miles this morning","inputType":"action","scope":"world","userId":null}'
  '{"content":"I run every morning","inputType":"action","scope":"world","userId":null}'
  
  # Test 3: Irregular verb - eat/ate
  '{"content":"I ate pizza for lunch","inputType":"action","scope":"world","userId":null}'
  '{"content":"I eat pizza sometimes","inputType":"action","scope":"world","userId":null}'
  
  # Test 4: Stemming - running/run
  '{"content":"I was running in the park","inputType":"action","scope":"world","userId":null}'
  '{"content":"I run in the park daily","inputType":"action","scope":"world","userId":null}'
  
  # Test 5: Stemming - eating/eat
  '{"content":"I am eating breakfast now","inputType":"action","scope":"world","userId":null}'
  '{"content":"I eat breakfast every day","inputType":"action","scope":"world","userId":null}'
  
  # Test 6: Irregular verb - see/saw
  '{"content":"I saw a great movie yesterday","inputType":"action","scope":"world","userId":null}'
  '{"content":"I see movies on weekends","inputType":"action","scope":"world","userId":null}'
  
  # Test 7: Irregular verb - make/made
  '{"content":"I made coffee this morning","inputType":"action","scope":"world","userId":null}'
  '{"content":"I make coffee every day","inputType":"action","scope":"world","userId":null}'
)

echo -e "${YELLOW}Creating test posts...${NC}"
echo ""

post_ids=()
for i in "${!test_cases[@]}"; do
  test_num=$((i + 1))
  echo -e "${YELLOW}Test $test_num:${NC}"
  
  response=$(curl -s -X POST \
    "${SUPABASE_URL}/functions/v1/create-post" \
    -H "Authorization: Bearer ${SERVICE_KEY}" \
    -H "Content-Type: application/json" \
    -d "${test_cases[$i]}")
  
  # Extract post ID and match count
  post_id=$(echo "$response" | grep -o '"id":"[^"]*"' | head -1 | cut -d'"' -f4 || echo "")
  match_count=$(echo "$response" | grep -o '"matchCount":[0-9]*' | cut -d':' -f2 || echo "")
  total_in_scope=$(echo "$response" | grep -o '"totalInScope":[0-9]*' | cut -d':' -f2 || echo "")
  
  if [ -n "$post_id" ]; then
    post_ids+=("$post_id")
    content=$(echo "${test_cases[$i]}" | grep -o '"content":"[^"]*"' | cut -d'"' -f4)
    echo -e "  ${GREEN}✅ Created:${NC} \"$content\""
    echo -e "  ${GREEN}   Post ID:${NC} $post_id"
    echo -e "  ${GREEN}   Match Count:${NC} $match_count"
    echo -e "  ${GREEN}   Total in Scope:${NC} $total_in_scope"
    
    if [ -n "$match_count" ] && [ "$match_count" -gt 1 ]; then
      echo -e "  ${GREEN}   🎉 Found matches! (Dynamic matching working)${NC}"
    fi
  else
    echo -e "  ${RED}❌ Failed to create post${NC}"
    echo "  Response: $response"
  fi
  echo ""
done

echo "============================================================"
echo -e "${YELLOW}📊 Summary${NC}"
echo "Created ${#post_ids[@]} posts"
echo ""
echo -e "${YELLOW}Expected Matches:${NC}"
echo "1. 'went to gym' should match 'go to gym' (irregular verb: go/went)"
echo "2. 'ran' should match 'run' (irregular verb: run/ran)"
echo "3. 'ate pizza' should match 'eat pizza' (irregular verb: eat/ate)"
echo "4. 'running' should match 'run' (stemming: running → run)"
echo "5. 'eating' should match 'eat' (stemming: eating → eat)"
echo "6. 'saw movie' should match 'see movies' (irregular verb: see/saw)"
echo "7. 'made coffee' should match 'make coffee' (irregular verb: make/made)"
echo ""
echo -e "${YELLOW}Check the match counts above - they should be > 1 if matching works!${NC}"
echo ""

