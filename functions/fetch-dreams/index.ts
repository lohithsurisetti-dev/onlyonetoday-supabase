import { serve } from 'https://deno.land/std@0.168.0/http/server.ts';
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';
import { DreamPostService } from '../shared/services/DreamPostService.ts';
import { DreamCommunityService } from '../shared/services/DreamCommunityService.ts';

serve(async (req) => {
  try {
    // Handle CORS
    if (req.method === 'OPTIONS') {
      return new Response(null, {
        status: 200,
        headers: {
          'Access-Control-Allow-Origin': '*',
          'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
          'Access-Control-Allow-Methods': 'GET, OPTIONS',
        },
      });
    }

    if (req.method !== 'GET') {
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

    // Parse query parameters
    const url = new URL(req.url);
    const dreamType = url.searchParams.get('dreamType');
    const scope = url.searchParams.get('scope');
    const limit = parseInt(url.searchParams.get('limit') || '10');
    const offset = parseInt(url.searchParams.get('offset') || '0');

    // Validate limit
    if (limit > 50) {
      return new Response(
        JSON.stringify({ 
          success: false, 
          error: 'Limit cannot exceed 50' 
        }),
        { 
          status: 400,
          headers: { 'Content-Type': 'application/json' }
        }
      );
    }

    // Create services
    const dreamPostService = new DreamPostService();
    const dreamCommunityService = new DreamCommunityService();
    
    // Fetch dream posts
    const result = await dreamPostService.fetchDreamPosts({
      dreamType: dreamType || undefined,
      scope: scope || undefined,
      limit,
      offset
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

    // Add community data to each dream post
    if (result.posts && result.posts.length > 0) {
      for (const post of result.posts) {
        try {
          const communityData = await dreamCommunityService.getCommunityData(
            post.dreamType,
            post.symbols,
            post.emotions
          );
          
          // Add community data to the post
          (post as any).communityData = communityData;
        } catch (error) {
          console.log('⚠️ Error getting community data for post:', post.id, error);
        }
      }
    }

    // Return success response
    return new Response(
      JSON.stringify({
        success: true,
        posts: result.posts,
        pagination: {
          limit,
          offset,
          total: result.posts?.length || 0,
          hasNext: (result.posts?.length || 0) === limit
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
    console.error('❌ Fetch dreams error:', error);
    
    return new Response(
      JSON.stringify({ 
        success: false, 
        error: 'Internal server error',
        details: error.message 
      }),
      { 
        status: 500,
        headers: { 'Content-Type': 'application/json' }
      }
    );
  }
});
