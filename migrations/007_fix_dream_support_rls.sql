-- Fix RLS policies for dream_support_messages to allow service role operations

-- Drop existing policies
DROP POLICY IF EXISTS "Users can create their own support messages" ON public.dream_support_messages;
DROP POLICY IF EXISTS "Users can update their own support messages" ON public.dream_support_messages;
DROP POLICY IF EXISTS "Users can delete their own support messages" ON public.dream_support_messages;

-- Create new policies that allow service role operations
CREATE POLICY "Users and service role can create support messages" ON public.dream_support_messages
  FOR INSERT WITH CHECK (
    auth.uid() = user_id OR auth.role() = 'service_role'
  );

CREATE POLICY "Users and service role can update support messages" ON public.dream_support_messages
  FOR UPDATE USING (
    (auth.uid() = user_id AND is_approved = false) OR auth.role() = 'service_role'
  );

CREATE POLICY "Users and service role can delete support messages" ON public.dream_support_messages
  FOR DELETE USING (
    (auth.uid() = user_id AND is_approved = false) OR auth.role() = 'service_role'
  );
