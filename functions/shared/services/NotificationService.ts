/**
 * Notification Service
 * Handles push notifications (Expo) and email notifications
 * 
 * Features:
 * - Push notifications via Expo
 * - Email notifications via Resend
 * - Smart batching and rate limiting
 * - Analytics tracking
 */

import type { SupabaseClient } from 'https://esm.sh/@supabase/supabase-js@2';
import type { SendNotificationRequest, SendPushNotificationRequest } from '../types/api.types.ts';
import { Logger } from '../utils/logger.ts';
import { PerformanceTracker } from '../utils/performance.ts';

// Expo Push SDK
interface ExpoPushMessage {
  to: string;
  title: string;
  body: string;
  data?: Record<string, any>;
  sound?: 'default' | null;
  badge?: number;
  priority?: 'default' | 'normal' | 'high';
}

export class NotificationService {
  constructor(private supabase: SupabaseClient) {}

  /**
   * Send push notification via Expo
   */
  async sendPush(request: SendPushNotificationRequest): Promise<void> {
    const tracker = new PerformanceTracker('send_push_notification', {
      userId: request.userId,
      type: request.type
    });

    try {
      // 1. Get user's push token
      const { data: profile } = await this.supabase
        .from('profiles')
        .select('push_token, push_notifications')
        .eq('id', request.userId)
        .single();

      if (!profile?.push_token || !profile.push_notifications) {
        Logger.debug('User has no push token or notifications disabled', {
          userId: request.userId
        });
        tracker.end({ skipped: true });
        return;
      }

      // 2. Validate Expo push token
      if (!this.isValidExpoPushToken(profile.push_token)) {
        Logger.warn('Invalid Expo push token', {
          userId: request.userId,
          token: profile.push_token.substring(0, 20)
        });
        tracker.end({ invalid: true });
        return;
      }

      // 3. Send push notification via Expo API
      const message: ExpoPushMessage = {
        to: profile.push_token,
        title: request.title,
        body: request.message,
        data: request.data,
        sound: (request.sound as 'default' | null) || 'default',
        badge: request.badge,
        priority: 'high',
      };

      const response = await fetch('https://exp.host/--/api/v2/push/send', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Accept': 'application/json',
        },
        body: JSON.stringify(message),
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(`Expo push failed: ${JSON.stringify(errorData)}`);
      }

      const result = await response.json();

      // 4. Save notification to database
      await this.saveNotification(request);

      tracker.end({ success: true, expoPushId: result.data?.id });

      Logger.info('Push notification sent successfully', {
        userId: request.userId,
        title: request.title,
      });
    } catch (error) {
      tracker.error(error);
      Logger.error('Push notification failed', {
        error: error instanceof Error ? error.message : 'Unknown error',
        userId: request.userId
      });
      // Don't throw - notifications are nice-to-have
    }
  }

  /**
   * Send email notification via Resend
   */
  async sendEmail(
    userId: string,
    subject: string,
    html: string
  ): Promise<void> {
    const tracker = new PerformanceTracker('send_email', { userId });

    try {
      // 1. Get user's email and preferences
      const { data: user } = await this.supabase.auth.admin.getUserById(userId);
      
      if (!user?.user?.email) {
        Logger.warn('User has no email', { userId });
        tracker.end({ skipped: true });
        return;
      }

      const { data: profile } = await this.supabase
        .from('profiles')
        .select('email_notifications')
        .eq('id', userId)
        .single();

      if (!profile?.email_notifications) {
        Logger.debug('User has email notifications disabled', { userId });
        tracker.end({ skipped: true });
        return;
      }

      // 2. Send email via Resend API
      const resendApiKey = typeof Deno !== 'undefined' ? Deno.env.get('RESEND_API_KEY') : undefined;
      
      if (!resendApiKey) {
        Logger.error('RESEND_API_KEY not configured');
        return;
      }

      const response = await fetch('https://api.resend.com/emails', {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${resendApiKey}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          from: 'OnlyOne <hello@onlyonetoday.com>',
          to: user.user.email,
          subject,
          html,
        }),
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(`Resend API failed: ${JSON.stringify(errorData)}`);
      }

      const result = await response.json();

      tracker.end({ success: true, emailId: result.id });

      Logger.info('Email sent successfully', {
        userId,
        subject,
        to: user.user.email
      });
    } catch (error) {
      tracker.error(error);
      Logger.error('Email sending failed', {
        error: error instanceof Error ? error.message : 'Unknown error',
        userId
      });
      // Don't throw - emails are nice-to-have
    }
  }

  /**
   * Save notification to database (for in-app notifications)
   */
  private async saveNotification(request: SendNotificationRequest): Promise<void> {
    await this.supabase
      .from('notifications')
      .insert({
        user_id: request.userId,
        type: request.type as any,
        title: request.title,
        message: request.message,
        data: request.data,
        is_read: false,
      });
  }

  /**
   * Validate Expo push token format
   */
  private isValidExpoPushToken(token: string): boolean {
    return (
      token.startsWith('ExponentPushToken[') ||
      token.startsWith('ExpoPushToken[') ||
      /^[a-z\d]{8}-[a-z\d]{4}-[a-z\d]{4}-[a-z\d]{4}-[a-z\d]{12}$/i.test(token)
    );
  }

  /**
   * Send achievement notification (convenience method)
   */
  async sendAchievementNotification(
    userId: string,
    tier: string,
    content: string
  ): Promise<void> {
    await this.sendPush({
      userId,
      type: 'achievement',
      title: 'Notable Action!',
      message: `Your post "${content.substring(0, 50)}..." hit ${tier} tier!`,
      data: { type: 'achievement', tier },
      badge: 1,
    });
  }

  /**
   * Send streak milestone notification
   */
  async sendStreakNotification(userId: string, streak: number): Promise<void> {
    await this.sendPush({
      userId,
      type: 'achievement',
      title: `${streak}-Day Streak!`,
      message: `Incredible! You've posted ${streak} days in a row. Keep going!`,
      data: { type: 'streak', days: streak },
      badge: 1,
    });
  }

  /**
   * Send welcome email (on signup)
   */
  async sendWelcomeEmail(userId: string, firstName: string): Promise<void> {
    const html = `
      <!DOCTYPE html>
      <html>
        <head>
          <style>
            body { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif; }
            .container { max-width: 600px; margin: 0 auto; padding: 40px 20px; }
            .header { text-align: center; margin-bottom: 40px; }
            .title { font-size: 32px; font-weight: 200; color: #ffffff; letter-spacing: 8px; }
            .content { background: linear-gradient(135deg, rgba(139, 92, 246, 0.1), rgba(236, 72, 153, 0.05)); padding: 30px; border-radius: 20px; }
            .message { font-size: 16px; line-height: 1.6; color: #e5e7eb; margin-bottom: 20px; }
            .cta { display: inline-block; background: linear-gradient(90deg, #8b5cf6, #ec4899); color: white; padding: 14px 32px; border-radius: 12px; text-decoration: none; font-weight: 600; }
          </style>
        </head>
        <body style="background: #0a0a1a; color: #ffffff;">
          <div class="container">
            <div class="header">
              <h1 class="title">ONLYONE</h1>
              <p style="color: #9ca3af;">TODAY</p>
            </div>
            <div class="content">
              <h2 style="color: #ffffff; margin-bottom: 20px;">Welcome, ${firstName}! 👋</h2>
              <p class="message">
                Your moments count. Every action you share adds to today's collective story.
              </p>
              <p class="message">
                Start sharing your daily moments and see where you fit in the world.
              </p>
              <p style="text-align: center; margin-top: 30px;">
                <a href="https://onlyonetoday.com" class="cta">Open the App</a>
              </p>
            </div>
            <p style="text-align: center; color: #6b7280; font-size: 12px; margin-top: 30px;">
              OnlyOne.Today - Track your journey
            </p>
          </div>
        </body>
      </html>
    `;

    await this.sendEmail(userId, 'Welcome to OnlyOne.Today! 🌟', html);
  }

  /**
   * Batch send notifications (for future features like weekly summaries)
   */
  async sendBatch(requests: SendPushNotificationRequest[]): Promise<void> {
    Logger.info('Sending batch notifications', { count: requests.length });

    // Send in parallel (max 100 at a time to avoid rate limits)
    const batchSize = 100;
    for (let i = 0; i < requests.length; i += batchSize) {
      const batch = requests.slice(i, i + batchSize);
      await Promise.all(batch.map(req => this.sendPush(req)));
      
      // Small delay between batches to respect rate limits
      if (i + batchSize < requests.length) {
        await new Promise(resolve => setTimeout(resolve, 1000));
      }
    }

    Logger.info('Batch notifications sent', { total: requests.length });
  }
}

