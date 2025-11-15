/**
 * Irregular Verbs Service
 * 
 * Minimal list of 50 most common irregular verbs
 * Maps all forms to root form for matching
 */

export interface IrregularVerbGroup {
  root: string;
  forms: string[];
}

/**
 * 50 most common irregular verbs in English
 * Only the most frequently used verbs that don't stem well
 */
export const IRREGULAR_VERBS: Record<string, string[]> = {
  // Most common verbs
  'be': ['be', 'am', 'is', 'are', 'was', 'were', 'been', 'being'],
  'have': ['have', 'has', 'had', 'having'],
  'do': ['do', 'does', 'did', 'done', 'doing'],
  'go': ['go', 'goes', 'going', 'went', 'gone'],
  'get': ['get', 'gets', 'getting', 'got', 'gotten'],
  'make': ['make', 'makes', 'making', 'made'],
  'take': ['take', 'takes', 'taking', 'took', 'taken'],
  'come': ['come', 'comes', 'coming', 'came'],
  'see': ['see', 'sees', 'seeing', 'saw', 'seen'],
  'know': ['know', 'knows', 'knowing', 'knew', 'known'],
  'think': ['think', 'thinks', 'thinking', 'thought'],
  'say': ['say', 'says', 'saying', 'said'],
  'tell': ['tell', 'tells', 'telling', 'told'],
  'give': ['give', 'gives', 'giving', 'gave', 'given'],
  'find': ['find', 'finds', 'finding', 'found'],
  'leave': ['leave', 'leaves', 'leaving', 'left'],
  'feel': ['feel', 'feels', 'feeling', 'felt'],
  'keep': ['keep', 'keeps', 'keeping', 'kept'],
  'let': ['let', 'lets', 'letting'],
  'begin': ['begin', 'begins', 'beginning', 'began', 'begun'],
  'run': ['run', 'runs', 'running', 'ran'],
  'eat': ['eat', 'eats', 'eating', 'ate', 'eaten'],
  'drink': ['drink', 'drinks', 'drinking', 'drank', 'drunk'],
  'sleep': ['sleep', 'sleeps', 'sleeping', 'slept'],
  'wake': ['wake', 'wakes', 'waking', 'woke', 'woken'],
  'break': ['break', 'breaks', 'breaking', 'broke', 'broken'],
  'bring': ['bring', 'brings', 'bringing', 'brought'],
  'buy': ['buy', 'buys', 'buying', 'bought'],
  'catch': ['catch', 'catches', 'catching', 'caught'],
  'choose': ['choose', 'chooses', 'choosing', 'chose', 'chosen'],
  'cut': ['cut', 'cuts', 'cutting'],
  'drive': ['drive', 'drives', 'driving', 'drove', 'driven'],
  'fall': ['fall', 'falls', 'falling', 'fell', 'fallen'],
  'fight': ['fight', 'fights', 'fighting', 'fought'],
  'fly': ['fly', 'flies', 'flying', 'flew', 'flown'],
  'forget': ['forget', 'forgets', 'forgetting', 'forgot', 'forgotten'],
  'hear': ['hear', 'hears', 'hearing', 'heard'],
  'hold': ['hold', 'holds', 'holding', 'held'],
  'hurt': ['hurt', 'hurts', 'hurting'],
  'lose': ['lose', 'loses', 'losing', 'lost'],
  'meet': ['meet', 'meets', 'meeting', 'met'],
  'pay': ['pay', 'pays', 'paying', 'paid'],
  'put': ['put', 'puts', 'putting'],
  'read': ['read', 'reads', 'reading'],
  'send': ['send', 'sends', 'sending', 'sent'],
  'sit': ['sit', 'sits', 'sitting', 'sat'],
  'speak': ['speak', 'speaks', 'speaking', 'spoke', 'spoken'],
  'spend': ['spend', 'spends', 'spending', 'spent'],
  'stand': ['stand', 'stands', 'standing', 'stood'],
  'teach': ['teach', 'teaches', 'teaching', 'taught'],
  'win': ['win', 'wins', 'winning', 'won'],
  'write': ['write', 'writes', 'writing', 'wrote', 'written']
};

export class IrregularVerbs {
  /**
   * Get all forms of an irregular verb (including root)
   * Returns empty array if not an irregular verb
   */
  getForms(word: string): string[] {
    const lower = word.toLowerCase();
    
    // Check if word is in any irregular verb group
    for (const [root, forms] of Object.entries(IRREGULAR_VERBS)) {
      if (forms.includes(lower)) {
        return forms; // Return all forms
      }
    }
    
    return []; // Not an irregular verb
  }

  /**
   * Get root form of an irregular verb
   * Returns the word itself if not an irregular verb
   */
  getRoot(word: string): string {
    const lower = word.toLowerCase();
    
    for (const [root, forms] of Object.entries(IRREGULAR_VERBS)) {
      if (forms.includes(lower)) {
        return root;
      }
    }
    
    return lower; // Not irregular, return as-is
  }

  /**
   * Check if a word is an irregular verb
   */
  isIrregular(word: string): boolean {
    return this.getForms(word).length > 0;
  }

  /**
   * Normalize word: if irregular, return all forms; otherwise return word itself
   */
  normalize(word: string): string[] {
    const forms = this.getForms(word);
    if (forms.length > 0) {
      return forms;
    }
    return [word.toLowerCase()];
  }
}

