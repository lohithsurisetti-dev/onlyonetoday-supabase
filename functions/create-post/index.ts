import { serve } from 'https://deno.land/std@0.168.0/http/server.ts';
import { createClient } from 'npm:@supabase/supabase-js@2';
import { PostService } from '../shared/services/PostService.ts';

interface CreatePostRequest {
  content: string;
  inputType: 'action' | 'day';
  isAnonymous?: boolean;
  scope: 'city' | 'state' | 'country' | 'world';
  locationCity?: string;
  locationState?: string;
  locationCountry?: string;
}

serve(async (req) => {
  try {
    // Initialize Supabase client with service role key for admin operations
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    // Parse request body
    const body: CreatePostRequest = await req.json();
    const { content, inputType, isAnonymous, scope, locationCity, locationState, locationCountry } = body;

    // Validate required fields
    if (!content || !inputType || !scope) {
      return new Response(
        JSON.stringify({ 
          success: false, 
          error: 'Missing required fields: content, inputType, scope' 
        }),
        { 
          status: 400, 
          headers: { 'Content-Type': 'application/json' } 
        }
      );
    }

    // Input validation
    if (content.trim().length < 3) {
      return new Response(
        JSON.stringify({ 
          success: false, 
          error: 'Content must be at least 3 characters long' 
        }),
        { 
          status: 400, 
          headers: { 'Content-Type': 'application/json' } 
        }
      );
    }

    if (content.length > 2000) {
      return new Response(
        JSON.stringify({ 
          success: false, 
          error: 'Content too long (max 2000 characters)' 
        }),
        { 
          status: 400, 
          headers: { 'Content-Type': 'application/json' } 
        }
      );
    }

    // For now, use null for anonymous posts (replace with real auth later)
    const userId = null;

    // Initialize post service with all advanced features
    const postService = new PostService();

    // Create post with all advanced features
    const result = await postService.createPost({
      content: content.trim(),
      inputType,
      isAnonymous: isAnonymous || false,
      scope,
      locationCity,
      locationState,
      locationCountry,
      userId
    });

    if (!result.success) {
      return new Response(
        JSON.stringify({ 
          success: false, 
          error: result.error 
        }),
        { 
          status: 400, 
          headers: { 'Content-Type': 'application/json' } 
        }
      );
    }

    console.log('✅ Post created successfully with all advanced features!');

    return new Response(
      JSON.stringify(result),
      { 
        status: 200, 
        headers: { 'Content-Type': 'application/json' } 
      }
    );

  } catch (error) {
    console.error('❌ Post creation failed:', error);
    return new Response(
      JSON.stringify({ 
        success: false, 
        error: error.message 
      }),
      { 
        status: 500, 
        headers: { 'Content-Type': 'application/json' } 
      }
    );
  }
});