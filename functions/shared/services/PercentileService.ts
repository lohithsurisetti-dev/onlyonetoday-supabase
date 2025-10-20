/**
 * Percentile Calculation Service
 * 
 * Implements the OnlyFans-style percentile ranking system
 * Calculates how rare an action is compared to ALL users
 * Provides motivating "Top X%" messaging
 */

export interface PercentileResult {
  percentile: number; // e.g., 0.5 for "Top 0.5%"
  tier: 'elite' | 'rare' | 'unique' | 'notable' | 'beloved' | 'popular';
  displayText: string; // e.g., "Top 0.5%"
  badge: string; // e.g., "🏆"
  message: string; // e.g., "You're rarer than 99.5% of people!"
  comparison: string; // e.g., "Only 5 of 1,000 people did this"
}

export class PercentileService {
  
  /**
   * Calculate percentile rank based on how many people did this action
   * 
   * @param peopleWhoDidThis - Total people who did this action (including you)
   * @param totalPostsInScope - Total posts in the scope today
   * @returns PercentileResult with tier, messaging, etc.
   */
  calculatePercentile(
    peopleWhoDidThis: number,
    totalPostsInScope: number
  ): PercentileResult {
    // Calculate percentile (what % of population did this)
    const percentile = (peopleWhoDidThis / totalPostsInScope) * 100;
    
    // CRITICAL: If you're the only person who did this, it's always ELITE regardless of dataset size
    if (peopleWhoDidThis === 1) {
      // Generate varied main comparison messages for first-time posts
      const firstTimeMessages = [
        "You're the first to share this!",
        "You're a trailblazer!",
        "You're the pioneer!",
        "You're leading the way!",
        "You're the innovator!"
      ];
      const randomMessage = firstTimeMessages[Math.floor(Math.random() * firstTimeMessages.length)];

      return {
        percentile,
        tier: 'elite',
        displayText: 'Only you!',
        badge: '🏆',
        message: `${randomMessage} 🌟`,
        comparison: `${randomMessage} out of ${totalPostsInScope.toLocaleString()} people`
      };
    }
    
    // Determine tier and messaging based on percentile for multiple people
    // Rebalanced for social media psychology and daily activity patterns
    if (percentile < 0.5) {
      // ELITE: Top 0.5% (< 0.5%) - More accessible than 0.1%
      const formattedPercentile = percentile < 0.5 ? percentile.toFixed(1) : Math.round(percentile);
      return {
        percentile,
        tier: 'elite',
        displayText: `Top ${formattedPercentile}%`,
        badge: '🏆',
        message: `You're in the top ${formattedPercentile}%! Amazing choice!`,
        comparison: `${peopleWhoDidThis} of ${totalPostsInScope.toLocaleString()} people`
      };
    } else if (percentile < 2) {
      // ELITE: Top 2% (0.5% - 2%) - Expanded elite range for motivation
      const formattedPercentile = percentile < 1 ? percentile.toFixed(1) : Math.round(percentile);
      return {
        percentile,
        tier: 'elite',
        displayText: `Top ${formattedPercentile}%`,
        badge: '🏆',
        message: `You're in the top ${formattedPercentile}%! Amazing choice!`,
        comparison: `${peopleWhoDidThis} of ${totalPostsInScope.toLocaleString()} people`
      };
    } else if (percentile < 8) {
      // RARE: Top 8% (2% - 8%) - Expanded for daily uniqueness
      const formattedPercentile = Math.round(percentile);
      return {
        percentile,
        tier: 'rare',
        displayText: `Top ${formattedPercentile}%`,
        badge: '🌟',
        message: `Great choice! You're in the top ${formattedPercentile}%!`,
        comparison: `${peopleWhoDidThis} of ${totalPostsInScope.toLocaleString()} people`
      };
    } else if (percentile < 20) {
      // UNIQUE: Top 20% (8% - 20%) - More realistic for daily activities
      const formattedPercentile = Math.round(percentile);
      return {
        percentile,
        tier: 'unique',
        displayText: `Top ${formattedPercentile}%`,
        badge: '⭐',
        message: `Nice choice! You're in the top ${formattedPercentile}%!`,
        comparison: `${peopleWhoDidThis} of ${totalPostsInScope.toLocaleString()} people`
      };
    } else if (percentile < 40) {
      // NOTABLE: Top 40% (20% - 40%) - Expanded notable range
      const formattedPercentile = Math.round(percentile);
      return {
        percentile,
        tier: 'notable',
        displayText: `Top ${formattedPercentile}%`,
        badge: '✨',
        message: `Good choice! You're in the top ${formattedPercentile}%!`,
        comparison: `${peopleWhoDidThis} of ${totalPostsInScope.toLocaleString()} people`
      };
    } else if (percentile < 70) {
      // BELOVED: Top 70% (40% - 70%) - Popular activities cherished by many
      const formattedPercentile = Math.round(percentile);
      return {
        percentile,
        tier: 'beloved',
        displayText: `Top ${formattedPercentile}%`,
        badge: '💖',
        message: `Beloved choice! You're connected to ${peopleWhoDidThis - 1} others!`,
        comparison: `${peopleWhoDidThis} of ${totalPostsInScope.toLocaleString()} people`
      };
    } else {
      // POPULAR: > 70% - Only truly common activities
      const formattedPercentile = Math.round(percentile);
      return {
        percentile,
        tier: 'popular',
        displayText: `Join ${peopleWhoDidThis} others`,
        badge: '👥',
        message: `You're part of a community! ${peopleWhoDidThis - 1} others did this too!`,
        comparison: `${peopleWhoDidThis} of ${totalPostsInScope.toLocaleString()} people`
      };
    }
  }

  /**
   * Get color scheme for percentile tier
   */
  getPercentileColors(tier: PercentileResult['tier']): {
    bg: string;
    border: string;
    text: string;
    glow: string;
  } {
    switch (tier) {
      case 'elite':
        return {
          bg: 'from-yellow-400/20 to-amber-500/20',
          border: 'border-yellow-400/40',
          text: 'text-yellow-300',
          glow: 'shadow-yellow-400/50'
        };
      case 'rare':
        return {
          bg: 'from-purple-400/20 to-violet-500/20',
          border: 'border-purple-400/40',
          text: 'text-purple-300',
          glow: 'shadow-purple-400/50'
        };
      case 'unique':
        return {
          bg: 'from-blue-400/20 to-indigo-500/20',
          border: 'border-blue-400/40',
          text: 'text-blue-300',
          glow: 'shadow-blue-400/50'
        };
      case 'notable':
        return {
          bg: 'from-pink-400/20 to-rose-500/20',
          border: 'border-pink-400/40',
          text: 'text-pink-300',
          glow: 'shadow-pink-400/50'
        };
      case 'beloved':
        return {
          bg: 'from-pink-400/20 to-rose-500/20',
          border: 'border-pink-400/40',
          text: 'text-pink-300',
          glow: 'shadow-pink-400/50'
        };
      case 'popular':
        return {
          bg: 'from-gray-400/20 to-slate-500/20',
          border: 'border-gray-400/40',
          text: 'text-gray-300',
          glow: 'shadow-gray-400/50'
        };
      default:
        return {
          bg: 'from-gray-400/20 to-slate-500/20',
          border: 'border-gray-400/40',
          text: 'text-gray-300',
          glow: 'shadow-gray-400/50'
        };
    }
  }

  /**
   * Format percentile for display
   */
  formatPercentile(percentile: number): string {
    if (percentile < 0.1) {
      return 'Only you!';
    } else if (percentile < 1) {
      return `Top ${percentile.toFixed(1)}%`;
    } else {
      return `Top ${Math.round(percentile)}%`;
    }
  }

  /**
   * Get tier from percentile number
   * Note: This method doesn't handle the "only you" case - use calculatePercentile for that
   * Updated to match the rebalanced social media psychology tiers
   */
  getTierFromPercentile(percentile: number): PercentileResult['tier'] {
    if (percentile < 0.5) return 'elite';
    if (percentile < 2) return 'elite';
    if (percentile < 8) return 'rare';
    if (percentile < 20) return 'unique';
    if (percentile < 40) return 'notable';
    if (percentile < 70) return 'common';
    return 'popular';
  }

  /**
   * Check if tier is considered "unique" (top 25%)
   */
  isUniqueTier(tier: PercentileResult['tier']): boolean {
    return ['elite', 'rare', 'unique', 'notable'].includes(tier);
  }

  /**
   * Calculate percentile for dream posts
   */
  async calculateDreamPercentile(
    dream: any,
    similarDreams: any[]
  ): Promise<PercentileResult> {
    // For dreams, we calculate based on similarity and dream type
    const matchCount = similarDreams.length;
    
    // Estimate total dreams of this type (this would come from database in real implementation)
    const estimatedTotal = Math.max(10, matchCount * 10); // Rough estimate
    
    return this.calculatePercentile(matchCount + 1, estimatedTotal);
  }

  /**
   * Get motivational message based on tier
   */
  getMotivationalMessage(tier: PercentileResult['tier']): string {
    switch (tier) {
      case 'elite':
        return "You're amazing! 🏆";
      case 'rare':
        return "You're special! 🌟";
      case 'unique':
        return "You're wonderful! ⭐";
      case 'notable':
        return "You're great! ✨";
      case 'beloved':
        return "You're cherished! 💖";
      case 'popular':
        return "You're in good company! 👥";
      default:
        return "You're awesome! 🎉";
    }
  }
}
