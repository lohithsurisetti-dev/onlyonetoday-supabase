/**
 * OpenAI Embedding Service
 * Replaces Transformers.js with OpenAI API for Edge Function compatibility
 * 
 * Model: text-embedding-3-small
 * Dimensions: 384 (same as all-MiniLM-L6-v2)
 * Cost: $0.00002 per 1,000 tokens (~$0.00002 per post)
 * Speed: 50-100ms
 */

import { Logger } from '../utils/logger.ts';
import { PerformanceTracker } from '../utils/performance.ts';

export class OpenAIEmbeddingService {
  private static apiKey: string | undefined;

  /**
   * Initialize with API key
   */
  static initialize(apiKey: string) {
    this.apiKey = apiKey;
  }

  /**
   * Generate embedding vector for text using OpenAI API
   * 
   * @param text - Input text (e.g., "ate pizza")
   * @returns Array of 384 floats representing semantic meaning
   */
  static async generate(text: string): Promise<number[]> {
    const tracker = new PerformanceTracker('openai_embedding_generation');

    try {
      if (!this.apiKey) {
        const envKey = typeof Deno !== 'undefined' ? Deno.env.get('OPENAI_API_KEY') : undefined;
        if (!envKey) {
          throw new Error('OPENAI_API_KEY not configured');
        }
        this.apiKey = envKey;
      }

      // Normalize text
      const normalizedText = text.toLowerCase().trim();

      if (!normalizedText || normalizedText.length < 3) {
        throw new Error('Text too short for embedding generation');
      }

      // Call OpenAI API
      const response = await fetch('https://api.openai.com/v1/embeddings', {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${this.apiKey}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          model: 'text-embedding-3-small',
          input: normalizedText,
          dimensions: 384, // Match pgvector dimensions
        }),
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(`OpenAI API error: ${JSON.stringify(errorData)}`);
      }

      const data = await response.json();
      const embedding = data.data[0].embedding;

      tracker.end({ 
        textLength: text.length, 
        dimensions: embedding.length,
        tokens: data.usage.total_tokens
      });

      return embedding;
    } catch (error) {
      tracker.error(error);
      Logger.error('OpenAI embedding generation failed', {
        text: text.substring(0, 50),
        error: error instanceof Error ? error.message : 'Unknown error'
      });
      throw error;
    }
  }

  /**
   * Batch generate embeddings (more efficient)
   * 
   * @param texts - Array of texts to embed
   * @returns Array of embedding vectors
   */
  static async generateBatch(texts: string[]): Promise<number[][]> {
    const tracker = new PerformanceTracker('openai_embedding_generation_batch');

    try {
      if (!this.apiKey) {
        const envKey = typeof Deno !== 'undefined' ? Deno.env.get('OPENAI_API_KEY') : undefined;
        if (!envKey) {
          throw new Error('OPENAI_API_KEY not configured');
        }
        this.apiKey = envKey;
      }

      const normalizedTexts = texts.map(t => t.toLowerCase().trim());

      const response = await fetch('https://api.openai.com/v1/embeddings', {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${this.apiKey}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          model: 'text-embedding-3-small',
          input: normalizedTexts,
          dimensions: 384,
        }),
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(`OpenAI API error: ${JSON.stringify(errorData)}`);
      }

      const data = await response.json();
      const embeddings = data.data.map((item: any) => item.embedding);

      tracker.end({ 
        count: texts.length,
        totalTokens: data.usage.total_tokens
      });

      return embeddings;
    } catch (error) {
      tracker.error(error);
      throw error;
    }
  }

  /**
   * Calculate cosine similarity between two embeddings
   * 
   * @param a - First embedding vector
   * @param b - Second embedding vector
   * @returns Similarity score (0-1)
   */
  static cosineSimilarity(a: number[], b: number[]): number {
    if (a.length !== b.length) {
      throw new Error('Embeddings must have same dimensions');
    }

    let dotProduct = 0;
    let normA = 0;
    let normB = 0;

    for (let i = 0; i < a.length; i++) {
      dotProduct += a[i] * b[i];
      normA += a[i] * a[i];
      normB += b[i] * b[i];
    }

    const magnitude = Math.sqrt(normA) * Math.sqrt(normB);

    if (magnitude === 0) {
      return 0;
    }

    return dotProduct / magnitude;
  }

  /**
   * Get model information
   */
  static getModelInfo() {
    return {
      name: 'text-embedding-3-small',
      provider: 'OpenAI',
      dimensions: 384,
      cost: '$0.00002 per 1K tokens',
      avgSpeed: '50-100ms',
      accuracy: 'Better than local models',
      initialized: this.apiKey !== undefined
    };
  }
}

