# 🏗️ OnlyOne.Today Backend Architecture Strategy

## 📊 **Current State Analysis**

### **Web Implementation (Existing)**
- **Framework**: Next.js 14 (App Router)
- **Database**: Supabase (PostgreSQL) - Free Tier
- **Auth**: Currently anonymous posting (no auth system)
- **Vector Search**: pgvector extension for embeddings
- **Deployment**: Vercel (likely)

### **Mobile Requirements (New)**
- User authentication & management
- Push notifications
- Email notifications
- REST/GraphQL APIs for all features
- Vector embeddings for uniqueness matching
- Real-time updates (leaderboards, trending)
- File uploads (future: photos, profile pics)
- Scalability (could go viral OR stay small)

---

## 🎯 **Critical Requirements**

### **Must-Have Features**
1. ✅ User Authentication (Phone/Email + OTP)
2. ✅ PostgreSQL with pgvector (for embeddings)
3. ✅ Push Notifications (iOS + Android)
4. ✅ Email Notifications
5. ✅ Real-time capabilities (leaderboards)
6. ✅ File storage (profile pics, future photos)
7. ✅ API endpoints for mobile app
8. ✅ Rate limiting & security
9. ✅ Cost-effective at low scale
10. ✅ Can scale to millions if viral

### **Nice-to-Have Features**
- Background jobs (trending data fetch, analytics)
- Caching layer (Redis)
- CDN for static assets
- Analytics & monitoring
- A/B testing infrastructure

---

## 🔬 **Option 1: Supabase (Recommended ⭐)**

### **Why Supabase?**

✅ **PostgreSQL Native** - Already using pgvector
✅ **Built-in Auth** - Phone, Email, OAuth out of the box
✅ **Real-time** - Built-in WebSocket subscriptions
✅ **Storage** - File uploads included
✅ **Row Level Security** - Database-level security
✅ **Minimal Backend Code** - Direct DB access from mobile
✅ **Free Tier** - 500MB DB, 1GB file storage, 50K monthly active users

### **Architecture**

```
Mobile App (React Native)
    ↓
Supabase Client SDK
    ↓
Supabase (All-in-One)
    ├── PostgreSQL + pgvector (posts, users, embeddings)
    ├── Auth (phone OTP, email, social)
    ├── Storage (profile pics, share cards)
    ├── Realtime (live leaderboards)
    ├── Edge Functions (serverless for complex logic)
    └── Database Functions (RPC for embeddings, matching)
```

### **What You Get**

| Feature | Supabase | Custom Backend |
|---------|----------|----------------|
| **Auth System** | ✅ Built-in (phone, email, OAuth) | ❌ Build from scratch (2-3 weeks) |
| **PostgreSQL + pgvector** | ✅ Included | ⚠️ Need to set up |
| **Real-time** | ✅ Built-in WebSockets | ❌ Build with Socket.io (1 week) |
| **File Storage** | ✅ S3-compatible included | ❌ Need AWS S3/Cloudflare R2 |
| **Row Level Security** | ✅ Database-level | ❌ Build in code (error-prone) |
| **Auto-scaling** | ✅ Managed | ❌ Manual DevOps |
| **Backups** | ✅ Daily automated | ❌ Set up yourself |
| **Monitoring** | ✅ Built-in dashboard | ❌ Need Datadog/Sentry |
| **Development Time** | **1-2 weeks** | **8-12 weeks** |

### **Supabase Pricing**

**Free Tier (Perfect for MVP):**
- 500 MB database (enough for 100K+ posts with embeddings)
- 1 GB file storage (10K profile pics)
- 50K monthly active users
- 2 million Edge Function invocations
- Social OAuth providers

**Pro Tier ($25/month - When Growing):**
- 8 GB database (1M+ posts)
- 100 GB file storage
- 100K monthly active users
- No pausing (always-on)
- Daily backups
- Point-in-time recovery

**Pro + Compute ($100-200/month - If Viral):**
- Dedicated CPU & RAM
- Auto-scaling
- Custom domains
- Priority support
- 500K+ monthly active users

### **Cost Projections**

| Users | Posts/Day | Monthly Cost | Tier |
|-------|-----------|--------------|------|
| 1K | 100 | **$0** | Free ✅ |
| 10K | 1,000 | **$0** | Free ✅ |
| 50K | 5,000 | **$25** | Pro |
| 100K | 10,000 | **$25** | Pro |
| 500K | 50,000 | **$100-150** | Pro + Compute |
| 1M+ | 100K+ | **$300-500** | Enterprise |

**Note:** You can stay on Free tier for months with proper data retention (90-day rolling window).

### **What Needs Custom Code (Edge Functions)**

Even with Supabase, you'll need serverless functions for:

1. **Embedding Generation** (Transformers.js)
   - On post creation, generate vector embeddings
   - Query pgvector for similar posts
   - Calculate uniqueness score
   - ~50-100ms per post

2. **Push Notifications** (Expo Push API)
   - Send notifications on achievements
   - Trending alerts
   - Friend activity
   - ~10ms per notification

3. **Email Service** (SendGrid/Resend)
   - Welcome emails
   - Weekly summaries
   - Feature announcements
   - ~5 emails/user/month

4. **Trending Data Fetch** (APIs)
   - Spotify, Reddit, YouTube APIs
   - Cache for 1 hour
   - Run every hour (background job)

5. **Analytics Aggregation**
   - Daily stats calculation
   - Leaderboard updates
   - Run daily at midnight

### **Supabase Edge Functions Example**

```typescript
// supabase/functions/create-post/index.ts
import { serve } from 'https://deno.land/std@0.168.0/http/server.ts'
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'
import { generateEmbedding } from './embeddings.ts'

serve(async (req) => {
  const { content, scope, location } = await req.json()
  const supabase = createClient(...)
  
  // 1. Generate embedding
  const embedding = await generateEmbedding(content)
  
  // 2. Find similar posts (vector search)
  const { data: matches } = await supabase.rpc('match_posts_by_embedding', {
    query_embedding: embedding,
    match_threshold: 0.90,
    scope_filter: scope,
    ...location
  })
  
  // 3. Calculate uniqueness
  const matchCount = matches?.length || 0
  const percentile = calculatePercentile(matchCount)
  
  // 4. Insert post
  const { data: post } = await supabase.from('posts').insert({
    content,
    scope,
    embedding,
    match_count: matchCount,
    ...location
  })
  
  return new Response(JSON.stringify({ post, percentile }))
})
```

---

## 🔧 **Option 2: Custom Backend (Node.js + Express)**

### **Stack**
- **Runtime**: Node.js 20 LTS
- **Framework**: Express.js or Fastify
- **Database**: PostgreSQL (Supabase/Railway/Neon)
- **Auth**: Custom JWT + OTP via Twilio/SendGrid
- **Push**: Expo Push Notifications
- **Hosting**: Railway/Render/Fly.io
- **Vector DB**: Supabase (still use for pgvector)

### **Pros**
✅ Full control over everything
✅ Can optimize exactly for your use case
✅ No vendor lock-in
✅ Custom logic easily implemented

### **Cons**
❌ 8-12 weeks development time
❌ Need to build auth from scratch
❌ Need to handle security yourself
❌ Need to set up monitoring, logs, backups
❌ DevOps overhead (deployments, scaling)
❌ Higher initial cost ($50-100/month minimum)

### **Architecture**

```
Mobile App
    ↓
REST API (Express.js)
    ├── Auth Service (JWT + OTP)
    ├── Posts Service (create, fetch, match)
    ├── Embeddings Service (Transformers.js)
    ├── Notifications Service (Expo Push)
    ├── Email Service (SendGrid)
    └── Trending Service (API fetching)
    ↓
Database Layer
    ├── PostgreSQL (Supabase/Neon) - Posts, users
    ├── Redis (Upstash) - Caching, rate limiting
    └── S3 (AWS/Cloudflare R2) - File storage
```

### **Services & Costs**

| Service | Provider | Monthly Cost |
|---------|----------|--------------|
| Hosting | Railway/Render | $5-20 |
| Database | Supabase Free | $0 |
| Redis | Upstash Free | $0 |
| Storage | Cloudflare R2 | $0 (10GB free) |
| Push Notifications | Expo | $0 (free) |
| Email | SendGrid | $0 (100/day free) |
| SMS/OTP | Twilio | $0.0075/SMS (~$30-50) |
| **Total** | | **$35-70/month** |

---

## 🚀 **Option 3: Hybrid (Supabase + Edge Functions) [BEST]**

### **The Sweet Spot**

Use Supabase for 90% of features, add custom Edge Functions for the 10% that needs custom logic.

### **What Supabase Handles**
- ✅ Database (PostgreSQL + pgvector)
- ✅ Authentication (phone OTP, email, social)
- ✅ File storage (profile pics)
- ✅ Real-time subscriptions (leaderboards)
- ✅ Row Level Security
- ✅ Auto-scaling infrastructure

### **What Custom Edge Functions Handle**
- 🔧 Embedding generation (Transformers.js)
- 🔧 Complex matching logic
- 🔧 Push notifications (Expo)
- 🔧 Email triggers (SendGrid/Resend)
- 🔧 Trending data fetch (background jobs)
- 🔧 Analytics aggregation

### **Architecture**

```
Mobile App (React Native)
    ↓
Supabase Client SDK
    ├── Direct DB Access (reads, simple writes)
    ├── Auth (login, signup, sessions)
    ├── Storage (upload profile pics)
    └── Realtime (subscribe to leaderboards)
    ↓
Supabase Edge Functions (Deno)
    ├── create-post → Generate embedding, calculate uniqueness
    ├── send-notification → Push to Expo
    ├── send-email → Trigger welcome/achievement emails
    ├── fetch-trending → Spotify/Reddit/YouTube APIs
    └── calculate-analytics → Daily aggregations
    ↓
Supabase PostgreSQL
    ├── posts (with embeddings)
    ├── users (auth.users managed by Supabase)
    ├── reactions
    ├── trending_cache
    └── analytics
```

### **Why This Is Best**

1. **Fast Development**: 2-3 weeks (not 12 weeks)
2. **Low Cost**: Free tier for months, $25 when growing
3. **Auto-Scaling**: Handles viral growth automatically
4. **Managed Infrastructure**: No DevOps needed
5. **Built-in Auth**: Phone OTP, email, social OAuth ready
6. **Real-time**: WebSocket subscriptions built-in
7. **Security**: Row Level Security at DB level
8. **Monitoring**: Built-in dashboard and logs

---

## 📱 **Push Notifications Strategy**

### **Expo Push Notifications (FREE)**

```typescript
// supabase/functions/send-notification/index.ts
import { Expo } from 'expo-server-sdk'

const expo = new Expo()

serve(async (req) => {
  const { userId, title, body, data } = await req.json()
  
  // Get user's push token from database
  const { data: user } = await supabase
    .from('users')
    .select('push_token')
    .eq('id', userId)
    .single()
  
  if (!Expo.isExpoPushToken(user.push_token)) {
    return new Response('Invalid push token', { status: 400 })
  }
  
  // Send notification
  await expo.sendPushNotificationsAsync([{
    to: user.push_token,
    title,
    body,
    data,
    sound: 'default',
    badge: 1,
  }])
  
  return new Response('Notification sent')
})
```

**Cost**: $0 (Expo Push is free for unlimited notifications)

---

## 📧 **Email Strategy**

### **Option A: Resend (Recommended)**
- **Free Tier**: 3,000 emails/month
- **Cost**: $20/month for 50K emails
- **Best for**: Transactional emails (welcome, achievements)
- **DX**: Excellent developer experience, React Email templates

### **Option B: SendGrid**
- **Free Tier**: 100 emails/day (3K/month)
- **Cost**: $15/month for 50K emails
- **Best for**: Marketing + transactional
- **DX**: Good, but complex setup

### **Email Types (Estimated Volume)**

| Type | Frequency | Monthly Volume (10K users) |
|------|-----------|----------------------------|
| Welcome | Once | 500 (new signups) |
| Daily Summary | Optional | 2,000 (20% opt-in) |
| Achievements | On event | 1,000 (top performers) |
| Feature Updates | Monthly | 10,000 (broadcast) |
| **Total** | | **~13,500/month** |

**Recommendation**: Start with Resend free tier (3K), upgrade to $20 when you hit 10K users.

---

## 🗄️ **Database Strategy**

### **PostgreSQL with pgvector (Current Setup)**

**Supabase Free Tier:**
- 500 MB database storage
- Unlimited API requests
- 2 GB bandwidth
- 500MB = ~250K posts with embeddings

**Data Model:**

```sql
-- Users (managed by Supabase Auth)
auth.users (built-in)
  - id (UUID)
  - phone, email
  - created_at
  
-- User Profiles (custom)
public.profiles
  - id (UUID, FK to auth.users)
  - username (unique)
  - first_name, last_name
  - date_of_birth
  - avatar_url
  - push_token (for notifications)
  - created_at

-- Posts (existing + enhanced)
public.posts
  - id (UUID)
  - user_id (FK to auth.users, nullable for anonymous)
  - content (TEXT)
  - input_type ('action' | 'day')
  - scope ('city' | 'state' | 'country' | 'world')
  - location_city, location_state, location_country
  - embedding (vector(384)) -- pgvector
  - content_hash (TEXT)
  - match_count (INTEGER)
  - percentile (FLOAT)
  - tier ('elite' | 'rare' | 'unique' | 'notable' | 'common' | 'popular')
  - created_at

-- Reactions (new)
public.reactions
  - id (UUID)
  - post_id (FK to posts)
  - user_id (FK to auth.users)
  - reaction_type ('funny' | 'creative' | 'must_try')
  - created_at

-- Streaks (new)
public.user_streaks
  - user_id (UUID, PK)
  - current_streak (INTEGER)
  - longest_streak (INTEGER)
  - last_post_date (DATE)
  - updated_at

-- Themed Days Posts (new)
public.day_posts
  - id (UUID)
  - user_id (FK to auth.users)
  - day_of_week ('monday' | 'tuesday' | ...)
  - content (TEXT)
  - reactions JSONB
  - created_at
```

### **Storage Estimate**

```
Per post with embedding:
- Content + metadata: ~500 bytes
- Vector embedding: ~1.5 KB
- Total: ~2 KB per post

Free tier (500 MB):
- 500 MB / 2 KB = 250,000 posts

With 90-day retention:
- 1,000 posts/day × 90 days = 90,000 posts
- 90K × 2KB = 180 MB
- Fits comfortably in free tier! ✅

At viral scale (10K posts/day):
- 10K × 90 days = 900K posts
- 900K × 2KB = 1.8 GB
- Need Pro tier ($25/month) ✅ Still cheap!
```

---

## 🔐 **Authentication Strategy**

### **Supabase Auth (Recommended)**

**Flow:**
```
1. User enters phone/email
2. Supabase sends OTP (via Twilio/MessageBird)
3. User enters OTP
4. Supabase verifies and creates session
5. Mobile stores JWT token
6. All API calls include token
```

**Implementation:**

```typescript
// Mobile: Login with phone
const { data, error } = await supabase.auth.signInWithOtp({
  phone: '+1234567890'
})

// User enters OTP
const { data, error } = await supabase.auth.verifyOtp({
  phone: '+1234567890',
  token: '123456',
  type: 'sms'
})

// Create user profile
await supabase.from('profiles').insert({
  id: data.user.id,
  username,
  first_name,
  last_name,
  date_of_birth
})
```

**OTP Costs:**
- Twilio: $0.0075/SMS (~$75 for 10K OTPs)
- MessageBird: $0.006/SMS (~$60 for 10K OTPs)
- Supabase uses Twilio by default (can switch)

**First 1,000 users**: ~$7.50 in OTP costs
**First 10,000 users**: ~$75 in OTP costs

---

## 📊 **API Strategy**

### **Direct Supabase (Simple Reads)**

```typescript
// Mobile app - No backend needed!
const { data: posts } = await supabase
  .from('posts')
  .select('*')
  .eq('scope', 'world')
  .order('created_at', { ascending: false })
  .limit(20)
```

### **Edge Functions (Complex Logic)**

```typescript
// Mobile app - Complex operations
const { data } = await supabase.functions.invoke('create-post', {
  body: { content, scope, location }
})
```

**Why This Split?**
- Simple reads: Direct DB access (fast, no latency)
- Complex writes: Edge Functions (embeddings, calculations)
- Best of both worlds!

---

## 🎪 **Background Jobs & Cron**

### **Supabase Edge Functions with pg_cron**

```sql
-- Enable pg_cron extension
CREATE EXTENSION pg_cron;

-- Schedule trending data fetch (every hour)
SELECT cron.schedule(
  'fetch-trending',
  '0 * * * *', -- Every hour
  $$
  SELECT net.http_post(
    url := 'https://your-project.supabase.co/functions/v1/fetch-trending',
    headers := '{"Authorization": "Bearer YOUR_ANON_KEY"}'::jsonb
  );
  $$
);

-- Schedule daily analytics (midnight)
SELECT cron.schedule(
  'calculate-daily-analytics',
  '0 0 * * *', -- Midnight daily
  $$
  SELECT net.http_post(
    url := 'https://your-project.supabase.co/functions/v1/calculate-analytics',
    headers := '{"Authorization": "Bearer YOUR_ANON_KEY"}'::jsonb
  );
  $$
);
```

**Cost**: $0 (included in Supabase)

---

## 🌍 **Real-time Updates**

### **Supabase Realtime (Built-in)**

```typescript
// Mobile app - Subscribe to live leaderboard
const channel = supabase
  .channel('leaderboard')
  .on(
    'postgres_changes',
    {
      event: '*',
      schema: 'public',
      table: 'user_stats'
    },
    (payload) => {
      // Update UI with new data
      updateLeaderboard(payload.new)
    }
  )
  .subscribe()
```

**Cost**: $0 (included, 200 concurrent connections on free tier)

---

## 🎯 **Recommended Architecture**

### **Phase 1: MVP (Weeks 1-3) - Supabase Only**

```
Mobile App
    ↓
Supabase (Everything)
    ├── Auth (phone OTP)
    ├── Database (posts, users, reactions)
    ├── Edge Functions (embeddings, notifications)
    ├── Storage (profile pics)
    └── Realtime (leaderboards)

Cost: $0 + ~$10-20/month OTP costs
Development: 2-3 weeks
```

**What to Build:**
1. Week 1: Auth flow, user profiles, database schema
2. Week 2: Post creation with embeddings, feed APIs
3. Week 3: Reactions, leaderboards, push notifications

### **Phase 2: Growth (Months 1-6) - Supabase Pro**

```
Same architecture, just upgrade tier

Cost: $25/month + OTP costs
Users: Up to 100K
Posts: Up to 1M
```

**What to Add:**
- Analytics dashboard
- Email notifications
- Themed days
- Trending integration
- Advanced caching

### **Phase 3: Scale (If Viral) - Supabase + Optimization**

```
Mobile App
    ↓
Cloudflare CDN (caching)
    ↓
Supabase Pro + Compute
    ├── Read Replicas (for scaling reads)
    ├── Connection pooling
    └── Dedicated compute

Cost: $100-300/month
Users: 500K+
Posts: 10M+
```

**Optimizations:**
- Redis caching layer (Upstash)
- CDN for static content
- Database connection pooling
- Read replicas for heavy queries

---

## 💰 **Total Cost Breakdown**

### **Year 1 Projection (Conservative Growth)**

| Month | Users | Posts/Day | Supabase | OTP | Email | Total |
|-------|-------|-----------|----------|-----|-------|-------|
| 1 | 100 | 10 | $0 | $1 | $0 | **$1** |
| 2 | 500 | 50 | $0 | $4 | $0 | **$4** |
| 3 | 1,000 | 100 | $0 | $8 | $0 | **$8** |
| 6 | 5,000 | 500 | $0 | $38 | $0 | **$38** |
| 9 | 10,000 | 1,000 | $25 | $75 | $0 | **$100** |
| 12 | 25,000 | 2,500 | $25 | $190 | $20 | **$235** |

**Total Year 1**: ~$1,500-2,000

### **If Viral (Best Case)**

| Month | Users | Posts/Day | Supabase | OTP | Email | CDN | Total |
|-------|-------|-----------|----------|-----|-------|-----|-------|
| 3 | 100K | 10,000 | $25 | $750 | $20 | $10 | **$805** |
| 6 | 500K | 50,000 | $150 | $3,750 | $50 | $50 | **$4,000** |
| 12 | 1M+ | 100K | $300 | $7,500 | $100 | $100 | **$8,000** |

**Revenue needed**: With 1M users, monetization becomes easy:
- 5% premium ($4.99) = $250,000/month revenue
- Backend costs: $8,000/month
- **Profit margin**: 97% 🚀

---

## 🛠️ **Tech Stack Recommendation**

### **Backend**
- **BaaS**: Supabase (PostgreSQL + pgvector + Auth + Storage + Realtime)
- **Serverless Functions**: Supabase Edge Functions (Deno runtime)
- **Embeddings**: Transformers.js (runs in Edge Functions)
- **Caching**: Supabase built-in query cache (later: Upstash Redis)

### **Notifications**
- **Push**: Expo Push Notifications (free, unlimited)
- **Email**: Resend (3K free, then $20/50K)
- **SMS/OTP**: Twilio via Supabase Auth ($0.0075/SMS)

### **APIs Consumed**
- Spotify API (trending music)
- Reddit API (trending topics)
- YouTube Data API (trending videos)
- Sports data (ESPN or similar)

### **Monitoring & Logs**
- Supabase Dashboard (built-in)
- Sentry (error tracking) - Free tier: 5K events/month
- PostHog (analytics) - Free tier: 1M events/month

---

## 🚀 **Migration from Web to Mobile Backend**

### **Current Web Setup**
- Next.js API routes (probably)
- Supabase for database
- pgvector for embeddings
- Anonymous posting only

### **Mobile Backend (Same Supabase!)**

**Key Insight**: You can use the SAME Supabase project for both web and mobile!

```
Supabase Project (Shared)
    ├── Web (Next.js) → Direct DB access
    └── Mobile (React Native) → Same DB, new Auth layer

Benefits:
- Shared user base (post on mobile, view on web)
- Single database (no sync needed)
- Cost-effective (one subscription)
- Unified analytics
```

### **What Changes**
1. Add auth.users table (enable Supabase Auth)
2. Add user_id to posts table (FK to auth.users)
3. Migrate anonymous posts to optional user_id
4. Add RLS policies for authenticated actions
5. Create Edge Functions for mobile-specific features

### **Migration Steps**

**Week 1: Add Auth Layer**
```sql
-- Enable Supabase Auth
-- Already enabled, just configure in dashboard

-- Add user profiles table
CREATE TABLE profiles (
  id UUID REFERENCES auth.users PRIMARY KEY,
  username TEXT UNIQUE NOT NULL,
  first_name TEXT,
  last_name TEXT,
  date_of_birth DATE,
  avatar_url TEXT,
  push_token TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Add user_id to posts (nullable for backward compatibility)
ALTER TABLE posts ADD COLUMN user_id UUID REFERENCES auth.users;
CREATE INDEX idx_posts_user_id ON posts(user_id);

-- Update RLS policies
-- (Keep anonymous posting, add authenticated features)
```

**Week 2: Build Edge Functions**
- `create-post` - Embedding generation + uniqueness
- `send-notification` - Push notifications
- `send-email` - Email triggers
- `fetch-trending` - API aggregation

**Week 3: Migrate & Test**
- Deploy Edge Functions
- Test auth flow
- Migrate existing data
- Soft launch to beta users

---

## 📈 **Scalability Plan**

### **Free Tier (0-10K users)**
- Supabase Free
- Expo Push (free)
- Resend (3K emails free)
- **Cost**: $0 + ~$10-50/month OTP

### **Pro Tier (10K-100K users)**
- Supabase Pro ($25)
- Resend ($20)
- **Cost**: $45 + OTP costs (~$75-200)
- **Total**: ~$120-265/month

### **Scale Tier (100K-500K users)**
- Supabase Pro + Compute ($150)
- Resend Pro ($80)
- Upstash Redis ($10)
- Cloudflare CDN ($20)
- **Total**: ~$260 + OTP (~$750)
- **Total**: ~$1,000/month

### **Viral Tier (500K+ users)**
- Supabase Enterprise ($300-500)
- SendGrid/Resend ($100)
- Redis ($50)
- CDN ($100)
- Monitoring ($50)
- **Total**: ~$600 + OTP (~$3,750)
- **Total**: ~$4,350/month

**At this scale, monetization is essential:**
- 500K users × 5% premium × $4.99 = $125,000/month revenue
- Backend costs: $4,350/month
- **Profit**: $120,650/month 🎉

---

## ⚡ **Performance Considerations**

### **Latency Targets**
- Post creation: <200ms (with embedding generation)
- Feed loading: <100ms
- Real-time updates: <50ms
- Push notifications: <500ms

### **How to Achieve**

**Supabase Advantages:**
1. **Connection Pooling**: Built-in (handles 1000s of concurrent users)
2. **Global CDN**: Auto-distributed worldwide
3. **Read Replicas**: Available on Pro+ tier
4. **Query Caching**: Automatic for repeated queries

**Optimization Strategies:**
1. **Indexes**: Already in schema (content_hash, scope, created_at)
2. **Lazy Embedding Generation**: Only generate if match_count > 0
3. **Materialized Views**: For leaderboards (refresh hourly)
4. **Edge Caching**: Cloudflare in front (cache static data)

### **Vector Search Performance**

```sql
-- HNSW index for fast vector search
CREATE INDEX posts_embedding_hnsw_idx 
  ON posts USING hnsw (embedding vector_cosine_ops);

-- Performance:
-- 1,000 posts: 5ms
-- 10,000 posts: 15ms
-- 100,000 posts: 25ms
-- 1,000,000 posts: 35ms

-- Scales logarithmically! ✅
```

---

## 🔒 **Security Strategy**

### **Database Security (RLS)**

```sql
-- Row Level Security Policies

-- Anyone can read posts (public feed)
CREATE POLICY "Posts are public"
  ON posts FOR SELECT
  USING (true);

-- Authenticated users can create posts
CREATE POLICY "Authenticated users can create posts"
  ON posts FOR INSERT
  WITH CHECK (auth.uid() IS NOT NULL);

-- Users can only update/delete their own posts
CREATE POLICY "Users own their posts"
  ON posts FOR ALL
  USING (user_id = auth.uid());

-- Users can only read their own profile data
CREATE POLICY "Users can read own profile"
  ON profiles FOR SELECT
  USING (id = auth.uid());
```

### **API Security**

**Rate Limiting (Supabase Built-in):**
```sql
-- Already set up in rate-limit-schema.sql
-- 100 requests/minute per IP
-- 1,000 requests/hour per user
```

**Input Validation (Edge Functions):**
```typescript
// Validate in Edge Function before DB insert
const schema = z.object({
  content: z.string().min(3).max(500),
  scope: z.enum(['city', 'state', 'country', 'world']),
  input_type: z.enum(['action', 'day'])
})

const validated = schema.parse(req.body)
```

**Content Moderation:**
- Profanity filter (bad-words npm package)
- AI moderation (OpenAI Moderation API - free)
- User reporting system
- Admin dashboard for review

---

## 🎮 **Feature-Specific Backend Needs**

### **1. Uniqueness Matching**
✅ **Supabase + pgvector** handles this perfectly
- Vector embeddings stored in DB
- HNSW index for fast search
- RPC function for similarity queries

### **2. Leaderboards**
✅ **Materialized Views + Realtime**
```sql
CREATE MATERIALIZED VIEW city_leaderboard AS
SELECT 
  location_city,
  COUNT(*) as post_count,
  COUNT(*) FILTER (WHERE tier IN ('elite', 'rare')) as unique_count
FROM posts
WHERE created_at > NOW() - INTERVAL '7 days'
GROUP BY location_city
ORDER BY unique_count DESC
LIMIT 100;

-- Refresh every hour
REFRESH MATERIALIZED VIEW CONCURRENTLY city_leaderboard;
```

### **3. Themed Days**
✅ **Simple table + Edge Function**
```typescript
// Mobile: Post to themed day
const { data } = await supabase.functions.invoke('create-day-post', {
  body: {
    day_of_week: 'monday',
    content: 'My unpopular opinion...'
  }
})
```

### **4. Trending Integration**
✅ **Background job + caching**
```typescript
// Edge Function (runs hourly)
const trending = await fetchFromApis() // Spotify, Reddit, YouTube
await supabase.from('trending_cache').upsert(trending)
```

### **5. Push Notifications**
✅ **Edge Function + Expo**
```typescript
// Triggered on achievement
await supabase.functions.invoke('send-notification', {
  body: {
    userId: 'uuid',
    title: 'Notable Action!',
    body: 'You hit Elite tier!'
  }
})
```

---

## 🏆 **Final Recommendation**

### **🎯 Go with Supabase + Edge Functions**

**Why?**

1. **Speed to Market**: 2-3 weeks vs. 12 weeks
2. **Cost-Effective**: $0-25/month for first 100K users
3. **Auto-Scaling**: Handles viral growth automatically
4. **pgvector Support**: Already set up for embeddings
5. **Auth Built-in**: Phone OTP, email, social OAuth ready
6. **Real-time**: WebSocket subscriptions included
7. **No DevOps**: Fully managed infrastructure
8. **Proven**: Used by major apps (Linear, Mem, etc.)

**Trade-offs:**
- ⚠️ Some vendor lock-in (but PostgreSQL is portable)
- ⚠️ Edge Functions in Deno (not Node.js, but very similar)
- ⚠️ Learning curve for RLS policies

**But these are MINOR compared to the benefits!**

---

## 📝 **Implementation Roadmap**

### **Week 1: Foundation**
- [ ] Enable Supabase Auth in dashboard
- [ ] Create profiles table
- [ ] Set up phone OTP provider (Twilio)
- [ ] Build auth flow in mobile app
- [ ] Test signup → login → session management

### **Week 2: Core Features**
- [ ] Create `create-post` Edge Function (embeddings)
- [ ] Build feed APIs (with filters)
- [ ] Implement reactions system
- [ ] Add user_id to posts (optional, for tracking)
- [ ] Test post creation → uniqueness calculation

### **Week 3: Engagement**
- [ ] Build leaderboards (materialized views)
- [ ] Set up push notifications (Expo)
- [ ] Create notification triggers (achievements)
- [ ] Add email service (welcome emails)
- [ ] Implement streak tracking

### **Week 4: Polish**
- [ ] Themed days implementation
- [ ] Trending integration (background job)
- [ ] Profile features (edit, avatar upload)
- [ ] Settings & preferences
- [ ] Rate limiting & security hardening

### **Week 5: Testing & Launch**
- [ ] Load testing (simulate 10K users)
- [ ] Security audit
- [ ] Beta testing with 100 users
- [ ] Fix bugs & optimize
- [ ] Production launch 🚀

---

## 🎓 **Learning Resources**

### **Supabase**
- Docs: https://supabase.com/docs
- Auth Guide: https://supabase.com/docs/guides/auth
- Edge Functions: https://supabase.com/docs/guides/functions
- Realtime: https://supabase.com/docs/guides/realtime

### **pgvector**
- Extension Docs: https://github.com/pgvector/pgvector
- Supabase pgvector Guide: https://supabase.com/docs/guides/ai/vector-columns

### **Expo Push**
- Docs: https://docs.expo.dev/push-notifications/overview/
- Node SDK: https://github.com/expo/expo-server-sdk-node

---

## ✅ **Decision Matrix**

| Criteria | Supabase | Custom Backend | Hybrid |
|----------|----------|----------------|--------|
| **Development Time** | ⭐⭐⭐ 2-3 weeks | ⭐ 12 weeks | ⭐⭐ 4-6 weeks |
| **Initial Cost** | ⭐⭐⭐ $0 | ⭐⭐ $50-100 | ⭐⭐ $25-50 |
| **Scaling Cost** | ⭐⭐⭐ $25-300 | ⭐⭐ $100-500 | ⭐⭐ $50-400 |
| **Maintenance** | ⭐⭐⭐ Minimal | ⭐ High | ⭐⭐ Medium |
| **Flexibility** | ⭐⭐ Medium | ⭐⭐⭐ Full | ⭐⭐⭐ High |
| **Auth System** | ⭐⭐⭐ Built-in | ⭐ Build it | ⭐⭐⭐ Built-in |
| **Real-time** | ⭐⭐⭐ Built-in | ⭐⭐ Build it | ⭐⭐⭐ Built-in |
| **Vector Search** | ⭐⭐⭐ pgvector | ⭐⭐⭐ pgvector | ⭐⭐⭐ pgvector |
| **DevOps Burden** | ⭐⭐⭐ None | ⭐ High | ⭐⭐ Low |
| **Viral Readiness** | ⭐⭐⭐ Auto-scales | ⭐⭐ Manual scaling | ⭐⭐⭐ Auto-scales |

**Winner**: **Supabase** (Hybrid is same thing, just more organized)

---

## 🎯 **Next Steps**

1. **Create Supabase Project** (5 minutes)
   - Sign up at supabase.com
   - Create new project
   - Note API URL and anon key

2. **Enable Phone Auth** (10 minutes)
   - Dashboard → Authentication → Providers
   - Enable Phone (SMS)
   - Add Twilio credentials (or use Supabase's)

3. **Run Database Migrations** (30 minutes)
   - Copy existing schema.sql
   - Add profiles table
   - Add new tables (reactions, streaks, etc.)
   - Run in SQL Editor

4. **Install Supabase in Mobile** (5 minutes)
   ```bash
   npm install @supabase/supabase-js
   ```

5. **Build First Edge Function** (2 hours)
   - Create `create-post` function
   - Test locally with Supabase CLI
   - Deploy to production

6. **Integrate Auth in Mobile** (1 day)
   - Replace mock auth with Supabase auth
   - Test signup → OTP → login flow
   - Store session token

7. **Build Core APIs** (3-5 days)
   - Post creation with embeddings
   - Feed with filters
   - Reactions
   - User profile

8. **Add Notifications** (2 days)
   - Expo Push setup
   - Notification triggers
   - Test on real devices

9. **Polish & Launch** (1 week)
   - Error handling
   - Loading states
   - Security testing
   - Beta launch

**Total Timeline**: 3-4 weeks to production-ready backend ✅

---

## 💡 **Pro Tips**

### **1. Start Simple, Add Later**
- Launch with just post creation + feed
- Add reactions, leaderboards, notifications incrementally
- Don't overbuild before validating product-market fit

### **2. Use Supabase Client Liberally**
- Let mobile app query DB directly for reads
- Only use Edge Functions for complex writes
- Reduces latency and backend complexity

### **3. Monitor from Day 1**
- Set up Sentry for error tracking
- Use Supabase logs dashboard
- Track key metrics (signup rate, post rate, retention)

### **4. Plan for Viral Growth**
- Set up auto-scaling alerts in Supabase
- Have upgrade path ready (Free → Pro → Compute)
- Monitor database size weekly

### **5. Keep Options Open**
- PostgreSQL is portable (can migrate off Supabase if needed)
- Edge Functions can be rewritten as Express APIs
- Not locked in, just convenient

---

## 🎉 **Summary**

**Recommendation**: **Supabase + Edge Functions**

**Why**: 
- ✅ Fastest to build (2-3 weeks)
- ✅ Cheapest to start ($0-10/month)
- ✅ Auto-scales to millions
- ✅ All features included (auth, DB, storage, realtime)
- ✅ pgvector for embeddings
- ✅ No DevOps needed
- ✅ Proven at scale

**Alternative**: Custom Node.js backend only if you need:
- Very specific custom logic Supabase can't handle
- Want to avoid any vendor lock-in
- Have 12 weeks to build
- Have DevOps expertise

**For OnlyOne.Today**: Supabase is the obvious choice. Get to market fast, validate the idea, scale if it works. You can always migrate later if needed (but you probably won't need to).

---

**Ready to start building the backend?** 🚀

Let me know if you want me to:
1. Set up the Supabase project structure
2. Write the database migration scripts
3. Build the first Edge Functions
4. Create API documentation for mobile integration

File saved: `/BACKEND_STRATEGY.md`

