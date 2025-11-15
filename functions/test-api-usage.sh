#!/bin/bash

# Test which API is being used for dream interpretations

set -e

# Colors
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
CYAN='\033[0;36m'
RED='\033[0;31m'
NC='\033[0m'

SUPABASE_URL="${SUPABASE_URL:-http://localhost:54321}"
SERVICE_KEY="${SUPABASE_SERVICE_ROLE_KEY}"

echo -e "${CYAN}🧪 Testing Dream Interpretation API Usage${NC}"
echo "============================================================"
echo ""

echo -e "${YELLOW}Creating test dream...${NC}"
echo ""

# Create dream and capture response
response=$(curl -s -X POST \
  "${SUPABASE_URL}/functions/v1/create-dream-post" \
  -H "Authorization: Bearer ${SERVICE_KEY}" \
  -H "Content-Type: application/json" \
  -d '{
    "content": "I dreamed I was flying over a beautiful sunset, feeling completely free and at peace",
    "dreamType": "night_dream",
    "symbols": ["flying", "sunset", "sky"],
    "emotions": ["freedom", "peace", "joy"],
    "clarity": 9,
    "scope": "world"
  }')

# Check if successful
success=$(echo "$response" | jq -r '.success // false')

if [ "$success" != "true" ]; then
  echo -e "${RED}❌ Dream creation failed${NC}"
  echo "$response" | jq '.'
  exit 1
fi

# Extract interpretation
interpretation=$(echo "$response" | jq -r '.post.interpretation // null')

if [ "$interpretation" = "null" ]; then
  echo -e "${RED}❌ No interpretation found${NC}"
  exit 1
fi

title=$(echo "$interpretation" | jq -r '.title // ""')
meaning=$(echo "$interpretation" | jq -r '.meaning // ""')
confidence=$(echo "$interpretation" | jq -r '.confidence // 0')

echo -e "${GREEN}✅ Dream created successfully!${NC}"
echo ""
echo -e "${CYAN}📊 Interpretation Received:${NC}"
echo -e "  ${BLUE}Title:${NC} $title"
echo -e "  ${BLUE}Confidence:${NC} $(printf "%.0f%%" $(echo "$confidence * 100" | bc))"
echo -e "  ${BLUE}Meaning (preview):${NC} ${meaning:0:80}..."
echo ""

echo -e "${CYAN}============================================================${NC}"
echo -e "${YELLOW}📝 To see which API was used, check the Edge Function logs:${NC}"
echo ""
echo -e "   ${BLUE}Look for these log messages:${NC}"
echo ""
echo -e "   ${GREEN}If Gemini was used:${NC}"
echo -e "   🔍 [Dream Interpretation] Starting API selection..."
echo -e "   🆓 [Dream Interpretation] Attempting Gemini API (free)..."
echo -e "   ✅ [Dream Interpretation] SUCCESS: Using Gemini API (free)"
echo ""
echo -e "   ${GREEN}If Hugging Face was used:${NC}"
echo -e "   🆓 [Dream Interpretation] Gemini failed, attempting Hugging Face API (free)..."
echo -e "   ✅ [Dream Interpretation] SUCCESS: Using Hugging Face API (free)"
echo ""
echo -e "   ${GREEN}If OpenAI was used:${NC}"
echo -e "   💰 [Dream Interpretation] Free APIs unavailable, using OpenAI GPT-3.5-turbo (paid)"
echo -e "   ✅ [Dream Interpretation] OpenAI API successful"
echo ""
echo -e "${CYAN}============================================================${NC}"
echo ""
echo -e "${YELLOW}💡 Check logs with:${NC}"
echo -e "   ${BLUE}supabase functions logs create-dream-post --limit 50${NC}"
echo ""
echo -e "${YELLOW}Or if running locally, check the terminal where${NC}"
echo -e "   ${BLUE}supabase functions serve${NC} is running"
echo ""

