import { ErrorCode } from './common.js';

/**
 * Standard result pattern for operations that can succeed or fail
 */
export type Result<T, E = Error> = 
  | { success: true; data: T }
  | { success: false; error: E };

/**
 * Extended result with additional metadata
 */
export type ResultWithMeta<T, M = Record<string, any>, E = Error> = 
  | { success: true; data: T; metadata: M }
  | { success: false; error: E; metadata?: M };

/**
 * Standard error structure
 */
export interface StandardError {
  /** Error code */
  code: ErrorCode;
  /** Human-readable message */
  message: string;
  /** Additional error details */
  details?: Record<string, any>;
  /** Stack trace (development only) */
  stack?: string;
  /** Timestamp when error occurred */
  timestamp: Date;
}

/**
 * Validation error with field-specific errors
 */
export interface ValidationError extends StandardError {
  code: ErrorCode.VALIDATION_ERROR;
  /** Field-specific validation errors */
  fieldErrors: Record<string, string[]>;
}

/**
 * API response wrapper
 */
export interface ApiResponse<T> {
  /** Indicates if the request was successful */
  success: boolean;
  /** Response data (only present on success) */
  data?: T;
  /** Error information (only present on failure) */
  error?: StandardError;
  /** Additional metadata */
  metadata?: {
    /** Request correlation ID */
    correlationId: string;
    /** Request timestamp */
    timestamp: Date;
    /** Response time in milliseconds */
    duration?: number;
  };
}

/**
 * Batch operation result
 */
export interface BatchResult<T> {
  /** Successfully processed items */
  succeeded: T[];
  /** Failed items with error information */
  failed: Array<{
    item: T;
    error: StandardError;
  }>;
  /** Summary statistics */
  summary: {
    total: number;
    succeeded: number;
    failed: number;
    duration: number;
  };
}

/**
 * Operation result with warnings
 */
export interface ResultWithWarnings<T> {
  /** Operation succeeded */
  success: boolean;
  /** Result data */
  data: T;
  /** Non-fatal warnings */
  warnings: string[];
}

/**
 * Paginated result
 */
export interface PaginatedResult<T> {
  /** Result items */
  items: T[];
  /** Pagination information */
  pagination: {
    total: number;
    page: number;
    pageSize: number;
    totalPages: number;
    hasNext: boolean;
    hasPrevious: boolean;
  };
}

/**
 * Helper to create a success result
 */
export function success<T>(data: T): Result<T> {
  return { success: true, data };
}

/**
 * Helper to create a failure result
 */
export function failure<E = Error>(error: E): Result<never, E> {
  return { success: false, error };
}

/**
 * Helper to create a standard error
 */
export function createError(
  code: ErrorCode,
  message: string,
  details?: Record<string, any>
): StandardError {
  const error: StandardError = {
    code,
    message,
    timestamp: new Date()
  };
  
  if (details !== undefined) {
    error.details = details;
  }
  
  return error;
}

/**
 * Helper to create a validation error
 */
export function createValidationError(
  fieldErrors: Record<string, string[]>
): ValidationError {
  return {
    code: ErrorCode.VALIDATION_ERROR,
    message: 'Validation failed',
    fieldErrors,
    timestamp: new Date()
  };
}

/**
 * Type guard to check if result is successful
 */
export function isSuccess<T, E>(result: Result<T, E>): result is { success: true; data: T } {
  return result.success === true;
}

/**
 * Type guard to check if result is failure
 */
export function isFailure<T, E>(result: Result<T, E>): result is { success: false; error: E } {
  return result.success === false;
}

/**
 * Map a successful result to a new value
 */
export function mapResult<T, U, E>(
  result: Result<T, E>,
  fn: (data: T) => U
): Result<U, E> {
  if (result.success) {
    return { success: true, data: fn(result.data) };
  }
  return { success: false, error: result.error };
}

/**
 * Chain results together
 */
export async function chainResults<T, U, E>(
  result: Result<T, E>,
  fn: (data: T) => Promise<Result<U, E>>
): Promise<Result<U, E>> {
  if (isSuccess(result)) {
    return fn(result.data);
  }
  return result;
}