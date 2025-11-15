#!/bin/bash

# Test Moderation Scenarios
# Tests all moderation checks: contact info, URLs, social media, spam, toxicity, adult content

BASE_URL="http://127.0.0.1:54321/functions/v1/create-post"
AUTH_HEADER="Authorization: Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZS1kZW1vIiwicm9sZSI6ImFub24iLCJleHAiOjE5ODM4MTI5OTZ9.CRXP1A7WOeoJeXxjNni43kdQwgnWNReilDMblYTn_I0"

echo "🧪 Testing Moderation Scenarios"
echo "=================================="
echo ""

# Test 1: Contact Info - Phone Number
echo "📞 Test 1: Phone Number (should BLOCK)"
curl -s -X POST "$BASE_URL" \
  -H "$AUTH_HEADER" \
  -H "Content-Type: application/json" \
  -d '{
    "content": "Call me at 123-456-7890",
    "inputType": "action",
    "scope": "world"
  }' | jq -r 'if .error then "❌ BLOCKED: " + .error else "✅ PASSED" end'
echo ""

# Test 2: Contact Info - Email
echo "📧 Test 2: Email Address (should BLOCK)"
curl -s -X POST "$BASE_URL" \
  -H "$AUTH_HEADER" \
  -H "Content-Type: application/json" \
  -d '{
    "content": "Email me at test@example.com",
    "inputType": "action",
    "scope": "world"
  }' | jq -r 'if .error then "❌ BLOCKED: " + .error else "✅ PASSED" end'
echo ""

# Test 3: URLs - HTTP
echo "🔗 Test 3: HTTP URL (should BLOCK)"
curl -s -X POST "$BASE_URL" \
  -H "$AUTH_HEADER" \
  -H "Content-Type: application/json" \
  -d '{
    "content": "Check out http://example.com",
    "inputType": "action",
    "scope": "world"
  }' | jq -r 'if .error then "❌ BLOCKED: " + .error else "✅ PASSED" end'
echo ""

# Test 4: URLs - HTTPS
echo "🔗 Test 4: HTTPS URL (should BLOCK)"
curl -s -X POST "$BASE_URL" \
  -H "$AUTH_HEADER" \
  -H "Content-Type: application/json" \
  -d '{
    "content": "Visit https://example.com",
    "inputType": "action",
    "scope": "world"
  }' | jq -r 'if .error then "❌ BLOCKED: " + .error else "✅ PASSED" end'
echo ""

# Test 5: URLs - WWW
echo "🌐 Test 5: WWW Domain (should BLOCK)"
curl -s -X POST "$BASE_URL" \
  -H "$AUTH_HEADER" \
  -H "Content-Type: application/json" \
  -d '{
    "content": "Go to www.example.com",
    "inputType": "action",
    "scope": "world"
  }' | jq -r 'if .error then "❌ BLOCKED: " + .error else "✅ PASSED" end'
echo ""

# Test 6: URLs - Domain Only
echo "🌐 Test 6: Domain Only (should BLOCK)"
curl -s -X POST "$BASE_URL" \
  -H "$AUTH_HEADER" \
  -H "Content-Type: application/json" \
  -d '{
    "content": "Check example.com for more info",
    "inputType": "action",
    "scope": "world"
  }' | jq -r 'if .error then "❌ BLOCKED: " + .error else "✅ PASSED" end'
echo ""

# Test 7: Social Media - @Handle
echo "📱 Test 7: Social Media Handle @username (should BLOCK)"
curl -s -X POST "$BASE_URL" \
  -H "$AUTH_HEADER" \
  -H "Content-Type: application/json" \
  -d '{
    "content": "Follow me @username",
    "inputType": "action",
    "scope": "world"
  }' | jq -r 'if .error then "❌ BLOCKED: " + .error else "✅ PASSED" end'
echo ""

# Test 8: Social Media - Platform Promotion
echo "📱 Test 8: Platform Promotion (should BLOCK)"
curl -s -X POST "$BASE_URL" \
  -H "$AUTH_HEADER" \
  -H "Content-Type: application/json" \
  -d '{
    "content": "Follow me on Instagram",
    "inputType": "action",
    "scope": "world"
  }' | jq -r 'if .error then "❌ BLOCKED: " + .error else "✅ PASSED" end'
echo ""

# Test 9: Spam - Promotional
echo "📢 Test 9: Spam - Promotional (should BLOCK)"
curl -s -X POST "$BASE_URL" \
  -H "$AUTH_HEADER" \
  -H "Content-Type: application/json" \
  -d '{
    "content": "Buy now! Limited time offer! Click here!",
    "inputType": "action",
    "scope": "world"
  }' | jq -r 'if .error then "❌ BLOCKED: " + .error else "✅ PASSED" end'
echo ""

# Test 10: Toxicity - Direct Insult
echo "💬 Test 10: Toxicity - Direct Insult (should BLOCK)"
curl -s -X POST "$BASE_URL" \
  -H "$AUTH_HEADER" \
  -H "Content-Type: application/json" \
  -d '{
    "content": "You are stupid and I hate you",
    "inputType": "action",
    "scope": "world"
  }' | jq -r 'if .error then "❌ BLOCKED: " + .error else "✅ PASSED" end'
echo ""

# Test 11: Adult Content - Explicit Terms
echo "🔞 Test 11: Adult Content (should BLOCK)"
curl -s -X POST "$BASE_URL" \
  -H "$AUTH_HEADER" \
  -H "Content-Type: application/json" \
  -d '{
    "content": "This is explicit sexual content",
    "inputType": "action",
    "scope": "world"
  }' | jq -r 'if .error then "❌ BLOCKED: " + .error else "✅ PASSED" end'
echo ""

# Test 12: Valid Content - Should PASS
echo "✅ Test 12: Valid Content (should PASS)"
curl -s -X POST "$BASE_URL" \
  -H "$AUTH_HEADER" \
  -H "Content-Type: application/json" \
  -d '{
    "content": "Made banana bread today",
    "inputType": "action",
    "scope": "world"
  }' | jq -r 'if .success then "✅ PASSED" else "❌ BLOCKED: " + (.error // "Unknown error") end'
echo ""

# Test 13: Edge Case - Phone in Context (should BLOCK but might be false positive)
echo "⚠️  Test 13: Phone in Context (should BLOCK)"
curl -s -X POST "$BASE_URL" \
  -H "$AUTH_HEADER" \
  -H "Content-Type: application/json" \
  -d '{
    "content": "I watched a 10-digit documentary",
    "inputType": "action",
    "scope": "world"
  }' | jq -r 'if .error then "❌ BLOCKED: " + .error else "✅ PASSED" end'
echo ""

# Test 14: Edge Case - Platform Name in Context (should PASS)
echo "✅ Test 14: Platform Name in Context (should PASS)"
curl -s -X POST "$BASE_URL" \
  -H "$AUTH_HEADER" \
  -H "Content-Type: application/json" \
  -d '{
    "content": "I avoided social media today",
    "inputType": "action",
    "scope": "world"
  }' | jq -r 'if .success then "✅ PASSED" else "❌ BLOCKED: " + (.error // "Unknown error") end'
echo ""

echo "=================================="
echo "✅ Moderation tests complete!"
echo ""
echo "Expected Results:"
echo "  Tests 1-11: Should BLOCK (error message)"
echo "  Tests 12, 14: Should PASS (success: true)"
echo "  Test 13: May BLOCK (false positive accepted)"

