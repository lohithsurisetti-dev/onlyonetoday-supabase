/**
 * Create Post Edge Function
 * 
 * Handles post creation with:
 * - Vector embedding generation
 * - Semantic similarity matching
 * - Uniqueness calculation
 * - Analytics tracking
 * - Performance optimization
 * 
 * Endpoint: POST /functions/v1/create-post
 * Auth: Required
 */

import { serve } from 'https://deno.land/std@0.168.0/http/server.ts';
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';
import type { CreatePostRequest, CreatePostResponse } from '../shared/types/api.types.ts';
import { PostService } from '../shared/services/PostService.ts';
import { NotificationService } from '../shared/services/NotificationService.ts';
import { Validator } from '../shared/utils/validation.ts';
import { ErrorHandler } from '../shared/utils/errors.ts';
import { Logger } from '../shared/utils/logger.ts';
import { withPerformanceTracking } from '../shared/utils/performance.ts';

// ============================================================================
// CORS Headers
// ============================================================================

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

// ============================================================================
// MAIN HANDLER
// ============================================================================

serve(
  withPerformanceTracking(async (req: Request): Promise<Response> => {
    // Handle CORS preflight
    if (req.method === 'OPTIONS') {
      return new Response('ok', { headers: corsHeaders });
    }

    try {
      // Debug: Check environment variables
      const hfKey = typeof Deno !== 'undefined' ? Deno.env.get('HUGGINGFACE_API_KEY') : undefined;
      const openaiKey = typeof Deno !== 'undefined' ? Deno.env.get('OPENAI_API_KEY') : undefined;
      Logger.info('Environment check', { 
        hasHfKey: !!hfKey, 
        hasOpenaiKey: !!openaiKey,
        hfKeyLength: hfKey?.length || 0,
        openaiKeyLength: openaiKey?.length || 0
      });

      // 1. Initialize Supabase client
      const supabaseUrl = typeof Deno !== 'undefined' ? Deno.env.get('SUPABASE_URL') ?? '' : '';
      const supabaseKey = typeof Deno !== 'undefined' ? Deno.env.get('SUPABASE_ANON_KEY') ?? '' : '';
      
      const supabaseClient = createClient(
        supabaseUrl,
        supabaseKey,
        {
          global: {
            headers: { Authorization: req.headers.get('Authorization')! },
          },
        }
      );

      // 2. Get authenticated user
      const {
        data: { user },
        error: authError,
      } = await supabaseClient.auth.getUser();

      if (authError || !user) {
        Logger.warn('Unauthorized request', { authError });
        return new Response(
          JSON.stringify({ error: 'Unauthorized' }),
          {
            status: 401,
            headers: { ...corsHeaders, 'Content-Type': 'application/json' },
          }
        );
      }

      Logger.request('POST', '/create-post', { userId: user.id });

      // 3. Parse and validate request body
      const body = await req.json();
      const validatedRequest = Validator.validateCreatePost(body);

      // 4. Rate limiting (max 10 posts per hour)
      await Validator.checkRateLimit(
        supabaseClient,
        user.id,
        'post_created',
        10,
        60
      );

      // 5. Content moderation (basic)
      const sanitizedContent = Validator.sanitizeContent(validatedRequest.content);
      if (Validator.containsProfanity(sanitizedContent)) {
        return new Response(
          JSON.stringify({
            error: 'Content contains inappropriate language',
            code: 'PROFANITY_DETECTED',
          }),
          {
            status: 400,
            headers: { ...corsHeaders, 'Content-Type': 'application/json' },
          }
        );
      }

      // 6. Create post using PostService
      const postService = new PostService(supabaseClient);
      const result = await postService.create(
        { ...validatedRequest, content: sanitizedContent },
        user.id
      );

      // 7. Send achievement notification if elite
      if (result.post.tier === 'elite') {
        const notificationService = new NotificationService(supabaseClient);
        await notificationService.sendAchievementNotification(
          user.id,
          result.post.tier,
          result.post.content
        );
      }

      // 8. Return success response
      Logger.response(200, result.analytics.processingTime, {
        userId: mockUser.id,
        postId: result.post.id,
        tier: result.post.tier,
      });

      return new Response(
        JSON.stringify(result),
        {
          status: 200,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        }
      );
    } catch (error) {
      // Error handling with proper logging
      return ErrorHandler.createErrorResponse(error, {
        endpoint: '/create-post',
      });
    }
  })
);

// ============================================================================
// NOTES
// ============================================================================

/*
 * Performance Targets:
 * - Embedding generation: <100ms
 * - Vector search: <30ms
 * - Total: <200ms (95th percentile)
 * 
 * Analytics Captured:
 * - Post creation events
 * - Processing time breakdown
 * - Tier distribution
 * - Match counts
 * 
 * Future Enhancements:
 * - AI content moderation (OpenAI Moderation API)
 * - Image analysis (if photos added)
 * - Spam detection
 * - A/B testing hooks
 */

