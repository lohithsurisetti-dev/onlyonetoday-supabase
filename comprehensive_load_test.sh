#!/bin/bash

# Comprehensive Load Test for OnlyOne.Today
# Tests concurrent post creation including moderatable content

set -e

BASE_URL="http://localhost:54321/functions/v1"

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
PURPLE='\033[0;35m'
NC='\033[0m' # No Color

# Test data - mix of clean and moderatable content
CLEAN_POSTS=(
    "I learned to code today"
    "Went for a morning run"
    "Cooked a delicious meal"
    "Read an interesting book"
    "Met an old friend"
    "Tried a new restaurant"
    "Watched a great movie"
    "Played basketball with friends"
    "Visited a museum"
    "Learned a new language"
    "Built a sandcastle"
    "Went hiking in the mountains"
    "Attended a concert"
    "Volunteered at a shelter"
    "Started a new hobby"
    "Completed a puzzle"
    "Went to the beach"
    "Tried rock climbing"
    "Learned to play guitar"
    "Went stargazing"
)

MODERATABLE_POSTS=(
    "I want to kill everyone"
    "This is spam spam spam spam spam"
    "I had sex today"
    "Fuck this shit"
    "I hate all people"
    "Buy my product now! Click here!"
    "I'm going to destroy everything"
    "This is fucking stupid"
    "Kill yourself"
    "I want to murder someone"
    "This is so fucking annoying"
    "I hate this app"
    "Go die"
    "This is bullshit"
    "I'm going to blow up the world"
    "Fuck you all"
    "I want to hurt people"
    "This is garbage"
    "I hate everyone"
    "Go to hell"
)

# Function to create a single post and measure time
create_post() {
    local post_id=$1
    local content="$2"
    local test_type="$3"
    
    local start_time=$(date +%s.%N)
    local response=$(curl -s -w "%{http_code}|%{time_total}" \
        -X POST "$BASE_URL/create-post" \
        -H "Content-Type: application/json" \
        -H "x-application-name: onlyone-mobile" \
        -d "{
            \"content\": \"$content\",
            \"inputType\": \"action\",
            \"isAnonymous\": false,
            \"scope\": \"world\"
        }")
    local end_time=$(date +%s.%N)
    
    local http_code=$(echo "$response" | grep -o '[0-9]*|[0-9.]*$' | cut -d'|' -f1)
    local curl_time=$(echo "$response" | grep -o '[0-9]*|[0-9.]*$' | cut -d'|' -f2)
    local duration=$(echo "$end_time - $start_time" | bc)
    
    # Check if post was successful or rejected
    local success=$(echo "$response" | grep -o '"success":[^,}]*' | cut -d':' -f2 | tr -d ' "')
    
    echo "$post_id,$http_code,$curl_time,$duration,$test_type,$success,$content"
}

# Function to fetch feed and measure time
fetch_feed() {
    local feed_id=$1
    
    local start_time=$(date +%s.%N)
    local response=$(curl -s -w "%{http_code}|%{time_total}" \
        -X GET "$BASE_URL/fetch-posts?scope=world&tier=all&reactionFilter=all&page=1&limit=10")
    local end_time=$(date +%s.%N)
    
    local http_code=$(echo "$response" | grep -o '[0-9]*|[0-9.]*$' | cut -d'|' -f1)
    local curl_time=$(echo "$response" | grep -o '[0-9]*|[0-9.]*$' | cut -d'|' -f2)
    local duration=$(echo "$end_time - $start_time" | bc)
    
    echo "$feed_id,$http_code,$curl_time,$duration,feed,true,feed_request"
}

# Function to run concurrent tests
run_test() {
    local concurrent_users=$1
    local test_type=$2
    local test_name=$3
    local use_moderatable=$4
    
    echo -e "${BLUE}🚀 $test_name ($concurrent_users users)${NC}"
    if [ "$use_moderatable" = "true" ]; then
        echo -e "${PURPLE}   📝 Including moderatable content${NC}"
    fi
    
    local results_file="/tmp/test_results_$$"
    local pids=()
    
    # Start concurrent requests
    for i in $(seq 1 $concurrent_users); do
        if [ "$test_type" = "create" ]; then
            if [ "$use_moderatable" = "true" ] && [ $((i % 3)) -eq 0 ]; then
                # Every 3rd request uses moderatable content
                local content="${MODERATABLE_POSTS[$((i % ${#MODERATABLE_POSTS[@]}))]}"
                create_post $i "$content" "moderatable" >> "$results_file" &
            else
                # Use clean content
                local content="${CLEAN_POSTS[$((i % ${#CLEAN_POSTS[@]}))]}"
                create_post $i "$content" "clean" >> "$results_file" &
            fi
        else
            fetch_feed $i >> "$results_file" &
        fi
        pids+=($!)
    done
    
    # Wait for all requests to complete
    for pid in "${pids[@]}"; do
        wait $pid
    done
    
    # Analyze results
    local total=$(wc -l < "$results_file")
    local success=$(grep -c ",true," "$results_file" 2>/dev/null || echo "0")
    local rejected=$(grep -c ",false," "$results_file" 2>/dev/null || echo "0")
    local failed=$((total - success - rejected))
    
    # Calculate response times for successful requests
    local avg_time=$(awk -F',' '$6=="true"{sum+=$3; count++} END {if(count>0) print sum/count; else print 0}' "$results_file")
    local min_time=$(awk -F',' '$6=="true"{if(min=="" || $3<min) min=$3} END {if(min=="") print 0; else print min}' "$results_file")
    local max_time=$(awk -F',' '$6=="true"{if(max=="" || $3>max) max=$3} END {if(max=="") print 0; else print max}' "$results_file")
    
    # Display results
    echo -e "   ${GREEN}✅ Successful: $success/$total ($(echo "scale=1; $success * 100 / $total" | bc)%)${NC}"
    if [ $rejected -gt 0 ]; then
        echo -e "   ${YELLOW}🚫 Rejected: $rejected/$total ($(echo "scale=1; $rejected * 100 / $total" | bc)%)${NC}"
    fi
    if [ $failed -gt 0 ]; then
        echo -e "   ${RED}❌ Failed: $failed/$total ($(echo "scale=1; $failed * 100 / $total" | bc)%)${NC}"
    fi
    
    if [ "$avg_time" != "0" ]; then
        echo -e "   ${BLUE}📊 Avg: $(printf "%.2f" $avg_time)s | Min: $(printf "%.2f" $min_time)s | Max: $(printf "%.2f" $max_time)s${NC}"
    fi
    
    # Show some rejected content examples
    if [ $rejected -gt 0 ]; then
        echo -e "   ${PURPLE}📋 Sample rejected content:${NC}"
        grep ",false," "$results_file" | head -3 | while IFS=',' read -r id http_code time duration type success content; do
            echo -e "      \"$content\""
        done
    fi
    
    rm -f "$results_file"
    echo ""
}

# Function to run mixed load test
run_mixed_test() {
    local total_users=$1
    local create_ratio=$2  # e.g., 0.7 for 70% creates, 30% fetches
    
    local create_users=$(echo "$total_users * $create_ratio" | bc | cut -d'.' -f1)
    local fetch_users=$((total_users - create_users))
    
    echo -e "${BLUE}🔄 Mixed Load Test ($create_users creates + $fetch_users fetches)${NC}"
    echo -e "${PURPLE}   📝 Including moderatable content${NC}"
    
    local results_file="/tmp/mixed_test_$$"
    local pids=()
    
    # Start fetch requests
    for i in $(seq 1 $fetch_users); do
        fetch_feed $i >> "$results_file" &
        pids+=($!)
    done
    
    # Start create requests (mix of clean and moderatable)
    for i in $(seq 1 $create_users); do
        if [ $((i % 3)) -eq 0 ]; then
            # Every 3rd request uses moderatable content
            local content="${MODERATABLE_POSTS[$((i % ${#MODERATABLE_POSTS[@]}))]}"
            create_post $i "$content" "moderatable" >> "$results_file" &
        else
            # Use clean content
            local content="${CLEAN_POSTS[$((i % ${#CLEAN_POSTS[@]}))]}"
            create_post $i "$content" "clean" >> "$results_file" &
        fi
        pids+=($!)
    done
    
    # Wait for all requests to complete
    for pid in "${pids[@]}"; do
        wait $pid
    done
    
    # Analyze results
    local total=$(wc -l < "$results_file")
    local creates=$(grep -c ",clean\|,moderatable," "$results_file" 2>/dev/null || echo "0")
    local fetches=$(grep -c ",feed," "$results_file" 2>/dev/null || echo "0")
    local create_success=$(grep ",clean\|,moderatable," "$results_file" | grep -c ",true," 2>/dev/null || echo "0")
    local create_rejected=$(grep ",clean\|,moderatable," "$results_file" | grep -c ",false," 2>/dev/null || echo "0")
    local fetch_success=$(grep ",feed," "$results_file" | grep -c ",true," 2>/dev/null || echo "0")
    
    echo -e "   ${GREEN}📝 Post Creation: $create_success/$creates successful, $create_rejected rejected${NC}"
    echo -e "   ${GREEN}📱 Feed Fetching: $fetch_success/$fetches successful${NC}"
    
    # Show moderation effectiveness
    local moderatable_attempts=$(grep -c ",moderatable," "$results_file" 2>/dev/null || echo "0")
    local moderatable_rejected=$(grep ",moderatable," "$results_file" | grep -c ",false," 2>/dev/null || echo "0")
    
    if [ $moderatable_attempts -gt 0 ]; then
        local moderation_rate=$(echo "scale=1; $moderatable_rejected * 100 / $moderatable_attempts" | bc)
        echo -e "   ${PURPLE}🛡️ Moderation Rate: $moderatable_rejected/$moderatable_attempts ($moderation_rate%)${NC}"
    fi
    
    rm -f "$results_file"
    echo ""
}

# Main execution
main() {
    echo -e "${GREEN}🎯 OnlyOne.Today Comprehensive Load Test${NC}"
    echo -e "${BLUE}==========================================${NC}\n"
    
    # Check server
    if ! curl -s "$BASE_URL/create-post" > /dev/null; then
        echo -e "${RED}❌ Server not running!${NC}"
        exit 1
    fi
    echo -e "${GREEN}✅ Server is running${NC}\n"
    
    echo -e "${YELLOW}📊 Test Plan:${NC}"
    echo -e "   • Clean posts only (baseline)"
    echo -e "   • Mixed content (clean + moderatable)"
    echo -e "   • Feed fetching under load"
    echo -e "   • Mixed load scenarios"
    echo ""
    
    # Run tests
    run_test 10 "create" "Clean Posts Only (10 users)" "false"
    run_test 15 "create" "Mixed Content (15 users)" "true"
    run_test 20 "create" "Mixed Content (20 users)" "true"
    run_test 10 "fetch" "Feed Fetching (10 users)" "false"
    run_test 25 "fetch" "Feed Fetching (25 users)" "false"
    
    # Mixed load tests
    run_mixed_test 30 0.7  # 70% creates, 30% fetches
    run_mixed_test 40 0.6  # 60% creates, 40% fetches
    
    echo -e "${GREEN}🎉 Comprehensive load test completed!${NC}"
    echo -e "${BLUE}💡 Key Insights:${NC}"
    echo -e "   • Moderation effectiveness under load"
    echo -e "   • Response time impact of content filtering"
    echo -e "   • System stability with mixed workloads"
    echo -e "   • Redis caching performance"
}

main "$@"
