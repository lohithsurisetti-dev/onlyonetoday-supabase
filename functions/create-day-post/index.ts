import { serve } from 'https://deno.land/std@0.168.0/http/server.ts';
import { createClient } from 'npm:@supabase/supabase-js@2';
import { PostServiceV2 } from '../shared/services/PostServiceV2.ts';
import { LanguageDetector } from '../shared/services/LanguageDetector.ts';

interface CreateDayPostRequest {
  content: string;
  dayOfWeek: 'monday' | 'tuesday' | 'wednesday' | 'thursday' | 'friday' | 'saturday' | 'sunday';
  scope?: 'city' | 'state' | 'country' | 'world';
  locationCity?: string;
  locationState?: string;
  locationCountry?: string;
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
        { status: 405, headers: { 'Content-Type': 'application/json' } }
      );
    }

    console.log('🎭 Create day post request received');

    // Initialize Supabase client
    const supabaseUrl = Deno.env.get('SUPABASE_URL') ?? '';
    const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? '';
    const supabaseClient = createClient(supabaseUrl, supabaseServiceKey);

    // Get user from auth header
    const authHeader = req.headers.get('Authorization');
    console.log('🔑 Auth header present:', !!authHeader);
    
    if (!authHeader) {
      console.error('❌ Missing authorization header');
      return new Response(
        JSON.stringify({ success: false, error: 'Missing authorization header' }),
        { status: 401, headers: { 'Content-Type': 'application/json' } }
      );
    }

    const token = authHeader.replace('Bearer ', '');
    console.log('🔑 Token length:', token.length);
    
    const { data: { user }, error: userError } = await supabaseClient.auth.getUser(token);

    if (userError || !user) {
      console.error('❌ Auth error:', userError?.message || 'No user');
      return new Response(
        JSON.stringify({ success: false, error: userError?.message || 'Unauthorized' }),
        { status: 401, headers: { 'Content-Type': 'application/json' } }
      );
    }

    console.log('✅ User authenticated:', user.id);

    // Parse request body
    let body: CreateDayPostRequest;
    try {
      body = await req.json();
      console.log('📋 Request body:', { 
        content: body.content?.substring(0, 50), 
        dayOfWeek: body.dayOfWeek,
        scope: body.scope 
      });
    } catch (parseError) {
      console.error('❌ Error parsing request body:', parseError);
      return new Response(
        JSON.stringify({ success: false, error: 'Invalid request body' }),
        { status: 400, headers: { 'Content-Type': 'application/json' } }
      );
    }

    const { content, dayOfWeek, scope = 'world', locationCity, locationState, locationCountry } = body;

    // Initialize PostServiceV2 for validation and moderation
    const postService = new PostServiceV2(supabaseClient);
    const languageDetector = new LanguageDetector();

    // Validate using PostServiceV2
    console.log('🔍 Validating post...');
    const validation = await postService.validatePost({
      content,
      inputType: 'day',
      scope,
      locationCity,
      locationState,
      locationCountry,
      dayOfWeek,
      userId: user.id
    });

    if (!validation.valid) {
      console.error('❌ Validation failed:', validation.error);
      return new Response(
        JSON.stringify({ success: false, error: validation.error }),
        { status: 400, headers: { 'Content-Type': 'application/json' } }
      );
    }
    console.log('✅ Validation passed');

    // Process language
    const languageProcessed = await languageDetector.processLanguage(content);

    // Moderate content using PostServiceV2
    console.log('🛡️ Moderating content...');
    const moderation = await postService.moderateContent(
      content,
      languageProcessed.normalized,
      languageProcessed.language,
      'day'
    );

    if (!moderation.approved) {
      console.error('❌ Moderation failed:', moderation.userMessage);
      return new Response(
        JSON.stringify({ 
          success: false, 
          error: moderation.userMessage || 'Content rejected by moderation' 
        }),
        { status: 400, headers: { 'Content-Type': 'application/json' } }
      );
    }
    console.log('✅ Moderation passed');

    // Hash content for duplicate detection
    const hashContent = (text: string): string => {
      return text
        .toLowerCase()
        .replace(/[^a-z0-9\s]/g, '')
        .replace(/\s+/g, ':')
        .substring(0, 100);
    };

    const contentHash = hashContent(content);

    // Store in posts table (unified, no matching/story for themed days)
    const postData: any = {
      content: content.trim(),
      normalized_content: languageProcessed.normalized,
      detected_language: languageProcessed.language.type,
      language_confidence: languageProcessed.language.confidence,
      content_hash: contentHash,
      input_type: 'day',
      scope: scope,
      location_city: locationCity || null,
      location_state: locationState || null,
      location_country: locationCountry || null,
      user_id: user.id,
      is_anonymous: false,
      moderation_status: moderation.approved ? 'approved' : 'rejected',
      moderation_score: moderation.confidence,
      moderation_flags: moderation.flags,
      day_of_week: dayOfWeek,
      reactions: { first: 0, second: 0, third: 0 },
      activities: null, // Themed day posts don't have activities (distinguishes from day summaries)
      // Skip V2 exclusivity fields (match_count, narrative, emotional_tone, etc.)
      match_count: null,
      narrative: null,
      emotional_tone: null,
      celebration: null,
      badge: null,
      keywords: null, // No keyword matching for themed days
      created_at: new Date().toISOString()
    };

    const { data: dayPost, error: insertError } = await supabaseClient
      .from('posts')
      .insert(postData)
      .select('*')
      .single();

    if (insertError) {
      console.error('❌ Error creating day post:', insertError);
      return new Response(
        JSON.stringify({ success: false, error: 'Failed to create day post' }),
        { status: 500, headers: { 'Content-Type': 'application/json' } }
      );
    }

    // Get user profile
    const { data: profile } = await supabaseClient
      .from('profiles')
      .select('username, avatar_url')
      .eq('id', user.id)
      .single();

    console.log('✅ Day post created successfully');

    return new Response(
      JSON.stringify({
        success: true,
        post: {
          id: dayPost.id,
          content: dayPost.content,
          day: dayOfWeek,
          username: profile?.username || 'anonymous',
          avatar_url: profile?.avatar_url,
          timeAgo: 'Just now',
          reactionCounts: dayPost.reactions || { first: 0, second: 0, third: 0 },
          scope: dayPost.scope,
          location: dayPost.location_city 
            ? `${dayPost.location_city}${dayPost.location_state ? `, ${dayPost.location_state}` : ''}${dayPost.location_country ? `, ${dayPost.location_country}` : ''}`
            : null,
          timestamp: new Date(dayPost.created_at).getTime()
        }
      }),
      { headers: { 'Content-Type': 'application/json' } }
    );

  } catch (error) {
    console.error('❌ Error:', error);
    console.error('❌ Error stack:', error instanceof Error ? error.stack : 'No stack trace');
    return new Response(
      JSON.stringify({ 
        success: false, 
        error: error instanceof Error ? error.message : 'Internal server error',
        details: error instanceof Error ? error.stack : undefined
      }),
      { status: 500, headers: { 'Content-Type': 'application/json' } }
    );
  }
});

