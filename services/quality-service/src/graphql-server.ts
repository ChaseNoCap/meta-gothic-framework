import http from 'node:http';
import { parse, execute, DocumentNode, GraphQLError } from 'graphql';
import { TimescaleQualityEngine } from './core/quality-engine.js';
import { schema } from './graphql/schema.js';
import { createContext } from './graphql/context.js';
import { logger } from './utils/logger.js';
import type { QualityConfig } from './types/index.js';

export class QualityGraphQLServer {
  private server: http.Server | null = null;
  private engine: TimescaleQualityEngine;
  private config: QualityConfig;

  constructor(engine: TimescaleQualityEngine, config: QualityConfig) {
    this.engine = engine;
    this.config = config;
  }

  async start(port: number = 3007): Promise<void> {
    this.server = http.createServer(async (req, res) => {
      // Enable CORS
      res.setHeader('Access-Control-Allow-Origin', '*');
      res.setHeader('Access-Control-Allow-Methods', 'POST, GET, OPTIONS');
      res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');
      res.setHeader('Access-Control-Max-Age', '86400');

      if (req.method === 'OPTIONS') {
        res.statusCode = 204;
        res.end();
        return;
      }

      // Handle health endpoint
      if (req.url === '/health' && req.method === 'GET') {
        const health = {
          service: 'quality-service',
          status: 'healthy',
          timestamp: new Date().toISOString(),
          uptime: process.uptime(),
          version: '1.0.0',
          database: await this.checkDatabaseHealth()
        };
        
        res.statusCode = 200;
        res.setHeader('Content-Type', 'application/json');
        res.end(JSON.stringify(health));
        return;
      }

      // Handle GraphQL endpoint
      if (req.url === '/graphql' && req.method === 'POST') {
        let body = '';
        
        req.on('data', chunk => {
          body += chunk.toString();
        });

        req.on('end', async () => {
          try {
            const { query, variables, operationName } = JSON.parse(body);
            
            // Parse the query
            let document: DocumentNode;
            try {
              document = parse(query);
            } catch (parseError) {
              res.statusCode = 400;
              res.setHeader('Content-Type', 'application/json');
              res.end(JSON.stringify({ 
                errors: [{ message: 'Failed to parse GraphQL query', extensions: { code: 'GRAPHQL_PARSE_FAILED' } }] 
              }));
              return;
            }

            // Create context
            const context = createContext(this.engine, req);

            // Execute the query
            const result = await execute({
              schema,
              document,
              contextValue: context,
              variableValues: variables,
              operationName
            });

            // Log any errors
            if (result.errors) {
              result.errors.forEach(error => {
                logger.error('GraphQL execution error:', {
                  message: error.message,
                  path: error.path,
                  extensions: error.extensions
                });
              });
            }

            res.statusCode = 200;
            res.setHeader('Content-Type', 'application/json');
            res.end(JSON.stringify(result));
          } catch (error) {
            logger.error('GraphQL request error:', error);
            res.statusCode = 500;
            res.setHeader('Content-Type', 'application/json');
            res.end(JSON.stringify({ 
              errors: [{ 
                message: 'Internal server error', 
                extensions: { code: 'INTERNAL_SERVER_ERROR' } 
              }] 
            }));
          }
        });

        req.on('error', (error) => {
          logger.error('Request stream error:', error);
          res.statusCode = 400;
          res.end();
        });

        return;
      }

      // Handle SSE endpoint for subscriptions
      if (req.url === '/graphql/stream' && req.method === 'GET') {
        // TODO: Implement SSE subscriptions
        res.statusCode = 501;
        res.setHeader('Content-Type', 'application/json');
        res.end(JSON.stringify({ error: 'SSE subscriptions not yet implemented' }));
        return;
      }

      // 404 for everything else
      res.statusCode = 404;
      res.setHeader('Content-Type', 'application/json');
      res.end(JSON.stringify({ error: 'Not found' }));
    });

    return new Promise((resolve, reject) => {
      this.server!.listen(port, '0.0.0.0', () => {
        logger.info(`Quality GraphQL server listening on http://0.0.0.0:${port}/graphql`);
        resolve();
      });

      this.server!.on('error', (error) => {
        logger.error('Server error:', error);
        reject(error);
      });
    });
  }

  async stop(): Promise<void> {
    if (this.server) {
      return new Promise((resolve) => {
        this.server!.close(() => {
          logger.info('Quality GraphQL server stopped');
          resolve();
        });
      });
    }
  }

  private async checkDatabaseHealth(): Promise<{ connected: boolean; latency?: number }> {
    try {
      const start = Date.now();
      // Use a method from engine to check DB connection
      const connected = await this.engine.isConnected();
      const latency = Date.now() - start;
      return { connected, latency };
    } catch (error) {
      return { connected: false };
    }
  }
}