/**
 * Language Detection Service
 * 
 * Detects language and code-mixing patterns (Telugu-English, Hindi-English, etc.)
 * Simple heuristic-based approach (no API dependencies for MVP)
 */

export interface LanguageInfo {
  type: 'english' | 'telugu' | 'hindi' | 'code_mixed' | 'unknown';
  languages: string[];
  confidence: number;
}

export interface LanguageProcessed {
  original: string;
  normalized: string;
  language: LanguageInfo;
  keywords: string[];
}

export class LanguageDetector {
  // Common Telugu words written in English letters
  private teluguPatterns = [
    'nenu', 'velthunna', 'velthunnanu', 'chesanu', 'chesa', 'chesthunna',
    'ki', 'lo', 'undi', 'unnaru', 'unnayi', 'unnam', 'unnaru',
    'avuthundi', 'avuthunnaru', 'avuthunnayi', 'avuthunnam',
    'vachanu', 'vacha', 'vacharu', 'vachayi', 'vacham',
    'poyanu', 'poya', 'poyaru', 'poyayi', 'poyam',
    'thinnanu', 'thina', 'thinaru', 'thinayi', 'thinam',
    'thagalenu', 'thagaledu', 'thagaleru', 'thagaleyi', 'thagalem'
  ];

  // Common Hindi words written in English letters
  private hindiPatterns = [
    'main', 'gaya', 'gayi', 'gaye', 'kiya', 'ki', 'karta', 'karti', 'karte',
    'hain', 'hai', 'ho', 'hun', 'hain', 'tha', 'thi', 'the',
    'karke', 'kar', 'karne', 'karne', 'karunga', 'karungi',
    'ja', 'jao', 'jaaye', 'jaayega', 'jaayegi', 'jaayenge',
    'aaya', 'aayi', 'aaye', 'aayega', 'aayegi', 'aayenge',
    'liya', 'liyi', 'liye', 'liyega', 'liyegi', 'liyenge'
  ];

  /**
   * Detect language and code-mixing
   */
  async detectLanguage(content: string): Promise<LanguageInfo> {
    const contentLower = content.toLowerCase().trim();
    
    if (!contentLower || contentLower.length < 2) {
      return {
        type: 'unknown',
        languages: [],
        confidence: 0.0
      };
    }

    // Check for Telugu patterns
    const hasTelugu = this.teluguPatterns.some(pattern => 
      contentLower.includes(pattern)
    );

    // Check for Hindi patterns
    const hasHindi = this.hindiPatterns.some(pattern => 
      contentLower.includes(pattern)
    );

    // Check for English (basic check - has letters)
    const hasEnglish = /[a-z]{2,}/.test(contentLower);

    // Determine language type
    if (hasTelugu && hasEnglish) {
      return {
        type: 'code_mixed',
        languages: ['telugu', 'english'],
        confidence: 0.9
      };
    }

    if (hasHindi && hasEnglish) {
      return {
        type: 'code_mixed',
        languages: ['hindi', 'english'],
        confidence: 0.9
      };
    }

    if (hasTelugu) {
      return {
        type: 'telugu',
        languages: ['telugu'],
        confidence: 0.8
      };
    }

    if (hasHindi) {
      return {
        type: 'hindi',
        languages: ['hindi'],
        confidence: 0.8
      };
    }

    // Default to English
    return {
      type: 'english',
      languages: ['english'],
      confidence: hasEnglish ? 1.0 : 0.7
    };
  }

  /**
   * Process language: detect, normalize, extract keywords
   */
  async processLanguage(content: string): Promise<LanguageProcessed> {
    const language = await this.detectLanguage(content);
    
    // Normalization will be done by Transliterator
    // For now, return original as normalized (will be updated by Transliterator)
    const normalized = content; // Will be replaced by Transliterator
    
    // Extract basic keywords (will be refined after normalization)
    const keywords = this.extractBasicKeywords(content);
    
    return {
      original: content,
      normalized: normalized,
      language: language,
      keywords: keywords
    };
  }

  /**
   * Extract basic keywords (before normalization)
   */
  private extractBasicKeywords(content: string): string[] {
    const stopWords = [
      'the', 'a', 'an', 'and', 'or', 'but', 'in', 'on', 'at', 'to', 'for',
      'of', 'with', 'by', 'from', 'as', 'is', 'was', 'are', 'were', 'been',
      'be', 'have', 'has', 'had', 'do', 'does', 'did', 'will', 'would',
      'could', 'should', 'may', 'might', 'must', 'can', 'this', 'that',
      'these', 'those', 'i', 'you', 'he', 'she', 'it', 'we', 'they',
      'my', 'your', 'his', 'her', 'its', 'our', 'their'
    ];

    return content
      .toLowerCase()
      .replace(/[^\w\s]/g, ' ') // Remove punctuation
      .split(/\s+/)
      .filter(w => w.length > 2) // Only meaningful words
      .filter(w => !stopWords.includes(w))
      .slice(0, 10); // Limit to 10 keywords
  }
}

