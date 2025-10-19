-- Add dream insights function
-- Migration 008: Personal Dream Insights

-- Function to get personal dream insights
CREATE OR REPLACE FUNCTION get_personal_dream_insights(p_user_id UUID)
RETURNS JSON AS $$
DECLARE
  dream_count INTEGER;
  avg_clarity DECIMAL;
  symbol_stats JSON;
  emotion_stats JSON;
  result JSON;
BEGIN
  -- Get total dream count
  SELECT COUNT(*) INTO dream_count
  FROM dream_posts 
  WHERE user_id = p_user_id;

  -- Get average clarity
  SELECT COALESCE(AVG(clarity), 0) INTO avg_clarity
  FROM dream_posts 
  WHERE user_id = p_user_id;

  -- Get most common symbols
  WITH symbol_counts AS (
    SELECT 
      unnest(symbols) as symbol,
      COUNT(*) as count
    FROM dream_posts 
    WHERE user_id = p_user_id AND symbols IS NOT NULL
    GROUP BY unnest(symbols)
    ORDER BY count DESC
    LIMIT 5
  )
  SELECT json_agg(
    json_build_object('symbol', symbol, 'count', count)
  ) INTO symbol_stats
  FROM symbol_counts;

  -- Get most common emotions
  WITH emotion_counts AS (
    SELECT 
      unnest(emotions) as emotion,
      COUNT(*) as count
    FROM dream_posts 
    WHERE user_id = p_user_id AND emotions IS NOT NULL
    GROUP BY unnest(emotions)
    ORDER BY count DESC
    LIMIT 5
  )
  SELECT json_agg(
    json_build_object('emotion', emotion, 'count', count)
  ) INTO emotion_stats
  FROM emotion_counts;

  -- Build result
  result := json_build_object(
    'dreamCount', dream_count,
    'mostCommonSymbols', COALESCE(symbol_stats, '[]'::json),
    'mostCommonEmotions', COALESCE(emotion_stats, '[]'::json),
    'averageClarity', ROUND(avg_clarity, 1)
  );

  RETURN result;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Grant execute permission to authenticated users
GRANT EXECUTE ON FUNCTION get_personal_dream_insights(UUID) TO authenticated;
