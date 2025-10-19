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
      // Try free APIs first, then fallback to OpenAI
      const freeResponse = await this.tryFreeAPIs(prompt);
      if (freeResponse) {
        return this.parseAIResponse(freeResponse, analysis);
      }

      // Fallback to OpenAI
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
              content: `You are a compassionate dream interpreter who specializes in providing comforting, uplifting guidance. Your responses should:
1. Always be warm, welcoming, and supportive
2. For nightmares/negative dreams: focus on healing, growth, and hope
3. For positive dreams: celebrate and encourage
4. Provide practical, gentle advice
5. End with a message of hope and strength
6. Use a caring, understanding tone
7. Never be clinical or cold - be like a wise, loving friend`
            },
            {
              role: 'user',
              content: prompt
            }
          ],
          max_tokens: 500,
          temperature: 0.7
        }),
      });

      if (!response.ok) {
        throw new Error(`OpenAI API error: ${response.status}`);
      }

      const result = await response.json();
      const aiResponse = result.choices[0].message.content;
      
      return this.parseAIResponse(aiResponse, analysis);

    } catch (error) {
      console.error('❌ AI interpretation failed:', error);
      return this.getFallbackInterpretation(content, analysis.dreamType);
    }
  }

  /**
   * Build prompt for AI interpretation
   */
  private buildInterpretationPrompt(content: string, analysis: DreamAnalysis): string {
    const isNegative = analysis.dreamType === 'negative' || analysis.dreamType === 'nightmare';
    
    return `Please interpret this dream with a warm, comforting approach:

DREAM: "${content}"

ANALYSIS:
- Dream Type: ${analysis.dreamType}
- Emotions: ${analysis.emotions.join(', ')}
- Symbols: ${analysis.symbols.join(', ')}
- Themes: ${analysis.themes.join(', ')}
- Intensity: ${analysis.intensity}

${isNegative ? 
  'This appears to be a challenging dream. Please provide a comforting interpretation that:' :
  'Please provide an uplifting interpretation that:'}

1. Explains the dream's meaning in a gentle, understanding way
2. ${isNegative ? 'Focuses on healing, growth, and inner strength' : 'Celebrates the positive aspects and potential'}
3. Provides practical, gentle advice for the dreamer
4. Ends with a message of hope and encouragement
5. Uses a warm, caring tone throughout

Format your response as:
TITLE: [A comforting, hopeful title]
MEANING: [The dream's deeper meaning]
GUIDANCE: [Gentle emotional guidance]
COMFORT: [A comforting message]
ADVICE: [Practical advice]
HOPE: [A message of hope and strength]`;
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

    // Parse structured response
    for (const line of lines) {
      if (line.startsWith('TITLE:')) {
        interpretation.title = line.replace('TITLE:', '').trim();
      } else if (line.startsWith('MEANING:')) {
        interpretation.meaning = line.replace('MEANING:', '').trim();
      } else if (line.startsWith('GUIDANCE:')) {
        interpretation.emotionalGuidance = line.replace('GUIDANCE:', '').trim();
      } else if (line.startsWith('COMFORT:')) {
        interpretation.comfortMessage = line.replace('COMFORT:', '').trim();
      } else if (line.startsWith('ADVICE:')) {
        interpretation.actionAdvice = line.replace('ADVICE:', '').trim();
      } else if (line.startsWith('HOPE:')) {
        interpretation.hopeMessage = line.replace('HOPE:', '').trim();
      }
    }

    return interpretation;
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
      'people': ['person', 'people', 'friend', 'family', 'stranger', 'ex', 'loved one'],
      'vehicles': ['car', 'bus', 'train', 'plane', 'bike', 'driving'],
      'nature': ['tree', 'forest', 'garden', 'flower', 'grass', 'leaf']
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
      'freedom': ['free', 'liberated', 'unbound', 'unrestricted', 'independent']
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
    const geminiResponse = await this.tryGeminiInterpretation(prompt);
    if (geminiResponse) return geminiResponse;

    // Try Hugging Face as backup
    const hfResponse = await this.tryHuggingFaceInterpretation(prompt);
    if (hfResponse) return hfResponse;

    return null;
  }

  /**
   * Try Gemini API (free alternative)
   */
  private async tryGeminiInterpretation(prompt: string): Promise<string | null> {
    try {
      const geminiApiKey = Deno.env.get('GEMINI_API_KEY');
      if (!geminiApiKey) {
        console.log('🔍 No Gemini API key found, using fallback');
        return null;
      }

      console.log('🆓 Trying Gemini API (free)...');
      
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
        console.log(`❌ Gemini API error: ${response.status}`);
        return null;
      }

      const result = await response.json();
      if (result.candidates && result.candidates[0] && result.candidates[0].content) {
        const geminiResponse = result.candidates[0].content.parts[0].text;
        console.log('✅ Gemini API successful!');
        return geminiResponse;
      }

      return null;
    } catch (error) {
      console.log('❌ Gemini API failed:', error.message);
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
        console.log('🔍 No Hugging Face API key found');
        return null;
      }

      console.log('🆓 Trying Hugging Face API (free)...');
      
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
        console.log(`❌ Hugging Face API error: ${response.status}`);
        return null;
      }

      const result = await response.json();
      if (result && result[0] && result[0].generated_text) {
        console.log('✅ Hugging Face API successful!');
        return result[0].generated_text;
      }

      return null;
    } catch (error) {
      console.log('❌ Hugging Face API failed:', error.message);
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
