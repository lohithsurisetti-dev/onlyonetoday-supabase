/**
 * Dream Matcher V2 Service
 * 
 * Reliable dream matching using symbols + emotions + keywords
 * NO EMBEDDINGS - Fast, reliable, transparent
 * 
 * Architecture:
 * - Matching: V2 approach (symbols + emotions + keywords)
 * - Insights: Keep API calls for interpretation/extraction (separate concern)
 */

import { Stemmer } from './Stemmer.ts';
import { IrregularVerbs } from './IrregularVerbs.ts';

export interface DreamMatchResult {
  isMatch: boolean;
  confidence: number;
  sharedSymbols: string[];
  sharedEmotions: string[];
  sharedKeywords: string[];
  reason: 'symbols' | 'emotions' | 'keywords' | 'combined';
}

export interface DreamPost {
  content: string;
  dreamType: string;
  symbols: string[];
  emotions: string[];
  clarity?: number;
}

export interface SimilarDreamsResult {
  matches: any[];
  matchCount: number;
  totalInScope: number;
}

export class DreamMatcherV2 {
  private supabase: any;
  private stemmer: Stemmer;
  private irregularVerbs: IrregularVerbs;

  constructor(supabase: any) {
    this.supabase = supabase;
    this.stemmer = new Stemmer();
    this.irregularVerbs = new IrregularVerbs();
  }

  /**
   * Find similar dreams using V2 matching (symbols + emotions + keywords)
   * NO EMBEDDINGS - Reliable, fast, transparent
   */
  async findSimilarDreams(
    dream: DreamPost,
    scope: 'city' | 'state' | 'country' | 'world',
    location?: {
      city?: string;
      state?: string;
      country?: string;
    },
    limit: number = 100
  ): Promise<SimilarDreamsResult> {
    try {
      // Build base query
      let query = this.supabase
        .from('dream_posts')
        .select('id, content, dream_type, symbols, emotions, clarity, scope, location_city, location_state, location_country, created_at, user_id')
        // Note: dream_posts table doesn't have moderation_status column (dreams are auto-approved)
        .eq('dream_type', dream.dreamType); // Must match dream type

      // Apply scope filtering
      switch (scope) {
        case 'city':
          if (location?.city) {
            query = query.eq('location_city', location.city).eq('scope', 'city');
          }
          break;
        case 'state':
          if (location?.state) {
            query = query.eq('location_state', location.state).in('scope', ['city', 'state']);
          }
          break;
        case 'country':
          if (location?.country) {
            query = query.eq('location_country', location.country).in('scope', ['city', 'state', 'country']);
          }
          break;
        case 'world':
        default:
          // No location filter for world scope
          break;
      }

      // Get all dreams in scope (limited to recent for performance)
      const { data: allDreams, error } = await query
        .gte('created_at', new Date(Date.now() - 90 * 24 * 60 * 60 * 1000).toISOString()) // Last 90 days
        .limit(1000);

      if (error) {
        console.error('❌ Dream search error:', error);
        return {
          matches: [],
          matchCount: 1,
          totalInScope: 1
        };
      }

      // OPTIMIZATION: Fetch symbols and emotions in parallel
      const dreamIds = (allDreams || []).map((d: any) => d.id);
      const symbolsMap = new Map<string, string[]>();
      const emotionsMap = new Map<string, string[]>();
      
      if (dreamIds.length > 0) {
        // Fetch symbols and emotions in parallel (optimization)
        const [symbolsResult, emotionsResult] = await Promise.all([
          this.supabase
          .from('dream_post_symbols')
          .select('dream_post_id, dream_symbols(name)')
            .in('dream_post_id', dreamIds),
          this.supabase
          .from('dream_post_emotions')
          .select('dream_post_id, dream_emotions(name)')
            .in('dream_post_id', dreamIds)
        ]);
        
        const symbolsData = symbolsResult.data || [];
        const emotionsData = emotionsResult.data || [];
        
        // Build maps
        symbolsData.forEach((item: any) => {
          const postId = item.dream_post_id;
          const symbolName = item.dream_symbols?.name;
          if (symbolName) {
            if (!symbolsMap.has(postId)) {
              symbolsMap.set(postId, []);
            }
            symbolsMap.get(postId)!.push(symbolName);
          }
        });
        
        emotionsData.forEach((item: any) => {
          const postId = item.dream_post_id;
          const emotionName = item.dream_emotions?.name;
          if (emotionName) {
            if (!emotionsMap.has(postId)) {
              emotionsMap.set(postId, []);
            }
            emotionsMap.get(postId)!.push(emotionName);
          }
        });
      }

      // Filter by V2 matching (symbols + emotions + keywords)
      const matches = (allDreams || []).filter((otherDream: any) => {
        const matchResult = this.matchDreams(dream, {
          content: otherDream.content,
          dreamType: otherDream.dream_type,
          symbols: symbolsMap.get(otherDream.id) || [],
          emotions: emotionsMap.get(otherDream.id) || []
        });
        return matchResult.isMatch;
      });

      // Get total dreams in scope
      const existingDreamsCount = await this.getTotalDreamsInScope(scope, location, dream.dreamType);
      const totalInScope = existingDreamsCount + 1; // +1 for current dream being created

      console.log(`   Dream match calculation: ${matches.length} matches + 1 current = ${matches.length + 1} total matches`);
      console.log(`   Total in scope: ${existingDreamsCount} existing + 1 current = ${totalInScope} total`);

      return {
        matches: matches.slice(0, limit),
        matchCount: matches.length + 1, // +1 for current dream
        totalInScope: totalInScope
      };

    } catch (error) {
      console.error('❌ Dream matching error:', error);
      return {
        matches: [],
        matchCount: 1,
        totalInScope: 1
      };
    }
  }

  /**
   * Match two dreams using V2 approach (symbols + emotions + keywords)
   * STRICT MATCHING: Requires multiple criteria to reduce false positives
   * EXACT MATCH: Identical or near-identical content always matches
   */
  matchDreams(dream1: DreamPost, dream2: DreamPost): DreamMatchResult {
    // EXACT MATCH CHECK: If content is identical or very similar, always match
    const content1 = dream1.content.toLowerCase().trim();
    const content2 = dream2.content.toLowerCase().trim();
    
    // Check for exact match or high similarity
    const isExactMatch = content1 === content2;
    const similarity = this.calculateContentSimilarity(content1, content2);
    // Lower threshold to 70% for similar dreams with different wordings
    const isVerySimilar = similarity > 0.7; // 70%+ similarity (was 90%)
    
    // Calculate shared keywords once (used in both early return and main matching)
    const sharedKeywords = this.findSharedKeywords(dream1.content, dream2.content);
    const hasManySharedKeywords = sharedKeywords.length >= 5; // 5+ shared keywords
    
    if (isExactMatch || isVerySimilar || hasManySharedKeywords) {
      console.log(`   ✅ Similar match detected (similarity: ${(similarity * 100).toFixed(1)}%, shared keywords: ${sharedKeywords.length})`);
      return {
        isMatch: true,
        confidence: Math.max(similarity, 0.8), // At least 80% confidence for similar content
        sharedSymbols: this.findSharedSymbols(dream1.symbols, dream2.symbols),
        sharedEmotions: this.findSharedEmotions(dream1.emotions, dream2.emotions),
        sharedKeywords: sharedKeywords,
        reason: isExactMatch ? 'exact_content_match' : (hasManySharedKeywords ? 'many_shared_keywords' : 'very_similar_content')
      };
    }
    
    // Layer 1: Symbol Matching (Most Reliable - 40% weight)
    const sharedSymbols = this.findSharedSymbols(dream1.symbols, dream2.symbols);
    
    // Layer 2: Emotion Matching (Very Reliable - 30% weight)
    const sharedEmotions = this.findSharedEmotions(dream1.emotions, dream2.emotions);
    
    // Layer 3: Keyword Matching (Like V2 posts - 20% weight)
    // sharedKeywords already calculated above
    
    // Layer 4: Dream Type (Must match - 10% bonus)
    const sameType = dream1.dreamType === dream2.dreamType;
    
    // Calculate match score
    const symbolScore = sharedSymbols.length * 0.4;
    const emotionScore = sharedEmotions.length * 0.3;
    const keywordScore = sharedKeywords.length * 0.2;
    const typeBonus = sameType ? 0.1 : 0;
    
    const totalScore = symbolScore + emotionScore + keywordScore + typeBonus;
    
    // STRICT MATCHING RULES (reduced false positives):
    // Match if ONE of these STRICT conditions is met:
    // 1. Strong symbol match: 4+ shared symbols (very specific themes)
    // 2. Strong emotion match: 4+ shared emotions (very specific emotional states)
    // 3. Strong keyword match: 6+ shared keywords (very specific content overlap)
    // 4. Combined strong match: 3+ symbols AND 3+ keywords (multiple criteria)
    // 5. Very high combined score: >= 3.0 (multiple strong signals)
    const isMatch = 
      sharedSymbols.length >= 4 ||  // Increased from 2 to 4
      sharedEmotions.length >= 4 ||  // Increased from 2 to 4
      sharedKeywords.length >= 6 ||  // Increased from 3 to 6
      (sharedSymbols.length >= 3 && sharedKeywords.length >= 3) ||  // Require both
      (sharedEmotions.length >= 3 && sharedKeywords.length >= 3) ||  // Require both
      totalScore >= 3.0;  // Increased from 1.5 to 3.0
    
    return {
      isMatch,
      confidence: Math.min(totalScore / 3.0, 1.0), // Normalize to 0-1 based on new max
      sharedSymbols,
      sharedEmotions,
      sharedKeywords,
      reason: this.determineReason(sharedSymbols, sharedEmotions, sharedKeywords)
    };
  }

  /**
   * Find shared symbols between two dreams
   */
  private findSharedSymbols(symbols1: string[], symbols2: string[]): string[] {
    const set1 = new Set(symbols1.map(s => s.toLowerCase()));
    const set2 = new Set(symbols2.map(s => s.toLowerCase()));
    return [...set1].filter(s => set2.has(s));
  }

  /**
   * Calculate content similarity between two dream texts
   * Uses simple word overlap ratio
   */
  private calculateContentSimilarity(text1: string, text2: string): number {
    if (!text1 || !text2) return 0;
    
    // Normalize: remove punctuation, split into words
    const words1 = new Set(text1.replace(/[^\w\s]/g, ' ').toLowerCase().split(/\s+/).filter(w => w.length > 2));
    const words2 = new Set(text2.replace(/[^\w\s]/g, ' ').toLowerCase().split(/\s+/).filter(w => w.length > 2));
    
    if (words1.size === 0 || words2.size === 0) return 0;
    
    // Calculate Jaccard similarity (intersection / union)
    const intersection = [...words1].filter(w => words2.has(w)).length;
    const union = new Set([...words1, ...words2]).size;
    
    return intersection / union;
  }

  /**
   * Find shared emotions between two dreams
   */
  private findSharedEmotions(emotions1: string[], emotions2: string[]): string[] {
    const set1 = new Set(emotions1.map(e => e.toLowerCase()));
    const set2 = new Set(emotions2.map(e => e.toLowerCase()));
    return [...set2].filter(e => set1.has(e));
  }

  /**
   * Find shared keywords between two dream contents (using V2 keyword matching)
   */
  private findSharedKeywords(content1: string, content2: string): string[] {
    const keywords1 = this.extractKeywords(content1);
    const keywords2 = this.extractKeywords(content2);
    
    const set1 = new Set(keywords1);
    const set2 = new Set(keywords2);
    
    return [...set1].filter(k => set2.has(k));
  }

  /**
   * Extract keywords from dream content (using V2 approach: stemming + irregular verbs)
   * STRICT: Only meaningful, longer words (4+ chars) to reduce false matches
   */
  private extractKeywords(content: string): string[] {
    const stopWords = [
      'the', 'a', 'an', 'and', 'or', 'but', 'in', 'on', 'at', 'to', 'for',
      'of', 'with', 'by', 'from', 'as', 'is', 'was', 'are', 'were', 'been',
      'be', 'have', 'has', 'had', 'do', 'does', 'did', 'will', 'would',
      'could', 'should', 'may', 'might', 'must', 'can', 'this', 'that',
      'these', 'those', 'i', 'you', 'he', 'she', 'it', 'we', 'they',
      'my', 'your', 'his', 'her', 'its', 'our', 'their', 'me', 'him', 'her', 'us', 'them',
      'dream', 'dreamed', 'dreaming', 'dreams', 'felt', 'feeling', 'feel', 'felt',
      'remember', 'remembered', 'waking', 'woke', 'wake', 'awake', 'sleep', 'slept',
      'was', 'were', 'been', 'being', 'became', 'become', 'got', 'get', 'getting'
    ];

    // Extract words: minimum 4 characters (more specific), max 15 keywords
    const words = content
      .toLowerCase()
      .replace(/[^\w\s]/g, ' ')
      .split(/\s+/)
      .filter(w => w.length >= 4)  // Increased from 3 to 4 for more specific matches
      .filter(w => !stopWords.includes(w))
      .slice(0, 15);  // Increased from 10 to 15 to capture more context

    // Normalize words: stem + irregular verbs
    const normalized: string[] = [];
    for (const word of words) {
      const irregularForms = this.irregularVerbs.getForms(word);
      if (irregularForms.length > 0) {
        normalized.push(this.irregularVerbs.getRoot(word), ...irregularForms);
      } else {
        const stemmed = this.stemmer.stem(word);
        normalized.push(stemmed);
      }
    }

    return [...new Set(normalized)];
  }

  /**
   * Determine match reason (updated for strict thresholds)
   */
  private determineReason(
    symbols: string[],
    emotions: string[],
    keywords: string[]
  ): 'symbols' | 'emotions' | 'keywords' | 'combined' {
    if (symbols.length >= 4) return 'symbols';
    if (emotions.length >= 4) return 'emotions';
    if (keywords.length >= 6) return 'keywords';
    return 'combined';
  }

  /**
   * Get total dreams in scope (for story generation)
   */
  private async getTotalDreamsInScope(
    scope: 'city' | 'state' | 'country' | 'world',
    location?: {
      city?: string;
      state?: string;
      country?: string;
    },
    dreamType?: string
  ): Promise<number> {
    try {
      let query = this.supabase
        .from('dream_posts')
        .select('id');
        // Note: dream_posts table doesn't have moderation_status column

      if (dreamType) {
        query = query.eq('dream_type', dreamType);
      }

      // Apply scope filtering
      switch (scope) {
        case 'city':
          if (location?.city) {
            query = query.eq('location_city', location.city).eq('scope', 'city');
          }
          break;
        case 'state':
          if (location?.state) {
            query = query.eq('location_state', location.state).in('scope', ['city', 'state']);
          }
          break;
        case 'country':
          if (location?.country) {
            query = query.eq('location_country', location.country).in('scope', ['city', 'state', 'country']);
          }
          break;
        case 'world':
        default:
          // No location filter for world scope
          break;
      }

      const { data: dreams, error } = await query.limit(10000);

      if (error) {
        console.error('❌ Count query error:', error);
        return 1;
      }

      const result = dreams?.length || 0;
      console.log(`   📊 Existing dreams count: ${result} (scope: ${scope}, dreamType: ${dreamType})`);
      
      return result;
    } catch (error) {
      console.error('❌ Total count error:', error);
      return 1;
    }
  }
}

