declare const Deno: any;

import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';
import { DreamPost, CreateDreamRequest, DreamPostResult, DreamMatch, DreamAnalytics } from '../types/DreamTypes.ts';
import { DreamEmbeddingService } from './DreamEmbeddingService.ts';
import { ModerationPipeline } from './ModerationPipeline.ts';
import { PercentileService } from './PercentileService.ts';

/**
 * Dream Post Service
 * Handles dream post creation, matching, and analytics
 */

export class DreamPostService {
  private supabase: any;
  private embeddingService: DreamEmbeddingService;
  private moderationPipeline: ModerationPipeline;
  private percentileService: PercentileService;

  constructor() {
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    this.supabase = createClient(supabaseUrl, supabaseServiceKey);

    this.embeddingService = new DreamEmbeddingService();
    this.moderationPipeline = new ModerationPipeline({
      allowDreams: true,
      allowSymbolicContent: true,
      strictMode: false
    });
    this.percentileService = new PercentileService();
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

      // Process user-provided symbols or extract if empty
      if (symbols.length > 0) {
        // For user-provided symbols, we'll directly use them and let the DB functions handle creation/lookup
        processedSymbols = symbols;
        console.log(`✅ User-provided symbols: ${processedSymbols.join(', ')}`);
      } else {
        // No symbols provided, try custom extraction first
        processedSymbols = await this.embeddingService.extractDreamSymbols(request.content);
        console.log(`🔍 Custom extracted symbols: ${processedSymbols.join(', ')}`);
      }

      // Process user-provided emotions or extract if empty
      if (emotions.length > 0) {
        // For user-provided emotions, we'll directly use them and let the DB functions handle creation/lookup
        processedEmotions = emotions;
        console.log(`✅ User-provided emotions: ${processedEmotions.join(', ')}`);
      } else {
        // No emotions provided, try custom extraction first
        processedEmotions = await this.embeddingService.extractDreamEmotions(request.content);
        console.log(`💭 Custom extracted emotions: ${processedEmotions.join(', ')}`);
      }

      // If custom extraction found limited results, try AI as fallback
      if (processedSymbols.length === 0 || processedEmotions.length === 0) {
        try {
          console.log('🤖 Custom extraction found limited results, trying AI...');
          const aiExtractionService = new (await import('./AIDreamExtractionService.ts')).AIDreamExtractionService();
          const extractionResult = await aiExtractionService.extractDreamElements(request.content);
          
          if (processedSymbols.length === 0) {
            const aiSymbols = extractionResult.symbols.map(s => s.symbol);
            if (aiSymbols.length > 0) {
              processedSymbols = aiSymbols;
              console.log(`🤖 AI extracted symbols: ${processedSymbols.join(', ')}`);
            }
          }
          
          if (processedEmotions.length === 0) {
            const aiEmotions = extractionResult.emotions.map(e => e.emotion);
            if (aiEmotions.length > 0) {
              processedEmotions = aiEmotions;
              console.log(`🤖 AI extracted emotions: ${processedEmotions.join(', ')}`);
            }
          }
        } catch (error) {
          console.log('⚠️ AI extraction failed, keeping custom results:', error);
        }
      }

      // Generate dream embedding
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

      const dreamEmbedding = await this.embeddingService.generateDreamEmbedding(dreamPost);

      // Find similar dreams
      const similarDreams = await this.findSimilarDreams(dreamEmbedding, dreamPost);

      // Calculate percentile and tier
      const percentileResult = await this.percentileService.calculateDreamPercentile(
        dreamPost,
        similarDreams
      );

      // Insert into database
      const { data: postData, error: insertError } = await this.supabase
        .from('dream_posts')
        .insert({
          content: dreamPost.content,
          dream_type: dreamPost.dreamType,
          clarity: dreamPost.clarity,
          interpretation: dreamPost.interpretation,
          is_anonymous: dreamPost.isAnonymous,
          scope: dreamPost.scope,
          location_city: dreamPost.locationCity,
          location_state: dreamPost.locationState,
          location_country: dreamPost.locationCountry,
          user_id: dreamPost.userId,
          content_embedding: dreamEmbedding.contentEmbedding,
          symbol_embedding: dreamEmbedding.symbolEmbedding,
          emotion_embedding: dreamEmbedding.emotionEmbedding,
          combined_embedding: dreamEmbedding.combinedEmbedding,
          tier: percentileResult.tier,
          percentile: percentileResult.percentile,
          match_count: similarDreams.length
        })
        .select()
        .single();

      if (insertError) {
        console.error('❌ Database insert error:', insertError);
        return {
          success: false,
          error: 'Failed to save dream post'
        };
      }

      // Insert symbols and emotions into junction tables
      for (const symbolName of processedSymbols) {
        const { data: symbolIdData, error: symbolError } = await this.supabase.rpc('get_or_create_symbol', {
          symbol_name: symbolName,
          symbol_category: 'general' // AI can provide this later
        });
        if (symbolError) {
          console.error('Error getting or creating symbol:', symbolError);
          continue;
        }
        await this.supabase.from('dream_post_symbols').insert({
          dream_post_id: postData.id,
          symbol_id: symbolIdData
        });
      }

      for (const emotionName of processedEmotions) {
        const { data: emotionIdData, error: emotionError } = await this.supabase.rpc('get_or_create_emotion', {
          emotion_name: emotionName,
          intensity: 5 // AI can provide this later
        });
        if (emotionError) {
          console.error('Error getting or creating emotion:', emotionError);
          continue;
        }
        await this.supabase.from('dream_post_emotions').insert({
          dream_post_id: postData.id,
          emotion_id: emotionIdData
        });
      }

      // Get analytics
      const analytics = await this.getDreamAnalytics();

      console.log(`✅ Dream post created successfully: ${postData.id}`);

      return {
        success: true,
        post: {
          ...postData,
          symbols: processedSymbols,
          emotions: processedEmotions,
          dreamMatches: similarDreams,
          displayText: percentileResult.displayText,
          badge: percentileResult.badge,
          message: percentileResult.message,
          comparison: percentileResult.comparison
        },
        analytics: analytics
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
   * Find similar dreams using vector similarity
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
}
