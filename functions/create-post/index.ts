import { serve } from 'https://deno.land/std@0.168.0/http/server.ts';
import { createClient } from 'npm:@supabase/supabase-js@2';
import { PostService } from '../shared/services/PostService.ts';
import { cacheDel, CacheKeys } from '../shared/utils/redis.ts';

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
          status: 200, 
          headers: { 'Content-Type': 'application/json' } 
        }
      );
    }

    console.log('✅ Post created successfully with all advanced features!');

    // Invalidate relevant caches after successful post creation
    if (result.success) {
      console.log('🗑️ Invalidating caches after post creation...');
      
      // Invalidate similar posts cache for this content
      if (result.post?.content) {
        const contentHash = result.post.content.toLowerCase().replace(/[^a-z0-9\s]/g, '').replace(/\s+/g, ':');
        const similarCacheKey = `similar:${contentHash}`;
        console.log(`🗑️ Invalidating similar posts cache: ${similarCacheKey}`);
        await cacheDel(similarCacheKey);
        
        // Invalidate temporal analytics cache
        const temporalCacheKey = CacheKeys.temporalAnalytics(contentHash, scope);
        console.log(`🗑️ Invalidating temporal analytics cache: ${temporalCacheKey}`);
        await cacheDel(temporalCacheKey);
        
        // Invalidate total posts count cache for this scope
        const countCacheKey = CacheKeys.totalPostsCount(scope, locationCity, locationState, locationCountry);
        console.log(`🗑️ Invalidating total posts count cache: ${countCacheKey}`);
        await cacheDel(countCacheKey);
      }
      
      // Invalidate feed caches for all scopes and filters
      const cachePatterns = [
        `feed:action:${scope}:*`,
        `feed:day:${scope}:*`,
        `feed:all:${scope}:*`,
        `feed:*:${scope}:*`
      ];
      
      // Note: Redis doesn't support pattern deletion in REST API
      // In production, you'd use Redis SCAN + DEL or set TTLs appropriately
      console.log('⚠️ Feed cache invalidation would happen here in production');
    }

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