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
    try {
      console.log(`🚀 Creating ${request.inputType} post: "${request.content.substring(0, 50)}..."`);

      // 1. Content Moderation
      console.log('🛡️ Running content moderation...');
      const moderationResult = await this.moderationPipeline.moderateContent(
        request.content,
        'post',
        { inputType: request.inputType, scope: request.scope }
      );
      
      if (!moderationResult.approved) {
        return {
          success: false,
          error: `Content rejected: ${moderationResult.flags.join(', ')}`
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
        hasNegation
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

      const percentileResult = this.percentileService.calculatePercentile(
        matchCount,
        totalPostsInScope
      );

      // 8. Calculate temporal analytics
      console.log('⏰ Calculating temporal analytics...');
      const temporalAnalytics = await this.calculateTemporalAnalytics(
        contentHash,
        request.scope,
        request.locationCity,
        request.locationState,
        request.locationCountry
      );

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
        moderation_score: moderationResult.score,
        moderation_flags: moderationResult.flags,
        moderation_details: {
          toxicity: moderationResult.details.toxicity,
          spam: moderationResult.details.spam,
          inappropriate: moderationResult.details.inappropriate
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
      await this.updateTemporalUniqueness(post.id, contentHash, temporalAnalytics);

      console.log('✅ Post created successfully!');

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
   * Find similar posts using vector similarity search
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
      const { data, error } = await this.supabase.rpc('match_posts_by_embedding', {
        query_embedding: embedding,
        match_threshold: 0.90, // High threshold for semantic similarity
        match_limit: 100,
        scope_filter: scope,
        filter_city: locationCity,
        filter_state: locationState,
        filter_country: locationCountry,
        today_only: true,
        query_has_negation: hasNegation
      });

      if (error) {
        console.error('❌ Vector search failed:', error);
        return [];
      }

      return data || [];
    } catch (error) {
      console.error('❌ Vector search error:', error);
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
        .eq('moderation_status', 'approved')
        .gte('created_at', new Date().toISOString().split('T')[0]); // Today only

      // Apply scope filtering
      switch (scope) {
        case 'city':
          if (locationCity) {
            query = query.eq('location_city', locationCity).eq('scope', 'city');
          }
          break;
        case 'state':
          if (locationState) {
            query = query.eq('location_state', locationState).in('scope', ['city', 'state']);
          }
          break;
        case 'country':
          if (locationCountry) {
            query = query.eq('location_country', locationCountry).in('scope', ['city', 'state', 'country']);
          }
          break;
        case 'world':
        default:
          // No additional filtering for world scope
          break;
      }

      const { count, error } = await query;

      if (error) {
        console.error('❌ Count query failed:', error);
        return 1; // Fallback to 1 to avoid division by zero
      }

      return Math.max(count || 1, 1); // Ensure at least 1
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
    locationCountry?: string
  ): Promise<any> {
    try {
      const { data, error } = await this.supabase.rpc('calculate_temporal_uniqueness', {
        content_hash_param: contentHash,
        scope_param: scope,
        location_city_param: locationCity,
        location_state_param: locationState,
        location_country_param: locationCountry
      });

      if (error) {
        console.error('❌ Temporal analytics failed:', error);
        return {
          today: { total: 1, matching: 1, percentile: 0, tier: 'elite' },
          week: { total: 1, matching: 1, percentile: 0, tier: 'elite' },
          month: { total: 1, matching: 1, percentile: 0, tier: 'elite' }
        };
      }

      const result: any = {
        today: { total: 1, matching: 1, percentile: 0, tier: 'elite' },
        week: { total: 1, matching: 1, percentile: 0, tier: 'elite' },
        month: { total: 1, matching: 1, percentile: 0, tier: 'elite' }
      };

      // Process the results
      for (const row of data || []) {
        if (row.time_period === 'today') {
          result.today = {
            total: row.total_posts,
            matching: row.matching_posts,
            percentile: row.percentile,
            tier: row.tier
          };
        } else if (row.time_period === 'week') {
          result.week = {
            total: row.total_posts,
            matching: row.matching_posts,
            percentile: row.percentile,
            tier: row.tier
          };
        } else if (row.time_period === 'month') {
          result.month = {
            total: row.total_posts,
            matching: row.matching_posts,
            percentile: row.percentile,
            tier: row.tier
          };
        }
      }

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
