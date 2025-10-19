-- Fix dream matching function
-- Migration 009: Add missing match_dreams_by_embedding function

-- Create the missing match_dreams_by_embedding function
CREATE OR REPLACE FUNCTION match_dreams_by_embedding(
  query_embedding vector(1536),
  match_threshold float DEFAULT 0.7,
  match_count int DEFAULT 10,
  dream_type_filter dream_type DEFAULT NULL,
  scope_filter scope_type DEFAULT NULL
)
RETURNS TABLE (
  id uuid,
  content text,
  dream_type dream_type,
  emotions dream_emotion[],
  symbols dream_symbol[],
  clarity integer,
  similarity float
)
LANGUAGE plpgsql
AS $$
BEGIN
  RETURN QUERY
  SELECT 
    dp.id,
    dp.content,
    dp.dream_type,
    dp.emotions,
    dp.symbols,
    dp.clarity,
    1 - (dp.combined_embedding <=> query_embedding) as similarity
  FROM dream_posts dp
  WHERE 
    dp.combined_embedding IS NOT NULL
    AND 1 - (dp.combined_embedding <=> query_embedding) > match_threshold
    AND (dream_type_filter IS NULL OR dp.dream_type = dream_type_filter)
    AND (scope_filter IS NULL OR dp.scope = scope_filter)
  ORDER BY dp.combined_embedding <=> query_embedding
  LIMIT match_count;
END;
$$;

-- Grant execute permission
GRANT EXECUTE ON FUNCTION match_dreams_by_embedding(vector, float, int, dream_type, scope_type) TO authenticated;
