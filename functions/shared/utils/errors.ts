/**
 * Error Handling Utilities
 * Standardized error responses and handling
 */

import { Logger } from './logger.ts';
import { ValidationError } from './validation.ts';
import type { ApiError } from '../types/api.types.ts';

export class AppError extends Error {
  constructor(
    message: string,
    public statusCode: number = 500,
    public code: string = 'INTERNAL_ERROR',
    public details?: any
  ) {
    super(message);
    this.name = 'AppError';
  }
}

export class NotFoundError extends AppError {
  constructor(resource: string, id?: string) {
    super(
      id ? `${resource} with id ${id} not found` : `${resource} not found`,
      404,
      'NOT_FOUND'
    );
  }
}

export class UnauthorizedError extends AppError {
  constructor(message = 'Unauthorized') {
    super(message, 401, 'UNAUTHORIZED');
  }
}

export class ForbiddenError extends AppError {
  constructor(message = 'Forbidden') {
    super(message, 403, 'FORBIDDEN');
  }
}

export class ConflictError extends AppError {
  constructor(message: string, details?: any) {
    super(message, 409, 'CONFLICT', details);
  }
}

export class ErrorHandler {
  /**
   * Convert error to API error response
   */
  static toApiError(error: unknown, context?: Record<string, any>): ApiError {
    const timestamp = new Date().toISOString();

    // Log the error
    Logger.error('Request failed', {
      error: error instanceof Error ? error.message : 'Unknown error',
      ...context,
    });

    // Validation errors
    if (error instanceof ValidationError) {
      return {
        error: error.message,
        code: error.code || 'VALIDATION_ERROR',
        details: error.field ? { field: error.field } : undefined,
        timestamp,
      };
    }

    // App errors
    if (error instanceof AppError) {
      return {
        error: error.message,
        code: error.code,
        details: error.details,
        timestamp,
      };
    }

    // Generic errors
    if (error instanceof Error) {
      return {
        error: error.message,
        code: 'INTERNAL_ERROR',
        timestamp,
      };
    }

    // Unknown errors
    return {
      error: 'An unexpected error occurred',
      code: 'UNKNOWN_ERROR',
      timestamp,
    };
  }

  /**
   * Create error response
   */
  static createErrorResponse(error: unknown, context?: Record<string, any>): Response {
    const apiError = this.toApiError(error, context);
    
    // Determine status code
    let status = 500;
    if (error instanceof ValidationError) status = 400;
    if (error instanceof AppError) status = error.statusCode;

    return new Response(
      JSON.stringify(apiError),
      {
        status,
        headers: {
          'Content-Type': 'application/json',
          'X-Error-Code': apiError.code,
        },
      }
    );
  }

  /**
   * Create success response
   */
  static createSuccessResponse<T>(data: T, status = 200): Response {
    return new Response(
      JSON.stringify({
        success: true,
        data,
        timestamp: new Date().toISOString(),
      }),
      {
        status,
        headers: {
          'Content-Type': 'application/json',
        },
      }
    );
  }

  /**
   * Wrap handler with error handling
   */
  static withErrorHandling(
    handler: (req: Request) => Promise<Response>
  ) {
    return async (req: Request): Promise<Response> => {
      try {
        return await handler(req);
      } catch (error) {
        return this.createErrorResponse(error, {
          method: req.method,
          url: req.url,
        });
      }
    };
  }
}

