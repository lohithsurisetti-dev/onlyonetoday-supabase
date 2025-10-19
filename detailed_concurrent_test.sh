#!/bin/bash

# Detailed Concurrent Test with Individual Timing
# Shows time taken for each post creation

set -e

BASE_URL="http://localhost:54321/functions/v1"

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
PURPLE='\033[0;35m'
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

# Function to create a single post with detailed timing
create_post_with_timing() {
    local post_id=$1
    local content="${POSTS[$((post_id % ${#POSTS[@]}))]}"
    
    echo -e "${BLUE}🚀 Starting post $post_id: \"$content\"${NC}"
    
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
    local total_time=$(echo "$end_time - $start_time" | bc)
    
    # Check if post was successful
    local success=$(echo "$response" | grep -o '"success":[^,}]*' | cut -d':' -f2 | tr -d ' "')
    
    if [ "$success" = "true" ]; then
        echo -e "   ${GREEN}✅ Post $post_id completed in ${curl_time}s (total: ${total_time}s)${NC}"
    else
        echo -e "   ${RED}❌ Post $post_id failed (${curl_time}s)${NC}"
    fi
    
    echo "$post_id,$http_code,$curl_time,$total_time,$success"
}

# Function to run concurrent test with detailed timing
run_concurrent_test() {
    local concurrent_users=$1
    local test_name=$2
    
    echo -e "${PURPLE}🎯 $test_name ($concurrent_users concurrent users)${NC}"
    echo -e "${YELLOW}📊 Individual post timing:${NC}"
    
    local results_file="/tmp/detailed_test_$$"
    local pids=()
    local start_time=$(date +%s.%N)
    
    # Start concurrent requests
    for i in $(seq 1 $concurrent_users); do
        create_post_with_timing $i >> "$results_file" &
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
    local total_curl_time=0
    local total_processing_time=0
    local min_time=999
    local max_time=0
    
    while IFS=',' read -r id http_code curl_time total_time success; do
        if [ "$success" = "true" ]; then
            success_count=$((success_count + 1))
            total_curl_time=$(echo "$total_curl_time + $curl_time" | bc)
            total_processing_time=$(echo "$total_processing_time + $total_time" | bc)
            
            # Track min/max times
            if (( $(echo "$curl_time < $min_time" | bc -l) )); then
                min_time=$curl_time
            fi
            if (( $(echo "$curl_time > $max_time" | bc -l) )); then
                max_time=$curl_time
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
    echo -e "\n${GREEN}📈 Performance Summary:${NC}"
    echo -e "   ${GREEN}✅ Successful: $success_count/$total${NC}"
    echo -e "   ${BLUE}⏱️  Test Duration: $(printf "%.2f" $total_test_time)s${NC}"
    echo -e "   ${BLUE}📊 Avg Response Time: $(printf "%.3f" $avg_curl_time)s${NC}"
    echo -e "   ${BLUE}📊 Min Response Time: $(printf "%.3f" $min_time)s${NC}"
    echo -e "   ${BLUE}📊 Max Response Time: $(printf "%.3f" $max_time)s${NC}"
    echo -e "   ${BLUE}📊 Avg Processing Time: $(printf "%.3f" $avg_processing_time)s${NC}"
    
    # Show individual results
    echo -e "\n${YELLOW}📋 Individual Results:${NC}"
    while IFS=',' read -r id http_code curl_time total_time success; do
        if [ "$success" = "true" ]; then
            echo -e "   Post $id: $(printf "%.3f" $curl_time)s"
        else
            echo -e "   Post $id: ${RED}FAILED${NC}"
        fi
    done < "$results_file"
    
    rm -f "$results_file"
    echo ""
}

# Main execution
main() {
    echo -e "${GREEN}🎯 OnlyOne.Today Detailed Concurrent Test${NC}"
    echo -e "${BLUE}==========================================${NC}\n"
    
    # Check server
    if ! curl -s "$BASE_URL/create-post" > /dev/null; then
        echo -e "${RED}❌ Server not running!${NC}"
        exit 1
    fi
    echo -e "${GREEN}✅ Server is running${NC}\n"
    
    # Run tests
    run_concurrent_test 5 "Small Load Test"
    run_concurrent_test 10 "Medium Load Test"
    run_concurrent_test 15 "High Load Test"
    
    echo -e "${GREEN}🎉 Detailed concurrent testing completed!${NC}"
    echo -e "${BLUE}💡 Key Insights:${NC}"
    echo -e "   • Individual post creation times"
    echo -e "   • Concurrent performance under load"
    echo -e "   • CPU optimization effectiveness"
    echo -e "   • Redis caching impact"
}

main "$@"
