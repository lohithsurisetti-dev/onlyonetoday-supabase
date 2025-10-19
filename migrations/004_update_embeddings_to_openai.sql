-- ============================================================
-- UPDATE EMBEDDINGS TO OPENAI (1536 dimensions)
-- ============================================================
-- This migration updates the embedding dimensions from 384 (HuggingFace)
-- to 1536 (OpenAI text-embedding-3-small)

-- ============================================================
-- 1. UPDATE POSTS TABLE EMBEDDING COLUMN
-- ============================================================

-- First, drop the existing index
DROP INDEX IF EXISTS idx_posts_embedding_hnsw;

-- Update the embedding column to use 1536 dimensions
ALTER TABLE public.posts ALTER COLUMN embedding TYPE vector(1536);

-- Recreate the HNSW index with new dimensions
CREATE INDEX idx_posts_embedding_hnsw ON public.posts 
  USING hnsw (embedding vector_cosine_ops)
  WITH (m = 16, ef_construction = 64);

-- ============================================================
-- 2. UPDATE VECTOR SEARCH FUNCTION
-- ============================================================

-- Drop the existing function
DROP FUNCTION IF EXISTS match_posts_by_embedding(vector(384), float, int, text, text, text, text, boolean, boolean);

-- Recreate with 1536 dimensions
CREATE OR REPLACE FUNCTION match_posts_by_embedding(
  query_embedding vector(1536),
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

-- ============================================================
-- 3. UPDATE DAY SUMMARY MATCHING FUNCTION
-- ============================================================

-- Drop the existing function
DROP FUNCTION IF EXISTS match_day_summaries(jsonb, vector[], text, text, text, text, float, int);

-- Recreate with 1536 dimensions
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

-- ============================================================
-- 4. COMMENTS
-- ============================================================
COMMENT ON COLUMN public.posts.embedding IS 'Vector embedding (1536 dimensions) for semantic similarity search using OpenAI text-embedding-3-small';
