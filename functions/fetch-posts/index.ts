import { serve } from 'https://deno.land/std@0.168.0/http/server.ts';
import { createClient } from 'npm:@supabase/supabase-js@2';
import { cacheGet, cacheSet, CacheKeys, CacheTTL } from '../shared/utils/redis.ts';

interface FetchPostsRequest {
  page?: number;
  limit?: number;
  inputType?: 'action' | 'day' | 'all';
  scope?: 'city' | 'state' | 'country' | 'world';
  tier?: 'elite' | 'rare' | 'unique' | 'notable' | 'common' | 'popular' | 'all';
  reactionFilter?: 'all' | 'funny' | 'creative' | 'must_try';
  sortBy?: 'newest' | 'tier';
  location?: {
    city?: string;
    state?: string;
    country?: string;
  };
}

serve(async (req) => {
  try {
    console.log('🚀 Fetch posts request received');

    // Initialize Supabase client
    const supabaseUrl = Deno.env.get('SUPABASE_URL') ?? '';
    const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? '';
    const supabaseClient = createClient(supabaseUrl, supabaseServiceKey);

    // Parse query parameters
    const url = new URL(req.url);
    const page = parseInt(url.searchParams.get('page') || '1');
    const limit = Math.min(parseInt(url.searchParams.get('limit') || '10'), 50);
    const inputType = url.searchParams.get('inputType') || 'all';
    const scope = url.searchParams.get('scope') || 'world';
    const tier = url.searchParams.get('tier') || 'all';
    const reactionFilter = url.searchParams.get('reactionFilter') || 'all';
    const sortBy = url.searchParams.get('sortBy') || 'newest';

    console.log('📊 Fetch parameters:', { page, limit, inputType, scope, sortBy });

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
        user_id,
        is_anonymous,
        created_at,
        tier,
        percentile,
        match_count,
        embedding,
        has_negation
      `)
      .eq('moderation_status', 'approved');

    // Apply filters
    if (inputType !== 'all') {
      query = query.eq('input_type', inputType);
    }
    if (scope !== 'world') {
      query = query.eq('scope', scope);
    }

    // Apply sorting
    if (sortBy === 'tier') {
      query = query.order('tier', { ascending: true });
    } else {
      query = query.order('created_at', { ascending: false });
    }

    // Check cache first
    const cacheKey = CacheKeys.feed(
      `${inputType || 'all'}:${scope || 'world'}:${tier || 'all'}:${reactionFilter || 'all'}:${sortBy || 'newest'}`,
      page,
      limit
    );
    
    console.log('🔍 Cache key:', cacheKey);
    console.log('🔍 Parameters:', { inputType, scope, tier, reactionFilter, sortBy, page, limit });
    
    let cached = null;
    try {
      cached = await cacheGet<{ posts: any[]; total: number }>(cacheKey);
      if (cached) {
        console.log('✅ Using cached feed results');
        return new Response(JSON.stringify({
          success: true,
          posts: cached.posts,
          total: cached.total,
          page,
          limit
        }), {
          headers: { 'Content-Type': 'application/json' }
        });
      }
    } catch (cacheError) {
      console.warn('⚠️ Cache read error:', cacheError);
    }

    // Apply pagination
    const from = (page - 1) * limit;
    const to = from + limit - 1;
    query = query.range(from, to);

    // Execute query
    const { data: posts, error: postsError, count } = await query;

    if (postsError) {
      console.error('❌ Fetch posts error:', postsError);
      return new Response(JSON.stringify({ 
        success: false, 
        posts: [],
        pagination: {
          page,
          limit,
          total: 0,
          total_pages: 0,
          has_next: false,
          has_prev: false
        },
        error: 'Failed to fetch posts'
      }), {
        status: 500,
        headers: { 'Content-Type': 'application/json' },
      });
    }

    // Get user profiles
    const userIds = [...new Set(posts?.map(post => post.user_id).filter(Boolean) || [])];
    const { data: profiles } = await supabaseClient
      .from('profiles')
      .select('id, username, avatar_url')
      .in('id', userIds);

    const profileMap = new Map(profiles?.map(p => [p.id, p]) || []);

    // Get reaction counts
    const postIds = posts?.map(post => post.id) || [];
    const { data: reactions } = await supabaseClient
      .from('post_reaction_counts')
      .select('post_id, funny_count, creative_count, must_try_count')
      .in('post_id', postIds);

    const reactionMap = new Map(
      reactions?.map(r => [
        r.post_id,
        {
          funny: r.funny_count || 0,
          creative: r.creative_count || 0,
          must_try: r.must_try_count || 0
        }
      ]) || []
    );

    // Calculate real-time percentile/tier for each post
    console.log('📊 Calculating real-time percentile/tier for posts...');
    const postsWithRealTimeData = await Promise.all(
      posts?.map(async (post: any) => {
        try {
          // Get current match count using semantic similarity
          const { data: similarPosts, error: searchError } = await supabaseClient.rpc('match_posts_by_embedding', {
            filter_city: post.location_city,
            filter_country: post.location_country,
            filter_state: post.location_state,
            match_limit: 100,
            match_threshold: 0.70,
            query_embedding: post.embedding,
            query_has_negation: post.has_negation || false,
            scope_filter: post.scope,
            today_only: false
          });

          if (searchError || !similarPosts) {
            console.log('⚠️ Using stored values for post:', post.id);
            return post;
          }

          const currentMatchCount = similarPosts.length + 1; // +1 for current post

          // Get total posts in scope
          let totalQuery = supabaseClient
            .from('posts')
            .select('id', { count: 'exact' })
            .eq('moderation_status', 'approved');

          // Apply scope filtering based on hierarchy
          // City posts only match city posts, state posts match city+state, etc.
          switch (post.scope) {
            case 'city':
              if (post.location_city) {
                // City scope: count only city posts in this city
                totalQuery = totalQuery.eq('location_city', post.location_city).eq('scope', 'city');
              }
              break;
            case 'state':
              if (post.location_state) {
                // State scope: count city + state posts in this state
                totalQuery = totalQuery.eq('location_state', post.location_state).in('scope', ['city', 'state']);
              }
              break;
            case 'country':
              if (post.location_country) {
                // Country scope: count city + state + country posts in this country
                totalQuery = totalQuery.eq('location_country', post.location_country).in('scope', ['city', 'state', 'country']);
              }
              break;
            case 'world':
            default:
              // World scope: count all posts globally
              break;
          }

          const { count: totalPosts } = await totalQuery;
          const totalPostsInScope = Math.max(1, totalPosts || 1);

          // Calculate current percentile
          const currentPercentile = (currentMatchCount / totalPostsInScope) * 100;

          // Determine current tier
          let currentTier = 'common';
          if (currentPercentile < 0.5) currentTier = 'elite';
          else if (currentPercentile < 5) currentTier = 'rare';
          else if (currentPercentile < 15) currentTier = 'unique';
          else if (currentPercentile < 30) currentTier = 'notable';
          else if (currentPercentile < 50) currentTier = 'common';
          else currentTier = 'popular';

          // Generate display text
          let displayText = '';
          if (currentMatchCount === 1) {
            displayText = 'Only you!';
          } else {
            displayText = `Top ${Math.round(currentPercentile)}%`;
          }

          return {
            ...post,
            tier: currentTier,
            percentile: Math.round(currentPercentile * 100) / 100,
            matchCount: currentMatchCount,
            displayText,
            comparison: `${currentMatchCount} of ${totalPostsInScope} people`
          };

        } catch (error) {
          console.error('❌ Real-time calculation error for post:', post.id, error);
          return post; // Return original post if calculation fails
        }
      }) || []
    );

    // Format response
    const formattedPosts = postsWithRealTimeData.map(post => {
      const profile = post.user_id ? profileMap.get(post.user_id) : null;
      const reactions = reactionMap.get(post.id) || { funny: 0, creative: 0, must_try: 0 };

      return {
        id: post.id,
        content: post.content,
        input_type: post.input_type,
        scope: post.scope,
        location_city: post.location_city,
        location_state: post.location_state,
        location_country: post.location_country,
        user_id: post.user_id,
        is_anonymous: post.is_anonymous,
        created_at: post.created_at,
        tier: post.tier,
        percentile: post.percentile,
        matchCount: post.matchCount,
        displayText: post.displayText || `Top ${Math.round(post.percentile)}%`,
        comparison: post.comparison || `${post.matchCount} people`,
        username: profile?.username,
        avatar_url: profile?.avatar_url,
        reactions
      };
    });

    const total = count || 0;
    const total_pages = Math.ceil(total / limit);

    const response = {
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

    console.log(`✅ Successfully fetched ${formattedPosts.length} posts`);

    // Cache the results
    try {
      await cacheSet(cacheKey, {
        posts: formattedPosts,
        total: total || 0
      }, CacheTTL.FEED_RESULTS);
    } catch (cacheError) {
      console.warn('⚠️ Cache write error:', cacheError);
    }

    return new Response(JSON.stringify(response), {
      headers: { 'Content-Type': 'application/json' },
    });

  } catch (error) {
    console.error('❌ Fetch posts error:', error);
    console.error('❌ Error details:', {
      name: error.name,
      message: error.message,
      stack: error.stack
    });
    return new Response(JSON.stringify({ 
      success: false,
      posts: [],
      pagination: {
        page: 1,
        limit: 10,
        total: 0,
        total_pages: 0,
        has_next: false,
        has_prev: false
      },
      error: `Internal server error: ${error.message}`
    }), {
      status: 500,
      headers: { 'Content-Type': 'application/json' },
    });
  }
});