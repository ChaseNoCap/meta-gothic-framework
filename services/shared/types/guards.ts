/**
 * Type guard utilities for runtime type checking
 */

import { ErrorCode, OperationStatus, RunStatus, SessionStatus } from './common.js';
import { StandardError, ValidationError } from './results.js';

/**
 * Check if a value is defined (not null or undefined)
 */
export function isDefined<T>(value: T | null | undefined): value is T {
  return value !== null && value !== undefined;
}

/**
 * Check if a value is a string
 */
export function isString(value: unknown): value is string {
  return typeof value === 'string';
}

/**
 * Check if a value is a number
 */
export function isNumber(value: unknown): value is number {
  return typeof value === 'number' && !isNaN(value);
}

/**
 * Check if a value is a boolean
 */
export function isBoolean(value: unknown): value is boolean {
  return typeof value === 'boolean';
}

/**
 * Check if a value is an object
 */
export function isObject(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

/**
 * Check if a value is an array
 */
export function isArray<T = unknown>(value: unknown): value is T[] {
  return Array.isArray(value);
}

/**
 * Check if a value is a function
 */
export function isFunction(value: unknown): value is Function {
  return typeof value === 'function';
}

/**
 * Check if a value is a Date
 */
export function isDate(value: unknown): value is Date {
  return value instanceof Date && !isNaN(value.getTime());
}

/**
 * Check if a value is a valid UUID
 */
export function isUUID(value: unknown): value is string {
  if (!isString(value)) return false;
  const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
  return uuidRegex.test(value);
}

/**
 * Check if a value is a valid email
 */
export function isEmail(value: unknown): value is string {
  if (!isString(value)) return false;
  const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  return emailRegex.test(value);
}

/**
 * Check if a value is a valid URL
 */
export function isURL(value: unknown): value is string {
  if (!isString(value)) return false;
  try {
    // URL constructor is available globally in modern environments
    new URL(value);
    return true;
  } catch {
    return false;
  }
}

/**
 * Check if a value is a StandardError
 */
export function isStandardError(value: unknown): value is StandardError {
  return (
    isObject(value) &&
    'code' in value &&
    'message' in value &&
    'timestamp' in value &&
    isString(value['message']) &&
    Object.values(ErrorCode).includes(value['code'] as ErrorCode)
  );
}

/**
 * Check if a value is a ValidationError
 */
export function isValidationError(value: unknown): value is ValidationError {
  return (
    isStandardError(value) &&
    value.code === ErrorCode.VALIDATION_ERROR &&
    'fieldErrors' in value &&
    isObject(value.fieldErrors)
  );
}

/**
 * Check if a value is an Error
 */
export function isError(value: unknown): value is Error {
  return value instanceof Error;
}

/**
 * Check if a value is a valid OperationStatus
 */
export function isOperationStatus(value: unknown): value is OperationStatus {
  return isString(value) && Object.values(OperationStatus).includes(value as OperationStatus);
}

/**
 * Check if a value is a valid RunStatus
 */
export function isRunStatus(value: unknown): value is RunStatus {
  return isString(value) && Object.values(RunStatus).includes(value as RunStatus);
}

/**
 * Check if a value is a valid SessionStatus
 */
export function isSessionStatus(value: unknown): value is SessionStatus {
  return isString(value) && Object.values(SessionStatus).includes(value as SessionStatus);
}

/**
 * Check if a value has a specific property
 */
export function hasProperty<T extends object, K extends PropertyKey>(
  obj: T,
  prop: K
): obj is T & Record<K, unknown> {
  return prop in obj;
}

/**
 * Check if a value has multiple properties
 */
export function hasProperties<T extends object, K extends PropertyKey>(
  obj: T,
  props: K[]
): obj is T & Record<K, unknown> {
  return props.every(prop => prop in obj);
}

/**
 * Assert that a value is defined, throw if not
 */
export function assertDefined<T>(
  value: T | null | undefined,
  message = 'Value is not defined'
): asserts value is T {
  if (!isDefined(value)) {
    throw new Error(message);
  }
}

/**
 * Assert that a value is of a specific type
 */
export function assertType<T>(
  value: unknown,
  guard: (value: unknown) => value is T,
  message = 'Type assertion failed'
): asserts value is T {
  if (!guard(value)) {
    throw new Error(message);
  }
}

/**
 * Create a type guard for literal types
 */
export function isLiteral<T extends string | number | boolean>(literal: T) {
  return (value: unknown): value is T => value === literal;
}

/**
 * Create a type guard for union types
 */
export function isUnion<T>(...guards: Array<(value: unknown) => value is T>) {
  return (value: unknown): value is T => guards.some(guard => guard(value));
}

/**
 * Create a type guard for intersection types
 */
export function isIntersection<T>(...guards: Array<(value: unknown) => boolean>) {
  return (value: unknown): value is T => guards.every(guard => guard(value));
}

/**
 * Create a type guard for array of specific type
 */
export function isArrayOf<T>(guard: (value: unknown) => value is T) {
  return (value: unknown): value is T[] => {
    return isArray(value) && value.every(guard);
  };
}

/**
 * Create a type guard for nullable types
 */
export function isNullable<T>(guard: (value: unknown) => value is T) {
  return (value: unknown): value is T | null => {
    return value === null || guard(value);
  };
}

/**
 * Create a type guard for optional types
 */
export function isOptional<T>(guard: (value: unknown) => value is T) {
  return (value: unknown): value is T | undefined => {
    return value === undefined || guard(value);
  };
}