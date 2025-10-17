# 🔧 API Architecture & Language Strategy

## 🤔 **The Big Question: Where Do We Write Code?**

### **Supabase Approach: Two-Layer API System**

---

## 📱 **Layer 1: Direct Database Access (No API Needed!)**

### **Simple Operations (80% of your APIs)**

**Mobile app talks DIRECTLY to PostgreSQL via Supabase SDK:**

```typescript
// mobile/src/lib/api/posts.ts
import { supabase } from '@/lib/supabase'

// ✅ NO BACKEND API NEEDED!
export const getPosts = async (scope: string, limit: number = 20) => {
  const { data, error } = await supabase
    .from('posts')
    .select('*')
    .eq('scope', scope)
    .order('created_at', { ascending: false })
    .limit(limit)
  
  return data
}

// ✅ NO BACKEND API NEEDED!
export const getUserProfile = async (userId: string) => {
  const { data } = await supabase
    .from('profiles')
    .select('*')
    .eq('id', userId)
    .single()
  
  return data
}

// ✅ NO BACKEND API NEEDED!
export const addReaction = async (postId: string, reactionType: string) => {
  const { data } = await supabase
    .from('reactions')
    .insert({
      post_id: postId,
      user_id: (await supabase.auth.getUser()).data.user?.id,
      reaction_type: reactionType
    })
  
  return data
}
```

**No Express routes. No REST endpoints. Just SQL queries wrapped in TypeScript functions!**

---

## ⚡ **Layer 2: Edge Functions (Complex Operations)**

### **Language: TypeScript (Deno Runtime)**

**For the 20% that needs custom logic:**

```typescript
// supabase/functions/create-post/index.ts

import { serve } from 'https://deno.land/std@0.168.0/http/server.ts'
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'
import { pipeline } from 'https://esm.sh/@xenova/transformers@2.6.0'

// ============================================================
// CLASSES & TYPES (Defined here!)
// ============================================================

interface CreatePostRequest {
  content: string
  inputType: 'action' | 'day'
  scope: 'city' | 'state' | 'country' | 'world'
  location: {
    city?: string
    state?: string
    country?: string
  }
}

interface CreatePostResponse {
  post: Post
  percentile: PercentileData
  matchCount: number
}

class EmbeddingService {
  private static embedder: any = null

  static async generateEmbedding(text: string): Promise<number[]> {
    if (!this.embedder) {
      this.embedder = await pipeline(
        'feature-extraction',
        'Xenova/all-MiniLM-L6-v2'
      )
    }

    const output = await this.embedder(text.toLowerCase(), {
      pooling: 'mean',
      normalize: true
    })

    return Array.from(output.data)
  }
}

class UniquenessCalculator {
  static calculatePercentile(matchCount: number, totalPosts: number): PercentileData {
    const percentile = (matchCount / totalPosts) * 100
    
    if (percentile <= 1) return { tier: 'elite', percentile, displayText: 'Top 1%' }
    if (percentile <= 5) return { tier: 'rare', percentile, displayText: 'Top 5%' }
    if (percentile <= 15) return { tier: 'unique', percentile, displayText: 'Top 15%' }
    if (percentile <= 30) return { tier: 'notable', percentile, displayText: 'Top 30%' }
    if (percentile <= 60) return { tier: 'popular', percentile, displayText: 'Top 60%' }
    return { tier: 'common', percentile, displayText: 'Common' }
  }
}

class PostService {
  constructor(private supabase: any) {}

  async createPost(request: CreatePostRequest): Promise<CreatePostResponse> {
    // 1. Generate embedding
    const embedding = await EmbeddingService.generateEmbedding(request.content)
    
    // 2. Find similar posts using vector search
    const { data: matches } = await this.supabase.rpc('match_posts_by_embedding', {
      query_embedding: embedding,
      match_threshold: 0.90,
      scope_filter: request.scope,
      filter_city: request.location.city,
      filter_state: request.location.state,
      filter_country: request.location.country
    })
    
    // 3. Calculate uniqueness
    const matchCount = matches?.length || 0
    const { data: totalPosts } = await this.supabase
      .from('posts')
      .select('count')
      .single()
    
    const percentile = UniquenessCalculator.calculatePercentile(
      matchCount,
      totalPosts?.count || 100
    )
    
    // 4. Insert post
    const { data: post } = await this.supabase.from('posts').insert({
      content: request.content,
      input_type: request.inputType,
      scope: request.scope,
      location_city: request.location.city,
      location_state: request.location.state,
      location_country: request.location.country,
      embedding,
      match_count: matchCount,
      tier: percentile.tier,
      percentile: percentile.percentile,
      user_id: request.userId
    }).select().single()
    
    return { post, percentile, matchCount }
  }
}

// ============================================================
// MAIN HANDLER
// ============================================================

serve(async (req) => {
  try {
    const supabase = createClient(
      Deno.env.get('SUPABASE_URL')!,
      Deno.env.get('SUPABASE_ANON_KEY')!
    )
    
    const body: CreatePostRequest = await req.json()
    
    // Validate input
    if (!body.content || body.content.length < 3) {
      return new Response('Invalid content', { status: 400 })
    }
    
    // Create post
    const postService = new PostService(supabase)
    const result = await postService.createPost(body)
    
    return new Response(
      JSON.stringify(result),
      { headers: { 'Content-Type': 'application/json' } }
    )
  } catch (error) {
    return new Response(
      JSON.stringify({ error: error.message }),
      { status: 500, headers: { 'Content-Type': 'application/json' } }
    )
  }
})
```

---

## 🗂️ **Project Structure**

```
onlyOne.today/
├── mobile/                          # React Native app
│   ├── src/
│   │   ├── lib/
│   │   │   ├── supabase.ts         # Supabase client initialization
│   │   │   └── api/                # API wrapper functions
│   │   │       ├── posts.ts        # Post-related API calls
│   │   │       ├── auth.ts         # Auth API calls
│   │   │       ├── reactions.ts    # Reactions API
│   │   │       ├── leaderboards.ts # Leaderboard queries
│   │   │       └── notifications.ts # Notification API
│   │   └── types/                  # Shared TypeScript types
│   │       ├── post.types.ts
│   │       ├── user.types.ts
│   │       └── api.types.ts
│
├── supabase/                        # Backend (Supabase)
│   ├── migrations/                  # Database schema
│   │   ├── 001_initial_schema.sql
│   │   ├── 002_auth_tables.sql
│   │   ├── 003_reactions.sql
│   │   ├── 004_pgvector.sql
│   │   └── 005_rls_policies.sql
│   │
│   ├── functions/                   # Edge Functions (TypeScript/Deno)
│   │   ├── create-post/
│   │   │   ├── index.ts            # Main handler
│   │   │   ├── services/
│   │   │   │   ├── EmbeddingService.ts
│   │   │   │   ├── UniquenessCalculator.ts
│   │   │   │   └── PostService.ts
│   │   │   └── types/
│   │   │       └── post.types.ts
│   │   │
│   │   ├── send-notification/
│   │   │   ├── index.ts
│   │   │   └── services/
│   │   │       └── NotificationService.ts
│   │   │
│   │   ├── send-email/
│   │   │   ├── index.ts
│   │   │   └── services/
│   │   │       └── EmailService.ts
│   │   │
│   │   ├── fetch-trending/
│   │   │   ├── index.ts
│   │   │   └── services/
│   │   │       ├── SpotifyService.ts
│   │   │       ├── RedditService.ts
│   │   │       └── YouTubeService.ts
│   │   │
│   │   └── calculate-analytics/
│   │       ├── index.ts
│   │       └── services/
│   │           └── AnalyticsService.ts
│   │
│   └── config.toml                  # Supabase configuration
│
└── shared/                          # Shared code (optional)
    └── types/                       # Types used by both mobile & backend
        ├── post.types.ts
        ├── user.types.ts
        └── api.types.ts
```

---

## 📝 **All Your APIs Defined**

### **Category 1: Direct Database Access (No Edge Function)**

**Mobile calls Supabase directly, no backend code needed:**

```typescript
// mobile/src/lib/api/posts.ts

// 1. Get Feed Posts
export const getFeedPosts = (filters) => 
  supabase.from('posts').select('*').match(filters)

// 2. Get User Posts
export const getUserPosts = (userId) =>
  supabase.from('posts').select('*').eq('user_id', userId)

// 3. Get Post by ID
export const getPost = (postId) =>
  supabase.from('posts').select('*').eq('id', postId).single()

// 4. Get Leaderboard
export const getLeaderboard = (type) =>
  supabase.from('leaderboards').select('*').eq('type', type).limit(100)

// 5. Get User Profile
export const getProfile = (userId) =>
  supabase.from('profiles').select('*').eq('id', userId).single()

// 6. Update Profile
export const updateProfile = (userId, updates) =>
  supabase.from('profiles').update(updates).eq('id', userId)

// 7. Get Reactions
export const getPostReactions = (postId) =>
  supabase.from('reactions').select('*').eq('post_id', postId)

// 8. Add Reaction
export const addReaction = (postId, type) =>
  supabase.from('reactions').insert({ post_id: postId, reaction_type: type })

// 9. Get Trending
export const getTrending = (source) =>
  supabase.from('trending_cache').select('*').eq('source', source)

// 10. Get Notifications
export const getNotifications = (userId) =>
  supabase.from('notifications').select('*').eq('user_id', userId)

// 11. Get Day Posts
export const getDayPosts = (dayOfWeek) =>
  supabase.from('day_posts').select('*').eq('day_of_week', dayOfWeek)

// 12. Get User Streak
export const getUserStreak = (userId) =>
  supabase.from('user_streaks').select('*').eq('user_id', userId).single()

// 13. Subscribe to Real-time (Leaderboard)
export const subscribeToLeaderboard = (callback) =>
  supabase
    .channel('leaderboard-changes')
    .on('postgres_changes', { event: '*', schema: 'public', table: 'leaderboards' }, callback)
    .subscribe()

// ... 20+ more simple CRUD operations
```

**Total: ~30-40 simple APIs, ZERO backend code needed!**

---

### **Category 2: Edge Functions (Complex Logic)**

**Written in TypeScript (Deno), structured like classes:**

```typescript
// supabase/functions/shared/services/EmbeddingService.ts

export class EmbeddingService {
  private static embedder: any = null

  /**
   * Initialize embedding model (cached)
   */
  static async init() {
    if (this.embedder) return
    
    const { pipeline } = await import('https://esm.sh/@xenova/transformers@2.6.0')
    this.embedder = await pipeline('feature-extraction', 'Xenova/all-MiniLM-L6-v2')
  }

  /**
   * Generate embedding vector for text
   */
  static async generate(text: string): Promise<number[]> {
    await this.init()
    
    const output = await this.embedder(text.toLowerCase().trim(), {
      pooling: 'mean',
      normalize: true
    })
    
    return Array.from(output.data) as number[]
  }

  /**
   * Calculate cosine similarity
   */
  static cosineSimilarity(a: number[], b: number[]): number {
    let dotProduct = 0
    let normA = 0
    let normB = 0
    
    for (let i = 0; i < a.length; i++) {
      dotProduct += a[i] * b[i]
      normA += a[i] * a[i]
      normB += b[i] * b[i]
    }
    
    return dotProduct / (Math.sqrt(normA) * Math.sqrt(normB))
  }
}
```

```typescript
// supabase/functions/shared/services/PostService.ts

export class PostService {
  constructor(private supabase: any) {}

  async create(request: CreatePostRequest): Promise<CreatePostResponse> {
    // Complex logic here
    const embedding = await EmbeddingService.generate(request.content)
    const matches = await this.findSimilarPosts(embedding, request.scope)
    const percentile = await this.calculatePercentile(matches.length)
    
    const post = await this.insertPost({
      ...request,
      embedding,
      match_count: matches.length,
      tier: percentile.tier
    })
    
    // Trigger notifications if achievement
    if (percentile.tier === 'elite') {
      await NotificationService.sendAchievement(post.user_id, percentile)
    }
    
    return { post, percentile, matches }
  }

  private async findSimilarPosts(embedding: number[], scope: string) {
    const { data } = await this.supabase.rpc('match_posts_by_embedding', {
      query_embedding: embedding,
      match_threshold: 0.90,
      scope_filter: scope
    })
    return data || []
  }

  private async calculatePercentile(matchCount: number): Promise<PercentileData> {
    // Percentile calculation logic
    return UniquenessCalculator.calculate(matchCount)
  }

  private async insertPost(postData: any) {
    const { data } = await this.supabase
      .from('posts')
      .insert(postData)
      .select()
      .single()
    return data
  }
}
```

```typescript
// supabase/functions/shared/services/NotificationService.ts

import { Expo } from 'https://esm.sh/expo-server-sdk@3'

export class NotificationService {
  private static expo = new Expo()

  static async sendAchievement(userId: string, percentile: PercentileData) {
    const supabase = createClient(...)
    
    // Get user's push token
    const { data: user } = await supabase
      .from('profiles')
      .select('push_token')
      .eq('id', userId)
      .single()
    
    if (!user?.push_token) return
    
    // Send push notification
    await this.expo.sendPushNotificationsAsync([{
      to: user.push_token,
      title: 'Notable Action!',
      body: `You hit ${percentile.tier} tier!`,
      data: { type: 'achievement', tier: percentile.tier }
    }])
    
    // Also save notification in DB
    await supabase.from('notifications').insert({
      user_id: userId,
      type: 'achievement',
      title: 'Notable Action!',
      message: `You hit ${percentile.tier} tier!`,
      is_read: false
    })
  }

  static async sendWeeklySummary(userId: string, summary: WeeklySummary) {
    // Similar pattern
  }
}
```

```typescript
// supabase/functions/shared/services/EmailService.ts

import { Resend } from 'https://esm.sh/resend@2'

export class EmailService {
  private static resend = new Resend(Deno.env.get('RESEND_API_KEY'))

  static async sendWelcome(email: string, name: string) {
    await this.resend.emails.send({
      from: 'OnlyOne <hello@onlyonetoday.com>',
      to: email,
      subject: 'Welcome to OnlyOne.Today!',
      html: this.getWelcomeTemplate(name)
    })
  }

  static async sendAchievement(email: string, achievement: Achievement) {
    await this.resend.emails.send({
      from: 'OnlyOne <hello@onlyonetoday.com>',
      to: email,
      subject: `You hit ${achievement.tier} tier!`,
      html: this.getAchievementTemplate(achievement)
    })
  }

  private static getWelcomeTemplate(name: string): string {
    return `
      <h1>Welcome ${name}!</h1>
      <p>Your moments count. Start sharing today.</p>
    `
  }

  private static getAchievementTemplate(achievement: Achievement): string {
    return `
      <h1>Congrats!</h1>
      <p>You just hit ${achievement.tier} tier!</p>
    `
  }
}
```

---

## 🎯 **Complete API List (ALL FEATURES)**

### **Authentication APIs (Supabase Built-in)**
```typescript
// NO CODE NEEDED - Just use Supabase SDK

1. supabase.auth.signUp({ phone, password })
2. supabase.auth.signInWithPassword({ phone, password })
3. supabase.auth.signInWithOtp({ phone })
4. supabase.auth.verifyOtp({ phone, token })
5. supabase.auth.signOut()
6. supabase.auth.getSession()
7. supabase.auth.resetPasswordForEmail({ email })
8. supabase.auth.updateUser({ data: { ... } })
```

### **Posts APIs**

**Direct DB (Simple):**
```typescript
9. getFeedPosts(filters) - Direct query
10. getUserPosts(userId) - Direct query
11. getPostById(postId) - Direct query
12. deletePost(postId) - Direct query (with RLS)
```

**Edge Function (Complex):**
```typescript
13. createPost(content, scope, location) - Edge Function
    ↳ Generates embedding
    ↳ Finds matches
    ↳ Calculates percentile
    ↳ Triggers notifications
```

### **Reactions APIs (Direct DB)**
```typescript
14. getPostReactions(postId)
15. addReaction(postId, type)
16. removeReaction(reactionId)
17. getUserReactions(userId)
```

### **User Profile APIs (Direct DB)**
```typescript
18. getProfile(userId)
19. updateProfile(userId, data)
20. uploadAvatar(file) - Supabase Storage
21. getPublicProfile(username)
```

### **Leaderboards APIs (Direct DB + Materialized View)**
```typescript
22. getCityLeaderboard(limit)
23. getStateLeaderboard(limit)
24. getCountryLeaderboard(limit)
25. getGlobalLeaderboard(limit)
26. getTrendingLeaderboard(limit)
27. getUserRank(userId, scope)
```

### **Themed Days APIs**

**Direct DB:**
```typescript
28. getDayPosts(dayOfWeek)
29. getUserDayPosts(userId, dayOfWeek)
```

**Edge Function:**
```typescript
30. createDayPost(dayOfWeek, content) - Edge Function
    ↳ Validates day matches current day
    ↳ Stores post
    ↳ Updates user stats
```

### **Notifications APIs**

**Direct DB:**
```typescript
31. getNotifications(userId)
32. markAsRead(notificationId)
33. markAllAsRead(userId)
```

**Edge Function:**
```typescript
34. sendPushNotification(userId, notification) - Edge Function
35. sendEmailNotification(userId, email) - Edge Function
```

### **Trending APIs**

**Direct DB:**
```typescript
36. getTrendingPosts(source, limit)
37. getTrendingByCategory(category)
```

**Edge Function (Background Job):**
```typescript
38. fetchTrendingData() - Edge Function (Cron)
    ↳ Spotify API
    ↳ Reddit API  
    ↳ YouTube API
    ↳ Cache in DB
```

### **Analytics APIs (Direct DB)**
```typescript
39. getDailyStats(date)
40. getUserStats(userId)
41. getGlobalStats()
```

**Edge Function (Background):**
```typescript
42. calculateDailyAnalytics() - Edge Function (Cron)
    ↳ Aggregate all posts
    ↳ Calculate stats
    ↳ Update materialized views
```

### **Streaks APIs (Direct DB)**
```typescript
43. getUserStreak(userId)
44. getStreakLeaderboard()
```

**Edge Function (Triggered):**
```typescript
45. updateStreak(userId) - Edge Function
    ↳ Called when user posts
    ↳ Increments streak
    ↳ Checks if milestone
    ↳ Sends notification if needed
```

### **Settings APIs (Direct DB)**
```typescript
46. getSettings(userId)
47. updateSettings(userId, settings)
48. updatePushToken(userId, token)
49. updateEmailPreferences(userId, prefs)
```

---

## 🏗️ **How Classes/Services Are Organized**

### **Shared Services (supabase/functions/shared/)**

```
supabase/functions/shared/
├── services/
│   ├── EmbeddingService.ts        # Vector embeddings
│   ├── UniquenessCalculator.ts    # Percentile calculations
│   ├── PostService.ts             # Post CRUD + matching
│   ├── NotificationService.ts     # Push notifications
│   ├── EmailService.ts            # Email sending
│   ├── TrendingService.ts         # API aggregation
│   ├── AnalyticsService.ts        # Stats calculations
│   └── StreakService.ts           # Streak tracking
│
├── types/
│   ├── post.types.ts              # Post interfaces
│   ├── user.types.ts              # User interfaces
│   ├── notification.types.ts      # Notification interfaces
│   └── api.types.ts               # API request/response types
│
├── utils/
│   ├── validation.ts              # Input validation (Zod)
│   ├── errors.ts                  # Error handling
│   └── cache.ts                   # Caching utilities
│
└── config/
    ├── constants.ts               # App constants
    └── env.ts                     # Environment variables
```

### **Each Edge Function Imports These**

```typescript
// supabase/functions/create-post/index.ts

import { serve } from 'https://deno.land/std@0.168.0/http/server.ts'
import { PostService } from '../shared/services/PostService.ts'
import { EmbeddingService } from '../shared/services/EmbeddingService.ts'
import { NotificationService } from '../shared/services/NotificationService.ts'
import type { CreatePostRequest } from '../shared/types/api.types.ts'

serve(async (req) => {
  const body: CreatePostRequest = await req.json()
  
  const postService = new PostService(supabase)
  const result = await postService.create(body)
  
  return new Response(JSON.stringify(result))
})
```

---

## 🔄 **API Call Flow Examples**

### **Example 1: Simple Feed Load (Direct DB)**

```
Mobile App
    ↓
supabase.from('posts').select('*')
    ↓
Supabase PostgreSQL
    ↓
Returns posts array
    ↓
Mobile renders feed

Latency: ~50ms
Cost: $0
Code: 3 lines
```

### **Example 2: Create Post (Edge Function)**

```
Mobile App
    ↓
supabase.functions.invoke('create-post', { content, scope })
    ↓
Edge Function (TypeScript/Deno)
    ├── EmbeddingService.generate(content)
    ├── PostService.findSimilar(embedding)
    ├── UniquenessCalculator.calculate(matches)
    ├── PostService.insert(post)
    └── NotificationService.send(if elite)
    ↓
Supabase PostgreSQL (save post)
    ↓
Returns { post, percentile, matches }
    ↓
Mobile shows result screen

Latency: ~150-200ms (embedding generation)
Cost: $0 (2M free invocations/month)
Code: ~100 lines (organized in classes)
```

### **Example 3: Real-time Leaderboard (Subscription)**

```
Mobile App
    ↓
supabase.channel('leaderboard').subscribe()
    ↓
Supabase Realtime (WebSocket)
    ↓
[New post created elsewhere]
    ↓
Database trigger fires
    ↓
Leaderboard materialized view refreshes
    ↓
Change broadcasted via WebSocket
    ↓
Mobile receives update
    ↓
UI updates instantly

Latency: ~20-50ms
Cost: $0
Code: 5 lines
```

---

## 📚 **Language Summary**

### **Mobile App (React Native)**
- **Language**: TypeScript
- **Framework**: React Native + Expo
- **API Calls**: Supabase SDK (direct DB queries)
- **Types**: Shared with backend

### **Backend (Supabase Edge Functions)**
- **Language**: TypeScript (Deno runtime)
- **Framework**: None (just Deno std library)
- **Style**: Classes & services (like Express, but serverless)
- **Imports**: ESM URLs (Deno style)

### **Database**
- **Language**: SQL (PostgreSQL 15)
- **Functions**: PL/pgSQL (for complex queries)
- **Triggers**: Automatic (for cascading updates)

---

## 🎨 **Code Style Comparison**

### **Traditional Express Backend**

```typescript
// TRADITIONAL WAY (Not recommended)

// server/src/routes/posts.ts
import express from 'express'
import { PostService } from '../services/PostService'

const router = express.Router()

router.post('/posts', async (req, res) => {
  const postService = new PostService(db)
  const result = await postService.create(req.body)
  res.json(result)
})

router.get('/posts', async (req, res) => {
  const posts = await db.query('SELECT * FROM posts')
  res.json(posts)
})

// ... 50 more routes
```

### **Supabase Way (Recommended)**

```typescript
// SUPABASE WAY (Better!)

// Simple reads: NO CODE NEEDED
// Just use: supabase.from('posts').select('*')

// Complex writes: Edge Function
// supabase/functions/create-post/index.ts
serve(async (req) => {
  const postService = new PostService(supabase)
  const result = await postService.create(await req.json())
  return new Response(JSON.stringify(result))
})

// Only 5-10 Edge Functions total!
// Not 50 Express routes!
```

---

## 🔢 **Total Code Estimate**

### **Mobile App**
- API wrappers: ~500 lines
- Types: ~300 lines
- **Total**: ~800 lines

### **Supabase Backend**

**Edge Functions:**
```
create-post/        ~200 lines
send-notification/  ~100 lines
send-email/         ~150 lines
fetch-trending/     ~250 lines
calculate-analytics/~200 lines

Total: ~900 lines
```

**Shared Services:**
```
EmbeddingService      ~150 lines
PostService           ~250 lines
NotificationService   ~200 lines
EmailService          ~150 lines
TrendingService       ~300 lines
AnalyticsService      ~200 lines
StreakService         ~100 lines
Utilities             ~200 lines

Total: ~1,550 lines
```

**Database:**
```
Schema SQL:     ~1,000 lines
Functions SQL:  ~500 lines
RLS Policies:   ~300 lines

Total: ~1,800 lines
```

**Grand Total: ~4,150 lines of backend code**

### **Custom Express Backend (For Comparison)**

```
Auth system:        ~1,500 lines
Routes:             ~2,000 lines
Services:           ~2,500 lines
Middleware:         ~800 lines
Database ORM:       ~1,000 lines
WebSocket:          ~600 lines
File upload:        ~400 lines
Tests:              ~2,000 lines
DevOps configs:     ~500 lines

Total: ~11,300 lines (3x more code!)
```

---

## 🎯 **Your Backend Code Location**

```
supabase/
├── functions/              # All your backend logic (TypeScript/Deno)
│   ├── create-post/
│   ├── send-notification/
│   ├── send-email/
│   ├── fetch-trending/
│   ├── calculate-analytics/
│   └── shared/             # Your "classes" and "services"
│       ├── services/       # ← Business logic classes here
│       ├── types/          # ← TypeScript interfaces here
│       └── utils/          # ← Helper functions here
│
└── migrations/             # Database schema (SQL)
    ├── 001_initial.sql
    ├── 002_auth.sql
    └── ...
```

**Everything is TypeScript with classes, just like Node.js/Express!**

The only difference:
- ❌ Not Express routes (`app.post('/posts', ...)`)
- ✅ Deno serve function (`serve(async (req) => ...)`)

But the business logic, classes, services? **Exactly the same!**

---

## 📖 **Example: Full Feature Implementation**

### **Feature: Create Post with Uniqueness Matching**

**Mobile (3 lines):**
```typescript
const { data } = await supabase.functions.invoke('create-post', {
  body: { content, scope, location }
})
```

**Backend Classes (Organized like Express):**

```typescript
// services/EmbeddingService.ts
class EmbeddingService {
  static async generate(text: string): Promise<number[]> { ... }
}

// services/PostService.ts
class PostService {
  async create(req: CreatePostRequest): Promise<CreatePostResponse> { ... }
  private async findMatches(embedding: number[]): Promise<Post[]> { ... }
  private async calculateScore(matches: Post[]): Promise<PercentileData> { ... }
}

// services/NotificationService.ts  
class NotificationService {
  static async sendAchievement(userId: string, tier: string) { ... }
}

// functions/create-post/index.ts (Entry point)
serve(async (req) => {
  const postService = new PostService(supabase)
  const result = await postService.create(await req.json())
  
  if (result.percentile.tier === 'elite') {
    await NotificationService.sendAchievement(result.post.user_id, 'elite')
  }
  
  return new Response(JSON.stringify(result))
})
```

**Total: ~150 lines of organized, typed, class-based code**

---

## 🎓 **Learning Path**

### **Week 1: Supabase Basics**
1. Supabase Quick Start guide
2. JavaScript client library
3. Database queries
4. Authentication flow

### **Week 2: Edge Functions**
1. Deno runtime basics (very similar to Node.js)
2. Writing your first Edge Function
3. Deploying functions
4. Sharing code between functions

### **Week 3: Advanced Features**
1. pgvector and semantic search
2. Real-time subscriptions
3. Row Level Security
4. Cron jobs with pg_cron

**Total Learning Curve**: ~1-2 weeks (you already know TypeScript!)

---

## 🚀 **Decision: Supabase with TypeScript/Deno**

### **Answer to Your Question:**

**"What's our API language?"**
→ **TypeScript** (same as your mobile app!)

**"Where do we define classes?"**
→ **`supabase/functions/shared/services/`** (organized exactly like Express services)

**"We might need so many APIs right?"**
→ **~45 total APIs, but:**
- **30 are direct DB queries** (no backend code needed!)
- **10 are Edge Functions** (TypeScript classes)
- **5 are background jobs** (cron-triggered Edge Functions)

### **What You Write:**

**NOT THIS (Express):**
```typescript
app.get('/api/posts', ...)
app.post('/api/posts', ...)
app.get('/api/users/:id', ...)
// ... 50 routes
```

**THIS (Supabase):**
```typescript
// Direct queries (mobile):
supabase.from('posts').select('*')

// Complex logic (5-10 Edge Functions):
PostService.create(...)
NotificationService.send(...)
EmailService.send(...)
```

**Result**: 70% less code, 10x faster development, auto-scaling, $0 to start.

---

## ✅ **Final Answer**

**Tech Stack:**
- **Language**: TypeScript (everywhere)
- **Runtime**: Deno (for Edge Functions)
- **Database**: PostgreSQL + pgvector (Supabase)
- **Auth**: Supabase Auth (built-in)
- **APIs**: Supabase SDK (direct) + Edge Functions (complex)
- **Classes**: Organized in `services/` folder (just like Express!)
- **Cost**: $0-25/month until 100K users

**You DON'T need to choose between Supabase and custom backend.**

**Supabase IS your backend. TypeScript IS your API language. Classes ARE in Edge Functions.**

It's just modern, serverless, and way more efficient than traditional backends! 🎉

---

**Want me to start building it?** I can:
1. Create the Supabase project structure
2. Write all the service classes
3. Set up the database schema
4. Build the Edge Functions
5. Integrate with mobile app

Ready when you are! 🚀

