/**
 * Performance Tracking Utility
 * Track operation durations for analytics and optimization
 */

import { Logger } from './logger';

export class PerformanceTracker {
  private startTime: number;
  private operation: string;
  private metadata: Record<string, any> = {};

  constructor(operation: string, metadata?: Record<string, any>) {
    this.operation = operation;
    this.startTime = performance.now();
    if (metadata) {
      this.metadata = metadata;
    }
  }

  /**
   * End tracking and log performance
   */
  end(additionalMetadata?: Record<string, any>): number {
    const duration = performance.now() - this.startTime;

    Logger.info(`Performance: ${this.operation}`, {
      operation: this.operation,
      duration: duration,
      durationFormatted: `${duration.toFixed(2)}ms`,
      ...this.metadata,
      ...additionalMetadata,
    });

    return duration;
  }

  /**
   * End tracking with error
   */
  error(error: any): number {
    const duration = performance.now() - this.startTime;

    Logger.error(`Performance: ${this.operation} failed`, {
      operation: this.operation,
      duration: duration,
      durationFormatted: `${duration.toFixed(2)}ms`,
      error: error instanceof Error ? error.message : 'Unknown error',
      ...this.metadata,
    });

    return duration;
  }

  /**
   * Add checkpoint
   */
  checkpoint(name: string): number {
    const duration = performance.now() - this.startTime;
    
    Logger.debug(`Checkpoint: ${name}`, {
      operation: this.operation,
      checkpoint: name,
      elapsed: duration,
      elapsedFormatted: `${duration.toFixed(2)}ms`,
    });

    return duration;
  }
}

/**
 * Measure function execution time
 */
export async function measureAsync<T>(
  operation: string,
  fn: () => Promise<T>
): Promise<{ result: T; duration: number }> {
  const tracker = new PerformanceTracker(operation);

  try {
    const result = await fn();
    const duration = tracker.end();
    return { result, duration };
  } catch (error) {
    tracker.error(error);
    throw error;
  }
}

/**
 * Create performance middleware for Edge Functions
 */
export function withPerformanceTracking(
  handler: (req: Request) => Promise<Response>
) {
  return async (req: Request): Promise<Response> => {
    const tracker = new PerformanceTracker('edge_function_request', {
      method: req.method,
      url: req.url,
    });

    try {
      const response = await handler(req);
      tracker.end({ status: response.status });
      return response;
    } catch (error) {
      tracker.error(error);
      throw error;
    }
  };
}

