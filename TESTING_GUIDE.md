# 🧪 End-to-End Testing Guide

## Complete Backend Testing Before Mobile Integration

---

## 📋 **Prerequisites**

### 1. Install Supabase CLI
```bash
brew install supabase/tap/supabase

# Verify installation
supabase --version
# Should show: supabase 1.x.x
```

### 2. Install Deno (for Edge Functions)
```bash
brew install deno

# Verify
deno --version
# Should show: deno 1.x.x
```

### 3. Docker Desktop (for local Supabase)
Download from: https://www.docker.com/products/docker-desktop

**Important**: Make sure Docker is running!

---

## 🚀 **Step 1: Start Local Supabase** (5 min)

```bash
cd /Users/lohithsurisetti/onlyOne.today/supabase

# Initialize Supabase (first time only)
supabase init

# Start all services (PostgreSQL, Auth, Storage, Edge Functions)
supabase start
```

**What this does:**
- ✅ Starts PostgreSQL with pgvector
- ✅ Starts Supabase Auth
- ✅ Starts Supabase Storage
- ✅ Starts Supabase Studio (dashboard)
- ✅ Creates local database

**Output will show:**
```
API URL: http://localhost:54321
DB URL: postgresql://postgres:postgres@localhost:54322/postgres
Studio URL: http://localhost:54323
anon key: eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...
service_role key: eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...
```

**⚠️ Save these values!** You'll need them for testing.

---

## 🗄️ **Step 2: Apply Database Schema** (2 min)

```bash
# Apply migrations
supabase db push

# Verify tables were created
supabase db diff
# Should show: "No schema changes detected"
```

**Verify in Studio:**
1. Open http://localhost:54323
2. Go to **Table Editor**
3. You should see:
   - ✅ profiles
   - ✅ posts
   - ✅ reactions
   - ✅ user_streaks
   - ✅ day_posts
   - ✅ notifications
   - ✅ trending_cache
   - ✅ daily_stats
   - ✅ events

---

## 🔧 **Step 3: Deploy Edge Function Locally** (2 min)

```bash
# Serve create-post function
supabase functions serve create-post --no-verify-jwt
```

**You should see:**
```
✓ Serving functions on http://localhost:54321/functions/v1/
  - create-post
```

Keep this terminal open!

---

## 🧪 **Step 4: Test Authentication** (5 min)

Open a **new terminal** and test auth:

### Test 1: Create User (Signup)

```bash
curl -X POST 'http://localhost:54321/auth/v1/signup' \
  -H "apikey: YOUR_ANON_KEY" \
  -H "Content-Type: application/json" \
  -d '{
    "email": "test@example.com",
    "password": "testpassword123"
  }'
```

**Expected Response:**
```json
{
  "access_token": "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...",
  "user": {
    "id": "uuid-here",
    "email": "test@example.com"
  }
}
```

**⚠️ Save the `access_token`!** You'll need it for testing posts.

### Test 2: Verify User in Database

```bash
# Open Studio
open http://localhost:54323

# Go to: Table Editor → auth.users
# You should see your test user!
```

---

## 📝 **Step 5: Test Post Creation (Core Feature)** (10 min)

Now test the main feature - creating posts with vector embeddings!

### Test 1: Create First Post

```bash
# Replace YOUR_ACCESS_TOKEN with the token from Step 4
curl -X POST 'http://localhost:54321/functions/v1/create-post' \
  -H "Authorization: Bearer YOUR_ACCESS_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "content": "Meditated for 20 minutes",
    "inputType": "action",
    "scope": "world"
  }'
```

**Expected Response:**
```json
{
  "success": true,
  "post": {
    "id": "uuid-here",
    "content": "Meditated for 20 minutes",
    "tier": "elite",
    "percentile": 2.5,
    "displayText": "Top 3%",
    "matchCount": 0,
    "createdAt": "2025-10-17T..."
  },
  "analytics": {
    "processingTime": 145,
    "embeddingTime": 52,
    "searchTime": 18
  }
}
```

**✅ Success indicators:**
- `success: true`
- `tier` is assigned (elite, rare, unique, etc.)
- `processingTime` < 300ms

### Test 2: Create Similar Post (Test Vector Matching)

```bash
curl -X POST 'http://localhost:54321/functions/v1/create-post' \
  -H "Authorization: Bearer YOUR_ACCESS_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "content": "Did meditation for 20 mins",
    "inputType": "action",
    "scope": "world"
  }'
```

**Expected Response:**
```json
{
  "success": true,
  "post": {
    "id": "different-uuid",
    "content": "Did meditation for 20 mins",
    "tier": "common",
    "percentile": 75.0,
    "displayText": "Common",
    "matchCount": 1,  // ← Should detect similarity!
    "createdAt": "2025-10-17T..."
  }
}
```

**✅ Vector matching works if:**
- `matchCount > 0` (found the first post)
- `tier` is lower than first post (common/popular)

### Test 3: Create Different Post

```bash
curl -X POST 'http://localhost:54321/functions/v1/create-post' \
  -H "Authorization: Bearer YOUR_ACCESS_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "content": "Cooked a gourmet meal with exotic spices",
    "inputType": "action",
    "scope": "world"
  }'
```

**Expected:**
- `matchCount: 0` (completely different)
- `tier: elite` (unique action)

---

## 🔍 **Step 6: Verify Data in Database** (5 min)

### Check Posts Table

1. Open Studio: http://localhost:54323
2. Go to **Table Editor** → **posts**
3. You should see your 3 posts with:
   - ✅ `content`
   - ✅ `embedding` (array of 384 floats)
   - ✅ `tier`
   - ✅ `percentile`
   - ✅ `match_count`

### Check Vector Embeddings

```sql
-- In Studio SQL Editor
SELECT 
  id,
  content,
  tier,
  percentile,
  match_count,
  array_length(embedding, 1) as embedding_dimensions
FROM posts;
```

**Expected:**
- All posts should have `embedding_dimensions = 384`

### Test Vector Search Directly

```sql
-- Find similar posts using vector search
SELECT 
  content,
  tier,
  1 - (embedding <=> (SELECT embedding FROM posts WHERE content LIKE '%Meditated%')) as similarity
FROM posts
WHERE embedding IS NOT NULL
ORDER BY similarity DESC
LIMIT 5;
```

**Expected:**
- First result: "Meditated..." (similarity ~1.0)
- Second result: "Did meditation..." (similarity ~0.95)
- Third result: "Cooked..." (similarity <0.5)

---

## 🎯 **Step 7: Test Feed Queries** (5 min)

### Query All Posts

```sql
SELECT 
  p.id,
  p.content,
  p.tier,
  p.percentile,
  p.created_at,
  pf.username,
  prc.funny_count,
  prc.creative_count,
  prc.must_try_count
FROM posts p
LEFT JOIN profiles pf ON p.user_id = pf.id
LEFT JOIN post_reaction_counts prc ON p.id = prc.post_id
ORDER BY p.created_at DESC;
```

### Filter by Tier

```sql
-- Get only elite posts
SELECT content, tier, percentile
FROM posts
WHERE tier = 'elite'
ORDER BY created_at DESC;
```

### Get User Stats

```sql
-- Test the function
SELECT * FROM get_user_stats('YOUR_USER_ID');
```

---

## 📊 **Step 8: Test Analytics** (5 min)

### Create Event

```sql
INSERT INTO events (user_id, event_type, event_data, platform)
VALUES (
  'YOUR_USER_ID',
  'post_viewed',
  '{"post_id": "some-uuid", "duration": 5}'::jsonb,
  'ios'
);
```

### Check Daily Stats

```sql
-- View aggregated stats
SELECT * FROM daily_stats
WHERE date = CURRENT_DATE;
```

### Trigger Analytics Calculation

```sql
-- Manually trigger (normally runs at midnight)
INSERT INTO daily_stats (
  date,
  total_posts,
  action_posts,
  elite_posts,
  new_users,
  active_users
)
SELECT
  CURRENT_DATE,
  COUNT(*),
  COUNT(*) FILTER (WHERE input_type = 'action'),
  COUNT(*) FILTER (WHERE tier = 'elite'),
  0,
  COUNT(DISTINCT user_id)
FROM posts
WHERE DATE(created_at) = CURRENT_DATE;
```

---

## 🔐 **Step 9: Test Row Level Security** (5 min)

### Test 1: Query Posts as Anonymous

```bash
# Should work (posts are public)
curl 'http://localhost:54321/rest/v1/posts?select=*' \
  -H "apikey: YOUR_ANON_KEY"
```

**Expected:** Returns all posts

### Test 2: Try to Insert as Anonymous

```bash
# Should fail (need auth)
curl -X POST 'http://localhost:54321/rest/v1/posts' \
  -H "apikey: YOUR_ANON_KEY" \
  -H "Content-Type: application/json" \
  -d '{
    "content": "test",
    "input_type": "action",
    "scope": "world"
  }'
```

**Expected:** Error (RLS blocks anonymous inserts)

### Test 3: Query Own Notifications

```bash
# Should only see own notifications
curl 'http://localhost:54321/rest/v1/notifications?select=*' \
  -H "Authorization: Bearer YOUR_ACCESS_TOKEN" \
  -H "apikey: YOUR_ANON_KEY"
```

**Expected:** Only returns your notifications (RLS working!)

---

## ⚡ **Step 10: Performance Testing** (5 min)

### Test Response Times

Create a simple test script:

```bash
cat > test_performance.sh << 'EOF'
#!/bin/bash

ACCESS_TOKEN="YOUR_ACCESS_TOKEN"
TOTAL_TIME=0
COUNT=10

echo "Testing post creation performance..."
echo "Running $COUNT requests..."

for i in {1..10}; do
  START=$(date +%s%3N)
  
  curl -s -X POST 'http://localhost:54321/functions/v1/create-post' \
    -H "Authorization: Bearer $ACCESS_TOKEN" \
    -H "Content-Type: application/json" \
    -d "{
      \"content\": \"Test post number $i\",
      \"inputType\": \"action\",
      \"scope\": \"world\"
    }" > /dev/null
  
  END=$(date +%s%3N)
  TIME=$((END - START))
  TOTAL_TIME=$((TOTAL_TIME + TIME))
  
  echo "Request $i: ${TIME}ms"
done

AVG=$((TOTAL_TIME / COUNT))
echo ""
echo "Average response time: ${AVG}ms"
echo "Target: <200ms"

if [ $AVG -lt 200 ]; then
  echo "✅ Performance: EXCELLENT"
elif [ $AVG -lt 500 ]; then
  echo "✅ Performance: GOOD"
else
  echo "⚠️  Performance: NEEDS OPTIMIZATION"
fi
EOF

chmod +x test_performance.sh
./test_performance.sh
```

**Target Performance:**
- ✅ Average < 200ms: Excellent
- ✅ Average < 500ms: Good
- ⚠️  Average > 500ms: Needs optimization

---

## 🎨 **Step 11: Test Leaderboards** (5 min)

### Refresh Materialized Views

```sql
-- Manually refresh (normally runs every 10 min)
REFRESH MATERIALIZED VIEW CONCURRENTLY city_leaderboard;
REFRESH MATERIALIZED VIEW CONCURRENTLY state_leaderboard;
REFRESH MATERIALIZED VIEW CONCURRENTLY country_leaderboard;
```

### Query Leaderboards

```sql
-- City leaderboard
SELECT * FROM city_leaderboard LIMIT 10;

-- State leaderboard
SELECT * FROM state_leaderboard LIMIT 10;

-- Country leaderboard
SELECT * FROM country_leaderboard LIMIT 10;
```

---

## 📱 **Step 12: Test Push Notifications (Optional)** (5 min)

### Create Test Notification

```sql
-- Insert notification
INSERT INTO notifications (user_id, type, title, message, data)
VALUES (
  'YOUR_USER_ID',
  'achievement',
  'Test Notification',
  'This is a test notification!',
  '{"test": true}'::jsonb
);
```

### Query Notifications

```bash
curl 'http://localhost:54321/rest/v1/notifications?select=*&user_id=eq.YOUR_USER_ID' \
  -H "Authorization: Bearer YOUR_ACCESS_TOKEN" \
  -H "apikey: YOUR_ANON_KEY"
```

---

## ✅ **Testing Checklist**

Use this checklist to verify everything works:

- [ ] ✅ Local Supabase started (`supabase start`)
- [ ] ✅ Database schema applied (9 tables visible)
- [ ] ✅ Edge function running (`functions serve`)
- [ ] ✅ User signup works
- [ ] ✅ Post creation works
- [ ] ✅ Vector embeddings generated (384 dimensions)
- [ ] ✅ Vector matching works (similar posts detected)
- [ ] ✅ Different posts get different tiers
- [ ] ✅ Feed queries return data
- [ ] ✅ Analytics events tracked
- [ ] ✅ RLS policies working
- [ ] ✅ Performance < 200ms average
- [ ] ✅ Leaderboards populated
- [ ] ✅ Notifications can be created

---

## 🐛 **Common Issues & Fixes**

### Issue: "Docker is not running"
```bash
# Start Docker Desktop
open -a Docker

# Wait for Docker to start, then retry
supabase start
```

### Issue: "Port already in use"
```bash
# Stop all Supabase services
supabase stop

# Start again
supabase start
```

### Issue: "Edge function not responding"
```bash
# Check function logs
supabase functions logs create-post --tail

# Restart function
# Ctrl+C in function terminal
supabase functions serve create-post --no-verify-jwt
```

### Issue: "Vector search returns empty"
```bash
# Check if embeddings exist
# In Studio SQL Editor:
SELECT COUNT(*) FROM posts WHERE embedding IS NOT NULL;

# Should return > 0
```

### Issue: "Performance is slow (>1000ms)"
**Causes:**
- Embedding model loading for first time (~2s first call)
- No HNSW index on embeddings
- Low Docker resources

**Fixes:**
```bash
# Increase Docker resources (Docker → Preferences → Resources)
# CPU: 4+ cores
# Memory: 8+ GB

# Verify HNSW index
# In Studio SQL Editor:
SELECT * FROM pg_indexes WHERE tablename = 'posts';
-- Should see: idx_posts_embedding_hnsw
```

---

## 📊 **Expected Test Results**

### ✅ Successful Test Run

```
✓ Database: 9 tables created
✓ Auth: User created
✓ Post 1: Elite tier (0 matches)
✓ Post 2: Common tier (1 match) ← Vector matching works!
✓ Post 3: Elite tier (0 matches)
✓ Embeddings: 384 dimensions for all posts
✓ Vector search: Returns similar posts
✓ RLS: Blocks unauthorized access
✓ Performance: 145ms average
✓ Analytics: Events tracked
```

### ⚠️ If Tests Fail

**Check logs:**
```bash
# Function logs
supabase functions logs create-post --tail

# Database logs
supabase db logs

# General logs
supabase status
```

---

## 🚀 **Next Steps After Testing**

Once all tests pass:

1. ✅ **Stop local Supabase**:
   ```bash
   supabase stop
   ```

2. ✅ **Deploy to Production**:
   - Follow `BACKEND_SETUP_GUIDE.md`
   - Create Supabase project
   - Deploy schema & functions

3. ✅ **Integrate with Mobile**:
   - Add Supabase client to React Native
   - Connect authentication
   - Test post creation from app

---

## 🎉 **You're Ready!**

After completing this guide, you'll have:
- ✅ Tested entire backend locally
- ✅ Verified vector embeddings work
- ✅ Confirmed performance targets met
- ✅ Validated security (RLS)
- ✅ Confidence to deploy to production

**Time to test**: ~60 minutes  
**Confidence level after**: 💯

---

**Happy Testing!** 🧪🚀

