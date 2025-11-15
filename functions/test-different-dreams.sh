#!/bin/bash

# Test that different dreams generate different insights/interpretations

set -e

# Colors
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
CYAN='\033[0;36m'
RED='\033[0;31m'
NC='\033[0m'

SUPABASE_URL="${SUPABASE_URL:-http://localhost:54321}"
SERVICE_KEY="${SUPABASE_SERVICE_ROLE_KEY:-eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZS1kZW1vIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImV4cCI6MTk4MzgxMjk5Nn0.EGIM96RAZx35lJzdJsyH-qQwv8Hdp7fsn3W0YpN81IU}"

echo -e "${CYAN}🌙 Testing Different Dreams Generate Unique Insights${NC}"
echo "============================================================"
echo ""

# Test dreams with different themes
test_dreams=(
  '{"content":"I dreamed I was flying over mountains at sunset, feeling completely free","dreamType":"night_dream","symbols":["flying","mountains","sunset"],"emotions":["freedom","joy","peace"],"clarity":9,"scope":"world"}'
  '{"content":"I had a nightmare about being chased by something dark in an abandoned building","dreamType":"nightmare","symbols":["darkness","running","building"],"emotions":["fear","anxiety","panic"],"clarity":6,"scope":"world"}'
  '{"content":"I dreamed I was swimming in a crystal clear ocean with dolphins","dreamType":"night_dream","symbols":["water","ocean","dolphins"],"emotions":["peace","wonder","joy"],"clarity":8,"scope":"world"}'
  '{"content":"I dreamed I was back in my childhood home, everything felt familiar and safe","dreamType":"night_dream","symbols":["home","childhood","familiar"],"emotions":["nostalgia","peace","love"],"clarity":7,"scope":"world"}'
  '{"content":"I had a lucid dream where I could control everything, I was creating beautiful landscapes","dreamType":"lucid_dream","symbols":["control","creation","landscapes"],"emotions":["power","wonder","excitement"],"clarity":10,"scope":"world"}'
)

dream_titles=()
dream_meanings=()
dream_guidance=()

echo -e "${YELLOW}Creating ${#test_dreams[@]} different dreams...${NC}"
echo ""

for i in "${!test_dreams[@]}"; do
  dream_num=$((i + 1))
  echo -e "${BLUE}Dream $dream_num:${NC}"
  
  # Extract content preview
  content=$(echo "${test_dreams[$i]}" | jq -r '.content')
  echo -e "  ${CYAN}Content:${NC} ${content:0:60}..."
  
  # Create dream
  response=$(curl -s -X POST \
    "${SUPABASE_URL}/functions/v1/create-dream-post" \
    -H "Authorization: Bearer ${SERVICE_KEY}" \
    -H "Content-Type: application/json" \
    -d "${test_dreams[$i]}")
  
  # Check if request was successful
  success=$(echo "$response" | jq -r '.success // false')
  if [ "$success" != "true" ]; then
    error=$(echo "$response" | jq -r '.error // "Unknown error"')
    echo -e "  ${RED}❌ Failed: $error${NC}"
    continue
  fi
  
  # Extract interpretation
  interpretation=$(echo "$response" | jq '.post.interpretation // null')
  
  if [ "$interpretation" = "null" ] || [ -z "$interpretation" ]; then
    echo -e "  ${RED}❌ No interpretation in response${NC}"
    continue
  fi
  
  title=$(echo "$interpretation" | jq -r '.title // ""')
  meaning=$(echo "$interpretation" | jq -r '.meaning // ""')
  guidance=$(echo "$interpretation" | jq -r '.emotionalGuidance // ""')
  
  dream_titles+=("$title")
  dream_meanings+=("$meaning")
  dream_guidance+=("$guidance")
  
  echo -e "  ${GREEN}✅ Interpretation received${NC}"
  echo ""
done

echo -e "${CYAN}============================================================${NC}"
echo -e "${CYAN}📊 Comparison: Are Interpretations Unique?${NC}"
echo -e "${CYAN}============================================================${NC}"
echo ""

# Compare titles
echo -e "${YELLOW}📖 Titles:${NC}"
unique_titles=0
for i in "${!dream_titles[@]}"; do
  echo -e "  ${BLUE}Dream $((i+1)):${NC} ${dream_titles[$i]}"
  
  # Check if this title is unique
  is_unique=true
  for j in "${!dream_titles[@]}"; do
    if [ $i -ne $j ] && [ "${dream_titles[$i]}" = "${dream_titles[$j]}" ]; then
      is_unique=false
      break
    fi
  done
  
  if [ "$is_unique" = true ]; then
    unique_titles=$((unique_titles + 1))
  fi
done

echo ""
echo -e "${YELLOW}📝 Meanings (first 100 chars):${NC}"
unique_meanings=0
for i in "${!dream_meanings[@]}"; do
  meaning_preview="${dream_meanings[$i]:0:100}..."
  echo -e "  ${BLUE}Dream $((i+1)):${NC} $meaning_preview"
  
  # Check if this meaning is unique
  is_unique=true
  for j in "${!dream_meanings[@]}"; do
    if [ $i -ne $j ] && [ "${dream_meanings[$i]}" = "${dream_meanings[$j]}" ]; then
      is_unique=false
      break
    fi
  done
  
  if [ "$is_unique" = true ]; then
    unique_meanings=$((unique_meanings + 1))
  fi
done

echo ""
echo -e "${CYAN}============================================================${NC}"
echo -e "${YELLOW}📈 Uniqueness Analysis:${NC}"
echo ""

total_dreams=${#dream_titles[@]}
if [ $total_dreams -eq 0 ]; then
  echo -e "${RED}❌ No dreams were created successfully${NC}"
  exit 1
fi

unique_title_pct=$(echo "scale=0; ($unique_titles * 100) / $total_dreams" | bc)
unique_meaning_pct=$(echo "scale=0; ($unique_meanings * 100) / $total_dreams" | bc)

echo -e "  ${BLUE}Total Dreams:${NC} $total_dreams"
echo -e "  ${BLUE}Unique Titles:${NC} $unique_titles / $total_dreams (${unique_title_pct}%)"
echo -e "  ${BLUE}Unique Meanings:${NC} $unique_meanings / $total_dreams (${unique_meaning_pct}%)"
echo ""

if [ $unique_titles -eq $total_dreams ] && [ $unique_meanings -eq $total_dreams ]; then
  echo -e "${GREEN}✅ EXCELLENT: All interpretations are unique!${NC}"
  echo -e "   The AI is generating personalized insights for each dream."
elif [ $unique_title_pct -ge 80 ] && [ $unique_meaning_pct -ge 80 ]; then
  echo -e "${GREEN}✅ GOOD: Most interpretations are unique${NC}"
  echo -e "   Some similarity is expected for similar dreams."
else
  echo -e "${YELLOW}⚠️ WARNING: Many interpretations are similar${NC}"
  echo -e "   The AI might be generating generic responses."
fi

echo ""
echo -e "${CYAN}============================================================${NC}"
echo -e "${YELLOW}💡 Full Interpretations:${NC}"
echo ""

for i in "${!dream_titles[@]}"; do
  echo -e "${CYAN}--- Dream $((i+1)) ---${NC}"
  echo -e "${GREEN}Title:${NC} ${dream_titles[$i]}"
  echo -e "${GREEN}Meaning:${NC} ${dream_meanings[$i]}"
  echo -e "${GREEN}Guidance:${NC} ${dream_guidance[$i]}"
  echo ""
done

