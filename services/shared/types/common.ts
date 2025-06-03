/**
 * Common enums and utility types shared across services
 */

/**
 * Standard status for async operations
 */
export enum OperationStatus {
  PENDING = 'PENDING',
  IN_PROGRESS = 'IN_PROGRESS',
  COMPLETED = 'COMPLETED',
  FAILED = 'FAILED',
  CANCELLED = 'CANCELLED',
  TIMEOUT = 'TIMEOUT'
}

/**
 * Run status for long-running operations
 */
export enum RunStatus {
  PENDING = 'PENDING',
  STARTED = 'STARTED',
  RUNNING = 'RUNNING',
  COMPLETED = 'COMPLETED',
  FAILED = 'FAILED',
  CANCELLED = 'CANCELLED',
  TIMEOUT = 'TIMEOUT'
}

/**
 * Session status for interactive sessions
 */
export enum SessionStatus {
  ACTIVE = 'ACTIVE',
  IDLE = 'IDLE',
  COMPLETED = 'COMPLETED',
  EXPIRED = 'EXPIRED',
  ERROR = 'ERROR'
}

/**
 * Log levels
 */
export enum LogLevel {
  DEBUG = 'DEBUG',
  INFO = 'INFO',
  WARN = 'WARN',
  ERROR = 'ERROR',
  FATAL = 'FATAL'
}

/**
 * Common error codes
 */
export enum ErrorCode {
  // Client errors (4xx)
  BAD_REQUEST = 'BAD_REQUEST',
  UNAUTHORIZED = 'UNAUTHORIZED',
  FORBIDDEN = 'FORBIDDEN',
  NOT_FOUND = 'NOT_FOUND',
  CONFLICT = 'CONFLICT',
  VALIDATION_ERROR = 'VALIDATION_ERROR',
  RATE_LIMITED = 'RATE_LIMITED',
  
  // Server errors (5xx)
  INTERNAL_ERROR = 'INTERNAL_ERROR',
  SERVICE_UNAVAILABLE = 'SERVICE_UNAVAILABLE',
  TIMEOUT = 'TIMEOUT',
  DEPENDENCY_ERROR = 'DEPENDENCY_ERROR'
}

/**
 * Pagination input
 */
export interface PaginationInput {
  /** Number of items per page */
  limit: number;
  /** Page offset */
  offset: number;
  /** Optional cursor for cursor-based pagination */
  cursor?: string;
}

/**
 * Pagination info for responses
 */
export interface PaginationInfo {
  /** Total number of items */
  total: number;
  /** Current page number */
  page: number;
  /** Number of pages */
  pages: number;
  /** Has next page */
  hasNext: boolean;
  /** Has previous page */
  hasPrev: boolean;
  /** Next cursor for cursor-based pagination */
  nextCursor?: string;
  /** Previous cursor for cursor-based pagination */
  prevCursor?: string;
}

/**
 * Sort direction
 */
export enum SortDirection {
  ASC = 'ASC',
  DESC = 'DESC'
}

/**
 * Sort input
 */
export interface SortInput<T = string> {
  /** Field to sort by */
  field: T;
  /** Sort direction */
  direction: SortDirection;
}

/**
 * Date range filter
 */
export interface DateRange {
  /** Start date (inclusive) */
  from: Date;
  /** End date (inclusive) */
  to: Date;
}

/**
 * Nullable type helper
 */
export type Nullable<T> = T | null;

/**
 * Optional type helper
 */
export type Optional<T> = T | undefined;

/**
 * Maybe type helper (nullable and optional)
 */
export type Maybe<T> = T | null | undefined;

/**
 * Extract keys of a certain type
 */
export type KeysOfType<T, U> = {
  [K in keyof T]: T[K] extends U ? K : never;
}[keyof T];

/**
 * Make certain keys optional
 */
export type PartialBy<T, K extends keyof T> = Omit<T, K> & Partial<Pick<T, K>>;

/**
 * Make certain keys required
 */
export type RequiredBy<T, K extends keyof T> = Omit<T, K> & Required<Pick<T, K>>;

/**
 * Deep partial type
 */
export type DeepPartial<T> = {
  [P in keyof T]?: T[P] extends object ? DeepPartial<T[P]> : T[P];
};

/**
 * Type for ID fields
 */
export type ID = string;

/**
 * Type for JSON values
 */
export type JSONValue = 
  | string
  | number
  | boolean
  | null
  | { [key: string]: JSONValue }
  | JSONValue[];

/**
 * Type for JSON objects
 */
export type JSONObject = { [key: string]: JSONValue };

/**
 * Timestamp fields
 */
export interface Timestamps {
  /** Creation timestamp */
  createdAt: Date;
  /** Last update timestamp */
  updatedAt: Date;
}

/**
 * Soft delete fields
 */
export interface SoftDeletable {
  /** Deletion timestamp */
  deletedAt?: Date;
  /** Is deleted flag */
  isDeleted: boolean;
}