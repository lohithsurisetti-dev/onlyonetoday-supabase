/**
 * Input Validation Utilities
 * Ensure data integrity and security
 */

import type { CreatePostRequest, CreateDayPostRequest } from '../types/api.types.ts';
import type { PostType, ScopeType, DayOfWeek } from '../types/database.types.ts';

export class ValidationError extends Error {
  constructor(
    message: string,
    public field?: string,
    public code?: string
  ) {
    super(message);
    this.name = 'ValidationError';
  }
}

export class Validator {
  /**
   * Validate post creation request
   */
  static validateCreatePost(request: any): CreatePostRequest {
    // Content validation
    if (!request.content || typeof request.content !== 'string') {
      throw new ValidationError('Content is required', 'content', 'REQUIRED');
    }

    const content = request.content.trim();

    if (content.length < 3) {
      throw new ValidationError('Content must be at least 3 characters', 'content', 'TOO_SHORT');
    }

    if (content.length > 500) {
      throw new ValidationError('Content must be at most 500 characters', 'content', 'TOO_LONG');
    }

    // Input type validation
    const validInputTypes: PostType[] = ['action', 'day'];
    if (!validInputTypes.includes(request.inputType)) {
      throw new ValidationError('Invalid input type', 'inputType', 'INVALID_ENUM');
    }

    // Scope validation
    const validScopes: ScopeType[] = ['city', 'state', 'country', 'world'];
    if (!validScopes.includes(request.scope)) {
      throw new ValidationError('Invalid scope', 'scope', 'INVALID_ENUM');
    }

    // Location validation based on scope
    if (request.scope === 'city' && !request.location?.city) {
      throw new ValidationError('City is required for city scope', 'location.city', 'REQUIRED');
    }

    if (request.scope === 'state' && !request.location?.state) {
      throw new ValidationError('State is required for state scope', 'location.state', 'REQUIRED');
    }

    if (request.scope === 'country' && !request.location?.country) {
      throw new ValidationError('Country is required for country scope', 'location.country', 'REQUIRED');
    }

    return {
      content,
      inputType: request.inputType,
      scope: request.scope,
      location: request.location,
      isAnonymous: request.isAnonymous ?? false,
    };
  }

  /**
   * Validate day post creation
   */
  static validateCreateDayPost(request: any): CreateDayPostRequest {
    // Content validation
    if (!request.content || typeof request.content !== 'string') {
      throw new ValidationError('Content is required', 'content', 'REQUIRED');
    }

    const content = request.content.trim();

    if (content.length < 3) {
      throw new ValidationError('Content must be at least 3 characters', 'content', 'TOO_SHORT');
    }

    if (content.length > 1000) {
      throw new ValidationError('Content must be at most 1000 characters', 'content', 'TOO_LONG');
    }

    // Day validation
    const validDays: DayOfWeek[] = [
      'monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday', 'sunday'
    ];
    if (!validDays.includes(request.dayOfWeek)) {
      throw new ValidationError('Invalid day of week', 'dayOfWeek', 'INVALID_ENUM');
    }

    // Ensure posting for current day only
    const currentDay = this.getCurrentDayOfWeek();
    if (request.dayOfWeek !== currentDay) {
      throw new ValidationError(
        `Can only post to today's theme (${currentDay})`,
        'dayOfWeek',
        'WRONG_DAY'
      );
    }

    return {
      content,
      dayOfWeek: request.dayOfWeek,
    };
  }

  /**
   * Validate username
   */
  static validateUsername(username: string): string {
    const trimmed = username.trim().toLowerCase();

    if (trimmed.length < 3) {
      throw new ValidationError('Username must be at least 3 characters', 'username', 'TOO_SHORT');
    }

    if (trimmed.length > 30) {
      throw new ValidationError('Username must be at most 30 characters', 'username', 'TOO_LONG');
    }

    if (!/^[a-z0-9_]+$/.test(trimmed)) {
      throw new ValidationError(
        'Username can only contain letters, numbers, and underscores',
        'username',
        'INVALID_FORMAT'
      );
    }

    // Reserved usernames
    const reserved = ['admin', 'support', 'help', 'onlyone', 'system', 'official'];
    if (reserved.includes(trimmed)) {
      throw new ValidationError('Username is reserved', 'username', 'RESERVED');
    }

    return trimmed;
  }

  /**
   * Sanitize content (remove dangerous characters)
   */
  static sanitizeContent(content: string): string {
    return content
      .trim()
      .replace(/[\u0000-\u001F\u007F-\u009F]/g, '') // Remove control characters
      .replace(/\s+/g, ' '); // Normalize whitespace
  }

  /**
   * Check for profanity (basic filter)
   */
  static containsProfanity(content: string): boolean {
    const profanityList = [
      // Add your profanity list here
      // For production, use a library like 'bad-words'
    ];

    const lowerContent = content.toLowerCase();
    return profanityList.some(word => lowerContent.includes(word));
  }

  /**
   * Rate limiting check
   */
  static async checkRateLimit(
    supabase: any,
    userId: string,
    action: string,
    limit: number,
    windowMinutes: number
  ): Promise<boolean> {
    const windowStart = new Date(Date.now() - windowMinutes * 60 * 1000);

    const { count } = await supabase
      .from('events')
      .select('id', { count: 'exact', head: true })
      .eq('user_id', userId)
      .eq('event_type', action)
      .gte('created_at', windowStart.toISOString());

    if ((count || 0) >= limit) {
      throw new ValidationError(
        `Rate limit exceeded. Max ${limit} ${action} per ${windowMinutes} minutes`,
        action,
        'RATE_LIMIT'
      );
    }

    return true;
  }

  /**
   * Get current day of week
   */
  private static getCurrentDayOfWeek(): DayOfWeek {
    const days: DayOfWeek[] = [
      'sunday', 'monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday'
    ];
    return days[new Date().getDay()];
  }
}

