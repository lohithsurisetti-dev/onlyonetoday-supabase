/// <reference types="https://esm.sh/@supabase/functions-js/src/edge-runtime.d.ts" />
declare const Deno: any;

import { serve } from 'https://deno.land/std@0.168.0/http/server.ts';
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';
import { DreamInterpretationService } from '../shared/services/DreamInterpretationService.ts';

interface InterpretDreamRequest {
  content: string;
  dreamType?: 'night_dream' | 'daydream' | 'lucid_dream' | 'nightmare';
  emotions?: string[];
  symbols?: string[];
  clarity?: number;
}

serve(async (req) => {
  try {
    // Handle CORS
    if (req.method === 'OPTIONS') {
      return new Response(null, {
        status: 200,
        headers: {
          'Access-Control-Allow-Origin': '*',
          'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
          'Access-Control-Allow-Methods': 'POST, OPTIONS',
        },
      });
    }

    if (req.method !== 'POST') {
      return new Response(
        JSON.stringify({ success: false, error: 'Method not allowed' }),
        { 
          status: 405,
          headers: { 'Content-Type': 'application/json' }
        }
      );
    }

    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    const body: InterpretDreamRequest = await req.json();
    const { 
      content, 
      dreamType = 'night_dream',
      emotions = [],
      symbols = [],
      clarity = 5
    } = body;

    // Validate required fields
    if (!content || content.trim().length === 0) {
      return new Response(
        JSON.stringify({ 
          success: false, 
          error: 'Dream content is required' 
        }),
        { 
          status: 400,
          headers: { 'Content-Type': 'application/json' }
        }
      );
    }

    // Validate clarity range
    if (clarity < 1 || clarity > 10) {
      return new Response(
        JSON.stringify({ 
          success: false, 
          error: 'Clarity must be between 1 and 10' 
        }),
        { 
          status: 400,
          headers: { 'Content-Type': 'application/json' }
        }
      );
    }

    console.log(`🔮 Interpreting dream: "${content.substring(0, 50)}..."`);

    // Create dream interpretation service
    const interpretationService = new DreamInterpretationService();
    
    // Interpret the dream
    const interpretation = await interpretationService.interpretDream(
      content.trim(),
      dreamType,
      emotions,
      symbols,
      clarity
    );

    console.log(`✅ Dream interpreted successfully: ${interpretation.title}`);

    // Return interpretation
    return new Response(
      JSON.stringify({
        success: true,
        interpretation: {
          title: interpretation.title,
          meaning: interpretation.meaning,
          emotionalGuidance: interpretation.emotionalGuidance,
          comfortMessage: interpretation.comfortMessage,
          actionAdvice: interpretation.actionAdvice,
          hopeMessage: interpretation.hopeMessage,
          isPositive: interpretation.isPositive,
          confidence: interpretation.confidence
        }
      }),
      { 
        status: 200,
        headers: { 
          'Content-Type': 'application/json',
          'Access-Control-Allow-Origin': '*'
        }
      }
    );

  } catch (error) {
    console.error('❌ Dream interpretation error:', error);
    
    return new Response(
      JSON.stringify({ 
        success: false, 
        error: 'Failed to interpret dream',
        details: error.message 
      }),
      { 
        status: 500,
        headers: { 'Content-Type': 'application/json' }
      }
    );
  }
});
