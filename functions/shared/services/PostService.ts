/**
 * Post Service
 * Core business logic for post creation, matching, and uniqueness calculation
 * 
 * Performance optimized:
 * - Lazy embedding generation (only if needed)
 * - Efficient vector search with HNSW index
 * - Analytics tracking built-in
 */

import type { SupabaseClient } from 'https://esm.sh/@supabase/supabase-js@2';
import type { CreatePostRequest, CreatePostResponse, VectorMatch } from '../types/api.types';
import type { Post, TierType } from '../types/database.types';
import { HuggingFaceEmbeddingService } from './HuggingFaceEmbeddingService';
import { OpenAIEmbeddingService } from './OpenAIEmbeddingService';
import { TemporalAnalyticsService } from './TemporalAnalyticsService';
import { Logger } from '../utils/logger';
import { PerformanceTracker } from '../utils/performance';

export class PostService {
  constructor(private supabase: SupabaseClient) {}

  /**
   * Create a new post with uniqueness matching
   */
  async create(request: CreatePostRequest, userId?: string): Promise<CreatePostResponse> {
    const mainTracker = new PerformanceTracker('post_create', {
      userId,
      scope: request.scope,
      inputType: request.inputType
    });

    try {
      // 1. Generate content hash for fast lookup
      const contentHash = this.generateContentHash(request.content);
      
      // 2. Generate vector embedding
      // Priority: HuggingFace (FREE) → OpenAI (if HF fails or key available)
      const embeddingTracker = new PerformanceTracker('embedding');
      let embedding: number[];
      
      const hfKey = typeof Deno !== 'undefined' ? Deno.env.get('HUGGINGFACE_API_KEY') : undefined;
      const openaiKey = typeof Deno !== 'undefined' ? Deno.env.get('OPENAI_API_KEY') : undefined;
      
      try {
        if (hfKey) {
          Logger.info('Using HuggingFace embeddings (FREE)');
          embedding = await HuggingFaceEmbeddingService.generate(request.content);
        } else if (openaiKey) {
          Logger.info('Using OpenAI embeddings');
          embedding = await OpenAIEmbeddingService.generate(request.content);
        } else {
          throw new Error('No embedding service configured (HUGGINGFACE_API_KEY or OPENAI_API_KEY required)');
        }
      } catch (error) {
        // Fallback: Try OpenAI if HuggingFace fails
        if (hfKey && openaiKey) {
          Logger.warn('HuggingFace failed, falling back to OpenAI', { error });
          embedding = await OpenAIEmbeddingService.generate(request.content);
        } else {
          throw error;
        }
      }
      
      const embeddingTime = embeddingTracker.end();

      // 3. Find similar posts using vector search
      const searchTracker = new PerformanceTracker('vector_search');
      const matches = await this.findSimilarPosts(
        embedding,
        request.scope,
        request.location
      );
      const searchTime = searchTracker.end();

      // 4. Calculate uniqueness percentile
      const percentileData = await this.calculatePercentile(
        matches.length,
        request.scope,
        request.location
      );

      // 5. Insert post into database
      const { data: post, error } = await this.supabase
        .from('posts')
        .insert({
          content: request.content,
          input_type: request.inputType,
          user_id: userId,
          is_anonymous: request.isAnonymous ?? false,
          scope: request.scope,
          location_city: request.location?.city,
          location_state: request.location?.state,
          location_country: request.location?.country,
          content_hash: contentHash,
          embedding: embedding,
          match_count: matches.length,
          percentile: percentileData.percentile,
          tier: percentileData.tier,
        })
        .select()
        .single();

      if (error) {
        Logger.error('Failed to insert post', { error, userId });
        throw new Error('Post creation failed');
      }

      // 6. Update user streak (async, don't wait)
      if (userId) {
        this.updateUserStreak(userId).catch(err => 
          Logger.warn('Streak update failed', { error: err, userId })
        );
      }

      // 6. Get temporal analytics
      const temporalService = new TemporalAnalyticsService(this.supabase);
      const temporalData = await temporalService.getTemporalAnalytics(
        request.content,
        request.scope,
        userId!,
        matches.length
      );

      // 7. Track analytics event
      this.trackPostCreatedEvent(post, percentileData);

      const processingTime = mainTracker.end({
        postId: post.id,
        tier: percentileData.tier,
        matchCount: matches.length
      });

      return {
        success: true,
        post: {
          id: post.id,
          content: post.content,
          tier: percentileData.tier,
          percentile: percentileData.percentile,
          displayText: percentileData.displayText,
          matchCount: matches.length,
          createdAt: post.created_at,
        },
        analytics: {
          processingTime,
          embeddingTime,
          searchTime,
        },
        temporal: temporalData,
        matchCount: matches.length,
        displayText: percentileData.displayText,
      };
    } catch (error) {
      mainTracker.error(error);
      throw error;
    }
  }

  /**
   * Find similar posts using vector search
   */
  private async findSimilarPosts(
    embedding: number[],
    scope: string,
    location?: { city?: string; state?: string; country?: string }
  ): Promise<VectorMatch[]> {
    const { data, error} = await this.supabase.rpc('match_posts_by_embedding', {
      query_embedding: embedding,
      match_threshold: 0.85, // Lowered for better matching (87.7% similarity found in tests)
      match_limit: 100,
      scope_filter: scope,
      filter_city: location?.city || null,
      filter_state: location?.state || null,
      filter_country: location?.country || null,
      today_only: true,
    });

    if (error) {
      Logger.error('Vector search failed', { error });
      return [];
    }

    return data || [];
  }

  /**
   * Calculate percentile and tier based on match count
   */
  private async calculatePercentile(
    matchCount: number,
    scope: string,
    location?: { city?: string; state?: string; country?: string }
  ): Promise<{ percentile: number; tier: TierType; displayText: string }> {
    // Get total posts in scope for accurate percentile
    let query = this.supabase
      .from('posts')
      .select('id', { count: 'exact', head: true })
      .gte('created_at', new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString());

    // Apply scope filters
    if (scope === 'city' && location?.city) {
      query = query.eq('location_city', location.city);
    } else if (scope === 'state' && location?.state) {
      query = query.eq('location_state', location.state);
    } else if (scope === 'country' && location?.country) {
      query = query.eq('location_country', location.country);
    }

    const { count } = await query;
    const totalPosts = count || 100; // Default to 100 if no posts yet

    // Calculate percentile
    const percentile = (matchCount / totalPosts) * 100;

    // Determine tier
    let tier: TierType;
    let displayText: string;

    if (percentile <= 1) {
      tier = 'elite';
      displayText = 'Top 1%';
    } else if (percentile <= 5) {
      tier = 'rare';
      displayText = 'Top 5%';
    } else if (percentile <= 15) {
      tier = 'unique';
      displayText = 'Top 15%';
    } else if (percentile <= 30) {
      tier = 'notable';
      displayText = 'Top 30%';
    } else if (percentile <= 60) {
      tier = 'popular';
      displayText = 'Top 60%';
    } else {
      tier = 'common';
      displayText = 'Common';
    }

    return { percentile, tier, displayText };
  }

  /**
   * Generate content hash for fast lookups
   */
  private generateContentHash(content: string): string {
    // Normalize: lowercase, remove special chars, extract key words
    const normalized = content
      .toLowerCase()
      .replace(/[^a-z0-9\s]/g, '')
      .split(/\s+/)
      .filter(word => word.length > 2) // Remove short words
      .slice(0, 5) // Take first 5 words
      .join(':');

    return normalized || 'unknown';
  }

  /**
   * Update user streak (called after post creation)
   */
  private async updateUserStreak(userId: string): Promise<void> {
    try {
      const today = new Date().toISOString().split('T')[0];

      // Get current streak
      const { data: streak } = await this.supabase
        .from('user_streaks')
        .select('*')
        .eq('user_id', userId)
        .single();

      const lastPostDate = streak?.last_post_date;
      const currentStreak = streak?.current_streak || 0;
      const longestStreak = streak?.longest_streak || 0;

      let newStreak = 1;

      if (lastPostDate) {
        const lastDate = new Date(lastPostDate);
        const todayDate = new Date(today);
        const diffDays = Math.floor((todayDate.getTime() - lastDate.getTime()) / (1000 * 60 * 60 * 24));

        if (diffDays === 0) {
          // Posted today already, don't increment
          return;
        } else if (diffDays === 1) {
          // Consecutive day, increment streak
          newStreak = currentStreak + 1;
        } else {
          // Streak broken, restart at 1
          newStreak = 1;
        }
      }

      // Update or insert streak
      await this.supabase
        .from('user_streaks')
        .upsert({
          user_id: userId,
          current_streak: newStreak,
          longest_streak: Math.max(newStreak, longestStreak),
          last_post_date: today,
          total_posts: (streak?.total_posts || 0) + 1,
        });

      // Send notification if milestone
      if (newStreak % 7 === 0 && newStreak > 0) {
        await this.sendStreakMilestoneNotification(userId, newStreak);
      }
    } catch (error) {
      Logger.error('Streak update failed', { error, userId });
      // Don't throw - streak is nice-to-have, not critical
    }
  }

  /**
   * Send streak milestone notification
   */
  private async sendStreakMilestoneNotification(userId: string, streak: number): Promise<void> {
    await this.supabase
      .from('notifications')
      .insert({
        user_id: userId,
        type: 'achievement',
        title: `${streak}-Day Streak!`,
        message: `Incredible! You've posted ${streak} days in a row. Keep going!`,
        data: { type: 'streak_milestone', streak },
      });
  }

  /**
   * Track post created event for analytics
   */
  private trackPostCreatedEvent(post: Post, percentile: any): void {
    // Fire-and-forget analytics event
    this.supabase
      .from('events')
      .insert({
        user_id: post.user_id,
        event_type: 'post_created',
        event_data: {
          post_id: post.id,
          input_type: post.input_type,
          scope: post.scope,
          tier: percentile.tier,
          percentile: percentile.percentile,
          match_count: post.match_count,
          content_length: post.content.length,
        },
        platform: 'mobile', // Can be detected from request headers
      })
      .then(() => {
        Logger.debug('Analytics event tracked', { postId: post.id });
      })
      .catch(err => {
        Logger.warn('Analytics tracking failed', { error: err });
      });
  }

  /**
   * Increment view count (for future analytics)
   */
  async incrementViewCount(postId: string): Promise<void> {
    // Get current count and increment
    const { data: post } = await this.supabase
      .from('posts')
      .select('view_count')
      .eq('id', postId)
      .single();
    
    if (post) {
      await this.supabase
        .from('posts')
        .update({ view_count: (post.view_count || 0) + 1 })
        .eq('id', postId);
    }
  }

  /**
   * Increment share count
   */
  async incrementShareCount(postId: string): Promise<void> {
    // Get current count and increment
    const { data: post } = await this.supabase
      .from('posts')
      .select('share_count')
      .eq('id', postId)
      .single();
    
    if (post) {
      await this.supabase
        .from('posts')
        .update({ share_count: (post.share_count || 0) + 1 })
        .eq('id', postId);
    }
  }
}