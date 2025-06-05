import { createServer } from 'node:http';
import { createYoga } from 'graphql-yoga';
import { stitchSchemas } from '@graphql-tools/stitch';
import { makeExecutableSchema } from '@graphql-tools/schema';
import { RenameTypes } from '@graphql-tools/wrap';
import { createLogger } from '@chasenocap/logger';
import { nanoid } from 'nanoid';
import { getFileSystem } from '../../shared/file-system/index.js';
import { fileURLToPath } from 'url';
import { createRequestEventBus, eventBus as globalEventBus } from './eventBus.js';
// import type { GraphQLContext } from '@meta-gothic/shared-types'; // Not needed in this file
import { createGitHubResolvers } from './githubResolvers.js';
import { useEventTracking } from './plugins/eventTracking.js';
import { EventBroadcaster } from './websocket/eventBroadcaster.js';
import { createResilientExecutor, wrapExecutorWithRetry } from './resilientExecutor.js';

const fileSystem = getFileSystem();
const __dirname = fileSystem.dirname(fileURLToPath(import.meta.url));

// Initialize logger
const logger = createLogger('meta-gothic-gateway', {}, {
  logDir: fileSystem.join(__dirname, '../../logs/meta-gothic-gateway')
});

const PORT = process.env['GATEWAY_PORT'] || 3000;
const GITHUB_TOKEN = process.env['GITHUB_TOKEN'] || process.env['VITE_GITHUB_TOKEN'];
const ENABLE_CACHE = process.env['ENABLE_CACHE'] !== 'false'; // Cache enabled by default

async function start() {
  logger.info('Starting Meta-GOTHIC GraphQL Gateway...');
  
  if (!GITHUB_TOKEN) {
    logger.warn('No GitHub token found. GitHub features will have limited rate limits.');
  } else {
    logger.info('GitHub token detected');
  }

  try {
    // Create resilient executors for each service
    logger.info('Connecting to Claude Service...');
    const { schema: claudeSchema, executor: claudeExecutor } = await createResilientExecutor(
      'http://127.0.0.1:3002/graphql',
      'Claude Service'
    );
    
    logger.info('Connecting to Repo Agent Service...');
    const { schema: repoAgentSchema, executor: repoAgentExecutor } = await createResilientExecutor(
      'http://127.0.0.1:3004/graphql',
      'Repo Agent Service'
    );

    // Build subschemas with resilient executors
    const claudeSubschema = {
      schema: claudeSchema,
      executor: wrapExecutorWithRetry(claudeExecutor, 'Claude'),
      transforms: [
        // Prefix Claude types to avoid conflicts
        new RenameTypes((name) => {
          if (['Query', 'Mutation', 'Subscription'].includes(name)) return name;
          return `Claude_${name}`;
        }),
      ],
    };

    const repoAgentSubschema = {
      schema: repoAgentSchema,
      executor: wrapExecutorWithRetry(repoAgentExecutor, 'RepoAgent'),
      transforms: [
        // Prefix Repo types to avoid conflicts
        new RenameTypes((name) => {
          if (['Query', 'Mutation', 'Subscription'].includes(name)) return name;
          return `Repo_${name}`;
        }),
      ],
    };

    // Create GitHub schema with essential queries
    const githubTypeDefs = `
      type GitHubUser {
        login: String!
        name: String
        avatarUrl: String
        bio: String
        company: String
        location: String
        publicRepos: Int
      }

      type GitHubRepository {
        id: String!
        name: String!
        fullName: String!
        description: String
        private: Boolean!
        fork: Boolean!
        createdAt: String!
        updatedAt: String!
        pushedAt: String
        homepage: String
        size: Int!
        stargazersCount: Int!
        watchersCount: Int!
        language: String
        forksCount: Int!
        openIssuesCount: Int!
        defaultBranch: String!
        topics: [String!]
        owner: GitHubUser!
      }

      type GitHubWorkflowRun {
        id: Int!
        name: String
        headBranch: String
        headSha: String
        status: String
        conclusion: String
        workflowId: Int!
        url: String!
        createdAt: String!
        updatedAt: String!
      }

      type GitHubWorkflow {
        id: Int!
        name: String!
        path: String!
        state: String!
      }

      type Query {
        githubUser: GitHubUser
        githubRepositories(perPage: Int = 30, page: Int = 1): [GitHubRepository!]!
        githubRepository(owner: String!, name: String!): GitHubRepository
        githubWorkflows(owner: String!, repo: String!): [GitHubWorkflow!]!
        githubWorkflowRuns(owner: String!, repo: String!, perPage: Int = 10): [GitHubWorkflowRun!]!
      }

      type Mutation {
        triggerWorkflow(owner: String!, repo: String!, workflowId: String!, ref: String = "main"): Boolean!
        cancelWorkflowRun(owner: String!, repo: String!, runId: Int!): Boolean!
      }
    `;

    // Create GitHub resolvers using the imported function
    const githubResolvers = createGitHubResolvers(GITHUB_TOKEN);

    const githubSchema = makeExecutableSchema({
      typeDefs: githubTypeDefs,
      resolvers: githubResolvers,
    });

    // Stitch all schemas together
    const gatewaySchema = stitchSchemas({
      subschemas: [
        claudeSubschema, 
        repoAgentSubschema,
        { schema: githubSchema }
      ],
    });

    // Prepare plugins
    const plugins: any[] = [];

    // Add caching if enabled
    if (ENABLE_CACHE) {
      try {
        const { useResponseCache } = await import('@graphql-yoga/plugin-response-cache');
        plugins.push(
          useResponseCache({
            session: () => null,
            ttl: 5000, // 5 seconds default
            ttlPerType: {
              // Claude types
              Claude_ClaudeHealthStatus: 5000,
              Claude_ClaudeSession: 60000,
              Claude_AgentRun: 30000,
              
              // Repo types
              Repo_RepoAgentHealth: 5000,
              Repo_GitStatus: 30000,
              Repo_Repository: 60000,
              Repo_Commit: 300000,
              
              // GitHub types
              GitHubUser: 300000, // 5 minutes
              GitHubRepository: 60000, // 1 minute
              GitHubWorkflowRun: 10000, // 10 seconds
            },
          })
        );
        logger.info('Response caching enabled');
      } catch (error) {
        logger.warn('Could not enable response caching', { error });
      }
    }

    // Add event tracking plugin
    plugins.push(
      useEventTracking({
        serviceName: 'meta-gothic-gateway',
        slowQueryThreshold: 1000 // 1 second for gateway operations
      })
    );

    // Create Yoga server
    const yoga = createYoga({
      schema: gatewaySchema,
      maskedErrors: false,
      graphiql: true,
      plugins,
      context: ({ request }) => {
        // Generate correlation ID for request tracking
        const correlationId = request.headers.get('x-correlation-id') || nanoid();
        const requestLogger = logger.child({
          correlationId,
          method: request.method,
          url: request.url,
        });

        // Create request-scoped event bus
        const eventBus = createRequestEventBus(correlationId);

        // Pass correlation ID to downstream services
        const headers = {
          'x-correlation-id': correlationId,
        };

        return {
          logger: requestLogger,
          correlationId,
          headers,
          eventBus,
        };
      },
    });

    // Create HTTP server with health endpoint
    const server = createServer((req, res) => {
      // Add health check endpoint
      if (req.url === '/health' && req.method === 'GET') {
        res.writeHead(200, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({
          status: 'healthy',
          timestamp: new Date().toISOString(),
          service: 'meta-gothic-gateway',
          version: '1.0.0',
          uptime: process.uptime(),
          services: {
            claude: 'http://localhost:3002/graphql',
            repoAgent: 'http://localhost:3004/graphql',
            github: 'Direct integration'
          },
          features: {
            githubAuthenticated: !!GITHUB_TOKEN,
            cacheEnabled: ENABLE_CACHE,
            webSocketEvents: true
          }
        }));
        return;
      }
      
      // Handle GraphQL requests
      return yoga(req, res);
    });

    // Create WebSocket event broadcaster
    const eventBroadcaster = new EventBroadcaster(server);
    
    // Connect global event bus to WebSocket broadcaster
    eventBroadcaster.setEventBus(globalEventBus);
    
    // Also subscribe request event buses to global bus for broadcasting
    globalEventBus.on('*', () => {
      // Events from request-scoped buses will be forwarded here
    });

    server.listen(PORT, () => {
      logger.info('Meta-GOTHIC GraphQL Gateway started', {
        port: PORT,
        graphqlEndpoint: `http://localhost:${PORT}/graphql`,
        healthEndpoint: `http://localhost:${PORT}/health`,
        webSocketEndpoint: `ws://localhost:${PORT}/ws/events`,
        services: {
          claude: 'http://localhost:3002/graphql',
          repoAgent: 'http://localhost:3004/graphql',
          github: 'Direct integration'
        },
        features: {
          githubAuthenticated: !!GITHUB_TOKEN,
          cacheEnabled: ENABLE_CACHE,
          webSocketEvents: true
        }
      });
    });

    // Graceful shutdown
    process.on('SIGTERM', () => {
      logger.info('SIGTERM signal received: closing HTTP server');
      server.close(() => {
        logger.info('Server closed successfully');
        process.exit(0);
      });
    });

    process.on('SIGINT', () => {
      logger.info('SIGINT signal received: closing HTTP server');
      server.close(() => {
        logger.info('Server closed successfully');
        process.exit(0);
      });
    });

  } catch (error) {
    logger.error('Failed to start gateway', error as Error);
    process.exit(1);
  }
}

start();