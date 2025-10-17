/**
 * Database Types - Auto-generated from Supabase schema
 * Shared between Edge Functions and Mobile App
 */

// ============================================================================
// ENUMS
// ============================================================================

export type PostType = 'action' | 'day';
export type ScopeType = 'city' | 'state' | 'country' | 'world';
export type TierType = 'elite' | 'rare' | 'unique' | 'notable' | 'popular' | 'common';
export type ReactionType = 'funny' | 'creative' | 'must_try';
export type DayOfWeek = 'monday' | 'tuesday' | 'wednesday' | 'thursday' | 'friday' | 'saturday' | 'sunday';
export type NotificationType = 'achievement' | 'social' | 'system' | 'update';

// ============================================================================
// DATABASE TABLES
// ============================================================================

export interface Profile {
  id: string;
  username: string;
  first_name: string;
  last_name: string;
  date_of_birth?: string;
  bio?: string;
  avatar_url?: string;
  push_token?: string;
  email_notifications: boolean;
  push_notifications: boolean;
  is_private: boolean;
  last_active_at: string;
  signup_source?: string;
  referral_code?: string;
  referred_by?: string;
  created_at: string;
  updated_at: string;
}

export interface Post {
  id: string;
  content: string;
  input_type: PostType;
  user_id?: string;
  is_anonymous: boolean;
  scope: ScopeType;
  location_city?: string;
  location_state?: string;
  location_country?: string;
  location_coords?: { x: number; y: number };
  content_hash: string;
  embedding?: number[];
  match_count: number;
  percentile?: number;
  tier?: TierType;
  view_count: number;
  share_count: number;
  created_at: string;
  updated_at: string;
}

export interface Reaction {
  id: string;
  post_id: string;
  user_id: string;
  reaction_type: ReactionType;
  created_at: string;
}

export interface PostReactionCounts {
  post_id: string;
  funny_count: number;
  creative_count: number;
  must_try_count: number;
  total_count: number;
  updated_at: string;
}

export interface UserStreak {
  user_id: string;
  current_streak: number;
  longest_streak: number;
  last_post_date?: string;
  total_posts: number;
  elite_posts: number;
  rare_posts: number;
  updated_at: string;
}

export interface DayPost {
  id: string;
  user_id: string;
  day_of_week: DayOfWeek;
  content: string;
  reactions: {
    first: number;
    second: number;
    third: number;
  };
  created_at: string;
}

export interface Notification {
  id: string;
  user_id: string;
  type: NotificationType;
  title: string;
  message: string;
  post_id?: string;
  related_user_id?: string;
  data?: Record<string, any>;
  is_read: boolean;
  read_at?: string;
  created_at: string;
}

export interface TrendingItem {
  id: string;
  source: string;
  category?: string;
  rank: number;
  title: string;
  description?: string;
  count?: number;
  url?: string;
  metadata?: Record<string, any>;
  fetched_at: string;
  expires_at: string;
  created_at: string;
}

export interface DailyStats {
  id: string;
  date: string;
  total_posts: number;
  action_posts: number;
  day_posts: number;
  elite_posts: number;
  rare_posts: number;
  unique_posts: number;
  notable_posts: number;
  popular_posts: number;
  common_posts: number;
  world_posts: number;
  country_posts: number;
  state_posts: number;
  city_posts: number;
  new_users: number;
  active_users: number;
  posting_users: number;
  total_reactions: number;
  avg_reactions_per_post: number;
  users_with_streaks: number;
  avg_streak_length: number;
  created_at: string;
}

export interface UserAnalytics {
  user_id: string;
  total_posts: number;
  total_actions: number;
  total_summaries: number;
  elite_count: number;
  rare_count: number;
  unique_count: number;
  best_percentile?: number;
  best_tier?: TierType;
  most_active_hour?: number;
  most_active_day_of_week?: number;
  avg_post_length?: number;
  reactions_given: number;
  reactions_received: number;
  shares_received: number;
  current_streak: number;
  longest_streak: number;
  updated_at: string;
}

export interface Event {
  id: string;
  user_id?: string;
  event_type: string;
  event_data?: Record<string, any>;
  platform?: string;
  app_version?: string;
  session_id?: string;
  created_at: string;
}

// ============================================================================
// LEADERBOARD TYPES
// ============================================================================

export interface LeaderboardEntry {
  location: string;
  post_count: number;
  elite_count: number;
  unique_users: number;
  avg_percentile?: number;
}

// ============================================================================
// API REQUEST/RESPONSE TYPES
// ============================================================================

export interface PercentileData {
  percentile: number;
  tier: TierType;
  displayText: string;
  comparison?: string;
}

export interface VectorMatch {
  id: string;
  content: string;
  similarity: number;
  tier?: TierType;
  created_at: string;
}

// ============================================================================
// UTILITY TYPES
// ============================================================================

export type Json =
  | string
  | number
  | boolean
  | null
  | { [key: string]: Json | undefined }
  | Json[];

export interface Database {
  public: {
    Tables: {
      profiles: {
        Row: Profile;
        Insert: Omit<Profile, 'id' | 'created_at' | 'updated_at'>;
        Update: Partial<Omit<Profile, 'id'>>;
      };
      posts: {
        Row: Post;
        Insert: Omit<Post, 'id' | 'created_at' | 'updated_at' | 'view_count' | 'share_count'>;
        Update: Partial<Omit<Post, 'id'>>;
      };
      reactions: {
        Row: Reaction;
        Insert: Omit<Reaction, 'id' | 'created_at'>;
        Update: never;
      };
      notifications: {
        Row: Notification;
        Insert: Omit<Notification, 'id' | 'created_at'>;
        Update: Partial<Pick<Notification, 'is_read' | 'read_at'>>;
      };
      day_posts: {
        Row: DayPost;
        Insert: Omit<DayPost, 'id' | 'created_at'>;
        Update: Partial<Omit<DayPost, 'id' | 'user_id'>>;
      };
    };
  };
}

