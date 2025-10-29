import { serve } from 'https://deno.land/std@0.168.0/http/server.ts';
import { createClient } from 'npm:@supabase/supabase-js@2';

interface CreateDayPostRequest {
  content: string;
  dayOfWeek: 'monday' | 'tuesday' | 'wednesday' | 'thursday' | 'friday' | 'saturday' | 'sunday';
}

serve(async (req) => {
  try {
    // Handle CORS
    if (req.method === 'OPTIONS') {
      return new Response(null, {
        status: 200,
        headers: {
          'Access-Control-Allow-Origin': '*',
          'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
          'Access-Control-Allow-Methods': 'POST, OPTIONS',
        },
      });
    }

    if (req.method !== 'POST') {
      return new Response(
        JSON.stringify({ success: false, error: 'Method not allowed' }),
        { status: 405, headers: { 'Content-Type': 'application/json' } }
      );
    }

    console.log('🎭 Create day post request received');

    // Initialize Supabase client
    const supabaseUrl = Deno.env.get('SUPABASE_URL') ?? '';
    const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? '';
    const supabaseClient = createClient(supabaseUrl, supabaseServiceKey);

    // Get user from auth header
    const authHeader = req.headers.get('Authorization');
    if (!authHeader) {
      return new Response(
        JSON.stringify({ success: false, error: 'Missing authorization header' }),
        { status: 401, headers: { 'Content-Type': 'application/json' } }
      );
    }

    const token = authHeader.replace('Bearer ', '');
    const { data: { user }, error: userError } = await supabaseClient.auth.getUser(token);

    if (userError || !user) {
      return new Response(
        JSON.stringify({ success: false, error: 'Unauthorized' }),
        { status: 401, headers: { 'Content-Type': 'application/json' } }
      );
    }

    // Parse request body
    const body: CreateDayPostRequest = await req.json();
    const { content, dayOfWeek } = body;

    // Validate input
    if (!content || content.trim().length < 3) {
      return new Response(
        JSON.stringify({ success: false, error: 'Content must be at least 3 characters' }),
        { status: 400, headers: { 'Content-Type': 'application/json' } }
      );
    }

    if (content.length > 1000) {
      return new Response(
        JSON.stringify({ success: false, error: 'Content must be less than 1000 characters' }),
        { status: 400, headers: { 'Content-Type': 'application/json' } }
      );
    }

    const validDays = ['monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday', 'sunday'];
    if (!validDays.includes(dayOfWeek)) {
      return new Response(
        JSON.stringify({ success: false, error: 'Invalid day of week' }),
        { status: 400, headers: { 'Content-Type': 'application/json' } }
      );
    }

    // Create day post
    const { data: dayPost, error: insertError } = await supabaseClient
      .from('day_posts')
      .insert({
        user_id: user.id,
        day_of_week: dayOfWeek,
        content: content.trim(),
        reactions: { first: 0, second: 0, third: 0 }
      })
      .select('*')
      .single();

    if (insertError) {
      console.error('❌ Error creating day post:', insertError);
      return new Response(
        JSON.stringify({ success: false, error: 'Failed to create day post' }),
        { status: 500, headers: { 'Content-Type': 'application/json' } }
      );
    }

    // Get user profile
    const { data: profile } = await supabaseClient
      .from('profiles')
      .select('username, avatar_url')
      .eq('id', user.id)
      .single();

    console.log('✅ Day post created successfully');

    return new Response(
      JSON.stringify({
        success: true,
        post: {
          ...dayPost,
          username: profile?.username || 'anonymous',
          avatar_url: profile?.avatar_url,
          timeAgo: 'Just now',
          reactionCounts: dayPost.reactions || { first: 0, second: 0, third: 0 }
        }
      }),
      { headers: { 'Content-Type': 'application/json' } }
    );

  } catch (error) {
    console.error('❌ Error:', error);
    return new Response(
      JSON.stringify({ success: false, error: error.message || 'Internal server error' }),
      { status: 500, headers: { 'Content-Type': 'application/json' } }
    );
  }
});

