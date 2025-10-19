/**
 * Day Summary Processing Service
 * 
 * Handles extraction and processing of daily routine summaries
 * Extracts individual activities and generates embeddings for each
 */

export interface DaySummaryResult {
  activities: string[];
  activityCount: number;
  activityEmbeddings: number[][];
  isValid: boolean;
  error?: string;
}

export interface ActivityExtractionResult {
  activities: string[];
  success: boolean;
  error?: string;
}

export class DaySummaryService {
  
  /**
   * Validate if content is a valid day summary
   */
  validateDaySummary(content: string): { isValid: boolean; error?: string } {
    if (!content || content.trim().length < 10) {
      return {
        isValid: false,
        error: 'Day summary must be at least 10 characters long'
      };
    }

    if (content.length > 2000) {
      return {
        isValid: false,
        error: 'Day summary must be less than 2000 characters'
      };
    }

    // Check for day summary indicators (expanded to include emotional expressions)
    const dayIndicators = [
      'today', 'yesterday', 'this morning', 'this afternoon', 'this evening',
      'went to', 'did', 'had', 'ate', 'drank', 'saw', 'met', 'talked to',
      'worked on', 'studied', 'exercised', 'played', 'watched', 'listened to',
      'read', 'wrote', 'cooked', 'cleaned', 'shopped', 'drove', 'walked',
      'called', 'texted', 'emailed', 'visited', 'traveled', 'slept',
      // Emotional and reflective expressions
      'felt', 'was', 'were', 'am', 'is', 'are', 'wasted', 'spent', 'time',
      'lazy', 'productive', 'unproductive', 'boring', 'interesting', 'terrible',
      'amazing', 'awful', 'great', 'bad', 'good', 'difficult', 'easy',
      'stressed', 'relaxed', 'tired', 'energetic', 'sad', 'happy', 'angry',
      'frustrated', 'excited', 'nervous', 'calm', 'worried', 'confident'
    ];

    const lowerContent = content.toLowerCase();
    const hasIndicators = dayIndicators.some(indicator => 
      lowerContent.includes(indicator)
    );

    if (!hasIndicators) {
      return {
        isValid: false,
        error: 'Content does not appear to be a day summary. Please describe what you did today.'
      };
    }

    return { isValid: true };
  }

  /**
   * Extract individual activities from day summary text
   */
  extractActivities(content: string): ActivityExtractionResult {
    try {
      if (!content || content.trim().length === 0) {
        return {
          activities: [],
          success: false,
          error: 'Empty content provided'
        };
      }

      console.log(`📝 Extracting activities from: "${content.substring(0, 100)}..."`);

      // Normalize the content
      const normalizedContent = this.normalizeContent(content);
      
      // Split by common separators and sentence boundaries
      const sentences = this.splitIntoSentences(normalizedContent);
      
      // Extract activities from each sentence
      const activities: string[] = [];
      
      for (const sentence of sentences) {
        const extractedActivities = this.extractActivitiesFromSentence(sentence);
        activities.push(...extractedActivities);
      }

      // Clean and deduplicate activities
      const cleanedActivities = this.cleanAndDeduplicateActivities(activities);

      console.log(`✅ Extracted ${cleanedActivities.length} activities:`, cleanedActivities);

      return {
        activities: cleanedActivities,
        success: true
      };

    } catch (error) {
      console.error('❌ Activity extraction failed:', error);
      return {
        activities: [],
        success: false,
        error: error.message
      };
    }
  }

  /**
   * Process complete day summary with activity extraction and embedding generation
   */
  async processDaySummary(
    content: string,
    embeddingService: any // EmbeddingService instance
  ): Promise<DaySummaryResult> {
    try {
      // Validate day summary
      const validation = this.validateDaySummary(content);
      if (!validation.isValid) {
        return {
          activities: [],
          activityCount: 0,
          activityEmbeddings: [],
          isValid: false,
          error: validation.error
        };
      }

      // Extract activities
      const extractionResult = this.extractActivities(content);
      if (!extractionResult.success) {
        return {
          activities: [],
          activityCount: 0,
          activityEmbeddings: [],
          isValid: false,
          error: extractionResult.error
        };
      }

      const activities = extractionResult.activities;
      
      // Allow day summaries even if no specific activities can be extracted
      // This allows for emotional expressions and general day descriptions
      if (activities.length === 0) {
        console.log('📝 No specific activities extracted, but allowing as valid day summary');
        return {
          activities: [content], // Use the full content as a single "activity"
          activityCount: 1,
          activityEmbeddings: [], // Will be generated later
          isValid: true
        };
      }

      // Generate embeddings for each activity
      console.log(`🔮 Generating embeddings for ${activities.length} activities...`);
      const embeddingResult = await embeddingService.generateBatchEmbeddings(activities);
      
      if (!embeddingResult.success) {
        return {
          activities,
          activityCount: activities.length,
          activityEmbeddings: [],
          isValid: true, // Activities extracted successfully
          error: `Embedding generation failed: ${embeddingResult.errors?.join(', ')}`
        };
      }

      return {
        activities,
        activityCount: activities.length,
        activityEmbeddings: embeddingResult.embeddings,
        isValid: true
      };

    } catch (error) {
      console.error('❌ Day summary processing failed:', error);
      return {
        activities: [],
        activityCount: 0,
        activityEmbeddings: [],
        isValid: false,
        error: error.message
      };
    }
  }

  /**
   * Normalize content for better activity extraction
   */
  private normalizeContent(content: string): string {
    return content
      .toLowerCase()
      .trim()
      // Remove excessive whitespace
      .replace(/\s+/g, ' ')
      // Remove special characters but keep basic punctuation
      .replace(/[^\w\s.,!?-]/g, '')
      // Fix common contractions
      .replace(/\bdon't\b/g, 'do not')
      .replace(/\bdoesn't\b/g, 'does not')
      .replace(/\bdidn't\b/g, 'did not')
      .replace(/\bwon't\b/g, 'will not')
      .replace(/\bcan't\b/g, 'cannot')
      .replace(/\bI'm\b/g, 'I am')
      .replace(/\bI'll\b/g, 'I will')
      .replace(/\bI've\b/g, 'I have');
  }

  /**
   * Split content into sentences
   */
  private splitIntoSentences(content: string): string[] {
    // Split by sentence boundaries, commas, and common separators
    return content
      .split(/[.!?;,\n]+/)
      .map(sentence => sentence.trim())
      .filter(sentence => sentence.length > 0);
  }

  /**
   * Extract activities from a single sentence
   */
  private extractActivitiesFromSentence(sentence: string): string[] {
    const activities: string[] = [];
    
    // Common activity patterns
    const activityPatterns = [
      // Past tense verbs
      /(?:went|did|had|ate|drank|saw|met|talked|worked|studied|exercised|played|watched|listened|read|wrote|cooked|cleaned|shopped|drove|walked|called|texted|emailed|visited|traveled|slept)\s+([^.!?,\n]+)/g,
      // Present perfect
      /(?:have|has)\s+(?:been\s+)?(?:doing|working|studying|playing|watching|listening|reading|writing|cooking|cleaning|shopping|driving|walking|calling|texting|emailing|visiting|traveling|sleeping)\s+([^.!?,\n]+)/g,
      // Gerund forms
      /(?:doing|working|studying|playing|watching|listening|reading|writing|cooking|cleaning|shopping|driving|walking|calling|texting|emailing|visiting|traveling|sleeping)\s+([^.!?,\n]+)/g,
      // Simple present
      /(?:do|work|study|play|watch|listen|read|write|cook|clean|shop|drive|walk|call|text|email|visit|travel|sleep)\s+([^.!?,\n]+)/g
    ];

    for (const pattern of activityPatterns) {
      let match;
      while ((match = pattern.exec(sentence)) !== null) {
        const activity = match[0].trim();
        if (activity.length > 3 && activity.length < 100) {
          activities.push(activity);
        }
      }
    }

    // If no patterns matched, try to extract the whole sentence if it's short enough
    if (activities.length === 0 && sentence.length < 50) {
      activities.push(sentence);
    }

    return activities;
  }

  /**
   * Clean and deduplicate activities
   */
  private cleanAndDeduplicateActivities(activities: string[]): string[] {
    const cleaned = activities
      .map(activity => this.cleanActivity(activity))
      .filter(activity => activity.length > 0)
      .filter(activity => this.isValidActivity(activity));

    // Remove duplicates
    const unique = [...new Set(cleaned)];

    // Sort by length (shorter activities first)
    return unique.sort((a, b) => a.length - b.length);
  }

  /**
   * Clean individual activity
   */
  private cleanActivity(activity: string): string {
    return activity
      .trim()
      // Remove leading articles and pronouns
      .replace(/^(?:the|a|an|my|your|his|her|its|our|their|this|that|these|those)\s+/i, '')
      // Remove trailing punctuation
      .replace(/[.,!?;]+$/, '')
      // Remove extra whitespace
      .replace(/\s+/g, ' ')
      .trim();
  }

  /**
   * Check if activity is valid
   */
  private isValidActivity(activity: string): boolean {
    if (activity.length < 3 || activity.length > 100) {
      return false;
    }

    // Must contain at least one letter
    if (!/[a-zA-Z]/.test(activity)) {
      return false;
    }

    // Skip very common words that aren't activities
    const skipWords = ['the', 'and', 'or', 'but', 'in', 'on', 'at', 'to', 'for', 'of', 'with', 'by'];
    if (skipWords.includes(activity.toLowerCase())) {
      return false;
    }

    return true;
  }

  /**
   * Calculate activity overlap between two day summaries
   */
  calculateActivityOverlap(
    activities1: string[],
    activities2: string[],
    embeddings1: number[][],
    embeddings2: number[][],
    threshold: number = 0.7
  ): {
    overlapPercentage: number;
    matchedActivities: number;
    totalActivities: number;
  } {
    if (activities1.length === 0 || activities2.length === 0) {
      return {
        overlapPercentage: 0,
        matchedActivities: 0,
        totalActivities: Math.max(activities1.length, activities2.length)
      };
    }

    let matchedCount = 0;
    const totalActivities = Math.max(activities1.length, activities2.length);

    // For each activity in the first set, find the best match in the second set
    for (let i = 0; i < activities1.length; i++) {
      let bestMatch = 0;
      
      for (let j = 0; j < activities2.length; j++) {
        // Calculate cosine similarity between embeddings
        const similarity = this.calculateCosineSimilarity(embeddings1[i], embeddings2[j]);
        bestMatch = Math.max(bestMatch, similarity);
      }
      
      if (bestMatch >= threshold) {
        matchedCount++;
      }
    }

    const overlapPercentage = (matchedCount / totalActivities) * 100;

    return {
      overlapPercentage,
      matchedActivities: matchedCount,
      totalActivities
    };
  }

  /**
   * Calculate cosine similarity between two vectors
   */
  private calculateCosineSimilarity(vector1: number[], vector2: number[]): number {
    if (vector1.length !== vector2.length) {
      return 0;
    }

    let dotProduct = 0;
    let norm1 = 0;
    let norm2 = 0;

    for (let i = 0; i < vector1.length; i++) {
      dotProduct += vector1[i] * vector2[i];
      norm1 += vector1[i] * vector1[i];
      norm2 += vector2[i] * vector2[i];
    }

    norm1 = Math.sqrt(norm1);
    norm2 = Math.sqrt(norm2);

    if (norm1 === 0 || norm2 === 0) {
      return 0;
    }

    return dotProduct / (norm1 * norm2);
  }
}
