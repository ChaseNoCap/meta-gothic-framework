import { Context } from '../../types/context.js';

export async function* preWarmStatus(
  _parent: unknown,
  _args: unknown,
  context: Context
): AsyncGenerator<any, void, unknown> {
  console.log('[preWarmStatus] Subscription resolver called!');
  console.log('[preWarmStatus] Context keys:', Object.keys(context));
  const { preWarmManager, logger } = context;
  console.log('[preWarmStatus] PreWarmManager exists:', !!preWarmManager);
  
  if (!preWarmManager) {
    console.log('[preWarmStatus] No PreWarmManager, yielding NONE status');
    if (logger) {
      logger.warn('PreWarmManager not available for subscription');
    }
    yield {
      preWarmStatus: {
        status: 'NONE',
        sessionId: null,
        timestamp: new Date().toISOString(),
        error: 'Pre-warm sessions are not enabled'
      }
    };
    return;
  }

  // Send initial status
  const initialStatus = preWarmManager.getStatus();
  console.log('[preWarmStatus] Initial status:', initialStatus);
  yield {
    preWarmStatus: {
      status: initialStatus.status.toUpperCase(),
      sessionId: initialStatus.sessionId || null,
      timestamp: new Date().toISOString(),
      error: null
    }
  };

  // Create an async iterator for status updates
  const eventName = 'prewarm:status';
  
  // Set up event listener
  const statusIterator = async function*() {
    const events: any[] = [];
    let resolveNext: ((value: any) => void) | null = null;
    
    const listener = (data: any) => {
      const event = {
        preWarmStatus: {
          status: data.status.toUpperCase(),
          sessionId: data.sessionId || null,
          timestamp: data.timestamp,
          error: data.error || null
        }
      };
      
      if (resolveNext) {
        resolveNext(event);
        resolveNext = null;
      } else {
        events.push(event);
      }
    };
    
    preWarmManager.on(eventName, listener);
    
    try {
      while (true) {
        if (events.length > 0) {
          yield events.shift();
        } else {
          yield await new Promise((resolve) => {
            resolveNext = resolve;
          });
        }
      }
    } finally {
      preWarmManager.removeListener(eventName, listener);
    }
  };

  yield* statusIterator();
}