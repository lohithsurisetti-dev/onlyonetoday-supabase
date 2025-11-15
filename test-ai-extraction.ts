/**
 * Test AI extraction service to see which API is working
 */

declare const Deno: any;

const testDream = "Last night I saw a dream where I was bleeding somewhere near my lower abdomen, close to where the appendix or intestines are. The pain in the dream hit so suddenly and sharply that it felt exactly like something tearing inside. It was so real that it pulled me out of sleep instantly.";

async function testOpenAI() {
  const openaiApiKey = Deno.env.get('OPENAI_API_KEY');
  if (!openaiApiKey) {
    console.log('❌ OPENAI_API_KEY not found');
    return null;
  }

  console.log('\n🧪 Testing OpenAI (gpt-4o-mini)...');
  
  const prompt = `Analyze this dream content and extract emotions, symbols, themes, and dream type. Respond with valid JSON only.

Dream content: "${testDream}"

Extract:
1. Emotions (with confidence scores 0-1)
2. Symbols (with categories and confidence scores)
3. Themes (main topics/subjects)
4. Dream intensity (1-10 scale)
5. Dream type (night_dream, daydream, lucid_dream, nightmare)

Respond with this exact JSON format:
{
  "emotions": [
    {"emotion": "fear", "confidence": 0.9, "context": "feeling pain"}
  ],
  "symbols": [
    {"symbol": "bleeding", "category": "physical", "confidence": 0.95, "context": "bleeding near abdomen"}
  ],
  "themes": ["pain", "physical", "waking"],
  "intensity": 8,
  "dreamType": "nightmare"
}`;

  try {
    const response = await fetch('https://api.openai.com/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${openaiApiKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        model: 'gpt-4o-mini',
        messages: [
          {
            role: 'system',
            content: 'You are an expert dream analyst. Extract emotions, symbols, themes, and dream type from dream content. Always respond with valid JSON.'
          },
          {
            role: 'user',
            content: prompt
          }
        ],
        temperature: 0.3,
        max_tokens: 300
      })
    });

    if (!response.ok) {
      const errorText = await response.text();
      console.log(`❌ OpenAI API error: ${response.status} - ${errorText}`);
      return null;
    }

    const data = await response.json();
    const extractedText = data.choices?.[0]?.message?.content;
    
    if (!extractedText) {
      console.log('❌ No response from OpenAI');
      return null;
    }

    console.log('✅ OpenAI Response:');
    console.log(extractedText);
    
    // Try to parse JSON
    try {
      const jsonMatch = extractedText.match(/\{[\s\S]*\}/);
      if (jsonMatch) {
        const parsed = JSON.parse(jsonMatch[0]);
        console.log('\n📊 Parsed Result:');
        console.log(`   Emotions: ${parsed.emotions?.map((e: any) => e.emotion).join(', ') || 'none'}`);
        console.log(`   Symbols: ${parsed.symbols?.map((s: any) => s.symbol).join(', ') || 'none'}`);
        console.log(`   Themes: ${parsed.themes?.join(', ') || 'none'}`);
        console.log(`   Dream Type: ${parsed.dreamType || 'unknown'}`);
        return parsed;
      }
    } catch (parseError) {
      console.log('⚠️ Could not parse JSON from response');
    }

    return { raw: extractedText };
  } catch (error) {
    console.log(`❌ OpenAI test failed: ${error.message}`);
    return null;
  }
}

async function testGemini() {
  const geminiApiKey = Deno.env.get('GEMINI_API_KEY');
  if (!geminiApiKey || geminiApiKey.trim() === '') {
    console.log('\n⚠️ GEMINI_API_KEY not found or empty (skipping)');
    return null;
  }

  console.log('\n🧪 Testing Gemini...');
  
  const prompt = `Analyze this dream content and extract emotions, symbols, themes, and dream type. Respond with valid JSON only.

Dream content: "${testDream}"

Extract:
1. Emotions (with confidence scores 0-1)
2. Symbols (with categories and confidence scores)
3. Themes (main topics/subjects)
4. Dream intensity (1-10 scale)
5. Dream type (night_dream, daydream, lucid_dream, nightmare)

Respond with this exact JSON format:
{
  "emotions": [
    {"emotion": "fear", "confidence": 0.9, "context": "feeling pain"}
  ],
  "symbols": [
    {"symbol": "bleeding", "category": "physical", "confidence": 0.95, "context": "bleeding near abdomen"}
  ],
  "themes": ["pain", "physical", "waking"],
  "intensity": 8,
  "dreamType": "nightmare"
}`;

  try {
    const response = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/gemini-pro:generateContent?key=${geminiApiKey}`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        contents: [{
          parts: [{
            text: prompt
          }]
        }]
      })
    });

    if (!response.ok) {
      const errorText = await response.text();
      console.log(`❌ Gemini API error: ${response.status} - ${errorText}`);
      return null;
    }

    const data = await response.json();
    const extractedText = data.candidates?.[0]?.content?.parts?.[0]?.text;
    
    if (!extractedText) {
      console.log('❌ No response from Gemini');
      return null;
    }

    console.log('✅ Gemini Response:');
    console.log(extractedText);
    return { raw: extractedText };
  } catch (error) {
    console.log(`❌ Gemini test failed: ${error.message}`);
    return null;
  }
}

async function testHuggingFace() {
  const huggingfaceApiKey = Deno.env.get('HUGGINGFACE_API_KEY');
  if (!huggingfaceApiKey) {
    console.log('\n⚠️ HUGGINGFACE_API_KEY not found (skipping)');
    return null;
  }

  console.log('\n🧪 Testing Hugging Face...');
  console.log('⚠️ Note: Hugging Face model may not be suitable for structured extraction');
  
  // Skip Hugging Face for now as it's a chat model, not ideal for structured extraction
  console.log('⏭️ Skipping Hugging Face (not ideal for structured JSON extraction)');
  return null;
}

async function main() {
  console.log('🔍 Testing AI Extraction APIs\n');
  console.log('='.repeat(60));
  console.log(`Test Dream: "${testDream.substring(0, 80)}..."`);
  console.log('='.repeat(60));

  const results: any = {};

  // Test OpenAI (primary)
  results.openai = await testOpenAI();

  // Test Gemini (free alternative)
  results.gemini = await testGemini();

  // Test Hugging Face (skip for now)
  results.huggingface = await testHuggingFace();

  console.log('\n' + '='.repeat(60));
  console.log('📊 Summary:');
  console.log(`   OpenAI: ${results.openai ? '✅ Working' : '❌ Failed'}`);
  console.log(`   Gemini: ${results.gemini ? '✅ Working' : '❌ Failed/Not Configured'}`);
  console.log(`   Hugging Face: ⏭️ Skipped`);
  console.log('='.repeat(60));

  if (results.openai) {
    console.log('\n✅ Primary API (OpenAI) is working!');
  } else {
    console.log('\n❌ Primary API (OpenAI) is not working. Check API key and billing.');
  }
}

main().catch(console.error);

