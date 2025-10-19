/**
 * Complete Post Service
 * 
 * Handles post creation with all advanced features:
 * - Vector embeddings for semantic similarity
 * - Percentile calculation and tier system
 * - Day summary processing with activity extraction
 * - Temporal analytics and uniqueness tracking
 * - Content moderation
 * - Hierarchical scope system
 */

import { createClient } from 'npm:@supabase/supabase-js@2';
import { EmbeddingService } from './EmbeddingService.ts';
import { PercentileService, PercentileResult } from './PercentileService.ts';
import { DaySummaryService, DaySummaryResult } from './DaySummaryService.ts';
import { ModerationPipeline } from './ModerationPipeline.ts';
import { cacheGet, cacheSet, cacheDel, CacheKeys, CacheTTL, hashContent } from '../utils/redis.ts';

export interface CreatePostRequest {
  content: string;
  inputType: 'action' | 'day';
  isAnonymous?: boolean;
  scope: 'city' | 'state' | 'country' | 'world';
  locationCity?: string;
  locationState?: string;
  locationCountry?: string;
  userId: string | null;
}

export interface CreatePostResponse {
  success: boolean;
  post?: {
    id: string;
    content: string;
    inputType: string;
    scope: string;
    tier: string;
    percentile: number;
    matchCount: number;
    displayText: string;
    badge: string;
    message: string;
    comparison: string;
    activities?: string[];
    activityCount?: number;
    created_at: string;
  };
  percentile?: PercentileResult;
  temporal?: {
    today: {
      total: number;
      matching: number;
      percentile: number;
      tier: string;
    };
    week: {
      total: number;
      matching: number;
      percentile: number;
      tier: string;
    };
    month: {
      total: number;
      matching: number;
      percentile: number;
      tier: string;
    };
  };
  error?: string;
}

export class PostService {
  private supabase: any;
  private embeddingService: EmbeddingService;
  private percentileService: PercentileService;
  private daySummaryService: DaySummaryService;
  private moderationPipeline: ModerationPipeline;

  constructor() {
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    
    this.supabase = createClient(supabaseUrl, supabaseServiceKey);
    this.embeddingService = new EmbeddingService();
    this.percentileService = new PercentileService();
    this.daySummaryService = new DaySummaryService();
    this.moderationPipeline = new ModerationPipeline({
      allowDreams: false, // Regular posts don't need dream-specific features
      allowSymbolicContent: true,
      strictMode: false
    });
  }

  /**
   * Create a new post with all advanced features
   */
  async createPost(request: CreatePostRequest): Promise<CreatePostResponse> {
    const cpuStart = Date.now();
    
    try {
      console.log(`🚀 Creating ${request.inputType} post: "${request.content.substring(0, 50)}..."`);

      // 1. Content Moderation with enhanced error handling
      console.log('🛡️ Running content moderation...');
      console.log('📱 Request details:', {
        contentLength: request.content.length,
        inputType: request.inputType,
        scope: request.scope,
        userAgent: 'mobile-app' // We'll detect this from headers if possible
      });
      
      let moderationResult;
      try {
        moderationResult = await this.moderationPipeline.moderateContent(
          request.content,
          'post',
          { inputType: request.inputType, scope: request.scope }
        );
        console.log('✅ Moderation completed successfully');
      } catch (error) {
        console.error('❌ Moderation failed with error:', error);
        // If moderation fails, allow content but flag it
        moderationResult = {
          approved: true,
          confidence: 0.5,
          flags: ['moderation_error'],
          reason: 'Moderation system error - content allowed'
        };
      }
      
      if (!moderationResult.approved) {
        console.log('❌ Content rejected by moderation:', moderationResult.reason);
        return {
          success: false,
          error: moderationResult.userMessage || `Content rejected: ${moderationResult.flags.join(', ')}`
        };
      }

      // 2. Generate content hash for fast lookup
      const contentHash = this.generateContentHash(request.content);
      console.log(`🔍 Content hash: ${contentHash}`);

      // 3. Check for negation
      const hasNegation = this.detectNegation(request.content);
      console.log(`🔍 Has negation: ${hasNegation}`);

      // 4. Process based on input type
      let activities: string[] = [];
      let activityCount = 0;
      let activityEmbeddings: number[][] = [];

      if (request.inputType === 'day') {
        console.log('📝 Processing day summary...');
        const dayResult = await this.daySummaryService.processDaySummary(
          request.content,
          this.embeddingService
        );

        if (!dayResult.isValid) {
          return {
            success: false,
            error: dayResult.error || 'Invalid day summary'
          };
        }

        activities = dayResult.activities;
        activityCount = dayResult.activityCount;
        activityEmbeddings = dayResult.activityEmbeddings;
      }

      // 5. Generate main content embedding
      console.log('🔮 Generating content embedding...');
      const embeddingResult = await this.embeddingService.generateEmbedding(request.content);
      
      if (!embeddingResult.success) {
        return {
          success: false,
          error: `Embedding generation failed: ${embeddingResult.error}`
        };
      }

      // 6. Find similar posts using vector search
      console.log('🔍 Finding similar posts...');
      const similarPosts = await this.findSimilarPosts(
        embeddingResult.embedding,
        request.scope,
        request.locationCity,
        request.locationState,
        request.locationCountry,
        hasNegation,
        contentHash
      );

      const matchCount = similarPosts.length + 1; // +1 for the current post

      // 7. Calculate percentile and tier
      console.log('📊 Calculating percentile...');
      const totalPostsInScope = await this.getTotalPostsInScope(
        request.scope,
        request.locationCity,
        request.locationState,
        request.locationCountry
      );

      // Add 1 to total count to account for the current post being created
      const adjustedTotalPostsInScope = totalPostsInScope + 1;

      // Safety check for percentile calculation
      if (adjustedTotalPostsInScope === 0) {
        console.log('⚠️ No posts in scope, using default values');
        adjustedTotalPostsInScope = 1; // Avoid division by zero
      }

      console.log('📊 Percentile calculation inputs:', {
        matchCount,
        totalPostsInScope: adjustedTotalPostsInScope,
        calculatedPercentile: (matchCount / adjustedTotalPostsInScope) * 100
      });

      const percentileResult = this.percentileService.calculatePercentile(
        matchCount,
        adjustedTotalPostsInScope
      );

      console.log('📊 Percentile result:', percentileResult);

      // Safety check: ensure percentile is within valid range
      if (percentileResult.percentile > 100 || percentileResult.percentile < 0) {
        console.error('❌ Invalid percentile calculated:', percentileResult.percentile);
        percentileResult.percentile = Math.min(100, Math.max(0, percentileResult.percentile));
        console.log('🔧 Corrected percentile to:', percentileResult.percentile);
      }

      // 8. Calculate temporal analytics (smart optimization)
      let temporalAnalytics = null;
      if (percentileResult.tier === 'elite' && matchCount === 1) {
        // Skip expensive temporal calculations for truly unique posts
        console.log('⏰ Skipping temporal analytics for elite unique post (performance optimization)');
        temporalAnalytics = {
          today: { total: 1, matching: 1, percentile: 0, tier: 'elite', comparison: 'Only you!' },
          week: { total: 1, matching: 1, percentile: 0, tier: 'elite', comparison: 'Only you!' },
          month: { total: 1, matching: 1, percentile: 0, tier: 'elite', comparison: 'Only you!' },
          year: { total: 1, matching: 1, percentile: 0, tier: 'elite', comparison: 'Only you!' },
          allTime: { total: 1, matching: 1, percentile: 0, tier: 'elite', comparison: 'Only you!' }
        };
      } else {
        console.log('⏰ Calculating temporal analytics...');
        temporalAnalytics = await this.calculateTemporalAnalytics(
          contentHash,
          request.scope,
          request.locationCity,
          request.locationState,
          request.locationCountry,
          embeddingResult.embedding,
          hasNegation
        );
      }

      // 9. Insert post into database
      console.log('💾 Inserting post into database...');
      const postData = {
        content: request.content,
        text_normalized: this.normalizeText(request.content),
        input_type: request.inputType,
        user_id: request.userId,
        is_anonymous: request.isAnonymous || false,
        scope: request.scope,
        location_city: request.locationCity,
        location_state: request.locationState,
        location_country: request.locationCountry,
        content_hash: contentHash,
        embedding: embeddingResult.embedding,
        match_count: matchCount,
        percentile: percentileResult.percentile,
        tier: percentileResult.tier,
        activities: activities.length > 0 ? activities : null,
        activity_count: activityCount > 0 ? activityCount : null,
        activity_embeddings: null, // TODO: Fix vector array format
        has_negation: hasNegation,
        time_tags: this.extractTimeTags(request.content),
        emoji_tags: this.extractEmojis(request.content),
        moderation_status: 'approved',
        moderation_score: moderationResult.confidence,
        moderation_flags: moderationResult.flags,
        moderation_details: {
          toxicity: moderationResult.flags.includes('toxic') ? 0.8 : 0,
          spam: moderationResult.flags.includes('spam') ? 0.8 : 0,
          inappropriate: moderationResult.flags.includes('inappropriate') ? 0.8 : 0
        }
      };

      const { data: post, error: insertError } = await this.supabase
        .from('posts')
        .insert(postData)
        .select()
        .single();

      if (insertError) {
        console.error('❌ Database insert failed:', insertError);
        return {
          success: false,
          error: `Database error: ${insertError.message}`
        };
      }

      // 10. Update temporal uniqueness table
      console.log('⏰ Updating temporal uniqueness table...');
      await this.updateTemporalUniqueness(post.id, contentHash, temporalAnalytics);

      console.log('✅ Post created successfully!');
      
      const cpuTime = Date.now() - cpuStart;
      console.log(`⏱️ Total CPU time: ${cpuTime}ms`);
      
      if (cpuTime > 25000) {
        console.warn('⚠️ High CPU usage detected - consider optimization');
      }

      return {
        success: true,
        post: {
          id: post.id,
          content: post.content,
          inputType: post.input_type,
          scope: post.scope,
          tier: post.tier,
          percentile: post.percentile,
          matchCount: post.match_count,
          displayText: percentileResult.displayText,
          badge: percentileResult.badge,
          message: percentileResult.message,
          comparison: percentileResult.comparison,
          activities: activities.length > 0 ? activities : undefined,
          activityCount: activityCount > 0 ? activityCount : undefined,
          created_at: post.created_at
        },
        percentile: percentileResult,
        temporal: temporalAnalytics
      };

    } catch (error) {
      console.error('❌ Post creation failed:', error);
      return {
        success: false,
        error: error.message
      };
    }
  }

  /**
   * Find similar posts using semantic similarity with configurable threshold
   */
  private async findSimilarPosts(
    embedding: number[],
    scope: string,
    locationCity?: string,
    locationState?: string,
    locationCountry?: string,
    hasNegation: boolean = false,
    contentHash?: string
  ): Promise<any[]> {
    try {
      // Check cache first if we have a content hash
      if (contentHash) {
        const cacheKey = CacheKeys.similarPosts(contentHash);
        const cached = await cacheGet<any[]>(cacheKey);
        if (cached) {
          console.log('✅ Using cached similar posts');
          return cached;
        }
      }
      
      // Use semantic similarity with configurable threshold
      console.log('🔍 Calling match_posts_by_embedding with params:', {
        embedding_length: embedding.length,
        match_threshold: 0.50,
        scope_filter: scope,
        today_only: false
      });
      
      const { data, error } = await this.supabase.rpc('match_posts_by_embedding', {
        filter_city: locationCity,
        filter_country: locationCountry,
        filter_state: locationState,
        match_limit: 100,
        match_threshold: 0.70, // Testing with higher threshold for better semantic matching
        query_embedding: embedding,
        query_has_negation: hasNegation,
        scope_filter: scope,
        today_only: false // No time filtering
      });

      if (error) {
        console.error('❌ Vector search failed:', error);
        return [];
      }

      console.log(`🔍 Found ${data?.length || 0} semantic matches with threshold 0.50`);
      console.log('🔍 Vector search results:', data);
      
      const results = data || [];
      
      // Cache the results if we have a content hash
      if (contentHash && results.length > 0) {
        const cacheKey = CacheKeys.similarPosts(contentHash);
        await cacheSet(cacheKey, results, CacheTTL.SIMILAR_POSTS);
      }
      
      return results;
    } catch (error) {
      console.error('❌ Content search error:', error);
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
      // Check cache first for total posts count
      const countCacheKey = CacheKeys.totalPostsCount(scope, locationCity, locationState, locationCountry);
      const cachedCount = await cacheGet<number>(countCacheKey);
      if (cachedCount !== null) {
        console.log('✅ Using cached total posts count');
        return cachedCount;
      }

      let query = this.supabase
        .from('posts')
        .select('id', { count: 'exact' })
        .eq('moderation_status', 'approved');
        // Removed today filter to match findSimilarPosts scope

      // Apply scope filtering based on hierarchy
      // City posts only match city posts, state posts match city+state, etc.
      switch (scope) {
        case 'city':
          if (locationCity) {
            // City scope: count only city posts in this city
            query = query.eq('location_city', locationCity).eq('scope', 'city');
          }
          break;
        case 'state':
          if (locationState) {
            // State scope: count city + state posts in this state
            query = query.eq('location_state', locationState).in('scope', ['city', 'state']);
          }
          break;
        case 'country':
          if (locationCountry) {
            // Country scope: count city + state + country posts in this country
            query = query.eq('location_country', locationCountry).in('scope', ['city', 'state', 'country']);
          }
          break;
        case 'world':
        default:
          // World scope: count all posts globally
          break;
      }

      const { count, error } = await query;

      if (error) {
        console.error('❌ Count query failed:', error);
        return 1; // Fallback to 1 to avoid division by zero
      }

      const result = Math.max(count || 1, 1); // Ensure at least 1
      
      // Cache the result for 2 minutes (counts change frequently)
      await cacheSet(countCacheKey, result, 120);
      console.log('✅ Total posts count cached');
      
      return result;
    } catch (error) {
      console.error('❌ Count query error:', error);
      return 1;
    }
  }

  /**
   * Calculate temporal analytics across different time periods
   */
  private async calculateTemporalAnalytics(
    contentHash: string,
    scope: string,
    locationCity?: string,
    locationState?: string,
    locationCountry?: string,
    currentEmbedding?: number[],
    hasNegation?: boolean
  ): Promise<any> {
    try {
      console.log('🔍 Calculating temporal analytics for:', contentHash);

      // Check cache first for temporal analytics
      const temporalCacheKey = CacheKeys.temporalAnalytics(contentHash, scope);
      const cachedTemporal = await cacheGet<any>(temporalCacheKey);
      if (cachedTemporal) {
        console.log('✅ Using cached temporal analytics');
        return cachedTemporal;
      }

      // Scope hierarchy will be applied to each query individually

      // Calculate today stats
      const todayStart = new Date();
      todayStart.setHours(0, 0, 0, 0);
      
      let todayQuery = this.supabase
        .from('posts')
        .select('id')
        .eq('moderation_status', 'approved')
        .gte('created_at', todayStart.toISOString());

      // Apply scope hierarchy to today query
      if (scope === 'city' && locationCity) {
        todayQuery = todayQuery.eq('location_city', locationCity).eq('scope', 'city');
      } else if (scope === 'state' && locationState) {
        todayQuery = todayQuery.eq('location_state', locationState).in('scope', ['city', 'state']);
      } else if (scope === 'country' && locationCountry) {
        todayQuery = todayQuery.eq('location_country', locationCountry).in('scope', ['city', 'state', 'country']);
      }
      // World scope: no additional filtering

      const { data: todayData, error: todayError } = await todayQuery;

      // Use semantic similarity for temporal matching (same as main system)
      const todayMatchingData = await this.findSimilarPostsInTimeframe(
        contentHash,
        todayStart.toISOString(),
        scope,
        locationCity,
        locationState,
        locationCountry,
        currentEmbedding,
        hasNegation
      );

      // Calculate week stats
      const weekStart = new Date();
      weekStart.setDate(weekStart.getDate() - 7);
      
      let weekQuery = this.supabase
        .from('posts')
        .select('id')
        .eq('moderation_status', 'approved')
        .gte('created_at', weekStart.toISOString());

      // Apply scope hierarchy to week query
      if (scope === 'city' && locationCity) {
        weekQuery = weekQuery.eq('location_city', locationCity).eq('scope', 'city');
      } else if (scope === 'state' && locationState) {
        weekQuery = weekQuery.eq('location_state', locationState).in('scope', ['city', 'state']);
      } else if (scope === 'country' && locationCountry) {
        weekQuery = weekQuery.eq('location_country', locationCountry).in('scope', ['city', 'state', 'country']);
      }
      // World scope: no additional filtering

      const { data: weekData, error: weekError } = await weekQuery;

      // Use semantic similarity for week matching
      const weekMatchingData = await this.findSimilarPostsInTimeframe(
        contentHash,
        weekStart.toISOString(),
        scope,
        locationCity,
        locationState,
        locationCountry,
        currentEmbedding,
        hasNegation
      );

      // Calculate month stats
      const monthStart = new Date();
      monthStart.setMonth(monthStart.getMonth() - 1);
      
      let monthQuery = this.supabase
        .from('posts')
        .select('id')
        .eq('moderation_status', 'approved')
        .gte('created_at', monthStart.toISOString());

      // Apply scope hierarchy to month query
      if (scope === 'city' && locationCity) {
        monthQuery = monthQuery.eq('location_city', locationCity).eq('scope', 'city');
      } else if (scope === 'state' && locationState) {
        monthQuery = monthQuery.eq('location_state', locationState).in('scope', ['city', 'state']);
      } else if (scope === 'country' && locationCountry) {
        monthQuery = monthQuery.eq('location_country', locationCountry).in('scope', ['city', 'state', 'country']);
      }
      // World scope: no additional filtering

      const { data: monthData, error: monthError } = await monthQuery;

      // Use semantic similarity for month matching
      const monthMatchingData = await this.findSimilarPostsInTimeframe(
        contentHash,
        monthStart.toISOString(),
        scope,
        locationCity,
        locationState,
        locationCountry,
        currentEmbedding,
        hasNegation
      );

      // Calculate percentiles and tiers
      // Add 1 to totals to account for the current post being created
      const todayTotal = (todayData?.length || 0) + 1;
      const todayMatching = (todayMatchingData?.length || 0) + 1; // Current post matches itself
      const todayPercentile = todayTotal > 0 ? (todayMatching / todayTotal) * 100 : 0;
      const todayTier = this.calculateTier(todayPercentile);

      const weekTotal = (weekData?.length || 0) + 1;
      const weekMatching = (weekMatchingData?.length || 0) + 1; // Current post matches itself
      const weekPercentile = weekTotal > 0 ? (weekMatching / weekTotal) * 100 : 0;
      const weekTier = this.calculateTier(weekPercentile);

      const monthTotal = (monthData?.length || 0) + 1;
      const monthMatching = (monthMatchingData?.length || 0) + 1; // Current post matches itself
      const monthPercentile = monthTotal > 0 ? (monthMatching / monthTotal) * 100 : 0;
      const monthTier = this.calculateTier(monthPercentile);

      const result = {
        today: {
          total: todayTotal,
          matching: todayMatching,
          percentile: Math.round(todayPercentile * 100) / 100,
          tier: todayTier,
          comparison: todayMatching <= 1 ? 'Only you!' : `${todayMatching} of ${todayTotal}`
        },
        week: {
          total: weekTotal,
          matching: weekMatching,
          percentile: Math.round(weekPercentile * 100) / 100,
          tier: weekTier,
          comparison: weekMatching <= 1 ? 'Only you!' : `${weekMatching} of ${weekTotal}`
        },
        month: {
          total: monthTotal,
          matching: monthMatching,
          percentile: Math.round(monthPercentile * 100) / 100,
          tier: monthTier,
          comparison: monthMatching <= 1 ? 'Only you!' : `${monthMatching} of ${monthTotal}`
        },
        year: {
          total: monthTotal, // Use month data for year (since we don't have year data yet)
          matching: monthMatching,
          percentile: Math.round(monthPercentile * 100) / 100,
          tier: monthTier,
          comparison: monthMatching <= 1 ? 'Only you!' : `${monthMatching} of ${monthTotal}`
        },
        allTime: {
          total: monthTotal, // Use month data for allTime (since we don't have allTime data yet)
          matching: monthMatching,
          percentile: Math.round(monthPercentile * 100) / 100,
          tier: monthTier,
          comparison: monthMatching <= 1 ? 'Only you!' : `${monthMatching} of ${monthTotal}`
        }
      };

      console.log('📊 Calculated temporal analytics:', result);
      
      // Cache the temporal analytics result
      await cacheSet(temporalCacheKey, result, CacheTTL.TEMPORAL_ANALYTICS);
      console.log('✅ Temporal analytics cached');
      
      return result;
    } catch (error) {
      console.error('❌ Temporal analytics error:', error);
      return {
        today: { total: 1, matching: 1, percentile: 0, tier: 'elite' },
        week: { total: 1, matching: 1, percentile: 0, tier: 'elite' },
        month: { total: 1, matching: 1, percentile: 0, tier: 'elite' }
      };
    }
  }

  /**
   * Calculate tier based on percentile
   */
  private calculateTier(percentile: number): string {
    if (percentile >= 95) return 'elite';
    if (percentile >= 80) return 'rare';
    if (percentile >= 60) return 'unique';
    if (percentile >= 40) return 'notable';
    if (percentile >= 20) return 'beloved';
    return 'popular';
  }

  /**
   * Find similar posts within a specific timeframe using semantic similarity
   */
  private async findSimilarPostsInTimeframe(
    contentHash: string,
    timeStart: string,
    scope: string,
    locationCity?: string,
    locationState?: string,
    locationCountry?: string,
    currentEmbedding?: number[],
    hasNegation?: boolean
  ): Promise<any[]> {
    try {
      // Use the passed embedding if available, otherwise fallback to exact matching
      if (!currentEmbedding) {
        console.log('⚠️ No embedding provided, using exact matching');
        // Fallback to exact content hash matching
        const { data, error } = await this.supabase
          .from('posts')
          .select('id')
          .eq('content_hash', contentHash)
          .eq('moderation_status', 'approved')
          .gte('created_at', timeStart);
        return data || [];
      }

      // Use semantic similarity with the same threshold as main system
      const { data, error } = await this.supabase.rpc('match_posts_by_embedding', {
        filter_city: locationCity,
        filter_country: locationCountry,
        filter_state: locationState,
        match_limit: 100,
        match_threshold: 0.70, // Same threshold as main system
        query_embedding: currentEmbedding,
        query_has_negation: hasNegation || false,
        scope_filter: scope,
        today_only: false
      });

      if (error) {
        console.error('❌ Temporal semantic search failed:', error);
        // Fallback to exact matching
        const { data: fallbackData, error: fallbackErr } = await this.supabase
          .from('posts')
          .select('id')
          .eq('content_hash', contentHash)
          .eq('moderation_status', 'approved')
          .gte('created_at', timeStart);
        return fallbackData || [];
      }

      // Filter results to only include posts within the timeframe
      const filteredData = (data || []).filter((post: any) => 
        new Date(post.created_at) >= new Date(timeStart)
      );

      return filteredData;
    } catch (error) {
      console.error('❌ Temporal similarity search error:', error);
      // Fallback to exact matching
      const { data, error: catchError } = await this.supabase
        .from('posts')
        .select('id')
        .eq('content_hash', contentHash)
        .eq('moderation_status', 'approved')
        .gte('created_at', timeStart);
      return data || [];
    }
  }

  /**
   * Update temporal uniqueness table
   */
  private async updateTemporalUniqueness(
    postId: string,
    contentHash: string,
    temporalAnalytics: any
  ): Promise<void> {
    try {
      const temporalData = {
        post_id: postId,
        content_hash: contentHash,
        today_total: temporalAnalytics.today.total,
        today_unique: temporalAnalytics.today.matching,
        today_percentile: temporalAnalytics.today.percentile,
        this_week_total: temporalAnalytics.week.total,
        this_week_unique: temporalAnalytics.week.matching,
        this_week_percentile: temporalAnalytics.week.percentile,
        this_month_total: temporalAnalytics.month.total,
        this_month_unique: temporalAnalytics.month.matching,
        this_month_percentile: temporalAnalytics.month.percentile
      };

      await this.supabase
        .from('temporal_uniqueness')
        .insert(temporalData);
    } catch (error) {
      console.error('❌ Temporal uniqueness update failed:', error);
      // Non-critical error, don't fail the whole operation
    }
  }

  /**
   * Generate content hash for fast lookup
   */
  private generateContentHash(content: string): string {
    // Normalize: lowercase, remove special chars, extract key words
    const normalized = content
      .toLowerCase()
      .replace(/[^a-zA-Z0-9\s]/g, '')
      .replace(/\s+/g, ':')
      .substring(0, 100);
    
    return normalized;
  }

  /**
   * Detect negation in content
   */
  private detectNegation(content: string): boolean {
    const negationWords = [
      'not', 'no', 'never', 'none', 'nothing', 'nobody', 'nowhere',
      'neither', 'nor', 'cannot', "can't", "don't", "doesn't", "didn't",
      "won't", "wouldn't", "shouldn't", "couldn't", "haven't", "hasn't",
      "hadn't", "isn't", "aren't", "wasn't", "weren't"
    ];

    const lowerContent = content.toLowerCase();
    return negationWords.some(word => lowerContent.includes(word));
  }

  /**
   * Normalize text for analysis
   */
  private normalizeText(text: string): string {
    return text
      .toLowerCase()
      .trim()
      .replace(/\s+/g, ' ')
      .replace(/[^\w\s.,!?-]/g, '')
      .substring(0, 500);
  }

  /**
   * Extract time tags from content
   */
  private extractTimeTags(content: string): string[] {
    const timePatterns = [
      /\b(?:morning|afternoon|evening|night|dawn|dusk)\b/g,
      /\b(?:today|yesterday|tomorrow|this week|last week|next week)\b/g,
      /\b(?:monday|tuesday|wednesday|thursday|friday|saturday|sunday)\b/g,
      /\b(?:january|february|march|april|may|june|july|august|september|october|november|december)\b/g,
      /\b(?:am|pm|o'clock|hour|minute|second)\b/g
    ];

    const timeTags: string[] = [];
    const lowerContent = content.toLowerCase();

    for (const pattern of timePatterns) {
      let match;
      while ((match = pattern.exec(lowerContent)) !== null) {
        timeTags.push(match[0]);
      }
    }

    return [...new Set(timeTags)]; // Remove duplicates
  }

  /**
   * Extract emojis from content
   */
  private extractEmojis(content: string): string[] {
    const emojiRegex = /[\u{1F600}-\u{1F64F}]|[\u{1F300}-\u{1F5FF}]|[\u{1F680}-\u{1F6FF}]|[\u{1F1E0}-\u{1F1FF}]|[\u{2600}-\u{26FF}]|[\u{2700}-\u{27BF}]/gu;
    const emojis = content.match(emojiRegex) || [];
    return [...new Set(emojis)]; // Remove duplicates
  }
}
