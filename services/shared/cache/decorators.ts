import { SimpleCache } from './SimpleCache.js';
import type { IEventBus } from '@chasenocap/event-system';
import type { ILogger } from '@chasenocap/logger';

interface CacheOptions {
  ttlSeconds?: number;
  keyGenerator?: (...args: any[]) => string;
  invalidateOn?: string[]; // Event types that invalidate cache
}

// Global cache registry
const cacheRegistry = new Map<string, SimpleCache<any>>();

// Get or create cache for a specific namespace
function getCache(namespace: string): SimpleCache<any> {
  if (!cacheRegistry.has(namespace)) {
    cacheRegistry.set(namespace, new SimpleCache());
  }
  return cacheRegistry.get(namespace)!;
}

// Default key generator
function defaultKeyGenerator(...args: any[]): string {
  return JSON.stringify(args);
}

/**
 * Decorator to cache method results
 * @param namespace - Cache namespace (e.g., 'github.repos', 'git.status')
 * @param options - Cache configuration options
 */
export function Cacheable(namespace: string, options: CacheOptions = {}) {
  return function (
    target: any,
    propertyKey: string,
    descriptor: PropertyDescriptor
  ) {
    const originalMethod = descriptor.value;
    const {
      ttlSeconds,
      keyGenerator = defaultKeyGenerator,
      invalidateOn = []
    } = options;

    descriptor.value = async function (...args: any[]) {
      const cache = getCache(namespace);
      const cacheKey = `${propertyKey}:${keyGenerator(...args)}`;
      
      // Get logger and event bus from context if available
      const logger = (this as any).logger as ILogger | undefined;
      const eventBus = (this as any).eventBus as IEventBus | undefined;
      const correlationId = (this as any).correlationId;

      // Check cache
      const cachedValue = cache.get(cacheKey);
      if (cachedValue !== undefined) {
        if (logger) {
          logger.debug('Cache hit', {
            namespace,
            method: propertyKey,
            cacheKey,
            correlationId
          });
        }
        
        // Emit cache hit event
        if (eventBus) {
          eventBus.emit({
            type: 'cache.hit',
            timestamp: Date.now(),
            payload: {
              namespace,
              method: propertyKey,
              cacheKey,
              correlationId
            }
          });
        }
        
        return cachedValue;
      }

      // Cache miss - execute method
      if (logger) {
        logger.debug('Cache miss', {
          namespace,
          method: propertyKey,
          cacheKey,
          correlationId
        });
      }

      // Emit cache miss event
      if (eventBus) {
        eventBus.emit({
          type: 'cache.miss',
          timestamp: Date.now(),
          payload: {
            namespace,
            method: propertyKey,
            cacheKey,
            correlationId
          }
        });
      }

      const startTime = Date.now();
      const result = await originalMethod.apply(this, args);
      const duration = Date.now() - startTime;

      // Cache the result
      cache.set(cacheKey, result, ttlSeconds);

      if (logger) {
        logger.debug('Cached result', {
          namespace,
          method: propertyKey,
          cacheKey,
          ttlSeconds,
          duration,
          correlationId
        });
      }

      // Set up cache invalidation on specific events
      if (eventBus && invalidateOn.length > 0) {
        invalidateOn.forEach(eventType => {
          eventBus.once(eventType, () => {
            cache.delete(cacheKey);
            if (logger) {
              logger.debug('Cache invalidated by event', {
                namespace,
                method: propertyKey,
                cacheKey,
                eventType,
                correlationId
              });
            }
          });
        });
      }

      return result;
    };

    return descriptor;
  };
}

/**
 * Decorator to invalidate cache entries
 * @param namespace - Cache namespace to invalidate
 * @param options - Invalidation options
 */
export function CacheInvalidate(namespace: string, options: { pattern?: string } = {}) {
  return function (
    target: any,
    propertyKey: string,
    descriptor: PropertyDescriptor
  ) {
    const originalMethod = descriptor.value;

    descriptor.value = async function (...args: any[]) {
      const result = await originalMethod.apply(this, args);
      
      const cache = getCache(namespace);
      const logger = (this as any).logger as ILogger | undefined;
      const eventBus = (this as any).eventBus as IEventBus | undefined;
      const correlationId = (this as any).correlationId;

      if (options.pattern) {
        // Invalidate by pattern
        const stats = cache.getStats();
        let invalidatedCount = 0;
        stats.keys.forEach(key => {
          if (key.includes(options.pattern!)) {
            cache.delete(key);
            invalidatedCount++;
          }
        });

        if (logger) {
          logger.debug('Cache invalidated by pattern', {
            namespace,
            pattern: options.pattern,
            invalidatedCount,
            correlationId
          });
        }
      } else {
        // Clear entire namespace
        cache.clear();
        
        if (logger) {
          logger.debug('Cache namespace cleared', {
            namespace,
            correlationId
          });
        }
      }

      // Emit cache invalidation event
      if (eventBus) {
        eventBus.emit({
          type: 'cache.invalidated',
          timestamp: Date.now(),
          payload: {
            namespace,
            method: propertyKey,
            pattern: options.pattern,
            correlationId
          }
        });
      }

      return result;
    };

    return descriptor;
  };
}

/**
 * Get cache statistics
 */
export function getCacheStats() {
  const stats: Record<string, any> = {};
  
  cacheRegistry.forEach((cache, namespace) => {
    const cacheStats = cache.getStats();
    stats[namespace] = {
      size: cacheStats.size,
      keys: cacheStats.keys
    };
  });
  
  return stats;
}

/**
 * Clear all caches
 */
export function clearAllCaches() {
  cacheRegistry.forEach(cache => cache.clear());
}

/**
 * Clear specific namespace cache
 */
export function clearNamespaceCache(namespace: string) {
  const cache = cacheRegistry.get(namespace);
  if (cache) {
    cache.clear();
  }
}