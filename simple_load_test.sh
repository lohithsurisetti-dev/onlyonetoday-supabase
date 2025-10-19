#!/bin/bash

# Simple Load Test for OnlyOne.Today
# Tests concurrent post creation and feed fetching

set -e

BASE_URL="http://localhost:54321/functions/v1"

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# Test data
POSTS=(
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
)

# Function to create a single post and measure time
create_post() {
    local post_id=$1
    local content="${POSTS[$((post_id % ${#POSTS[@]}))]}"
    
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
    
    echo "$post_id,$http_code,$curl_time,$duration,$content"
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
    
    echo "$feed_id,$http_code,$curl_time,$duration,feed"
}

# Function to run concurrent tests
run_test() {
    local concurrent_users=$1
    local test_type=$2
    local test_name=$3
    
    echo -e "${BLUE}🚀 $test_name ($concurrent_users users)${NC}"
    
    local results_file="/tmp/test_results_$$"
    local pids=()
    
    # Start concurrent requests
    for i in $(seq 1 $concurrent_users); do
        if [ "$test_type" = "create" ]; then
            create_post $i >> "$results_file" &
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
    local success=$(grep -c ",200," "$results_file" 2>/dev/null || echo "0")
    local failed=$((total - success))
    
    # Calculate response times
    local avg_time=$(awk -F',' '{sum+=$3} END {if(NR>0) print sum/NR; else print 0}' "$results_file")
    local min_time=$(awk -F',' 'NR==1{min=$3} {if($3<min) min=$3} END {print min}' "$results_file")
    local max_time=$(awk -F',' 'NR==1{max=$3} {if($3>max) max=$3} END {print max}' "$results_file")
    
    # Display results
    echo -e "   ${GREEN}✅ Success: $success/$total ($(echo "scale=1; $success * 100 / $total" | bc)%)${NC}"
    echo -e "   ${BLUE}📊 Avg: $(printf "%.2f" $avg_time)s | Min: $(printf "%.2f" $min_time)s | Max: $(printf "%.2f" $max_time)s${NC}"
    
    if [ $failed -gt 0 ]; then
        echo -e "   ${RED}❌ Failed: $failed requests${NC}"
        grep -v ",200," "$results_file" | head -3
    fi
    
    rm -f "$results_file"
    echo ""
}

# Main execution
main() {
    echo -e "${GREEN}🎯 OnlyOne.Today Load Test${NC}"
    echo -e "${BLUE}===========================${NC}\n"
    
    # Check server
    if ! curl -s "$BASE_URL/create-post" > /dev/null; then
        echo -e "${RED}❌ Server not running!${NC}"
        exit 1
    fi
    echo -e "${GREEN}✅ Server is running${NC}\n"
    
    # Run tests
    run_test 5 "create" "Post Creation (5 users)"
    run_test 10 "create" "Post Creation (10 users)"
    run_test 20 "create" "Post Creation (20 users)"
    run_test 10 "fetch" "Feed Fetching (10 users)"
    run_test 25 "fetch" "Feed Fetching (25 users)"
    
    echo -e "${GREEN}🎉 Load test completed!${NC}"
}

main "$@"
