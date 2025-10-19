import { serve } from 'https://deno.land/std@0.168.0/http/server.ts';
import { createClient } from 'npm:@supabase/supabase-js@2';

interface FetchPostsRequest {
  page?: number;
  limit?: number;
  inputType?: 'action' | 'day' | 'all';
  scope?: 'city' | 'state' | 'country' | 'world';
  tier?: 'elite' | 'rare' | 'unique' | 'notable' | 'common' | 'popular';
  sortBy?: 'newest' | 'oldest' | 'tier';
}

interface FetchPostsResponse {
  success: boolean;
  posts: Array<{
    id: string;
    content: string;
    inputType: string;
    scope: string;
    locationCity?: string;
    locationState?: string;
    locationCountry?: string;
    tier: string;
    percentile: number;
    matchCount: number;
    activities?: string[];
    activityCount?: number;
    created_at: string;
  }>;
  pagination: {
    page: number;
    limit: number;
    total: number;
    total_pages: number;
    has_next: boolean;
    has_prev: boolean;
  };
  error?: string;
}

serve(async (req) => {
  try {
    // Initialize Supabase client
    const supabaseUrl = Deno.env.get('SUPABASE_URL') ?? '';
    const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? '';
    const supabaseClient = createClient(supabaseUrl, supabaseServiceKey);

    // For testing, skip authentication (replace with real auth later)
    const user = { id: '00000000-0000-0000-0000-000000000000' };

    // Parse query parameters
    const url = new URL(req.url);
    const page = parseInt(url.searchParams.get('page') || '1');
    const limit = Math.min(parseInt(url.searchParams.get('limit') || '20'), 100);
    const inputType = url.searchParams.get('inputType') || 'all';
    const scope = url.searchParams.get('scope') || 'all';
    const tier = url.searchParams.get('tier') || 'all';
    const sortBy = url.searchParams.get('sortBy') || 'newest';

    // Build query
    let query = supabaseClient
      .from('posts')
      .select(`
        id,
        content,
        input_type,
        scope,
        location_city,
        location_state,
        location_country,
        tier,
        percentile,
        match_count,
        activities,
        activity_count,
        created_at
      `)
      .eq('moderation_status', 'approved');

    // Apply filters
    if (inputType !== 'all') {
      query = query.eq('input_type', inputType);
    }

    if (scope !== 'all') {
      query = query.eq('scope', scope);
    }

    if (tier !== 'all') {
      query = query.eq('tier', tier);
    }

    // Apply sorting
    switch (sortBy) {
      case 'oldest':
        query = query.order('created_at', { ascending: true });
        break;
      case 'tier':
        // Sort by tier priority (elite first)
        query = query.order('tier', { ascending: true });
        break;
      case 'newest':
      default:
        query = query.order('created_at', { ascending: false });
        break;
    }

    // Apply pagination
    const from = (page - 1) * limit;
    const to = from + limit - 1;
    query = query.range(from, to);

    // Execute query
    const { data: posts, error: postsError, count } = await query;

    if (postsError) {
      console.error('Fetch posts error:', postsError);
      return new Response(JSON.stringify({ 
        success: false, 
        error: 'Failed to fetch posts',
        details: postsError.message 
      }), {
        status: 500,
        headers: { 'Content-Type': 'application/json' },
      });
    }

    // Format response
    const formattedPosts = posts?.map(post => ({
      id: post.id,
      content: post.content,
      inputType: post.input_type,
      scope: post.scope,
      locationCity: post.location_city,
      locationState: post.location_state,
      locationCountry: post.location_country,
      tier: post.tier,
      percentile: post.percentile,
      matchCount: post.match_count,
      activities: post.activities,
      activityCount: post.activity_count,
      created_at: post.created_at
    })) || [];

    const total = count || 0;
    const total_pages = Math.ceil(total / limit);

    const response: FetchPostsResponse = {
      success: true,
      posts: formattedPosts,
      pagination: {
        page,
        limit,
        total,
        total_pages,
        has_next: page < total_pages,
        has_prev: page > 1
      }
    };

    return new Response(JSON.stringify(response), {
      headers: { 'Content-Type': 'application/json' },
    });

  } catch (error) {
    console.error('Fetch posts error:', error);
    return new Response(JSON.stringify({ 
      success: false,
      error: 'Internal server error',
      details: error.message 
    }), {
      status: 500,
      headers: { 'Content-Type': 'application/json' },
    });
  }
});