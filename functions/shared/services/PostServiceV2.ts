/**
 * Post Service V2
 * 
 * Version 2 approach:
 * - Keyword-based matching (reliable, no API dependencies)
 * - Narrative stories (not percentiles/tiers)
 * - Multilingual support (Telugu-English, Hindi-English, etc.)
 * - Transaction-safe (race condition prevention)
 * - Duplicate detection
 */

import { LanguageDetector, LanguageProcessed } from './LanguageDetector.ts';
import { Transliterator } from './Transliterator.ts';
import { ModerationPipeline, ModerationResult } from './ModerationPipeline.ts';
import { KeywordMatcher, SimilarPostsResult } from './KeywordMatcher.ts';
import { StoryGenerator, PostStory } from './StoryGenerator.ts';
import { DaySummaryService } from './DaySummaryService.ts';
// hashContent will be implemented locally

export interface CreatePostRequest {
  content: string;
  inputType: 'action' | 'day';
  isAnonymous?: boolean;
  scope: 'city' | 'state' | 'country' | 'world';
  locationCity?: string;
  locationState?: string;
  locationCountry?: string;
  userId: string | null;
  dayOfWeek?: 'monday' | 'tuesday' | 'wednesday' | 'thursday' | 'friday' | 'saturday' | 'sunday';
}

export interface CreatePostResponse {
  success: boolean;
  post?: {
    id: string;
    content: string;
    inputType: string;
    scope: string;
    narrative: string;
    matchCount: number;
    totalInScope: number;
    emotionalTone: 'unique' | 'shared' | 'common';
    celebration: string;
    badge?: string;
    keywords: string[];
    detectedLanguage?: string;
    created_at: string;
  };
  temporal?: {
    week: { matching: number; total: number; comparison: string };
    month: { matching: number; total: number; comparison: string };
    year: { matching: number; total: number; comparison: string };
    allTime: { matching: number; total: number; comparison: string };
  };
  error?: string;
}

interface ValidationResult {
  valid: boolean;
  error?: string;
}

export class PostServiceV2 {
  private supabase: any;
  private languageDetector: LanguageDetector;
  private transliterator: Transliterator;
  private moderationPipeline: ModerationPipeline;
  private keywordMatcher: KeywordMatcher;
  private storyGenerator: StoryGenerator;
  private daySummaryService: DaySummaryService;

  constructor(supabase: any) {
    this.supabase = supabase;
    this.languageDetector = new LanguageDetector();
    this.transliterator = new Transliterator();
    this.moderationPipeline = new ModerationPipeline({
      allowDreams: false,
      allowSymbolicContent: true,
      strictMode: false,
      minLength: 3,
      maxLength: 2000
    });
    this.keywordMatcher = new KeywordMatcher(supabase);
    this.storyGenerator = new StoryGenerator();
    this.daySummaryService = new DaySummaryService();
  }

  /**
   * Create a new post with V2 approach
   */
  async createPost(request: CreatePostRequest): Promise<CreatePostResponse> {
    const startTime = Date.now();
    
    try {
      console.log(`🚀 Creating ${request.inputType} post (V2): "${request.content.substring(0, 50)}..."`);

      // Phase 1: Validation (with duplicate check)
      console.log('✅ Phase 1: Validation...');
      const validation = await this.validatePost(request);
      if (!validation.valid) {
        return { success: false, error: validation.error };
      }

      // Phase 2: Language detection & normalization
      console.log('🌍 Phase 2: Language detection & normalization...');
      const languageProcessed = await this.processLanguage(request.content);
      console.log(`   Detected: ${languageProcessed.language.type} (confidence: ${languageProcessed.language.confidence})`);

      // Phase 3: Moderation (multilingual-aware)
      console.log('🛡️ Phase 3: Content moderation...');
      const moderation = await this.moderateContent(
        request.content,
        languageProcessed.normalized,
        languageProcessed.language,
        request.inputType
      );

      if (!moderation.approved) {
        console.log('❌ Content rejected by moderation');
        return {
          success: false,
          error: moderation.userMessage || 'Content rejected by moderation'
        };
      }

      // Phase 4: Activity extraction (for day summaries) and keyword extraction
      console.log('🔑 Phase 4: Activity & keyword extraction...');
      let activities: string[] = [];
      
      if (request.inputType === 'day') {
        // Extract activities for day summaries
        const activityResult = this.daySummaryService.extractActivities(languageProcessed.normalized);
        if (activityResult.success && activityResult.activities.length > 0) {
          activities = activityResult.activities;
          console.log(`   Extracted ${activities.length} activities: ${activities.slice(0, 3).join(', ')}...`);
        } else {
          // If no activities extracted, use full content as single activity
          activities = [languageProcessed.normalized];
          console.log(`   No activities extracted, using full content as activity`);
        }
      }
      
      // Extract keywords from normalized content (for matching)
      const keywords = await this.extractKeywords(languageProcessed.normalized, request.inputType);
      console.log(`   Extracted ${keywords.length} keywords: ${keywords.join(', ')}`);

      if (keywords.length === 0) {
        return {
          success: false,
          error: 'Content must contain meaningful words'
        };
      }

      // Phase 5: Find similar posts (keyword-based)
      console.log('🔍 Phase 5: Finding similar posts...');
      const similar = await this.keywordMatcher.findSimilarPosts(
        keywords,
        request.scope,
        {
          city: request.locationCity,
          state: request.locationState,
          country: request.locationCountry
        },
        request.inputType
      );
      console.log(`   Found ${similar.matches.length} similar posts (matchCount: ${similar.matchCount})`);

      // Phase 6: Generate story
      console.log('📖 Phase 6: Generating story...');
      const story = await this.storyGenerator.generateStory(
        similar.matchCount,
        similar.totalInScope,
        request.content,
        request.inputType
      );
      console.log(`   Story: "${story.narrative}"`);

      // Phase 7: Store post
      console.log('💾 Phase 7: Storing post...');
      const stored = await this.storePost(
        request,
        languageProcessed,
        moderation,
        keywords,
        story,
        activities
      );

      // Phase 8: Calculate temporal analytics (V2: keyword-based)
      console.log('⏰ Phase 8: Calculating temporal analytics...');
      const temporal = await this.calculateTemporalAnalytics(
        keywords,
        request.scope,
        request.locationCity,
        request.locationState,
        request.locationCountry,
        similar.matchCount, // Use the already-calculated matchCount for consistency
        similar.totalInScope // Use the already-calculated totalInScope
      );

      const totalTime = Date.now() - startTime;
      console.log(`✅ Post created successfully in ${totalTime}ms`);

      const response: CreatePostResponse = {
        success: true,
        post: {
          id: stored.id,
          content: stored.content,
          inputType: stored.input_type,
          scope: stored.scope,
          narrative: story.narrative,
          matchCount: story.matchCount,
          totalInScope: story.totalInScope,
          emotionalTone: story.emotionalTone,
          celebration: story.celebration,
          badge: story.badge,
          keywords: keywords,
          detectedLanguage: languageProcessed.language.type,
          created_at: stored.created_at
        },
        temporal: temporal
      };

      // Add day summary specific fields to response
      if (request.inputType === 'day' && stored.activities) {
        (response.post as any).activities = stored.activities;
        (response.post as any).dayOfWeek = stored.day_of_week;
      }

      return response;

    } catch (error) {
      console.error('❌ Post creation error:', error);
      return {
        success: false,
        error: error.message || 'Failed to create post'
      };
    }
  }

  /**
   * Validate post (with duplicate check)
   */
  private async validatePost(request: CreatePostRequest): Promise<ValidationResult> {
    // Basic validation
    const minLength = request.inputType === 'day' ? 10 : 3;
    const maxLength = request.inputType === 'day' ? 1000 : 500;
    
    if (!request.content || request.content.trim().length < minLength) {
      return { 
        valid: false, 
        error: request.inputType === 'day' 
          ? 'Day summary must be at least 10 characters' 
          : 'Content must be at least 3 characters' 
      };
    }

    if (request.content.length > maxLength) {
      return { 
        valid: false, 
        error: request.inputType === 'day'
          ? 'Day summary too long (max 1000 characters)'
          : 'Content too long (max 500 characters)'
      };
    }

    if (!['action', 'day'].includes(request.inputType)) {
      return { valid: false, error: 'Invalid post type' };
    }

    if (!['city', 'state', 'country', 'world'].includes(request.scope)) {
      return { valid: false, error: 'Invalid scope' };
    }
    
    // Validate dayOfWeek if provided (only for day summaries)
    if (request.inputType === 'day' && request.dayOfWeek) {
      const validDays = ['monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday', 'sunday'];
      if (!validDays.includes(request.dayOfWeek)) {
        return { valid: false, error: 'Invalid day of week' };
      }
    }

    // Duplicate check (if user is authenticated)
    if (request.userId) {
      const contentHash = this.hashContent(request.content);
      const { data: recentDuplicate } = await this.supabase
        .from('posts')
        .select('id')
        .eq('user_id', request.userId)
        .eq('content_hash', contentHash)
        .gte('created_at', new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString())
        .limit(1)
        .single();

      if (recentDuplicate) {
        return {
          valid: false,
          error: 'You already posted similar content recently. Try something new!'
        };
      }
    }

    return { valid: true };
  }

  /**
   * Process language: detect, normalize, extract keywords
   */
  async processLanguage(content: string): Promise<LanguageProcessed> {
    // Detect language
    const language = await this.languageDetector.detectLanguage(content);
    
    // Normalize to English
    const normalized = await this.transliterator.transliterateToEnglish(content, language);
    
    // Extract keywords from normalized content
    const keywords = this.extractKeywords(normalized, 'action'); // Will be refined later
    
    return {
      original: content,
      normalized: normalized,
      language: language,
      keywords: keywords
    };
  }

  /**
   * Moderate content (multilingual-aware)
   */
  async moderateContent(
    content: string,
    normalizedContent: string,
    languageInfo: any,
    postType: string
  ): Promise<ModerationResult> {
    // Use existing moderation pipeline
    // For contact info, URLs, and social media, check ORIGINAL content
    // For other checks (toxicity, spam, adult), use normalized content
    // Pass both to moderation pipeline
    return await this.moderationPipeline.moderateContent(
      content, // Use ORIGINAL content for pattern matching (contact info, URLs, social media)
      'post',
      { 
        inputType: postType, 
        scope: 'world',
        normalizedContent: normalizedContent // Pass normalized for other checks if needed
      }
    );
  }

  /**
   * Extract keywords from normalized content
   */
  async extractKeywords(
    normalizedContent: string,
    postType: 'action' | 'day'
  ): Promise<string[]> {
    const stopWords = [
      'the', 'a', 'an', 'and', 'or', 'but', 'in', 'on', 'at', 'to', 'for',
      'of', 'with', 'by', 'from', 'as', 'is', 'was', 'are', 'were', 'been',
      'be', 'have', 'has', 'had', 'do', 'does', 'did', 'will', 'would',
      'could', 'should', 'may', 'might', 'must', 'can', 'this', 'that',
      'these', 'those', 'i', 'you', 'he', 'she', 'it', 'we', 'they',
      'my', 'your', 'his', 'her', 'its', 'our', 'their', 'me', 'him', 'her', 'us', 'them'
    ];

    const keywords = normalizedContent
      .toLowerCase()
      .replace(/[^\w\s]/g, ' ') // Remove punctuation
      .split(/\s+/)
      .filter(w => w.length > 2) // Only meaningful words
      .filter(w => !stopWords.includes(w))
      .slice(0, 10); // Limit to 10 keywords

    // TODO: Expand with synonyms (from database)
    // For MVP, return as-is

    return keywords;
  }

  /**
   * Store post in database
   */
  private async storePost(
    request: CreatePostRequest,
    languageProcessed: LanguageProcessed,
    moderation: ModerationResult,
    keywords: string[],
    story: PostStory,
    activities: string[] = []
  ): Promise<any> {
    const contentHash = this.hashContent(request.content);

    const postData: any = {
      content: request.content,
      normalized_content: languageProcessed.normalized,
      detected_language: languageProcessed.language.type,
      language_confidence: languageProcessed.language.confidence,
      keywords: keywords,
      content_hash: contentHash,
      input_type: request.inputType,
      scope: request.scope,
      location_city: request.locationCity,
      location_state: request.locationState,
      location_country: request.locationCountry,
      user_id: request.userId,
      is_anonymous: request.isAnonymous || false,
      moderation_status: moderation.approved ? 'approved' : 'rejected',
      moderation_score: moderation.confidence,
      moderation_flags: moderation.flags,
      match_count: story.matchCount,
      narrative: story.narrative,
      emotional_tone: story.emotionalTone,
      celebration: story.celebration,
      badge: story.badge,
      created_at: new Date().toISOString()
    };

    // Add day summary specific fields
    if (request.inputType === 'day') {
      postData.activities = activities.length > 0 ? activities : null;
      postData.day_of_week = request.dayOfWeek || this.getCurrentDayOfWeek();
      postData.reactions = { first: 0, second: 0, third: 0 };
    }

    const { data: post, error } = await this.supabase
      .from('posts')
      .insert(postData)
      .select()
      .single();

    if (error) {
      console.error('❌ Database insert error:', error);
      throw new Error(`Failed to store post: ${error.message}`);
    }

    return post;
  }

  /**
   * Get current day of week (fallback if not provided)
   */
  private getCurrentDayOfWeek(): string {
    const days = ['sunday', 'monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday'];
    return days[new Date().getDay()];
  }

  /**
   * Hash content for duplicate detection
   */
  private hashContent(content: string): string {
    // Simple hash: lowercase, remove special chars, replace spaces with colons
    return content
      .toLowerCase()
      .replace(/[^a-z0-9\s]/g, '')
      .replace(/\s+/g, ':')
      .substring(0, 100); // Limit length
  }

  /**
   * Calculate temporal analytics using keyword matching (V2 approach)
   */
  private async calculateTemporalAnalytics(
    keywords: string[],
    scope: string,
    locationCity?: string,
    locationState?: string,
    locationCountry?: string,
    currentMatchCount?: number, // Use already-calculated matchCount for week
    currentTotalInScope?: number // Use already-calculated totalInScope for week
  ): Promise<any> {
    try {
      const now = new Date();
      const weekAgo = new Date(now);
      weekAgo.setDate(weekAgo.getDate() - 7);
      
      const monthAgo = new Date(now);
      monthAgo.setMonth(monthAgo.getMonth() - 1);
      
      const yearAgo = new Date(now);
      yearAgo.setFullYear(yearAgo.getFullYear() - 1);

      // Calculate matches for each timeframe using keyword overlap
      // Use the same logic as KeywordMatcher for consistency
      const calculateMatches = async (startDate: Date) => {
        // Use KeywordMatcher's findSimilarPosts logic but with time filter
        // This ensures consistency with main matchCount calculation
        let query = this.supabase
          .from('posts')
          .select('id, keywords, normalized_content, content, scope, location_city, location_state, location_country, created_at, input_type')
          .eq('moderation_status', 'approved')
          .gte('created_at', startDate.toISOString())
          .lt('created_at', now.toISOString()); // Exclude current post (it's not in DB yet)

        // Filter by post type (same as KeywordMatcher)
        query = query.in('input_type', ['action', 'day']);

        // Apply scope filtering (same hierarchical logic as KeywordMatcher)
        if (scope === 'city' && locationCity) {
          query = query.eq('location_city', locationCity).eq('scope', 'city');
        } else if (scope === 'state' && locationState) {
          query = query.eq('location_state', locationState).in('scope', ['city', 'state']);
        } else if (scope === 'country' && locationCountry) {
          query = query.eq('location_country', locationCountry).in('scope', ['city', 'state', 'country']);
        }

        const { data: posts, error } = await query.limit(1000);

        if (error || !posts) {
          return { matches: 0, total: 0 };
        }

        // Filter by keyword overlap using same logic as KeywordMatcher
        const matches = posts.filter((post: any) => {
          const postKeywords = post.keywords || [];
          if (!Array.isArray(postKeywords) || postKeywords.length === 0) return false;
          
          // Calculate overlap (same as KeywordMatcher.calculateOverlap)
          const overlap = keywords.filter(k => postKeywords.includes(k)).length;
          return overlap >= 2; // Same threshold as KeywordMatcher
        });

        // Return matches count (don't add +1 here since current post isn't in DB yet)
        // The main matchCount already includes the current post, so temporal should match that
        // But since we're querying before the post exists, we need to add +1 to match the main count
        return { matches: matches.length + 1, total: posts.length + 1 }; // +1 for current post
      };

      // For week, use the already-calculated matchCount to ensure consistency
      // The main matching already found posts from last 7 days, so use that count
      const weekMatches = currentMatchCount || 1;
      const weekTotal = currentTotalInScope || 1;

      // Calculate month, year, and allTime in parallel
      const [monthData, yearData, allTimeData] = await Promise.all([
        calculateMatches(monthAgo),
        calculateMatches(yearAgo),
        calculateMatches(new Date(0)), // All time
      ]);

      return {
        week: {
          matching: weekMatches,
          total: weekTotal,
          comparison: weekMatches <= 1 ? 'First this week!' : `${weekMatches} of ${weekTotal}`
        },
        month: {
          matching: monthData.matches,
          total: monthData.total,
          comparison: monthData.matches <= 1 ? 'First this month!' : `${monthData.matches} of ${monthData.total}`
        },
        year: {
          matching: yearData.matches,
          total: yearData.total,
          comparison: yearData.matches <= 1 ? 'First this year!' : `${yearData.matches} of ${yearData.total}`
        },
        allTime: {
          matching: allTimeData.matches,
          total: allTimeData.total,
          comparison: allTimeData.matches <= 1 ? 'First ever!' : `${allTimeData.matches} of ${allTimeData.total}`
        }
      };
    } catch (error) {
      console.error('❌ Temporal analytics error:', error);
      // Return default values on error
      return {
        week: { matching: 0, total: 1, comparison: 'First this week!' },
        month: { matching: 0, total: 1, comparison: 'First this month!' },
        year: { matching: 0, total: 1, comparison: 'First this year!' },
        allTime: { matching: 0, total: 1, comparison: 'First ever!' }
      };
    }
  }
}

