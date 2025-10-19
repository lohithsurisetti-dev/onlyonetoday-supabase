#!/bin/bash

# Load Test with Moderation for OnlyOne.Today
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

# Test data
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
    
    echo "$post_id,$http_code,$curl_time,$duration,$test_type,$success"
}

# Function to run concurrent tests
run_test() {
    local concurrent_users=$1
    local test_name=$2
    local use_moderatable=$3
    
    echo -e "${BLUE}🚀 $test_name ($concurrent_users users)${NC}"
    if [ "$use_moderatable" = "true" ]; then
        echo -e "${PURPLE}   📝 Including moderatable content${NC}"
    fi
    
    local results_file="/tmp/test_results_$$"
    local pids=()
    
    # Start concurrent requests
    for i in $(seq 1 $concurrent_users); do
        if [ "$use_moderatable" = "true" ] && [ $((i % 3)) -eq 0 ]; then
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
    local success_count=0
    local rejected_count=0
    local failed_count=0
    local total_time=0
    local time_count=0
    
    while IFS=',' read -r id http_code time duration type success; do
        if [ "$success" = "true" ]; then
            success_count=$((success_count + 1))
            total_time=$(echo "$total_time + $time" | bc)
            time_count=$((time_count + 1))
        elif [ "$success" = "false" ]; then
            rejected_count=$((rejected_count + 1))
        else
            failed_count=$((failed_count + 1))
        fi
    done < "$results_file"
    
    # Calculate averages
    local avg_time=0
    if [ $time_count -gt 0 ]; then
        avg_time=$(echo "scale=2; $total_time / $time_count" | bc)
    fi
    
    # Display results
    echo -e "   ${GREEN}✅ Successful: $success_count/$total ($(echo "scale=1; $success_count * 100 / $total" | bc)%)${NC}"
    if [ $rejected_count -gt 0 ]; then
        echo -e "   ${YELLOW}🚫 Rejected: $rejected_count/$total ($(echo "scale=1; $rejected_count * 100 / $total" | bc)%)${NC}"
    fi
    if [ $failed_count -gt 0 ]; then
        echo -e "   ${RED}❌ Failed: $failed_count/$total ($(echo "scale=1; $failed_count * 100 / $total" | bc)%)${NC}"
    fi
    
    if [ $time_count -gt 0 ]; then
        echo -e "   ${BLUE}📊 Avg Response Time: ${avg_time}s${NC}"
    fi
    
    # Show some rejected content examples
    if [ $rejected_count -gt 0 ]; then
        echo -e "   ${PURPLE}📋 Sample rejected content:${NC}"
        grep ",false" "$results_file" | head -3 | while IFS=',' read -r id http_code time duration type success; do
            echo -e "      Request $id ($type)"
        done
    fi
    
    rm -f "$results_file"
    echo ""
}

# Main execution
main() {
    echo -e "${GREEN}🎯 OnlyOne.Today Load Test with Moderation${NC}"
    echo -e "${BLUE}===========================================${NC}\n"
    
    # Check server
    if ! curl -s "$BASE_URL/create-post" > /dev/null; then
        echo -e "${RED}❌ Server not running!${NC}"
        exit 1
    fi
    echo -e "${GREEN}✅ Server is running${NC}\n"
    
    echo -e "${YELLOW}📊 Test Plan:${NC}"
    echo -e "   • Clean posts only (baseline)"
    echo -e "   • Mixed content (clean + moderatable)"
    echo -e "   • Moderation effectiveness testing"
    echo ""
    
    # Run tests
    run_test 10 "Clean Posts Only (10 users)" "false"
    run_test 15 "Mixed Content (15 users)" "true"
    run_test 20 "Mixed Content (20 users)" "true"
    run_test 30 "Mixed Content (30 users)" "true"
    
    echo -e "${GREEN}🎉 Load test with moderation completed!${NC}"
    echo -e "${BLUE}💡 Key Insights:${NC}"
    echo -e "   • Moderation effectiveness under load"
    echo -e "   • Response time impact of content filtering"
    echo -e "   • System stability with mixed workloads"
    echo -e "   • Redis caching performance for moderation"
}

main "$@"
