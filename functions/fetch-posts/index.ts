import { serve } from 'https://deno.land/std@0.168.0/http/server.ts';
import { createClient } from 'npm:@supabase/supabase-js@2';
import { cacheGet, cacheSet, CacheKeys, CacheTTL } from '../shared/utils/redis.ts';
import { KeywordMatcher } from '../shared/services/KeywordMatcher.ts';
import { StoryGenerator } from '../shared/services/StoryGenerator.ts';

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
        normalized_content,
        keywords,
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
        emotional_tone,
        narrative,
        celebration,
        badge,
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

    // V2: Calculate real-time match count and story for each post using keyword matching
    console.log('📊 V2: Calculating real-time match count and story for posts...');
    const keywordMatcher = new KeywordMatcher(supabaseClient);
    const storyGenerator = new StoryGenerator();
    
    const postsWithRealTimeData = await Promise.all(
      posts?.map(async (post: any) => {
        try {
          // Use stored keywords if available, otherwise extract from content
          const keywords = post.keywords || [];
          
          if (keywords.length === 0) {
            // Fallback: use stored values if no keywords
            console.log('⚠️ No keywords for post, using stored values:', post.id);
            return {
              ...post,
              matchCount: post.match_count || 1,
              totalInScope: post.total_in_scope || 1,
              emotionalTone: post.emotional_tone || 'unique',
              narrative: post.narrative || "You're blazing a trail. No one else did this today. Your moment is uniquely yours. 🌟",
              celebration: post.celebration || 'trailblazer',
              badge: post.badge || '🌟'
            };
          }

          // Find similar posts using keyword matching
          const similar = await keywordMatcher.findSimilarPosts(
            keywords,
            post.scope,
            {
              city: post.location_city,
              state: post.location_state,
              country: post.location_country
            },
            post.input_type || 'action'
          );

          // Generate story with V2 approach
          const story = storyGenerator.generateStory(
            similar.matchCount,
            similar.totalInScope,
            post.content,
            post.input_type || 'action'
          );

          return {
            ...post,
            matchCount: similar.matchCount,
            totalInScope: similar.totalInScope,
            emotionalTone: story.emotionalTone,
            narrative: story.narrative,
            celebration: story.celebration,
            badge: story.badge,
            // Legacy fields for backward compatibility
            tier: post.tier || 'unique',
            percentile: post.percentile || 0,
            displayText: `${similar.matchCount} of ${similar.totalInScope}`,
            comparison: `${similar.matchCount} of ${similar.totalInScope} people`
          };

        } catch (error) {
          console.error('❌ V2 calculation error for post:', post.id, error);
          // Return with stored values as fallback
          return {
            ...post,
            matchCount: post.match_count || 1,
            totalInScope: post.total_in_scope || 1,
            emotionalTone: post.emotional_tone || 'unique',
            narrative: post.narrative || "You're blazing a trail. No one else did this today. Your moment is uniquely yours. 🌟",
            celebration: post.celebration || 'trailblazer',
            badge: post.badge || '🌟'
          };
        }
      }) || []
    );

    // Format response with V2 fields
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
        // V2 fields
        matchCount: post.matchCount || post.match_count || 1,
        totalInScope: post.totalInScope || post.total_in_scope || 1,
        emotionalTone: post.emotionalTone || post.emotional_tone || 'unique',
        narrative: post.narrative || "You're blazing a trail. No one else did this today. Your moment is uniquely yours. 🌟",
        celebration: post.celebration || 'trailblazer',
        badge: post.badge || '🌟',
        // Legacy fields (for backward compatibility)
        tier: post.tier || 'unique',
        percentile: post.percentile || 0,
        displayText: post.displayText || `${post.matchCount || 1} of ${post.totalInScope || 1}`,
        comparison: post.comparison || `${post.matchCount || 1} of ${post.totalInScope || 1} people`,
        username: post.is_anonymous ? 'anonymous' : (profile?.username || 'anonymous'),
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