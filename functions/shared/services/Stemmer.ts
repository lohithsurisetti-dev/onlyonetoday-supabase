/**
 * Porter Stemmer Service
 * 
 * Lightweight implementation of Porter Stemmer algorithm
 * Converts words to their root form (running → run, eating → eat)
 * No external dependencies - pure TypeScript
 */

export class Stemmer {
  /**
   * Stem a word to its root form
   * Examples: running → run, eating → eat, went → went (irregular)
   */
  stem(word: string): string {
    if (!word || word.length < 3) {
      return word.toLowerCase();
    }

    let w = word.toLowerCase();

    // Step 1a: Handle plurals and past participles
    if (w.endsWith('sses')) {
      w = w.slice(0, -2);
    } else if (w.endsWith('ies')) {
      w = w.slice(0, -2);
    } else if (w.endsWith('ss')) {
      // Keep 'ss'
    } else if (w.endsWith('s')) {
      w = w.slice(0, -1);
    }

    // Step 1b: Handle -ed and -ing
    if (w.endsWith('eed')) {
      if (this.hasVowel(w.slice(0, -3))) {
        w = w.slice(0, -1);
      }
    } else if (w.endsWith('ed')) {
      const stem = w.slice(0, -2);
      if (this.hasVowel(stem)) {
        w = this.step1b(stem);
      }
    } else if (w.endsWith('ing')) {
      const stem = w.slice(0, -3);
      if (this.hasVowel(stem)) {
        w = this.step1b(stem);
      }
    }

    // Step 1c: Handle -y
    if (w.endsWith('y')) {
      const stem = w.slice(0, -1);
      if (this.hasVowel(stem)) {
        w = stem + 'i';
      }
    }

    // Step 2: Handle common suffixes
    w = this.step2(w);

    // Step 3: Handle more suffixes
    w = this.step3(w);

    // Step 4: Handle final suffixes
    w = this.step4(w);

    // Step 5a: Remove final -e
    if (w.endsWith('e')) {
      const stem = w.slice(0, -1);
      if (stem.length > 1 && this.hasVowel(stem)) {
        w = stem;
      }
    }

    // Step 5b: Remove double -l
    if (w.length > 1 && w.endsWith('ll') && this.hasVowel(w.slice(0, -1))) {
      w = w.slice(0, -1);
    }

    return w;
  }

  /**
   * Step 1b helper: Handle doubled consonants and special cases
   */
  private step1b(stem: string): string {
    if (stem.endsWith('at') || stem.endsWith('bl') || stem.endsWith('iz')) {
      return stem + 'e';
    }

    // Remove doubled consonant
    if (this.isDoubleConsonant(stem)) {
      const lastChar = stem[stem.length - 1];
      if (lastChar !== 'l' && lastChar !== 's' && lastChar !== 'z') {
        return stem.slice(0, -1);
      }
    }

    // Special case: short word
    if (stem.length === 3 && this.isConsonant(stem[0]) && this.isVowel(stem[1]) && this.isConsonant(stem[2])) {
      return stem + 'e';
    }

    return stem;
  }

  /**
   * Step 2: Handle common suffixes
   */
  private step2(word: string): string {
    const suffixes: [string, string][] = [
      ['ational', 'ate'],
      ['tional', 'tion'],
      ['enci', 'ence'],
      ['anci', 'ance'],
      ['izer', 'ize'],
      ['abli', 'able'],
      ['alli', 'al'],
      ['entli', 'ent'],
      ['eli', 'e'],
      ['ousli', 'ous'],
      ['ization', 'ize'],
      ['ation', 'ate'],
      ['ator', 'ate'],
      ['alism', 'al'],
      ['iveness', 'ive'],
      ['fulness', 'ful'],
      ['ousness', 'ous'],
      ['aliti', 'al'],
      ['iviti', 'ive'],
      ['biliti', 'ble'],
      ['logi', 'log']
    ];

    for (const [suffix, replacement] of suffixes) {
      if (word.endsWith(suffix)) {
        const stem = word.slice(0, -suffix.length);
        if (this.hasVowel(stem)) {
          return stem + replacement;
        }
      }
    }

    return word;
  }

  /**
   * Step 3: Handle more suffixes
   */
  private step3(word: string): string {
    const suffixes: [string, string][] = [
      ['icate', 'ic'],
      ['ative', ''],
      ['alize', 'al'],
      ['iciti', 'ic'],
      ['ical', 'ic'],
      ['ful', ''],
      ['ness', '']
    ];

    for (const [suffix, replacement] of suffixes) {
      if (word.endsWith(suffix)) {
        const stem = word.slice(0, -suffix.length);
        if (this.hasVowel(stem)) {
          return stem + replacement;
        }
      }
    }

    return word;
  }

  /**
   * Step 4: Handle final suffixes
   */
  private step4(word: string): string {
    const suffixes = [
      'al', 'ance', 'ence', 'er', 'ic', 'able', 'ible', 'ant', 'ement',
      'ment', 'ent', 'ion', 'ou', 'ism', 'ate', 'iti', 'ous', 'ive', 'ize'
    ];

    for (const suffix of suffixes) {
      if (word.endsWith(suffix)) {
        const stem = word.slice(0, -suffix.length);
        if (stem.length > 1 && this.hasVowel(stem)) {
          // Special case: -ion requires -s or -t before it
          if (suffix === 'ion' && (stem.endsWith('s') || stem.endsWith('t'))) {
            return stem;
          } else if (suffix !== 'ion') {
            return stem;
          }
        }
      }
    }

    return word;
  }

  /**
   * Check if word has a vowel
   */
  private hasVowel(word: string): boolean {
    for (let i = 0; i < word.length; i++) {
      if (this.isVowel(word[i], i, word)) {
        return true;
      }
    }
    return false;
  }

  /**
   * Check if character is a vowel
   */
  private isVowel(char: string, index: number, word: string): boolean {
    if (char === 'a' || char === 'e' || char === 'i' || char === 'o' || char === 'u') {
      return true;
    }
    if (char === 'y' && index > 0 && index < word.length - 1) {
      const prev = word[index - 1];
      return !(prev === 'a' || prev === 'e' || prev === 'i' || prev === 'o' || prev === 'u');
    }
    return false;
  }

  /**
   * Check if character is a consonant
   */
  private isConsonant(char: string): boolean {
    return !this.isVowel(char, 0, char);
  }

  /**
   * Check if word ends with double consonant
   */
  private isDoubleConsonant(word: string): boolean {
    if (word.length < 2) return false;
    const last = word[word.length - 1];
    const secondLast = word[word.length - 2];
    return last === secondLast && this.isConsonant(last);
  }
}

