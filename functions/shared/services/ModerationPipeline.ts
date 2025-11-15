declare const Deno: any;

/**
 * Reusable Moderation Pipeline
 * Handles content moderation for all user inputs (posts, dreams, comments, etc.)
 * 
 * Optimizations:
 * 1. Parallel processing for independent checks
 * 2. Redis caching for moderation results
 * 3. Early static filtering before AI calls
 * 4. Reduced API calls with combined checks
 */

import { cacheGet, cacheSet, cacheDel, CacheKeys, CacheTTL, hashContent } from '../utils/redis.ts';

export interface ModerationResult {
  approved: boolean;
  reason?: string;
  userMessage?: string; // Short, funny message for users
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
      console.log('🛡️ Starting optimized moderation with caching...');
      console.log('📊 Moderation context:', {
        contentLength: content.length,
        contentType,
        additionalContext: JSON.stringify(additionalContext)
      });
      
      // 1. Check cache first
      const contentHash = hashContent(content);
      const cacheKey = CacheKeys.moderation(contentHash);
      const cached = await cacheGet<ModerationResult>(cacheKey);
      
      if (cached) {
        console.log('✅ Using cached moderation result');
        return cached;
      }
      
      // 2. Early static filtering (fastest checks first)
      const basicCheck = this.validateBasic(content);
      if (!basicCheck.approved) {
        console.log('❌ Basic validation failed:', basicCheck.reason);
        await cacheSet(cacheKey, basicCheck, CacheTTL.MODERATION);
        return basicCheck;
      }
      
      // 3. Parallel processing for independent checks
      const timeoutPromise = new Promise<ModerationResult>((_, reject) => {
        setTimeout(() => {
          console.log('⏰ Moderation timeout reached');
          reject(new Error('Moderation timeout'));
        }, 3000); // Reduced timeout for CPU limits
      });

      const moderationPromise = this.performOptimizedModeration(content, contentType, additionalContext);
      
      const result = await Promise.race([moderationPromise, timeoutPromise]);
      
      // 4. Cache the result
      await cacheSet(cacheKey, result, CacheTTL.MODERATION);
      
      console.log('✅ Optimized moderation completed successfully');
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

  private async performOptimizedModeration(
    content: string, 
    contentType: 'post' | 'dream' | 'comment' | 'profile' = 'post',
    additionalContext?: any
  ): Promise<ModerationResult> {
    console.log('🚀 Running optimized parallel moderation...');
    
    // Run independent checks in parallel
    const [contentCheck, toxicityCheck, spamCheck, adultCheck] = await Promise.allSettled([
      this.validateContent(content, contentType, additionalContext),
      this.checkToxicity(content),
      this.checkSpam(content),
      this.checkAdultContent(content)
    ]);
    
    // Check results in order of priority
    if (contentCheck.status === 'fulfilled' && !contentCheck.value.approved) {
      console.log('❌ Content validation failed:', contentCheck.value.reason);
      return contentCheck.value;
    }
    
    if (toxicityCheck.status === 'fulfilled' && !toxicityCheck.value.approved) {
      console.log('❌ Toxicity check failed:', toxicityCheck.value.reason);
      return toxicityCheck.value;
    }
    
    if (spamCheck.status === 'fulfilled' && !spamCheck.value.approved) {
      console.log('❌ Spam check failed:', spamCheck.value.reason);
      return spamCheck.value;
    }
    
    if (adultCheck.status === 'fulfilled' && !adultCheck.value.approved) {
      console.log('❌ Adult content check failed:', adultCheck.value.reason);
      return adultCheck.value;
    }
    
    // Handle any failed checks
    const failedChecks = [contentCheck, toxicityCheck, spamCheck, adultCheck]
      .filter(check => check.status === 'rejected');
    
    if (failedChecks.length > 0) {
      console.warn(`⚠️ ${failedChecks.length} moderation checks failed, allowing content`);
    }
    
    console.log('✅ All moderation checks passed');
    return {
      approved: true,
      confidence: 0.9,
      flags: []
    };
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

    console.log('🔍 Starting adult content check...');
    // Adult content check
    const adultCheck = await this.checkAdultContent(content);
    if (!adultCheck.approved) {
      console.log('❌ Adult content check failed:', adultCheck.reason);
      return adultCheck;
    }
    console.log('✅ Adult content check passed');

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
    // Check for contact information (phone, email)
    const contactCheck = this.checkContactInfo(content);
    if (!contactCheck.approved) {
      return contactCheck;
    }

    // Check for URLs and links
    const urlCheck = this.checkURLs(content);
    if (!urlCheck.approved) {
      return urlCheck;
    }

    // Check for social media handles
    const socialCheck = this.checkSocialMedia(content);
    if (!socialCheck.approved) {
      return socialCheck;
    }

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
        /\b(kill|murder|destroy)\s+(yourself|you|everyone|all|them|people)\b/i,
        
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
            userMessage: this.generateUserMessage(['toxic'], 'Content rejected: toxic'),
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
        userMessage: this.generateUserMessage(['spam'], 'Content rejected: spam'),
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
   * Adult content detection using AI
   */
  private async checkAdultContent(content: string): Promise<ModerationResult> {
    try {
      // ALWAYS check static keywords first (fast, reliable)
      const sexualTerms = [
        'sex', 'sexual', 'intercourse', 'fuck', 'fucking', 'fkd', 'porn', 'pornography',
        'masturbat', 'orgasm', 'penis', 'vagina', 'breast', 'nude', 'naked',
        'strip', 'strip tease', 'prostitute', 'hooker', 'escort', 'brothel',
        'doggy style', 'doggy', 'missionary', 'anal', 'oral', 'blowjob', 'bj',
        'handjob', 'hj', 'fingering', 'climax', 'ejaculat', 'cum', 'sperm',
        'erotic', 'seduce', 'seduction', 'foreplay', 'intimate', 'intimacy',
        'make love', 'lovemaking', 'bedroom', 'bed time', 'sleep together',
        'explicit', 'nsfw', 'xxx', 'adult content', 'adult material'
      ];

      const contentLower = content.toLowerCase();
      let explicitTermCount = 0;
      
      for (const term of sexualTerms) {
        if (contentLower.includes(term)) {
          explicitTermCount++;
          console.log(`🚫 Found explicit term: "${term}"`);
        }
      }

      // If explicit terms found, block immediately (no need for API)
      if (explicitTermCount >= 1) {
        console.log(`🚫 Adult content detected via static keywords: ${explicitTermCount} terms found`);
        return {
          approved: false,
          reason: 'Content rejected: adult content',
          userMessage: this.generateUserMessage(['adult_content'], 'Content rejected: adult content'),
          confidence: 0.9,
          flags: ['adult_content']
        };
      }

      // Use Hugging Face API for adult content detection (for subtle cases)
      const hfToken = Deno.env.get('HUGGINGFACE_API_KEY');
      if (!hfToken) {
        console.log('⚠️ No Hugging Face API key, static check passed');
        return {
          approved: true,
          confidence: 0.8,
          flags: []
        };
      }

      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 3000); // 3 second timeout for CPU limits

      // Use the reliable toxic-bert model with improved detection logic
      // New HuggingFace endpoint: router.huggingface.co/hf-inference
      const response = await fetch('https://router.huggingface.co/hf-inference/models/unitary/toxic-bert', {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${hfToken}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          inputs: content,
          parameters: {
            return_all_scores: true
          }
        }),
        signal: controller.signal
      });

      clearTimeout(timeoutId);

      let results: any = null;
      if (!response.ok) {
        console.log('⚠️ Adult content API failed, using static fallback');
        // Fallback to static keyword detection when API fails
        // Skip API result parsing and go straight to static keyword check
      } else {
        try {
          results = await response.json();
          console.log('🔍 Adult content detection results:', results);
        } catch (parseError) {
          console.log('⚠️ Failed to parse API response, using static fallback');
          results = null;
        }
      }

      // Check for adult/sexual content indicators with more sensitive detection
      let adultScore = 0;
      let isAdult = false;
      let hasObsceneContent = false;

      // Handle nested array format from new HuggingFace endpoint: [[{label, score}, ...]]
      let resultsArray: any[] = [];
      if (results && Array.isArray(results)) {
        // Check if it's nested array format
        if (results.length > 0 && Array.isArray(results[0])) {
          resultsArray = results[0];
        } else {
          resultsArray = results;
        }
      }

      if (resultsArray.length > 0) {
        for (const result of resultsArray) {
          if (result.label && typeof result.score === 'number') {
            // Look for sexual/adult content labels
            const label = result.label.toLowerCase();
            const score = result.score;
            
            if (label.includes('sexual') || label.includes('adult') || 
                label.includes('explicit') || label.includes('nsfw') ||
                label.includes('obscene') || label.includes('harassment') ||
                label.includes('toxic') || label.includes('threat') ||
                label.includes('insult') || label.includes('identity_hate')) {
              adultScore += score;
              
              // Be more sensitive to obscene content
              if (label.includes('obscene') && score > 0.01) {
                hasObsceneContent = true;
              }
              
              // Threshold for blocking: toxic > 0.3, obscene > 0.02, threat > 0.1
              if (label.includes('toxic') && score > 0.3) {
                isAdult = true;
              }
              
              if (label.includes('obscene') && score > 0.02) {
                isAdult = true;
              }
              
              if (label.includes('threat') && score > 0.1) {
                isAdult = true;
              }
              
              // High insult or identity_hate scores
              if ((label.includes('insult') || label.includes('identity_hate')) && score > 0.2) {
                isAdult = true;
              }
            }
          }
        }
      }

      // AI detection results are already processed above
      // If we get here, static keywords passed and AI didn't flag it
      if (isAdult || hasObsceneContent || adultScore > 0.2) {
        console.log(`🚫 Adult content detected via AI: isAdult=${isAdult}, hasObscene=${hasObsceneContent}, score=${adultScore}`);
        return {
          approved: false,
          reason: 'Content rejected: adult content',
          userMessage: this.generateUserMessage(['adult_content'], 'Content rejected: adult content'),
          confidence: adultScore,
          flags: ['adult_content']
        };
      }

      return {
        approved: true,
        confidence: 0.8,
        flags: []
      };

    } catch (error) {
      console.error('❌ Adult content check error:', error);
      // If check fails, allow content but flag it
      return {
        approved: true,
        confidence: 0.3,
        flags: ['adult_check_failed']
      };
    }
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
   * Check for contact information (phone numbers, email addresses)
   */
  private checkContactInfo(content: string): ModerationResult {
    // Phone number patterns (more robust, without strict word boundaries)
    const phonePatterns = [
      /\d{3}[-.\s]?\d{3}[-.\s]?\d{4}/,                    // 123-456-7890, 123.456.7890, 123 456 7890, 1234567890
      /\(\d{3}\)\s?\d{3}[-.\s]?\d{4}/,                     // (123) 456-7890, (123)456-7890
      /\+\d{1,3}[-.\s]?\d{3}[-.\s]?\d{3}[-.\s]?\d{4}/,    // +1-123-456-7890, +1.123.456.7890
      /\b\d{10}\b/,                                        // 10 consecutive digits (with word boundaries)
    ];

    // Email pattern (more robust, without strict word boundaries)
    const emailPattern = /[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Z|a-z]{2,}/i;

    // Check for phone numbers
    for (const pattern of phonePatterns) {
      if (pattern.test(content)) {
        return {
          approved: false,
          reason: 'Contact information not allowed',
          userMessage: this.generateUserMessage(['contact_info'], 'Contact information not allowed'),
          confidence: 0.95,
          flags: ['contact_info']
        };
      }
    }

    // Check for email addresses
    if (emailPattern.test(content)) {
      return {
        approved: false,
        reason: 'Contact information not allowed',
        userMessage: this.generateUserMessage(['contact_info'], 'Contact information not allowed'),
        confidence: 0.95,
        flags: ['contact_info']
      };
    }

    return {
      approved: true,
      confidence: 0.9,
      flags: []
    };
  }

  /**
   * Check for URLs and links
   */
  private checkURLs(content: string): ModerationResult {
    // Common TLDs
    const commonTlds = 'com|net|org|io|co|me|app|dev|tv|cc|xyz|info|biz|us|uk|ca|au|in|jp|cn|ru|de|fr|es|it|nl|se|no|dk|fi|pl|cz|hu|ro|gr|pt|ie|be|at|ch|tr|kr|tw|hk|sg|my|th|ph|id|vn|nz|za|mx|br|ar|cl|co|pe|ve|ec|uy|py|bo|cr|pa|do|gt|hn|ni|sv|bz|jm|tt|bb|gd|lc|vc|ag|dm|kn|bs|aw|ky|vg|ai|ms|tc|fk|gs|sh|ac|io|pn|hm|tf|aq|bv|sj|um|as|gu|mp|pr|vi|pw|fm|mh|nr|ki|tv|to|ws|fj|nc|pf|vu|sb|pg|ck|nu|tk|cx|nf';
    
    const urlPatterns = [
      /https?:\/\/[^\s]+/i,                               // http:// or https://
      /www\.[^\s]+/i,                                     // www.example.com
      new RegExp(`[a-z0-9-]+\\.(${commonTlds})(?:[^\\s]*)?`, 'i'), // domain.com, domain.net, etc. (without word boundary)
    ];

    for (const pattern of urlPatterns) {
      if (pattern.test(content)) {
        return {
          approved: false,
          reason: 'URLs and links not allowed',
          userMessage: this.generateUserMessage(['urls'], 'URLs and links not allowed'),
          confidence: 0.95,
          flags: ['urls']
        };
      }
    }

    return {
      approved: true,
      confidence: 0.9,
      flags: []
    };
  }

  /**
   * Check for social media handles and promotion
   */
  private checkSocialMedia(content: string): ModerationResult {
    // @username patterns
    const handlePattern = /@\w+/;

    // Platform names (only when used for promotion)
    const platformPatterns = [
      /\b(follow|add|dm|message|contact)\s+(me\s+)?(on\s+)?(instagram|twitter|facebook|tiktok|snapchat|linkedin|youtube|pinterest|reddit|discord|telegram|whatsapp|signal)\b/i,
      /\b(instagram|twitter|facebook|tiktok|snapchat|linkedin|youtube|pinterest|reddit|discord|telegram|whatsapp|signal)\s+(handle|account|profile|page|channel)\b/i,
      /\b(find|check|see)\s+(me|my|my\s+profile)\s+(on|at)\s+(instagram|twitter|facebook|tiktok|snapchat|linkedin|youtube|pinterest|reddit|discord|telegram|whatsapp|signal)\b/i,
    ];

    // Check for @username handles
    if (handlePattern.test(content)) {
      return {
        approved: false,
        reason: 'Social media handles not allowed',
        userMessage: this.generateUserMessage(['social_media'], 'Social media handles not allowed'),
        confidence: 0.9,
        flags: ['social_media']
      };
    }

    // Check for platform promotion patterns
    for (const pattern of platformPatterns) {
      if (pattern.test(content)) {
        return {
          approved: false,
          reason: 'Social media promotion not allowed',
          userMessage: this.generateUserMessage(['social_media'], 'Social media promotion not allowed'),
          confidence: 0.9,
          flags: ['social_media']
        };
      }
    }

    return {
      approved: true,
      confidence: 0.9,
      flags: []
    };
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

  /**
   * Generate funny, short error messages for users
   */
  private generateUserMessage(flags: string[], reason: string): string {
    const messages = {
      'toxic': [
        "Whoa there, tiger! Let's keep it friendly.",
        "Easy there, champ! Try being nice.",
        "Hold your horses! No negativity here.",
        "Chill out, buttercup! Spread love, not hate.",
        "Not today, Satan! Try again with kindness.",
        "Oops! That's not very nice. Let's try again.",
        "Friendly reminder: we're all friends here.",
        "That's not the vibe we're going for. Try again?"
      ],
      'spam': [
        "Hold up! This isn't a marketplace.",
        "Nope! Save the sales pitch for elsewhere.",
        "Nice try! But we're not buying it.",
        "Swing and a miss! No spam allowed.",
        "Plot twist! This isn't a commercial.",
        "Wrong app! Try LinkedIn for that.",
        "Save the pitch for Shark Tank.",
        "This isn't QVC, friend."
      ],
      'adult_content': [
        "Whoa there! Keep it PG, please.",
        "Not here! This is a family-friendly zone.",
        "Oops! Wrong app for that content.",
        "Nice try! But we're keeping it clean.",
        "Plot twist! This isn't that kind of app.",
        "Save that for your diary, not here.",
        "This isn't the place for that content.",
        "Let's keep it wholesome, shall we?"
      ],
      'repetitive': [
        "Broken record! Try something new.",
        "Echo echo echo! We heard you the first time.",
        "Groundhog Day! Mix it up a bit.",
        "Copy-paste fail! Be original.",
        "Deja vu! Try something different.",
        "We've seen this one before. Surprise us!",
        "Same old, same old. Spice it up!",
        "Variety is the spice of life, you know."
      ],
      'too_short': [
        "Too short! Give us more details.",
        "That's it? Tell us more!",
        "Come on! We want the full story.",
        "Spill the tea! More details, please.",
        "Don't leave us hanging! Tell us more.",
        "We're curious! What else happened?",
        "That's just the beginning, right?",
        "Give us the juicy details!"
      ],
      'too_long': [
        "TL;DR! Keep it shorter, please.",
        "Novel alert! Save some for later.",
        "Too much info! Break it down.",
        "War and Peace! Keep it brief.",
        "Essay mode! Short and sweet, please.",
        "That's a whole book! Give us the summary.",
        "Save some stories for tomorrow!",
        "We love enthusiasm, but keep it concise."
      ],
      'gibberish': [
        "What language is this? Try English.",
        "Alien detected! Speak human, please.",
        "Translation needed! Make sense, please.",
        "Code breaker! We can't decode this.",
        "Mystery solved! But we still don't understand.",
        "That's not quite right. Try again?",
        "We're confused! Help us understand.",
        "Lost in translation! Try a different approach."
      ],
      'contact_info': [
        "For your safety, please don't share contact info.",
        "Keep it anonymous! No phone numbers or emails.",
        "Privacy first! Let's keep contact info private.",
        "Safety check! No personal contact details allowed.",
        "Stay anonymous! No phone or email sharing.",
        "Privacy matters! Keep contact info to yourself.",
        "Safety first! No contact information please.",
        "Anonymous mode! No phone numbers or emails."
      ],
      'urls': [
        "No links allowed! Keep it text-only.",
        "Links are a no-go here. Try again without URLs.",
        "This isn't a link-sharing app. Keep it simple.",
        "No URLs please! Just share your story.",
        "Links blocked! Share your experience, not links.",
        "No external links allowed. Keep it original.",
        "Link-free zone! Share your moment, not URLs.",
        "No links here! Just your story, please."
      ],
      'social_media': [
        "Keep it anonymous! No social media handles.",
        "This isn't Instagram! No @handles please.",
        "Anonymous zone! No social media promotion.",
        "Stay off social! No handles or platform names.",
        "Privacy first! No social media handles.",
        "Anonymous mode! No @usernames or platform names.",
        "Keep it private! No social media handles.",
        "No social media! This is an anonymous space."
      ]
    };

    // Find the most relevant flag
    const primaryFlag = flags.find(flag => messages[flag]) || 'toxic';
    const flagMessages = messages[primaryFlag] || messages['toxic'];
    
    // Pick a random message
    const randomIndex = Math.floor(Math.random() * flagMessages.length);
    return flagMessages[randomIndex];
  }
}
