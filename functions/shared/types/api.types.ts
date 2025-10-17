/**
 * API Request/Response Types
 * Used by Edge Functions and Mobile App
 */

import type { PostType, ScopeType, TierType, ReactionType, DayOfWeek } from './database.types.ts';

// ============================================================================
// POST APIs
// ============================================================================

export interface CreatePostRequest {
  content: string;
  inputType: PostType;
  scope: ScopeType;
  location?: {
    city?: string;
    state?: string;
    country?: string;
    coords?: { latitude: number; longitude: number };
  };
  isAnonymous?: boolean;
}

export interface CreatePostResponse {
  success: boolean;
  post: {
    id: string;
    content: string;
    tier: TierType;
    percentile: number;
    displayText: string;
    matchCount: number;
    createdAt: string;
  };
  analytics: {
    processingTime: number;
    embeddingTime: number;
    searchTime: number;
  };
}

export interface GetFeedRequest {
  scope?: ScopeType;
  tierFilter?: TierType[];
  reactionFilter?: ReactionType;
  inputTypeFilter?: PostType;
  limit?: number;
  offset?: number;
  location?: {
    city?: string;
    state?: string;
    country?: string;
  };
}

export interface GetFeedResponse {
  posts: FeedPost[];
  total: number;
  hasMore: boolean;
}

export interface FeedPost {
  id: string;
  content: string;
  tier?: TierType;
  percentile?: number;
  displayText?: string;
  username?: string;
  scope: ScopeType;
  location?: string;
  reactions: {
    funny: number;
    creative: number;
    mustTry: number;
  };
  timeAgo: string;
  createdAt: string;
}

// ============================================================================
// USER APIs
// ============================================================================

export interface UpdateProfileRequest {
  username?: string;
  firstName?: string;
  lastName?: string;
  bio?: string;
  emailNotifications?: boolean;
  pushNotifications?: boolean;
}

export interface UserStatsResponse {
  totalPosts: number;
  elitePosts: number;
  currentStreak: number;
  longestStreak: number;
  totalReactions: number;
  eliteRate: number;
}

// ============================================================================
// REACTION APIs
// ============================================================================

export interface AddReactionRequest {
  postId: string;
  reactionType: ReactionType;
}

// ============================================================================
// NOTIFICATION APIs
// ============================================================================

export interface SendNotificationRequest {
  userId: string;
  title: string;
  message: string;
  type: string;
  data?: Record<string, any>;
}

export interface SendPushNotificationRequest extends SendNotificationRequest {
  badge?: number;
  sound?: string;
}

// ============================================================================
// THEMED DAYS APIs
// ============================================================================

export interface CreateDayPostRequest {
  dayOfWeek: DayOfWeek;
  content: string;
}

export interface CreateDayPostResponse {
  success: boolean;
  post: {
    id: string;
    content: string;
    dayOfWeek: DayOfWeek;
    createdAt: string;
  };
}

// ============================================================================
// ANALYTICS APIs (Future-ready)
// ============================================================================

export interface GetAnalyticsRequest {
  startDate: string;
  endDate: string;
  granularity?: 'day' | 'week' | 'month';
  metrics?: string[];
}

export interface GetAnalyticsResponse {
  data: AnalyticsDataPoint[];
  summary: AnalyticsSummary;
}

export interface AnalyticsDataPoint {
  date: string;
  totalPosts: number;
  elitePosts: number;
  activeUsers: number;
  [key: string]: any; // Flexible for future metrics
}

export interface AnalyticsSummary {
  totalPosts: number;
  avgPostsPerDay: number;
  growthRate: number;
  topTier: TierType;
  topLocation: string;
}

// ============================================================================
// VECTOR SEARCH
// ============================================================================

export interface VectorMatch {
  id: string;
  content: string;
  user_id?: string;
  scope: string;
  location_city?: string;
  location_state?: string;
  location_country?: string;
  similarity: number;
  tier?: string;
  created_at: string;
}

// ============================================================================
// ERROR RESPONSES
// ============================================================================

export interface ApiError {
  error: string;
  code: string;
  details?: any;
  timestamp: string;
}

export interface ApiSuccess<T = any> {
  success: true;
  data: T;
  timestamp: string;
}

export type ApiResponse<T = any> = ApiSuccess<T> | ApiError;

// ============================================================================
// LOGGING & MONITORING (Built-in from day 1)
// ============================================================================

export interface LogEntry {
  level: 'info' | 'warn' | 'error';
  message: string;
  context?: {
    userId?: string;
    postId?: string;
    function?: string;
    duration?: number;
    [key: string]: any;
  };
  timestamp: string;
}

export interface PerformanceMetric {
  operation: string;
  duration: number;
  success: boolean;
  metadata?: Record<string, any>;
}

