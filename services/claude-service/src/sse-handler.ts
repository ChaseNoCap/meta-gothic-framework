import { IncomingMessage, ServerResponse } from 'http';
import { parse, validate, execute, subscribe, specifiedRules, getOperationAST } from '../../shared/federation/node_modules/graphql/index.js';
import type { GraphQLSchema } from '../../shared/federation/node_modules/graphql/index.js';

interface SSEHandlerOptions {
  schema: GraphQLSchema;
  execute: typeof execute;
  subscribe: typeof subscribe;
  context: () => any;
}

export function createSSEHandler(options: SSEHandlerOptions) {
  return async (req: IncomingMessage, res: ServerResponse) => {
    const logger = (options.context() as any).logger;
    const correlationId = Math.random().toString(36).substring(7);
    
    logger?.info('[SSE Handler] New SSE connection', {
      url: req.url,
      headers: req.headers,
      correlationId
    });
    
    try {
    // Set CORS headers based on origin
    const origin = req.headers.origin;
    const corsHeaders: any = {
      'Content-Type': 'text/event-stream',
      'Cache-Control': 'no-cache',
      'Connection': 'keep-alive',
    };
    
    if (origin === 'http://localhost:3001' || origin === 'http://127.0.0.1:3001' || origin === 'http://localhost:4000') {
      corsHeaders['Access-Control-Allow-Origin'] = origin;
      corsHeaders['Access-Control-Allow-Credentials'] = 'true';
    } else {
      corsHeaders['Access-Control-Allow-Origin'] = 'http://localhost:3001';
      corsHeaders['Access-Control-Allow-Credentials'] = 'true';
    }
    
    // Set SSE headers
    res.writeHead(200, corsHeaders);

    // Parse query parameters
    const url = new URL(req.url!, `http://${req.headers.host}`);
    const query = url.searchParams.get('query');
    const variables = url.searchParams.get('variables');
    const operationName = url.searchParams.get('operationName');

    if (!query) {
      res.write(`event: error\ndata: ${JSON.stringify({ message: 'Query parameter is required' })}\n\n`);
      res.end();
      return;
    }

    // Parse the query
    let document;
    try {
      document = parse(query);
    } catch (error: any) {
      res.write(`event: error\ndata: ${JSON.stringify({ message: error.message })}\n\n`);
      res.end();
      return;
    }

    // Validate the query
    const validationErrors = validate(options.schema, document, specifiedRules);
    if (validationErrors.length > 0) {
      res.write(`event: error\ndata: ${JSON.stringify({ errors: validationErrors })}\n\n`);
      res.end();
      return;
    }

    // Check if it's a subscription
    const operationAST = getOperationAST(document, operationName || undefined);
    if (!operationAST || operationAST.operation !== 'subscription') {
      res.write(`event: error\ndata: ${JSON.stringify({ message: 'Only subscriptions are supported on this endpoint' })}\n\n`);
      res.end();
      return;
    }

    // Parse variables
    let parsedVariables = {};
    if (variables) {
      try {
        parsedVariables = JSON.parse(variables);
      } catch (error: any) {
        res.write(`event: error\ndata: ${JSON.stringify({ message: 'Invalid variables JSON' })}\n\n`);
        res.end();
        return;
      }
    }

    // Create context
    const contextValue = await options.context();

    // Execute the subscription
    const subscriptionType = options.schema.getSubscriptionType();
    const subscriptionFields = subscriptionType?.getFields() || {};
    const preWarmField = subscriptionFields['preWarmStatus'];
    
    logger?.debug('[SSE Handler] Executing subscription:', {
      operationName,
      hasSchema: !!options.schema,
      hasDocument: !!document,
      contextKeys: Object.keys(contextValue),
      schemaType: options.schema.constructor.name,
      subscriptionType: subscriptionType?.name,
      subscriptionFields: Object.keys(subscriptionFields),
      preWarmFieldExists: !!preWarmField,
      preWarmFieldResolve: typeof preWarmField?.resolve,
      preWarmFieldSubscribe: typeof preWarmField?.subscribe
    });
    
    let result;
    try {
      result = await options.subscribe({
        schema: options.schema,
        document,
        contextValue,
        variableValues: parsedVariables,
        operationName: operationName || undefined,
      });
    } catch (subscribeError: any) {
      logger?.error('[SSE Handler] Subscribe error:', subscribeError);
      logger?.error('[SSE Handler] Error stack:', { stack: subscribeError.stack });
      throw subscribeError;
    }

    // Handle subscription errors
    if ('errors' in result && result.errors) {
      res.write(`event: error\ndata: ${JSON.stringify({ errors: result.errors })}\n\n`);
      res.end();
      return;
    }

    // Set up heartbeat
    const heartbeat = setInterval(() => {
      // Send heartbeat as a proper event so client can detect it
      res.write('event: heartbeat\ndata: {}\n\n');
    }, 30000);

    // Handle client disconnect
    req.on('close', () => {
      logger?.info('[SSE Handler] Client disconnected', { correlationId });
      clearInterval(heartbeat);
      // If result is an async iterator, clean it up
      if (result && typeof result === 'object' && Symbol.asyncIterator in result) {
        const iterator = result as AsyncIterator<any>;
        if (iterator.return) {
          iterator.return().catch((error: any) => {
            logger?.error('[SSE Handler] Error cleaning up iterator', error);
          });
        }
      }
    });
    
    // Handle errors
    req.on('error', (error) => {
      logger?.error('[SSE Handler] Request error', error, { correlationId });
      clearInterval(heartbeat);
    });
    
    res.on('error', (error) => {
      logger?.error('[SSE Handler] Response error', error, { correlationId });
      clearInterval(heartbeat);
    });

    // Stream the subscription results
    if (result && typeof result === 'object' && Symbol.asyncIterator in result) {
      try {
        for await (const value of result as AsyncIterable<any>) {
          if (res.destroyed || res.writableEnded) {
            logger?.info('[SSE Handler] Response closed, stopping iteration', { correlationId });
            break;
          }
          const message = `event: next\ndata: ${JSON.stringify(value)}\n\n`;
          res.write(message);
        }
        if (!res.destroyed && !res.writableEnded) {
          res.write('event: complete\ndata: {}\n\n');
        }
      } catch (error: any) {
        logger?.error('[SSE Handler] Stream error', error, { correlationId });
        if (!res.destroyed && !res.writableEnded) {
          res.write(`event: error\ndata: ${JSON.stringify({ message: error.message })}\n\n`);
        }
      }
    }

    if (!res.destroyed && !res.writableEnded) {
      res.end();
    }
    } catch (error: any) {
      logger?.error('[SSE Handler] Unhandled error', error, { correlationId });
      if (!res.destroyed && !res.writableEnded) {
        res.writeHead(500, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ error: 'Internal server error' }));
      }
    }
  };
}