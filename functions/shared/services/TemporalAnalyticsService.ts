/**
 * Temporal Analytics Service
 * Provides time-based analytics for posts and user activity
 */

import type { SupabaseClient } from 'https://esm.sh/@supabase/supabase-js@2';
import { Logger } from '../utils/logger.ts';

export interface TemporalData {
  week: {
    matches: number;
    total: number;
    comparison: string;
  };
  month: {
    matches: number;
    total: number;
    comparison: string;
  };
  year: {
    matches: number;
    total: number;
    comparison: string;
  };
  allTime: {
    matches: number;
    total: number;
    comparison: string;
  };
  insight: string;
}

export class TemporalAnalyticsService {
  constructor(private supabase: SupabaseClient) {}

  /**
   * Get temporal analytics for a specific post content and scope
   */
  async getTemporalAnalytics(
    content: string,
    scope: string,
    userId: string,
    currentMatchCount: number
  ): Promise<TemporalData> {
    const tracker = new PerformanceTracker('temporal_analytics');
    
    try {
      // Get time ranges
      const now = new Date();
      const weekAgo = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
      const monthAgo = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);
      const yearAgo = new Date(now.getTime() - 365 * 24 * 60 * 60 * 1000);

      // Build scope filter
      const scopeFilter = this.buildScopeFilter(scope);

      // Get counts for each time period
      const [weekData, monthData, yearData, allTimeData] = await Promise.all([
        this.getTimePeriodData(content, weekAgo, now, scopeFilter),
        this.getTimePeriodData(content, monthAgo, now, scopeFilter),
        this.getTimePeriodData(content, yearAgo, now, scopeFilter),
        this.getTimePeriodData(content, null, now, scopeFilter),
      ]);

      // Calculate insights
      const insight = this.generateInsight(currentMatchCount, weekData.matches);

      tracker.end();

      return {
        week: {
          matches: weekData.matches,
          total: weekData.total,
          comparison: this.formatComparison(weekData.matches, weekData.total),
        },
        month: {
          matches: monthData.matches,
          total: monthData.total,
          comparison: this.formatComparison(monthData.matches, monthData.total),
        },
        year: {
          matches: yearData.matches,
          total: yearData.total,
          comparison: this.formatComparison(yearData.matches, yearData.total),
        },
        allTime: {
          matches: allTimeData.matches,
          total: allTimeData.total,
          comparison: this.formatComparison(allTimeData.matches, allTimeData.total),
        },
        insight,
      };
    } catch (error) {
      Logger.error('Failed to get temporal analytics', { error, content, scope });
      tracker.end();
      
      // Return fallback data
      return this.getFallbackTemporalData(currentMatchCount);
    }
  }

  /**
   * Get data for a specific time period
   */
  private async getTimePeriodData(
    content: string,
    startDate: Date | null,
    endDate: Date,
    scopeFilter: any
  ): Promise<{ matches: number; total: number }> {
    try {
      // Build the query
      let query = this.supabase
        .from('posts')
        .select('id, created_at, scope, location_city, location_state, location_country')
        .eq('scope', scopeFilter.scope)
        .lte('created_at', endDate.toISOString());

      // Add date filter if provided
      if (startDate) {
        query = query.gte('created_at', startDate.toISOString());
      }

      // Add location filters if needed
      if (scopeFilter.location_city) {
        query = query.eq('location_city', scopeFilter.location_city);
      }
      if (scopeFilter.location_state) {
        query = query.eq('location_state', scopeFilter.location_state);
      }
      if (scopeFilter.location_country) {
        query = query.eq('location_country', scopeFilter.location_country);
      }

      const { data, error } = await query;

      if (error) {
        Logger.error('Failed to query posts for temporal analytics', { error });
        return { matches: 0, total: 0 };
      }

      // For now, return estimated data based on scope
      // In a real implementation, you'd use vector similarity to find similar posts
      const total = data?.length || 0;
      const matches = Math.min(total, Math.floor(total * 0.1)); // Estimate 10% similarity

      return { matches, total };
    } catch (error) {
      Logger.error('Error in getTimePeriodData', { error });
      return { matches: 0, total: 0 };
    }
  }

  /**
   * Build scope filter for queries
   */
  private buildScopeFilter(scope: string): any {
    const filter: any = { scope };
    
    // Add location filters based on scope
    // This would be populated with actual location data in a real implementation
    if (scope === 'city') {
      filter.location_city = 'San Francisco'; // Example
    } else if (scope === 'state') {
      filter.location_state = 'California'; // Example
    } else if (scope === 'country') {
      filter.location_country = 'United States'; // Example
    }

    return filter;
  }

  /**
   * Format comparison string
   */
  private formatComparison(matches: number, total: number): string {
    if (matches === 0) {
      return 'Only you!';
    }
    return `${matches + 1} of ${total + 1}`;
  }

  /**
   * Generate insight based on data
   */
  private generateInsight(currentMatchCount: number, weekMatches: number): string {
    if (currentMatchCount === 0) {
      return 'You are truly unique!';
    } else if (weekMatches === 0) {
      return 'First time this week!';
    } else if (currentMatchCount <= 2) {
      return 'You are part of a select group!';
    } else {
      return 'You are part of a growing community!';
    }
  }

  /**
   * Fallback temporal data when API fails
   */
  private getFallbackTemporalData(matchCount: number): TemporalData {
    const baseMultiplier = Math.max(1, matchCount);
    
    return {
      week: {
        matches: matchCount,
        total: baseMultiplier * 10,
        comparison: matchCount === 0 ? 'Only you!' : `${matchCount + 1} of ${baseMultiplier * 10 + 1}`,
      },
      month: {
        matches: matchCount,
        total: baseMultiplier * 50,
        comparison: matchCount === 0 ? 'Only you!' : `${matchCount + 1} of ${baseMultiplier * 50 + 1}`,
      },
      year: {
        matches: matchCount,
        total: baseMultiplier * 200,
        comparison: matchCount === 0 ? 'Only you!' : `${matchCount + 1} of ${baseMultiplier * 200 + 1}`,
      },
      allTime: {
        matches: matchCount,
        total: baseMultiplier * 1000,
        comparison: matchCount === 0 ? 'Only you!' : `${matchCount + 1} of ${baseMultiplier * 1000 + 1}`,
      },
      insight: matchCount === 0 ? 'You are truly unique!' : 'You are part of a select group!',
    };
  }
}

// Import PerformanceTracker
import { PerformanceTracker } from '../utils/performance.ts';
