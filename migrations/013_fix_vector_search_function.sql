-- ============================================================
-- FIX VECTOR SEARCH FUNCTION TYPE MISMATCH
-- ============================================================
-- This migration fixes the type mismatch in match_posts_by_embedding function

-- Drop the existing function
DROP FUNCTION IF EXISTS match_posts_by_embedding(vector(1536), float, int, text, text, text, text, boolean, boolean);

-- Recreate with proper type casting
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
    posts.scope::text as scope,
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
      (scope_filter = 'country' AND posts.location_country = filter_country AND posts.scope::text IN ('city', 'state', 'country'))
      OR
      -- State scope: match posts in that state
      (scope_filter = 'state' AND posts.location_state = filter_state AND posts.scope::text IN ('city', 'state'))
      OR
      -- City scope: match only city posts in that city
      (scope_filter = 'city' AND posts.location_city = filter_city AND posts.scope::text = 'city')
    )
  ORDER BY posts.embedding <=> query_embedding
  LIMIT match_limit;
END;
$$;
