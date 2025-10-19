-- ============================================================
-- ADD ADVANCED FEATURES TO EXISTING SCHEMA
-- ============================================================
-- This migration adds advanced features to the existing posts table:
-- - Day summary processing with activity extraction
-- - Advanced NLP features (negation, time tags, emojis)
-- - Content moderation fields
-- - Temporal analytics tables
-- - Enhanced vector search functions

-- ============================================================
-- 1. ADD MISSING COLUMNS TO POSTS TABLE
-- ============================================================

-- Add text normalization column
ALTER TABLE public.posts ADD COLUMN IF NOT EXISTS text_normalized TEXT;

-- Add day summary fields
ALTER TABLE public.posts ADD COLUMN IF NOT EXISTS activities JSONB;
ALTER TABLE public.posts ADD COLUMN IF NOT EXISTS activity_count INTEGER;
ALTER TABLE public.posts ADD COLUMN IF NOT EXISTS activity_embeddings vector[];

-- Add advanced NLP features
ALTER TABLE public.posts ADD COLUMN IF NOT EXISTS has_negation BOOLEAN DEFAULT false;
ALTER TABLE public.posts ADD COLUMN IF NOT EXISTS time_tags TEXT[] DEFAULT '{}';
ALTER TABLE public.posts ADD COLUMN IF NOT EXISTS emoji_tags TEXT[] DEFAULT '{}';

-- Add content moderation fields
DO $$ BEGIN
    CREATE TYPE moderation_status AS ENUM ('pending', 'approved', 'rejected', 'flagged');
EXCEPTION
    WHEN duplicate_object THEN null;
END $$;

ALTER TABLE public.posts ADD COLUMN IF NOT EXISTS moderation_status moderation_status DEFAULT 'approved';
ALTER TABLE public.posts ADD COLUMN IF NOT EXISTS moderation_score FLOAT DEFAULT 0.0;
ALTER TABLE public.posts ADD COLUMN IF NOT EXISTS moderation_flags TEXT[] DEFAULT '{}';
ALTER TABLE public.posts ADD COLUMN IF NOT EXISTS moderation_details JSONB;

-- Add additional analytics fields
ALTER TABLE public.posts ADD COLUMN IF NOT EXISTS like_count INTEGER DEFAULT 0;
ALTER TABLE public.posts ADD COLUMN IF NOT EXISTS comment_count INTEGER DEFAULT 0;

-- Update content length constraint to allow longer posts
ALTER TABLE public.posts DROP CONSTRAINT IF EXISTS content_length;
ALTER TABLE public.posts ADD CONSTRAINT content_length CHECK (char_length(content) >= 3 AND char_length(content) <= 2000);

-- Add activity count constraint
DO $$ BEGIN
    ALTER TABLE public.posts ADD CONSTRAINT activity_count_check CHECK (activity_count IS NULL OR activity_count >= 0);
EXCEPTION
    WHEN duplicate_object THEN null;
END $$;

-- ============================================================
-- 2. CREATE TEMPORAL ANALYTICS TABLES
-- ============================================================

-- Daily analytics table
CREATE TABLE IF NOT EXISTS public.daily_analytics (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  date DATE NOT NULL,
  
  -- Aggregate metrics
  total_posts INTEGER DEFAULT 0,
  unique_posts INTEGER DEFAULT 0,
  common_posts INTEGER DEFAULT 0,
  
  -- Breakdown by scope
  posts_by_city INTEGER DEFAULT 0,
  posts_by_state INTEGER DEFAULT 0,
  posts_by_country INTEGER DEFAULT 0,
  posts_by_world INTEGER DEFAULT 0,
  
  -- Breakdown by type
  action_posts INTEGER DEFAULT 0,
  day_posts INTEGER DEFAULT 0,
  
  -- Top content hashes (most common activities)
  top_content_hashes JSONB,
  
  created_at TIMESTAMPTZ DEFAULT NOW(),
  
  -- One record per day
  UNIQUE(date)
);

-- Temporal uniqueness table
CREATE TABLE IF NOT EXISTS public.temporal_uniqueness (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  post_id UUID REFERENCES posts(id) ON DELETE CASCADE,
  content_hash TEXT NOT NULL,
  
  -- Time-based metrics
  today_total INTEGER DEFAULT 0,
  today_unique INTEGER DEFAULT 0,
  today_percentile FLOAT,
  
  this_week_total INTEGER DEFAULT 0,
  this_week_unique INTEGER DEFAULT 0,
  this_week_percentile FLOAT,
  
  this_month_total INTEGER DEFAULT 0,
  this_month_unique INTEGER DEFAULT 0,
  this_month_percentile FLOAT,
  
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- ============================================================
-- 3. ADD NEW INDEXES
-- ============================================================

-- Activity indexes for day summaries
CREATE INDEX IF NOT EXISTS idx_posts_activities ON public.posts USING gin(activities);
CREATE INDEX IF NOT EXISTS idx_posts_activity_count ON public.posts(activity_count) WHERE activity_count IS NOT NULL;

-- Moderation indexes
CREATE INDEX IF NOT EXISTS idx_posts_moderation_status ON public.posts(moderation_status);

-- Temporal analytics indexes
CREATE INDEX IF NOT EXISTS idx_daily_analytics_date ON daily_analytics(date DESC);
CREATE INDEX IF NOT EXISTS idx_temporal_uniqueness_post_id ON temporal_uniqueness(post_id);
CREATE INDEX IF NOT EXISTS idx_temporal_uniqueness_content_hash ON temporal_uniqueness(content_hash);

-- ============================================================
-- 4. ADD TRIGGERS
-- ============================================================

-- Trigger to update temporal uniqueness updated_at
DO $$ BEGIN
    CREATE TRIGGER update_temporal_uniqueness_updated_at
      BEFORE UPDATE ON temporal_uniqueness
      FOR EACH ROW
      EXECUTE FUNCTION update_updated_at();
EXCEPTION
    WHEN duplicate_object THEN null;
END $$;

-- ============================================================
-- 5. UTILITY FUNCTIONS
-- ============================================================

-- Function to generate content hash from post content
CREATE OR REPLACE FUNCTION generate_content_hash(content TEXT)
RETURNS TEXT AS $$
DECLARE
  normalized TEXT;
BEGIN
  -- Normalize: lowercase, remove special chars, extract key words
  normalized := lower(regexp_replace(content, '[^a-zA-Z0-9\s]', '', 'g'));
  normalized := regexp_replace(normalized, '\s+', ':', 'g');
  
  -- Take first 3-5 meaningful words
  normalized := substring(normalized from 1 for 100);
  
  RETURN normalized;
END;
$$ LANGUAGE plpgsql IMMUTABLE;

-- Function to calculate percentile tier
CREATE OR REPLACE FUNCTION calculate_tier(percentile FLOAT)
RETURNS tier_type AS $$
BEGIN
  IF percentile < 0.1 THEN
    RETURN 'elite';
  ELSIF percentile < 1.0 THEN
    RETURN 'elite';
  ELSIF percentile < 5.0 THEN
    RETURN 'rare';
  ELSIF percentile < 10.0 THEN
    RETURN 'unique';
  ELSIF percentile < 25.0 THEN
    RETURN 'notable';
  ELSIF percentile < 50.0 THEN
    RETURN 'common';
  ELSE
    RETURN 'popular';
  END IF;
END;
$$ LANGUAGE plpgsql IMMUTABLE;

-- ============================================================
-- 6. ENHANCED VECTOR SEARCH FUNCTIONS
-- ============================================================

-- Enhanced vector similarity search function with negation matching
CREATE OR REPLACE FUNCTION match_posts_by_embedding(
  query_embedding vector(384),
  match_threshold float DEFAULT 0.90,
  match_limit int DEFAULT 20,
  scope_filter text DEFAULT 'world',
  filter_city text DEFAULT NULL,
  filter_state text DEFAULT NULL,
  filter_country text DEFAULT NULL,
  today_only boolean DEFAULT true,
  query_has_negation boolean DEFAULT false
)
RETURNS TABLE (
  id uuid,
  content text,
  scope text,
  location_city text,
  location_state text,
  location_country text,
  similarity float,
  content_hash text,
  has_negation boolean,
  created_at timestamptz
)
LANGUAGE plpgsql
AS $$
DECLARE
  today_start timestamptz;
BEGIN
  -- Get today's start (midnight)
  today_start := date_trunc('day', now());
  
  RETURN QUERY
  SELECT
    posts.id,
    posts.content,
    posts.scope::text,
    posts.location_city,
    posts.location_state,
    posts.location_country,
    (1 - (posts.embedding <=> query_embedding))::float as similarity,
    posts.content_hash,
    posts.has_negation,
    posts.created_at
  FROM posts
  WHERE 
    -- Only posts with embeddings
    posts.embedding IS NOT NULL
    -- Similarity threshold
    AND (1 - (posts.embedding <=> query_embedding)) > match_threshold
    -- Today only (optional)
    AND (NOT today_only OR posts.created_at >= today_start)
    -- Negation matching (CRITICAL: Only match same negation!)
    AND posts.has_negation = query_has_negation
    -- Moderation status
    AND posts.moderation_status = 'approved'
    -- Scope-aware filtering (hierarchical)
    AND (
      -- World scope: match all
      scope_filter = 'world'
      OR
      -- Country scope: match posts in that country
      (scope_filter = 'country' AND posts.location_country = filter_country AND posts.scope IN ('city', 'state', 'country'))
      OR
      -- State scope: match posts in that state
      (scope_filter = 'state' AND posts.location_state = filter_state AND posts.scope IN ('city', 'state'))
      OR
      -- City scope: match only city posts in that city
      (scope_filter = 'city' AND posts.location_city = filter_city AND posts.scope = 'city')
    )
  ORDER BY posts.embedding <=> query_embedding
  LIMIT match_limit;
END;
$$;

-- Day summary matching function
CREATE OR REPLACE FUNCTION match_day_summaries(
  query_activities JSONB,
  query_activity_embeddings vector[],
  query_scope TEXT,
  query_location_city TEXT DEFAULT NULL,
  query_location_state TEXT DEFAULT NULL,
  query_location_country TEXT DEFAULT NULL,
  match_threshold FLOAT DEFAULT 0.70,
  match_limit INT DEFAULT 100
) RETURNS TABLE (
  id UUID,
  content TEXT,
  activities JSONB,
  activity_count INTEGER,
  scope TEXT,
  location_city TEXT,
  location_state TEXT,
  location_country TEXT,
  overlap_percentage FLOAT,
  matched_activities INTEGER,
  created_at TIMESTAMPTZ
) AS $$
BEGIN
  -- For day summaries, we need to:
  -- 1. Find other day summaries (input_type = 'day')
  -- 2. Calculate activity overlap using embeddings
  -- 3. Return days with overlap >= threshold
  
  -- Note: The actual overlap calculation will be done in application code
  -- because PostgreSQL doesn't have built-in cosine similarity for vector arrays
  -- This function just returns candidate days for comparison
  
  RETURN QUERY
  SELECT 
    p.id,
    p.content,
    p.activities,
    p.activity_count,
    p.scope,
    p.location_city,
    p.location_state,
    p.location_country,
    0.0::FLOAT AS overlap_percentage, -- Will be calculated in app
    0::INTEGER AS matched_activities, -- Will be calculated in app
    p.created_at
  FROM posts p
  WHERE 
    p.input_type = 'day' -- Only day summaries
    AND p.activities IS NOT NULL
    AND p.activity_count >= 2 -- Valid day summaries
    AND p.created_at >= CURRENT_DATE -- Today only
    AND p.moderation_status = 'approved'
    AND (
      -- Scope filtering (hierarchical)
      CASE 
        WHEN query_scope = 'world' THEN TRUE
        WHEN query_scope = 'country' AND query_location_country IS NOT NULL THEN 
          p.location_country = query_location_country
        WHEN query_scope = 'state' AND query_location_state IS NOT NULL THEN 
          p.location_state = query_location_state
        WHEN query_scope = 'city' AND query_location_city IS NOT NULL THEN 
          p.location_city = query_location_city
        ELSE TRUE
      END
    )
  ORDER BY p.created_at DESC
  LIMIT match_limit;
END;
$$ LANGUAGE plpgsql;

-- Hierarchical score calculation function
CREATE OR REPLACE FUNCTION get_hierarchical_scores(
  content_hash_param TEXT,
  location_city_param TEXT DEFAULT NULL,
  location_state_param TEXT DEFAULT NULL,
  location_country_param TEXT DEFAULT NULL
) RETURNS TABLE (
  scope TEXT,
  total_posts INTEGER,
  matching_posts INTEGER,
  percentile FLOAT,
  tier tier_type
) AS $$
DECLARE
  city_total INTEGER := 0;
  city_matching INTEGER := 0;
  state_total INTEGER := 0;
  state_matching INTEGER := 0;
  country_total INTEGER := 0;
  country_matching INTEGER := 0;
  world_total INTEGER := 0;
  world_matching INTEGER := 0;
  today_start TIMESTAMPTZ;
BEGIN
  today_start := date_trunc('day', now());
  
  -- City scope
  IF location_city_param IS NOT NULL THEN
    SELECT COUNT(*) INTO city_total
    FROM posts 
    WHERE location_city = location_city_param 
    AND scope = 'city'
    AND created_at >= today_start
    AND moderation_status = 'approved';
    
    SELECT COUNT(*) INTO city_matching
    FROM posts 
    WHERE content_hash = content_hash_param
    AND location_city = location_city_param 
    AND scope = 'city'
    AND created_at >= today_start
    AND moderation_status = 'approved';
    
    RETURN QUERY SELECT 
      'city'::TEXT,
      city_total,
      city_matching,
      CASE WHEN city_total > 0 THEN (city_matching::FLOAT / city_total::FLOAT) * 100 ELSE 0 END,
      calculate_tier(CASE WHEN city_total > 0 THEN (city_matching::FLOAT / city_total::FLOAT) * 100 ELSE 0 END);
  END IF;
  
  -- State scope
  IF location_state_param IS NOT NULL THEN
    SELECT COUNT(*) INTO state_total
    FROM posts 
    WHERE location_state = location_state_param 
    AND scope IN ('city', 'state')
    AND created_at >= today_start
    AND moderation_status = 'approved';
    
    SELECT COUNT(*) INTO state_matching
    FROM posts 
    WHERE content_hash = content_hash_param
    AND location_state = location_state_param 
    AND scope IN ('city', 'state')
    AND created_at >= today_start
    AND moderation_status = 'approved';
    
    RETURN QUERY SELECT 
      'state'::TEXT,
      state_total,
      state_matching,
      CASE WHEN state_total > 0 THEN (state_matching::FLOAT / state_total::FLOAT) * 100 ELSE 0 END,
      calculate_tier(CASE WHEN state_total > 0 THEN (state_matching::FLOAT / state_total::FLOAT) * 100 ELSE 0 END);
  END IF;
  
  -- Country scope
  IF location_country_param IS NOT NULL THEN
    SELECT COUNT(*) INTO country_total
    FROM posts 
    WHERE location_country = location_country_param 
    AND scope IN ('city', 'state', 'country')
    AND created_at >= today_start
    AND moderation_status = 'approved';
    
    SELECT COUNT(*) INTO country_matching
    FROM posts 
    WHERE content_hash = content_hash_param
    AND location_country = location_country_param 
    AND scope IN ('city', 'state', 'country')
    AND created_at >= today_start
    AND moderation_status = 'approved';
    
    RETURN QUERY SELECT 
      'country'::TEXT,
      country_total,
      country_matching,
      CASE WHEN country_total > 0 THEN (country_matching::FLOAT / country_total::FLOAT) * 100 ELSE 0 END,
      calculate_tier(CASE WHEN country_total > 0 THEN (country_matching::FLOAT / country_total::FLOAT) * 100 ELSE 0 END);
  END IF;
  
  -- World scope
  SELECT COUNT(*) INTO world_total
  FROM posts 
  WHERE created_at >= today_start
  AND moderation_status = 'approved';
  
  SELECT COUNT(*) INTO world_matching
  FROM posts 
  WHERE content_hash = content_hash_param
  AND created_at >= today_start
  AND moderation_status = 'approved';
  
  RETURN QUERY SELECT 
    'world'::TEXT,
    world_total,
    world_matching,
    CASE WHEN world_total > 0 THEN (world_matching::FLOAT / world_total::FLOAT) * 100 ELSE 0 END,
    calculate_tier(CASE WHEN world_total > 0 THEN (world_matching::FLOAT / world_total::FLOAT) * 100 ELSE 0 END);
END;
$$ LANGUAGE plpgsql;

-- Temporal uniqueness calculation function
CREATE OR REPLACE FUNCTION calculate_temporal_uniqueness(
  content_hash_param TEXT,
  scope_param TEXT DEFAULT 'world',
  location_city_param TEXT DEFAULT NULL,
  location_state_param TEXT DEFAULT NULL,
  location_country_param TEXT DEFAULT NULL
) RETURNS TABLE (
  time_period TEXT,
  total_posts INTEGER,
  matching_posts INTEGER,
  percentile FLOAT,
  tier tier_type
) AS $$
DECLARE
  today_start TIMESTAMPTZ;
  week_start TIMESTAMPTZ;
  month_start TIMESTAMPTZ;
  
  today_total INTEGER := 0;
  today_matching INTEGER := 0;
  week_total INTEGER := 0;
  week_matching INTEGER := 0;
  month_total INTEGER := 0;
  month_matching INTEGER := 0;
BEGIN
  today_start := date_trunc('day', now());
  week_start := date_trunc('week', now());
  month_start := date_trunc('month', now());
  
  -- Build scope filter
  DECLARE
    scope_condition TEXT;
  BEGIN
    CASE scope_param
      WHEN 'city' THEN
        scope_condition := 'location_city = ' || quote_literal(location_city_param) || ' AND scope = ''city''';
      WHEN 'state' THEN
        scope_condition := 'location_state = ' || quote_literal(location_state_param) || ' AND scope IN (''city'', ''state'')';
      WHEN 'country' THEN
        scope_condition := 'location_country = ' || quote_literal(location_country_param) || ' AND scope IN (''city'', ''state'', ''country'')';
      ELSE
        scope_condition := 'TRUE';
    END CASE;
    
    -- Today
    EXECUTE format('SELECT COUNT(*) FROM posts WHERE %s AND created_at >= %L AND moderation_status = ''approved''', 
                   scope_condition, today_start) INTO today_total;
    
    EXECUTE format('SELECT COUNT(*) FROM posts WHERE content_hash = %L AND %s AND created_at >= %L AND moderation_status = ''approved''', 
                   content_hash_param, scope_condition, today_start) INTO today_matching;
    
    -- This week
    EXECUTE format('SELECT COUNT(*) FROM posts WHERE %s AND created_at >= %L AND moderation_status = ''approved''', 
                   scope_condition, week_start) INTO week_total;
    
    EXECUTE format('SELECT COUNT(*) FROM posts WHERE content_hash = %L AND %s AND created_at >= %L AND moderation_status = ''approved''', 
                   content_hash_param, scope_condition, week_start) INTO week_matching;
    
    -- This month
    EXECUTE format('SELECT COUNT(*) FROM posts WHERE %s AND created_at >= %L AND moderation_status = ''approved''', 
                   scope_condition, month_start) INTO month_total;
    
    EXECUTE format('SELECT COUNT(*) FROM posts WHERE content_hash = %L AND %s AND created_at >= %L AND moderation_status = ''approved''', 
                   content_hash_param, scope_condition, month_start) INTO month_matching;
  END;
  
  -- Return results
  RETURN QUERY SELECT 
    'today'::TEXT,
    today_total,
    today_matching,
    CASE WHEN today_total > 0 THEN (today_matching::FLOAT / today_total::FLOAT) * 100 ELSE 0 END,
    calculate_tier(CASE WHEN today_total > 0 THEN (today_matching::FLOAT / today_total::FLOAT) * 100 ELSE 0 END);
    
  RETURN QUERY SELECT 
    'week'::TEXT,
    week_total,
    week_matching,
    CASE WHEN week_total > 0 THEN (week_matching::FLOAT / week_total::FLOAT) * 100 ELSE 0 END,
    calculate_tier(CASE WHEN week_total > 0 THEN (week_matching::FLOAT / week_total::FLOAT) * 100 ELSE 0 END);
    
  RETURN QUERY SELECT 
    'month'::TEXT,
    month_total,
    month_matching,
    CASE WHEN month_total > 0 THEN (month_matching::FLOAT / month_total::FLOAT) * 100 ELSE 0 END,
    calculate_tier(CASE WHEN month_total > 0 THEN (month_matching::FLOAT / month_total::FLOAT) * 100 ELSE 0 END);
END;
$$ LANGUAGE plpgsql;

-- ============================================================
-- 7. ROW LEVEL SECURITY
-- ============================================================

-- Enable RLS on new tables
ALTER TABLE public.daily_analytics ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.temporal_uniqueness ENABLE ROW LEVEL SECURITY;

-- Analytics policies (admin only for now)
CREATE POLICY "Analytics are viewable by everyone" ON public.daily_analytics
  FOR SELECT USING (true);

-- Temporal uniqueness policies
CREATE POLICY "Temporal data is viewable by everyone" ON public.temporal_uniqueness
  FOR SELECT USING (true);

-- ============================================================
-- 8. COMMENTS
-- ============================================================
COMMENT ON TABLE public.daily_analytics IS 'Daily aggregated analytics for posts and user activity';
COMMENT ON TABLE public.temporal_uniqueness IS 'Tracks uniqueness metrics across different time periods';
COMMENT ON COLUMN public.posts.activities IS 'JSONB array of extracted activities for day summaries';
COMMENT ON COLUMN public.posts.activity_embeddings IS 'Array of embeddings, one for each extracted activity';
COMMENT ON COLUMN public.posts.has_negation IS 'Whether the content contains negation (affects similarity matching)';
COMMENT ON COLUMN public.posts.time_tags IS 'Array of time expressions extracted from content';
COMMENT ON COLUMN public.posts.emoji_tags IS 'Array of emojis extracted from content';
COMMENT ON COLUMN public.posts.moderation_details IS 'Detailed moderation results including toxicity, spam, and inappropriate scores';
