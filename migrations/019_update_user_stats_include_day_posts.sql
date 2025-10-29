-- Update get_user_stats to include day_posts in total count
-- This ensures all posts (feed actions/summaries AND day-themed posts) are counted

CREATE OR REPLACE FUNCTION get_user_stats(p_user_id UUID)
RETURNS TABLE (
  total_posts BIGINT,
  elite_posts BIGINT,
  current_streak INTEGER,
  total_reactions BIGINT
) AS $$
BEGIN
  RETURN QUERY
  SELECT
    -- Total posts = posts from 'posts' table + posts from 'day_posts' table
    (
      (SELECT COUNT(*) FROM public.posts WHERE user_id = p_user_id) +
      (SELECT COUNT(*) FROM public.day_posts WHERE user_id = p_user_id)
    ) as total_posts,
    
    -- Elite posts (only from regular posts table, as day posts don't have tiers)
    (SELECT COUNT(*) FROM public.posts WHERE user_id = p_user_id AND tier = 'elite') as elite_posts,
    
    -- Current streak
    COALESCE((SELECT us.current_streak FROM public.user_streaks us WHERE us.user_id = p_user_id), 0) as current_streak,
    
    -- Total reactions from both tables
    (
      -- Reactions from regular posts
      COALESCE((
        SELECT SUM(r.total_count) 
        FROM public.post_reaction_counts r 
        JOIN public.posts p ON r.post_id = p.id 
        WHERE p.user_id = p_user_id
      ), 0) +
      -- Reactions from day posts (sum all reaction types)
      COALESCE((
        SELECT SUM(
          COALESCE((reactions->>'first')::INTEGER, 0) +
          COALESCE((reactions->>'second')::INTEGER, 0) +
          COALESCE((reactions->>'third')::INTEGER, 0)
        )
        FROM public.day_posts
        WHERE user_id = p_user_id
      ), 0)
    ) as total_reactions;
END;
$$ LANGUAGE plpgsql;

