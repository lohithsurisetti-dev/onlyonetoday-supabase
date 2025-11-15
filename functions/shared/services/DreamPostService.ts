declare const Deno: any;

import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';
import { DreamPost, CreateDreamRequest, DreamPostResult, DreamMatch, DreamAnalytics } from '../types/DreamTypes.ts';
import { DreamEmbeddingService } from './DreamEmbeddingService.ts';
import { ModerationPipeline } from './ModerationPipeline.ts';
import { DreamMatcherV2 } from './DreamMatcherV2.ts';
import { DreamInterpretationService } from './DreamInterpretationService.ts';

/**
 * Dream Post Service
 * Handles dream post creation, matching, and analytics
 */

export class DreamPostService {
  private supabase: any;
  private embeddingService: DreamEmbeddingService; // Keep for fallback pattern matching
  private moderationPipeline: ModerationPipeline;
  private dreamMatcherV2: DreamMatcherV2; // NEW: V2 matching (no embeddings)
  private interpretationService: DreamInterpretationService; // For dream insights

  constructor() {
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    this.supabase = createClient(supabaseUrl, supabaseServiceKey);

    this.embeddingService = new DreamEmbeddingService(); // Keep for fallback pattern matching
    this.moderationPipeline = new ModerationPipeline({
      allowDreams: true,
      allowSymbolicContent: true,
      strictMode: false
    });
    this.dreamMatcherV2 = new DreamMatcherV2(this.supabase); // NEW: V2 matching
    this.interpretationService = new DreamInterpretationService(); // For dream insights
  }

  /**
   * Create a new dream post
   */
  async createDreamPost(request: CreateDreamRequest): Promise<DreamPostResult> {
    try {
      console.log(`🌙 Creating dream post: ${request.dreamType}`);

      // Validate input
      const validation = this.validateDreamRequest(request);
      if (!validation.valid) {
        return {
          success: false,
          error: validation.error
        };
      }

      // Moderate content
      const moderation = await this.moderationPipeline.moderateContent(
        request.content,
        'dream',
        { dreamType: request.dreamType, emotions: request.emotions, symbols: request.symbols }
      );

      if (!moderation.approved) {
        return {
          success: false,
          error: `Content rejected: ${moderation.reason}`
        };
      }

      // Auto-extract symbols and emotions if not provided
      let symbols = request.symbols;
      let emotions = request.emotions;

      // Always validate and map symbols/emotions to our enum format
      let processedSymbols: string[] = [];
      let processedEmotions: string[] = [];

      // Use AI extraction as primary method (dynamic, works for any dream content)
      // Only extract if user hasn't provided symbols/emotions
      // Add timeout to prevent blocking (20 seconds max)
      let aiExtractionResult: any = null;
      
      if (symbols.length === 0 || emotions.length === 0) {
        try {
          console.log('🤖 Extracting symbols and emotions with AI (dynamic extraction for any dream)...');
          const aiExtractionService = new (await import('./AIDreamExtractionService.ts')).AIDreamExtractionService();
          
          // Add timeout wrapper (20 seconds) to prevent blocking
          const extractionPromise = aiExtractionService.extractDreamElements(request.content);
          const timeoutPromise = new Promise((_, reject) => {
            setTimeout(() => reject(new Error('AI extraction timeout after 20 seconds')), 20000);
          });
          
          aiExtractionResult = await Promise.race([extractionPromise, timeoutPromise]) as any;
        } catch (error) {
          console.log('⚠️ AI extraction failed or timed out, will use fallback pattern matching:', error);
          // Continue with fallback - pattern matching will be used
        }
      }

      // Process user-provided symbols or use AI-extracted symbols
      if (symbols.length > 0) {
        // For user-provided symbols, we'll directly use them
        processedSymbols = symbols;
        console.log(`✅ User-provided symbols: ${processedSymbols.join(', ')}`);
      } else if (aiExtractionResult && aiExtractionResult.symbols.length > 0) {
        // Use AI-extracted symbols (dynamic, works for any dream content)
        processedSymbols = aiExtractionResult.symbols.map((s: any) => s.symbol);
        console.log(`🤖 AI extracted symbols: ${processedSymbols.join(', ')}`);
      } else {
        // Fallback to pattern matching only if AI returns nothing or failed
        processedSymbols = await this.embeddingService.extractDreamSymbols(request.content);
        console.log(`🔍 Fallback pattern-extracted symbols: ${processedSymbols.join(', ')}`);
      }

      // Process user-provided emotions or use AI-extracted emotions
      if (emotions.length > 0) {
        // For user-provided emotions, we'll directly use them
        processedEmotions = emotions;
        console.log(`✅ User-provided emotions: ${processedEmotions.join(', ')}`);
      } else if (aiExtractionResult && aiExtractionResult.emotions.length > 0) {
        // Use AI-extracted emotions (dynamic, works for any dream content)
        processedEmotions = aiExtractionResult.emotions.map((e: any) => e.emotion);
        console.log(`🤖 AI extracted emotions: ${processedEmotions.join(', ')}`);
      } else {
        // Fallback to pattern matching only if AI returns nothing or failed
        processedEmotions = await this.embeddingService.extractDreamEmotions(request.content);
        console.log(`🔍 Fallback pattern-extracted emotions: ${processedEmotions.join(', ')}`);
      }

      // Create dream post object
      const dreamPost: DreamPost = {
        content: request.content.trim(),
        dreamType: request.dreamType,
        emotions: processedEmotions, // Use processed emotions
        symbols: processedSymbols,   // Use processed symbols
        clarity: request.clarity,
        interpretation: request.interpretation,
        isAnonymous: request.isAnonymous || false,
        scope: request.scope,
        locationCity: request.locationCity,
        locationState: request.locationState,
        locationCountry: request.locationCountry,
        userId: undefined // For now, use undefined for anonymous posts
      };

      // V2: Find similar dreams using symbols + emotions + keywords (NO EMBEDDINGS)
      console.log('🔍 V2: Finding similar dreams using symbol + emotion + keyword matching...');
      const similarDreamsResult = await this.dreamMatcherV2.findSimilarDreams(
        {
          content: dreamPost.content,
          dreamType: dreamPost.dreamType,
          symbols: dreamPost.symbols,
          emotions: dreamPost.emotions,
          clarity: dreamPost.clarity
        },
        request.scope,
        {
          city: request.locationCity,
          state: request.locationState,
          country: request.locationCountry
        }
      );

      // Convert to DreamMatch format for compatibility
      const similarDreams: DreamMatch[] = similarDreamsResult.matches.map((match: any) => ({
        postId: match.id,
        similarity: 0.85, // V2 doesn't use similarity scores, use default
        matchType: 'combined' as const,
        sharedSymbols: this.findSharedSymbols(dreamPost.symbols, match.symbols || []),
        sharedEmotions: this.findSharedEmotions(dreamPost.emotions, match.emotions || [])
      }));

      // Skip percentile calculation for performance (not needed for core functionality)

      // OPTIMIZATION: Save dream immediately, generate interpretation asynchronously
      // This allows us to return immediately to the user (much faster response time)
      const interpretationText = request.interpretation; // Use user-provided if available

      // Insert into database FIRST (fast response - no waiting for AI)
      const { data: postData, error: insertError } = await this.supabase
        .from('dream_posts')
        .insert({
          content: dreamPost.content,
          dream_type: dreamPost.dreamType,
          clarity: dreamPost.clarity,
          // Store user-provided interpretation if available, otherwise null (will be updated async)
          interpretation: interpretationText ? JSON.stringify({
            title: 'Your Dream',
            meaning: interpretationText,
            emotionalGuidance: 'Take time to reflect on what this dream means to you.',
            comfortMessage: 'Dreams are a window into your inner world.',
            actionAdvice: 'Consider journaling about this dream to explore its meaning.',
            hopeMessage: 'Every dream carries wisdom and insight.',
            isPositive: true,
            confidence: 0.7,
          }) : null,
          is_anonymous: dreamPost.isAnonymous,
          scope: dreamPost.scope,
          location_city: dreamPost.locationCity,
          location_state: dreamPost.locationState,
          location_country: dreamPost.locationCountry,
          user_id: dreamPost.userId,
          // Embeddings and percentile removed for performance
          // Matching uses symbols + emotions + keywords (V2)
          match_count: similarDreamsResult.matchCount // V2 match count
          // Note: total_in_scope not stored in dream_posts table (can be calculated on demand)
        })
        .select()
        .single();

      if (insertError) {
        console.error('❌ Database insert error:', insertError);
        console.error('❌ Error details:', JSON.stringify(insertError, null, 2));
        return {
          success: false,
          error: `Failed to save dream post: ${insertError.message || insertError.details || 'Unknown error'}`
        };
      }

      // OPTIMIZATION: Start interpretation generation in background (don't wait)
      // This allows us to return immediately to the user
      if (!interpretationText && request.content && request.content.trim().length > 0) {
        console.log(`🚀 [Background] Starting async interpretation generation for dream ${postData.id}...`);
        console.log(`📝 [Background] Content length: ${request.content.length}, Dream type: ${request.dreamType}`);
        console.log(`🎭 [Background] Emotions: ${processedEmotions.length}, Symbols: ${processedSymbols.length}`);
        
        // Use setTimeout with small delay to ensure response is sent first
        // This prevents the Edge Function from terminating before the async task starts
        // The delay is minimal (50ms) but ensures the HTTP response is fully sent
        setTimeout(() => {
          this.generateInterpretationAsync(
            postData.id,
            request.content,
            request.dreamType,
            processedEmotions,
            processedSymbols,
            request.clarity || 5
          ).catch(err => {
            console.error('❌ [Background] Interpretation generation failed:', err);
            console.error('❌ [Background] Error stack:', err?.stack);
            // Non-blocking - dream is already saved
          });
        }, 50); // Small delay to ensure response is sent
      } else {
        console.log(`⏭️ [Background] Skipping interpretation generation:`, {
          hasInterpretationText: !!interpretationText,
          hasContent: !!request.content,
          contentLength: request.content?.length || 0
        });
      }

      // OPTIMIZATION: Insert symbols and emotions in parallel (don't block response)
      // Process in background - user doesn't need to wait for these
      Promise.allSettled([
        ...processedSymbols.map(async (symbolName) => {
          try {
            const { data: symbolIdData, error: symbolError } = await this.supabase.rpc('get_or_create_symbol', {
              symbol_name: symbolName,
              symbol_category: 'general'
            });
            if (!symbolError && symbolIdData) {
              await this.supabase.from('dream_post_symbols').insert({
                dream_post_id: postData.id,
                symbol_id: symbolIdData
              });
            }
          } catch (error) {
            console.error(`❌ Error processing symbol ${symbolName}:`, error);
          }
        }),
        ...processedEmotions.map(async (emotionName) => {
          try {
            const { data: emotionIdData, error: emotionError } = await this.supabase.rpc('get_or_create_emotion', {
              emotion_name: emotionName,
              intensity: 5
            });
            if (!emotionError && emotionIdData) {
              await this.supabase.from('dream_post_emotions').insert({
                dream_post_id: postData.id,
                emotion_id: emotionIdData
              });
            }
          } catch (error) {
            console.error(`❌ Error processing emotion ${emotionName}:`, error);
          }
        })
      ]).catch(err => {
        console.error('❌ Error in parallel symbol/emotion processing:', err);
        // Non-blocking - dream is already saved
      });

      // OPTIMIZATION: Get analytics in parallel (don't block response)
      // Analytics can be fetched asynchronously
      const analyticsPromise = this.getDreamAnalytics().catch(err => {
        console.error('❌ Analytics fetch failed:', err);
        return this.getDefaultAnalytics();
      });

      console.log(`✅ Dream post created successfully: ${postData.id}`);

      return {
        success: true,
        post: {
          ...postData,
          symbols: processedSymbols,
          emotions: processedEmotions,
          dreamMatches: similarDreams,
          matchCount: similarDreamsResult.matchCount, // V2 match count
          totalInScope: similarDreamsResult.totalInScope, // V2 total in scope
          // Percentile fields removed for performance
          // Dream insights (interpretation generated in background, will be available shortly)
          // Return placeholder so UI can show skeletons while waiting for async interpretation
          interpretation: interpretationText ? {
            title: 'Your Dream',
            meaning: interpretationText,
            emotionalGuidance: 'Take time to reflect on what this dream means to you.',
            comfortMessage: 'Dreams are a window into your inner world.',
            actionAdvice: 'Consider journaling about this dream to explore its meaning.',
            hopeMessage: 'Every dream carries wisdom and insight.',
            isPositive: true,
            confidence: 0.7,
          } : {
            title: 'Your Dream',
            meaning: 'Your dream is being interpreted...',
            emotionalGuidance: 'Take time to reflect on what this dream means to you.',
            comfortMessage: 'Dreams are a window into your inner world.',
            actionAdvice: 'Consider journaling about this dream to explore its meaning.',
            hopeMessage: 'Every dream carries wisdom and insight.',
            isPositive: true,
            confidence: 0.5,
          }
        },
        analytics: await analyticsPromise
      };

    } catch (error) {
      console.error('❌ Dream post creation failed:', error);
      return {
        success: false,
        error: error.message
      };
    }
  }

  /**
   * Find similar dreams using vector similarity (DEPRECATED - Use DreamMatcherV2 instead)
   * Kept for backward compatibility, but V2 matching is preferred
   */
  private async findSimilarDreams(
    dreamEmbedding: any,
    dreamPost: DreamPost,
    limit: number = 10
  ): Promise<DreamMatch[]> {
    try {
      // Query for similar dreams using vector similarity
      const { data: similarPosts, error } = await this.supabase.rpc(
        'match_dreams_by_embedding',
        {
          query_embedding: dreamEmbedding.combinedEmbedding,
          match_threshold: 0.7,
          match_count: limit,
          dream_type: dreamPost.dreamType,
          scope: dreamPost.scope
        }
      );

      if (error) {
        console.error('❌ Similar dreams query error:', error);
        return [];
      }

      // Convert to DreamMatch format
      const matches: DreamMatch[] = similarPosts.map((post: any) => ({
        postId: post.id,
        similarity: post.similarity,
        matchType: 'combined' as const,
        sharedSymbols: this.findSharedSymbols(dreamPost.symbols, post.symbols),
        sharedEmotions: this.findSharedEmotions(dreamPost.emotions, post.emotions)
      }));

      return matches;

    } catch (error) {
      console.error('❌ Find similar dreams failed:', error);
      return [];
    }
  }

  /**
   * Map AI-extracted symbols to our enum format
   */
  private mapAISymbolToEnum(aiSymbol: string): string | null {
    const symbolMap: Record<string, string> = {
      'flying': 'flying',
      'soaring': 'flying',
      'air': 'flying',
      'sky': 'flying',
      'falling': 'falling',
      'dropping': 'falling',
      'water': 'water',
      'ocean': 'water',
      'sea': 'water',
      'river': 'water',
      'lake': 'water',
      'fire': 'fire',
      'flame': 'fire',
      'burning': 'fire',
      'animal': 'animals',
      'dog': 'animals',
      'cat': 'animals',
      'bird': 'animals',
      'fish': 'animals',
      'person': 'people',
      'people': 'people',
      'friend': 'people',
      'family': 'people',
      'building': 'buildings',
      'house': 'buildings',
      'school': 'buildings',
      'office': 'buildings',
      'vehicle': 'vehicles',
      'car': 'vehicles',
      'bus': 'vehicles',
      'train': 'vehicles',
      'plane': 'vehicles',
      'nature': 'nature',
      'tree': 'nature',
      'forest': 'nature',
      'mountain': 'mountains',
      'mountains': 'mountains',
      'field': 'nature',
      'dark': 'darkness',
      'darkness': 'darkness',
      'black': 'darkness',
      'shadow': 'darkness',
      'light': 'light',
      'bright': 'light',
      'sun': 'light',
      'moon': 'light',
      'star': 'light',
      'color': 'colors',
      'red': 'colors',
      'blue': 'colors',
      'green': 'colors',
      'yellow': 'colors',
      'purple': 'colors',
      'orange': 'colors',
      'food': 'food',
      'eat': 'food',
      'meal': 'food',
      'bread': 'food',
      'fruit': 'food',
      'clothing': 'clothing',
      'clothes': 'clothing',
      'dress': 'clothing',
      'shirt': 'clothing',
      'pants': 'clothing',
      'shoes': 'clothing',
      'money': 'money',
      'cash': 'money',
      'dollar': 'money',
      'coin': 'money',
      'rich': 'money',
      'poor': 'money',
      'technology': 'technology',
      'computer': 'technology',
      'phone': 'technology',
      'internet': 'technology',
      'robot': 'technology',
      'machine': 'technology',
      'music': 'music',
      'song': 'music',
      'sing': 'music',
      'dance': 'music',
      'instrument': 'music',
      'art': 'art',
      'paint': 'art',
      'draw': 'art',
      'picture': 'art',
      'sculpture': 'art',
      'child': 'childhood',
      'childhood': 'childhood',
      'kid': 'childhood',
      'young': 'childhood',
      'playground': 'childhood',
      'work': 'work',
      'job': 'work',
      'meeting': 'work',
      'boss': 'work',
      'class': 'school',
      'teacher': 'school',
      'student': 'school',
      'homework': 'school',
      'home': 'home',
      'room': 'home',
      'bedroom': 'home',
      'kitchen': 'home',
      'travel': 'travel',
      'trip': 'travel',
      'vacation': 'travel',
      'journey': 'travel',
      'adventure': 'travel',
      'death': 'death',
      'die': 'death',
      'dead': 'death',
      'funeral': 'death',
      'grave': 'death',
      'birth': 'birth',
      'born': 'birth',
      'baby': 'birth',
      'new': 'birth',
      'beginning': 'birth',
      'transformation': 'transformation',
      'change': 'transformation',
      'transform': 'transformation',
      'become': 'transformation',
      'turn into': 'transformation',
      'chase': 'chase',
      'running': 'chase',
      'pursue': 'chase',
      'follow': 'chase',
      'hunt': 'chase',
      'escape': 'escape',
      'run away': 'escape',
      'flee': 'escape',
      'hide': 'escape',
      'avoid': 'escape',
      'search': 'search',
      'look for': 'search',
      'find': 'search',
      'seek': 'search',
      'discovery': 'discovery',
      'discover': 'discovery',
      'reveal': 'discovery',
      'uncover': 'discovery',
      'learn': 'discovery'
    };

    return symbolMap[aiSymbol.toLowerCase()] || null;
  }

  /**
   * Map AI-extracted emotions to our enum format
   */
  private mapAIEmotionToEnum(aiEmotion: string): string | null {
    const emotionMap: Record<string, string> = {
      'joy': 'joy',
      'happy': 'joy',
      'happiness': 'joy',
      'excited': 'joy',
      'elated': 'joy',
      'cheerful': 'joy',
      'delighted': 'joy',
      'fear': 'fear',
      'afraid': 'fear',
      'scared': 'fear',
      'terrified': 'fear',
      'panic': 'fear',
      'confusion': 'confusion',
      'confused': 'confusion',
      'lost': 'confusion',
      'unclear': 'confusion',
      'puzzled': 'confusion',
      'wonder': 'wonder',
      'amazed': 'wonder',
      'awe': 'wonder',
      'marvel': 'wonder',
      'fascinated': 'wonder',
      'peace': 'peace',
      'peaceful': 'peace',
      'calm': 'peace',
      'serene': 'peace',
      'tranquil': 'peace',
      'relaxed': 'peace',
      'anxiety': 'anxiety',
      'anxious': 'anxiety',
      'worried': 'anxiety',
      'nervous': 'anxiety',
      'stressed': 'anxiety',
      'uneasy': 'anxiety',
      'excitement': 'excitement',
      'thrilled': 'excitement',
      'energetic': 'excitement',
      'pumped': 'excitement',
      'enthusiastic': 'excitement',
      'sadness': 'sadness',
      'sad': 'sadness',
      'depressed': 'sadness',
      'melancholy': 'sadness',
      'grief': 'sadness',
      'sorrow': 'sadness',
      'anger': 'anger',
      'angry': 'anger',
      'mad': 'anger',
      'furious': 'anger',
      'rage': 'anger',
      'irritated': 'anger',
      'love': 'love',
      'loving': 'love',
      'affection': 'love',
      'romance': 'love',
      'passion': 'love',
      'nostalgia': 'nostalgia',
      'nostalgic': 'nostalgia',
      'memories': 'nostalgia',
      'past': 'nostalgia',
      'childhood': 'nostalgia',
      'remember': 'nostalgia',
      'curiosity': 'curiosity',
      'curious': 'curiosity',
      'interested': 'curiosity',
      'intrigued': 'curiosity',
      'wondering': 'curiosity',
      'freedom': 'freedom',
      'free': 'freedom',
      'liberated': 'freedom',
      'unbound': 'freedom',
      'independent': 'freedom',
      'trapped': 'trapped',
      'stuck': 'trapped',
      'confined': 'trapped',
      'imprisoned': 'trapped',
      'powerful': 'powerful',
      'strong': 'powerful',
      'mighty': 'powerful',
      'dominant': 'powerful',
      'vulnerable': 'vulnerable',
      'weak': 'vulnerable',
      'exposed': 'vulnerable',
      'defenseless': 'vulnerable',
      'mysterious': 'mysterious',
      'unknown': 'mysterious',
      'hidden': 'mysterious',
      'secret': 'mysterious',
      'familiar': 'familiar',
      'known': 'familiar',
      'recognized': 'familiar',
      'comfortable': 'familiar'
    };

    return emotionMap[aiEmotion.toLowerCase()] || null;
  }

  /**
   * Format interpretation object into text for database storage
   */
  private formatInterpretation(interpretation: any): string {
    if (!interpretation) return '';
    
    const parts = [];
    if (interpretation.title) parts.push(`Title: ${interpretation.title}`);
    if (interpretation.meaning) parts.push(`Meaning: ${interpretation.meaning}`);
    if (interpretation.emotionalGuidance) parts.push(`Guidance: ${interpretation.emotionalGuidance}`);
    if (interpretation.comfortMessage) parts.push(`Comfort: ${interpretation.comfortMessage}`);
    if (interpretation.actionAdvice) parts.push(`Advice: ${interpretation.actionAdvice}`);
    if (interpretation.hopeMessage) parts.push(`Hope: ${interpretation.hopeMessage}`);
    
    return parts.join('\n\n');
  }

  /**
   * Validate dream request
   */
  private validateDreamRequest(request: CreateDreamRequest): { valid: boolean; error?: string } {
    if (!request.content || request.content.trim().length < 10) {
      return { valid: false, error: 'Dream content must be at least 10 characters' };
    }

    if (!request.dreamType) {
      return { valid: false, error: 'Dream type is required' };
    }

    if (request.clarity < 1 || request.clarity > 10) {
      return { valid: false, error: 'Clarity must be between 1 and 10' };
    }

    if (!request.scope) {
      return { valid: false, error: 'Scope is required' };
    }

    return { valid: true };
  }

  /**
   * Find shared symbols between two dreams
   */
  private findSharedSymbols(symbols1: string[], symbols2: string[]): string[] {
    const set1 = new Set(symbols1);
    const set2 = new Set(symbols2);
    return [...set1].filter(symbol => set2.has(symbol));
  }

  /**
   * Find shared emotions between two dreams
   */
  private findSharedEmotions(emotions1: string[], emotions2: string[]): string[] {
    const set1 = new Set(emotions1);
    const set2 = new Set(emotions2);
    return [...set1].filter(emotion => set2.has(emotion));
  }

  /**
   * Get dream analytics
   */
  private async getDreamAnalytics(): Promise<DreamAnalytics> {
    try {
      const { data: stats, error } = await this.supabase.rpc('get_dream_analytics');
      
      if (error) {
        console.error('❌ Dream analytics error:', error);
        return this.getDefaultAnalytics();
      }

      return stats;

    } catch (error) {
      console.error('❌ Dream analytics failed:', error);
      return this.getDefaultAnalytics();
    }
  }

  /**
   * Get default analytics when query fails
   */
  private getDefaultAnalytics(): DreamAnalytics {
    return {
      totalDreams: 0,
      dreamTypeDistribution: {
        night_dream: 0,
        daydream: 0,
        lucid_dream: 0,
        nightmare: 0
      },
      commonSymbols: [],
      commonEmotions: [],
      averageClarity: 5,
      temporalPatterns: {
        today: 0,
        thisWeek: 0,
        thisMonth: 0
      }
    };
  }

  /**
   * Fetch dream posts with filters
   */
  async fetchDreamPosts(filters: {
    dreamType?: string;
    scope?: string;
    limit?: number;
    offset?: number;
  } = {}): Promise<{ success: boolean; posts?: any[]; error?: string }> {
    try {
      let query = this.supabase
        .from('dream_posts')
        .select('*')
        .order('created_at', { ascending: false });

      if (filters.dreamType) {
        query = query.eq('dream_type', filters.dreamType);
      }

      if (filters.scope) {
        query = query.eq('scope', filters.scope);
      }

      if (filters.limit) {
        query = query.limit(filters.limit);
      }

      if (filters.offset) {
        query = query.range(filters.offset, filters.offset + (filters.limit || 10) - 1);
      }

      const { data: posts, error } = await query;

      if (error) {
        console.error('❌ Fetch dream posts error:', error);
        return {
          success: false,
          error: 'Failed to fetch dream posts'
        };
      }

      return {
        success: true,
        posts: posts || []
      };

    } catch (error) {
      console.error('❌ Fetch dream posts failed:', error);
      return {
        success: false,
        error: error.message
      };
    }
  }

  /**
   * Generate interpretation asynchronously in background
   * Updates the dream post with interpretation when ready
   */
  private async generateInterpretationAsync(
    dreamId: string,
    content: string,
    dreamType: string,
    emotions: string[],
    symbols: string[],
    clarity: number
  ): Promise<void> {
    try {
      console.log(`🔮 [Background] Generating interpretation for dream ${dreamId}...`);
      console.log(`📊 [Background] Input params:`, {
        dreamId,
        contentLength: content.length,
        dreamType,
        emotionsCount: emotions.length,
        symbolsCount: symbols.length,
        clarity
      });
      
      // Generate interpretation with timeout
      console.log(`🤖 [Background] Calling interpretationService.interpretDream...`);
      const interpretationPromise = this.interpretationService.interpretDream(
        content,
        dreamType,
        emotions,
        symbols,
        clarity
      );
      
      const timeoutPromise = new Promise((_, reject) => {
        setTimeout(() => reject(new Error('Interpretation timeout after 30 seconds')), 30000);
      });
      
      console.log(`⏳ [Background] Waiting for interpretation (with 30s timeout)...`);
      const interpretation = await Promise.race([interpretationPromise, timeoutPromise]) as any;
      
      console.log(`✅ [Background] Interpretation received:`, {
        hasTitle: !!interpretation?.title,
        hasMeaning: !!interpretation?.meaning,
        meaningLength: interpretation?.meaning?.length,
        title: interpretation?.title?.substring(0, 50)
      });
      
      // Store interpretation as JSON string (not formatted text) for proper parsing
      const interpretationJson = JSON.stringify(interpretation);
      console.log(`💾 [Background] Storing interpretation (${interpretationJson.length} chars) to database...`);
      
      // Update dream post with interpretation
      const { error: updateError, data: updateData } = await this.supabase
        .from('dream_posts')
        .update({ interpretation: interpretationJson })
        .eq('id', dreamId)
        .select();
      
      if (updateError) {
        console.error(`❌ [Background] Failed to update interpretation for dream ${dreamId}:`, updateError);
        console.error(`❌ [Background] Update error details:`, JSON.stringify(updateError, null, 2));
      } else {
        console.log(`✅ [Background] Interpretation generated and saved for dream ${dreamId}`);
        console.log(`✅ [Background] Updated rows:`, updateData?.length || 0);
      }
    } catch (error) {
      console.error(`❌ [Background] Interpretation generation failed for dream ${dreamId}:`, error);
      console.error(`❌ [Background] Error message:`, error?.message);
      console.error(`❌ [Background] Error stack:`, error?.stack);
      console.error(`❌ [Background] Error details:`, JSON.stringify(error, Object.getOwnPropertyNames(error)));
      // Non-blocking - dream is already saved without interpretation
    }
  }
}
