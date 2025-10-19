/**
 * Feed Service - Real-time Calculation
 * 
 * Calculates percentile and tier on-the-fly for feed posts
 * No temporal analytics - just current percentile/tier for feed cards
 */

import { createClient } from 'npm:@supabase/supabase-js@2';
import { PercentileService } from './PercentileService.js';

export interface FeedPost {
  id: string;
  content: string;
  input_type: string;
  scope: string;
  location_city?: string;
  location_state?: string;
  location_country?: string;
  user_id?: string;
  is_anonymous: boolean;
  created_at: string;
  
  // Real-time calculated fields
  percentile: number;
  tier: string;
  displayText: string;
  matchCount: number;
  comparison: string;
  
  // User info
  username?: string;
  avatar_url?: string;
  
  // Reactions
  reactions: {
    funny: number;
    creative: number;
    must_try: number;
  };
}

export interface FeedFilters {
  inputType?: 'action' | 'day' | 'all';
  scope?: 'world' | 'city' | 'state' | 'country';
  tier?: 'elite' | 'rare' | 'unique' | 'notable' | 'common' | 'popular' | 'all';
  reactionFilter?: 'all' | 'funny' | 'creative' | 'must_try';
  location?: {
    city?: string;
    state?: string;
    country?: string;
  };
}

export interface FeedResponse {
  success: boolean;
  posts: FeedPost[];
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

export class FeedService {
  private supabase: any;
  private percentileService: PercentileService;

  constructor() {
    const supabaseUrl = Deno.env.get('SUPABASE_URL') ?? '';
    const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? '';
    this.supabase = createClient(supabaseUrl, supabaseServiceKey);
    this.percentileService = new PercentileService();
  }

  /**
   * Get feed posts with real-time percentile/tier calculation
   */
  async getFeedPosts(
    page: number = 1,
    limit: number = 10,
    filters: FeedFilters = {},
    sortBy: 'newest' | 'tier' = 'newest'
  ): Promise<FeedResponse> {
    try {
      console.log('🔍 Fetching feed posts with real-time calculation...', {
        page,
        limit,
        filters,
        sortBy
      });

      // 1. Build base query
      let query = this.supabase
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
          embedding,
          has_negation,
          content_hash
        `)
        .eq('moderation_status', 'approved');

      // 2. Apply filters
      if (filters.inputType && filters.inputType !== 'all') {
        query = query.eq('input_type', filters.inputType);
      }

      if (filters.scope && filters.scope !== 'world') {
        query = query.eq('scope', filters.scope);
      }

      if (filters.location?.city) {
        query = query.eq('location_city', filters.location.city);
      }
      if (filters.location?.state) {
        query = query.eq('location_state', filters.location.state);
      }
      if (filters.location?.country) {
        query = query.eq('location_country', filters.location.country);
      }

      // 3. Apply sorting
      if (sortBy === 'tier') {
        // Sort by tier priority (elite first)
        query = query.order('tier', { ascending: true });
      } else {
        // Default: newest first
        query = query.order('created_at', { ascending: false });
      }

      // 4. Apply pagination
      const from = (page - 1) * limit;
      const to = from + limit - 1;
      query = query.range(from, to);

      // 5. Execute query
      const { data: posts, error: postsError, count } = await query;

      if (postsError) {
        console.error('❌ Fetch posts error:', postsError);
        return {
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
        };
      }

      if (!posts || posts.length === 0) {
        return {
          success: true,
          posts: [],
          pagination: {
            page,
            limit,
            total: 0,
            total_pages: 0,
            has_next: false,
            has_prev: false
          }
        };
      }

      console.log(`📊 Found ${posts.length} posts, calculating real-time percentile/tier...`);

      // 6. Calculate real-time percentile/tier for each post
      const postsWithCalculations = await Promise.all(
        posts.map(async (post: any) => {
          const calculatedData = await this.calculateRealTimeData(post, filters);
          return {
            ...post,
            ...calculatedData
          };
        })
      );

      // 7. Apply tier filter after calculation
      let filteredPosts = postsWithCalculations;
      if (filters.tier && filters.tier !== 'all') {
        filteredPosts = postsWithCalculations.filter(post => post.tier === filters.tier);
      }

      // 8. Get user profiles
      const userIds = [...new Set(posts.map((post: any) => post.user_id).filter(Boolean))];
      const { data: profiles } = await this.supabase
        .from('profiles')
        .select('id, username, avatar_url')
        .in('id', userIds);

      const profileMap = new Map(profiles?.map((p: any) => [p.id, p]) || []);

      // 9. Get reaction counts
      const postIds = posts.map((post: any) => post.id);
      const { data: reactions } = await this.supabase
        .from('post_reaction_counts')
        .select('post_id, funny_count, creative_count, must_try_count')
        .in('post_id', postIds);

      const reactionMap = new Map(
        reactions?.map((r: any) => [
          r.post_id,
          {
            funny: r.funny_count || 0,
            creative: r.creative_count || 0,
            must_try: r.must_try_count || 0
          }
        ]) || []
      );

      // 10. Format final response
      const formattedPosts: FeedPost[] = filteredPosts.map((post: any) => {
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
          percentile: post.percentile,
          tier: post.tier,
          displayText: post.displayText,
          matchCount: post.matchCount,
          comparison: post.comparison,
          username: profile?.username,
          avatar_url: profile?.avatar_url,
          reactions
        };
      });

      // 11. Apply reaction filter after calculation
      if (filters.reactionFilter && filters.reactionFilter !== 'all') {
        const reactionType = filters.reactionFilter;
        const finalFilteredPosts = formattedPosts.filter(post => 
          post.reactions[reactionType] > 0
        );

        return {
          success: true,
          posts: finalFilteredPosts,
          pagination: {
            page,
            limit,
            total: count || 0,
            total_pages: Math.ceil((count || 0) / limit),
            has_next: page < Math.ceil((count || 0) / limit),
            has_prev: page > 1
          }
        };
      }

      const total = count || 0;
      const total_pages = Math.ceil(total / limit);

      return {
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

    } catch (error) {
      console.error('❌ Feed service error:', error);
      return {
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
        error: 'Internal server error'
      };
    }
  }

  /**
   * Calculate real-time percentile and tier for a single post
   */
  private async calculateRealTimeData(post: any, filters: FeedFilters): Promise<any> {
    try {
      // 1. Find similar posts using semantic similarity
      const similarPosts = await this.findSimilarPosts(
        post.embedding,
        post.scope,
        post.location_city,
        post.location_state,
        post.location_country,
        post.has_negation
      );

      const matchCount = similarPosts.length + 1; // +1 for the current post

      // 2. Get total posts in scope
      const totalPostsInScope = await this.getTotalPostsInScope(
        post.scope,
        post.location_city,
        post.location_state,
        post.location_country
      );

      // 3. Calculate percentile and tier
      const percentileResult = this.percentileService.calculatePercentile(
        matchCount,
        totalPostsInScope
      );

      return {
        percentile: percentileResult.percentile,
        tier: percentileResult.tier,
        displayText: percentileResult.displayText,
        matchCount,
        comparison: percentileResult.comparison
      };

    } catch (error) {
      console.error('❌ Real-time calculation error for post:', post.id, error);
      // Fallback to stored values if calculation fails
      return {
        percentile: 50, // Default fallback
        tier: 'common',
        displayText: 'Top 50%',
        matchCount: 1,
        comparison: '1 person'
      };
    }
  }

  /**
   * Find similar posts using semantic similarity
   */
  private async findSimilarPosts(
    embedding: number[],
    scope: string,
    locationCity?: string,
    locationState?: string,
    locationCountry?: string,
    hasNegation: boolean = false
  ): Promise<any[]> {
    try {
      if (!embedding) {
        console.log('⚠️ No embedding found, returning empty matches');
        return [];
      }

      const { data, error } = await this.supabase.rpc('match_posts_by_embedding', {
        filter_city: locationCity,
        filter_country: locationCountry,
        filter_state: locationState,
        match_limit: 100,
        match_threshold: 0.70, // Same threshold as main system
        query_embedding: embedding,
        query_has_negation: hasNegation,
        scope_filter: scope,
        today_only: false // All-time matching for feed
      });

      if (error) {
        console.error('❌ Vector search failed:', error);
        return [];
      }

      return data || [];
    } catch (error) {
      console.error('❌ Similar posts search error:', error);
      return [];
    }
  }

  /**
   * Get total posts in scope for percentile calculation
   */
  private async getTotalPostsInScope(
    scope: string,
    locationCity?: string,
    locationState?: string,
    locationCountry?: string
  ): Promise<number> {
    try {
      let query = this.supabase
        .from('posts')
        .select('id', { count: 'exact' })
        .eq('moderation_status', 'approved');

      // Apply scope filtering
      switch (scope) {
        case 'city':
          if (locationCity) {
            query = query.eq('location_city', locationCity).eq('scope', 'city');
          }
          break;
        case 'state':
          if (locationState) {
            query = query.eq('location_state', locationState).eq('scope', 'state');
          }
          break;
        case 'country':
          if (locationCountry) {
            query = query.eq('location_country', locationCountry).eq('scope', 'country');
          }
          break;
        case 'world':
        default:
          // No additional filtering for world scope
          break;
      }

      const { count, error } = await query;

      if (error) {
        console.error('❌ Total posts query error:', error);
        return 1; // Fallback to avoid division by zero
      }

      return Math.max(1, count || 1); // Ensure at least 1 to avoid division by zero
    } catch (error) {
      console.error('❌ Get total posts error:', error);
      return 1; // Fallback
    }
  }
}
