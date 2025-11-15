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
          'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
        },
      });
    }

    if (req.method !== 'GET' && req.method !== 'POST') {
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

    // Parse parameters (from query string for GET, or body for POST)
    let dayOfWeek: string | null = null;
    let limit = 10;
    let todayOnly = true;

    if (req.method === 'POST') {
      // POST: read from body
      const body = await req.json().catch(() => ({}));
      dayOfWeek = body.dayOfWeek || null;
      limit = Math.min(parseInt(body.limit || '10'), 100);
      todayOnly = body.todayOnly !== undefined ? body.todayOnly : true;
    } else {
      // GET: read from query params
    const url = new URL(req.url);
      dayOfWeek = url.searchParams.get('dayOfWeek');
      limit = Math.min(parseInt(url.searchParams.get('limit') || '10'), 100);
      todayOnly = url.searchParams.get('todayOnly') === 'true';
    }

    // Validate day parameter
    const validDays = ['monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday', 'sunday'];
    if (!dayOfWeek || !validDays.includes(dayOfWeek)) {
      return new Response(
        JSON.stringify({ success: false, error: 'Invalid or missing day of week parameter' }),
        { status: 400, headers: { 'Content-Type': 'application/json' } }
      );
    }

    console.log(`📊 Fetching posts for ${dayOfWeek}, todayOnly: ${todayOnly}`);

    // Build query - use posts table (unified)
    // Filter for themed day posts only (not day summaries)
    // Themed day posts: have day_of_week but NO activities (activities IS NULL)
    // Day summaries: have day_of_week AND activities (activities IS NOT NULL)
    let query = supabaseClient
      .from('posts')
      .select('id, content, user_id, day_of_week, reactions, scope, location_city, location_state, location_country, created_at')
      .eq('input_type', 'day')
      .eq('day_of_week', dayOfWeek)
      .is('activities', null) // Only themed day posts (exclude day summaries which have activities)
      .eq('moderation_status', 'approved') // Only show approved posts
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

      // Format location
      const locationParts = [];
      if (post.location_city) locationParts.push(post.location_city);
      if (post.location_state) locationParts.push(post.location_state);
      if (post.location_country) locationParts.push(post.location_country);
      const location = locationParts.length > 0 ? locationParts.join(', ') : null;

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
        scope: post.scope || 'world',
        location: location,
        location_city: post.location_city,
        location_state: post.location_state,
        location_country: post.location_country,
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

