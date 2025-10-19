-- Migration: Add Dream Community Features
-- Description: Adds support messages and community stats for dream matching

-- Dream Support Messages (Pre-written by users)
CREATE TABLE public.dream_support_messages (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  dream_id UUID REFERENCES public.dream_posts(id) ON DELETE CASCADE,
  user_id UUID REFERENCES public.profiles(id) ON DELETE CASCADE,
  message TEXT NOT NULL CHECK (length(message) >= 10 AND length(message) <= 500),
  is_approved BOOLEAN DEFAULT FALSE,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Dream Community Stats (Aggregated data)
CREATE TABLE public.dream_community_stats (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  dream_type dream_type,
  symbols TEXT[],
  emotions TEXT[],
  member_count INTEGER DEFAULT 0,
  support_messages_count INTEGER DEFAULT 0,
  weekly_dreams_count INTEGER DEFAULT 0,
  weekly_support_messages INTEGER DEFAULT 0,
  last_updated TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(dream_type, symbols, emotions)
);

-- Dream Impact Tracking (Track positive impact)
CREATE TABLE public.dream_impact_stats (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  dream_id UUID REFERENCES public.dream_posts(id) ON DELETE CASCADE,
  support_message_id UUID REFERENCES public.dream_support_messages(id) ON DELETE CASCADE,
  impact_type TEXT NOT NULL CHECK (impact_type IN ('comfort_found', 'anxiety_overcome', 'lucid_achieved', 'community_growth')),
  count INTEGER DEFAULT 1,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Indexes for performance
CREATE INDEX idx_dream_support_messages_dream_id ON public.dream_support_messages(dream_id);
CREATE INDEX idx_dream_support_messages_user_id ON public.dream_support_messages(user_id);
CREATE INDEX idx_dream_support_messages_approved ON public.dream_support_messages(is_approved);
CREATE INDEX idx_dream_community_stats_type ON public.dream_community_stats(dream_type);
CREATE INDEX idx_dream_community_stats_symbols ON public.dream_community_stats USING GIN(symbols);
CREATE INDEX idx_dream_community_stats_emotions ON public.dream_community_stats USING GIN(emotions);
CREATE INDEX idx_dream_impact_stats_dream_id ON public.dream_impact_stats(dream_id);
CREATE INDEX idx_dream_impact_stats_type ON public.dream_impact_stats(impact_type);

-- RLS Policies for dream_support_messages
ALTER TABLE public.dream_support_messages ENABLE ROW LEVEL SECURITY;

-- Users can read approved support messages
CREATE POLICY "Users can read approved support messages" ON public.dream_support_messages
  FOR SELECT USING (is_approved = true);

-- Users can create their own support messages
CREATE POLICY "Users can create their own support messages" ON public.dream_support_messages
  FOR INSERT WITH CHECK (auth.uid() = user_id);

-- Users can update their own support messages (before approval)
CREATE POLICY "Users can update their own support messages" ON public.dream_support_messages
  FOR UPDATE USING (auth.uid() = user_id AND is_approved = false);

-- Users can delete their own support messages (before approval)
CREATE POLICY "Users can delete their own support messages" ON public.dream_support_messages
  FOR DELETE USING (auth.uid() = user_id AND is_approved = false);

-- RLS Policies for dream_community_stats
ALTER TABLE public.dream_community_stats ENABLE ROW LEVEL SECURITY;

-- Everyone can read community stats
CREATE POLICY "Everyone can read community stats" ON public.dream_community_stats
  FOR SELECT USING (true);

-- Only service role can update community stats
CREATE POLICY "Service role can update community stats" ON public.dream_community_stats
  FOR ALL USING (auth.role() = 'service_role');

-- RLS Policies for dream_impact_stats
ALTER TABLE public.dream_impact_stats ENABLE ROW LEVEL SECURITY;

-- Everyone can read impact stats
CREATE POLICY "Everyone can read impact stats" ON public.dream_impact_stats
  FOR SELECT USING (true);

-- Only service role can update impact stats
CREATE POLICY "Service role can update impact stats" ON public.dream_impact_stats
  FOR ALL USING (auth.role() = 'service_role');

-- Function to update community stats when a dream is created
CREATE OR REPLACE FUNCTION update_dream_community_stats()
RETURNS TRIGGER AS $$
BEGIN
  -- Update or insert community stats for this dream type
  INSERT INTO public.dream_community_stats (dream_type, symbols, emotions, member_count, weekly_dreams_count, last_updated)
  VALUES (NEW.dream_type, NEW.symbols, NEW.emotions, 1, 1, NOW())
  ON CONFLICT (dream_type, symbols, emotions)
  DO UPDATE SET
    member_count = dream_community_stats.member_count + 1,
    weekly_dreams_count = dream_community_stats.weekly_dreams_count + 1,
    last_updated = NOW();
  
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Trigger to update community stats when dreams are created
CREATE TRIGGER trigger_update_dream_community_stats
  AFTER INSERT ON public.dream_posts
  FOR EACH ROW
  EXECUTE FUNCTION update_dream_community_stats();

-- Function to update community stats when a support message is approved
CREATE OR REPLACE FUNCTION update_support_message_stats()
RETURNS TRIGGER AS $$
BEGIN
  -- Only update stats when message is approved
  IF NEW.is_approved = true AND (OLD.is_approved = false OR OLD.is_approved IS NULL) THEN
      -- Get dream details
      DECLARE
        dream_details RECORD;
      BEGIN
        SELECT dream_type, symbols, emotions INTO dream_details
        FROM public.dream_posts
        WHERE id = NEW.dream_id;
      
      -- Update community stats
      UPDATE public.dream_community_stats
      SET 
        support_messages_count = support_messages_count + 1,
        weekly_support_messages = weekly_support_messages + 1,
        last_updated = NOW()
      WHERE dream_type = dream_details.dream_type 
        AND symbols = dream_details.symbols 
        AND emotions = dream_details.emotions;
    END;
  END IF;
  
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Trigger to update stats when support messages are approved
CREATE TRIGGER trigger_update_support_message_stats
  AFTER UPDATE ON public.dream_support_messages
  FOR EACH ROW
  EXECUTE FUNCTION update_support_message_stats();

-- Function to get community stats for a dream
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
    dcs.member_count,
    dcs.support_messages_count,
    dcs.weekly_dreams_count,
    dcs.weekly_support_messages
  FROM public.dream_community_stats dcs
  WHERE dcs.dream_type = p_dream_type
    AND dcs.symbols = p_symbols
    AND dcs.emotions = p_emotions;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Function to get support messages for similar dreams
CREATE OR REPLACE FUNCTION get_dream_support_messages(
  p_dream_type dream_type,
  p_symbols TEXT[],
  p_emotions TEXT[],
  p_limit INTEGER DEFAULT 5
)
RETURNS TABLE (
  id UUID,
  message TEXT,
  created_at TIMESTAMPTZ
) AS $$
BEGIN
  RETURN QUERY
  SELECT 
    dsm.id,
    dsm.message,
    dsm.created_at
  FROM public.dream_support_messages dsm
  JOIN public.dream_posts d ON d.id = dsm.dream_id
  WHERE dsm.is_approved = true
    AND d.dream_type = p_dream_type
    AND d.symbols && p_symbols  -- Overlap in symbols
    AND d.emotions && p_emotions  -- Overlap in emotions
  ORDER BY dsm.created_at DESC
  LIMIT p_limit;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Function to reset weekly stats (to be called by cron job)
CREATE OR REPLACE FUNCTION reset_weekly_dream_stats()
RETURNS void AS $$
BEGIN
  UPDATE public.dream_community_stats
  SET 
    weekly_dreams_count = 0,
    weekly_support_messages = 0,
    last_updated = NOW();
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Schedule weekly reset (every Monday at midnight)
SELECT cron.schedule('reset-weekly-dream-stats', '0 0 * * 1', 'SELECT reset_weekly_dream_stats();');

-- Insert some initial community stats for common dream types
INSERT INTO public.dream_community_stats (dream_type, symbols, emotions, member_count, support_messages_count, weekly_dreams_count, weekly_support_messages)
VALUES 
  ('night_dream', ARRAY['flying'], ARRAY['joy', 'freedom'], 0, 0, 0, 0),
  ('night_dream', ARRAY['water'], ARRAY['peace', 'calm'], 0, 0, 0, 0),
  ('night_dream', ARRAY['mountains'], ARRAY['wonder', 'awe'], 0, 0, 0, 0),
  ('nightmare', ARRAY['chase'], ARRAY['fear', 'anxiety'], 0, 0, 0, 0),
  ('daydream', ARRAY['future'], ARRAY['hope', 'excitement'], 0, 0, 0, 0),
  ('lucid_dream', ARRAY['control'], ARRAY['confidence', 'power'], 0, 0, 0, 0);
