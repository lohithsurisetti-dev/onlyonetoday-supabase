/**
 * Transliterator Service
 * 
 * Converts code-mixed content (Telugu-English, Hindi-English) to normalized English
 * Simple dictionary-based approach (no API dependencies for MVP)
 */

import { LanguageInfo } from './LanguageDetector.ts';

export class Transliterator {
  // Telugu words written in English letters → English
  private teluguToEnglish: Record<string, string> = {
    // Pronouns
    'nenu': 'i',
    'meeru': 'you',
    'athanu': 'he',
    'aame': 'she',
    'adi': 'it',
    'manam': 'we',
    'valla': 'they',
    
    // Verbs
    'velthunna': 'going',
    'velthunnanu': 'going',
    'velthunnaru': 'going',
    'velthunnayi': 'going',
    'velthunnam': 'going',
    'vachanu': 'came',
    'vacha': 'came',
    'vacharu': 'came',
    'vachayi': 'came',
    'vacham': 'came',
    'poyanu': 'went',
    'poya': 'went',
    'poyaru': 'went',
    'poyayi': 'went',
    'poyam': 'went',
    'chesanu': 'did',
    'chesa': 'did',
    'chesaru': 'did',
    'chesayi': 'did',
    'chesam': 'did',
    'chesthunna': 'doing',
    'chesthunnaanu': 'doing',
    'chesthunnaru': 'doing',
    'chesthunnayi': 'doing',
    'chesthunnam': 'doing',
    'thinnanu': 'ate',
    'thina': 'ate',
    'thinaru': 'ate',
    'thinayi': 'ate',
    'thinam': 'ate',
    'thagalenu': 'drank',
    'thagaledu': 'drank',
    'thagaleru': 'drank',
    'thagaleyi': 'drank',
    'thagalem': 'drank',
    
    // Prepositions
    'ki': 'to',
    'lo': 'in',
    'nunchi': 'from',
    'tho': 'with',
    
    // Common nouns (keep as-is if already English)
    'school': 'school',
    'meditation': 'meditation',
    'breakfast': 'breakfast',
    'lunch': 'lunch',
    'dinner': 'dinner',
    'work': 'work',
    'home': 'home',
    'office': 'office',
    'park': 'park',
    'gym': 'gym',
    'run': 'run',
    'walk': 'walk',
    'swim': 'swim',
    'read': 'read',
    'write': 'write',
    'listen': 'listen',
    'watch': 'watch',
    'play': 'play',
    'help': 'help',
    'love': 'love',
    'peace': 'peace',
    'happy': 'happy',
    'sad': 'sad',
    'tired': 'tired',
    'excited': 'excited'
  };

  // Hindi words written in English letters → English
  private hindiToEnglish: Record<string, string> = {
    // Pronouns
    'main': 'i',
    'tum': 'you',
    'woh': 'he',
    'woh': 'she',
    'hum': 'we',
    've': 'they',
    
    // Verbs
    'gaya': 'went',
    'gayi': 'went',
    'gaye': 'went',
    'kiya': 'did',
    'ki': 'did',
    'karta': 'do',
    'karti': 'do',
    'karte': 'do',
    'karunga': 'will do',
    'karungi': 'will do',
    'karne': 'to do',
    'karke': 'after doing',
    'aaya': 'came',
    'aayi': 'came',
    'aaye': 'came',
    'aayega': 'will come',
    'aayegi': 'will come',
    'aayenge': 'will come',
    'liya': 'took',
    'liyi': 'took',
    'liye': 'took',
    'liyega': 'will take',
    'liyegi': 'will take',
    'liyenge': 'will take',
    'ja': 'go',
    'jao': 'go',
    'jaaye': 'go',
    'jaayega': 'will go',
    'jaayegi': 'will go',
    'jaayenge': 'will go',
    
    // Auxiliary verbs
    'hain': 'is',
    'hai': 'is',
    'ho': 'be',
    'hun': 'am',
    'tha': 'was',
    'thi': 'was',
    'the': 'were',
    
    // Common nouns (keep as-is if already English)
    'school': 'school',
    'meditation': 'meditation',
    'breakfast': 'breakfast',
    'lunch': 'lunch',
    'dinner': 'dinner',
    'work': 'work',
    'home': 'home',
    'office': 'office',
    'park': 'park',
    'gym': 'gym',
    'run': 'run',
    'walk': 'walk',
    'swim': 'swim',
    'read': 'read',
    'write': 'write',
    'listen': 'listen',
    'watch': 'watch',
    'play': 'play',
    'help': 'help',
    'love': 'love',
    'peace': 'peace',
    'happy': 'happy',
    'sad': 'sad',
    'tired': 'tired',
    'excited': 'excited'
  };

  /**
   * Convert code-mixed content to normalized English
   */
  async transliterateToEnglish(
    content: string,
    languageInfo: LanguageInfo
  ): Promise<string> {
    
    // If already English, return as-is (with basic normalization)
    if (languageInfo.type === 'english') {
      return this.normalizeEnglish(content);
    }

    const words = content.toLowerCase().split(/\s+/);
    const translated: string[] = [];

    for (const word of words) {
      let translatedWord = word;

      // Try Telugu dictionary
      if (languageInfo.languages.includes('telugu')) {
        translatedWord = this.teluguToEnglish[word] || translatedWord;
      }

      // Try Hindi dictionary
      if (languageInfo.languages.includes('hindi')) {
        translatedWord = this.hindiToEnglish[word] || translatedWord;
      }

      // If word is already English (common nouns), keep it
      if (this.isEnglishWord(word)) {
        translatedWord = word;
      }

      translated.push(translatedWord);
    }

    // Join and normalize
    const normalized = translated.join(' ');
    return this.normalizeEnglish(normalized);
  }

  /**
   * Normalize English text (remove extra spaces, lowercase, etc.)
   */
  private normalizeEnglish(text: string): string {
    return text
      .toLowerCase()
      .replace(/\s+/g, ' ') // Multiple spaces to single space
      .replace(/[^\w\s]/g, ' ') // Remove special chars (keep spaces)
      .trim();
  }

  /**
   * Check if word is likely English (common nouns/verbs)
   */
  private isEnglishWord(word: string): boolean {
    const commonEnglishWords = [
      'school', 'meditation', 'breakfast', 'lunch', 'dinner',
      'work', 'home', 'office', 'park', 'gym', 'run', 'walk',
      'swim', 'read', 'write', 'listen', 'watch', 'play', 'help',
      'love', 'peace', 'happy', 'sad', 'tired', 'excited',
      'today', 'yesterday', 'tomorrow', 'morning', 'evening', 'night',
      'minute', 'hour', 'day', 'week', 'month', 'year'
    ];

    return commonEnglishWords.includes(word.toLowerCase());
  }
}

