#!/bin/bash

# Day Summary Test - Testing day summary posts specifically
# Tests both good and bad day summaries with moderation

set -e

BASE_URL="http://localhost:54321/functions/v1"

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
PURPLE='\033[0;35m'
CYAN='\033[0;36m'
NC='\033[0m' # No Color

# Day Summary Test Data
GOOD_DAY_SUMMARIES=(
    "Today I had a productive day at work, completed my project, and went for a relaxing walk in the park"
    "Spent the day learning a new programming language and built a small web application"
    "Had a wonderful day with family, cooked dinner together, and watched a movie"
    "Today was amazing - I finished reading a great book and started learning guitar"
    "Had a busy but fulfilling day - attended meetings, helped a colleague, and went to the gym"
    "Spent the day exploring a new city, tried local food, and met interesting people"
    "Today I organized my workspace, planned my week, and spent quality time with friends"
    "Had a creative day - painted a picture, wrote in my journal, and listened to music"
    "Today was about self-care - got a massage, read a book, and took a long bath"
    "Spent the day volunteering at a local shelter and felt really good about helping others"
    "Today I learned to cook a new recipe, called my parents, and went for a bike ride"
    "Had a peaceful day - meditated, did yoga, and spent time in nature"
    "Today was about growth - attended a workshop, networked with professionals, and set new goals"
    "Spent the day decluttering my home, donating old clothes, and feeling more organized"
    "Today I tried a new hobby, met up with old friends, and had deep conversations"
)

BAD_DAY_SUMMARIES=(
    "Today I was lazy and did nothing productive all day long"
    "Had a terrible day, everything went wrong, and I hate my life"
    "Today I wasted time on social media and felt like a failure"
    "Spent the day being angry at everyone and everything around me"
    "Today was the worst day ever, nothing good happened, and I want to give up"
    "Had a boring day, did nothing interesting, and felt completely unmotivated"
    "Today I procrastinated all day and now I feel guilty and worthless"
    "Spent the day complaining about everything and being negative"
    "Today was a complete waste of time and I accomplished nothing meaningful"
    "Had a depressing day, felt lonely, and questioned my entire existence"
    "Today I was mean to people and now I feel bad about myself"
    "Spent the day being jealous of others and feeling inadequate"
    "Today I made bad decisions and now I regret everything I did"
    "Had a stressful day, got into arguments, and felt overwhelmed"
    "Today was chaotic, nothing went as planned, and I feel like a mess"
)

# Function to create a day summary post with detailed timing
create_day_summary_with_timing() {
    local post_id=$1
    local content="$2"
    local content_type="$3"
    
    echo -e "${BLUE}📅 Starting day summary $post_id ($content_type): \"$content\"${NC}"
    
    local start_time=$(date +%s.%N)
    local response=$(curl -s -w "%{http_code}|%{time_total}" \
        -X POST "$BASE_URL/create-post" \
        -H "Content-Type: application/json" \
        -H "x-application-name: onlyone-mobile" \
        -d "{
            \"content\": \"$content\",
            \"inputType\": \"day\",
            \"isAnonymous\": false,
            \"scope\": \"world\"
        }")
    local end_time=$(date +%s.%N)
    
    local http_code=$(echo "$response" | grep -o '[0-9]*|[0-9.]*$' | cut -d'|' -f1)
    local curl_time=$(echo "$response" | grep -o '[0-9]*|[0-9.]*$' | cut -d'|' -f2)
    local total_time=$(echo "$end_time - $start_time" | bc)
    
    # Check if post was successful
    local success=$(echo "$response" | grep -o '"success":[^,}]*' | cut -d':' -f2 | tr -d ' "')
    local error_message=$(echo "$response" | grep -o '"error":"[^"]*"' | cut -d'"' -f4)
    
    # Extract percentile and tier from response
    local percentile=$(echo "$response" | grep -o '"percentile":[^,}]*' | cut -d':' -f2 | tr -d ' "')
    local tier=$(echo "$response" | grep -o '"tier":"[^"]*"' | cut -d'"' -f4)
    
    if [ "$success" = "true" ]; then
        echo -e "   ${GREEN}✅ Day Summary $post_id ($content_type) completed in ${curl_time}s${NC}"
        echo -e "   ${CYAN}📊 Result: $tier tier, $percentile% percentile${NC}"
    else
        echo -e "   ${RED}❌ Day Summary $post_id ($content_type) REJECTED in ${curl_time}s: $error_message${NC}"
    fi
    
    echo "$post_id,$http_code,$curl_time,$total_time,$success,$content_type,\"$error_message\",$percentile,$tier"
}

# Function to run day summary test
run_day_summary_test() {
    local test_name="$1"
    local num_posts=$2
    
    echo -e "${PURPLE}📅 $test_name ($num_posts day summaries)${NC}"
    echo -e "${YELLOW}📊 Day summary performance with moderation:${NC}"
    
    local results_file="/tmp/day_summary_test_$$"
    local pids=()
    local start_time=$(date +%s.%N)
    
    # Start concurrent requests with mixed day summaries
    for i in $(seq 1 $num_posts); do
        # Alternate between good and bad day summaries
        if [ $((i % 2)) -eq 0 ]; then
            content="${BAD_DAY_SUMMARIES[$((i % ${#BAD_DAY_SUMMARIES[@]}))]}"
            content_type="BAD"
        else
            content="${GOOD_DAY_SUMMARIES[$((i % ${#GOOD_DAY_SUMMARIES[@]}))]}"
            content_type="GOOD"
        fi
        
        create_day_summary_with_timing $i "$content" "$content_type" >> "$results_file" &
        pids+=($!)
    done
    
    # Wait for all requests to complete
    for pid in "${pids[@]}"; do
        wait $pid
    done
    
    local end_time=$(date +%s.%N)
    local total_test_time=$(echo "$end_time - $start_time" | bc)
    
    # Analyze results
    local total=$(wc -l < "$results_file")
    local success_count=0
    local rejected_count=0
    local good_success=0
    local bad_success=0
    local bad_rejected=0
    local total_curl_time=0
    local total_processing_time=0
    local min_time=999
    local max_time=0
    
    # Track tier distribution
    local elite_count=0
    local rare_count=0
    local unique_count=0
    local notable_count=0
    local common_count=0
    local popular_count=0
    
    while IFS=',' read -r id http_code curl_time total_time success content_type error_message percentile tier; do
        if [ "$success" = "true" ]; then
            success_count=$((success_count + 1))
            if [ "$content_type" = "GOOD" ]; then
                good_success=$((good_success + 1))
            else
                bad_success=$((bad_success + 1))
            fi
            total_curl_time=$(echo "$total_curl_time + $curl_time" | bc)
            total_processing_time=$(echo "$total_processing_time + $total_time" | bc)
            
            # Track tier distribution
            case "$tier" in
                "elite") elite_count=$((elite_count + 1)) ;;
                "rare") rare_count=$((rare_count + 1)) ;;
                "unique") unique_count=$((unique_count + 1)) ;;
                "notable") notable_count=$((notable_count + 1)) ;;
                "common") common_count=$((common_count + 1)) ;;
                "popular") popular_count=$((popular_count + 1)) ;;
            esac
            
            # Track min/max times
            if (( $(echo "$curl_time < $min_time" | bc -l) )); then
                min_time=$curl_time
            fi
            if (( $(echo "$curl_time > $max_time" | bc -l) )); then
                max_time=$curl_time
            fi
        else
            rejected_count=$((rejected_count + 1))
            if [ "$content_type" = "BAD" ]; then
                bad_rejected=$((bad_rejected + 1))
            fi
        fi
    done < "$results_file"
    
    # Calculate averages
    local avg_curl_time=0
    local avg_processing_time=0
    if [ $success_count -gt 0 ]; then
        avg_curl_time=$(echo "scale=3; $total_curl_time / $success_count" | bc)
        avg_processing_time=$(echo "scale=3; $total_processing_time / $success_count" | bc)
    fi
    
    # Display summary
    echo -e "\n${GREEN}📈 Day Summary Performance Summary:${NC}"
    echo -e "   ${GREEN}✅ Successful: $success_count/$total${NC}"
    echo -e "   ${RED}❌ Rejected: $rejected_count/$total${NC}"
    echo -e "   ${CYAN}📊 Good Day Summaries: $good_success successful${NC}"
    echo -e "   ${CYAN}📊 Bad Day Summaries: $bad_success successful, $bad_rejected rejected${NC}"
    echo -e "   ${BLUE}⏱️  Test Duration: $(printf "%.2f" $total_test_time)s${NC}"
    echo -e "   ${BLUE}📊 Avg Response Time: $(printf "%.3f" $avg_curl_time)s${NC}"
    echo -e "   ${BLUE}📊 Min Response Time: $(printf "%.3f" $min_time)s${NC}"
    echo -e "   ${BLUE}📊 Max Response Time: $(printf "%.3f" $max_time)s${NC}"
    echo -e "   ${BLUE}📊 Avg Processing Time: $(printf "%.3f" $avg_processing_time)s${NC}"
    
    # Display tier distribution
    echo -e "\n${PURPLE}🏆 Tier Distribution:${NC}"
    echo -e "   ${GREEN}🏆 Elite: $elite_count${NC}"
    echo -e "   ${YELLOW}🌟 Rare: $rare_count${NC}"
    echo -e "   ${BLUE}💎 Unique: $unique_count${NC}"
    echo -e "   ${CYAN}⭐ Notable: $notable_count${NC}"
    echo -e "   ${PURPLE}📝 Common: $common_count${NC}"
    echo -e "   ${RED}🔥 Popular: $popular_count${NC}"
    
    # Show individual results
    echo -e "\n${YELLOW}📋 Individual Day Summary Results:${NC}"
    while IFS=',' read -r id http_code curl_time total_time success content_type error_message percentile tier; do
        if [ "$success" = "true" ]; then
            echo -e "   Day Summary $id ($content_type): $(printf "%.3f" $curl_time)s - $tier ($percentile%)"
        else
            echo -e "   Day Summary $id ($content_type): ${RED}REJECTED${NC} - $error_message"
        fi
    done < "$results_file"
    
    rm -f "$results_file"
    echo ""
}

# Main execution
main() {
    echo -e "${GREEN}📅 OnlyOne.Today Day Summary Test${NC}"
    echo -e "${BLUE}===================================${NC}\n"
    
    # Check server
    if ! curl -s "$BASE_URL/create-post" > /dev/null; then
        echo -e "${RED}❌ Server not running!${NC}"
        exit 1
    fi
    echo -e "${GREEN}✅ Server is running${NC}\n"
    
    # Run tests
    run_day_summary_test "Small Day Summary Test" 10
    run_day_summary_test "Medium Day Summary Test" 20
    run_day_summary_test "Large Day Summary Test" 30
    
    echo -e "${GREEN}🎉 Day summary testing completed!${NC}"
    echo -e "${BLUE}💡 Key Insights:${NC}"
    echo -e "   • Day summary moderation performance"
    echo -e "   • Good vs bad day summary processing"
    echo -e "   • Tier distribution for day summaries"
    echo -e "   • Response times for longer content"
    echo -e "   • Moderation effectiveness on personal content"
}

main "$@"
