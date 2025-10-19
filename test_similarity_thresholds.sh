#!/bin/bash

# Load environment variables from .env.local
if [ -f ../.env.local ]; then
  export $(cat ../.env.local | xargs)
else
  echo "Error: .env.local file not found. Please create it in the root directory."
  exit 1
fi

SUPABASE_URL="http://localhost:54321"
CREATE_POST_URL="${SUPABASE_URL}/functions/v1/create-post"

echo "🧪 Testing Similarity Thresholds - Finding the Sweet Spot"
echo "=================================================="

# Test scenarios
declare -a scenarios=(
  "Ate pizza and played football"
  "Played football and ate pizza" 
  "Are pizza and played football"
  "I ate pizza today"
  "I played football today"
  "Went to the gym"
  "Exercised at the gym"
  "Had a workout"
  "Built a website"
  "Created a website"
  "Made a website"
  "Watched a movie"
  "Saw a film"
  "Went to cinema"
  "Cooked dinner"
  "Made dinner"
  "Prepared a meal"
  "Read a book"
  "Finished reading"
  "Studied for exam"
  "Prepared for test"
  "Went shopping"
  "Bought groceries"
  "Visited the store"
)

echo "📊 Testing with current threshold (0.90) - Exact matching only"
echo "------------------------------------------------------------"

# Test current behavior (exact matching)
for scenario in "${scenarios[@]}"; do
  echo "Testing: '$scenario'"
  response=$(curl -s -X POST "$CREATE_POST_URL" \
    -H "Content-Type: application/json" \
    -H "x-application-name: onlyone-mobile" \
    -d "{\"content\": \"$scenario\", \"inputType\": \"action\", \"isAnonymous\": false, \"scope\": \"world\"}")
  
  matchCount=$(echo "$response" | jq -r '.post.matchCount // 0')
  displayText=$(echo "$response" | jq -r '.post.displayText // "N/A"')
  tier=$(echo "$response" | jq -r '.post.tier // "N/A"')
  
  echo "  → Match Count: $matchCount, Display: $displayText, Tier: $tier"
  echo ""
done

echo ""
echo "🔧 Now let's test different thresholds by modifying the code..."
echo "We'll test: 0.85, 0.80, 0.75, 0.70 to find the sweet spot"
echo ""

# Let's modify the threshold and test
echo "Testing threshold 0.85 (more lenient semantic matching)..."
