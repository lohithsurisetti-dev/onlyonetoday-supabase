declare const Deno: any;

/**
 * Advanced Embedding Service
 * 
 * Generates vector embeddings using HuggingFace Inference API
 * Supports both single content and batch processing for day summaries
 */

interface EmbeddingResult {
  embedding: number[];
  success: boolean;
  error?: string;
}

interface BatchEmbeddingResult {
  embeddings: number[][];
  success: boolean;
  errors?: string[];
}

export class EmbeddingService {
  private openaiToken: string;
  private openaiApiUrl = 'https://api.openai.com/v1';
  private model = 'text-embedding-3-small'; // Cheapest embedding model (1536 dimensions)

  constructor() {
    this.openaiToken = Deno.env.get('OPENAI_API_KEY') || '';
  }

  /**
   * Generate embedding for a single text
   */
  async generateEmbedding(text: string): Promise<EmbeddingResult> {
    try {
      if (!text || text.trim().length === 0) {
        return {
          embedding: [],
          success: false,
          error: 'Empty text provided'
        };
      }

      // Normalize text for better embedding quality
      const normalizedText = this.normalizeText(text);
      
      console.log(`🔮 Generating embedding for: "${normalizedText.substring(0, 50)}..."`);

      const response = await fetch(`${this.openaiApiUrl}/embeddings`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${this.openaiToken}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ 
          input: normalizedText,
          model: this.model
        }),
      });

      if (!response.ok) {
        const errorText = await response.text();
        console.error(`❌ OpenAI API error: ${response.status} - ${errorText}`);
        
        // Fallback: Generate a simple hash-based embedding
        console.log('🔄 Using fallback hash-based embedding...');
        const fallbackEmbedding = this.generateFallbackEmbedding(normalizedText);
        return {
          embedding: fallbackEmbedding,
          success: true
        };
      }

      const result = await response.json();
      
      if (result.data && Array.isArray(result.data) && result.data.length > 0) {
        const embedding = result.data[0].embedding;
        console.log(`✅ Generated embedding: ${embedding.length} dimensions`);
        
        return {
          embedding: embedding,
          success: true
        };
      }

      return {
        embedding: [],
        success: false,
        error: 'Invalid response format'
      };

    } catch (error) {
      console.error('❌ Embedding generation failed:', error);
      return {
        embedding: [],
        success: false,
        error: error.message
      };
    }
  }

  /**
   * Generate embeddings for multiple texts (batch processing)
   * Used for day summary activity extraction
   */
  async generateBatchEmbeddings(texts: string[]): Promise<BatchEmbeddingResult> {
    try {
      if (!texts || texts.length === 0) {
        return {
          embeddings: [],
          success: false,
          errors: ['No texts provided']
        };
      }

      console.log(`🔮 Generating ${texts.length} embeddings in batch...`);

      // OpenAI supports batch processing, so we can send all texts at once
      const response = await fetch(`${this.openaiApiUrl}/embeddings`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${this.openaiToken}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ 
          input: texts,
          model: this.model
        }),
      });

      if (!response.ok) {
        const errorText = await response.text();
        console.error(`❌ OpenAI batch API error: ${response.status} - ${errorText}`);
        return {
          embeddings: [],
          success: false,
          errors: [`API error: ${response.status}`]
        };
      }

      const result = await response.json();
      const embeddings: number[][] = [];
      const errors: string[] = [];

      if (result.data && Array.isArray(result.data)) {
        // Sort by index to maintain order
        result.data.sort((a: any, b: any) => a.index - b.index);
        
        for (const item of result.data) {
          if (item.embedding) {
            embeddings[item.index] = item.embedding;
          } else {
            errors.push(`Text ${item.index}: No embedding returned`);
          }
        }
      } else {
        errors.push('Invalid response format');
      }

      console.log(`✅ Generated ${embeddings.length} embeddings successfully`);

      return {
        embeddings: embeddings.filter(e => e !== null),
        success: errors.length === 0,
        errors: errors.length > 0 ? errors : undefined
      };

    } catch (error) {
      console.error('❌ Batch embedding generation failed:', error);
      return {
        embeddings: [],
        success: false,
        errors: [error.message]
      };
    }
  }

  /**
   * Calculate cosine similarity between two embeddings
   */
  calculateSimilarity(embedding1: number[], embedding2: number[]): number {
    if (embedding1.length !== embedding2.length) {
      throw new Error('Embeddings must have the same dimension');
    }

    let dotProduct = 0;
    let norm1 = 0;
    let norm2 = 0;

    for (let i = 0; i < embedding1.length; i++) {
      dotProduct += embedding1[i] * embedding2[i];
      norm1 += embedding1[i] * embedding1[i];
      norm2 += embedding2[i] * embedding2[i];
    }

    norm1 = Math.sqrt(norm1);
    norm2 = Math.sqrt(norm2);

    if (norm1 === 0 || norm2 === 0) {
      return 0;
    }

    return dotProduct / (norm1 * norm2);
  }

  /**
   * Normalize text for better embedding quality
   */
  private normalizeText(text: string): string {
    return text
      .toLowerCase()
      .trim()
      // Remove excessive whitespace
      .replace(/\s+/g, ' ')
      // Remove special characters but keep basic punctuation
      .replace(/[^\w\s.,!?-]/g, '')
      // Limit length to avoid token limits
      .substring(0, 500);
  }

  /**
   * Validate embedding dimensions
   */
  validateEmbedding(embedding: number[]): boolean {
    return Array.isArray(embedding) && 
           embedding.length === 1536 && 
           embedding.every(val => typeof val === 'number' && !isNaN(val));
  }

  /**
   * Get embedding statistics
   */
  getEmbeddingStats(embedding: number[]): {
    dimensions: number;
    magnitude: number;
    min: number;
    max: number;
    mean: number;
  } {
    if (!this.validateEmbedding(embedding)) {
      throw new Error('Invalid embedding');
    }

    const magnitude = Math.sqrt(embedding.reduce((sum, val) => sum + val * val, 0));
    const min = Math.min(...embedding);
    const max = Math.max(...embedding);
    const mean = embedding.reduce((sum, val) => sum + val, 0) / embedding.length;

    return {
      dimensions: embedding.length,
      magnitude,
      min,
      max,
      mean
    };
  }

  /**
   * Generate a fallback embedding using hash-based approach
   * This is used when the OpenAI API is unavailable
   */
  private generateFallbackEmbedding(text: string): number[] {
    const embedding = new Array(1536).fill(0);
    
    // Simple hash-based approach
    let hash = 0;
    for (let i = 0; i < text.length; i++) {
      const char = text.charCodeAt(i);
      hash = ((hash << 5) - hash) + char;
      hash = hash & hash; // Convert to 32-bit integer
    }
    
    // Distribute the hash across the embedding dimensions
    for (let i = 0; i < 1536; i++) {
      const seed = hash + i;
      const random = Math.sin(seed) * 10000;
      embedding[i] = random - Math.floor(random);
    }
    
    // Normalize the embedding
    const magnitude = Math.sqrt(embedding.reduce((sum, val) => sum + val * val, 0));
    if (magnitude > 0) {
      for (let i = 0; i < 1536; i++) {
        embedding[i] = embedding[i] / magnitude;
      }
    }
    
    return embedding;
  }
}
