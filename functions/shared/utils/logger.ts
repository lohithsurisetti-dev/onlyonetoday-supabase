/**
 * Centralized Logging Utility
 * Structured logging for Edge Functions with analytics integration
 */

export type LogLevel = 'info' | 'warn' | 'error' | 'debug';

export interface LogContext {
  userId?: string;
  postId?: string;
  function?: string;
  duration?: number;
  [key: string]: any;
}

export class Logger {
  private static isDevelopment = typeof Deno !== 'undefined' 
    ? Deno.env.get('ENVIRONMENT') !== 'production' 
    : true;

  /**
   * Format log message with timestamp and context
   */
  private static format(level: LogLevel, message: string, context?: LogContext): string {
    const timestamp = new Date().toISOString();
    const logData = {
      timestamp,
      level,
      message,
      ...context,
    };

    return JSON.stringify(logData);
  }

  /**
   * Log info message
   */
  static info(message: string, context?: LogContext): void {
    console.log(this.format('info', message, context));
  }

  /**
   * Log warning message
   */
  static warn(message: string, context?: LogContext): void {
    console.warn(this.format('warn', message, context));
  }

  /**
   * Log error message
   */
  static error(message: string, context?: LogContext): void {
    console.error(this.format('error', message, context));
  }

  /**
   * Log debug message (only in development)
   */
  static debug(message: string, context?: LogContext): void {
    if (this.isDevelopment) {
      console.log(this.format('debug', message, context));
    }
  }

  /**
   * Log API request
   */
  static request(method: string, path: string, context?: LogContext): void {
    this.info(`${method} ${path}`, {
      ...context,
      type: 'api_request',
    });
  }

  /**
   * Log API response
   */
  static response(status: number, duration: number, context?: LogContext): void {
    const level = status >= 500 ? 'error' : status >= 400 ? 'warn' : 'info';
    this[level](`Response ${status}`, {
      ...context,
      type: 'api_response',
      status,
      duration,
    });
  }
}

