/**
 * Redis Client Utility for Supabase Edge Functions
 * 
 * Provides caching layer for:
 * - Moderation results (5 min TTL)
 * - Similar posts (10 min TTL)
 * - Feed results (2 min TTL)
 * - Rate limiting (1 min TTL)
 * 
 * Using Upstash Redis REST API (compatible with Deno)
 */

// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
// REDIS CLIENT
// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

interface RedisClient {
  get(key: string): Promise<string | null>;
  set(key: string, value: string, ttl?: number): Promise<boolean>;
  del(key: string): Promise<boolean>;
  exists(key: string): Promise<boolean>;
}

class UpstashRedisClient implements RedisClient {
  private url: string;
  private token: string;

  constructor() {
    // Try completely generic environment variable names
    this.url = Deno.env.get('DB_URL') || 
               Deno.env.get('API_URL') || 
               Deno.env.get('CACHE_URL') || 
               Deno.env.get('KV_URL') || 
               Deno.env.get('REDIS_URL') || 
               Deno.env.get('UPSTASH_REDIS_REST_URL') || 
               Deno.env.get('KV_REST_API_URL') || '';
    this.token = Deno.env.get('DB_TOKEN') || 
                 Deno.env.get('API_TOKEN') || 
                 Deno.env.get('CACHE_TOKEN') || 
                 Deno.env.get('KV_TOKEN') || 
                 Deno.env.get('REDIS_TOKEN') || 
                 Deno.env.get('UPSTASH_REDIS_REST_TOKEN') || 
                 Deno.env.get('KV_REST_API_TOKEN') || '';
    
    // TEMPORARY: Hardcode Redis credentials for testing
    if (!this.url || !this.token) {
      console.log('⚠️ Environment variables not found, using hardcoded credentials for testing');
      this.url = 'https://comic-glowworm-16004.upstash.io';
      this.token = 'AT6EAAIncDIwZTY3MmZjMWVjYzI0NDVlOGI5OGVkYjQzNmU5MmIxYXAyMTYwMDQ';
    }
    
    // Redis configuration loaded successfully
    if (this.url && this.token) {
      console.log('✅ Redis configured successfully');
    } else {
      console.log('⚠️ Redis not configured, skipping cache');
    }
  }

  private async request(command: string, args: any[] = []): Promise<any> {
    if (!this.url || !this.token) {
      console.log('⚠️ Redis not configured, skipping cache');
      // Return appropriate default values for different commands
      if (command === 'GET') return null;
      if (command === 'SET' || command === 'SETEX') return 'OK';
      if (command === 'DEL') return 0;
      if (command === 'EXISTS') return 0;
      return null;
    }

    try {
      // Upstash Redis REST API format - use the correct endpoint
      const response = await fetch(this.url, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${this.token}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify([command, ...args]),
      });

      if (!response.ok) {
        const errorText = await response.text();
        console.error('❌ Redis request failed:', response.status, response.statusText, errorText);
        return null;
      }

      const result = await response.json();
      return result.result;
    } catch (error) {
      console.error('❌ Redis error:', error);
      return null;
    }
  }

  async get(key: string): Promise<string | null> {
    return await this.request('GET', [key]);
  }

  async set(key: string, value: string, ttl?: number): Promise<boolean> {
    if (ttl) {
      const result = await this.request('SETEX', [key, ttl, value]);
      return result === 'OK';
    } else {
      const result = await this.request('SET', [key, value]);
      return result === 'OK';
    }
  }

  async del(key: string): Promise<boolean> {
    const result = await this.request('DEL', [key]);
    return result === 1;
  }

  async exists(key: string): Promise<boolean> {
    const result = await this.request('EXISTS', [key]);
    return result === 1;
  }
}

// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
// CACHE KEY CONSTANTS
// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

export const CacheKeys = {
  // Moderation
  moderation: (contentHash: string) => `moderation:${contentHash}`,
  
  // Similar posts
  similarPosts: (contentHash: string) => `similar:${contentHash}`,
  
  // Feed results
  feed: (scope: string, filter: string, page: number) => 
    `feed:${scope}:${filter}:${page}`,
  
  // Rate limiting
  rateLimit: (ip: string, action: string) => 
    `ratelimit:${ip}:${action}`,
  
  // User posts
  userPosts: (userId: string) => 
    `user:${userId}:posts`,
  
  // Platform stats
  stats: (scope: string, period: string) => 
    `stats:${scope}:${period}`,
  
  // Temporal analytics
  temporalAnalytics: (contentHash: string, scope: string) => 
    `temporal:${contentHash}:${scope}`,
  
  // Total posts count
  totalPostsCount: (scope: string, city?: string, state?: string, country?: string) => 
    `count:${scope}:${city || 'any'}:${state || 'any'}:${country || 'any'}`,
} as const;

// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
// CACHE TTL CONSTANTS (seconds)
// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

export const CacheTTL = {
  MODERATION: 300,        // 5 minutes
  SIMILAR_POSTS: 600,     // 10 minutes
  FEED_RESULTS: 120,      // 2 minutes
  RATE_LIMIT: 60,         // 1 minute
  USER_POSTS: 300,        // 5 minutes
  STATS: 180,             // 3 minutes
  TEMPORAL_ANALYTICS: 300, // 5 minutes
} as const;

// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
// REDIS INSTANCE
// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

export const redis = new UpstashRedisClient();

// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
// UTILITY FUNCTIONS
// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

export async function cacheGet<T>(key: string): Promise<T | null> {
  try {
    const cached = await redis.get(key);
    if (cached) {
      console.log(`✅ Cache hit: ${key}`);
      return JSON.parse(cached);
    }
    console.log(`❌ Cache miss: ${key}`);
    return null;
  } catch (error) {
    console.error('❌ Cache get error:', error);
    return null;
  }
}

export async function cacheSet<T>(key: string, value: T, ttl?: number): Promise<boolean> {
  try {
    const serialized = JSON.stringify(value);
    const success = await redis.set(key, serialized, ttl);
    if (success) {
      console.log(`✅ Cache set: ${key} (TTL: ${ttl || 'none'})`);
    }
    return success;
  } catch (error) {
    console.error('❌ Cache set error:', error);
    return false;
  }
}

export async function cacheDel(key: string): Promise<boolean> {
  try {
    const success = await redis.del(key);
    if (success) {
      console.log(`✅ Cache deleted: ${key}`);
    }
    return success;
  } catch (error) {
    console.error('❌ Cache delete error:', error);
    return false;
  }
}

export async function cacheExists(key: string): Promise<boolean> {
  try {
    return await redis.exists(key);
  } catch (error) {
    console.error('❌ Cache exists error:', error);
    return false;
  }
}

// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
// CONTENT HASHING
// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

export function hashContent(content: string): string {
  // Simple hash function for content (not cryptographically secure)
  let hash = 0;
  for (let i = 0; i < content.length; i++) {
    const char = content.charCodeAt(i);
    hash = ((hash << 5) - hash) + char;
    hash = hash & hash; // Convert to 32-bit integer
  }
  return Math.abs(hash).toString(36);
}
