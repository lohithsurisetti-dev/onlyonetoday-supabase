-- Fix scope hierarchy in match_posts_by_embedding function
-- City posts affect state/country/world, state posts affect country/world, etc.

CREATE OR REPLACE FUNCTION match_posts_by_embedding(
  query_embedding vector(1536),
  match_threshold float DEFAULT 0.90,
  match_limit int DEFAULT 20,
  scope_filter text DEFAULT 'world',
  filter_city text DEFAULT NULL,
  filter_state text DEFAULT NULL,
  filter_country text DEFAULT NULL,
  query_has_negation boolean DEFAULT false,
  time_start TIMESTAMPTZ DEFAULT NULL
)
RETURNS TABLE (
  id uuid,
  content text,
  user_id UUID,
  scope text,
  location_city text,
  location_state text,
  location_country text,
  similarity float,
  tier text,
  created_at timestamptz
)
LANGUAGE plpgsql
AS $$
DECLARE
  effective_time_start TIMESTAMPTZ := COALESCE(time_start, date_trunc('day', NOW()));
BEGIN
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
    p.embedding IS NOT NULL
    AND (1 - (p.embedding <=> query_embedding)) > match_threshold
    AND p.created_at >= effective_time_start
    AND p.has_negation = query_has_negation
    AND p.moderation_status = 'approved'
    AND (
      -- World scope: match all posts
      scope_filter = 'world'
      OR
      -- Country scope: match posts in that country (country, state, city scopes)
      (scope_filter = 'country' 
       AND p.location_country = filter_country 
       AND p.scope::text IN ('country', 'state', 'city'))
      OR
      -- State scope: match posts in that state (state, city scopes)
      (scope_filter = 'state' 
       AND p.location_state = filter_state 
       AND p.scope::text IN ('state', 'city'))
      OR
      -- City scope: match only city posts in that city
      (scope_filter = 'city' 
       AND p.location_city = filter_city 
       AND p.scope::text = 'city')
    )
  ORDER BY p.embedding <=> query_embedding
  LIMIT match_limit;
END;
$$;
