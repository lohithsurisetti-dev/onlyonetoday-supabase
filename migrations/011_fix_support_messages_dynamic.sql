-- Fix support messages function for dynamic dream system
-- Migration 011: Update support messages to work with dynamic symbols/emotions

-- Drop the old function that uses ENUMs
DROP FUNCTION IF EXISTS get_dream_support_messages(dream_type, dream_symbol[], dream_emotion[]);

-- Create new function that works with dynamic system
CREATE OR REPLACE FUNCTION get_dream_support_messages(
  p_dream_type dream_type,
  p_symbols TEXT[],
  p_emotions TEXT[]
)
RETURNS TABLE (
  id UUID,
  dream_id UUID,
  user_id UUID,
  message TEXT,
  is_approved BOOLEAN,
  created_at TIMESTAMPTZ
) AS $$
BEGIN
  RETURN QUERY
  SELECT 
    dsm.id,
    dsm.dream_id,
    dsm.user_id,
    dsm.message,
    dsm.is_approved,
    dsm.created_at
  FROM dream_support_messages dsm
  JOIN dream_posts dp ON dsm.dream_id = dp.id
  WHERE 
    dp.dream_type = p_dream_type
    AND dsm.is_approved = true
    AND (
      -- Match if any symbols overlap
      EXISTS (
        SELECT 1 FROM dream_post_symbols dps1
        JOIN dream_symbols ds1 ON dps1.symbol_id = ds1.id
        WHERE dps1.dream_post_id = dp.id
        AND ds1.name = ANY(p_symbols)
      )
      OR
      -- Match if any emotions overlap
      EXISTS (
        SELECT 1 FROM dream_post_emotions dpe1
        JOIN dream_emotions de1 ON dpe1.emotion_id = de1.id
        WHERE dpe1.dream_post_id = dp.id
        AND de1.name = ANY(p_emotions)
      )
    )
  ORDER BY dsm.created_at DESC
  LIMIT 10;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Update the community stats function to work with dynamic system
DROP FUNCTION IF EXISTS get_dream_community_stats(dream_type, dream_symbol[], dream_emotion[]);

CREATE OR REPLACE FUNCTION get_dream_community_stats(
  p_dream_type dream_type,
  p_symbols TEXT[],
  p_emotions TEXT[]
)
RETURNS TABLE (
  member_count INTEGER,
  support_messages_count INTEGER,
  weekly_dreams_count INTEGER,
  weekly_support_messages INTEGER
) AS $$
BEGIN
  RETURN QUERY
  SELECT 
    COALESCE(COUNT(DISTINCT dp.user_id), 0)::INTEGER as member_count,
    COALESCE(COUNT(DISTINCT dsm.id), 0)::INTEGER as support_messages_count,
    COALESCE(COUNT(DISTINCT CASE 
      WHEN dp.created_at >= NOW() - INTERVAL '7 days' THEN dp.id 
    END), 0)::INTEGER as weekly_dreams_count,
    COALESCE(COUNT(DISTINCT CASE 
      WHEN dsm.created_at >= NOW() - INTERVAL '7 days' THEN dsm.id 
    END), 0)::INTEGER as weekly_support_messages
  FROM dream_posts dp
  LEFT JOIN dream_support_messages dsm ON dsm.dream_id = dp.id AND dsm.is_approved = true
  WHERE 
    dp.dream_type = p_dream_type
    AND (
      -- Match if any symbols overlap
      EXISTS (
        SELECT 1 FROM dream_post_symbols dps
        JOIN dream_symbols ds ON dps.symbol_id = ds.id
        WHERE dps.dream_post_id = dp.id
        AND ds.name = ANY(p_symbols)
      )
      OR
      -- Match if any emotions overlap
      EXISTS (
        SELECT 1 FROM dream_post_emotions dpe
        JOIN dream_emotions de ON dpe.emotion_id = de.id
        WHERE dpe.dream_post_id = dp.id
        AND de.name = ANY(p_emotions)
      )
    );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Update the count similar dreams function
DROP FUNCTION IF EXISTS count_similar_dreams(dream_type, dream_symbol[], dream_emotion[]);

CREATE OR REPLACE FUNCTION count_similar_dreams(
  p_dream_type dream_type,
  p_symbols TEXT[],
  p_emotions TEXT[]
)
RETURNS INTEGER AS $$
DECLARE
  dream_count INTEGER;
BEGIN
  SELECT COUNT(*) INTO dream_count
  FROM dream_posts dp
  WHERE 
    dp.dream_type = p_dream_type
    AND (
      -- Match if any symbols overlap
      EXISTS (
        SELECT 1 FROM dream_post_symbols dps
        JOIN dream_symbols ds ON dps.symbol_id = ds.id
        WHERE dps.dream_post_id = dp.id
        AND ds.name = ANY(p_symbols)
      )
      OR
      -- Match if any emotions overlap
      EXISTS (
        SELECT 1 FROM dream_post_emotions dpe
        JOIN dream_emotions de ON dpe.emotion_id = de.id
        WHERE dpe.dream_post_id = dp.id
        AND de.name = ANY(p_emotions)
      )
    );
    
  RETURN COALESCE(dream_count, 0);
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Grant permissions
GRANT EXECUTE ON FUNCTION get_dream_support_messages(dream_type, TEXT[], TEXT[]) TO authenticated;
GRANT EXECUTE ON FUNCTION get_dream_community_stats(dream_type, TEXT[], TEXT[]) TO authenticated;
GRANT EXECUTE ON FUNCTION count_similar_dreams(dream_type, TEXT[], TEXT[]) TO authenticated;
