-- Add dream features to the database
-- Migration 003: Dream Posts and Enhanced Analytics

-- Add dream-specific types
CREATE TYPE dream_type AS ENUM ('night_dream', 'daydream', 'lucid_dream', 'nightmare');
CREATE TYPE dream_emotion AS ENUM (
  'joy', 'fear', 'confusion', 'wonder', 'peace', 'anxiety',
  'excitement', 'sadness', 'anger', 'love', 'nostalgia', 'curiosity',
  'freedom', 'trapped', 'powerful', 'vulnerable', 'mysterious', 'familiar'
);
CREATE TYPE dream_symbol AS ENUM (
  'flying', 'falling', 'water', 'fire', 'animals', 'people',
  'buildings', 'vehicles', 'nature', 'darkness', 'light', 'colors',
  'food', 'clothing', 'money', 'technology', 'music', 'art',
  'childhood', 'work', 'school', 'home', 'travel', 'death',
  'birth', 'transformation', 'chase', 'escape', 'search', 'discovery'
);

-- Create dream_posts table
CREATE TABLE dream_posts (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  content TEXT NOT NULL,
  dream_type dream_type NOT NULL,
  emotions dream_emotion[] DEFAULT '{}',
  symbols dream_symbol[] DEFAULT '{}',
  clarity INTEGER CHECK (clarity >= 1 AND clarity <= 10) DEFAULT 5,
  interpretation TEXT,
  is_anonymous BOOLEAN DEFAULT false,
  scope scope_type NOT NULL,
  location_city TEXT,
  location_state TEXT,
  location_country TEXT,
  user_id UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  
  -- Embeddings
  content_embedding vector(1536),
  symbol_embedding vector(1536),
  emotion_embedding vector(1536),
  combined_embedding vector(1536),
  
  -- Analytics
  tier tier_type DEFAULT 'common',
  percentile DECIMAL(5,2) DEFAULT 0,
  match_count INTEGER DEFAULT 0,
  
  -- Timestamps
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Create indexes for dream posts
CREATE INDEX idx_dream_posts_dream_type ON dream_posts(dream_type);
CREATE INDEX idx_dream_posts_scope ON dream_posts(scope);
CREATE INDEX idx_dream_posts_created_at ON dream_posts(created_at);
CREATE INDEX idx_dream_posts_tier ON dream_posts(tier);
CREATE INDEX idx_dream_posts_user_id ON dream_posts(user_id);

-- Vector similarity indexes
CREATE INDEX idx_dream_posts_content_embedding ON dream_posts 
USING ivfflat (content_embedding vector_cosine_ops) WITH (lists = 100);
CREATE INDEX idx_dream_posts_symbol_embedding ON dream_posts 
USING ivfflat (symbol_embedding vector_cosine_ops) WITH (lists = 100);
CREATE INDEX idx_dream_posts_emotion_embedding ON dream_posts 
USING ivfflat (emotion_embedding vector_cosine_ops) WITH (lists = 100);
CREATE INDEX idx_dream_posts_combined_embedding ON dream_posts 
USING ivfflat (combined_embedding vector_cosine_ops) WITH (lists = 100);

-- Create dream_matches table for storing dream similarity relationships
CREATE TABLE dream_matches (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  dream_post_id UUID REFERENCES dream_posts(id) ON DELETE CASCADE,
  similar_dream_id UUID REFERENCES dream_posts(id) ON DELETE CASCADE,
  similarity_score DECIMAL(5,4) NOT NULL,
  match_type TEXT NOT NULL, -- 'content', 'symbol', 'emotion', 'combined'
  shared_symbols dream_symbol[] DEFAULT '{}',
  shared_emotions dream_emotion[] DEFAULT '{}',
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  
  UNIQUE(dream_post_id, similar_dream_id)
);

-- Create indexes for dream matches
CREATE INDEX idx_dream_matches_dream_post_id ON dream_matches(dream_post_id);
CREATE INDEX idx_dream_matches_similar_dream_id ON dream_matches(similar_dream_id);
CREATE INDEX idx_dream_matches_similarity_score ON dream_matches(similarity_score);

-- Create dream_analytics table for aggregated statistics
CREATE TABLE dream_analytics (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  date DATE NOT NULL,
  dream_type dream_type,
  scope scope_type,
  
  -- Counts
  total_dreams INTEGER DEFAULT 0,
  unique_dreams INTEGER DEFAULT 0,
  
  -- Symbol statistics
  symbol_counts JSONB DEFAULT '{}',
  
  -- Emotion statistics
  emotion_counts JSONB DEFAULT '{}',
  
  -- Clarity statistics
  avg_clarity DECIMAL(3,2) DEFAULT 0,
  min_clarity INTEGER DEFAULT 0,
  max_clarity INTEGER DEFAULT 0,
  
  -- Similarity statistics
  avg_similarity DECIMAL(5,4) DEFAULT 0,
  unique_percentage DECIMAL(5,2) DEFAULT 0,
  
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  
  UNIQUE(date, dream_type, scope)
);

-- Create indexes for dream analytics
CREATE INDEX idx_dream_analytics_date ON dream_analytics(date);
CREATE INDEX idx_dream_analytics_dream_type ON dream_analytics(dream_type);
CREATE INDEX idx_dream_analytics_scope ON dream_analytics(scope);

-- Function to match dreams by embedding
CREATE OR REPLACE FUNCTION match_dreams_by_embedding(
  query_embedding vector(1536),
  match_threshold float DEFAULT 0.7,
  match_count int DEFAULT 10,
  dream_type_filter dream_type DEFAULT NULL,
  scope_filter scope_type DEFAULT NULL
)
RETURNS TABLE (
  id UUID,
  content TEXT,
  dream_type dream_type,
  emotions dream_emotion[],
  symbols dream_symbol[],
  clarity INTEGER,
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
    (dream_type_filter IS NULL OR dp.dream_type = dream_type_filter)
    AND (scope_filter IS NULL OR dp.scope = scope_filter)
    AND 1 - (dp.combined_embedding <=> query_embedding) > match_threshold
  ORDER BY dp.combined_embedding <=> query_embedding
  LIMIT match_count;
END;
$$;

-- Function to get dream analytics
CREATE OR REPLACE FUNCTION get_dream_analytics()
RETURNS TABLE (
  total_dreams BIGINT,
  dream_type_distribution JSONB,
  common_symbols JSONB,
  common_emotions JSONB,
  avg_clarity DECIMAL(3,2),
  today_count BIGINT,
  week_count BIGINT,
  month_count BIGINT
)
LANGUAGE plpgsql
AS $$
BEGIN
  RETURN QUERY
  SELECT 
    (SELECT COUNT(*) FROM dream_posts) as total_dreams,
    (SELECT jsonb_object_agg(dream_type, count) 
     FROM (SELECT dream_type, COUNT(*) as count 
           FROM dream_posts 
           GROUP BY dream_type) t) as dream_type_distribution,
    (SELECT jsonb_object_agg(symbol, count)
     FROM (SELECT unnest(symbols) as symbol, COUNT(*) as count
           FROM dream_posts
           GROUP BY symbol
           ORDER BY count DESC
           LIMIT 10) t) as common_symbols,
    (SELECT jsonb_object_agg(emotion, count)
     FROM (SELECT unnest(emotions) as emotion, COUNT(*) as count
           FROM dream_posts
           GROUP BY emotion
           ORDER BY count DESC
           LIMIT 10) t) as common_emotions,
    (SELECT AVG(clarity) FROM dream_posts) as avg_clarity,
    (SELECT COUNT(*) FROM dream_posts WHERE created_at >= CURRENT_DATE) as today_count,
    (SELECT COUNT(*) FROM dream_posts WHERE created_at >= CURRENT_DATE - INTERVAL '7 days') as week_count,
    (SELECT COUNT(*) FROM dream_posts WHERE created_at >= CURRENT_DATE - INTERVAL '30 days') as month_count;
END;
$$;

-- Function to calculate dream tier
CREATE OR REPLACE FUNCTION calculate_dream_tier(
  p_dream_type dream_type,
  p_scope scope_type,
  p_similarity_threshold float DEFAULT 0.8
)
RETURNS TABLE (
  tier tier_type,
  percentile DECIMAL(5,2),
  match_count INTEGER
)
LANGUAGE plpgsql
AS $$
DECLARE
  total_dreams INTEGER;
  similar_dreams INTEGER;
  calculated_percentile DECIMAL(5,2);
  calculated_tier tier_type;
BEGIN
  -- Get total dreams of same type and scope
  SELECT COUNT(*) INTO total_dreams
  FROM dream_posts
  WHERE dream_type = p_dream_type AND scope = p_scope;
  
  -- Get similar dreams (this would be calculated based on actual similarity)
  -- For now, we'll use a simple random calculation
  similar_dreams := GREATEST(1, FLOOR(RANDOM() * total_dreams * 0.1));
  
  -- Calculate percentile
  calculated_percentile := (similar_dreams::DECIMAL / total_dreams::DECIMAL) * 100;
  
  -- Determine tier
  IF calculated_percentile <= 5 THEN
    calculated_tier := 'elite';
  ELSIF calculated_percentile <= 15 THEN
    calculated_tier := 'rare';
  ELSIF calculated_percentile <= 30 THEN
    calculated_tier := 'unique';
  ELSIF calculated_percentile <= 50 THEN
    calculated_tier := 'notable';
  ELSIF calculated_percentile <= 80 THEN
    calculated_tier := 'common';
  ELSE
    calculated_tier := 'popular';
  END IF;
  
  RETURN QUERY SELECT calculated_tier, calculated_percentile, similar_dreams;
END;
$$;

-- Trigger to update dream analytics
CREATE OR REPLACE FUNCTION update_dream_analytics()
RETURNS TRIGGER AS $$
BEGIN
  -- Update daily analytics
  INSERT INTO dream_analytics (date, dream_type, scope, total_dreams)
  VALUES (CURRENT_DATE, NEW.dream_type, NEW.scope, 1)
  ON CONFLICT (date, dream_type, scope)
  DO UPDATE SET 
    total_dreams = dream_analytics.total_dreams + 1,
    avg_clarity = (dream_analytics.avg_clarity * dream_analytics.total_dreams + NEW.clarity) / (dream_analytics.total_dreams + 1);
  
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trigger_update_dream_analytics
  AFTER INSERT ON dream_posts
  FOR EACH ROW
  EXECUTE FUNCTION update_dream_analytics();

-- RLS policies for dream_posts
ALTER TABLE dream_posts ENABLE ROW LEVEL SECURITY;

-- Allow anonymous users to read dream posts
CREATE POLICY "Allow anonymous read access to dream posts" ON dream_posts
  FOR SELECT USING (true);

-- Allow anonymous users to insert dream posts
CREATE POLICY "Allow anonymous insert to dream posts" ON dream_posts
  FOR INSERT WITH CHECK (true);

-- RLS policies for dream_matches
ALTER TABLE dream_matches ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Allow anonymous read access to dream matches" ON dream_matches
  FOR SELECT USING (true);

-- RLS policies for dream_analytics
ALTER TABLE dream_analytics ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Allow anonymous read access to dream analytics" ON dream_analytics
  FOR SELECT USING (true);

-- Grant permissions
GRANT USAGE ON SCHEMA public TO anon, authenticated;
GRANT ALL ON dream_posts TO anon, authenticated;
GRANT ALL ON dream_matches TO anon, authenticated;
GRANT ALL ON dream_analytics TO anon, authenticated;
GRANT EXECUTE ON FUNCTION match_dreams_by_embedding TO anon, authenticated;
GRANT EXECUTE ON FUNCTION get_dream_analytics TO anon, authenticated;
GRANT EXECUTE ON FUNCTION calculate_dream_tier TO anon, authenticated;
