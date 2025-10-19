declare const Deno: any;

/**
 * Reusable Moderation Pipeline
 * Handles content moderation for all user inputs (posts, dreams, comments, etc.)
 */

export interface ModerationResult {
  approved: boolean;
  reason?: string;
  confidence: number;
  flags: string[];
  suggestions?: string[];
}

export interface ModerationConfig {
  strictMode: boolean;
  allowDreams: boolean;
  allowSymbolicContent: boolean;
  maxLength: number;
  minLength: number;
}

export class ModerationPipeline {
  private config: ModerationConfig;

  constructor(config: Partial<ModerationConfig> = {}) {
    this.config = {
      strictMode: false,
      allowDreams: true,
      allowSymbolicContent: true,
      maxLength: 2000,
      minLength: 10,
      ...config
    };
  }

  /**
   * Main moderation method - processes any user content
   */
  async moderateContent(
    content: string, 
    contentType: 'post' | 'dream' | 'comment' | 'profile' = 'post',
    additionalContext?: any
  ): Promise<ModerationResult> {
    try {
      console.log('🛡️ Starting moderation with timeout...');
      console.log('📊 Moderation context:', {
        contentLength: content.length,
        contentType,
        additionalContext: JSON.stringify(additionalContext)
      });
      
      // Add timeout to prevent hanging
      const timeoutPromise = new Promise<ModerationResult>((_, reject) => {
        setTimeout(() => {
          console.log('⏰ Moderation timeout reached');
          reject(new Error('Moderation timeout'));
        }, 5000); // 5 second timeout
      });

      const moderationPromise = this.performModeration(content, contentType, additionalContext);
      
      const result = await Promise.race([moderationPromise, timeoutPromise]);
      console.log('✅ Moderation completed successfully');
      return result;

    } catch (error) {
      console.error('❌ Moderation pipeline error:', error);
      console.error('❌ Error details:', {
        name: error.name,
        message: error.message,
        stack: error.stack
      });
      // If moderation fails or times out, allow content but flag it
      return {
        approved: true,
        confidence: 0.5,
        flags: ['moderation_error'],
        reason: 'Moderation system error - content allowed'
      };
    }
  }

  private async performModeration(
    content: string, 
    contentType: 'post' | 'dream' | 'comment' | 'profile' = 'post',
    additionalContext?: any
  ): Promise<ModerationResult> {
    console.log('🔍 Starting basic validation...');
    // Basic validation
    const basicCheck = this.validateBasic(content);
    if (!basicCheck.approved) {
      console.log('❌ Basic validation failed:', basicCheck.reason);
      return basicCheck;
    }
    console.log('✅ Basic validation passed');

    console.log('🔍 Starting content validation...');
    // Content-specific checks
    const contentCheck = await this.validateContent(content, contentType, additionalContext);
    if (!contentCheck.approved) {
      console.log('❌ Content validation failed:', contentCheck.reason);
      return contentCheck;
    }
    console.log('✅ Content validation passed');

    console.log('🔍 Starting toxicity check...');
    // Toxicity check
    const toxicityCheck = await this.checkToxicity(content);
    if (!toxicityCheck.approved) {
      console.log('❌ Toxicity check failed:', toxicityCheck.reason);
      return toxicityCheck;
    }
    console.log('✅ Toxicity check passed');

    console.log('🔍 Starting spam check...');
    // Spam check
    const spamCheck = await this.checkSpam(content);
    if (!spamCheck.approved) {
      console.log('❌ Spam check failed:', spamCheck.reason);
      return spamCheck;
    }
    console.log('✅ Spam check passed');

    // Dream-specific checks
    if (contentType === 'dream') {
      console.log('🔍 Starting dream-specific checks...');
      const dreamCheck = await this.validateDreamContent(content, additionalContext);
      if (!dreamCheck.approved) {
        console.log('❌ Dream check failed:', dreamCheck.reason);
        return dreamCheck;
      }
      console.log('✅ Dream check passed');
    }

    console.log('✅ All moderation checks passed');
    // All checks passed
    return {
      approved: true,
      confidence: 0.95,
      flags: [],
      suggestions: this.generateSuggestions(content, contentType)
    };
  }

  /**
   * Basic content validation
   */
  private validateBasic(content: string): ModerationResult {
    if (!content || typeof content !== 'string') {
      return {
        approved: false,
        reason: 'Content is required',
        confidence: 1.0,
        flags: ['missing_content']
      };
    }

    const trimmed = content.trim();
    
    if (trimmed.length < this.config.minLength) {
      return {
        approved: false,
        reason: `Content too short (minimum ${this.config.minLength} characters)`,
        confidence: 1.0,
        flags: ['too_short']
      };
    }

    if (trimmed.length > this.config.maxLength) {
      return {
        approved: false,
        reason: `Content too long (maximum ${this.config.maxLength} characters)`,
        confidence: 1.0,
        flags: ['too_long']
      };
    }

    return {
      approved: true,
      confidence: 0.9,
      flags: []
    };
  }

  /**
   * Content-specific validation
   */
  private async validateContent(
    content: string, 
    contentType: string, 
    additionalContext?: any
  ): Promise<ModerationResult> {
    // Check for excessive repetition
    if (this.hasExcessiveRepetition(content)) {
      return {
        approved: false,
        reason: 'Content contains excessive repetition',
        confidence: 0.8,
        flags: ['repetitive']
      };
    }

    // Check for gibberish
    if (this.isGibberish(content)) {
      return {
        approved: false,
        reason: 'Content appears to be gibberish',
        confidence: 0.7,
        flags: ['gibberish']
      };
    }

    return {
      approved: true,
      confidence: 0.8,
      flags: []
    };
  }

  /**
   * Toxicity detection
   */
  private async checkToxicity(content: string): Promise<ModerationResult> {
    try {
      const toxicPatterns = [
        // Direct insults
        /\b(stupid|idiot|moron|dumb|retard|fool)\b/i,
        /\b(hate|despise|loathe)\s+(you|everyone|all)\b/i,
        /\b(kill|murder|destroy)\s+(yourself|you)\b/i,
        
        // Hate speech patterns
        /\b(all|every)\s+\w+\s+(are|is)\s+(terrible|awful|inferior|stupid)\b/i,
        /\b(wish|hope)\s+\w+\s+(would|could)\s+(die|disappear|vanish)\b/i,
        
        // Discriminatory language
        /\b(discriminat|prejudice|bias)\s+(against|toward)\s+\w+/i,
      ];

      for (const pattern of toxicPatterns) {
        if (pattern.test(content)) {
          return {
            approved: false,
            reason: 'Content rejected: toxic',
            confidence: 0.9,
            flags: ['toxic']
          };
        }
      }

      return {
        approved: true,
        confidence: 0.8,
        flags: []
      };
    } catch (error) {
      console.error('Toxicity check error:', error);
      return {
        approved: true, // Allow content if toxicity check fails
        confidence: 0.5,
        flags: []
      };
    }
  }

  /**
   * Spam detection
   */
  private async checkSpam(content: string): Promise<ModerationResult> {
    const spamPatterns = [
      // Promotional content
      /\b(buy|sell|purchase|order|deal|offer|discount|free|limited time)\b/i,
      /\b(click here|visit|website|link|url|http|www\.)\b/i,
      /\b(get rich|make money|earn cash|profit|investment)\b/i,
      
      // Excessive caps
      /[A-Z]{10,}/,
      
      // Excessive punctuation
      /[!]{3,}|[?]{3,}|[.]{3,}/,
      
      // Repetitive characters
      /(.)\1{10,}/,
    ];

    let spamScore = 0;
    for (const pattern of spamPatterns) {
      if (pattern.test(content)) {
        spamScore++;
      }
    }

    if (spamScore >= 2) {
      return {
        approved: false,
        reason: 'Content rejected: spam',
        confidence: 0.8,
        flags: ['spam']
      };
    }

    return {
      approved: true,
      confidence: 0.8,
      flags: []
    };
  }

  /**
   * Dream-specific validation
   */
  private async validateDreamContent(content: string, context?: any): Promise<ModerationResult> {
    if (!this.config.allowDreams) {
      return {
        approved: false,
        reason: 'Dream content not allowed',
        confidence: 1.0,
        flags: ['dreams_disabled']
      };
    }

    // Check for nightmare content that might be triggering
    const nightmarePatterns = [
      /\b(violence|blood|gore|torture|murder|death|suicide)\b/i,
      /\b(rape|abuse|assault|trauma)\b/i,
    ];

    if (this.config.strictMode) {
      for (const pattern of nightmarePatterns) {
        if (pattern.test(content)) {
          return {
            approved: false,
            reason: 'Content may be triggering - please add trigger warnings',
            confidence: 0.7,
            flags: ['potentially_triggering'],
            suggestions: ['Consider adding a trigger warning', 'Use more general language']
          };
        }
      }
    }

    // Check for symbolic content (dreams often use symbols)
    if (!this.config.allowSymbolicContent) {
      const symbolicPatterns = [
        /\b(flying|falling|water|fire|animals|transformation)\b/i,
      ];

      let symbolicScore = 0;
      for (const pattern of symbolicPatterns) {
        if (pattern.test(content)) {
          symbolicScore++;
        }
      }

      if (symbolicScore >= 3) {
        return {
          approved: false,
          reason: 'Content too symbolic for current settings',
          confidence: 0.6,
          flags: ['too_symbolic']
        };
      }
    }

    return {
      approved: true,
      confidence: 0.8,
      flags: []
    };
  }

  /**
   * Check for excessive repetition
   */
  private hasExcessiveRepetition(content: string): boolean {
    const words = content.toLowerCase().split(/\s+/);
    const wordCounts = new Map<string, number>();
    
    for (const word of words) {
      if (word.length > 3) { // Only count meaningful words
        wordCounts.set(word, (wordCounts.get(word) || 0) + 1);
      }
    }

    // For short content (less than 5 words), be more lenient
    const meaningfulWords = Array.from(wordCounts.values()).reduce((sum, count) => sum + count, 0);
    if (meaningfulWords < 5) {
      // For short content, only flag if a word appears more than once
      for (const [word, count] of wordCounts) {
        if (count > 1) {
          return true;
        }
      }
      return false;
    }

    // For longer content, check if any word appears more than 30% of the time
    for (const [word, count] of wordCounts) {
      if (count / meaningfulWords > 0.3) {
        return true;
      }
    }

    return false;
  }

  /**
   * Check for gibberish
   */
  private isGibberish(content: string): boolean {
    // Check for excessive non-alphabetic characters
    const nonAlphaRatio = (content.match(/[^a-zA-Z\s]/g) || []).length / content.length;
    if (nonAlphaRatio > 0.5) {
      return true;
    }

    // Check for random character sequences
    const randomPatterns = [
      /[a-z]{1}[A-Z]{1}[a-z]{1}[A-Z]{1}/, // Alternating case
      /(.)\1{5,}/, // Same character repeated 5+ times
    ];

    for (const pattern of randomPatterns) {
      if (pattern.test(content)) {
        return true;
      }
    }

    return false;
  }

  /**
   * Generate content suggestions
   */
  private generateSuggestions(content: string, contentType: string): string[] {
    const suggestions: string[] = [];

    if (contentType === 'dream') {
      suggestions.push('Consider adding dream symbols and emotions');
      suggestions.push('Describe how the dream made you feel');
    }

    if (content.length < 50) {
      suggestions.push('Try adding more details to make your content more engaging');
    }

    if (!content.includes('.')) {
      suggestions.push('Consider breaking your content into sentences');
    }

    return suggestions;
  }

  /**
   * Update moderation configuration
   */
  updateConfig(newConfig: Partial<ModerationConfig>): void {
    this.config = { ...this.config, ...newConfig };
  }

  /**
   * Get current configuration
   */
  getConfig(): ModerationConfig {
    return { ...this.config };
  }
}
