declare const Deno: any;

/**
 * AI-Powered Dream Extraction Service
 * Uses OpenAI/Gemini to intelligently extract emotions and symbols from any dream content
 */

export interface ExtractedEmotion {
  emotion: string;
  confidence: number;
  context?: string;
}

export interface ExtractedSymbol {
  symbol: string;
  category: string;
  confidence: number;
  context?: string;
}

export interface DreamExtractionResult {
  emotions: ExtractedEmotion[];
  symbols: ExtractedSymbol[];
  themes: string[];
  intensity: number; // 1-10 scale
  dreamType: 'night_dream' | 'daydream' | 'lucid_dream' | 'nightmare';
}

export class AIDreamExtractionService {
  private openaiApiKey: string;
  private geminiApiKey: string;
  private huggingfaceApiKey: string;

  constructor() {
    this.openaiApiKey = Deno.env.get('OPENAI_API_KEY') || '';
    this.geminiApiKey = Deno.env.get('GEMINI_API_KEY') || '';
    this.huggingfaceApiKey = Deno.env.get('HUGGINGFACE_API_KEY') || '';
  }

  /**
   * Extract emotions, symbols, and themes from dream content using AI
   */
  async extractDreamElements(content: string): Promise<DreamExtractionResult> {
    try {
      console.log('🤖 Extracting dream elements with AI...');

      // Try free APIs first, then fallback to OpenAI
      let result = await this.tryFreeAPIs(content);
      
      if (!result) {
        result = await this.tryOpenAI(content);
      }

      if (!result) {
        // Fallback to basic extraction
        result = this.getFallbackExtraction(content);
      }

      return result;

    } catch (error) {
      console.error('❌ AI extraction failed:', error);
      return this.getFallbackExtraction(content);
    }
  }

  /**
   * Try free APIs first (Gemini, Hugging Face)
   */
  private async tryFreeAPIs(content: string): Promise<DreamExtractionResult | null> {
    // Try Gemini first
    if (this.geminiApiKey) {
      try {
        const result = await this.tryGeminiExtraction(content);
        if (result) return result;
      } catch (error) {
        console.log('⚠️ Gemini extraction failed:', error);
      }
    }

    // Try Hugging Face
    if (this.huggingfaceApiKey) {
      try {
        const result = await this.tryHuggingFaceExtraction(content);
        if (result) return result;
      } catch (error) {
        console.log('⚠️ Hugging Face extraction failed:', error);
      }
    }

    return null;
  }

  /**
   * Try Gemini API for extraction
   */
  private async tryGeminiExtraction(content: string): Promise<DreamExtractionResult | null> {
    const prompt = this.buildExtractionPrompt(content);
    
    const response = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/gemini-pro:generateContent?key=${this.geminiApiKey}`, {
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
      throw new Error(`Gemini API error: ${response.status}`);
    }

    const data = await response.json();
    const extractedText = data.candidates?.[0]?.content?.parts?.[0]?.text;
    
    if (!extractedText) {
      throw new Error('No response from Gemini');
    }

    return this.parseAIResponse(extractedText);
  }

  /**
   * Try Hugging Face API for extraction
   */
  private async tryHuggingFaceExtraction(content: string): Promise<DreamExtractionResult | null> {
    const prompt = this.buildExtractionPrompt(content);
    
    const response = await fetch('https://api-inference.huggingface.co/models/microsoft/DialoGPT-medium', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${this.huggingfaceApiKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        inputs: prompt,
        parameters: {
          max_length: 500,
          temperature: 0.7
        }
      })
    });

    if (!response.ok) {
      throw new Error(`Hugging Face API error: ${response.status}`);
    }

    const data = await response.json();
    const extractedText = data[0]?.generated_text;
    
    if (!extractedText) {
      throw new Error('No response from Hugging Face');
    }

    return this.parseAIResponse(extractedText);
  }

  /**
   * Try OpenAI API as fallback
   */
  private async tryOpenAI(content: string): Promise<DreamExtractionResult | null> {
    if (!this.openaiApiKey) {
      return null;
    }

    // Try the cheapest model first (gpt-3.5-turbo-instruct)
    let result = await this.tryOpenAICheapest(content);
    if (result) return result;

    // Fallback to gpt-4o-mini if cheapest fails
    return await this.tryOpenAIMini(content);
  }

  /**
   * Try OpenAI's cheapest model (gpt-3.5-turbo-instruct)
   */
  private async tryOpenAICheapest(content: string): Promise<DreamExtractionResult | null> {
    const prompt = this.buildExtractionPrompt(content);
    
    const response = await fetch('https://api.openai.com/v1/completions', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${this.openaiApiKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        model: 'gpt-3.5-turbo-instruct', // Cheapest model available
        prompt: `You are an expert dream analyst. Extract emotions, symbols, themes, and dream type from dream content. Always respond with valid JSON only.\n\n${prompt}`,
        temperature: 0.2, // Very low temperature for consistent results
        max_tokens: 200, // Minimal tokens to save costs
        stop: ['\n\n'] // Stop at double newline to prevent extra text
      })
    });

    if (!response.ok) {
      throw new Error(`OpenAI cheapest API error: ${response.status}`);
    }

    const data = await response.json();
    const extractedText = data.choices?.[0]?.text;
    
    if (!extractedText) {
      throw new Error('No response from OpenAI cheapest model');
    }

    return this.parseAIResponse(extractedText);
  }

  /**
   * Try OpenAI's gpt-4o-mini model
   */
  private async tryOpenAIMini(content: string): Promise<DreamExtractionResult | null> {
    const prompt = this.buildExtractionPrompt(content);
    
    const response = await fetch('https://api.openai.com/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${this.openaiApiKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        model: 'gpt-4o-mini', // Cheapest chat model
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
        temperature: 0.3, // Lower temperature for more consistent results
        max_tokens: 300 // Reduced tokens to save costs
      })
    });

    if (!response.ok) {
      throw new Error(`OpenAI API error: ${response.status}`);
    }

    const data = await response.json();
    const extractedText = data.choices?.[0]?.message?.content;
    
    if (!extractedText) {
      throw new Error('No response from OpenAI');
    }

    return this.parseAIResponse(extractedText);
  }

  /**
   * Build the extraction prompt for AI
   */
  private buildExtractionPrompt(content: string): string {
    return `Analyze this dream content and extract emotions, symbols, themes, and dream type. Respond with valid JSON only.

Dream content: "${content}"

Extract:
1. Emotions (with confidence scores 0-1)
2. Symbols (with categories and confidence scores)
3. Themes (main topics/subjects)
4. Dream intensity (1-10 scale)
5. Dream type (night_dream, daydream, lucid_dream, nightmare)

Respond with this exact JSON format:
{
  "emotions": [
    {"emotion": "joy", "confidence": 0.9, "context": "feeling free while flying"}
  ],
  "symbols": [
    {"symbol": "flying", "category": "movement", "confidence": 0.95, "context": "soaring through sky"}
  ],
  "themes": ["freedom", "nature", "transcendence"],
  "intensity": 8,
  "dreamType": "night_dream"
}`;
  }

  /**
   * Parse AI response into structured data
   */
  private parseAIResponse(response: string): DreamExtractionResult {
    try {
      // Clean the response (remove any non-JSON text)
      const jsonMatch = response.match(/\{[\s\S]*\}/);
      if (!jsonMatch) {
        throw new Error('No JSON found in response');
      }

      const parsed = JSON.parse(jsonMatch[0]);
      
      return {
        emotions: parsed.emotions || [],
        symbols: parsed.symbols || [],
        themes: parsed.themes || [],
        intensity: parsed.intensity || 5,
        dreamType: parsed.dreamType || 'night_dream'
      };

    } catch (error) {
      console.error('❌ Failed to parse AI response:', error);
      throw error;
    }
  }

  /**
   * Fallback extraction using basic keyword matching
   */
  private getFallbackExtraction(content: string): DreamExtractionResult {
    const contentLower = content.toLowerCase();
    
    // Basic emotion detection
    const emotions: ExtractedEmotion[] = [];
    const emotionKeywords = {
      'joy': ['happy', 'joy', 'excited', 'elated', 'cheerful'],
      'fear': ['afraid', 'scared', 'fear', 'terrified', 'panic'],
      'peace': ['peaceful', 'calm', 'serene', 'tranquil'],
      'anxiety': ['anxious', 'worried', 'nervous', 'stressed'],
      'freedom': ['free', 'freedom', 'liberated', 'unrestricted']
    };

    for (const [emotion, keywords] of Object.entries(emotionKeywords)) {
      for (const keyword of keywords) {
        if (contentLower.includes(keyword)) {
          emotions.push({
            emotion,
            confidence: 0.7,
            context: `detected from keyword: ${keyword}`
          });
          break;
        }
      }
    }

    // Basic symbol detection
    const symbols: ExtractedSymbol[] = [];
    const symbolKeywords = {
      'flying': ['flying', 'soaring', 'air', 'sky'],
      'water': ['water', 'ocean', 'sea', 'river', 'lake'],
      'animals': ['animal', 'dog', 'cat', 'bird', 'fish'],
      'people': ['person', 'people', 'friend', 'family'],
      'nature': ['tree', 'forest', 'mountain', 'field']
    };

    for (const [symbol, keywords] of Object.entries(symbolKeywords)) {
      for (const keyword of keywords) {
        if (contentLower.includes(keyword)) {
          symbols.push({
            symbol,
            category: 'general',
            confidence: 0.7,
            context: `detected from keyword: ${keyword}`
          });
          break;
        }
      }
    }

    return {
      emotions,
      symbols,
      themes: ['general'],
      intensity: 5,
      dreamType: 'night_dream'
    };
  }
}
