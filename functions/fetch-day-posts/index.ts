import { serve } from 'https://deno.land/std@0.168.0/http/server.ts';
import { createClient } from 'npm:@supabase/supabase-js@2';

serve(async (req) => {
  try {
    // Handle CORS
    if (req.method === 'OPTIONS') {
      return new Response(null, {
        status: 200,
        headers: {
          'Access-Control-Allow-Origin': '*',
          'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
          'Access-Control-Allow-Methods': 'GET, OPTIONS',
        },
      });
    }

    if (req.method !== 'GET') {
      return new Response(
        JSON.stringify({ success: false, error: 'Method not allowed' }),
        { status: 405, headers: { 'Content-Type': 'application/json' } }
      );
    }

    console.log('📚 Fetch day posts request received');

    // Initialize Supabase client
    const supabaseUrl = Deno.env.get('SUPABASE_URL') ?? '';
    const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? '';
    const supabaseClient = createClient(supabaseUrl, supabaseServiceKey);

    // Parse query parameters
    const url = new URL(req.url);
    const dayOfWeek = url.searchParams.get('dayOfWeek');
    const limit = Math.min(parseInt(url.searchParams.get('limit') || '10'), 100);
    const todayOnly = url.searchParams.get('todayOnly') === 'true';

    // Validate day parameter
    const validDays = ['monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday', 'sunday'];
    if (!dayOfWeek || !validDays.includes(dayOfWeek)) {
      return new Response(
        JSON.stringify({ success: false, error: 'Invalid or missing day of week parameter' }),
        { status: 400, headers: { 'Content-Type': 'application/json' } }
      );
    }

    console.log(`📊 Fetching posts for ${dayOfWeek}, todayOnly: ${todayOnly}`);

    // Build query
    let query = supabaseClient
      .from('day_posts')
      .select('*')
      .eq('day_of_week', dayOfWeek)
      .order('created_at', { ascending: false })
      .limit(limit);

    // Filter by today if requested
    if (todayOnly) {
      const today = new Date();
      today.setHours(0, 0, 0, 0);
      const tomorrow = new Date(today);
      tomorrow.setDate(tomorrow.getDate() + 1);
      
      query = query
        .gte('created_at', today.toISOString())
        .lt('created_at', tomorrow.toISOString());
    }

    // Execute query
    const { data: posts, error: fetchError } = await query;

    if (fetchError) {
      console.error('❌ Error fetching day posts:', fetchError);
      return new Response(
        JSON.stringify({ success: false, error: 'Failed to fetch day posts' }),
        { status: 500, headers: { 'Content-Type': 'application/json' } }
      );
    }

    // Get user profiles
    const userIds = [...new Set(posts?.map(post => post.user_id).filter(Boolean) || [])];
    let profileMap = new Map();
    
    if (userIds.length > 0) {
      const { data: profiles } = await supabaseClient
        .from('profiles')
        .select('id, username, avatar_url')
        .in('id', userIds);
      
      profileMap = new Map(profiles?.map(p => [p.id, p]) || []);
    }

    // Transform posts to include timeAgo and formatted data
    const formattedPosts = posts.map(post => {
      const profile = profileMap.get(post.user_id);
      const createdAt = new Date(post.created_at);
      const now = new Date();
      const diffMs = now.getTime() - createdAt.getTime();
      const diffMins = Math.floor(diffMs / 60000);
      const diffHours = Math.floor(diffMs / 3600000);
      const diffDays = Math.floor(diffMs / 86400000);

      let timeAgo = 'Just now';
      if (diffMins >= 1 && diffMins < 60) timeAgo = `${diffMins}m`;
      else if (diffHours >= 1 && diffHours < 24) timeAgo = `${diffHours}h`;
      else if (diffDays >= 1) timeAgo = `${diffDays}d`;

      return {
        id: post.id,
        content: post.content,
        username: profile?.username || 'anonymous',
        avatar_url: profile?.avatar_url,
        day: dayOfWeek,
        timestamp: createdAt.getTime(),
        timeAgo,
        reactionCounts: post.reactions || { first: 0, second: 0, third: 0 },
        weekNumber: Math.ceil(createdAt.getTime() / (7 * 24 * 60 * 60 * 1000)),
        scope: 'world', // Day posts are always world scope
        created_at: post.created_at
      };
    });

    console.log(`✅ Successfully fetched ${formattedPosts.length} day posts`);

    return new Response(
      JSON.stringify({
        success: true,
        posts: formattedPosts,
        count: formattedPosts.length
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

