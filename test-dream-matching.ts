/**
 * Test Dream Matching with Similar Dreams (Different Wordings)
 */

import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

const supabaseUrl = Deno.env.get('SUPABASE_URL') || 'http://127.0.0.1:54321';
const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') || 'sb_secret_N7UND0UgjKTVK-Uodkm0Hg_xSvEMPvz';

const supabase = createClient(supabaseUrl, supabaseServiceKey);

// Import the matching service
const { DreamMatcherV2 } = await import('./functions/shared/services/DreamMatcherV2.ts');

async function testDreamMatching() {
  console.log('🧪 Testing Dream Matching with Similar Dreams (Different Wordings)\n');

  // Test Case 1: Very Similar Dreams (should match)
  const dream1 = {
    content: "I dreamt of meeting MS Dhoni and played cricket with him. He gave me a signed jersey and I hit a six in his bowling.",
    dreamType: 'night_dream',
    symbols: ['fame', 'sports', 'achievement', 'meeting'],
    emotions: ['excitement', 'joy', 'pride'],
    clarity: 8
  };

  const dream2 = {
    content: "I had a dream where I met MS Dhoni and we played cricket together. He presented me with an autographed jersey and I managed to hit a six off his bowling.",
    dreamType: 'night_dream',
    symbols: ['fame', 'sports', 'achievement', 'meeting'],
    emotions: ['excitement', 'joy', 'pride'],
    clarity: 8
  };

  // Test Case 2: Similar but Different (should maybe match)
  const dream3 = {
    content: "I saw a dream about playing cricket with MS Dhoni. He gave me his signed jersey and I scored a six.",
    dreamType: 'night_dream',
    symbols: ['fame', 'sports', 'achievement'],
    emotions: ['excitement', 'joy'],
    clarity: 7
  };

  // Test Case 3: Different Dream (should not match)
  const dream4 = {
    content: "I dreamt I was flying a spaceship and traveled at light speed through the galaxy.",
    dreamType: 'night_dream',
    symbols: ['space', 'travel', 'freedom'],
    emotions: ['wonder', 'excitement'],
    clarity: 9
  };

  const matcher = new DreamMatcherV2(supabase);

  console.log('📝 Test Case 1: Very Similar Dreams (Different Wordings)');
  console.log('Dream 1:', dream1.content.substring(0, 80) + '...');
  console.log('Dream 2:', dream2.content.substring(0, 80) + '...\n');
  
  const match1 = matcher.matchDreams(dream1, dream2);
  console.log('Match Result:', match1.isMatch ? '✅ MATCHED' : '❌ NOT MATCHED');
  console.log('Confidence:', (match1.confidence * 100).toFixed(1) + '%');
  console.log('Reason:', match1.reason);
  console.log('Shared Symbols:', match1.sharedSymbols);
  console.log('Shared Emotions:', match1.sharedEmotions);
  console.log('Shared Keywords:', match1.sharedKeywords.length, 'keywords');
  console.log('');

  console.log('📝 Test Case 2: Similar but Different Wording');
  console.log('Dream 1:', dream1.content.substring(0, 80) + '...');
  console.log('Dream 3:', dream3.content.substring(0, 80) + '...\n');
  
  const match2 = matcher.matchDreams(dream1, dream3);
  console.log('Match Result:', match2.isMatch ? '✅ MATCHED' : '❌ NOT MATCHED');
  console.log('Confidence:', (match2.confidence * 100).toFixed(1) + '%');
  console.log('Reason:', match2.reason);
  console.log('Shared Symbols:', match2.sharedSymbols);
  console.log('Shared Emotions:', match2.sharedEmotions);
  console.log('Shared Keywords:', match2.sharedKeywords.length, 'keywords');
  console.log('');

  console.log('📝 Test Case 3: Completely Different Dreams');
  console.log('Dream 1:', dream1.content.substring(0, 80) + '...');
  console.log('Dream 4:', dream4.content.substring(0, 80) + '...\n');
  
  const match3 = matcher.matchDreams(dream1, dream4);
  console.log('Match Result:', match3.isMatch ? '✅ MATCHED' : '❌ NOT MATCHED');
  console.log('Confidence:', (match3.confidence * 100).toFixed(1) + '%');
  console.log('Reason:', match3.reason);
  console.log('Shared Symbols:', match3.sharedSymbols);
  console.log('Shared Emotions:', match3.sharedEmotions);
  console.log('Shared Keywords:', match3.sharedKeywords.length, 'keywords');
  console.log('');

  // Test content similarity calculation
  console.log('📊 Content Similarity Analysis:');
  const similarity1 = calculateContentSimilarity(dream1.content, dream2.content);
  const similarity2 = calculateContentSimilarity(dream1.content, dream3.content);
  const similarity3 = calculateContentSimilarity(dream1.content, dream4.content);
  
  console.log(`Dream 1 vs Dream 2: ${(similarity1 * 100).toFixed(1)}% similar`);
  console.log(`Dream 1 vs Dream 3: ${(similarity2 * 100).toFixed(1)}% similar`);
  console.log(`Dream 1 vs Dream 4: ${(similarity3 * 100).toFixed(1)}% similar`);
}

function calculateContentSimilarity(text1: string, text2: string): number {
  if (!text1 || !text2) return 0;
  
  // Normalize: remove punctuation, split into words
  const words1 = new Set(text1.replace(/[^\w\s]/g, ' ').toLowerCase().split(/\s+/).filter(w => w.length > 2));
  const words2 = new Set(text2.replace(/[^\w\s]/g, ' ').toLowerCase().split(/\s+/).filter(w => w.length > 2));
  
  if (words1.size === 0 || words2.size === 0) return 0;
  
  // Calculate Jaccard similarity (intersection / union)
  const intersection = [...words1].filter(w => words2.has(w)).length;
  const union = new Set([...words1, ...words2]).size;
  
  return intersection / union;
}

// Run the test
testDreamMatching().catch(console.error);

