/// <reference types="https://esm.sh/@supabase/functions-js/src/edge-runtime.d.ts" />
declare const Deno: any;

import { serve } from 'https://deno.land/std@0.168.0/http/server.ts';
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

interface DreamInsights {
  dreamCount: number;
  mostCommonSymbols: { symbol: string; count: number }[];
  mostCommonEmotions: { emotion: string; count: number }[];
  averageClarity: number;
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
        },
      });
    }

    if (req.method !== 'GET') {
      return new Response(
        JSON.stringify({ success: false, error: 'Method not allowed' }),
        { 
          status: 405,
          headers: { 
            'Content-Type': 'application/json',
            'Access-Control-Allow-Origin': '*'
          }
        }
      );
    }

    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    // Get user ID from Authorization header or use service role for testing
    const authHeader = req.headers.get('Authorization');
    let userId: string;
    
    if (authHeader) {
      const token = authHeader.replace('Bearer ', '');
      const { data: { user }, error: authError } = await supabase.auth.getUser(token);
      
      if (authError || !user) {
        return new Response(
          JSON.stringify({ success: false, error: 'Invalid token' }),
          { 
            status: 401,
            headers: { 
              'Content-Type': 'application/json',
              'Access-Control-Allow-Origin': '*'
            }
          }
        );
      }
      userId = user.id;
    } else {
      // For testing without auth, use a dummy user ID
      userId = '00000000-0000-0000-0000-000000000000';
    }

    // Get personal dream insights
    const { data: insights, error } = await supabase.rpc('get_personal_dream_insights', {
      p_user_id: userId
    });

    if (error) {
      console.error('❌ Dream insights error:', error);
      return new Response(
        JSON.stringify({ success: false, error: 'Failed to get dream insights' }),
        { 
          status: 500,
          headers: { 
            'Content-Type': 'application/json',
            'Access-Control-Allow-Origin': '*'
          }
        }
      );
    }

    const result: DreamInsights = insights || {
      dreamCount: 0,
      mostCommonSymbols: [],
      mostCommonEmotions: [],
      averageClarity: 0
    };

    return new Response(
      JSON.stringify({
        success: true,
        insights: result
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
    console.error('❌ Dream insights failed:', error);
    return new Response(
      JSON.stringify({ success: false, error: error.message }),
      { 
        status: 500,
        headers: { 
          'Content-Type': 'application/json',
          'Access-Control-Allow-Origin': '*'
        }
      }
    );
  }
});
