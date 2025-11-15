import { serve } from 'https://deno.land/std@0.168.0/http/server.ts';
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';
import { cacheGet, cacheSet, CacheKeys, CacheTTL } from '../shared/utils/redis.ts';

interface StatsResponse {
  success: boolean;
  stats?: {
    totalPostsToday: number;
    dreamsToday: number;
    totalPosts: number;
  };
  error?: string;
}

serve(async (req) => {
  try {
    console.log('📊 Stats request received');

    // Initialize Supabase client
    const supabaseUrl = Deno.env.get('SUPABASE_URL') ?? '';
    const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? '';
    const supabaseClient = createClient(supabaseUrl, supabaseServiceKey);

    // Check cache first
    const cacheKey = CacheKeys.stats('world', 'today');
    let cached = null;
    try {
      cached = await cacheGet<StatsResponse['stats']>(cacheKey);
      if (cached) {
        console.log('✅ Using cached stats');
        return new Response(JSON.stringify({
          success: true,
          stats: cached
        }), {
          headers: { 'Content-Type': 'application/json' }
        });
      }
    } catch (cacheError) {
      console.warn('⚠️ Cache read error:', cacheError);
    }

    // Calculate today's date range
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const tomorrow = new Date(today);
    tomorrow.setDate(tomorrow.getDate() + 1);

    // Get total posts today
    const { data: todayPosts, error: todayError } = await supabaseClient
      .from('posts')
      .select('id, match_count')
      .eq('moderation_status', 'approved')
      .gte('created_at', today.toISOString())
      .lt('created_at', tomorrow.toISOString());

    if (todayError) {
      console.error('❌ Error fetching today posts:', todayError);
      return new Response(JSON.stringify({
        success: false,
        error: 'Failed to fetch today posts'
      }), {
        status: 500,
        headers: { 'Content-Type': 'application/json' }
      });
    }

    // Get total posts count
    const { count: totalPosts, error: totalError } = await supabaseClient
      .from('posts')
      .select('*', { count: 'exact', head: true })
      .eq('moderation_status', 'approved');

    if (totalError) {
      console.error('❌ Error fetching total posts:', totalError);
      return new Response(JSON.stringify({
        success: false,
        error: 'Failed to fetch total posts'
      }), {
        status: 500,
        headers: { 'Content-Type': 'application/json' }
      });
    }

    // Get dreams today (dreams are auto-approved, no moderation_status column)
    const { count: dreamsToday, error: dreamsError } = await supabaseClient
      .from('dream_posts')
      .select('*', { count: 'exact', head: true })
      .gte('created_at', today.toISOString())
      .lt('created_at', tomorrow.toISOString());

    if (dreamsError) {
      console.error('❌ Error fetching dreams today:', dreamsError);
      // Don't fail, just use 0
    }

    const stats = {
      totalPostsToday: todayPosts?.length || 0,
      dreamsToday: dreamsToday || 0,
      totalPosts: totalPosts || 0
    };

    // Cache the results
    try {
      await cacheSet(cacheKey, stats, CacheTTL.STATS);
      console.log('✅ Stats cached');
    } catch (cacheError) {
      console.warn('⚠️ Cache write error:', cacheError);
    }

    console.log('📊 Stats calculated:', stats);

    return new Response(JSON.stringify({
      success: true,
      stats
    }), {
      headers: { 'Content-Type': 'application/json' }
    });

  } catch (error) {
    console.error('❌ Stats function error:', error);
    return new Response(JSON.stringify({
      success: false,
      error: 'Internal server error'
    }), {
      status: 500,
      headers: { 'Content-Type': 'application/json' }
    });
  }
});
