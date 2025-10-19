#!/bin/bash

# 20 Posts Load Test - Performance & Stale Data Check
# Tests both unique and similar content to verify caching behavior

echo "🚀 Starting 20 Posts Load Test..."
echo "=================================="

# Test data - mix of unique and similar content
declare -a test_posts=(
    "I went for a morning walk in the park"
    "I went for a morning walk in the park"  # Duplicate to test caching
    "I learned to fly a helicopter today"
    "I learned to fly a helicopter today"    # Duplicate to test caching
    "I ate pizza for lunch"
    "I ate pizza for lunch"                  # Duplicate to test caching
    "I discovered a new species of butterfly in the Amazon rainforest"
    "I went for a morning walk in the park"  # Another duplicate
    "I built a website using React and TypeScript"
    "I built a website using React and TypeScript"  # Duplicate
    "I went skydiving for the first time"
    "I went skydiving for the first time"    # Duplicate
    "I cooked a three-course meal for my family"
    "I cooked a three-course meal for my family"  # Duplicate
    "I learned to play the guitar"
    "I learned to play the guitar"           # Duplicate
    "I discovered a new species of butterfly in the Amazon rainforest"  # Duplicate
    "I went for a morning walk in the park"  # Another duplicate
    "I wrote a novel in 30 days"
    "I wrote a novel in 30 days"            # Duplicate
)

# Performance tracking
declare -a response_times=()
declare -a cache_hits=()
declare -a cache_misses=()

echo "📊 Test Configuration:"
echo "- Total posts: ${#test_posts[@]}"
echo "- Unique content: 10 posts"
echo "- Duplicate content: 10 posts (to test caching)"
echo "- Expected cache hits: ~50%"
echo ""

# Function to make API call and measure performance
make_api_call() {
    local content="$1"
    local post_number="$2"
    
    echo "📝 Post $post_number: \"$content\""
    
    # Measure response time
    local start_time=$(date +%s%3N)
    
    local response=$(curl -s -X POST "http://localhost:54321/functions/v1/create-post" \
        -H "Authorization: Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZS1kZW1vIiwicm9sZSI6ImFub24iLCJleHAiOjE5ODM4MTI5OTZ9.CRXP1A7WOeoJeXxjNni43kdQwgnWNReilDMblYTn_I0" \
        -H "Content-Type: application/json" \
        -d "{\"content\": \"$content\", \"inputType\": \"action\", \"scope\": \"world\"}")
    
    local end_time=$(date +%s%3N)
    local response_time=$((end_time - start_time))
    
    # Store response time
    response_times+=($response_time)
    
    # Parse response
    local success=$(echo "$response" | jq -r '.success // false')
    local error=$(echo "$response" | jq -r '.error // "none"')
    local tier=$(echo "$response" | jq -r '.post.tier // "unknown"')
    local match_count=$(echo "$response" | jq -r '.post.matchCount // 0')
    local percentile=$(echo "$response" | jq -r '.post.percentile // 0')
    
    # Check temporal analytics
    local temporal_today=$(echo "$response" | jq -r '.temporal.today.comparison // "unknown"')
    local temporal_week=$(echo "$response" | jq -r '.temporal.week.comparison // "unknown"')
    local temporal_month=$(echo "$response" | jq -r '.temporal.month.comparison // "unknown"')
    
    if [ "$success" = "true" ]; then
        echo "  ✅ Success - Tier: $tier, Matches: $match_count, Percentile: $percentile%"
        echo "  ⏱️  Response time: ${response_time}ms"
        echo "  📊 Temporal - Today: $temporal_today, Week: $temporal_week, Month: $temporal_month"
        
        # Check for stale data indicators
        if [ "$match_count" -gt 1 ] && [ "$temporal_today" = "Only you!" ]; then
            echo "  ⚠️  POTENTIAL STALE DATA: Match count > 1 but temporal shows 'Only you!'"
        fi
        
        if [ "$match_count" -eq 1 ] && [ "$temporal_today" != "Only you!" ]; then
            echo "  ⚠️  POTENTIAL STALE DATA: Match count = 1 but temporal shows matches"
        fi
        
    else
        echo "  ❌ Failed - Error: $error"
        echo "  ⏱️  Response time: ${response_time}ms"
    fi
    
    echo ""
    
    # Small delay between requests
    sleep 0.5
}

# Run the load test
echo "🔥 Starting load test..."
echo ""

for i in "${!test_posts[@]}"; do
    make_api_call "${test_posts[$i]}" $((i + 1))
done

echo "=================================="
echo "📊 LOAD TEST RESULTS"
echo "=================================="

# Calculate performance metrics
total_posts=${#response_times[@]}
total_time=0
min_time=999999
max_time=0

for time in "${response_times[@]}"; do
    total_time=$((total_time + time))
    if [ $time -lt $min_time ]; then
        min_time=$time
    fi
    if [ $time -gt $max_time ]; then
        max_time=$time
    fi
done

avg_time=$((total_time / total_posts))

echo "📈 Performance Metrics:"
echo "- Total posts: $total_posts"
echo "- Average response time: ${avg_time}ms"
echo "- Min response time: ${min_time}ms"
echo "- Max response time: ${max_time}ms"
echo "- Total test time: ${total_time}ms"
echo ""

# Performance analysis
echo "🎯 Performance Analysis:"
if [ $avg_time -lt 2000 ]; then
    echo "✅ EXCELLENT: Average response time < 2s"
elif [ $avg_time -lt 5000 ]; then
    echo "✅ GOOD: Average response time < 5s"
elif [ $avg_time -lt 10000 ]; then
    echo "⚠️  ACCEPTABLE: Average response time < 10s"
else
    echo "❌ POOR: Average response time > 10s"
fi

if [ $max_time -lt 5000 ]; then
    echo "✅ EXCELLENT: Max response time < 5s"
elif [ $max_time -lt 10000 ]; then
    echo "✅ GOOD: Max response time < 10s"
else
    echo "⚠️  CONCERN: Max response time > 10s"
fi

echo ""
echo "🔍 Stale Data Check:"
echo "- Look for 'POTENTIAL STALE DATA' warnings above"
echo "- Check if duplicate posts show consistent results"
echo "- Verify temporal analytics match main percentile data"

echo ""
echo "✅ Load test completed!"
echo "Check the logs above for any stale data warnings or performance issues."
