import type { ILogger } from '@chasenocap/logger';
import type { IEventBus } from '@chasenocap/event-system';

/**
 * Base context interface shared across all services
 */
export interface BaseContext {
  /** Logger instance for the request */
  logger: ILogger;
  /** Unique correlation ID for request tracing */
  correlationId: string;
  /** Event bus for emitting domain events */
  eventBus: IEventBus;
  /** Original request object */
  request?: any;
}

/**
 * Extended context with user information
 */
export interface UserContext extends BaseContext {
  /** User ID from authentication */
  userId?: string;
  /** User email */
  userEmail?: string;
  /** User roles for authorization */
  roles?: string[];
}

/**
 * Context for GraphQL resolvers
 */
export interface GraphQLContext extends UserContext {
  /** Data loaders for batching and caching */
  dataSources?: Record<string, any>;
  /** Cache instance */
  cache?: any;
}

/**
 * Context for service-to-service communication
 */
export interface ServiceContext extends BaseContext {
  /** Name of the calling service */
  callerService: string;
  /** Service authentication token */
  serviceToken?: string;
}

/**
 * Factory function to create a base context
 */
export function createBaseContext(
  logger: ILogger,
  correlationId: string,
  eventBus: IEventBus,
  request?: any
): BaseContext {
  return {
    logger: logger.child({ correlationId }),
    correlationId,
    eventBus,
    request
  };
}

/**
 * Type guard to check if context is a UserContext
 */
export function isUserContext(context: BaseContext): context is UserContext {
  return 'userId' in context || 'userEmail' in context || 'roles' in context;
}

/**
 * Type guard to check if context is a ServiceContext
 */
export function isServiceContext(context: BaseContext): context is ServiceContext {
  return 'callerService' in context;
}