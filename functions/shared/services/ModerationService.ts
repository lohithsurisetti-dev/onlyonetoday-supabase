interface ModerationResult {
  approved: boolean;
  score: number;
  flags: string[];
  details: {
    toxicity?: number;
    spam?: number;
    inappropriate?: number;
  };
}

export class ModerationService {
  private hfToken: string;
  private hfApiUrl = 'https://api-inference.huggingface.co/models';

  constructor() {
    this.hfToken = Deno.env.get('HUGGINGFACE_API_KEY') || '';
  }

  async moderateContent(content: string): Promise<ModerationResult> {
    try {
      // Start with basic moderation
      const basicResult = this.basicModeration(content);
      
      // Use basic toxicity check for now (more reliable)
      const toxicityResult = this.basicToxicityCheck(content);

      // Use basic spam check for now (more reliable)
      const spamResult = this.basicSpamCheck(content);

      console.log('Moderation results:', { toxicityResult, spamResult, basicResult });

      // Combine results
      const flags: string[] = [];
      let totalScore = 0;

      if (toxicityResult.score > 0.3) {
        flags.push(...toxicityResult.flags);
        totalScore += toxicityResult.score * 0.5;
      }

      if (spamResult.score > 0.4) {
        flags.push(...spamResult.flags);
        totalScore += spamResult.score * 0.3;
      }

      if (basicResult.score > 0.3) {
        flags.push(...basicResult.flags);
        totalScore += basicResult.score * 0.2;
      }

      const approved = totalScore < 0.5 && flags.length === 0;

      return {
        approved,
        score: Math.min(totalScore, 1.0),
        flags: [...new Set(flags)], // Remove duplicates
        details: {
          toxicity: toxicityResult.score,
          spam: spamResult.score,
          inappropriate: basicResult.score
        }
      };

    } catch (error) {
      console.error('Moderation service error:', error);
      // Fallback to basic moderation if everything fails
      const basicResult = this.basicModeration(content);
      return {
        approved: basicResult.score < 0.5,
        score: basicResult.score,
        flags: basicResult.flags,
        details: {
          toxicity: 0,
          spam: 0,
          inappropriate: basicResult.score
        }
      };
    }
  }

  private async checkToxicity(content: string): Promise<{ score: number; flags: string[] }> {
    try {
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 10000); // 10 second timeout

      const response = await fetch(`${this.hfApiUrl}/unitary/toxic-bert`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${this.hfToken}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ inputs: content }),
        signal: controller.signal
      });

      clearTimeout(timeoutId);

      if (!response.ok) {
        throw new Error(`HF API error: ${response.status}`);
      }

      const result = await response.json();
      
      if (Array.isArray(result) && result.length > 0) {
        // Find the highest toxicity score
        const maxScore = Math.max(...result.map((r: any) => r.score || 0));
        return {
          score: maxScore,
          flags: maxScore > 0.7 ? ['toxic'] : []
        };
      }

      return { score: 0, flags: [] };
    } catch (error) {
      console.error('Toxicity check failed:', error);
      // Fallback to basic toxicity detection
      return this.basicToxicityCheck(content);
    }
  }

  private basicToxicityCheck(content: string): { score: number; flags: string[] } {
    const toxicWords = [
      'stupid', 'idiot', 'moron', 'hate', 'kill', 'die', 'worthless',
      'ugly', 'fat', 'dumb', 'retard', 'fuck', 'shit', 'bitch'
    ];

    const lowerContent = content.toLowerCase();
    let score = 0;
    const flags: string[] = [];

    for (const word of toxicWords) {
      if (lowerContent.includes(word)) {
        score += 0.3;
        if (!flags.includes('toxic')) {
          flags.push('toxic');
        }
      }
    }

    return {
      score: Math.min(score, 1.0),
      flags
    };
  }

  private basicSpamCheck(content: string): { score: number; flags: string[] } {
    const spamPatterns = [
      /(.)\1{4,}/g, // Repeated characters
      /(https?:\/\/[^\s]+){2,}/g, // Multiple URLs
      /(buy|sell|free|money|cash|profit|click here|limited time)/gi,
      /[A-Z]{5,}/g, // Excessive caps
    ];

    let spamScore = 0;
    const flags: string[] = [];

    for (const pattern of spamPatterns) {
      if (pattern.test(content)) {
        spamScore += 0.3;
        if (!flags.includes('spam')) {
          flags.push('spam');
        }
      }
    }

    return {
      score: Math.min(spamScore, 1.0),
      flags
    };
  }

  private async checkSpam(content: string): Promise<{ score: number; flags: string[] }> {
    try {
      const response = await fetch(`${this.hfApiUrl}/microsoft/DialoGPT-medium`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${this.hfToken}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ 
          inputs: `Is this spam? "${content}"`,
          parameters: { max_length: 10 }
        }),
      });

      if (!response.ok) {
        throw new Error(`HF API error: ${response.status}`);
      }

      const result = await response.json();
      
      // Simple spam detection based on patterns
      const spamPatterns = [
        /(.)\1{4,}/g, // Repeated characters
        /(https?:\/\/[^\s]+){2,}/g, // Multiple URLs
        /(buy|sell|free|money|cash|profit|click here|limited time)/gi,
        /[A-Z]{5,}/g, // Excessive caps
      ];

      let spamScore = 0;
      const flags: string[] = [];

      for (const pattern of spamPatterns) {
        if (pattern.test(content)) {
          spamScore += 0.3;
          flags.push('spam_pattern');
        }
      }

      return {
        score: Math.min(spamScore, 1.0),
        flags
      };
    } catch (error) {
      console.error('Spam check failed:', error);
      return { score: 0, flags: [] };
    }
  }

  private basicModeration(content: string): { score: number; flags: string[] } {
    const flags: string[] = [];
    let score = 0;

    // Length checks
    if (content.length < 5) {
      flags.push('too_short');
      score += 0.2;
    }

    if (content.length > 2000) {
      flags.push('too_long');
      score += 0.1;
    }

    // Character diversity
    const uniqueChars = new Set(content.toLowerCase().replace(/\s/g, '')).size;
    const totalChars = content.replace(/\s/g, '').length;
    
    if (totalChars > 10 && uniqueChars / totalChars < 0.3) {
      flags.push('low_diversity');
      score += 0.3;
    }

    // Profanity filter (basic)
    const profanityWords = ['badword1', 'badword2']; // Add your list
    const hasProfanity = profanityWords.some(word => 
      content.toLowerCase().includes(word.toLowerCase())
    );

    if (hasProfanity) {
      flags.push('profanity');
      score += 0.8;
    }

    return {
      score: Math.min(score, 1.0),
      flags
    };
  }
}
