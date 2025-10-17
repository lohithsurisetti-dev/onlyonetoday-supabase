# 🚀 OnlyOne.Today Backend (Supabase)

## 📋 **Overview**

This directory contains the complete backend implementation for OnlyOne.Today mobile app using Supabase.

### **Architecture**
- **Database**: PostgreSQL 15 with pgvector
- **Runtime**: Deno (for Edge Functions)
- **Language**: TypeScript
- **Auth**: Supabase Auth (phone OTP, email)
- **Storage**: Supabase Storage (S3-compatible)
- **Real-time**: Supabase Realtime (WebSockets)

---

## 📁 **Project Structure**

```
supabase/
├── config.toml                     # Supabase configuration
├── migrations/                     # Database schema migrations
│   └── 001_initial_schema.sql     # Complete schema with analytics
│
├── functions/                      # Edge Functions (Deno/TypeScript)
│   ├── create-post/               # Post creation with embeddings
│   │   └── index.ts
│   ├── send-notification/         # Push notifications
│   │   └── index.ts
│   ├── send-email/                # Email notifications
│   │   └── index.ts
│   ├── fetch-trending/            # Background job (APIs)
│   │   └── index.ts
│   ├── calculate-analytics/       # Daily analytics aggregation
│   │   └── index.ts
│   │
│   └── shared/                    # Shared code (imported by all functions)
│       ├── types/
│       │   ├── database.types.ts  # Database table types
│       │   └── api.types.ts       # API request/response types
│       ├── services/
│       │   ├── EmbeddingService.ts    # Vector embeddings
│       │   ├── PostService.ts         # Post logic
│       │   └── NotificationService.ts # Push + email
│       └── utils/
│           ├── logger.ts          # Centralized logging
│           ├── performance.ts     # Performance tracking
│           ├── validation.ts      # Input validation
│           └── errors.ts          # Error handling
│
└── README.md                      # This file
```

---

## 🛠️ **Setup Instructions**

### **1. Install Supabase CLI**

```bash
# macOS
brew install supabase/tap/supabase

# Verify installation
supabase --version
```

### **2. Login to Supabase**

```bash
supabase login
```

### **3. Link to Your Project**

```bash
cd /path/to/onlyOne.today
supabase link --project-ref YOUR_PROJECT_ID
```

### **4. Run Migrations**

```bash
# Apply database schema
supabase db push

# Verify schema
supabase db diff
```

### **5. Deploy Edge Functions**

```bash
# Deploy all functions
supabase functions deploy

# Or deploy individually
supabase functions deploy create-post
supabase functions deploy send-notification
```

### **6. Set Environment Variables**

```bash
# Set secrets for Edge Functions
supabase secrets set RESEND_API_KEY=your_resend_key
supabase secrets set OPENAI_API_KEY=your_openai_key
supabase secrets set ENVIRONMENT=production
```

---

## 🔑 **Environment Variables**

### **Required**
- `SUPABASE_URL` - Auto-injected by Supabase
- `SUPABASE_ANON_KEY` - Auto-injected by Supabase
- `SUPABASE_SERVICE_ROLE_KEY` - Auto-injected by Supabase

### **Optional (for full features)**
- `RESEND_API_KEY` - For email notifications
- `OPENAI_API_KEY` - For AI content moderation
- `SPOTIFY_CLIENT_ID` - For trending music
- `SPOTIFY_CLIENT_SECRET` - For trending music
- `REDDIT_CLIENT_ID` - For trending topics
- `REDDIT_CLIENT_SECRET` - For trending topics
- `YOUTUBE_API_KEY` - For trending videos

---

## 📊 **Database Schema**

### **Core Tables**
- `profiles` - User profiles (extends auth.users)
- `posts` - Posts with vector embeddings
- `reactions` - User reactions (funny, creative, must_try)
- `user_streaks` - Streak tracking
- `day_posts` - Themed day posts
- `notifications` - In-app notifications
- `trending_cache` - Cached trending data

### **Analytics Tables**
- `daily_stats` - Daily aggregated metrics
- `user_analytics` - Per-user analytics
- `events` - Event tracking for detailed analytics

### **Performance Optimizations**
- HNSW index on `posts.embedding` (vector search)
- Materialized views for leaderboards
- Composite indexes for common queries
- Automatic ANALYZE for query optimization

---

## 🔧 **Edge Functions**

### **1. create-post**
**Purpose**: Create post with uniqueness matching

**Request**:
```json
{
  "content": "Meditated for 20 minutes",
  "inputType": "action",
  "scope": "world",
  "location": {
    "city": "Phoenix",
    "state": "Arizona",
    "country": "United States"
  }
}
```

**Response**:
```json
{
  "success": true,
  "post": {
    "id": "uuid",
    "content": "Meditated for 20 minutes",
    "tier": "elite",
    "percentile": 2.5,
    "displayText": "Top 3%",
    "matchCount": 2,
    "createdAt": "2025-10-17T..."
  },
  "analytics": {
    "processingTime": 145,
    "embeddingTime": 52,
    "searchTime": 18
  }
}
```

### **2. send-notification**
**Purpose**: Send push notification via Expo

**Request**:
```json
{
  "userId": "uuid",
  "title": "Notable Action!",
  "message": "You hit elite tier!",
  "data": { "type": "achievement", "tier": "elite" }
}
```

### **3. send-email**
**Purpose**: Send email via Resend

**Request**:
```json
{
  "userId": "uuid",
  "subject": "Welcome!",
  "html": "<h1>Welcome to OnlyOne.Today!</h1>"
}
```

### **4. fetch-trending**
**Purpose**: Fetch trending data from APIs (runs hourly)

**Cron**: Every hour
**Sources**: Spotify, Reddit, YouTube, Sports

### **5. calculate-analytics**
**Purpose**: Calculate daily analytics (runs at midnight)

**Cron**: Daily at midnight
**Updates**: daily_stats, user_analytics, leaderboards

---

## 📱 **Mobile Integration**

### **Installation**

```bash
cd mobile
npm install @supabase/supabase-js
```

### **Initialize Supabase Client**

```typescript
// mobile/src/lib/supabase.ts
import { createClient } from '@supabase/supabase-js'
import type { Database } from '@/types/database.types'

const supabaseUrl = process.env.EXPO_PUBLIC_SUPABASE_URL!
const supabaseAnonKey = process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY!

export const supabase = createClient<Database>(supabaseUrl, supabaseAnonKey, {
  auth: {
    storage: AsyncStorage,
    autoRefreshToken: true,
    persistSession: true,
    detectSessionInUrl: false,
  },
})
```

### **Usage Examples**

```typescript
// Authentication
const { data, error } = await supabase.auth.signInWithOtp({
  phone: '+1234567890'
})

// Create post (via Edge Function)
const { data } = await supabase.functions.invoke('create-post', {
  body: {
    content: 'Meditated for 20 minutes',
    inputType: 'action',
    scope: 'world'
  }
})

// Get feed (direct query)
const { data: posts } = await supabase
  .from('posts')
  .select('*, profiles(*), post_reaction_counts(*)')
  .order('created_at', { ascending: false })
  .limit(20)

// Real-time leaderboard
const channel = supabase
  .channel('leaderboard')
  .on('postgres_changes', {
    event: '*',
    schema: 'public',
    table: 'city_leaderboard'
  }, (payload) => {
    updateUI(payload.new)
  })
  .subscribe()
```

---

## 🧪 **Local Development**

### **Start Local Supabase**

```bash
cd /path/to/onlyOne.today
supabase start
```

This starts:
- PostgreSQL on localhost:54322
- API on localhost:54321
- Studio on localhost:54323
- Edge Functions on localhost:54321/functions/v1

### **Test Edge Functions Locally**

```bash
# Serve function locally
supabase functions serve create-post --env-file .env.local

# Test with curl
curl -i --location --request POST 'http://localhost:54321/functions/v1/create-post' \
  --header 'Authorization: Bearer YOUR_ANON_KEY' \
  --header 'Content-Type: application/json' \
  --data '{"content":"Test post","inputType":"action","scope":"world"}'
```

### **View Logs**

```bash
# Real-time logs
supabase functions logs create-post --tail

# Specific time range
supabase functions logs create-post --start "2025-10-17 10:00:00"
```

---

## 📊 **Monitoring & Analytics**

### **Built-in Monitoring**

**Supabase Dashboard**:
- Database queries (slow query log)
- Edge Function invocations
- Error rates
- Response times

**Custom Analytics**:
- `events` table tracks all user actions
- `daily_stats` table for trends
- `user_analytics` for personalization

### **Query Performance Dashboard**

```sql
-- Find slow queries
SELECT * FROM pg_stat_statements
ORDER BY mean_exec_time DESC
LIMIT 10;

-- Check index usage
SELECT * FROM pg_stat_user_indexes
WHERE idx_scan = 0;

-- Database size
SELECT pg_size_pretty(pg_database_size('postgres'));
```

---

## 🔒 **Security**

### **Row Level Security (RLS)**
- Enabled on all tables
- Policies enforce user permissions
- Database-level security (not just code)

### **Rate Limiting**
- 10 posts per hour per user
- 100 reactions per hour per user
- Configurable per endpoint

### **Content Moderation**
- Basic profanity filter
- AI moderation (optional, via OpenAI)
- User reporting system (future)

### **API Security**
- JWT authentication required
- CORS configured
- Input validation on all endpoints
- SQL injection prevented (parameterized queries)

---

## 🚀 **Deployment**

### **Production Deployment**

```bash
# 1. Run migrations
supabase db push

# 2. Deploy functions
supabase functions deploy

# 3. Set production secrets
supabase secrets set --env-file .env.production

# 4. Verify deployment
supabase functions list
```

### **Rollback (if needed)**

```bash
# Rollback database
supabase db reset

# Rollback to specific migration
supabase db reset --version 001
```

---

## 📈 **Performance Benchmarks**

### **Target Performance**
- Post creation: <200ms (p95)
- Feed loading: <100ms
- Vector search: <30ms
- Real-time updates: <50ms

### **Optimization Strategies**

**Database**:
- ✅ HNSW index for vector search
- ✅ Materialized views for leaderboards
- ✅ Connection pooling (PgBouncer)
- ✅ Query result caching

**Edge Functions**:
- ✅ Model preloading (embeddings)
- ✅ Lazy initialization
- ✅ Batch operations where possible
- ✅ Async non-critical operations (streaks, notifications)

**Caching**:
- ✅ Leaderboards: 10-minute cache
- ✅ Trending: 1-hour cache
- ✅ Global stats: 1-minute cache

---

## 🧪 **Testing**

### **Run Tests**

```bash
# Database tests
supabase test db

# Function tests
deno test --allow-all functions/
```

### **Load Testing**

```bash
# Use k6 or artillery
k6 run load-test.js
```

---

## 📚 **Documentation**

- [Supabase Docs](https://supabase.com/docs)
- [pgvector Guide](https://github.com/pgvector/pgvector)
- [Deno Manual](https://deno.land/manual)
- [Expo Push Notifications](https://docs.expo.dev/push-notifications)

---

## 🆘 **Troubleshooting**

### **Edge Function not deploying**
```bash
# Check function syntax
deno check functions/create-post/index.ts

# View deployment logs
supabase functions deploy create-post --debug
```

### **Vector search slow**
```sql
-- Rebuild HNSW index
REINDEX INDEX idx_posts_embedding_hnsw;

-- Check index health
SELECT * FROM pg_indexes WHERE tablename = 'posts';
```

### **High database load**
```sql
-- Check active queries
SELECT * FROM pg_stat_activity WHERE state = 'active';

-- Kill long-running query
SELECT pg_terminate_backend(pid) FROM pg_stat_activity WHERE ...;
```

---

## 🎯 **Next Steps**

1. **Create Supabase project** at supabase.com
2. **Run migrations**: `supabase db push`
3. **Deploy functions**: `supabase functions deploy`
4. **Configure auth** in dashboard (enable phone provider)
5. **Add secrets**: API keys for email, trending, etc.
6. **Test locally** with Supabase CLI
7. **Integrate with mobile app**
8. **Deploy to production**

---

## 💡 **Best Practices**

### **Code Organization**
- ✅ Shared services in `/shared`
- ✅ One responsibility per service
- ✅ TypeScript for type safety
- ✅ Comprehensive error handling

### **Performance**
- ✅ Use indexes for all queries
- ✅ Lazy load heavy operations
- ✅ Cache frequently accessed data
- ✅ Async non-critical operations

### **Security**
- ✅ Always use RLS policies
- ✅ Validate all inputs
- ✅ Rate limit all endpoints
- ✅ Sanitize user content

### **Analytics**
- ✅ Track all user actions
- ✅ Log performance metrics
- ✅ Monitor error rates
- ✅ Build dashboards from events table

---

## 📞 **Support**

- **Supabase Discord**: https://discord.supabase.com
- **Documentation**: https://supabase.com/docs
- **GitHub Issues**: Create issues for bugs/features

---

**Built with ❤️ for OnlyOne.Today**

**Version**: 1.0.0  
**Last Updated**: 2025-10-17

