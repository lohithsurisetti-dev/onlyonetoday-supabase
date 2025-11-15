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
          'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
          'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
        },
      });
    }

    if (req.method !== 'GET' && req.method !== 'POST') {
      return new Response(
        JSON.stringify({ success: false, error: 'Method not allowed' }),
        { status: 405, headers: { 'Content-Type': 'application/json' } }
      );
    }

    console.log('📊 Get day stats request received');

    // Initialize Supabase client (use service role for public stats)
    const supabaseUrl = Deno.env.get('SUPABASE_URL') ?? '';
    const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? '';
    const supabaseClient = createClient(supabaseUrl, supabaseServiceKey);

    // Calculate today's date range
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const tomorrow = new Date(today);
    tomorrow.setDate(tomorrow.getDate() + 1);

    const validDays = ['monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday', 'sunday'];
    
    // Get counts for all days (today only) - query posts table
    const dayCounts: Record<string, number> = {};
    
    for (const day of validDays) {
      const { data, error } = await supabaseClient
        .from('posts')
        .select('id', { count: 'exact', head: false })
        .eq('input_type', 'day')
        .eq('day_of_week', day)
        .is('activities', null) // Only themed day posts (exclude day summaries)
        .eq('moderation_status', 'approved')
        .gte('created_at', today.toISOString())
        .lt('created_at', tomorrow.toISOString());
      
      if (error) {
        console.error(`Error counting ${day}:`, error);
        dayCounts[day] = 0;
      } else {
        dayCounts[day] = data?.length || 0;
      }
    }

    // Get total posts today across all days (only themed day posts, not day summaries)
    const { data: totalData, error: totalError } = await supabaseClient
      .from('posts')
      .select('id', { count: 'exact', head: false })
      .eq('input_type', 'day')
      .is('activities', null) // Only themed day posts (exclude day summaries)
      .eq('moderation_status', 'approved')
      .gte('created_at', today.toISOString())
      .lt('created_at', tomorrow.toISOString());
    
    const totalToday = totalError ? 0 : (totalData?.length || 0);

    console.log('✅ Day stats fetched successfully');

    return new Response(
      JSON.stringify({
        success: true,
        stats: {
          dayCounts,
          totalToday: totalToday || 0,
          date: today.toISOString()
        }
      }),
      { headers: { 'Content-Type': 'application/json' } }
    );

  } catch (error) {
    console.error('❌ Error:', error);
    return new Response(
      JSON.stringify({ success: false, error: error.message || 'Internal server error' }),
      { status: 500, headers: { 'Content-Type': 'application/json' } }
    );
  }
});

