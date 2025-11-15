import { serve } from 'https://deno.land/std@0.168.0/http/server.ts';
import { createClient } from 'npm:@supabase/supabase-js@2';

serve(async (req) => {
  try {
    // Handle CORS
    if (req.method === 'OPTIONS') {
      return new Response(null, {
        status: 200,
        headers: {
          'Access-Control-Allow-Origin': '*',
          'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
          'Access-Control-Allow-Headers': 'Content-Type, Authorization',
        },
      });
    }

    // Initialize Supabase client with service role key for admin operations
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    // Parse request
    let username: string;
    
    if (req.method === 'GET') {
      const url = new URL(req.url);
      username = url.searchParams.get('username') || '';
    } else {
      const body = await req.json();
      username = body.username || '';
    }

    // Validate username
    if (!username || username.trim().length < 3) {
      return new Response(
        JSON.stringify({ 
          available: false, 
          error: 'Username must be at least 3 characters' 
        }),
        { 
          status: 400,
          headers: { 
            'Content-Type': 'application/json',
            'Access-Control-Allow-Origin': '*'
          } 
        }
      );
    }

    // Normalize username (lowercase, alphanumeric + underscore only)
    const normalizedUsername = username.toLowerCase().trim();

    // Validate format
    if (!/^[a-z0-9_]+$/.test(normalizedUsername)) {
      return new Response(
        JSON.stringify({ 
          available: false, 
          error: 'Username can only contain letters, numbers, and underscores' 
        }),
        { 
          status: 400,
          headers: { 
            'Content-Type': 'application/json',
            'Access-Control-Allow-Origin': '*'
          } 
        }
      );
    }

    if (normalizedUsername.length > 30) {
      return new Response(
        JSON.stringify({ 
          available: false, 
          error: 'Username must be 30 characters or less' 
        }),
        { 
          status: 400,
          headers: { 
            'Content-Type': 'application/json',
            'Access-Control-Allow-Origin': '*'
          } 
        }
      );
    }

    // Check if username exists
    const { data, error } = await supabase
      .from('profiles')
      .select('username')
      .eq('username', normalizedUsername)
      .limit(1)
      .maybeSingle();

    if (error) {
      console.error('❌ Username check error:', error);
      return new Response(
        JSON.stringify({ 
          available: false, 
          error: 'Failed to check username availability',
          details: error.message 
        }),
        { 
          status: 500,
          headers: { 
            'Content-Type': 'application/json',
            'Access-Control-Allow-Origin': '*'
          } 
        }
      );
    }

    // If data exists, username is taken
    const isAvailable = !data;

    return new Response(
      JSON.stringify({ 
        available: isAvailable,
        username: normalizedUsername
      }),
      { 
        status: 200,
        headers: { 
          'Content-Type': 'application/json',
          'Access-Control-Allow-Origin': '*'
        } 
      }
    );

  } catch (error: any) {
    console.error('❌ Username check exception:', error);
    return new Response(
      JSON.stringify({ 
        available: false, 
        error: 'Internal server error',
        details: error.message 
      }),
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

