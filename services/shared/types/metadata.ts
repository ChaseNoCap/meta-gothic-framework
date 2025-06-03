/**
 * Metadata types for tracking execution, performance, and usage
 */

/**
 * Execution metadata for operations
 */
export interface ExecutionMetadata {
  /** When the operation started */
  startedAt: Date;
  /** When the operation completed */
  completedAt?: Date;
  /** Duration in milliseconds */
  duration?: number;
  /** Number of retries */
  retryCount?: number;
  /** Execution environment */
  environment?: string;
  /** Service version */
  version?: string;
}

/**
 * Performance metrics
 */
export interface PerformanceMetrics {
  /** Operation duration in milliseconds */
  duration: number;
  /** CPU usage percentage */
  cpuUsage?: number;
  /** Memory usage in bytes */
  memoryUsage?: number;
  /** Network latency in milliseconds */
  networkLatency?: number;
  /** Database query time in milliseconds */
  dbQueryTime?: number;
  /** Cache hit rate */
  cacheHitRate?: number;
}

/**
 * Token usage for AI operations
 */
export interface TokenUsage {
  /** Input tokens used */
  inputTokens: number;
  /** Output tokens generated */
  outputTokens: number;
  /** Total tokens (input + output) */
  totalTokens: number;
  /** Model used */
  model: string;
  /** Cost estimate in USD */
  estimatedCost?: number;
}

/**
 * AI operation metadata
 */
export interface AIOperationMetadata extends ExecutionMetadata {
  /** Model used for the operation */
  model: string;
  /** Model version */
  modelVersion?: string;
  /** Token usage information */
  tokenUsage: TokenUsage;
  /** Temperature setting */
  temperature?: number;
  /** Max tokens setting */
  maxTokens?: number;
  /** Stop sequences used */
  stopSequences?: string[];
  /** Number of completions requested */
  n?: number;
  /** Presence penalty */
  presencePenalty?: number;
  /** Frequency penalty */
  frequencyPenalty?: number;
}

/**
 * Cache metadata
 */
export interface CacheMetadata {
  /** Cache key */
  key: string;
  /** Whether this was a cache hit */
  hit: boolean;
  /** Time to live in seconds */
  ttl?: number;
  /** When the cache entry expires */
  expiresAt?: Date;
  /** Size of cached data in bytes */
  size?: number;
  /** Cache provider (redis, memory, etc) */
  provider?: string;
}

/**
 * HTTP request metadata
 */
export interface HttpRequestMetadata {
  /** HTTP method */
  method: string;
  /** Request URL */
  url: string;
  /** Status code */
  statusCode?: number;
  /** Request headers */
  headers?: Record<string, string>;
  /** Response size in bytes */
  responseSize?: number;
  /** Client IP address */
  clientIp?: string;
  /** User agent */
  userAgent?: string;
}

/**
 * Database query metadata
 */
export interface DatabaseQueryMetadata {
  /** Query string or operation */
  query: string;
  /** Query parameters */
  params?: any[];
  /** Execution time in milliseconds */
  duration: number;
  /** Number of rows affected */
  rowsAffected?: number;
  /** Database name */
  database?: string;
  /** Table/collection name */
  table?: string;
  /** Query plan */
  queryPlan?: any;
}

/**
 * Event metadata
 */
export interface EventMetadata {
  /** Event type/name */
  eventType: string;
  /** Event source service */
  source: string;
  /** Event version */
  version?: string;
  /** Whether event was successfully processed */
  processed?: boolean;
  /** Processing attempts */
  attempts?: number;
  /** Event size in bytes */
  size?: number;
}

/**
 * Git operation metadata
 */
export interface GitOperationMetadata extends ExecutionMetadata {
  /** Repository path */
  repository: string;
  /** Branch name */
  branch?: string;
  /** Commit SHA */
  commitSha?: string;
  /** Files changed */
  filesChanged?: number;
  /** Lines added */
  linesAdded?: number;
  /** Lines deleted */
  linesDeleted?: number;
  /** Operation type (commit, push, pull, etc) */
  operation: string;
}

/**
 * GraphQL operation metadata
 */
export interface GraphQLOperationMetadata extends ExecutionMetadata {
  /** Operation name */
  operationName?: string;
  /** Operation type (query, mutation, subscription) */
  operationType: 'query' | 'mutation' | 'subscription';
  /** Fields selected */
  fields?: string[];
  /** Variables passed */
  variables?: Record<string, any>;
  /** Complexity score */
  complexity?: number;
  /** Depth of query */
  depth?: number;
  /** Resolver path */
  resolverPath?: string[];
}

/**
 * Rate limit metadata
 */
export interface RateLimitMetadata {
  /** Rate limit ceiling */
  limit: number;
  /** Remaining requests */
  remaining: number;
  /** When the limit resets */
  resetsAt: Date;
  /** Window duration in seconds */
  windowSeconds: number;
  /** Whether request was rate limited */
  limited: boolean;
  /** Retry after seconds (if limited) */
  retryAfter?: number;
}

/**
 * Audit metadata for tracking who did what when
 */
export interface AuditMetadata {
  /** User who performed the action */
  userId: string;
  /** Action performed */
  action: string;
  /** Resource type */
  resourceType: string;
  /** Resource ID */
  resourceId: string;
  /** IP address */
  ipAddress?: string;
  /** User agent */
  userAgent?: string;
  /** Session ID */
  sessionId?: string;
  /** Changes made */
  changes?: Record<string, { old: any; new: any }>;
  /** Timestamp */
  timestamp: Date;
}

/**
 * Deployment metadata
 */
export interface DeploymentMetadata {
  /** Deployment ID */
  deploymentId: string;
  /** Environment (dev, staging, prod) */
  environment: string;
  /** Version being deployed */
  version: string;
  /** Git commit SHA */
  commitSha?: string;
  /** Deployer user ID */
  deployedBy?: string;
  /** Deployment timestamp */
  deployedAt: Date;
  /** Build number */
  buildNumber?: string;
  /** CI/CD pipeline ID */
  pipelineId?: string;
}