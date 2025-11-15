-- ============================================================================
-- DAY SUMMARIES V2 SUPPORT
-- ============================================================================
-- Add columns to posts table to support day summaries
-- - day_of_week: Which day of the week (for themed days)
-- - reactions: JSONB for reaction counts (for day summaries)
-- Note: activities column already exists from migration 002

-- Add day_of_week column (nullable, only for day summaries)
ALTER TABLE public.posts
  ADD COLUMN IF NOT EXISTS day_of_week TEXT CHECK (day_of_week IN ('monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday', 'sunday'));

-- Add reactions column (nullable, only for day summaries)
ALTER TABLE public.posts
  ADD COLUMN IF NOT EXISTS reactions JSONB DEFAULT '{"first": 0, "second": 0, "third": 0}'::jsonb;

-- Create indexes
CREATE INDEX IF NOT EXISTS idx_posts_day_of_week ON public.posts(day_of_week) WHERE day_of_week IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_posts_reactions ON public.posts USING GIN(reactions) WHERE reactions IS NOT NULL;

-- Add comments
COMMENT ON COLUMN public.posts.day_of_week IS 'Day of the week for themed day summaries (nullable, only for input_type=day)';
COMMENT ON COLUMN public.posts.reactions IS 'Reaction counts for day summaries (nullable, only for input_type=day)';

