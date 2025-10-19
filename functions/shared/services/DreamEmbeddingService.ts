declare const Deno: any;

import { EmbeddingService } from './EmbeddingService.ts';
import { DreamPost, DreamEmbedding, DreamMatch, DreamEmotion, DreamSymbol } from '../types/DreamTypes.ts';

/**
 * Enhanced Embedding Service for Dreams
 * Combines content, symbol, and emotion embeddings for richer matching
 */

export class DreamEmbeddingService extends EmbeddingService {
  
  /**
   * Generate comprehensive dream embedding
   */
  async generateDreamEmbedding(dream: DreamPost): Promise<DreamEmbedding> {
    try {
      console.log(`🌙 Generating dream embedding for ${dream.dreamType}...`);

      // Generate content embedding
      const contentResult = await this.generateEmbedding(dream.content);
      if (!contentResult.success) {
        throw new Error(`Content embedding failed: ${contentResult.error}`);
      }

      // Generate symbol embedding
      const symbolText = dream.symbols.length > 0 ? dream.symbols.join(', ') : 'general symbols';
      const symbolResult = await this.generateEmbedding(symbolText);
      if (!symbolResult.success) {
        throw new Error(`Symbol embedding failed: ${symbolResult.error}`);
      }

      // Generate emotion embedding
      const emotionText = dream.emotions.length > 0 ? dream.emotions.join(', ') : 'neutral emotions';
      const emotionResult = await this.generateEmbedding(emotionText);
      if (!emotionResult.success) {
        throw new Error(`Emotion embedding failed: ${emotionResult.error}`);
      }

      // Combine embeddings using weighted average
      const combinedEmbedding = this.combineDreamEmbeddings(
        contentResult.embedding,
        symbolResult.embedding,
        emotionResult.embedding,
        dream.dreamType
      );

      return {
        contentEmbedding: contentResult.embedding,
        symbolEmbedding: symbolResult.embedding,
        emotionEmbedding: emotionResult.embedding,
        combinedEmbedding: combinedEmbedding
      };

    } catch (error) {
      console.error('❌ Dream embedding generation failed:', error);
      throw error;
    }
  }

  /**
   * Find similar dreams using multiple matching strategies
   */
  async findSimilarDreams(
    dreamEmbedding: DreamEmbedding,
    dream: DreamPost,
    limit: number = 10
  ): Promise<DreamMatch[]> {
    try {
      console.log(`🔍 Finding similar dreams...`);

      // This would typically query the database for similar embeddings
      // For now, we'll return a mock result structure
      const matches: DreamMatch[] = [];

      // In a real implementation, you would:
      // 1. Query the database for posts with similar combined embeddings
      // 2. Calculate similarity scores for each match
      // 3. Identify shared symbols and emotions
      // 4. Return ranked results

      return matches;

    } catch (error) {
      console.error('❌ Dream matching failed:', error);
      return [];
    }
  }

  /**
   * Combine multiple embeddings with weights based on dream type
   */
  private combineDreamEmbeddings(
    contentEmbedding: number[],
    symbolEmbedding: number[],
    emotionEmbedding: number[],
    dreamType: string
  ): number[] {
    // Define weights based on dream type
    const weights = this.getDreamTypeWeights(dreamType);
    
    const combined = new Array(contentEmbedding.length).fill(0);
    
    for (let i = 0; i < contentEmbedding.length; i++) {
      combined[i] = 
        contentEmbedding[i] * weights.content +
        symbolEmbedding[i] * weights.symbol +
        emotionEmbedding[i] * weights.emotion;
    }

    // Normalize the combined embedding
    return this.normalizeEmbedding(combined);
  }

  /**
   * Get weights for different embedding types based on dream type
   */
  private getDreamTypeWeights(dreamType: string): { content: number; symbol: number; emotion: number } {
    switch (dreamType) {
      case 'night_dream':
        return { content: 0.4, symbol: 0.4, emotion: 0.2 };
      case 'daydream':
        return { content: 0.5, symbol: 0.2, emotion: 0.3 };
      case 'lucid_dream':
        return { content: 0.3, symbol: 0.3, emotion: 0.4 };
      case 'nightmare':
        return { content: 0.3, symbol: 0.2, emotion: 0.5 };
      default:
        return { content: 0.4, symbol: 0.3, emotion: 0.3 };
    }
  }

  /**
   * Normalize embedding vector
   */
  private normalizeEmbedding(embedding: number[]): number[] {
    const magnitude = Math.sqrt(embedding.reduce((sum, val) => sum + val * val, 0));
    if (magnitude === 0) return embedding;
    
    return embedding.map(val => val / magnitude);
  }

  /**
   * Calculate dream-specific similarity
   */
  calculateDreamSimilarity(
    embedding1: DreamEmbedding,
    embedding2: DreamEmbedding,
    dream1: DreamPost,
    dream2: DreamPost
  ): number {
    // Calculate combined similarity
    const combinedSimilarity = this.calculateSimilarity(
      embedding1.combinedEmbedding,
      embedding2.combinedEmbedding
    );

    // Calculate symbol overlap bonus
    const symbolOverlap = this.calculateSymbolOverlap(dream1.symbols, dream2.symbols);
    const symbolBonus = symbolOverlap * 0.1; // 10% bonus per shared symbol

    // Calculate emotion overlap bonus
    const emotionOverlap = this.calculateEmotionOverlap(dream1.emotions, dream2.emotions);
    const emotionBonus = emotionOverlap * 0.05; // 5% bonus per shared emotion

    // Calculate dream type bonus
    const typeBonus = dream1.dreamType === dream2.dreamType ? 0.05 : 0;

    // Combine all factors
    const finalSimilarity = Math.min(1.0, combinedSimilarity + symbolBonus + emotionBonus + typeBonus);

    return finalSimilarity;
  }

  /**
   * Calculate symbol overlap between two dreams
   */
  private calculateSymbolOverlap(symbols1: DreamSymbol[], symbols2: DreamSymbol[]): number {
    const set1 = new Set(symbols1);
    const set2 = new Set(symbols2);
    const intersection = new Set([...set1].filter(x => set2.has(x)));
    return intersection.size;
  }

  /**
   * Calculate emotion overlap between two dreams
   */
  private calculateEmotionOverlap(emotions1: DreamEmotion[], emotions2: DreamEmotion[]): number {
    const set1 = new Set(emotions1);
    const set2 = new Set(emotions2);
    const intersection = new Set([...set1].filter(x => set2.has(x)));
    return intersection.size;
  }

  /**
   * Extract dream symbols from content using AI
   */
  async extractDreamSymbols(content: string): Promise<DreamSymbol[]> {
    try {
      // This would use AI to extract symbols from dream content
      // For now, we'll use a simple keyword matching approach
      const symbolKeywords: Record<DreamSymbol, string[]> = {
        'flying': ['flying', 'soaring', 'air', 'sky', 'wings'],
        'falling': ['falling', 'dropping', 'plummeting', 'descending'],
        'water': ['water', 'ocean', 'sea', 'river', 'lake', 'swimming', 'drowning'],
        'fire': ['fire', 'flame', 'burning', 'heat', 'smoke'],
        'animals': ['animal', 'dog', 'cat', 'bird', 'fish', 'bear', 'lion'],
        'people': ['person', 'people', 'friend', 'family', 'stranger'],
        'buildings': ['house', 'building', 'room', 'door', 'window'],
        'vehicles': ['car', 'bus', 'train', 'plane', 'bike'],
        'nature': ['tree', 'forest', 'mountain', 'grass', 'flower'],
        'darkness': ['dark', 'black', 'shadow', 'night'],
        'light': ['light', 'bright', 'sun', 'moon', 'star'],
        'colors': ['red', 'blue', 'green', 'yellow', 'purple', 'orange'],
        'food': ['food', 'eat', 'meal', 'bread', 'fruit'],
        'clothing': ['clothes', 'shirt', 'dress', 'shoes', 'hat'],
        'money': ['money', 'cash', 'dollar', 'coin', 'rich'],
        'technology': ['computer', 'phone', 'screen', 'internet'],
        'music': ['music', 'song', 'sound', 'melody', 'rhythm'],
        'art': ['art', 'paint', 'draw', 'picture', 'color'],
        'childhood': ['child', 'kid', 'young', 'school', 'play'],
        'work': ['work', 'job', 'office', 'meeting', 'boss'],
        'school': ['school', 'class', 'teacher', 'student', 'homework'],
        'home': ['home', 'house', 'family', 'room', 'bed'],
        'travel': ['travel', 'trip', 'journey', 'vacation', 'adventure'],
        'death': ['death', 'die', 'dead', 'grave', 'funeral'],
        'birth': ['birth', 'born', 'baby', 'new', 'life'],
        'transformation': ['change', 'transform', 'become', 'turn into'],
        'chase': ['chase', 'running', 'pursue', 'follow', 'escape'],
        'escape': ['escape', 'run away', 'flee', 'hide', 'avoid'],
        'search': ['search', 'look for', 'find', 'seek', 'hunt'],
        'discovery': ['discover', 'find', 'reveal', 'uncover', 'learn']
      };

      const foundSymbols: DreamSymbol[] = [];
      const lowerContent = content.toLowerCase();

      for (const [symbol, keywords] of Object.entries(symbolKeywords)) {
        for (const keyword of keywords) {
          if (lowerContent.includes(keyword)) {
            foundSymbols.push(symbol as DreamSymbol);
            break; // Only add each symbol once
          }
        }
      }

      return foundSymbols;

    } catch (error) {
      console.error('❌ Symbol extraction failed:', error);
      return [];
    }
  }

  /**
   * Extract dream emotions from content using AI
   */
  async extractDreamEmotions(content: string): Promise<DreamEmotion[]> {
    try {
      // This would use AI to extract emotions from dream content
      // For now, we'll use a simple keyword matching approach
      const emotionKeywords: Record<DreamEmotion, string[]> = {
        'joy': ['happy', 'joy', 'excited', 'elated', 'cheerful', 'delighted'],
        'fear': ['afraid', 'scared', 'fear', 'terrified', 'panic', 'anxiety'],
        'confusion': ['confused', 'lost', 'unclear', 'mysterious', 'puzzled'],
        'wonder': ['amazed', 'wonder', 'awe', 'marvel', 'fascinated'],
        'peace': ['peaceful', 'calm', 'serene', 'tranquil', 'relaxed'],
        'anxiety': ['anxious', 'worried', 'nervous', 'stressed', 'uneasy'],
        'excitement': ['excited', 'thrilled', 'energetic', 'pumped', 'enthusiastic'],
        'sadness': ['sad', 'depressed', 'melancholy', 'grief', 'sorrow'],
        'anger': ['angry', 'mad', 'furious', 'rage', 'irritated'],
        'love': ['love', 'loving', 'affection', 'romance', 'passion'],
        'nostalgia': ['nostalgic', 'memories', 'past', 'childhood', 'remember'],
        'curiosity': ['curious', 'interested', 'intrigued', 'wondering'],
        'freedom': ['free', 'liberated', 'unbound', 'independent'],
        'trapped': ['trapped', 'stuck', 'confined', 'imprisoned'],
        'powerful': ['powerful', 'strong', 'mighty', 'dominant'],
        'vulnerable': ['vulnerable', 'weak', 'exposed', 'defenseless'],
        'mysterious': ['mysterious', 'unknown', 'hidden', 'secret'],
        'familiar': ['familiar', 'known', 'recognized', 'comfortable']
      };

      const foundEmotions: DreamEmotion[] = [];
      const lowerContent = content.toLowerCase();

      for (const [emotion, keywords] of Object.entries(emotionKeywords)) {
        for (const keyword of keywords) {
          if (lowerContent.includes(keyword)) {
            foundEmotions.push(emotion as DreamEmotion);
            break; // Only add each emotion once
          }
        }
      }

      return foundEmotions;

    } catch (error) {
      console.error('❌ Emotion extraction failed:', error);
      return [];
    }
  }
}
