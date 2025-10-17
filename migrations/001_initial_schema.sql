-- ============================================================================
-- OnlyOne.Today - Initial Database Schema
-- Version: 1.0.0
-- Date: 2025-10-17
-- 
-- Features:
-- - User authentication and profiles
-- - Posts with vector embeddings (pgvector)
-- - Reactions and social features
-- - Streaks tracking
-- - Themed days
-- - Analytics foundation (ready for complex queries)
-- - Performance optimizations (indexes, materialized views)
-- ============================================================================

-- ============================================================================
-- EXTENSIONS
-- ============================================================================

-- UUID generation
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- Full-text search
CREATE EXTENSION IF NOT EXISTS "pg_trgm";

-- Vector similarity search (for uniqueness matching)
CREATE EXTENSION IF NOT EXISTS "vector";

-- Scheduled jobs (for background tasks)
CREATE EXTENSION IF NOT EXISTS "pg_cron";

-- HTTP requests (for webhooks and external APIs)
CREATE EXTENSION IF NOT EXISTS "pg_net";

-- ============================================================================
-- CUSTOM TYPES
-- ============================================================================

CREATE TYPE post_type AS ENUM ('action', 'day');
CREATE TYPE scope_type AS ENUM ('city', 'state', 'country', 'world');
CREATE TYPE tier_type AS ENUM ('elite', 'rare', 'unique', 'notable', 'popular', 'common');
CREATE TYPE reaction_type AS ENUM ('funny', 'creative', 'must_try');
CREATE TYPE day_of_week AS ENUM ('monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday', 'sunday');
CREATE TYPE notification_type AS ENUM ('achievement', 'social', 'system', 'update');

-- ============================================================================
-- PROFILES TABLE (extends auth.users)
-- ============================================================================

CREATE TABLE public.profiles (
  id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  
  -- Basic Info
  username TEXT UNIQUE NOT NULL,
  first_name TEXT NOT NULL,
  last_name TEXT NOT NULL,
  date_of_birth DATE,
  bio TEXT,
  
  -- Avatar
  avatar_url TEXT,
  
  -- Notifications
  push_token TEXT, -- Expo push token
  email_notifications BOOLEAN DEFAULT true,
  push_notifications BOOLEAN DEFAULT true,
  
  -- Privacy
  is_private BOOLEAN DEFAULT false,
  
  -- Analytics-ready fields
  last_active_at TIMESTAMPTZ DEFAULT NOW(),
  signup_source TEXT, -- 'ios', 'android', 'web'
  referral_code TEXT,
  referred_by UUID REFERENCES public.profiles(id),
  
  -- Metadata
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  
  -- Constraints
  CONSTRAINT username_length CHECK (char_length(username) >= 3 AND char_length(username) <= 30),
  CONSTRAINT username_format CHECK (username ~ '^[a-z0-9_]+$'),
  CONSTRAINT bio_length CHECK (char_length(bio) <= 500)
);

-- Indexes for performance
CREATE INDEX idx_profiles_username ON public.profiles(username);
CREATE INDEX idx_profiles_created_at ON public.profiles(created_at DESC);
CREATE INDEX idx_profiles_last_active ON public.profiles(last_active_at DESC);
CREATE INDEX idx_profiles_referral ON public.profiles(referred_by);

-- Analytics: Track user growth
CREATE INDEX idx_profiles_signup_source ON public.profiles(signup_source);
-- Date-based index removed for compatibility

-- ============================================================================
-- POSTS TABLE (Core feature)
-- ============================================================================

CREATE TABLE public.posts (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  
  -- Content
  content TEXT NOT NULL,
  input_type post_type NOT NULL,
  
  -- User (nullable for anonymous posts)
  user_id UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  is_anonymous BOOLEAN DEFAULT false,
  
  -- Scope & Location
  scope scope_type NOT NULL,
  location_city TEXT,
  location_state TEXT,
  location_country TEXT,
  location_coords POINT, -- For future geospatial features
  
  -- Uniqueness Matching
  content_hash TEXT NOT NULL, -- Fast lookup hash
  embedding vector(384), -- Semantic similarity (pgvector)
  
  -- Results
  match_count INTEGER DEFAULT 0,
  percentile FLOAT,
  tier tier_type,
  
  -- Analytics fields
  view_count INTEGER DEFAULT 0,
  share_count INTEGER DEFAULT 0,
  
  -- Metadata
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  
  -- Constraints
  CONSTRAINT content_length CHECK (char_length(content) >= 3 AND char_length(content) <= 500),
  CONSTRAINT percentile_range CHECK (percentile >= 0 AND percentile <= 100)
);

-- Performance indexes
CREATE INDEX idx_posts_user_id ON public.posts(user_id);
CREATE INDEX idx_posts_content_hash ON public.posts(content_hash);
CREATE INDEX idx_posts_scope ON public.posts(scope);
CREATE INDEX idx_posts_created_at ON public.posts(created_at DESC);
CREATE INDEX idx_posts_tier ON public.posts(tier);
CREATE INDEX idx_posts_input_type ON public.posts(input_type);

-- Location indexes for leaderboards
CREATE INDEX idx_posts_location_city ON public.posts(location_city) WHERE location_city IS NOT NULL;
CREATE INDEX idx_posts_location_state ON public.posts(location_state) WHERE location_state IS NOT NULL;
CREATE INDEX idx_posts_location_country ON public.posts(location_country) WHERE location_country IS NOT NULL;

-- Full-text search (future feature)
CREATE INDEX idx_posts_content_fts ON public.posts USING gin(to_tsvector('english', content));

-- Vector similarity search (CRITICAL for performance!)
CREATE INDEX idx_posts_embedding_hnsw ON public.posts 
  USING hnsw (embedding vector_cosine_ops)
  WITH (m = 16, ef_construction = 64); -- Optimized for accuracy + speed

-- Composite indexes for common queries
CREATE INDEX idx_posts_scope_created ON public.posts(scope, created_at DESC);
CREATE INDEX idx_posts_user_created ON public.posts(user_id, created_at DESC);
CREATE INDEX idx_posts_tier_created ON public.posts(tier, created_at DESC);

-- Analytics: Posts by date - removed for compatibility

-- ============================================================================
-- REACTIONS TABLE
-- ============================================================================

CREATE TABLE public.reactions (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  
  post_id UUID NOT NULL REFERENCES public.posts(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  reaction_type reaction_type NOT NULL,
  
  created_at TIMESTAMPTZ DEFAULT NOW(),
  
  -- Prevent duplicate reactions
  UNIQUE(post_id, user_id, reaction_type)
);

-- Indexes
CREATE INDEX idx_reactions_post_id ON public.reactions(post_id);
CREATE INDEX idx_reactions_user_id ON public.reactions(user_id);
CREATE INDEX idx_reactions_created_at ON public.reactions(created_at DESC);

-- Analytics: Reaction trends - removed for compatibility

-- ============================================================================
-- REACTION COUNTS (Denormalized for performance)
-- ============================================================================

CREATE TABLE public.post_reaction_counts (
  post_id UUID PRIMARY KEY REFERENCES public.posts(id) ON DELETE CASCADE,
  
  funny_count INTEGER DEFAULT 0,
  creative_count INTEGER DEFAULT 0,
  must_try_count INTEGER DEFAULT 0,
  total_count INTEGER DEFAULT 0,
  
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Auto-update reaction counts (trigger)
CREATE OR REPLACE FUNCTION update_reaction_counts()
RETURNS TRIGGER AS $$
BEGIN
  -- Upsert reaction counts
  INSERT INTO public.post_reaction_counts (post_id, funny_count, creative_count, must_try_count, total_count)
  VALUES (
    COALESCE(NEW.post_id, OLD.post_id),
    (SELECT COUNT(*) FROM public.reactions WHERE post_id = COALESCE(NEW.post_id, OLD.post_id) AND reaction_type = 'funny'),
    (SELECT COUNT(*) FROM public.reactions WHERE post_id = COALESCE(NEW.post_id, OLD.post_id) AND reaction_type = 'creative'),
    (SELECT COUNT(*) FROM public.reactions WHERE post_id = COALESCE(NEW.post_id, OLD.post_id) AND reaction_type = 'must_try'),
    (SELECT COUNT(*) FROM public.reactions WHERE post_id = COALESCE(NEW.post_id, OLD.post_id))
  )
  ON CONFLICT (post_id) DO UPDATE SET
    funny_count = EXCLUDED.funny_count,
    creative_count = EXCLUDED.creative_count,
    must_try_count = EXCLUDED.must_try_count,
    total_count = EXCLUDED.total_count,
    updated_at = NOW();
  
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trigger_update_reaction_counts
  AFTER INSERT OR DELETE ON public.reactions
  FOR EACH ROW
  EXECUTE FUNCTION update_reaction_counts();

-- ============================================================================
-- USER STREAKS TABLE
-- ============================================================================

CREATE TABLE public.user_streaks (
  user_id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  
  current_streak INTEGER DEFAULT 0,
  longest_streak INTEGER DEFAULT 0,
  last_post_date DATE,
  
  -- Analytics
  total_posts INTEGER DEFAULT 0,
  elite_posts INTEGER DEFAULT 0,
  rare_posts INTEGER DEFAULT 0,
  
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_streaks_current ON public.user_streaks(current_streak DESC);
CREATE INDEX idx_streaks_longest ON public.user_streaks(longest_streak DESC);

-- ============================================================================
-- THEMED DAY POSTS TABLE
-- ============================================================================

CREATE TABLE public.day_posts (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  day_of_week day_of_week NOT NULL,
  content TEXT NOT NULL,
  
  -- Reactions (JSONB for flexibility)
  reactions JSONB DEFAULT '{"first": 0, "second": 0, "third": 0}'::jsonb,
  
  created_at TIMESTAMPTZ DEFAULT NOW(),
  
  CONSTRAINT content_length CHECK (char_length(content) >= 3 AND char_length(content) <= 1000)
);

CREATE INDEX idx_day_posts_user_id ON public.day_posts(user_id);
CREATE INDEX idx_day_posts_day ON public.day_posts(day_of_week);
CREATE INDEX idx_day_posts_created_at ON public.day_posts(created_at DESC);
-- Date-based composite index removed for compatibility

-- ============================================================================
-- NOTIFICATIONS TABLE
-- ============================================================================

CREATE TABLE public.notifications (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  
  type notification_type NOT NULL,
  title TEXT NOT NULL,
  message TEXT NOT NULL,
  
  -- Optional linked data
  post_id UUID REFERENCES public.posts(id) ON DELETE SET NULL,
  related_user_id UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  
  -- Metadata
  data JSONB,
  
  -- Status
  is_read BOOLEAN DEFAULT false,
  read_at TIMESTAMPTZ,
  
  created_at TIMESTAMPTZ DEFAULT NOW(),
  
  CONSTRAINT title_length CHECK (char_length(title) <= 100),
  CONSTRAINT message_length CHECK (char_length(message) <= 500)
);

CREATE INDEX idx_notifications_user_id ON public.notifications(user_id);
CREATE INDEX idx_notifications_created_at ON public.notifications(created_at DESC);
CREATE INDEX idx_notifications_unread ON public.notifications(user_id, is_read) WHERE is_read = false;
CREATE INDEX idx_notifications_type ON public.notifications(type);

-- ============================================================================
-- TRENDING CACHE TABLE
-- ============================================================================

CREATE TABLE public.trending_cache (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  
  source TEXT NOT NULL, -- 'spotify', 'reddit', 'youtube', 'sports'
  category TEXT,
  rank INTEGER NOT NULL,
  
  title TEXT NOT NULL,
  description TEXT,
  count BIGINT, -- How many people are engaging with this
  url TEXT,
  
  -- Metadata (flexible for different sources)
  metadata JSONB DEFAULT '{}'::jsonb,
  
  -- Cache management
  fetched_at TIMESTAMPTZ DEFAULT NOW(),
  expires_at TIMESTAMPTZ NOT NULL,
  
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_trending_source ON public.trending_cache(source);
CREATE INDEX idx_trending_rank ON public.trending_cache(source, rank);
CREATE INDEX idx_trending_expires ON public.trending_cache(expires_at);
CREATE INDEX idx_trending_category ON public.trending_cache(category);

-- Auto-delete expired trending data (index without NOW() for compatibility)
CREATE INDEX idx_trending_cleanup ON public.trending_cache(expires_at);

-- ============================================================================
-- ANALYTICS TABLES (Future-proof)
-- ============================================================================

-- Daily aggregated stats (for charts and trends)
CREATE TABLE public.daily_stats (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  date DATE NOT NULL UNIQUE,
  
  -- Post metrics
  total_posts INTEGER DEFAULT 0,
  action_posts INTEGER DEFAULT 0,
  day_posts INTEGER DEFAULT 0,
  
  -- Uniqueness distribution
  elite_posts INTEGER DEFAULT 0,
  rare_posts INTEGER DEFAULT 0,
  unique_posts INTEGER DEFAULT 0,
  notable_posts INTEGER DEFAULT 0,
  popular_posts INTEGER DEFAULT 0,
  common_posts INTEGER DEFAULT 0,
  
  -- Scope distribution
  world_posts INTEGER DEFAULT 0,
  country_posts INTEGER DEFAULT 0,
  state_posts INTEGER DEFAULT 0,
  city_posts INTEGER DEFAULT 0,
  
  -- User metrics
  new_users INTEGER DEFAULT 0,
  active_users INTEGER DEFAULT 0,
  posting_users INTEGER DEFAULT 0,
  
  -- Engagement metrics
  total_reactions INTEGER DEFAULT 0,
  avg_reactions_per_post FLOAT DEFAULT 0,
  
  -- Streak metrics
  users_with_streaks INTEGER DEFAULT 0,
  avg_streak_length FLOAT DEFAULT 0,
  
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_daily_stats_date ON public.daily_stats(date DESC);

-- User-level analytics (for personalized insights)
CREATE TABLE public.user_analytics (
  user_id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  
  -- Posting behavior
  total_posts INTEGER DEFAULT 0,
  total_actions INTEGER DEFAULT 0,
  total_summaries INTEGER DEFAULT 0,
  
  -- Tier achievements
  elite_count INTEGER DEFAULT 0,
  rare_count INTEGER DEFAULT 0,
  unique_count INTEGER DEFAULT 0,
  
  -- Best performances
  best_percentile FLOAT,
  best_tier tier_type,
  
  -- Activity patterns (for ML/insights)
  most_active_hour INTEGER, -- 0-23
  most_active_day_of_week INTEGER, -- 0-6
  avg_post_length FLOAT,
  
  -- Engagement given
  reactions_given INTEGER DEFAULT 0,
  
  -- Engagement received
  reactions_received INTEGER DEFAULT 0,
  shares_received INTEGER DEFAULT 0,
  
  -- Streaks
  current_streak INTEGER DEFAULT 0,
  longest_streak INTEGER DEFAULT 0,
  
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_user_analytics_elite ON public.user_analytics(elite_count DESC);
CREATE INDEX idx_user_analytics_total ON public.user_analytics(total_posts DESC);

-- Event tracking (for detailed analytics)
CREATE TABLE public.events (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  
  user_id UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  
  event_type TEXT NOT NULL, -- 'post_created', 'reaction_added', 'profile_viewed', etc.
  event_data JSONB DEFAULT '{}'::jsonb,
  
  -- Context
  platform TEXT, -- 'ios', 'android', 'web'
  app_version TEXT,
  
  -- Session tracking
  session_id UUID,
  
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Partitioned by month for performance (future optimization)
CREATE INDEX idx_events_user_id ON public.events(user_id, created_at DESC);
CREATE INDEX idx_events_type ON public.events(event_type);
CREATE INDEX idx_events_created_at ON public.events(created_at DESC);
CREATE INDEX idx_events_session ON public.events(session_id);

-- ============================================================================
-- LEADERBOARDS (Materialized Views for Performance)
-- ============================================================================

-- City Leaderboard (refreshed every 10 minutes)
CREATE MATERIALIZED VIEW city_leaderboard AS
SELECT 
  location_city as city,
  COUNT(*) as post_count,
  COUNT(*) FILTER (WHERE tier IN ('elite', 'rare')) as elite_count,
  COUNT(DISTINCT user_id) as unique_users,
  AVG(percentile) as avg_percentile
FROM public.posts
WHERE 
  location_city IS NOT NULL
  AND created_at > NOW() - INTERVAL '7 days'
GROUP BY location_city
ORDER BY elite_count DESC, post_count DESC
LIMIT 100;

CREATE UNIQUE INDEX idx_city_leaderboard_city ON city_leaderboard(city);

-- State Leaderboard
CREATE MATERIALIZED VIEW state_leaderboard AS
SELECT 
  location_state as state,
  COUNT(*) as post_count,
  COUNT(*) FILTER (WHERE tier IN ('elite', 'rare')) as elite_count,
  COUNT(DISTINCT user_id) as unique_users
FROM public.posts
WHERE 
  location_state IS NOT NULL
  AND created_at > NOW() - INTERVAL '7 days'
GROUP BY location_state
ORDER BY elite_count DESC
LIMIT 100;

CREATE UNIQUE INDEX idx_state_leaderboard_state ON state_leaderboard(state);

-- Country Leaderboard
CREATE MATERIALIZED VIEW country_leaderboard AS
SELECT 
  location_country as country,
  COUNT(*) as post_count,
  COUNT(*) FILTER (WHERE tier IN ('elite', 'rare')) as elite_count,
  COUNT(DISTINCT user_id) as unique_users
FROM public.posts
WHERE 
  location_country IS NOT NULL
  AND created_at > NOW() - INTERVAL '7 days'
GROUP BY location_country
ORDER BY elite_count DESC
LIMIT 100;

CREATE UNIQUE INDEX idx_country_leaderboard_country ON country_leaderboard(country);

-- ============================================================================
-- HELPER FUNCTIONS
-- ============================================================================

-- Update updated_at timestamp automatically
CREATE OR REPLACE FUNCTION update_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Apply to all tables
CREATE TRIGGER update_profiles_updated_at BEFORE UPDATE ON public.profiles
  FOR EACH ROW EXECUTE FUNCTION update_updated_at();

CREATE TRIGGER update_posts_updated_at BEFORE UPDATE ON public.posts
  FOR EACH ROW EXECUTE FUNCTION update_updated_at();

-- Update user's last_active_at on any activity
CREATE OR REPLACE FUNCTION update_last_active()
RETURNS TRIGGER AS $$
BEGIN
  UPDATE public.profiles
  SET last_active_at = NOW()
  WHERE id = NEW.user_id;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER update_last_active_on_post AFTER INSERT ON public.posts
  FOR EACH ROW EXECUTE FUNCTION update_last_active();

-- ============================================================================
-- VECTOR SEARCH FUNCTION (Critical for uniqueness matching)
-- ============================================================================

CREATE OR REPLACE FUNCTION match_posts_by_embedding(
  query_embedding vector(384),
  match_threshold FLOAT DEFAULT 0.90,
  match_limit INTEGER DEFAULT 20,
  scope_filter TEXT DEFAULT 'world',
  filter_city TEXT DEFAULT NULL,
  filter_state TEXT DEFAULT NULL,
  filter_country TEXT DEFAULT NULL,
  today_only BOOLEAN DEFAULT true
)
RETURNS TABLE (
  id UUID,
  content TEXT,
  user_id UUID,
  scope TEXT,
  location_city TEXT,
  location_state TEXT,
  location_country TEXT,
  similarity FLOAT,
  tier TEXT,
  created_at TIMESTAMPTZ
)
LANGUAGE plpgsql
AS $$
DECLARE
  today_start TIMESTAMPTZ;
BEGIN
  today_start := date_trunc('day', NOW());
  
  RETURN QUERY
  SELECT
    p.id,
    p.content,
    p.user_id,
    p.scope::TEXT,
    p.location_city,
    p.location_state,
    p.location_country,
    (1 - (p.embedding <=> query_embedding))::FLOAT as similarity,
    p.tier::TEXT,
    p.created_at
  FROM public.posts p
  WHERE 
    -- Only posts with embeddings
    p.embedding IS NOT NULL
    -- Similarity threshold
    AND (1 - (p.embedding <=> query_embedding)) > match_threshold
    -- Today only (optional)
    AND (NOT today_only OR p.created_at >= today_start)
    -- Scope-aware filtering
    AND (
      scope_filter = 'world'
      OR (scope_filter = 'country' AND p.location_country = filter_country AND p.scope::TEXT IN ('city', 'state', 'country'))
      OR (scope_filter = 'state' AND p.location_state = filter_state AND p.scope::TEXT IN ('city', 'state'))
      OR (scope_filter = 'city' AND p.location_city = filter_city AND p.scope::TEXT = 'city')
    )
  ORDER BY p.embedding <=> query_embedding
  LIMIT match_limit;
END;
$$;

-- ============================================================================
-- ANALYTICS FUNCTIONS (Optimized queries for dashboards)
-- ============================================================================

-- Get global stats (cached for 1 minute)
CREATE OR REPLACE FUNCTION get_global_stats()
RETURNS TABLE (
  total_posts_today BIGINT,
  unique_actions_today BIGINT,
  total_users BIGINT,
  active_users_today BIGINT
) AS $$
BEGIN
  RETURN QUERY
  SELECT
    COUNT(*) FILTER (WHERE created_at >= date_trunc('day', NOW())) as total_posts_today,
    COUNT(*) FILTER (WHERE tier IN ('elite', 'rare', 'unique') AND created_at >= date_trunc('day', NOW())) as unique_actions_today,
    (SELECT COUNT(*) FROM public.profiles) as total_users,
    COUNT(DISTINCT user_id) FILTER (WHERE created_at >= date_trunc('day', NOW())) as active_users_today
  FROM public.posts;
END;
$$ LANGUAGE plpgsql;

-- Get user stats
CREATE OR REPLACE FUNCTION get_user_stats(p_user_id UUID)
RETURNS TABLE (
  total_posts BIGINT,
  elite_posts BIGINT,
  current_streak INTEGER,
  total_reactions BIGINT
) AS $$
BEGIN
  RETURN QUERY
  SELECT
    COUNT(*) as total_posts,
    COUNT(*) FILTER (WHERE tier = 'elite') as elite_posts,
    COALESCE((SELECT current_streak FROM public.user_streaks WHERE user_id = p_user_id), 0) as current_streak,
    COALESCE((SELECT SUM((r.reactions->>'total')::INTEGER) FROM public.post_reaction_counts r JOIN public.posts p ON r.post_id = p.id WHERE p.user_id = p_user_id), 0) as total_reactions
  FROM public.posts
  WHERE user_id = p_user_id;
END;
$$ LANGUAGE plpgsql;

-- ============================================================================
-- ROW LEVEL SECURITY (RLS)
-- ============================================================================

-- Enable RLS on all tables
ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.posts ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.reactions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.user_streaks ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.day_posts ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.notifications ENABLE ROW LEVEL SECURITY;

-- Profiles: Users can read all, update only their own
CREATE POLICY "Profiles are viewable by everyone"
  ON public.profiles FOR SELECT
  USING (true);

CREATE POLICY "Users can update own profile"
  ON public.profiles FOR UPDATE
  USING (auth.uid() = id);

-- Posts: Everyone can read, authenticated users can create
CREATE POLICY "Posts are viewable by everyone"
  ON public.posts FOR SELECT
  USING (true);

CREATE POLICY "Authenticated users can create posts"
  ON public.posts FOR INSERT
  WITH CHECK (auth.uid() IS NOT NULL OR is_anonymous = true);

CREATE POLICY "Users can update own posts"
  ON public.posts FOR UPDATE
  USING (auth.uid() = user_id);

CREATE POLICY "Users can delete own posts"
  ON public.posts FOR DELETE
  USING (auth.uid() = user_id);

-- Reactions: Authenticated users only
CREATE POLICY "Reactions are viewable by everyone"
  ON public.reactions FOR SELECT
  USING (true);

CREATE POLICY "Authenticated users can add reactions"
  ON public.reactions FOR INSERT
  WITH CHECK (auth.uid() IS NOT NULL);

CREATE POLICY "Users can delete own reactions"
  ON public.reactions FOR DELETE
  USING (auth.uid() = user_id);

-- Notifications: Users can only see their own
CREATE POLICY "Users can read own notifications"
  ON public.notifications FOR SELECT
  USING (auth.uid() = user_id);

CREATE POLICY "Users can update own notifications"
  ON public.notifications FOR UPDATE
  USING (auth.uid() = user_id);

-- Day Posts: Everyone can read, users can create/update their own
CREATE POLICY "Day posts are viewable by everyone"
  ON public.day_posts FOR SELECT
  USING (true);

CREATE POLICY "Users can create day posts"
  ON public.day_posts FOR INSERT
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update own day posts"
  ON public.day_posts FOR UPDATE
  USING (auth.uid() = user_id);

-- ============================================================================
-- SCHEDULED JOBS (Background Tasks)
-- ============================================================================

-- Refresh leaderboards every 10 minutes
SELECT cron.schedule(
  'refresh-city-leaderboard',
  '*/10 * * * *', -- Every 10 minutes
  $$REFRESH MATERIALIZED VIEW CONCURRENTLY city_leaderboard$$
);

SELECT cron.schedule(
  'refresh-state-leaderboard',
  '*/10 * * * *',
  $$REFRESH MATERIALIZED VIEW CONCURRENTLY state_leaderboard$$
);

SELECT cron.schedule(
  'refresh-country-leaderboard',
  '*/10 * * * *',
  $$REFRESH MATERIALIZED VIEW CONCURRENTLY country_leaderboard$$
);

-- Clean up expired trending data daily
SELECT cron.schedule(
  'cleanup-expired-trending',
  '0 2 * * *', -- 2 AM daily
  $$DELETE FROM public.trending_cache WHERE expires_at < NOW()$$
);

-- Calculate daily stats (runs at midnight)
SELECT cron.schedule(
  'calculate-daily-stats',
  '0 0 * * *', -- Midnight
  $$
  INSERT INTO public.daily_stats (
    date,
    total_posts,
    action_posts,
    day_posts,
    elite_posts,
    rare_posts,
    unique_posts,
    notable_posts,
    popular_posts,
    common_posts,
    world_posts,
    country_posts,
    state_posts,
    city_posts,
    new_users,
    active_users,
    posting_users,
    total_reactions
  )
  SELECT
    CURRENT_DATE - INTERVAL '1 day',
    COUNT(*),
    COUNT(*) FILTER (WHERE input_type = 'action'),
    COUNT(*) FILTER (WHERE input_type = 'day'),
    COUNT(*) FILTER (WHERE tier = 'elite'),
    COUNT(*) FILTER (WHERE tier = 'rare'),
    COUNT(*) FILTER (WHERE tier = 'unique'),
    COUNT(*) FILTER (WHERE tier = 'notable'),
    COUNT(*) FILTER (WHERE tier = 'popular'),
    COUNT(*) FILTER (WHERE tier = 'common'),
    COUNT(*) FILTER (WHERE scope = 'world'),
    COUNT(*) FILTER (WHERE scope = 'country'),
    COUNT(*) FILTER (WHERE scope = 'state'),
    COUNT(*) FILTER (WHERE scope = 'city'),
    (SELECT COUNT(*) FROM public.profiles WHERE DATE(created_at) = CURRENT_DATE - INTERVAL '1 day'),
    COUNT(DISTINCT user_id),
    COUNT(DISTINCT user_id) FILTER (WHERE user_id IS NOT NULL),
    (SELECT COUNT(*) FROM public.reactions WHERE DATE(created_at) = CURRENT_DATE - INTERVAL '1 day')
  FROM public.posts
  WHERE DATE(created_at) = CURRENT_DATE - INTERVAL '1 day'
  ON CONFLICT (date) DO NOTHING
  $$
);

-- ============================================================================
-- PERFORMANCE OPTIMIZATION
-- ============================================================================

-- Analyze tables for query optimization (runs daily)
SELECT cron.schedule(
  'analyze-tables',
  '0 3 * * *', -- 3 AM daily
  $$
  ANALYZE public.posts;
  ANALYZE public.profiles;
  ANALYZE public.reactions;
  ANALYZE public.notifications;
  $$
);

-- ============================================================================
-- COMMENTS & DOCUMENTATION
-- ============================================================================

COMMENT ON TABLE public.profiles IS 'User profiles extending auth.users with app-specific data';
COMMENT ON TABLE public.posts IS 'Core posts table with vector embeddings for uniqueness matching';
COMMENT ON TABLE public.reactions IS 'User reactions to posts (funny, creative, must_try)';
COMMENT ON TABLE public.user_streaks IS 'Tracks user posting streaks for gamification';
COMMENT ON TABLE public.day_posts IS 'Themed day posts (Unpopular Monday, Offline Sunday, etc.)';
COMMENT ON TABLE public.notifications IS 'In-app notifications for achievements and updates';
COMMENT ON TABLE public.trending_cache IS 'Cached trending data from external APIs (Spotify, Reddit, etc.)';
COMMENT ON TABLE public.daily_stats IS 'Daily aggregated statistics for analytics dashboard';
COMMENT ON TABLE public.user_analytics IS 'Per-user analytics for insights and personalization';
COMMENT ON TABLE public.events IS 'Event tracking for detailed analytics and ML features';

COMMENT ON COLUMN public.posts.embedding IS 'Vector embedding (384 dimensions) for semantic similarity search using pgvector';
COMMENT ON COLUMN public.posts.content_hash IS 'Normalized hash for fast duplicate detection';
COMMENT ON COLUMN public.posts.tier IS 'Calculated tier based on percentile (elite, rare, unique, notable, popular, common)';

-- ============================================================================
-- INITIAL DATA
-- ============================================================================

-- Sample trending data (will be replaced by actual API fetches)
INSERT INTO public.trending_cache (source, category, rank, title, description, count, expires_at) VALUES
  ('spotify', 'music', 1, 'Sample Trending Song', 'By Sample Artist', 1500000, NOW() + INTERVAL '1 hour'),
  ('reddit', 'news', 1, 'Sample Trending Topic', 'Hot on r/all', 25000, NOW() + INTERVAL '1 hour'),
  ('youtube', 'entertainment', 1, 'Sample Trending Video', 'Viral video of the day', 5000000, NOW() + INTERVAL '1 hour');

-- ============================================================================
-- GRANTS & PERMISSIONS
-- ============================================================================

-- Grant permissions to authenticated users
GRANT USAGE ON SCHEMA public TO authenticated;
GRANT ALL ON ALL TABLES IN SCHEMA public TO authenticated;
GRANT ALL ON ALL SEQUENCES IN SCHEMA public TO authenticated;

-- Grant permissions to service role (for Edge Functions)
GRANT ALL ON ALL TABLES IN SCHEMA public TO service_role;
GRANT ALL ON ALL SEQUENCES IN SCHEMA public TO service_role;

-- ============================================================================
-- SCHEMA VERSION
-- ============================================================================

CREATE TABLE public.schema_version (
  version TEXT PRIMARY KEY,
  applied_at TIMESTAMPTZ DEFAULT NOW(),
  description TEXT
);

INSERT INTO public.schema_version (version, description) VALUES
  ('1.0.0', 'Initial schema with profiles, posts, reactions, analytics foundation');

-- ============================================================================
-- END OF MIGRATION
-- ============================================================================

