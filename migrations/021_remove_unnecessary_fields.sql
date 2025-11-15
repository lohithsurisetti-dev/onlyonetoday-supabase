-- ============================================================================
-- Remove Unnecessary Fields from Posts Table (V2 Cleanup)
-- Date: 2025-01-XX
-- 
-- Removes:
-- - V1 legacy fields (embedding, percentile, tier)
-- - Redundant fields (text_normalized, detected_language, language_confidence)
-- - Unused fields (location_coords, activity_embeddings)
-- - Unused indexes
-- ============================================================================

-- Remove V1 legacy fields (no longer used in V2)
ALTER TABLE public.posts DROP COLUMN IF EXISTS embedding;
ALTER TABLE public.posts DROP COLUMN IF EXISTS percentile;
ALTER TABLE public.posts DROP COLUMN IF EXISTS tier;

-- Remove redundant fields
ALTER TABLE public.posts DROP COLUMN IF EXISTS text_normalized; -- Same as normalized_content
ALTER TABLE public.posts DROP COLUMN IF EXISTS detected_language; -- Language agnostic, English primary
ALTER TABLE public.posts DROP COLUMN IF EXISTS language_confidence; -- Language agnostic

-- Remove unused future features
ALTER TABLE public.posts DROP COLUMN IF EXISTS location_coords; -- Not used

-- Remove V1 embedding fields
ALTER TABLE public.posts DROP COLUMN IF EXISTS activity_embeddings; -- V2 doesn't use embeddings

-- Remove constraints that reference removed fields
ALTER TABLE public.posts DROP CONSTRAINT IF EXISTS percentile_range;

-- Remove indexes for removed fields
DROP INDEX IF EXISTS public.idx_posts_tier;
DROP INDEX IF EXISTS public.idx_posts_embedding_hnsw;
DROP INDEX IF EXISTS public.idx_posts_emotional_tone; -- Low cardinality, not needed
DROP INDEX IF EXISTS public.idx_posts_celebration; -- Low cardinality, not needed
DROP INDEX IF EXISTS public.idx_posts_detected_language; -- Field removed

-- Note: Keeping story fields (match_count, narrative, emotional_tone, celebration, badge)
-- These are cached for performance but updated on fetch to avoid staleness

-- Migration complete
-- Estimated storage savings: ~3-7 KB per post

