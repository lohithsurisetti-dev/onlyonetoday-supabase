/**
 * Dream-specific types and interfaces
 * Supports night dreams, daydreams, lucid dreams, and nightmares
 */

export type DreamType = 'night_dream' | 'daydream' | 'lucid_dream' | 'nightmare';

export type DreamEmotion = 
  | 'joy' | 'fear' | 'confusion' | 'wonder' | 'peace' | 'anxiety' 
  | 'excitement' | 'sadness' | 'anger' | 'love' | 'nostalgia' | 'curiosity'
  | 'freedom' | 'trapped' | 'powerful' | 'vulnerable' | 'mysterious' | 'familiar';

export type DreamSymbol = 
  | 'flying' | 'falling' | 'water' | 'fire' | 'animals' | 'people' 
  | 'buildings' | 'vehicles' | 'nature' | 'darkness' | 'light' | 'colors'
  | 'food' | 'clothing' | 'money' | 'technology' | 'music' | 'art'
  | 'childhood' | 'work' | 'school' | 'home' | 'travel' | 'death'
  | 'birth' | 'transformation' | 'chase' | 'escape' | 'search' | 'discovery';

export interface DreamPost {
  id?: string;
  content: string;
  dreamType: DreamType;
  emotions: DreamEmotion[];
  symbols: DreamSymbol[];
  clarity: number; // 1-10 scale
  interpretation?: string;
  isAnonymous?: boolean;
  scope: 'city' | 'state' | 'country' | 'world';
  locationCity?: string;
  locationState?: string;
  locationCountry?: string;
  userId?: string;
  created_at?: string;
}

export interface DreamEmbedding {
  contentEmbedding: number[];
  symbolEmbedding: number[];
  emotionEmbedding: number[];
  combinedEmbedding: number[];
}

export interface DreamMatch {
  postId: string;
  similarity: number;
  matchType: 'content' | 'symbol' | 'emotion' | 'combined';
  sharedSymbols: DreamSymbol[];
  sharedEmotions: DreamEmotion[];
}

export interface DreamAnalytics {
  totalDreams: number;
  dreamTypeDistribution: Record<DreamType, number>;
  commonSymbols: Array<{ symbol: DreamSymbol; count: number }>;
  commonEmotions: Array<{ emotion: DreamEmotion; count: number }>;
  averageClarity: number;
  temporalPatterns: {
    today: number;
    thisWeek: number;
    thisMonth: number;
  };
}

export interface CreateDreamRequest {
  content: string;
  dreamType: DreamType;
  emotions: DreamEmotion[];
  symbols: DreamSymbol[];
  clarity: number;
  interpretation?: string;
  isAnonymous?: boolean;
  scope: 'city' | 'state' | 'country' | 'world';
  locationCity?: string;
  locationState?: string;
  locationCountry?: string;
  supportMessage?: string; // Optional support message for the community
}

// Dream Support Message interfaces
export interface DreamSupportMessage {
  id: string;
  dreamId: string;
  userId: string;
  message: string;
  isApproved: boolean;
  createdAt: string;
  updatedAt: string;
}

export interface DreamCommunityStats {
  memberCount: number;
  supportMessagesCount: number;
  weeklyDreamsCount: number;
  weeklySupportMessages: number;
}

export interface DreamCommunityData {
  stats: DreamCommunityStats;
  supportMessages: DreamSupportMessage[];
  similarDreamsCount: number;
}

export interface DreamPostResult {
  success: boolean;
  post?: DreamPost & {
    tier: string;
    percentile: number;
    matchCount: number;
    displayText: string;
    badge: string;
    message: string;
    comparison: string;
    dreamMatches: DreamMatch[];
    communityData?: DreamCommunityData;
  };
  error?: string;
  analytics?: DreamAnalytics;
}
