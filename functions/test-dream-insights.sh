#!/bin/bash

# Test script to show dream insights
# Displays the AI-generated interpretation for a dream

set -e

# Colors for output
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
CYAN='\033[0;36m'
NC='\033[0m' # No Color

# Get Supabase URL and service key from environment or .env.local
if [ -f .env.local ]; then
  export $(grep -v '^#' .env.local | xargs)
fi

SUPABASE_URL="${SUPABASE_URL:-http://localhost:54321}"
SERVICE_KEY="${SUPABASE_SERVICE_ROLE_KEY}"

if [ -z "$SERVICE_KEY" ]; then
  echo -e "${YELLOW}❌ Error: SUPABASE_SERVICE_ROLE_KEY not found${NC}"
  echo "Please set SUPABASE_SERVICE_ROLE_KEY in .env.local or environment"
  exit 1
fi

echo -e "${CYAN}🌙 Dream Insights Test${NC}"
echo "============================================================"
echo ""

# Test dream
DREAM_CONTENT="I dreamed I was flying over a beautiful sunset, feeling completely free and at peace"
DREAM_TYPE="night_dream"
SYMBOLS='["flying","sunset","sky"]'
EMOTIONS='["freedom","peace","joy"]'
CLARITY=9

echo -e "${YELLOW}Creating dream:${NC}"
echo -e "  ${GREEN}Content:${NC} $DREAM_CONTENT"
echo -e "  ${GREEN}Type:${NC} $DREAM_TYPE"
echo -e "  ${GREEN}Symbols:${NC} $SYMBOLS"
echo -e "  ${GREEN}Emotions:${NC} $EMOTIONS"
echo -e "  ${GREEN}Clarity:${NC} $CLARITY"
echo ""

# Create dream post
response=$(curl -s -X POST \
  "${SUPABASE_URL}/functions/v1/create-dream-post" \
  -H "Authorization: Bearer ${SERVICE_KEY}" \
  -H "Content-Type: application/json" \
  -d "{
    \"content\": \"$DREAM_CONTENT\",
    \"dreamType\": \"$DREAM_TYPE\",
    \"symbols\": $SYMBOLS,
    \"emotions\": $EMOTIONS,
    \"clarity\": $CLARITY,
    \"scope\": \"world\"
  }")

# Extract interpretation
interpretation=$(echo "$response" | jq -r '.post.interpretation // null')

if [ "$interpretation" = "null" ] || [ -z "$interpretation" ]; then
  echo -e "${YELLOW}⚠️ No interpretation found in response${NC}"
  echo "Response: $response" | jq '.' | head -20
  exit 1
fi

# Display insights
echo -e "${CYAN}============================================================${NC}"
echo -e "${CYAN}🔮 DREAM INSIGHTS${NC}"
echo -e "${CYAN}============================================================${NC}"
echo ""

title=$(echo "$interpretation" | jq -r '.title // "Your Dream"')
meaning=$(echo "$interpretation" | jq -r '.meaning // ""')
guidance=$(echo "$interpretation" | jq -r '.emotionalGuidance // ""')
comfort=$(echo "$interpretation" | jq -r '.comfortMessage // ""')
advice=$(echo "$interpretation" | jq -r '.actionAdvice // ""')
hope=$(echo "$interpretation" | jq -r '.hopeMessage // ""')
isPositive=$(echo "$interpretation" | jq -r '.isPositive // false')
confidence=$(echo "$interpretation" | jq -r '.confidence // 0')

echo -e "${BLUE}📖 ${title}${NC}"
echo ""
echo -e "${GREEN}Meaning:${NC}"
echo -e "  $meaning"
echo ""

if [ -n "$guidance" ]; then
  echo -e "${GREEN}Emotional Guidance:${NC}"
  echo -e "  $guidance"
  echo ""
fi

if [ -n "$comfort" ]; then
  echo -e "${GREEN}Comfort Message:${NC}"
  echo -e "  $comfort"
  echo ""
fi

if [ -n "$advice" ]; then
  echo -e "${GREEN}Action Advice:${NC}"
  echo -e "  $advice"
  echo ""
fi

if [ -n "$hope" ]; then
  echo -e "${GREEN}Message of Hope:${NC}"
  echo -e "  $hope"
  echo ""
fi

echo -e "${CYAN}---${NC}"
echo -e "${YELLOW}Confidence:${NC} $(printf "%.0f%%" $(echo "$confidence * 100" | bc))"
echo -e "${YELLOW}Tone:${NC} $([ "$isPositive" = "true" ] && echo "Positive ✨" || echo "Reflective 🤔")"
echo ""

echo -e "${CYAN}============================================================${NC}"
echo -e "${GREEN}✅ Dream insights generated successfully!${NC}"
echo ""

