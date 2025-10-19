-- ============================================================
-- FIX FUNCTION OVERLOADING: Remove duplicate match_posts_by_embedding functions
-- ============================================================
-- This migration fixes the function overloading issue by dropping all
-- existing versions and creating a single, clean version

-- Drop all existing versions of the function
DROP FUNCTION IF EXISTS match_posts_by_embedding(vector(1536), float, int, text, text, text, text, boolean, boolean);
DROP FUNCTION IF EXISTS match_posts_by_embedding(vector(1536), float, int, text, text, text, text, boolean);
DROP FUNCTION IF EXISTS match_posts_by_embedding(vector(384), float, int, text, text, text, text, boolean, boolean);
DROP FUNCTION IF EXISTS match_posts_by_embedding(vector(384), float, int, text, text, text, text, boolean);

-- Create a single, clean version of the function
CREATE OR REPLACE FUNCTION match_posts_by_embedding(
  query_embedding vector(1536),
  match_threshold float DEFAULT 0.5,
  match_limit int DEFAULT 10,
  scope_filter text DEFAULT 'world',
  filter_city text DEFAULT NULL,
  filter_state text DEFAULT NULL,
  filter_country text DEFAULT NULL,
  today_only boolean DEFAULT false,
  query_has_negation boolean DEFAULT false
)
RETURNS TABLE (
  id uuid,
  content text,
  input_type post_type,
  scope text,
  location_city text,
  location_state text,
  location_country text,
  percentile float,
  tier text,
  created_at timestamptz,
  similarity float
)
LANGUAGE plpgsql
AS $$
BEGIN
  RETURN QUERY
  SELECT 
    p.id,
    p.content,
    p.input_type,
    p.scope::text as scope,
    p.location_city,
    p.location_state,
    p.location_country,
    p.percentile,
    p.tier::text as tier,
    p.created_at,
    1 - (p.embedding <=> query_embedding) as similarity
  FROM posts p
  WHERE 
    p.moderation_status = 'approved'
    AND (1 - (p.embedding <=> query_embedding)) > match_threshold
    AND (
      CASE scope_filter
        WHEN 'city' THEN p.scope = 'city' AND p.location_city = filter_city
        WHEN 'state' THEN p.scope IN ('city', 'state') AND p.location_state = filter_state
        WHEN 'country' THEN p.scope IN ('city', 'state', 'country') AND p.location_country = filter_country
        WHEN 'world' THEN true
        ELSE true
      END
    )
    AND (
      CASE 
        WHEN today_only THEN p.created_at >= CURRENT_DATE
        ELSE true
      END
    )
    AND (
      CASE 
        WHEN query_has_negation THEN p.has_negation = true
        ELSE true
      END
    )
  ORDER BY p.embedding <=> query_embedding
  LIMIT match_limit;
END;
$$;
