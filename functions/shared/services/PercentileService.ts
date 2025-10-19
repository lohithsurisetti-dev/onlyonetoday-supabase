/**
 * Percentile Calculation Service
 * 
 * Implements the OnlyFans-style percentile ranking system
 * Calculates how rare an action is compared to ALL users
 * Provides motivating "Top X%" messaging
 */

export interface PercentileResult {
  percentile: number; // e.g., 0.5 for "Top 0.5%"
  tier: 'elite' | 'rare' | 'unique' | 'notable' | 'common' | 'popular';
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
    // Edge case: Small dataset (< 10 posts) - still calculate tier based on percentile
    if (totalPostsInScope < 10) {
      const percentile = (peopleWhoDidThis / totalPostsInScope) * 100;
      
      // Determine tier even for small datasets
      // IMPORTANT: For small datasets, we use absolute counts, not percentiles
      // 1 of 1 = ELITE (only you!)
      // 1 of 5 = UNIQUE (20%)
      // 2 of 5 = NOTABLE (40%)
      let tier: PercentileResult['tier'] = 'common';
      let badge = '✅';
      
      if (peopleWhoDidThis === 1) {
        // Only you did this = most unique!
        tier = 'elite';
        badge = '🏆';
      } else if (percentile <= 20) {
        tier = 'unique';
        badge = '⭐';
      } else if (percentile <= 40) {
        tier = 'notable';
        badge = '✨';
      } else if (percentile <= 60) {
        tier = 'common';
        badge = '✅';
      } else {
        tier = 'popular';
        badge = '👥';
      }
      
      return {
        percentile,
        tier,
        displayText: peopleWhoDidThis === 1 ? 'Only you!' : `${peopleWhoDidThis} of ${totalPostsInScope}`,
        badge,
        message: peopleWhoDidThis === 1 
          ? "You're a unicorn! Only you did this! 🦄"
          : `You're one of ${peopleWhoDidThis} people who did this!`,
        comparison: `${peopleWhoDidThis} of ${totalPostsInScope} people`
      };
    }
    
    // Calculate percentile (what % of population did this)
    const percentile = (peopleWhoDidThis / totalPostsInScope) * 100;
    
    // Determine tier and messaging based on percentile
    if (percentile < 0.1) {
      // ELITE: Only you! (< 0.1%)
      return {
        percentile,
        tier: 'elite',
        displayText: 'Only you!',
        badge: '🏆',
        message: "You're a unicorn! Only you did this! 🦄",
        comparison: `Only you out of ${totalPostsInScope.toLocaleString()} people`
      };
    } else if (percentile < 1) {
      // ELITE: Top 1% (0.1% - 1%)
      const formattedPercentile = percentile < 1 ? percentile.toFixed(1) : Math.round(percentile);
      return {
        percentile,
        tier: 'elite',
        displayText: `Top ${formattedPercentile}%`,
        badge: '🏆',
        message: `You're in the elite ${formattedPercentile}%! Rarer than ${(100 - percentile).toFixed(1)}% of people!`,
        comparison: `${peopleWhoDidThis} of ${totalPostsInScope.toLocaleString()} people`
      };
    } else if (percentile < 5) {
      // RARE: Top 5% (1% - 5%)
      const formattedPercentile = Math.round(percentile);
      return {
        percentile,
        tier: 'rare',
        displayText: `Top ${formattedPercentile}%`,
        badge: '🌟',
        message: `Highly exclusive! You're in the top ${formattedPercentile}%!`,
        comparison: `${peopleWhoDidThis} of ${totalPostsInScope.toLocaleString()} people`
      };
    } else if (percentile < 10) {
      // UNIQUE: Top 10% (5% - 10%)
      const formattedPercentile = Math.round(percentile);
      return {
        percentile,
        tier: 'unique',
        displayText: `Top ${formattedPercentile}%`,
        badge: '⭐',
        message: `Nice! You're in the top ${formattedPercentile}%!`,
        comparison: `${peopleWhoDidThis} of ${totalPostsInScope.toLocaleString()} people`
      };
    } else if (percentile < 25) {
      // NOTABLE: Top 25% (10% - 25%)
      const formattedPercentile = Math.round(percentile);
      return {
        percentile,
        tier: 'notable',
        displayText: `Top ${formattedPercentile}%`,
        badge: '✨',
        message: `You're in the top quarter!`,
        comparison: `${peopleWhoDidThis} of ${totalPostsInScope.toLocaleString()} people`
      };
    } else if (percentile < 50) {
      // COMMON: Top 50% (25% - 50%)
      const formattedPercentile = Math.round(percentile);
      return {
        percentile,
        tier: 'common',
        displayText: `Top ${formattedPercentile}%`,
        badge: '✅',
        message: `Popular choice! Join ${peopleWhoDidThis} others!`,
        comparison: `${peopleWhoDidThis} of ${totalPostsInScope.toLocaleString()} people`
      };
    } else {
      // POPULAR: > 50%
      const formattedPercentile = Math.round(percentile);
      return {
        percentile,
        tier: 'popular',
        displayText: `Join ${peopleWhoDidThis} others`,
        badge: '👥',
        message: `You're not alone! ${peopleWhoDidThis} people did this too!`,
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
      case 'common':
        return {
          bg: 'from-green-400/20 to-emerald-500/20',
          border: 'border-green-400/40',
          text: 'text-green-300',
          glow: 'shadow-green-400/50'
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
   */
  getTierFromPercentile(percentile: number): PercentileResult['tier'] {
    if (percentile < 0.1) return 'elite';
    if (percentile < 1) return 'elite';
    if (percentile < 5) return 'rare';
    if (percentile < 10) return 'unique';
    if (percentile < 25) return 'notable';
    if (percentile < 50) return 'common';
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
        return "You're absolutely legendary! 🏆";
      case 'rare':
        return "You're incredibly special! 🌟";
      case 'unique':
        return "You're wonderfully unique! ⭐";
      case 'notable':
        return "You're definitely notable! ✨";
      case 'common':
        return "You're part of the community! ✅";
      case 'popular':
        return "You're in good company! 👥";
      default:
        return "You're awesome! 🎉";
    }
  }
}
