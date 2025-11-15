/**
 * Test script for dynamic synonym matching
 * Tests stemming + irregular verb matching
 */

import { Stemmer } from './shared/services/Stemmer.ts';
import { IrregularVerbs } from './shared/services/IrregularVerbs.ts';

const stemmer = new Stemmer();
const irregularVerbs = new IrregularVerbs();

/**
 * Test cases for matching
 */
const testCases = [
  // Verb tense matching (should match)
  {
    post1: "I went to the gym",
    post2: "I go to the gym",
    shouldMatch: true,
    reason: "went/go (irregular verb)"
  },
  {
    post1: "I ran today",
    post2: "I run every day",
    shouldMatch: true,
    reason: "ran/run (irregular verb)"
  },
  {
    post1: "I ate pizza",
    post2: "I eat pizza",
    shouldMatch: true,
    reason: "ate/eat (irregular verb)"
  },
  {
    post1: "I was running",
    post2: "I run daily",
    shouldMatch: true,
    reason: "running/run (stemming)"
  },
  {
    post1: "I am eating lunch",
    post2: "I eat lunch",
    shouldMatch: true,
    reason: "eating/eat (stemming)"
  },
  {
    post1: "I saw a movie",
    post2: "I see movies",
    shouldMatch: true,
    reason: "saw/see (irregular verb)"
  },
  {
    post1: "I made coffee",
    post2: "I make coffee",
    shouldMatch: true,
    reason: "made/make (irregular verb)"
  },
  {
    post1: "I took a walk",
    post2: "I take walks",
    shouldMatch: true,
    reason: "took/take (irregular verb)"
  },
  // Should NOT match (different actions)
  {
    post1: "I went to the gym",
    post2: "I watched a movie",
    shouldMatch: false,
    reason: "Different actions"
  },
  {
    post1: "I ate pizza",
    post2: "I drank coffee",
    shouldMatch: false,
    reason: "Different actions"
  }
];

/**
 * Extract keywords from content (simplified version)
 */
function extractKeywords(content: string): string[] {
  const stopWords = [
    'the', 'a', 'an', 'and', 'or', 'but', 'in', 'on', 'at', 'to', 'for',
    'of', 'with', 'by', 'from', 'as', 'is', 'was', 'are', 'were', 'been',
    'be', 'have', 'has', 'had', 'do', 'does', 'did', 'will', 'would',
    'could', 'should', 'may', 'might', 'must', 'can', 'this', 'that',
    'i', 'you', 'he', 'she', 'it', 'we', 'they'
  ];

  const words = content
    .toLowerCase()
    .replace(/[^\w\s]/g, ' ')
    .split(/\s+/)
    .filter(w => w.length > 2)
    .filter(w => !stopWords.includes(w));

  // Normalize words: stem + irregular verbs
  const normalized: string[] = [];
  for (const word of words) {
    const irregularForms = irregularVerbs.getForms(word);
    if (irregularForms.length > 0) {
      normalized.push(irregularVerbs.getRoot(word), ...irregularForms);
    } else {
      const stemmed = stemmer.stem(word);
      normalized.push(stemmed);
    }
  }

  return [...new Set(normalized)];
}

/**
 * Calculate keyword overlap
 */
function calculateOverlap(keywords1: string[], keywords2: string[]): number {
  const set1 = new Set(keywords1);
  const set2 = new Set(keywords2);
  return [...set1].filter(k => set2.has(k)).length;
}

/**
 * Run tests
 */
function runTests() {
  console.log('🧪 Testing Dynamic Synonym Matching\n');
  console.log('='.repeat(60));

  let passed = 0;
  let failed = 0;

  for (const test of testCases) {
    const keywords1 = extractKeywords(test.post1);
    const keywords2 = extractKeywords(test.post2);
    const overlap = calculateOverlap(keywords1, keywords2);
    const matches = overlap >= 2;

    const result = matches === test.shouldMatch;
    
    if (result) {
      passed++;
      console.log(`✅ PASS: ${test.reason}`);
    } else {
      failed++;
      console.log(`❌ FAIL: ${test.reason}`);
    }
    
    console.log(`   Post 1: "${test.post1}"`);
    console.log(`   Post 2: "${test.post2}"`);
    console.log(`   Keywords 1: [${keywords1.join(', ')}]`);
    console.log(`   Keywords 2: [${keywords2.join(', ')}]`);
    console.log(`   Overlap: ${overlap} (${matches ? 'MATCH' : 'NO MATCH'})`);
    console.log(`   Expected: ${test.shouldMatch ? 'MATCH' : 'NO MATCH'}`);
    console.log('');
  }

  console.log('='.repeat(60));
  console.log(`\n📊 Results: ${passed} passed, ${failed} failed`);
  console.log(`Success rate: ${((passed / testCases.length) * 100).toFixed(1)}%\n`);
}

// Run tests
runTests();

