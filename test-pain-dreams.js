/**
 * Test script to check if two pain dreams match
 */

// Simulate the two pain dreams
const dream1 = {
  content: "Last night I saw a dream where I was bleeding somewhere near my lower abdomen, close to where the appendix or intestines are. The pain in the dream hit so suddenly and sharply that it felt exactly like something tearing inside. It was so real that it pulled me out of sleep instantly. The moment I woke up, I pressed my stomach to check if something actually happened, because the ache continued for a few seconds even after waking up. I've never felt anything like that except once during a severe stomach cramp years ago. It almost felt like my subconscious pulled an old pain memory and replayed it with full intensity, making it feel real even though it wasn't. I still don't know why the dream felt that physical, but the sensation stayed with me for a while.",
  dreamType: "nightmare",
  symbols: ["bleeding", "pain", "physical", "abdomen", "internal", "organ", "wake", "real", "memory", "subconscious"],
  emotions: ["fear", "anxiety", "pain", "shock"]
};

const dream2 = {
  content: "in dream i was bleeding somewhere near liver or kidneys and I the pain I felt in dream was so real that I woke up and when I woke up I checked myself I it was real pain (as I have a history of kidney stones). That pain felt so real that I can't even find words to describe that pain. If I had to describe that may I would say that the pain intensity was that something i felt during my kidney stone problems. Don't know may be something like pain memory in subconscious brain might have caused it and which is why it felt real",
  dreamType: "nightmare",
  symbols: ["bleeding", "pain", "physical", "kidneys", "liver", "internal", "organ", "wake", "real", "memory", "subconscious"],
  emotions: ["fear", "anxiety", "pain", "shock"]
};

// Simulate keyword extraction (4+ chars, no stop words)
function extractKeywords(content) {
  const stopWords = [
    'the', 'a', 'an', 'and', 'or', 'but', 'in', 'on', 'at', 'to', 'for',
    'of', 'with', 'by', 'from', 'as', 'is', 'was', 'are', 'were', 'been',
    'be', 'have', 'has', 'had', 'do', 'does', 'did', 'will', 'would',
    'could', 'should', 'may', 'might', 'must', 'can', 'this', 'that',
    'these', 'those', 'i', 'you', 'he', 'she', 'it', 'we', 'they',
    'my', 'your', 'his', 'her', 'its', 'our', 'their', 'me', 'him', 'her', 'us', 'them',
    'dream', 'dreamed', 'dreaming', 'dreams', 'felt', 'feeling', 'feel', 'felt',
    'remember', 'remembered', 'waking', 'woke', 'wake', 'awake', 'sleep', 'slept',
    'was', 'were', 'been', 'being', 'became', 'become', 'got', 'get', 'getting'
  ];

  const words = content
    .toLowerCase()
    .replace(/[^\w\s]/g, ' ')
    .split(/\s+/)
    .filter(w => w.length >= 4)
    .filter(w => !stopWords.includes(w))
    .slice(0, 15);

  return [...new Set(words)];
}

// Find shared symbols
function findSharedSymbols(symbols1, symbols2) {
  const set1 = new Set(symbols1.map(s => s.toLowerCase()));
  const set2 = new Set(symbols2.map(s => s.toLowerCase()));
  return [...set1].filter(s => set2.has(s));
}

// Find shared emotions
function findSharedEmotions(emotions1, emotions2) {
  const set1 = new Set(emotions1.map(e => e.toLowerCase()));
  const set2 = new Set(emotions2.map(e => e.toLowerCase()));
  return [...set2].filter(e => set1.has(e));
}

// Find shared keywords
function findSharedKeywords(content1, content2) {
  const keywords1 = extractKeywords(content1);
  const keywords2 = extractKeywords(content2);
  const set1 = new Set(keywords1);
  const set2 = new Set(keywords2);
  return [...set1].filter(k => set2.has(k));
}

// Test matching
console.log('🧪 Testing Pain Dream Matching\n');
console.log('='.repeat(60));

const sharedSymbols = findSharedSymbols(dream1.symbols, dream2.symbols);
const sharedEmotions = findSharedEmotions(dream1.emotions, dream2.emotions);
const sharedKeywords = findSharedKeywords(dream1.content, dream2.content);

console.log('📊 Dream 1 Symbols:', dream1.symbols.join(', '));
console.log('📊 Dream 2 Symbols:', dream2.symbols.join(', '));
console.log('✅ Shared Symbols:', sharedSymbols.join(', '));
console.log(`   Count: ${sharedSymbols.length}\n`);

console.log('📊 Dream 1 Emotions:', dream1.emotions.join(', '));
console.log('📊 Dream 2 Emotions:', dream2.emotions.join(', '));
console.log('✅ Shared Emotions:', sharedEmotions.join(', '));
console.log(`   Count: ${sharedEmotions.length}\n`);

console.log('📊 Dream 1 Keywords:', extractKeywords(dream1.content).join(', '));
console.log('📊 Dream 2 Keywords:', extractKeywords(dream2.content).join(', '));
console.log('✅ Shared Keywords:', sharedKeywords.join(', '));
console.log(`   Count: ${sharedKeywords.length}\n`);

// Calculate scores
const symbolScore = sharedSymbols.length * 0.4;
const emotionScore = sharedEmotions.length * 0.3;
const keywordScore = sharedKeywords.length * 0.2;
const typeBonus = dream1.dreamType === dream2.dreamType ? 0.1 : 0;
const totalScore = symbolScore + emotionScore + keywordScore + typeBonus;

console.log('📈 Match Scores:');
console.log(`   Symbol Score: ${symbolScore.toFixed(2)} (${sharedSymbols.length} × 0.4)`);
console.log(`   Emotion Score: ${emotionScore.toFixed(2)} (${sharedEmotions.length} × 0.3)`);
console.log(`   Keyword Score: ${keywordScore.toFixed(2)} (${sharedKeywords.length} × 0.2)`);
console.log(`   Type Bonus: ${typeBonus.toFixed(2)}`);
console.log(`   Total Score: ${totalScore.toFixed(2)}\n`);

// Check match criteria
const isMatch = 
  sharedSymbols.length >= 4 ||
  sharedEmotions.length >= 4 ||
  sharedKeywords.length >= 6 ||
  (sharedSymbols.length >= 3 && sharedKeywords.length >= 3) ||
  (sharedEmotions.length >= 3 && sharedKeywords.length >= 3) ||
  totalScore >= 3.0;

console.log('='.repeat(60));
console.log('🎯 Match Criteria:');
console.log(`   ✅ 4+ symbols: ${sharedSymbols.length >= 4 ? 'YES' : 'NO'} (${sharedSymbols.length})`);
console.log(`   ✅ 4+ emotions: ${sharedEmotions.length >= 4 ? 'YES' : 'NO'} (${sharedEmotions.length})`);
console.log(`   ✅ 6+ keywords: ${sharedKeywords.length >= 6 ? 'YES' : 'NO'} (${sharedKeywords.length})`);
console.log(`   ✅ 3+ symbols AND 3+ keywords: ${(sharedSymbols.length >= 3 && sharedKeywords.length >= 3) ? 'YES' : 'NO'}`);
console.log(`   ✅ 3+ emotions AND 3+ keywords: ${(sharedEmotions.length >= 3 && sharedKeywords.length >= 3) ? 'YES' : 'NO'}`);
console.log(`   ✅ Total score >= 3.0: ${totalScore >= 3.0 ? 'YES' : 'NO'} (${totalScore.toFixed(2)})`);
console.log('='.repeat(60));
console.log(`\n${isMatch ? '✅ MATCH' : '❌ NO MATCH'}\n`);

