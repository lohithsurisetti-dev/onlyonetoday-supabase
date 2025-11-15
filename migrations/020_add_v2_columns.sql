-- ============================================================================
-- Version 2 Migration: Add New Columns for Keyword-Based Matching
-- Date: 2025-01-XX
-- 
-- Changes:
-- - Add normalized_content for multilingual support
-- - Add keywords array for fast keyword matching
-- - Add language detection fields
-- - Add narrative/story fields (replacing tier/percentile)
-- - Add indexes for keyword search
-- ============================================================================

-- Add new columns to posts table
ALTER TABLE public.posts 
  ADD COLUMN IF NOT EXISTS normalized_content TEXT,
  ADD COLUMN IF NOT EXISTS keywords TEXT[],
  ADD COLUMN IF NOT EXISTS detected_language TEXT,
  ADD COLUMN IF NOT EXISTS language_confidence FLOAT,
  ADD COLUMN IF NOT EXISTS narrative TEXT,
  ADD COLUMN IF NOT EXISTS emotional_tone TEXT CHECK (emotional_tone IN ('unique', 'shared', 'common')),
  ADD COLUMN IF NOT EXISTS celebration TEXT,
  ADD COLUMN IF NOT EXISTS updated_at TIMESTAMPTZ DEFAULT NOW();

-- Add indexes for keyword search (GIN index for array search)
CREATE INDEX IF NOT EXISTS idx_posts_keywords ON public.posts USING GIN(keywords);

-- Add index for normalized content (full-text search)
CREATE INDEX IF NOT EXISTS idx_posts_normalized_content_fts ON public.posts 
  USING GIN(to_tsvector('english', COALESCE(normalized_content, '')));

-- Add index for language detection
CREATE INDEX IF NOT EXISTS idx_posts_detected_language ON public.posts(detected_language);

-- Add index for emotional tone (for filtering)
CREATE INDEX IF NOT EXISTS idx_posts_emotional_tone ON public.posts(emotional_tone);

-- Add index for celebration (for analytics)
CREATE INDEX IF NOT EXISTS idx_posts_celebration ON public.posts(celebration);

-- Add index for updated_at (for tracking updates)
CREATE INDEX IF NOT EXISTS idx_posts_updated_at ON public.posts(updated_at DESC);

-- Create function to update updated_at timestamp
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Create trigger to auto-update updated_at
DROP TRIGGER IF EXISTS update_posts_updated_at ON public.posts;
CREATE TRIGGER update_posts_updated_at
  BEFORE UPDATE ON public.posts
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();

-- Add comment to columns for documentation
COMMENT ON COLUMN public.posts.normalized_content IS 'Normalized English version of content (for multilingual matching)';
COMMENT ON COLUMN public.posts.keywords IS 'Array of extracted keywords for fast matching';
COMMENT ON COLUMN public.posts.detected_language IS 'Detected language type (english, telugu, hindi, code_mixed)';
COMMENT ON COLUMN public.posts.language_confidence IS 'Confidence score of language detection (0.0-1.0)';
COMMENT ON COLUMN public.posts.narrative IS 'Personalized story/narrative (replaces tier/percentile)';
COMMENT ON COLUMN public.posts.emotional_tone IS 'Emotional tone of the story (unique, shared, common)';
COMMENT ON COLUMN public.posts.celebration IS 'How to celebrate this post (trailblazer, rare, found_your_people, etc.)';

-- Migration complete
-- Note: Existing posts will have NULL values for new columns
-- These will be populated when posts are fetched/updated

