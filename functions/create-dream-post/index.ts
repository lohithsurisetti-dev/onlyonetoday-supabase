/// <reference types="https://esm.sh/@supabase/functions-js/src/edge-runtime.d.ts" />
declare const Deno: any;

import { serve } from 'https://deno.land/std@0.168.0/http/server.ts';
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';
import { DreamPostService } from '../shared/services/DreamPostService.ts';
import { DreamCommunityService } from '../shared/services/DreamCommunityService.ts';
import { CreateDreamRequest } from '../shared/types/DreamTypes.ts';

interface CreateDreamPostRequest {
  content: string;
  dreamType: 'night_dream' | 'daydream' | 'lucid_dream' | 'nightmare';
  emotions?: string[];
  symbols?: string[];
  clarity: number;
  interpretation?: string;
  isAnonymous?: boolean;
  scope: 'city' | 'state' | 'country' | 'world';
  locationCity?: string;
  locationState?: string;
  locationCountry?: string;
  supportMessage?: string; // Optional support message for the community
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

    const body: CreateDreamPostRequest = await req.json();
    const { 
      content, 
      dreamType, 
      emotions = [], 
      symbols = [], 
      clarity, 
      interpretation,
      isAnonymous = false,
      scope,
      locationCity,
      locationState,
      locationCountry,
      supportMessage
    } = body;

    // Validate required fields
    if (!content || !dreamType || !scope || clarity === undefined) {
      return new Response(
        JSON.stringify({ 
          success: false, 
          error: 'Missing required fields: content, dreamType, scope, clarity' 
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

    // Create dream post service
    const dreamPostService = new DreamPostService();
    const dreamCommunityService = new DreamCommunityService();
    
    // Create the dream post
    const result = await dreamPostService.createDreamPost({
      content: content.trim(),
      dreamType,
      emotions: emotions as any[],
      symbols: symbols as any[],
      clarity,
      interpretation,
      isAnonymous,
      scope,
      locationCity,
      locationState,
      locationCountry,
      supportMessage
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

    // Create support message if provided
    if (supportMessage && result.post?.id) {
      console.log('💝 Creating support message for dream:', result.post.id);
      
      // Get user ID from the request headers
      const authHeader = req.headers.get('Authorization');
      if (authHeader) {
        try {
          const token = authHeader.replace('Bearer ', '');
          const { data: { user } } = await supabase.auth.getUser(token);
          
          if (user) {
            const supportResult = await dreamCommunityService.createSupportMessage(
              result.post.id,
              user.id,
              supportMessage
            );
            
            if (supportResult.success) {
              console.log('✅ Support message created successfully');
            } else {
              console.log('⚠️ Failed to create support message:', supportResult.error);
            }
          }
        } catch (error) {
          console.log('⚠️ Error creating support message:', error);
        }
      }
    }

    // Get community data for the dream
    if (result.post) {
      try {
        const communityData = await dreamCommunityService.getCommunityData(
          dreamType,
          symbols as any[],
          emotions as any[]
        );
        
        // Add community data to the result
        if (result.post) {
          result.post.communityData = communityData;
        }
      } catch (error) {
        console.log('⚠️ Error getting community data:', error);
      }
    }

    // Return success response
    return new Response(
      JSON.stringify({
        success: true,
        post: result.post,
        analytics: result.analytics
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
    console.error('❌ Create dream post error:', error);
    
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
