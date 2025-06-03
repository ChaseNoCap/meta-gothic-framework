import Fastify from 'fastify';
import mercurius from 'mercurius';
import fetch from 'node-fetch';

const PORT = process.env.GATEWAY_PORT || 3000;
const HOST = process.env.GATEWAY_HOST || '0.0.0.0';

async function start() {
  const app = Fastify({
    logger: {
      level: process.env.LOG_LEVEL || 'info',
      transport: {
        target: 'pino-pretty',
        options: {
          translateTime: 'HH:MM:ss Z',
          ignore: 'pid,hostname'
        }
      }
    }
  });

  // CORS support
  await app.register(import('@fastify/cors'), {
    origin: true,
    credentials: true
  });

  // Health check
  app.get('/health', async () => {
    return { 
      status: 'healthy',
      service: 'mercurius-federation-gateway',
      timestamp: new Date().toISOString()
    };
  });

  // Let's first test a simple federated query manually
  const federatedSchema = `
    type Query {
      # From repo-agent service
      gitStatus(path: String!): GitStatus
      scanAllRepositories: [RepositoryScan!]!
      
      # From claude service  
      sessions: [ClaudeSession!]!
      health: HealthStatus!
    }
    
    type Mutation {
      # From repo-agent service
      commitChanges(input: CommitInput!): CommitResult!
      
      # From claude service
      executeCommand(input: ClaudeExecuteInput!): ClaudeExecuteResult!
      generateCommitMessages(input: BatchCommitMessageInput!): BatchCommitMessageResult!
    }
    
    # Basic types from services (simplified for testing)
    type GitStatus {
      branch: String!
      isDirty: Boolean!
    }
    
    type RepositoryScan {
      name: String!
      path: String!
      isDirty: Boolean!
    }
    
    type ClaudeSession {
      id: ID!
      status: String!
    }
    
    type HealthStatus {
      status: String!
      claudeAvailable: Boolean!
      version: String!
      uptime: Int!
    }
    
    type CommitResult {
      success: Boolean!
      repository: String!
    }
    
    type ClaudeExecuteResult {
      sessionId: String!
      status: String!
    }
    
    type BatchCommitMessageResult {
      totalRepositories: Int!
      successCount: Int!
    }
    
    # Input types
    input CommitInput {
      repository: String!
      message: String!
    }
    
    input ClaudeExecuteInput {
      command: String!
      args: [String!]!
      projectPath: String!
    }
    
    input BatchCommitMessageInput {
      repositories: [RepositoryInput!]!
    }
    
    input RepositoryInput {
      path: String!
      name: String!
      diff: String!
      filesChanged: [String!]!
    }
  `;

  // Create resolvers that delegate to services
  const resolvers = {
    Query: {
      // Delegate to repo-agent service
      gitStatus: async (_root: any, args: any) => {
        const response = await fetch('http://127.0.0.1:3004/graphql', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            query: `query ($path: String!) {
              gitStatus(path: $path) {
                branch
                isDirty
              }
            }`,
            variables: { path: args.path }
          })
        });
        const result = await response.json();
        return result.data?.gitStatus;
      },
      
      scanAllRepositories: async () => {
        const response = await fetch('http://127.0.0.1:3004/graphql', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            query: `query {
              scanAllRepositories {
                name
                path
                isDirty
              }
            }`
          })
        });
        const result = await response.json();
        return result.data?.scanAllRepositories || [];
      },
      
      // Delegate to claude service
      sessions: async () => {
        const response = await fetch('http://127.0.0.1:3002/graphql', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            query: `query {
              sessions {
                id
                status
              }
            }`
          })
        });
        const result = await response.json();
        return result.data?.sessions || [];
      },
      
      health: async () => {
        try {
          const response = await fetch('http://127.0.0.1:3002/graphql', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              query: `query {
                health {
                  status
                  claudeAvailable
                  version
                  uptime
                }
              }`
            })
          });
          const result = await response.json();
          const healthData = result.data?.health;
          if (!healthData) {
            return {
              status: 'error',
              claudeAvailable: false,
              version: 'unknown',
              uptime: 0
            };
          }
          return healthData;
        } catch (error) {
          app.log.error('Health check failed:', error);
          return {
            status: 'error',
            claudeAvailable: false,
            version: 'unknown',
            uptime: 0
          };
        }
      }
    },
    
    Mutation: {
      // Delegate mutations
      commitChanges: async (_root: any, args: any) => {
        const response = await fetch('http://127.0.0.1:3004/graphql', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            query: `mutation ($input: CommitInput!) {
              commitChanges(input: $input) {
                success
                repository
              }
            }`,
            variables: { input: args.input }
          })
        });
        const result = await response.json();
        return result.data?.commitChanges;
      },
      
      generateCommitMessages: async (_root: any, args: any) => {
        const response = await fetch('http://127.0.0.1:3002/graphql', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            query: `mutation ($input: BatchCommitMessageInput!) {
              generateCommitMessages(input: $input) {
                totalRepositories
                successCount
              }
            }`,
            variables: { input: args.input }
          })
        });
        const result = await response.json();
        return result.data?.generateCommitMessages;
      }
    }
  };

  // Register GraphQL
  await app.register(mercurius, {
    schema: federatedSchema,
    resolvers,
    graphiql: true,
    jit: 1,
    queryDepth: 10
  });

  await app.listen({ port: Number(PORT), host: HOST });
  
  app.log.info('🚀 Mercurius Federation Gateway started!');
  app.log.info(`📊 GraphQL endpoint: http://${HOST}:${PORT}/graphql`);
  app.log.info(`🎮 GraphiQL: http://${HOST}:${PORT}/graphiql`);
  app.log.info('✅ Manual federation enabled - delegating to:');
  app.log.info('   - repo-agent: http://localhost:3004/graphql');
  app.log.info('   - claude: http://localhost:3002/graphql');
}

start().catch(console.error);