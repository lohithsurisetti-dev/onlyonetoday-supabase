declare const Deno: any;

/**
 * Dream Interpretation Service
 * 
 * Provides comforting, uplifting interpretations for dreams
 * Special focus on lifting spirits for nightmares and negative dreams
 */

interface DreamInterpretation {
  title: string;
  meaning: string;
  emotionalGuidance: string;
  comfortMessage: string;
  actionAdvice: string;
  hopeMessage: string;
  isPositive: boolean;
  confidence: number;
}

interface DreamAnalysis {
  symbols: string[];
  emotions: string[];
  themes: string[];
  intensity: 'low' | 'medium' | 'high';
  dreamType: 'positive' | 'neutral' | 'negative' | 'nightmare';
}

export class DreamInterpretationService {
  private openaiToken: string;
  private openaiApiUrl = 'https://api.openai.com/v1';

  constructor() {
    this.openaiToken = Deno.env.get('OPENAI_API_KEY') || '';
  }

  /**
   * Interpret a dream with comforting, uplifting guidance
   */
  async interpretDream(
    content: string,
    dreamType: string,
    emotions: string[] = [],
    symbols: string[] = [],
    clarity: number = 5
  ): Promise<DreamInterpretation> {
    try {
      console.log(`🔮 Interpreting dream: "${content.substring(0, 50)}..."`);

      // Analyze the dream first
      const analysis = this.analyzeDream(content, dreamType, emotions, symbols, clarity);
      
      // Generate interpretation based on analysis
      const interpretation = await this.generateInterpretation(content, analysis);
      
      return interpretation;

    } catch (error) {
      console.error('❌ Dream interpretation failed:', error);
      
      // Fallback to a comforting generic response
      return this.getFallbackInterpretation(content, dreamType);
    }
  }

  /**
   * Analyze dream content to understand themes and emotions
   */
  private analyzeDream(
    content: string,
    dreamType: string,
    emotions: string[],
    symbols: string[],
    clarity: number
  ): DreamAnalysis {
    const contentLower = content.toLowerCase();
    
    // Extract symbols from content
    const extractedSymbols = this.extractSymbols(contentLower);
    const allSymbols = [...new Set([...symbols, ...extractedSymbols])];
    
    // Extract emotions from content
    const extractedEmotions = this.extractEmotions(contentLower);
    const allEmotions = [...new Set([...emotions, ...extractedEmotions])];
    
    // Determine themes
    const themes = this.identifyThemes(contentLower, allSymbols, allEmotions);
    
    // Determine intensity
    const intensity = this.determineIntensity(clarity, allEmotions, themes);
    
    // Determine dream type
    const analyzedDreamType = this.determineDreamType(dreamType, allEmotions, themes);
    
    return {
      symbols: allSymbols,
      emotions: allEmotions,
      themes,
      intensity,
      dreamType: analyzedDreamType
    };
  }

  /**
   * Generate AI-powered interpretation
   */
  private async generateInterpretation(
    content: string,
    analysis: DreamAnalysis
  ): Promise<DreamInterpretation> {
    const prompt = this.buildInterpretationPrompt(content, analysis);
    
    try {
      // Use OpenAI for better quality, unique interpretations
      // Free APIs tend to generate generic responses, so we prioritize OpenAI for dream interpretations
      if (!this.openaiToken) {
        console.log('⚠️ [Dream Interpretation] OPENAI_API_KEY not found, trying free APIs...');
        const freeResponse = await this.tryFreeAPIs(prompt);
        if (freeResponse) {
          console.log('✅ [Dream Interpretation] Using free API response');
          return this.parseAIResponse(freeResponse, analysis);
        }
        throw new Error('No API keys available');
      }

      console.log('💰 [Dream Interpretation] Using OpenAI GPT-3.5-turbo for high-quality, unique interpretations');
      const response = await fetch(`${this.openaiApiUrl}/chat/completions`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${this.openaiToken}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          model: 'gpt-3.5-turbo',
          messages: [
            {
              role: 'system',
              content: `You are a compassionate dream interpreter. Your job is to interpret REAL, SPECIFIC dreams that people actually had.

CRITICAL RULES:
1. ALWAYS mention the specific people, places, objects, and actions from the dream
2. If the dream mentions a person's name - use that exact name in your interpretation
3. If the dream mentions specific actions (like "playing", "hitting", "meeting") - talk about those exact actions
4. If the dream mentions specific objects (like "jersey", "ball", "car", "house") - reference those objects
5. Never give generic interpretations - every dream is unique and personal
6. Use SIMPLE words - write like you're talking to a 12-year-old
7. Be warm, encouraging, and personal
8. Reference the actual events, people, and things from the dream in your interpretation

EXAMPLE: If someone dreams "I met John and we played basketball", your interpretation MUST mention:
- Meeting John (use the actual name)
- Playing basketball (the specific activity)
- What these things mean for the dreamer

NEVER use fancy words like "signifies", "symbolizes", "transcendence", "transformation". 
USE simple words like "means", "shows", "tells you", "is about", "suggests".

Write in short sentences. Be personal. Talk about the SPECIFIC people, places, and things from the actual dream.`
            },
            {
              role: 'user',
              content: prompt
            }
          ],
          max_tokens: 500, // Reduced for faster generation (optimization)
          temperature: 0.8  // Higher temperature for more creative, unique responses
        }),
      });

      if (!response.ok) {
        throw new Error(`OpenAI API error: ${response.status}`);
      }

      const result = await response.json();
      const aiResponse = result.choices[0].message.content;
      
      console.log('✅ [Dream Interpretation] OpenAI API successful');
      return this.parseAIResponse(aiResponse, analysis);

    } catch (error) {
      console.error('❌ [Dream Interpretation] All APIs failed, using fallback interpretation');
      console.error(`   Error: ${error.message}`);
      return this.getFallbackInterpretation(content, analysis.dreamType);
    }
  }

  /**
   * Build prompt for AI interpretation
   */
  private buildInterpretationPrompt(content: string, analysis: DreamAnalysis): string {
    const isNegative = analysis.dreamType === 'negative' || analysis.dreamType === 'nightmare';
    
    // Extract key nouns and important details from the dream dynamically
    const extractKeyDetails = (text: string): string[] => {
      const details: string[] = [];
      const lower = text.toLowerCase();
      
      // Extract people names (capitalized words that appear after "met", "with", "and", etc.)
      const namePattern = /\b(?:met|with|and|playing|talking|saw|met)\s+([A-Z][a-z]+(?:\s+[A-Z][a-z]+)?)/g;
      const names = [...text.matchAll(namePattern)].map(m => m[1]);
      if (names.length > 0) {
        details.push(`People mentioned: ${names.join(', ')}`);
      }
      
      // Extract key activities/verbs
      const activities = ['playing', 'hitting', 'meeting', 'getting', 'gave', 'signed', 'dreamt'];
      const foundActivities = activities.filter(a => lower.includes(a));
      if (foundActivities.length > 0) {
        details.push(`Key activities: ${foundActivities.join(', ')}`);
      }
      
      // Extract important objects
      const objects = ['jersey', 'ball', 'bat', 'field', 'stadium', 'trophy', 'award'];
      const foundObjects = objects.filter(o => lower.includes(o));
      if (foundObjects.length > 0) {
        details.push(`Important objects: ${foundObjects.join(', ')}`);
      }
      
      return details;
    };
    
    const keyDetails = extractKeyDetails(content);
    const detailsText = keyDetails.length > 0 
      ? `\nKEY DETAILS FROM THIS DREAM:\n${keyDetails.map(d => `- ${d}`).join('\n')}\n`
      : '';
    
    return `You are interpreting a REAL, SPECIFIC dream that someone actually had. 

THE ACTUAL DREAM THE PERSON WROTE:
"${content}"
${detailsText}
YOUR JOB: Write an interpretation that talks about THE EXACT THINGS mentioned in the dream above. 

CRITICAL RULES:
1. Mention the SPECIFIC people, places, objects, and events from the dream
2. If the dream mentions a person's name - use that name in your interpretation
3. If the dream mentions specific actions (like "playing cricket", "hitting a six", "getting a jersey") - talk about those exact actions
4. If the dream mentions specific objects (like "jersey", "ball", "bat") - reference those objects
5. Make it personal to THIS specific dream - don't give generic interpretations

LANGUAGE RULES:
- Use SIMPLE words everyone knows (like talking to a 12-year-old)
- Write like you're talking to a friend
- NEVER use: "signifies", "symbolizes", "transcendence", "transformation", "represents", "embodies"
- USE: "means", "shows", "tells you", "is about", "suggests", "points to"
- Short sentences (10-15 words max)
- Be warm, encouraging, and personal

DREAM ANALYSIS:
- Type: ${analysis.dreamType}
- Emotions detected: ${analysis.emotions.length > 0 ? analysis.emotions.join(', ') : 'joy, excitement'}
- Symbols found: ${analysis.symbols.length > 0 ? analysis.symbols.join(', ') : 'various'}
- Themes: ${analysis.themes.length > 0 ? analysis.themes.join(', ') : 'personal experience'}

${isNegative ? 
  'This seems like a challenging dream. Focus on healing, growth, and finding strength.' :
  'This is a positive dream! Celebrate what it shows about the dreamer.'}

Write your response in this EXACT format:

TITLE: [A specific title that mentions key people/things from the dream - use simple words]
MEANING: [What this dream means - reference the specific people, actions, and objects from the dream. Use simple words.]
GUIDANCE: [How the dreamer should feel about this - mention the emotions from the dream]
COMFORT: [A warm message about this specific dream - reference the actual events]
ADVICE: [What the dreamer should do - relate it to the themes from the dream]
HOPE: [A hopeful message - connect it to what happened in the dream]

REMEMBER: Talk about the ACTUAL things from the dream above. Use the person's name if mentioned. Reference the specific actions and objects. Make it personal.`;
  }

  /**
   * Parse AI response into structured format
   */
  private parseAIResponse(aiResponse: string, analysis: DreamAnalysis): DreamInterpretation {
    const lines = aiResponse.split('\n').filter(line => line.trim());
    
    const interpretation: DreamInterpretation = {
      title: 'Your Dream Holds Special Meaning',
      meaning: 'Your dream is a reflection of your inner world and experiences.',
      emotionalGuidance: 'Trust in your inner wisdom and strength.',
      comfortMessage: 'You are safe, loved, and capable of handling whatever comes your way.',
      actionAdvice: 'Take time to reflect on your feelings and trust your intuition.',
      hopeMessage: 'Every dream is a step forward on your journey of growth and understanding.',
      isPositive: analysis.dreamType !== 'negative' && analysis.dreamType !== 'nightmare',
      confidence: 0.8
    };

    // Parse structured response - more flexible matching
    let currentSection = '';
    let currentText = '';
    
    for (const line of lines) {
      const trimmedLine = line.trim();
      
      // Check for section headers (case-insensitive, with or without colon)
      if (trimmedLine.match(/^TITLE:?/i)) {
        if (currentSection && currentText) {
          this.setInterpretationField(interpretation, currentSection, currentText.trim());
        }
        currentSection = 'title';
        currentText = trimmedLine.replace(/^TITLE:?/i, '').trim();
      } else if (trimmedLine.match(/^MEANING:?/i)) {
        if (currentSection && currentText) {
          this.setInterpretationField(interpretation, currentSection, currentText.trim());
        }
        currentSection = 'meaning';
        currentText = trimmedLine.replace(/^MEANING:?/i, '').trim();
      } else if (trimmedLine.match(/^GUIDANCE:?/i)) {
        if (currentSection && currentText) {
          this.setInterpretationField(interpretation, currentSection, currentText.trim());
        }
        currentSection = 'guidance';
        currentText = trimmedLine.replace(/^GUIDANCE:?/i, '').trim();
      } else if (trimmedLine.match(/^COMFORT:?/i)) {
        if (currentSection && currentText) {
          this.setInterpretationField(interpretation, currentSection, currentText.trim());
        }
        currentSection = 'comfort';
        currentText = trimmedLine.replace(/^COMFORT:?/i, '').trim();
      } else if (trimmedLine.match(/^ADVICE:?/i)) {
        if (currentSection && currentText) {
          this.setInterpretationField(interpretation, currentSection, currentText.trim());
        }
        currentSection = 'advice';
        currentText = trimmedLine.replace(/^ADVICE:?/i, '').trim();
      } else if (trimmedLine.match(/^HOPE:?/i)) {
        if (currentSection && currentText) {
          this.setInterpretationField(interpretation, currentSection, currentText.trim());
        }
        currentSection = 'hope';
        currentText = trimmedLine.replace(/^HOPE:?/i, '').trim();
      } else if (currentSection && trimmedLine && !trimmedLine.match(/^[A-Z]+:?$/)) {
        // Continue building current section (skip lines that look like new headers)
        currentText += (currentText ? ' ' : '') + trimmedLine;
      }
    }
    
    // Set the last section
    if (currentSection && currentText) {
      this.setInterpretationField(interpretation, currentSection, currentText.trim());
    }

    // Validate that we got meaningful content
    if (interpretation.meaning === 'Your dream is a reflection of your inner world and experiences.' && 
        interpretation.title === 'Your Dream Holds Special Meaning') {
      console.warn('⚠️ Parsed interpretation seems generic, AI response may not have been parsed correctly');
      console.log('Raw AI response (first 500 chars):', aiResponse.substring(0, 500));
    }

    return interpretation;
  }

  private setInterpretationField(interpretation: DreamInterpretation, section: string, text: string): void {
    if (!text) return;
    
    switch (section.toLowerCase()) {
      case 'title':
        interpretation.title = text;
        break;
      case 'meaning':
        interpretation.meaning = text;
        break;
      case 'guidance':
        interpretation.emotionalGuidance = text;
        break;
      case 'comfort':
        interpretation.comfortMessage = text;
        break;
      case 'advice':
        interpretation.actionAdvice = text;
        break;
      case 'hope':
        interpretation.hopeMessage = text;
        break;
    }
  }

  /**
   * Extract symbols from dream content
   */
  private extractSymbols(content: string): string[] {
    const symbolPatterns = {
      'flying': ['flying', 'soaring', 'floating', 'airborne', 'sky'],
      'water': ['water', 'ocean', 'sea', 'river', 'lake', 'swimming', 'drowning'],
      'animals': ['dog', 'cat', 'bird', 'snake', 'lion', 'tiger', 'bear', 'wolf'],
      'falling': ['falling', 'dropping', 'plummeting', 'descending'],
      'mountains': ['mountain', 'hill', 'peak', 'climbing', 'summit'],
      'home': ['home', 'house', 'room', 'bedroom', 'kitchen'],
      'fire': ['fire', 'flame', 'burning', 'smoke', 'heat'],
      'light': ['light', 'bright', 'sunshine', 'glow', 'illumination'],
      'darkness': ['dark', 'shadow', 'black', 'night', 'gloom'],
      'people': ['person', 'people', 'friend', 'family', 'stranger', 'ex', 'loved one', 'meeting', 'met'],
      'vehicles': ['car', 'bus', 'train', 'plane', 'bike', 'driving'],
      'nature': ['tree', 'forest', 'garden', 'flower', 'grass', 'leaf'],
      'sports': ['cricket', 'football', 'soccer', 'basketball', 'tennis', 'playing', 'game', 'match', 'ball', 'bat', 'bowling', 'batting', 'field', 'stadium', 'jersey', 'uniform', 'six', 'four', 'wicket', 'run', 'score'],
      'fame': ['celebrity', 'famous', 'star', 'hero', 'idol', 'icon', 'legend', 'signed', 'autograph'],
      'achievement': ['win', 'winning', 'success', 'victory', 'trophy', 'medal', 'award', 'accomplishment'],
      'pain': ['pain', 'ache', 'hurt', 'sore', 'stabbing', 'sharp', 'tearing', 'cramp', 'discomfort'],
      'bleeding': ['bleeding', 'blood', 'bleed', 'hemorrhage', 'wound', 'cut'],
      'internal_organs': ['abdomen', 'stomach', 'intestines', 'appendix', 'liver', 'kidneys', 'kidney', 'organ', 'internal', 'body'],
      'waking': ['woke', 'waking', 'awake', 'wake up', 'pulled out', 'instantly'],
      'physical_sensation': ['felt', 'feeling', 'sensation', 'physical', 'real', 'actual'],
      'memory': ['memory', 'remember', 'remembered', 'past', 'years ago', 'history'],
      'subconscious': ['subconscious', 'brain', 'mind']
    };

    const foundSymbols: string[] = [];
    
    for (const [symbol, patterns] of Object.entries(symbolPatterns)) {
      if (patterns.some(pattern => content.includes(pattern))) {
        foundSymbols.push(symbol);
      }
    }

    return foundSymbols;
  }

  /**
   * Extract emotions from dream content
   */
  private extractEmotions(content: string): string[] {
    const emotionPatterns = {
      'joy': ['happy', 'joy', 'excited', 'elated', 'cheerful', 'blissful'],
      'fear': ['scared', 'afraid', 'terrified', 'frightened', 'anxious', 'worried'],
      'peace': ['peaceful', 'calm', 'serene', 'tranquil', 'relaxed', 'content'],
      'confusion': ['confused', 'lost', 'bewildered', 'puzzled', 'unclear'],
      'wonder': ['amazed', 'wonder', 'awe', 'marvelous', 'incredible', 'magical'],
      'sadness': ['sad', 'depressed', 'melancholy', 'grief', 'sorrow', 'tears'],
      'anger': ['angry', 'mad', 'furious', 'rage', 'irritated', 'annoyed'],
      'excitement': ['excited', 'thrilled', 'energetic', 'pumped', 'enthusiastic'],
      'nostalgia': ['nostalgic', 'memories', 'remembering', 'past', 'childhood'],
      'anxiety': ['anxious', 'nervous', 'worried', 'stressed', 'tense', 'uneasy'],
      'freedom': ['free', 'liberated', 'unbound', 'unrestricted', 'independent'],
      'pain': ['pain', 'hurt', 'aching', 'sore', 'discomfort'],
      'shock': ['shock', 'shocked', 'sudden', 'suddenly', 'instantly', 'immediately']
    };

    const foundEmotions: string[] = [];
    
    for (const [emotion, patterns] of Object.entries(emotionPatterns)) {
      if (patterns.some(pattern => content.includes(pattern))) {
        foundEmotions.push(emotion);
      }
    }

    return foundEmotions;
  }

  /**
   * Identify themes in the dream
   */
  private identifyThemes(content: string, symbols: string[], emotions: string[]): string[] {
    const themes: string[] = [];
    
    // Freedom and escape
    if (symbols.includes('flying') || emotions.includes('freedom')) {
      themes.push('freedom', 'escape');
    }
    
    // Fear and anxiety
    if (emotions.includes('fear') || emotions.includes('anxiety') || symbols.includes('falling')) {
      themes.push('fear', 'anxiety');
    }
    
    // Peace and tranquility
    if (emotions.includes('peace') || symbols.includes('water') || symbols.includes('nature')) {
      themes.push('peace', 'tranquility');
    }
    
    // Relationships and connection
    if (symbols.includes('people') || emotions.includes('joy') || emotions.includes('sadness')) {
      themes.push('relationships', 'connection');
    }
    
    // Growth and transformation
    if (symbols.includes('mountains') || symbols.includes('fire') || emotions.includes('wonder')) {
      themes.push('growth', 'transformation');
    }
    
    // Home and security
    if (symbols.includes('home') || emotions.includes('peace')) {
      themes.push('security', 'belonging');
    }

    return [...new Set(themes)];
  }

  /**
   * Determine dream intensity
   */
  private determineIntensity(clarity: number, emotions: string[], themes: string[]): 'low' | 'medium' | 'high' {
    let intensity = clarity / 10; // Base intensity from clarity
    
    // Adjust based on emotions
    if (emotions.includes('fear') || emotions.includes('anger')) {
      intensity += 0.3;
    }
    if (emotions.includes('joy') || emotions.includes('wonder')) {
      intensity += 0.2;
    }
    
    // Adjust based on themes
    if (themes.includes('fear') || themes.includes('anxiety')) {
      intensity += 0.2;
    }
    
    if (intensity >= 0.7) return 'high';
    if (intensity >= 0.4) return 'medium';
    return 'low';
  }

  /**
   * Determine dream type
   */
  private determineDreamType(
    originalType: string,
    emotions: string[],
    themes: string[]
  ): 'positive' | 'neutral' | 'negative' | 'nightmare' {
    // Override with original type if it's specific
    if (originalType === 'nightmare') return 'nightmare';
    
    const negativeEmotions = ['fear', 'anxiety', 'sadness', 'anger'];
    const positiveEmotions = ['joy', 'peace', 'wonder', 'excitement', 'freedom'];
    
    const hasNegative = emotions.some(e => negativeEmotions.includes(e)) || 
                       themes.includes('fear') || themes.includes('anxiety');
    const hasPositive = emotions.some(e => positiveEmotions.includes(e)) || 
                       themes.includes('peace') || themes.includes('freedom');
    
    if (hasNegative && !hasPositive) {
      return 'negative';
    } else if (hasPositive && !hasNegative) {
      return 'positive';
    } else if (hasNegative && hasPositive) {
      return 'neutral';
    }
    
    return 'neutral';
  }

  /**
   * Try free APIs (Gemini, Hugging Face)
   */
  private async tryFreeAPIs(prompt: string): Promise<string | null> {
    // Try Gemini first
    console.log('🆓 [Dream Interpretation] Attempting Gemini API (free)...');
    const geminiResponse = await this.tryGeminiInterpretation(prompt);
    if (geminiResponse) {
      console.log('✅ [Dream Interpretation] SUCCESS: Using Gemini API (free)');
      return geminiResponse;
    }

    // Try Hugging Face as backup
    console.log('🆓 [Dream Interpretation] Gemini failed, attempting Hugging Face API (free)...');
    const hfResponse = await this.tryHuggingFaceInterpretation(prompt);
    if (hfResponse) {
      console.log('✅ [Dream Interpretation] SUCCESS: Using Hugging Face API (free)');
      return hfResponse;
    }

    console.log('❌ [Dream Interpretation] Both free APIs failed');
    return null;
  }

  /**
   * Try Gemini API (free alternative)
   */
  private async tryGeminiInterpretation(prompt: string): Promise<string | null> {
    try {
      const geminiApiKey = Deno.env.get('GEMINI_API_KEY');
      if (!geminiApiKey) {
        console.log('⚠️ [Dream Interpretation] GEMINI_API_KEY not found in environment');
        return null;
      }

      console.log('🆓 [Dream Interpretation] GEMINI_API_KEY found, calling Gemini API...');
      
      const response = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/gemini-pro:generateContent?key=${geminiApiKey}`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          contents: [{
            parts: [{
              text: `You are a compassionate dream interpreter who specializes in providing comforting, uplifting guidance. Your responses should:
1. Always be warm, welcoming, and supportive
2. For nightmares/negative dreams: focus on healing, growth, and hope
3. For positive dreams: celebrate and encourage
4. Provide practical, gentle advice
5. End with a message of hope and strength
6. Use a caring, understanding tone
7. Never be clinical or cold - be like a wise, loving friend

${prompt}`
            }]
          }],
          generationConfig: {
            temperature: 0.7,
            maxOutputTokens: 500,
          }
        }),
      });

      if (!response.ok) {
        const errorText = await response.text();
        console.log(`❌ [Dream Interpretation] Gemini API error: ${response.status} - ${errorText.substring(0, 100)}`);
        return null;
      }

      const result = await response.json();
      if (result.candidates && result.candidates[0] && result.candidates[0].content) {
        const geminiResponse = result.candidates[0].content.parts[0].text;
        console.log('✅ [Dream Interpretation] Gemini API response received');
        return geminiResponse;
      }

      console.log('⚠️ [Dream Interpretation] Gemini API returned unexpected format');
      return null;
    } catch (error) {
      console.log(`❌ [Dream Interpretation] Gemini API exception: ${error.message}`);
      return null;
    }
  }

  /**
   * Try Hugging Face API (free alternative)
   */
  private async tryHuggingFaceInterpretation(prompt: string): Promise<string | null> {
    try {
      const hfToken = Deno.env.get('HUGGINGFACE_API_KEY');
      if (!hfToken) {
        console.log('⚠️ [Dream Interpretation] HUGGINGFACE_API_KEY not found in environment');
        return null;
      }

      console.log('🆓 [Dream Interpretation] HUGGINGFACE_API_KEY found, calling Hugging Face API...');
      
      const response = await fetch('https://api-inference.huggingface.co/models/microsoft/DialoGPT-medium', {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${hfToken}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          inputs: prompt.substring(0, 500), // Limit input size
          parameters: {
            max_length: 200,
            temperature: 0.7,
            do_sample: true
          }
        }),
      });

      if (!response.ok) {
        const errorText = await response.text();
        console.log(`❌ [Dream Interpretation] Hugging Face API error: ${response.status} - ${errorText.substring(0, 100)}`);
        return null;
      }

      const result = await response.json();
      if (result && result[0] && result[0].generated_text) {
        console.log('✅ [Dream Interpretation] Hugging Face API response received');
        return result[0].generated_text;
      }

      console.log('⚠️ [Dream Interpretation] Hugging Face API returned unexpected format');
      return null;
    } catch (error) {
      console.log(`❌ [Dream Interpretation] Hugging Face API exception: ${error.message}`);
      return null;
    }
  }

  /**
   * Fallback interpretation when AI fails
   */
  private getFallbackInterpretation(content: string, dreamType: string): DreamInterpretation {
    const isNegative = dreamType === 'negative' || dreamType === 'nightmare';
    
    if (isNegative) {
      return {
        title: 'Your Dream Shows Inner Strength',
        meaning: 'Even challenging dreams are your mind\'s way of processing and healing. This dream reflects your inner resilience and capacity for growth.',
        emotionalGuidance: 'It\'s completely normal to have difficult dreams. They often represent your subconscious working through challenges and preparing you for strength.',
        comfortMessage: 'You are safe, you are loved, and you have the inner strength to handle whatever life brings. This dream is just your mind taking care of you.',
        actionAdvice: 'Take some time for gentle self-care today. Consider journaling about your feelings or talking to someone you trust.',
        hopeMessage: 'Remember, every difficult dream is a step toward greater understanding and inner peace. You\'re growing stronger every day.',
        isPositive: false,
        confidence: 0.6
      };
    } else {
      return {
        title: 'Your Dream Holds Beautiful Meaning',
        meaning: 'Your dream reflects the beautiful complexity of your inner world and your capacity for wonder and growth.',
        emotionalGuidance: 'Trust in the wisdom of your dreams. They often carry messages of hope, guidance, and encouragement from your deeper self.',
        comfortMessage: 'You are exactly where you need to be on your journey. Your dreams are a gift that connects you to your inner wisdom.',
        actionAdvice: 'Consider keeping a dream journal to explore the patterns and messages in your dreams. They have much to teach you.',
        hopeMessage: 'Your dreams are a reminder of the infinite possibilities within you. Trust in your journey and the magic of your inner world.',
        isPositive: true,
        confidence: 0.6
      };
    }
  }
}
