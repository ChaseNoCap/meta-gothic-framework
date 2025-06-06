import { buildHTTPExecutor } from '@graphql-tools/executor-http';
import { schemaFromExecutor } from '@graphql-tools/wrap';
import { createLogger } from '@chasenocap/logger';

const logger = createLogger('resilient-executor');

export async function createResilientExecutor(
  endpoint: string,
  serviceName: string,
  maxRetries = 30,
  retryDelay = 1000
) {
  const executor = buildHTTPExecutor({
    endpoint,
    headers: (executorRequest) => {
      const context = executorRequest?.context as any;
      return context?.headers || {};
    },
    retry: {
      retries: 3,
      retryDelay: 500,
    },
  });

  // Try to fetch schema with retries
  let attempts = 0;
  let lastError: Error | null = null;
  
  while (attempts < maxRetries) {
    try {
      const schema = await schemaFromExecutor(executor);
      if (attempts > 0) {
        logger.info(`Successfully connected to ${serviceName} after ${attempts} attempts`);
      }
      return { schema, executor };
    } catch (error) {
      lastError = error as Error;
      attempts++;
      
      if (attempts < maxRetries) {
        logger.warn(`Failed to connect to ${serviceName} (attempt ${attempts}/${maxRetries}): ${lastError.message}`);
        await new Promise(resolve => setTimeout(resolve, retryDelay));
      }
    }
  }
  
  throw new Error(`Failed to connect to ${serviceName} after ${maxRetries} attempts: ${lastError?.message}`);
}

export function wrapExecutorWithRetry(executor: any, serviceName: string) {
  return async (executorRequest: any) => {
    let retries = 0;
    const maxRetries = 3;
    
    while (retries < maxRetries) {
      try {
        const result = await executor(executorRequest);
        return result;
      } catch (error: any) {
        retries++;
        if (retries >= maxRetries) {
          logger.error(`${serviceName} request failed after ${maxRetries} retries:`, error);
          throw error;
        }
        logger.warn(`${serviceName} request failed, retrying (${retries}/${maxRetries})...`);
        await new Promise(resolve => setTimeout(resolve, 500 * retries));
      }
    }
  };
}