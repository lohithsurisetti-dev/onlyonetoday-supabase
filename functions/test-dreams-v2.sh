#!/bin/bash

# Test script for Dreams V2 Matching
# Tests that dreams with shared symbols, emotions, and keywords match correctly

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

echo -e "${YELLOW}🌙 Testing Dreams V2 Matching${NC}"
echo "============================================================"
echo ""

# Test cases: Dreams that should match due to shared symbols/emotions/keywords
test_cases=(
  # Test 1: Shared symbols (flying)
  '{"content":"I dreamed I was flying over mountains","dreamType":"night_dream","symbols":["flying","sky","mountains"],"emotions":["joy","freedom"],"clarity":8,"scope":"world"}'
  '{"content":"I had a dream about flying through clouds","dreamType":"night_dream","symbols":["flying","clouds","nature"],"emotions":["freedom","peace"],"clarity":7,"scope":"world"}'
  
  # Test 2: Shared emotions (fear)
  '{"content":"I dreamed I was being chased by something dark","dreamType":"nightmare","symbols":["darkness","running"],"emotions":["fear","anxiety"],"clarity":6,"scope":"world"}'
  '{"content":"I had a nightmare about being trapped","dreamType":"nightmare","symbols":["trapped","dark"],"emotions":["fear","anxiety"],"clarity":5,"scope":"world"}'
  
  # Test 3: Shared keywords (water/ocean)
  '{"content":"I dreamed about swimming in the ocean","dreamType":"night_dream","symbols":["water","swimming"],"emotions":["peace","calm"],"clarity":8,"scope":"world"}'
  '{"content":"I dreamed I was at the beach with waves","dreamType":"night_dream","symbols":["water","beach"],"emotions":["peace","joy"],"clarity":7,"scope":"world"}'
  
  # Test 4: Combined (symbols + emotions + keywords)
  '{"content":"I dreamed about flying and feeling free","dreamType":"night_dream","symbols":["flying","sky"],"emotions":["freedom","joy"],"clarity":9,"scope":"world"}'
  '{"content":"I dreamed I was soaring through the air with joy","dreamType":"night_dream","symbols":["flying","air"],"emotions":["joy","freedom"],"clarity":8,"scope":"world"}'
  
  # Test 5: Keyword matching with stemming (running/ran)
  '{"content":"I dreamed I was running through a field","dreamType":"night_dream","symbols":["running","field"],"emotions":["freedom","peace"],"clarity":7,"scope":"world"}'
  '{"content":"I dreamed I ran through meadows","dreamType":"night_dream","symbols":["running","meadow"],"emotions":["freedom","calm"],"clarity":6,"scope":"world"}'
)

echo -e "${YELLOW}Creating test dreams...${NC}"
echo ""

dream_ids=()
for i in "${!test_cases[@]}"; do
  test_num=$((i + 1))
  echo -e "${YELLOW}Test $test_num:${NC}"
  
  response=$(curl -s -X POST \
    "${SUPABASE_URL}/functions/v1/create-dream-post" \
    -H "Authorization: Bearer ${SERVICE_KEY}" \
    -H "Content-Type: application/json" \
    -d "${test_cases[$i]}")
  
  # Extract dream ID and match count
  dream_id=$(echo "$response" | grep -o '"id":"[^"]*"' | head -1 | cut -d'"' -f4 || echo "")
  match_count=$(echo "$response" | grep -o '"matchCount":[0-9]*' | cut -d':' -f2 || echo "")
  total_in_scope=$(echo "$response" | grep -o '"totalInScope":[0-9]*' | cut -d':' -f2 || echo "")
  
  if [ -n "$dream_id" ]; then
    dream_ids+=("$dream_id")
    content=$(echo "${test_cases[$i]}" | grep -o '"content":"[^"]*"' | cut -d'"' -f4)
    symbols=$(echo "${test_cases[$i]}" | grep -o '"symbols":\[[^]]*\]' | head -1 || echo "[]")
    emotions=$(echo "${test_cases[$i]}" | grep -o '"emotions":\[[^]]*\]' | head -1 || echo "[]")
    
    echo -e "  ${GREEN}✅ Created:${NC} \"$content\""
    echo -e "  ${GREEN}   Dream ID:${NC} $dream_id"
    echo -e "  ${GREEN}   Symbols:${NC} $symbols"
    echo -e "  ${GREEN}   Emotions:${NC} $emotions"
    echo -e "  ${GREEN}   Match Count:${NC} $match_count"
    echo -e "  ${GREEN}   Total in Scope:${NC} $total_in_scope"
    
    if [ -n "$match_count" ] && [ "$match_count" -gt 1 ]; then
      echo -e "  ${GREEN}   🎉 Found matches! (V2 matching working)${NC}"
    fi
  else
    echo -e "  ${RED}❌ Failed to create dream${NC}"
    echo "  Response: $response"
  fi
  echo ""
done

echo "============================================================"
echo -e "${YELLOW}📊 Summary${NC}"
echo "Created ${#dream_ids[@]} dreams"
echo ""
echo -e "${YELLOW}Expected Matches:${NC}"
echo "1. 'flying over mountains' should match 'flying through clouds' (shared symbol: flying)"
echo "2. 'chased by dark' should match 'trapped' (shared emotions: fear, anxiety)"
echo "3. 'swimming in ocean' should match 'beach with waves' (shared symbol: water + keywords)"
echo "4. 'flying and feeling free' should match 'soaring with joy' (shared symbols + emotions + keywords)"
echo "5. 'running through field' should match 'ran through meadows' (keyword matching: running/ran)"
echo ""
echo -e "${YELLOW}Check the match counts above - they should be > 1 if V2 matching works!${NC}"
echo ""

