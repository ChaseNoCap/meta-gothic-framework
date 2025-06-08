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
    // Set SSE headers
    res.writeHead(200, {
      'Content-Type': 'text/event-stream',
      'Cache-Control': 'no-cache',
      'Connection': 'keep-alive',
      'Access-Control-Allow-Origin': '*',
    });

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
    const result = await options.subscribe({
      schema: options.schema,
      document,
      contextValue,
      variableValues: parsedVariables,
      operationName: operationName || undefined,
    });

    // Handle subscription errors
    if ('errors' in result && result.errors) {
      res.write(`event: error\ndata: ${JSON.stringify({ errors: result.errors })}\n\n`);
      res.end();
      return;
    }

    // Set up heartbeat
    const heartbeat = setInterval(() => {
      res.write(':heartbeat\n\n');
    }, 30000);

    // Handle client disconnect
    req.on('close', () => {
      clearInterval(heartbeat);
      // If result is an async iterator, clean it up
      if (result && typeof result === 'object' && Symbol.asyncIterator in result) {
        const iterator = result as AsyncIterator<any>;
        if (iterator.return) {
          iterator.return();
        }
      }
    });

    // Stream the subscription results
    if (result && typeof result === 'object' && Symbol.asyncIterator in result) {
      try {
        for await (const value of result as AsyncIterable<any>) {
          const message = `event: next\ndata: ${JSON.stringify(value)}\n\n`;
          res.write(message);
        }
        res.write('event: complete\ndata: {}\n\n');
      } catch (error: any) {
        res.write(`event: error\ndata: ${JSON.stringify({ message: error.message })}\n\n`);
      }
    }

    res.end();
  };
}