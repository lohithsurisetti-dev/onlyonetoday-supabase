/**
 * Story Generator Service
 * 
 * Generates personalized narratives instead of numbers/percentiles
 * Celebrates both uniqueness AND commonality
 */

export interface PostStory {
  narrative: string;
  matchCount: number;
  totalInScope: number;
  emotionalTone: 'unique' | 'shared' | 'common';
  celebration: string;
  badge?: string;
}

export class StoryGenerator {
  /**
   * Generate personalized story for post
   */
  generateStory(
    matchCount: number,
    totalInScope: number,
    content: string,
    postType: 'action' | 'day' | 'dream' = 'action'
  ): PostStory {
    
    // Handle edge cases
    if (totalInScope === 0) {
      return {
        narrative: "You're the first person to post here! Welcome! 🎉",
        matchCount: 1,
        totalInScope: 0,
        emotionalTone: 'unique',
        celebration: 'first_post',
        badge: '🌟'
      };
    }

    if (matchCount === totalInScope) {
      return {
        narrative: "Everyone did this today! You're part of something special! 🌟",
        matchCount: matchCount,
        totalInScope: totalInScope,
        emotionalTone: 'common',
        celebration: 'universal',
        badge: '🌍'
      };
    }

    // Calculate ratio
    const ratio = matchCount / Math.max(totalInScope, 1);

    // Generate narrative based on match count
    if (matchCount === 1) {
      return this.generateUniqueStory(content, postType, totalInScope);
    }

    if (ratio < 0.01) { // Less than 1%
      return this.generateRareStory(matchCount, totalInScope, postType);
    }

    if (ratio < 0.10) { // Less than 10%
      return this.generateSharedStory(matchCount, totalInScope, postType);
    }

    if (ratio < 0.50) { // Less than 50%
      return this.generateCommonStory(matchCount, totalInScope, postType);
    }

    // More than 50% - common but still valid
    return this.generatePopularStory(matchCount, totalInScope, postType);
  }

  /**
   * Generate story for unique posts (only one person)
   */
  private generateUniqueStory(content: string, postType: string, totalInScope: number = 0): PostStory {
    const isDaySummary = postType === 'day';
    
    const messages = isDaySummary ? [
      "You're blazing a trail. No one else had this day today. Your experience is uniquely yours. 🌟",
      "You're the first. The pioneer. The one who started this. That's powerful. 💫",
      "This day is yours alone. You're creating something new. That's beautiful. ✨",
      "You're leading the way. No one else had this day. Your moment is special. 🚀",
      "You're the trailblazer. This day belongs to you. That's rare and meaningful. 💎"
    ] : [
      "You're blazing a trail. No one else did this today. Your moment is uniquely yours. 🌟",
      "You're the first. The pioneer. The one who started this. That's powerful. 💫",
      "This is yours alone today. You're creating something new. That's beautiful. ✨",
      "You're leading the way. No one else did this. Your moment is special. 🚀",
      "You're the trailblazer. This belongs to you. That's rare and meaningful. 💎"
    ];
    
    return {
      narrative: messages[Math.floor(Math.random() * messages.length)],
      matchCount: 1,
      totalInScope: totalInScope, // Use the actual totalInScope passed from caller
      emotionalTone: 'unique',
      celebration: 'trailblazer',
      badge: '🌟'
    };
  }

  /**
   * Generate story for rare posts (< 1% of total)
   */
  private generateRareStory(matchCount: number, totalInScope: number, postType: string): PostStory {
    const isDaySummary = postType === 'day';
    
    const messages = isDaySummary ? [
      `Only ${matchCount} others had a similar day today. You found your rare tribe. That's special. 💎`,
      `You're part of an exclusive ${matchCount}. Rare moments, rare connections. You're not alone. 💙`,
      `${matchCount} people chose this path today. You're not alone in being different. That's beautiful. ✨`,
      `Only ${matchCount} of ${totalInScope.toLocaleString()} people had a similar day. You're special, and you're connected. 💫`,
      `${matchCount} people had a similar day. You're part of something rare and meaningful. 🌟`
    ] : [
      `Only ${matchCount} others did this today. You found your rare tribe. That's special. 💎`,
      `You're part of an exclusive ${matchCount}. Rare moments, rare connections. You're not alone. 💙`,
      `${matchCount} people chose this path today. You're not alone in being different. That's beautiful. ✨`,
      `Only ${matchCount} of ${totalInScope.toLocaleString()} people did this. You're special, and you're connected. 💫`,
      `${matchCount} people did this today. You're part of something rare and meaningful. 🌟`
    ];
    
    return {
      narrative: messages[Math.floor(Math.random() * messages.length)],
      matchCount,
      totalInScope,
      emotionalTone: 'unique',
      celebration: 'rare',
      badge: '💎'
    };
  }

  /**
   * Generate story for shared posts (1-10% of total)
   */
  private generateSharedStory(matchCount: number, totalInScope: number, postType: string): PostStory {
    const isDaySummary = postType === 'day';
    
    const messages = isDaySummary ? [
      `${matchCount} others had a similar day too. You found your people. Connection found. 💙`,
      `You're one of ${matchCount} who chose this day. Your tribe is here. That's meaningful. ✨`,
      `${matchCount} people, one moment. You're part of something beautiful. 💫`,
      `You're one of ${matchCount} who had this kind of day. You found connection. That's powerful. 🌟`,
      `${matchCount} others had a similar day. You're part of a special group. That's beautiful. 💚`
    ] : [
      `${matchCount} others did this today too. You found your people. Connection found. 💙`,
      `You're one of ${matchCount} who chose this. Your tribe is here. That's meaningful. ✨`,
      `${matchCount} people, one moment. You're part of something beautiful. 💫`,
      `You're one of ${matchCount} who did this. You found connection. That's powerful. 🌟`,
      `${matchCount} others did this too. You're part of a special group. That's beautiful. 💚`
    ];
    
    return {
      narrative: messages[Math.floor(Math.random() * messages.length)],
      matchCount,
      totalInScope,
      emotionalTone: 'shared',
      celebration: 'found_your_people',
      badge: '✨'
    };
  }

  /**
   * Generate story for common posts (10-50% of total)
   */
  private generateCommonStory(matchCount: number, totalInScope: number, postType: string): PostStory {
    const isDaySummary = postType === 'day';
    
    const messages = isDaySummary ? [
      `${matchCount} people had a similar day today. You're part of a shared human experience. That's beautiful. 💚`,
      `You're one of ${matchCount} who chose this day. Sometimes the best moments are the ones we share. 🌍`,
      `${matchCount} others had a similar day. You're connected to humanity. That's powerful. 💙`,
      `You're one of ${matchCount} people who had a similar day. Connection is beautiful. That's meaningful. 💫`,
      `${matchCount} people had a similar day. You're part of something bigger. That's special. ✨`
    ] : [
      `${matchCount} people did this today. You're part of a shared human experience. That's beautiful. 💚`,
      `You're one of ${matchCount} who chose this. Sometimes the best moments are the ones we share. 🌍`,
      `${matchCount} others did this too. You're connected to humanity. That's powerful. 💙`,
      `You're one of ${matchCount} people who did this today. Connection is beautiful. That's meaningful. 💫`,
      `${matchCount} people did this today. You're part of something bigger. That's special. ✨`
    ];
    
    return {
      narrative: messages[Math.floor(Math.random() * messages.length)],
      matchCount,
      totalInScope,
      emotionalTone: 'shared',
      celebration: 'meaningful',
      badge: '💚'
    };
  }

  /**
   * Generate story for popular posts (> 50% of total)
   */
  private generatePopularStory(matchCount: number, totalInScope: number, postType: string): PostStory {
    const isDaySummary = postType === 'day';
    
    const messages = isDaySummary ? [
      `${matchCount} others had a similar day today. Sometimes the best moments are the ones we all share. That's beautiful. 🌍`,
      `You're part of ${matchCount} people who had a similar day. Shared experiences are powerful. That's meaningful. 💚`,
      `${matchCount} people had a similar day. You're connected to humanity. That's powerful. 💫`,
      `You're one of ${matchCount} who had this kind of day. You're part of something universal. That's beautiful. 🌟`,
      `${matchCount} others had a similar day. You're part of a shared human experience. That's special. 💙`
    ] : [
      `${matchCount} others did this today. Sometimes the best moments are the ones we all share. That's beautiful. 🌍`,
      `You're part of ${matchCount} people who chose this. Shared experiences are powerful. That's meaningful. 💚`,
      `${matchCount} people did this today. You're connected to humanity. That's powerful. 💫`,
      `You're one of ${matchCount} who did this. You're part of something universal. That's beautiful. 🌟`,
      `${matchCount} others did this too. You're part of a shared human experience. That's special. 💙`
    ];
    
    return {
      narrative: messages[Math.floor(Math.random() * messages.length)],
      matchCount,
      totalInScope,
      emotionalTone: 'common',
      celebration: 'shared_humanity',
      badge: '🌍'
    };
  }
}

