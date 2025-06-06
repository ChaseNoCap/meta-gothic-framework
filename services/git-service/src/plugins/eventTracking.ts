import { Plugin } from 'graphql-yoga';
import type { IEventBus } from '@chasenocap/event-system';
import type { ILogger } from '@chasenocap/logger';

export interface EventTrackingPluginOptions {
  serviceName?: string;
  slowQueryThreshold?: number; // milliseconds
}

export function useEventTracking(options: EventTrackingPluginOptions = {}): Plugin {
  const { serviceName = 'graphql', slowQueryThreshold = 100 } = options;

  return {
    onExecute({ args }) {
      const startTime = Date.now();
      const context = args.contextValue as any;
      const eventBus = context.eventBus as IEventBus;
      const logger = context.logger as ILogger;
      const correlationId = context.correlationId;

      // Extract operation info
      const operationName = args.operationName || 'anonymous';
      const operation = args.document.definitions[0];
      const operationType = operation.kind === 'OperationDefinition' ? operation.operation : 'unknown';

      // Emit start event
      if (eventBus) {
        const eventType = operationType === 'mutation' 
          ? 'graphql.mutation.started' 
          : operationType === 'subscription'
          ? 'graphql.subscription.started'
          : 'graphql.query.started';

        eventBus.emit({
          type: eventType,
          timestamp: Date.now(),
          payload: {
            operationName,
            query: args.source,
            variables: args.variableValues,
            correlationId
          }
        });
      }

      return {
        onExecuteDone({ result }) {
          const duration = Date.now() - startTime;
          const operationLogger = logger?.child({ 
            operationName, 
            operationType,
            duration 
          });

          // Log operation completion
          operationLogger?.info(`GraphQL ${operationType} completed`, {
            duration,
            hasErrors: !!(result as any).errors?.length
          });

          // Emit completion event
          if (eventBus) {
            const eventType = operationType === 'mutation'
              ? 'graphql.mutation.completed'
              : operationType === 'subscription'
              ? 'graphql.subscription.completed'
              : 'graphql.query.completed';

            eventBus.emit({
              type: eventType,
              timestamp: Date.now(),
              payload: {
                operationName,
                duration,
                dataSize: JSON.stringify(result).length,
                success: !(result as any).errors?.length,
                correlationId
              }
            });

            // Emit slow operation event if needed
            if (duration > slowQueryThreshold) {
              eventBus.emit({
                type: 'performance.slowOperation.detected',
                timestamp: Date.now(),
                payload: {
                  service: serviceName,
                  operation: `${operationType}.${operationName}`,
                  duration,
                  threshold: slowQueryThreshold,
                  correlationId
                }
              });
            }
          }
        }
      };
    },

    onSubscribe({ args }) {
      const context = args.contextValue as any;
      const eventBus = context.eventBus as IEventBus;
      const correlationId = context.correlationId;
      const operationName = args.operationName || 'anonymous';

      let messageCount = 0;
      const startTime = Date.now();

      return {
        onSubscribeResult() {
          messageCount++;
        },
        onSubscribeError({ error }) {
          const logger = context.logger as ILogger;
          logger?.error('Subscription error', error, { operationName });
        },
        onSubscribeEnd() {
          const duration = Date.now() - startTime;
          
          if (eventBus) {
            eventBus.emit({
              type: 'graphql.subscription.completed',
              timestamp: Date.now(),
              payload: {
                operationName,
                duration,
                messageCount,
                correlationId
              }
            });
          }
        }
      };
    }
  };
}