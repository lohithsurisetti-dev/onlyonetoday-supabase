-- Dynamic Dream System - Replace static ENUMs with scalable tables
-- Migration 010: Convert to normalized symbol/emotion system

-- Create dynamic symbol table
CREATE TABLE dream_symbols (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  name TEXT UNIQUE NOT NULL,
  category TEXT DEFAULT 'general',
  frequency INTEGER DEFAULT 1,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Create dynamic emotion table  
CREATE TABLE dream_emotions (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  name TEXT UNIQUE NOT NULL,
  intensity_level INTEGER DEFAULT 5, -- 1-10 scale
  frequency INTEGER DEFAULT 1,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Create junction tables for many-to-many relationships
CREATE TABLE dream_post_symbols (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  dream_post_id UUID REFERENCES dream_posts(id) ON DELETE CASCADE,
  symbol_id UUID REFERENCES dream_symbols(id) ON DELETE CASCADE,
  confidence DECIMAL(3,2) DEFAULT 1.0, -- AI confidence score
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  UNIQUE(dream_post_id, symbol_id)
);

CREATE TABLE dream_post_emotions (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  dream_post_id UUID REFERENCES dream_posts(id) ON DELETE CASCADE,
  emotion_id UUID REFERENCES dream_emotions(id) ON DELETE CASCADE,
  confidence DECIMAL(3,2) DEFAULT 1.0, -- AI confidence score
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  UNIQUE(dream_post_id, emotion_id)
);

-- Add indexes for performance
CREATE INDEX idx_dream_symbols_name ON dream_symbols(name);
CREATE INDEX idx_dream_symbols_category ON dream_symbols(category);
CREATE INDEX idx_dream_symbols_frequency ON dream_symbols(frequency DESC);
CREATE INDEX idx_dream_emotions_name ON dream_emotions(name);
CREATE INDEX idx_dream_emotions_intensity ON dream_emotions(intensity_level);
CREATE INDEX idx_dream_emotions_frequency ON dream_emotions(frequency DESC);

CREATE INDEX idx_dream_post_symbols_dream_post ON dream_post_symbols(dream_post_id);
CREATE INDEX idx_dream_post_symbols_symbol ON dream_post_symbols(symbol_id);
CREATE INDEX idx_dream_post_emotions_dream_post ON dream_post_emotions(dream_post_id);
CREATE INDEX idx_dream_post_emotions_emotion ON dream_post_emotions(emotion_id);

-- Function to get or create symbol
CREATE OR REPLACE FUNCTION get_or_create_symbol(symbol_name TEXT, symbol_category TEXT DEFAULT 'general')
RETURNS UUID AS $$
DECLARE
  symbol_id UUID;
BEGIN
  -- Try to find existing symbol
  SELECT id INTO symbol_id FROM dream_symbols WHERE name = symbol_name;
  
  IF symbol_id IS NULL THEN
    -- Create new symbol
    INSERT INTO dream_symbols (name, category) 
    VALUES (symbol_name, symbol_category) 
    RETURNING id INTO symbol_id;
  ELSE
    -- Update frequency
    UPDATE dream_symbols SET frequency = frequency + 1, updated_at = NOW() WHERE id = symbol_id;
  END IF;
  
  RETURN symbol_id;
END;
$$ LANGUAGE plpgsql;

-- Function to get or create emotion
CREATE OR REPLACE FUNCTION get_or_create_emotion(emotion_name TEXT, intensity INTEGER DEFAULT 5)
RETURNS UUID AS $$
DECLARE
  emotion_id UUID;
BEGIN
  -- Try to find existing emotion
  SELECT id INTO emotion_id FROM dream_emotions WHERE name = emotion_name;
  
  IF emotion_id IS NULL THEN
    -- Create new emotion
    INSERT INTO dream_emotions (name, intensity_level) 
    VALUES (emotion_name, intensity) 
    RETURNING id INTO emotion_id;
  ELSE
    -- Update frequency
    UPDATE dream_emotions SET frequency = frequency + 1, updated_at = NOW() WHERE id = emotion_id;
  END IF;
  
  RETURN emotion_id;
END;
$$ LANGUAGE plpgsql;

-- Function to get dream insights with dynamic data
CREATE OR REPLACE FUNCTION get_dynamic_dream_insights(p_user_id UUID)
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

  -- Get most common symbols for this user
  WITH user_symbol_counts AS (
    SELECT 
      ds.name as symbol,
      COUNT(*) as count
    FROM dream_post_symbols dps
    JOIN dream_symbols ds ON dps.symbol_id = ds.id
    JOIN dream_posts dp ON dps.dream_post_id = dp.id
    WHERE dp.user_id = p_user_id
    GROUP BY ds.name
    ORDER BY count DESC
    LIMIT 5
  )
  SELECT json_agg(
    json_build_object('symbol', symbol, 'count', count)
  ) INTO symbol_stats
  FROM user_symbol_counts;

  -- Get most common emotions for this user
  WITH user_emotion_counts AS (
    SELECT 
      de.name as emotion,
      COUNT(*) as count
    FROM dream_post_emotions dpe
    JOIN dream_emotions de ON dpe.emotion_id = de.id
    JOIN dream_posts dp ON dpe.dream_post_id = dp.id
    WHERE dp.user_id = p_user_id
    GROUP BY de.name
    ORDER BY count DESC
    LIMIT 5
  )
  SELECT json_agg(
    json_build_object('emotion', emotion, 'count', count)
  ) INTO emotion_stats
  FROM user_emotion_counts;

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

-- Grant permissions
GRANT EXECUTE ON FUNCTION get_or_create_symbol(TEXT, TEXT) TO authenticated;
GRANT EXECUTE ON FUNCTION get_or_create_emotion(TEXT, INTEGER) TO authenticated;
GRANT EXECUTE ON FUNCTION get_dynamic_dream_insights(UUID) TO authenticated;

-- Insert some common symbols and emotions for initial data
INSERT INTO dream_symbols (name, category) VALUES
  ('flying', 'movement'),
  ('falling', 'movement'),
  ('water', 'nature'),
  ('fire', 'nature'),
  ('animals', 'living'),
  ('people', 'living'),
  ('buildings', 'structures'),
  ('vehicles', 'transport'),
  ('nature', 'environment'),
  ('darkness', 'environment'),
  ('light', 'environment'),
  ('colors', 'visual'),
  ('food', 'objects'),
  ('clothing', 'objects'),
  ('money', 'objects'),
  ('technology', 'objects'),
  ('music', 'sensory'),
  ('art', 'creative'),
  ('childhood', 'memory'),
  ('work', 'activity'),
  ('school', 'activity'),
  ('home', 'place'),
  ('travel', 'activity'),
  ('death', 'transformation'),
  ('birth', 'transformation'),
  ('transformation', 'change'),
  ('chase', 'action'),
  ('escape', 'action'),
  ('search', 'action'),
  ('discovery', 'action');

INSERT INTO dream_emotions (name, intensity_level) VALUES
  ('joy', 8),
  ('fear', 7),
  ('confusion', 4),
  ('wonder', 6),
  ('peace', 5),
  ('anxiety', 6),
  ('excitement', 8),
  ('sadness', 6),
  ('anger', 7),
  ('love', 8),
  ('nostalgia', 5),
  ('curiosity', 6),
  ('freedom', 7),
  ('trapped', 6),
  ('powerful', 7),
  ('vulnerable', 5),
  ('mysterious', 5),
  ('familiar', 4);
