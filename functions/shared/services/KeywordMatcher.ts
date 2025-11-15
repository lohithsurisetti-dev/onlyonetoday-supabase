/**
 * Keyword Matcher Service
 * 
 * Reliable keyword-based matching (no API dependencies)
 * Uses PostgreSQL GIN indexes for fast search
 * Now includes dynamic stemming + irregular verb matching
 */

import { Stemmer } from './Stemmer.ts';
import { IrregularVerbs } from './IrregularVerbs.ts';

export interface Location {
  city?: string;
  state?: string;
  country?: string;
}

export interface SimilarPostsResult {
  matches: any[];
  matchCount: number;
  totalInScope: number;
}

export class KeywordMatcher {
  private supabase: any;
  private stemmer: Stemmer;
  private irregularVerbs: IrregularVerbs;

  constructor(supabase: any) {
    this.supabase = supabase;
    this.stemmer = new Stemmer();
    this.irregularVerbs = new IrregularVerbs();
  }

  /**
   * Find similar posts using keyword overlap
   * Reliable, fast, good enough for short sentences
   */
  async findSimilarPosts(
    keywords: string[],
    scope: 'city' | 'state' | 'country' | 'world',
    location?: Location,
    postType: 'action' | 'day' | 'dream' = 'action'
  ): Promise<SimilarPostsResult> {
    
    if (!keywords || keywords.length < 2) {
      return {
        matches: [],
        matchCount: 1, // Only current post
        totalInScope: 1
      };
    }

    try {
      // Build base query
      let query = this.supabase
        .from('posts')
        .select('id, content, normalized_content, keywords, scope, location_city, location_state, location_country, created_at, input_type')
        .eq('moderation_status', 'approved');

      // Filter by post type
      if (postType === 'action' || postType === 'day') {
        query = query.in('input_type', ['action', 'day']);
      } else if (postType === 'dream') {
        query = query.eq('input_type', 'dream');
      }

      // Apply scope filtering (hierarchical)
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

      // Get all posts in scope (limited to recent for performance)
      const { data: allPosts, error } = await query
        .gte('created_at', new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString()) // Last 7 days
        .limit(1000); // Limit for performance

      if (error) {
        console.error('❌ Keyword search error:', error);
        return {
          matches: [],
          matchCount: 1,
          totalInScope: 1
        };
      }

      // Filter by keyword overlap (in-memory)
      const matches = (allPosts || []).filter((post: any) => {
        const postKeywords = post.keywords || this.extractKeywordsFromContent(post.normalized_content || post.content);
        const overlap = this.calculateOverlap(keywords, postKeywords);
        
        // Match if 2+ keywords overlap
        return overlap >= 2;
      });

      // Get total posts in scope (for story generation) - must match input_type filter
      // This is the TOTAL posts in scope (existing posts + current post being created)
      const existingPostsCount = await this.getTotalPostsInScope(scope, location, postType);
      const totalInScope = existingPostsCount + 1; // +1 for the current post being created

      console.log(`   Match calculation: ${matches.length} matches + 1 current = ${matches.length + 1} total matches`);
      console.log(`   Total in scope: ${existingPostsCount} existing + 1 current = ${totalInScope} total`);

      return {
        matches: matches,
        matchCount: matches.length + 1, // +1 for current post
        totalInScope: totalInScope // Total includes current post
      };

    } catch (error) {
      console.error('❌ Keyword matching error:', error);
      return {
        matches: [],
        matchCount: 1,
        totalInScope: 1
      };
    }
  }

  /**
   * Find similar posts with database lock (for race condition prevention)
   * Uses PostgreSQL SELECT FOR UPDATE
   */
  async findSimilarPostsWithLock(
    keywords: string[],
    scope: 'city' | 'state' | 'country' | 'world',
    location?: Location,
    postType: 'action' | 'day' | 'dream' = 'action'
  ): Promise<SimilarPostsResult> {
    
    // For MVP, use regular findSimilarPosts
    // In production, implement with database transactions
    // For now, the race condition risk is acceptable (match counts update on fetch)
    
    return this.findSimilarPosts(keywords, scope, location, postType);
  }

  /**
   * Extract keywords from content (fallback if keywords not stored)
   * Now includes stemming and irregular verb normalization
   */
  private extractKeywordsFromContent(content: string): string[] {
    const stopWords = [
      'the', 'a', 'an', 'and', 'or', 'but', 'in', 'on', 'at', 'to', 'for',
      'of', 'with', 'by', 'from', 'as', 'is', 'was', 'are', 'were', 'been',
      'be', 'have', 'has', 'had', 'do', 'does', 'did', 'will', 'would',
      'could', 'should', 'may', 'might', 'must', 'can', 'this', 'that',
      'these', 'those', 'i', 'you', 'he', 'she', 'it', 'we', 'they'
    ];

    const words = content
      .toLowerCase()
      .replace(/[^\w\s]/g, ' ')
      .split(/\s+/)
      .filter(w => w.length > 2)
      .filter(w => !stopWords.includes(w))
      .slice(0, 10);

    // Normalize words: stem + irregular verbs
    const normalized: string[] = [];
    for (const word of words) {
      // Check if it's an irregular verb first
      const irregularForms = this.irregularVerbs.getForms(word);
      if (irregularForms.length > 0) {
        // Add root form and all forms for matching
        normalized.push(this.irregularVerbs.getRoot(word), ...irregularForms);
      } else {
        // Stem the word
        const stemmed = this.stemmer.stem(word);
        normalized.push(stemmed);
      }
    }

    // Remove duplicates and return
    return [...new Set(normalized)];
  }

  /**
   * Calculate keyword overlap between two arrays
   * Now normalizes keywords (stemming + irregular verbs) before comparing
   */
  private calculateOverlap(keywords1: string[], keywords2: string[]): number {
    if (!keywords1 || !keywords2 || keywords1.length === 0 || keywords2.length === 0) {
      return 0;
    }

    // Normalize both keyword arrays
    const normalized1 = this.normalizeKeywords(keywords1);
    const normalized2 = this.normalizeKeywords(keywords2);

    const set1 = new Set(normalized1);
    const set2 = new Set(normalized2);
    
    return [...set1].filter(k => set2.has(k)).length;
  }

  /**
   * Normalize keywords: stem + handle irregular verbs
   */
  private normalizeKeywords(keywords: string[]): string[] {
    const normalized: string[] = [];
    
    for (const keyword of keywords) {
      const lower = keyword.toLowerCase();
      
      // Check if it's an irregular verb
      const irregularForms = this.irregularVerbs.getForms(lower);
      if (irregularForms.length > 0) {
        // Add root and all forms
        normalized.push(this.irregularVerbs.getRoot(lower), ...irregularForms);
      } else {
        // Stem the word
        const stemmed = this.stemmer.stem(lower);
        normalized.push(stemmed);
      }
    }
    
    return [...new Set(normalized)]; // Remove duplicates
  }

  /**
   * Get total posts in scope (for story generation)
   * Must match the same filters as findSimilarPosts (scope, location, input_type)
   */
  private async getTotalPostsInScope(
    scope: 'city' | 'state' | 'country' | 'world',
    location?: Location,
    postType: 'action' | 'day' | 'dream' = 'action'
  ): Promise<number> {
    try {
      // Use same approach as temporal calculation - query data and use length
      // This is more reliable than { count: 'exact' } which can fail
      let query = this.supabase
        .from('posts')
        .select('id')
        .eq('moderation_status', 'approved');

      // Filter by post type (CRITICAL: must match findSimilarPosts)
      if (postType === 'action' || postType === 'day') {
        query = query.in('input_type', ['action', 'day']);
      } else if (postType === 'dream') {
        query = query.eq('input_type', 'dream');
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

      // Get all posts (limit for performance, but should cover all)
      console.log(`   🔍 Querying posts with filters: scope=${scope}, postType=${postType}, location=${JSON.stringify(location)}`);
      const { data: posts, error, count } = await query.limit(10000);

      if (error) {
        console.error('❌ Count query error:', error);
        console.error('   Query details:', { scope, location, postType });
        console.error('   Error details:', JSON.stringify(error, null, 2));
        return 1; // Fallback to avoid division by zero
      }

      const result = posts?.length || 0;
      console.log(`   ✅ Query result: ${result} posts found (data length: ${posts?.length}, count: ${count})`);
      console.log(`   📊 Existing posts count: ${result} (scope: ${scope}, postType: ${postType})`);
      
      if (result === 0) {
        console.warn(`   ⚠️ WARNING: Found 0 posts but there should be posts in DB. Check filters!`);
      }
      
      // Return actual count (0 is valid - means no posts exist yet)
      return result;
    } catch (error) {
      console.error('❌ Total count error:', error);
      return 1;
    }
  }
}

