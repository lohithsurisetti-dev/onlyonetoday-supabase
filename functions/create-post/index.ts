import { serve } from 'https://deno.land/std@0.168.0/http/server.ts';
import { createClient } from 'npm:@supabase/supabase-js@2';
import { PostServiceV2 } from '../shared/services/PostServiceV2.ts';
import { cacheDel, CacheKeys } from '../shared/utils/redis.ts';

interface CreatePostRequest {
  content: string;
  inputType: 'action' | 'day';
  isAnonymous?: boolean;
  scope: 'city' | 'state' | 'country' | 'world';
  locationCity?: string;
  locationState?: string;
  locationCountry?: string;
  userId?: string | null; // Now supports authenticated users
  dayOfWeek?: 'monday' | 'tuesday' | 'wednesday' | 'thursday' | 'friday' | 'saturday' | 'sunday';
}

serve(async (req) => {
  try {
    // CORS handling
    if (req.method === 'OPTIONS') {
      return new Response(null, {
        headers: {
          'Access-Control-Allow-Origin': '*',
          'Access-Control-Allow-Methods': 'POST, OPTIONS',
          'Access-Control-Allow-Headers': 'Content-Type, Authorization',
        },
      });
    }

    // Initialize Supabase client with service role key for admin operations
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    // Parse request body
    const body: CreatePostRequest = await req.json();
    const { 
      content, 
      inputType, 
      isAnonymous, 
      scope, 
      locationCity, 
      locationState, 
      locationCountry,
      userId,
      dayOfWeek
    } = body;

    // Validate required fields
    if (!content || !inputType || !scope) {
      return new Response(
        JSON.stringify({ 
          success: false, 
          error: 'Missing required fields: content, inputType, scope' 
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

    // Initialize V2 post service
    const postService = new PostServiceV2(supabase);

    // Create post with V2 approach (keyword-based, narrative stories, multilingual)
    const result = await postService.createPost({
      content: content.trim(),
      inputType,
      isAnonymous: isAnonymous || false,
      scope,
      locationCity,
      locationState,
      locationCountry,
      userId: userId || null,
      dayOfWeek: dayOfWeek
    });

    if (!result.success) {
      return new Response(
        JSON.stringify({ 
          success: false, 
          error: result.error 
        }),
        { 
          status: 200, 
          headers: { 
            'Content-Type': 'application/json',
            'Access-Control-Allow-Origin': '*'
          } 
        }
      );
    }

    console.log('✅ Post created successfully with V2 approach!');

    // Invalidate relevant caches after successful post creation
    if (result.success && result.post) {
      console.log('🗑️ Invalidating caches after post creation...');
      
      // Invalidate post-specific cache
      await cacheDel(CacheKeys.post(result.post.id));
      
      // Invalidate total posts count cache for this scope
      const countCacheKey = CacheKeys.totalPostsCount(scope, locationCity, locationState, locationCountry);
      console.log(`🗑️ Invalidating total posts count cache: ${countCacheKey}`);
      await cacheDel(countCacheKey);
      
      // Invalidate feed caches (pattern-based deletion not available in REST API)
      // Cache TTLs will handle expiration
      console.log('✅ Cache invalidation complete');
    }

    return new Response(
      JSON.stringify(result),
      { 
        status: 200, 
        headers: { 
          'Content-Type': 'application/json',
          'Access-Control-Allow-Origin': '*'
        } 
      }
    );

  } catch (error) {
    console.error('❌ Post creation failed:', error);
    return new Response(
      JSON.stringify({ 
        success: false, 
        error: error.message || 'Internal server error'
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