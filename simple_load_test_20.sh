#!/bin/bash

# Simple 20 Posts Load Test - Performance & Stale Data Check
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

echo "📊 Test Configuration:"
echo "- Total posts: ${#test_posts[@]}"
echo "- Unique content: 10 posts"
echo "- Duplicate content: 10 posts (to test caching)"
echo ""

# Performance tracking
successful_posts=0
failed_posts=0
total_response_time=0

echo "🔥 Starting load test..."
echo ""

for i in "${!test_posts[@]}"; do
    post_number=$((i + 1))
    content="${test_posts[$i]}"
    
    echo "📝 Post $post_number: \"$content\""
    
    # Make API call and capture response
    response=$(curl -s -w "\n%{time_total}" -X POST "http://localhost:54321/functions/v1/create-post" \
        -H "Authorization: Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZS1kZW1vIiwicm9sZSI6ImFub24iLCJleHAiOjE5ODM4MTI5OTZ9.CRXP1A7WOeoJeXxjNni43kdQwgnWNReilDMblYTn_I0" \
        -H "Content-Type: application/json" \
        -d "{\"content\": \"$content\", \"inputType\": \"action\", \"scope\": \"world\"}")
    
    # Extract response time (last line)
    response_time=$(echo "$response" | tail -n1)
    response_body=$(echo "$response" | head -n -1)
    
    # Convert response time to milliseconds
    response_time_ms=$(echo "$response_time * 1000" | bc)
    total_response_time=$(echo "$total_response_time + $response_time_ms" | bc)
    
    # Parse response
    success=$(echo "$response_body" | jq -r '.success // false')
    error=$(echo "$response_body" | jq -r '.error // "none"')
    tier=$(echo "$response_body" | jq -r '.post.tier // "unknown"')
    match_count=$(echo "$response_body" | jq -r '.post.matchCount // 0')
    percentile=$(echo "$response_body" | jq -r '.post.percentile // 0')
    
    # Check temporal analytics
    temporal_today=$(echo "$response_body" | jq -r '.temporal.today.comparison // "unknown"')
    temporal_week=$(echo "$response_body" | jq -r '.temporal.week.comparison // "unknown"')
    temporal_month=$(echo "$response_body" | jq -r '.temporal.month.comparison // "unknown"')
    
    if [ "$success" = "true" ]; then
        echo "  ✅ Success - Tier: $tier, Matches: $match_count, Percentile: $percentile%"
        echo "  ⏱️  Response time: ${response_time_ms}ms"
        echo "  📊 Temporal - Today: $temporal_today, Week: $temporal_week, Month: $temporal_month"
        
        # Check for stale data indicators
        if [ "$match_count" -gt 1 ] && [ "$temporal_today" = "Only you!" ]; then
            echo "  ⚠️  POTENTIAL STALE DATA: Match count > 1 but temporal shows 'Only you!'"
        fi
        
        if [ "$match_count" -eq 1 ] && [ "$temporal_today" != "Only you!" ]; then
            echo "  ⚠️  POTENTIAL STALE DATA: Match count = 1 but temporal shows matches"
        fi
        
        successful_posts=$((successful_posts + 1))
    else
        echo "  ❌ Failed - Error: $error"
        echo "  ⏱️  Response time: ${response_time_ms}ms"
        failed_posts=$((failed_posts + 1))
    fi
    
    echo ""
    
    # Small delay between requests
    sleep 0.5
done

echo "=================================="
echo "📊 LOAD TEST RESULTS"
echo "=================================="

# Calculate performance metrics
total_posts=$((successful_posts + failed_posts))
avg_time=$(echo "scale=2; $total_response_time / $successful_posts" | bc)

echo "📈 Performance Metrics:"
echo "- Total posts: $total_posts"
echo "- Successful posts: $successful_posts"
echo "- Failed posts: $failed_posts"
echo "- Average response time: ${avg_time}ms"
echo "- Total test time: ${total_response_time}ms"
echo ""

# Performance analysis
echo "🎯 Performance Analysis:"
if (( $(echo "$avg_time < 2000" | bc -l) )); then
    echo "✅ EXCELLENT: Average response time < 2s"
elif (( $(echo "$avg_time < 5000" | bc -l) )); then
    echo "✅ GOOD: Average response time < 5s"
elif (( $(echo "$avg_time < 10000" | bc -l) )); then
    echo "⚠️  ACCEPTABLE: Average response time < 10s"
else
    echo "❌ POOR: Average response time > 10s"
fi

echo ""
echo "🔍 Stale Data Check:"
echo "- Look for 'POTENTIAL STALE DATA' warnings above"
echo "- Check if duplicate posts show consistent results"
echo "- Verify temporal analytics match main percentile data"

echo ""
echo "✅ Load test completed!"
