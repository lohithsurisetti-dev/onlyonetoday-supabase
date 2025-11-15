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

echo -e "${CYAN}🔍 Testing Which API is Used for Dream Interpretations${NC}"
echo "============================================================"
echo ""

# Check which keys are set
echo -e "${YELLOW}API Keys Status:${NC}"
if [ -f .env.local ]; then
  if grep -q "GEMINI_API_KEY=" .env.local && ! grep -q "GEMINI_API_KEY=$" .env.local; then
    echo -e "  ${GREEN}✅ GEMINI_API_KEY: Set${NC}"
  else
    echo -e "  ${RED}❌ GEMINI_API_KEY: Not set${NC}"
  fi
  
  if grep -q "HUGGINGFACE_API_KEY=" .env.local && ! grep -q "HUGGINGFACE_API_KEY=$" .env.local; then
    echo -e "  ${GREEN}✅ HUGGINGFACE_API_KEY: Set${NC}"
  else
    echo -e "  ${RED}❌ HUGGINGFACE_API_KEY: Not set${NC}"
  fi
  
  if grep -q "OPENAI_API_KEY=" .env.local && ! grep -q "OPENAI_API_KEY=$" .env.local; then
    echo -e "  ${GREEN}✅ OPENAI_API_KEY: Set${NC}"
  else
    echo -e "  ${RED}❌ OPENAI_API_KEY: Not set${NC}"
  fi
else
  echo -e "  ${RED}❌ .env.local file not found${NC}"
fi

echo ""
echo -e "${YELLOW}Expected Priority Order:${NC}"
echo "  1. 🆓 Gemini API (free)"
echo "  2. 🆓 Hugging Face API (free)"
echo "  3. 💰 OpenAI GPT-3.5-turbo (paid)"
echo ""

echo -e "${YELLOW}Creating test dream to see which API is called...${NC}"
echo ""

# Create a dream and check response time/characteristics
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

# Check if interpretation exists
interpretation=$(echo "$response" | jq -r '.post.interpretation // null')

if [ "$interpretation" = "null" ]; then
  echo -e "${RED}❌ No interpretation found in response${NC}"
  echo "Response: $response" | jq '.' | head -20
  exit 1
fi

# Extract interpretation details
title=$(echo "$interpretation" | jq -r '.title // ""')
meaning=$(echo "$interpretation" | jq -r '.meaning // ""')
confidence=$(echo "$interpretation" | jq -r '.confidence // 0')

echo -e "${CYAN}============================================================${NC}"
echo -e "${CYAN}📊 Interpretation Received${NC}"
echo -e "${CYAN}============================================================${NC}"
echo ""
echo -e "${GREEN}Title:${NC} $title"
echo -e "${GREEN}Confidence:${NC} $(printf "%.0f%%" $(echo "$confidence * 100" | bc))"
echo -e "${GREEN}Meaning (first 100 chars):${NC} ${meaning:0:100}..."
echo ""

# Analyze which API was likely used based on response characteristics
echo -e "${YELLOW}🔍 API Detection Analysis:${NC}"
echo ""

# Check response characteristics
if [ -n "$title" ] && [ "$title" != "Your Dream" ]; then
  echo -e "  ${GREEN}✅ Structured interpretation received${NC}"
  echo -e "  ${BLUE}   → Likely using: Gemini or OpenAI${NC}"
  echo -e "  ${BLUE}   → Hugging Face DialoGPT is less structured${NC}"
else
  echo -e "  ${YELLOW}⚠️ Generic interpretation${NC}"
  echo -e "  ${BLUE}   → Likely fallback interpretation${NC}"
fi

if (( $(echo "$confidence > 0.5" | bc -l) )); then
  echo -e "  ${GREEN}✅ High confidence score${NC}"
  echo -e "  ${BLUE}   → Likely using: Gemini or OpenAI${NC}"
else
  echo -e "  ${YELLOW}⚠️ Lower confidence score${NC}"
  echo -e "  ${BLUE}   → Could be Hugging Face or fallback${NC}"
fi

echo ""
echo -e "${CYAN}============================================================${NC}"
echo -e "${YELLOW}💡 To see exact API used, check Edge Function logs:${NC}"
echo -e "   ${BLUE}Look for messages like:${NC}"
echo -e "   - '🆓 Trying Gemini API (free)...'"
echo -e "   - '✅ Gemini API successful!'"
echo -e "   - '🆓 Trying Hugging Face API (free)...'"
echo -e "   - 'Fallback to OpenAI'"
echo ""
echo -e "${YELLOW}Check logs with:${NC}"
echo -e "   ${BLUE}supabase functions logs create-dream-post${NC}"
echo ""

