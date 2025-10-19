#!/bin/bash

# OnlyOne.Today Load Testing Script
# Tests concurrent post creation and feed fetching

set -e

BASE_URL="http://localhost:54321/functions/v1"
AUTH_TOKEN="eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZS1kZW1vIiwicm9sZSI6ImFub24iLCJleHAiOjE5ODM4MTI5OTZ9.CRXP1A7WOeoJeXxjNni433kdQwgnWNReilDMblYTn_I0"

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

# Function to create a single post
create_post() {
    local post_id=$1
    local content="${POSTS[$((post_id % ${#POSTS[@]}))]}"
    local start_time=$(date +%s.%N)
    
    response=$(curl -s -w "\n%{http_code}\n%{time_total}" \
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
    local duration=$(echo "$end_time - $start_time" | bc)
    local http_code=$(echo "$response" | tail -n 2 | head -n 1)
    local curl_time=$(echo "$response" | tail -n 1)
    local body=$(echo "$response" | head -n -2)
    
    echo "$post_id,$http_code,$curl_time,$duration,$content"
}

# Function to fetch feed
fetch_feed() {
    local feed_id=$1
    local start_time=$(date +%s.%N)
    
    response=$(curl -s -w "\n%{http_code}\n%{time_total}" \
        -X GET "$BASE_URL/fetch-posts?scope=world&tier=all&reactionFilter=all&page=1&limit=10")
    
    local end_time=$(date +%s.%N)
    local duration=$(echo "$end_time - $start_time" | bc)
    local http_code=$(echo "$response" | tail -n 2 | head -n 1)
    local curl_time=$(echo "$response" | tail -n 1)
    
    echo "$feed_id,$http_code,$curl_time,$duration,feed"
}

# Function to run concurrent tests
run_load_test() {
    local concurrent_users=$1
    local test_type=$2
    local test_name=$3
    
    echo -e "${BLUE}🚀 Starting $test_name with $concurrent_users concurrent users...${NC}"
    
    # Create temporary files for results
    local results_file="/tmp/load_test_results_$$"
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
    echo -e "${YELLOW}⏳ Waiting for all $concurrent_users requests to complete...${NC}"
    for pid in "${pids[@]}"; do
        wait $pid
    done
    
    # Analyze results
    echo -e "${GREEN}📊 Analyzing results...${NC}"
    
    local total_requests=$(wc -l < "$results_file")
    local successful_requests=$(grep -c ",200," "$results_file" || echo "0")
    local failed_requests=$((total_requests - successful_requests))
    
    # Calculate response times
    local avg_time=$(awk -F',' '{sum+=$3} END {print sum/NR}' "$results_file")
    local min_time=$(awk -F',' 'NR==1{min=$3} {if($3<min) min=$3} END {print min}' "$results_file")
    local max_time=$(awk -F',' 'NR==1{max=$3} {if($3>max) max=$3} END {print max}' "$results_file")
    
    # Calculate percentiles
    local p50=$(sort -t',' -k3 -n "$results_file" | awk -F',' 'NR==int(NR*0.5)+1{print $3}')
    local p95=$(sort -t',' -k3 -n "$results_file" | awk -F',' 'NR==int(NR*0.95)+1{print $3}')
    local p99=$(sort -t',' -k3 -n "$results_file" | awk -F',' 'NR==int(NR*0.99)+1{print $3}')
    
    # Display results
    echo -e "\n${GREEN}✅ $test_name Results:${NC}"
    echo -e "   Total Requests: $total_requests"
    echo -e "   Successful: $successful_requests"
    echo -e "   Failed: $failed_requests"
    echo -e "   Success Rate: $(echo "scale=2; $successful_requests * 100 / $total_requests" | bc)%"
    echo -e "\n${BLUE}📈 Response Times (seconds):${NC}"
    echo -e "   Average: $(printf "%.3f" $avg_time)s"
    echo -e "   Minimum: $(printf "%.3f" $min_time)s"
    echo -e "   Maximum: $(printf "%.3f" $max_time)s"
    echo -e "   50th percentile: $(printf "%.3f" $p50)s"
    echo -e "   95th percentile: $(printf "%.3f" $p95)s"
    echo -e "   99th percentile: $(printf "%.3f" $p99)s"
    
    # Show failed requests
    if [ $failed_requests -gt 0 ]; then
        echo -e "\n${RED}❌ Failed Requests:${NC}"
        grep -v ",200," "$results_file" | head -5
    fi
    
    # Cleanup
    rm -f "$results_file"
    
    echo -e "\n${YELLOW}⏸️  Waiting 5 seconds before next test...${NC}"
    sleep 5
}

# Main execution
main() {
    echo -e "${GREEN}🎯 OnlyOne.Today Load Testing Suite${NC}"
    echo -e "${BLUE}=====================================${NC}\n"
    
    # Check if server is running
    echo -e "${YELLOW}🔍 Checking if server is running...${NC}"
    if ! curl -s "$BASE_URL/create-post" > /dev/null; then
        echo -e "${RED}❌ Server is not running! Please start with:${NC}"
        echo -e "   supabase functions serve --env-file .env.local --no-verify-jwt"
        exit 1
    fi
    echo -e "${GREEN}✅ Server is running${NC}\n"
    
    # Test scenarios
    echo -e "${BLUE}🧪 Running Load Tests...${NC}\n"
    
    # Post Creation Tests
    run_load_test 5 "create" "Post Creation (5 users)"
    run_load_test 10 "create" "Post Creation (10 users)"
    run_load_test 20 "create" "Post Creation (20 users)"
    run_load_test 50 "create" "Post Creation (50 users)"
    
    # Feed Fetching Tests
    run_load_test 10 "fetch" "Feed Fetching (10 users)"
    run_load_test 25 "fetch" "Feed Fetching (25 users)"
    run_load_test 50 "fetch" "Feed Fetching (50 users)"
    
    # Mixed Load Test
    echo -e "${BLUE}🔄 Running Mixed Load Test (25 creates + 25 fetches)...${NC}"
    
    # Start feed fetches in background
    for i in $(seq 1 25); do
        fetch_feed $i >> "/tmp/mixed_feed_$$" &
    done
    
    # Start post creations
    for i in $(seq 1 25); do
        create_post $i >> "/tmp/mixed_create_$$" &
    done
    
    # Wait for all to complete
    wait
    
    # Analyze mixed results
    echo -e "${GREEN}📊 Mixed Load Test Results:${NC}"
    
    local create_total=$(wc -l < "/tmp/mixed_create_$$")
    local create_success=$(grep -c ",200," "/tmp/mixed_create_$$" || echo "0")
    local feed_total=$(wc -l < "/tmp/mixed_feed_$$")
    local feed_success=$(grep -c ",200," "/tmp/mixed_feed_$$" || echo "0")
    
    echo -e "   Post Creation: $create_success/$create_total successful"
    echo -e "   Feed Fetching: $feed_success/$feed_total successful"
    
    # Cleanup
    rm -f "/tmp/mixed_create_$$" "/tmp/mixed_feed_$$"
    
    echo -e "\n${GREEN}🎉 Load testing completed!${NC}"
    echo -e "${BLUE}💡 Check the logs above for performance insights${NC}"
}

# Run the tests
main "$@"
