/**
 * Dream Community Service
 * Manages support messages and community stats for dream matching
 */

declare const Deno: any;

import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';
import { 
  DreamSupportMessage, 
  DreamCommunityStats, 
  DreamCommunityData,
  DreamType,
  DreamEmotion,
  DreamSymbol
} from '../types/DreamTypes.ts';

export class DreamCommunityService {
  private supabase: any;

  constructor() {
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    this.supabase = createClient(supabaseUrl, supabaseServiceKey);
  }

  /**
   * Create a support message for a dream
   */
  async createSupportMessage(
    dreamId: string,
    userId: string,
    message: string
  ): Promise<{ success: boolean; messageId?: string; error?: string }> {
    try {
      console.log('💝 Creating support message for dream:', dreamId);

      // Validate message
      if (!message || message.length < 10 || message.length > 500) {
        return {
          success: false,
          error: 'Support message must be between 10 and 500 characters'
        };
      }

      // Insert support message
      const { data, error } = await this.supabase
        .from('dream_support_messages')
        .insert({
          dream_id: dreamId,
          user_id: userId,
          message: message.trim(),
          is_approved: false // Requires approval
        })
        .select('id')
        .single();

      if (error) {
        console.error('❌ Error creating support message:', error);
        return {
          success: false,
          error: 'Failed to create support message'
        };
      }

      console.log('✅ Support message created successfully:', data.id);
      return {
        success: true,
        messageId: data.id
      };

    } catch (error) {
      console.error('❌ DreamCommunityService.createSupportMessage error:', error);
      return {
        success: false,
        error: 'Internal server error'
      };
    }
  }

  /**
   * Get community stats for a dream type
   */
  async getCommunityStats(
    dreamType: DreamType,
    symbols: string[],
    emotions: string[]
  ): Promise<DreamCommunityStats> {
    try {
      console.log('📊 Getting community stats for:', { dreamType, symbols, emotions });

      const { data, error } = await this.supabase
        .rpc('get_dream_community_stats', {
          p_dream_type: dreamType,
          p_symbols: symbols,
          p_emotions: emotions
        });

      if (error) {
        console.error('❌ Error getting community stats:', error);
        // Return default stats if error
        return {
          memberCount: 0,
          supportMessagesCount: 0,
          weeklyDreamsCount: 0,
          weeklySupportMessages: 0
        };
      }

      if (data && data.length > 0) {
        const stats = data[0];
        return {
          memberCount: stats.member_count || 0,
          supportMessagesCount: stats.support_messages_count || 0,
          weeklyDreamsCount: stats.weekly_dreams_count || 0,
          weeklySupportMessages: stats.weekly_support_messages || 0
        };
      }

      // Return default stats if no data found
      return {
        memberCount: 0,
        supportMessagesCount: 0,
        weeklyDreamsCount: 0,
        weeklySupportMessages: 0
      };

    } catch (error) {
      console.error('❌ DreamCommunityService.getCommunityStats error:', error);
      return {
        memberCount: 0,
        supportMessagesCount: 0,
        weeklyDreamsCount: 0,
        weeklySupportMessages: 0
      };
    }
  }

  /**
   * Get support messages for similar dreams
   */
  async getSupportMessages(
    dreamType: DreamType,
    symbols: string[],
    emotions: string[],
    limit: number = 5
  ): Promise<DreamSupportMessage[]> {
    try {
      console.log('💝 Getting support messages for:', { dreamType, symbols, emotions });

      const { data, error } = await this.supabase
        .rpc('get_dream_support_messages', {
          p_dream_type: dreamType,
          p_symbols: symbols,
          p_emotions: emotions,
          p_limit: limit
        });

      if (error) {
        console.error('❌ Error getting support messages:', error);
        return [];
      }

      if (data && data.length > 0) {
        return data.map((msg: any) => ({
          id: msg.id,
          dreamId: '', // Not returned by the function
          userId: '', // Anonymous
          message: msg.message,
          isApproved: true, // Only approved messages are returned
          createdAt: msg.created_at,
          updatedAt: msg.created_at
        }));
      }

      return [];

    } catch (error) {
      console.error('❌ DreamCommunityService.getSupportMessages error:', error);
      return [];
    }
  }

  /**
   * Get complete community data for a dream
   */
  async getCommunityData(
    dreamType: DreamType,
    symbols: string[],
    emotions: string[]
  ): Promise<DreamCommunityData> {
    try {
      console.log('🌟 Getting complete community data for:', { dreamType, symbols, emotions });

      // Get stats and support messages in parallel
      const [stats, supportMessages] = await Promise.all([
        this.getCommunityStats(dreamType, symbols, emotions),
        this.getSupportMessages(dreamType, symbols, emotions, 5)
      ]);

      // Count similar dreams (approximate from member count)
      const similarDreamsCount = Math.max(0, stats.memberCount - 1);

      return {
        stats,
        supportMessages,
        similarDreamsCount
      };

    } catch (error) {
      console.error('❌ DreamCommunityService.getCommunityData error:', error);
      return {
        stats: {
          memberCount: 0,
          supportMessagesCount: 0,
          weeklyDreamsCount: 0,
          weeklySupportMessages: 0
        },
        supportMessages: [],
        similarDreamsCount: 0
      };
    }
  }

  /**
   * Approve a support message (admin function)
   */
  async approveSupportMessage(messageId: string): Promise<{ success: boolean; error?: string }> {
    try {
      console.log('✅ Approving support message:', messageId);

      const { error } = await this.supabase
        .from('dream_support_messages')
        .update({ is_approved: true, updated_at: new Date().toISOString() })
        .eq('id', messageId);

      if (error) {
        console.error('❌ Error approving support message:', error);
        return {
          success: false,
          error: 'Failed to approve support message'
        };
      }

      console.log('✅ Support message approved successfully');
      return { success: true };

    } catch (error) {
      console.error('❌ DreamCommunityService.approveSupportMessage error:', error);
      return {
        success: false,
        error: 'Internal server error'
      };
    }
  }

  /**
   * Get pending support messages for approval (admin function)
   */
  async getPendingSupportMessages(): Promise<DreamSupportMessage[]> {
    try {
      console.log('⏳ Getting pending support messages');

      const { data, error } = await this.supabase
        .from('dream_support_messages')
        .select('*')
        .eq('is_approved', false)
        .order('created_at', { ascending: false });

      if (error) {
        console.error('❌ Error getting pending support messages:', error);
        return [];
      }

      if (data && data.length > 0) {
        return data.map((msg: any) => ({
          id: msg.id,
          dreamId: msg.dream_id,
          userId: msg.user_id,
          message: msg.message,
          isApproved: msg.is_approved,
          createdAt: msg.created_at,
          updatedAt: msg.updated_at
        }));
      }

      return [];

    } catch (error) {
      console.error('❌ DreamCommunityService.getPendingSupportMessages error:', error);
      return [];
    }
  }

  /**
   * Get user's support messages
   */
  async getUserSupportMessages(userId: string): Promise<DreamSupportMessage[]> {
    try {
      console.log('👤 Getting user support messages for:', userId);

      const { data, error } = await this.supabase
        .from('dream_support_messages')
        .select('*')
        .eq('user_id', userId)
        .order('created_at', { ascending: false });

      if (error) {
        console.error('❌ Error getting user support messages:', error);
        return [];
      }

      if (data && data.length > 0) {
        return data.map((msg: any) => ({
          id: msg.id,
          dreamId: msg.dream_id,
          userId: msg.user_id,
          message: msg.message,
          isApproved: msg.is_approved,
          createdAt: msg.created_at,
          updatedAt: msg.updated_at
        }));
      }

      return [];

    } catch (error) {
      console.error('❌ DreamCommunityService.getUserSupportMessages error:', error);
      return [];
    }
  }

  /**
   * Delete a support message (user can only delete their own unapproved messages)
   */
  async deleteSupportMessage(messageId: string, userId: string): Promise<{ success: boolean; error?: string }> {
    try {
      console.log('🗑️ Deleting support message:', messageId);

      const { error } = await this.supabase
        .from('dream_support_messages')
        .delete()
        .eq('id', messageId)
        .eq('user_id', userId)
        .eq('is_approved', false); // Can only delete unapproved messages

      if (error) {
        console.error('❌ Error deleting support message:', error);
        return {
          success: false,
          error: 'Failed to delete support message'
        };
      }

      console.log('✅ Support message deleted successfully');
      return { success: true };

    } catch (error) {
      console.error('❌ DreamCommunityService.deleteSupportMessage error:', error);
      return {
        success: false,
        error: 'Internal server error'
      };
    }
  }
}
