// Simple test to check OpenAI API
const testDream = "Last night I saw a dream where I was bleeding somewhere near my lower abdomen. The pain hit so suddenly and sharply that it felt exactly like something tearing inside.";

async function testOpenAI() {
  const openaiApiKey = process.env.OPENAI_API_KEY;
  if (!openaiApiKey) {
    console.log('❌ OPENAI_API_KEY not found');
    return;
  }

  console.log('🧪 Testing OpenAI (gpt-4o-mini)...\n');
  
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
      console.log(`❌ OpenAI API error: ${response.status}`);
      console.log(errorText.substring(0, 200));
      return;
    }

    const data = await response.json();
    const extractedText = data.choices?.[0]?.message?.content;
    
    if (!extractedText) {
      console.log('❌ No response from OpenAI');
      return;
    }

    console.log('✅ OpenAI Response Received!\n');
    console.log('Raw Response:');
    console.log(extractedText);
    console.log('\n' + '='.repeat(60));
    
    // Try to parse JSON
    try {
      const jsonMatch = extractedText.match(/\{[\s\S]*\}/);
      if (jsonMatch) {
        const parsed = JSON.parse(jsonMatch[0]);
        console.log('📊 Parsed Result:');
        console.log(`   Emotions: ${parsed.emotions?.map(e => e.emotion).join(', ') || 'none'}`);
        console.log(`   Symbols: ${parsed.symbols?.map(s => s.symbol).join(', ') || 'none'}`);
        console.log(`   Themes: ${parsed.themes?.join(', ') || 'none'}`);
        console.log(`   Dream Type: ${parsed.dreamType || 'unknown'}`);
        console.log(`   Intensity: ${parsed.intensity || 'unknown'}`);
        console.log('\n✅ API is working correctly!');
      } else {
        console.log('⚠️ Could not find JSON in response');
      }
    } catch (parseError) {
      console.log('⚠️ Could not parse JSON:', parseError.message);
    }
  } catch (error) {
    console.log(`❌ OpenAI test failed: ${error.message}`);
  }
}

// Load env vars
require('dotenv').config({ path: '.env.local' });
testOpenAI();
