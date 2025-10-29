-- Enable RLS on day_posts table
ALTER TABLE public.day_posts ENABLE ROW LEVEL SECURITY;

-- Policy: Users can read all day posts
CREATE POLICY "Users can read all day posts"
ON public.day_posts
FOR SELECT
TO authenticated
USING (true);

-- Policy: Users can insert their own day posts
CREATE POLICY "Users can insert their own day posts"
ON public.day_posts
FOR INSERT
TO authenticated
WITH CHECK (auth.uid() = user_id);

-- Policy: Users can update their own day posts (for reactions)
CREATE POLICY "Users can update their own day posts"
ON public.day_posts
FOR UPDATE
TO authenticated
USING (auth.uid() = user_id)
WITH CHECK (auth.uid() = user_id);

-- Policy: Users can delete their own day posts
CREATE POLICY "Users can delete their own day posts"
ON public.day_posts
FOR DELETE
TO authenticated
USING (auth.uid() = user_id);

-- Create function to increment day post reactions
CREATE OR REPLACE FUNCTION increment_day_post_reaction(
  post_id UUID,
  reaction_type TEXT
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
  UPDATE day_posts
  SET reactions = jsonb_set(
    reactions,
    ARRAY[reaction_type],
    to_jsonb(COALESCE((reactions->reaction_type)::int, 0) + 1)
  )
  WHERE id = post_id;
END;
$$;

-- Grant execute permission to authenticated users
GRANT EXECUTE ON FUNCTION increment_day_post_reaction(UUID, TEXT) TO authenticated;

