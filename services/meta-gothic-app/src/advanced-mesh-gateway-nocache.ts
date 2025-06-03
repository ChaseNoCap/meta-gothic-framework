import { createServer } from 'node:http';
import { createYoga } from 'graphql-yoga';
import { stitchSchemas } from '@graphql-tools/stitch';
import { schemaFromExecutor } from '@graphql-tools/wrap';
import { buildHTTPExecutor } from '@graphql-tools/executor-http';
import { RenameTypes, RenameRootFields, FilterTypes } from '@graphql-tools/wrap';
import { parse } from 'graphql';

const PORT = process.env.GATEWAY_PORT || 3000;

async function start() {
  console.log('Starting Advanced Mesh Gateway...');

  try {
    // Create executors for each service
    const claudeExecutor = buildHTTPExecutor({
      endpoint: 'http://127.0.0.1:3002/graphql',
      headers: {
        'x-gateway': 'advanced-mesh'
      }
    });

    const repoAgentExecutor = buildHTTPExecutor({
      endpoint: 'http://127.0.0.1:3004/graphql',
      headers: {
        'x-gateway': 'advanced-mesh'
      }
    });

    // Build subschemas from executors with transforms
    const claudeSubschema = {
      schema: await schemaFromExecutor(claudeExecutor),
      executor: claudeExecutor,
      transforms: [
        // Prefix Claude types to avoid conflicts
        new RenameTypes((name) => {
          if (['Query', 'Mutation', 'Subscription'].includes(name)) return name;
          return `Claude_${name}`;
        }),
        // Add service prefix to root fields
        new RenameRootFields((operation, fieldName) => {
          if (operation === 'Query' && fieldName === 'health') {
            return 'claudeHealth';
          }
          return fieldName;
        }),
      ],
      batch: true,
    };

    const repoAgentSubschema = {
      schema: await schemaFromExecutor(repoAgentExecutor),
      executor: repoAgentExecutor,
      transforms: [
        // Prefix Repo types to avoid conflicts
        new RenameTypes((name) => {
          if (['Query', 'Mutation', 'Subscription'].includes(name)) return name;
          return `Repo_${name}`;
        }),
        // Filter out internal types
        new FilterTypes((type) => {
          return !type.name.startsWith('_');
        }),
      ],
      batch: true,
    };

    // Stitch schemas together with custom resolvers
    const gatewaySchema = stitchSchemas({
      subschemas: [claudeSubschema, repoAgentSubschema],
      typeDefs: `
        extend type Query {
          """Combined health check for all services"""
          systemHealth: SystemHealth!
          
          """Get repository with its Claude analysis status"""
          repositoryWithAnalysis(path: String!): RepositoryWithAnalysis
        }
        
        type SystemHealth {
          """Overall system health"""
          healthy: Boolean!
          
          """Individual service health"""
          services: [ServiceHealth!]!
          
          """System uptime"""
          uptime: Int!
          
          """Current timestamp"""
          timestamp: String!
        }
        
        type ServiceHealth {
          """Service name"""
          name: String!
          
          """Health status"""
          healthy: Boolean!
          
          """Service version"""
          version: String
          
          """Response time in ms"""
          responseTime: Float!
        }
        
        type RepositoryWithAnalysis {
          """Repository git status"""
          gitStatus: Repo_GitStatus!
          
          """Active Claude sessions for this repo"""
          activeSessions: [Claude_ClaudeSession!]!
          
          """Recent analyses"""
          recentAnalyses: [Claude_AgentRun!]!
        }
      `,
      resolvers: {
        Query: {
          systemHealth: async (_parent, _args, context, info) => {
            const startTime = Date.now();
            
            // Check both services in parallel using executors directly
            const [claudeHealth, repoHealth] = await Promise.allSettled([
              claudeExecutor({
                document: parse('query { claudeHealth { healthy version claudeAvailable activeSessions resources { memoryUsage cpuUsage activeProcesses } } }'),
              }),
              repoAgentExecutor({
                document: parse('query { gitStatus(path: ".") { branch } }'),
              })
            ]);
            
            return {
              healthy: claudeHealth.status === 'fulfilled' && repoHealth.status === 'fulfilled',
              services: [
                {
                  name: 'claude-service',
                  healthy: claudeHealth.status === 'fulfilled',
                  version: claudeHealth.status === 'fulfilled' ? claudeHealth.value.data?.claudeHealth?.version : null,
                  responseTime: claudeHealth.status === 'fulfilled' ? Date.now() - startTime : -1
                },
                {
                  name: 'repo-agent-service',
                  healthy: repoHealth.status === 'fulfilled',
                  version: '1.0.0',
                  responseTime: repoHealth.status === 'fulfilled' ? Date.now() - startTime : -1
                }
              ],
              uptime: Math.floor(process.uptime()),
              timestamp: new Date().toISOString()
            };
          },
          
          repositoryWithAnalysis: async (_parent, { path }, context, info) => {
            // Fetch data from both services using executors directly
            const [gitStatusResult, sessionsResult] = await Promise.all([
              repoAgentExecutor({
                document: parse(`query($path: String!) { gitStatus(path: $path) { branch isDirty ahead behind files { path status isStaged } } }`),
                variables: { path }
              }),
              claudeExecutor({
                document: parse('query { sessions { id status workingDirectory } }'),
              })
            ]);
            
            const gitStatus = gitStatusResult.data?.gitStatus;
            const sessions = sessionsResult.data?.sessions || [];
            
            // Filter sessions for this repository
            const repoSessions = sessions.filter(
              (session: any) => session.workingDirectory === path
            );
            
            return {
              gitStatus,
              activeSessions: repoSessions,
              recentAnalyses: [] // Would fetch from agentRuns
            };
          }
        }
      }
    });

    // Create Yoga server without response cache for now
    const yoga = createYoga({
      schema: gatewaySchema,
      maskedErrors: false,
      graphiql: {
        title: 'Advanced Mesh Gateway',
        defaultQuery: `# Try the enhanced system health check
query SystemHealth {
  systemHealth {
    healthy
    services {
      name
      healthy
      version
      responseTime
    }
    uptime
  }
}

# Or cross-service repository analysis
query RepoAnalysis {
  repositoryWithAnalysis(path: "/Users/josh/Documents/meta-gothic-framework") {
    gitStatus {
      branch
      isDirty
    }
    activeSessions {
      id
      status
    }
  }
}`
      }
    });

    // Create HTTP server
    const server = createServer(yoga);

    server.listen(PORT, () => {
      console.log(`🚀 Advanced Mesh Gateway ready at http://localhost:${PORT}/graphql`);
      console.log(`   Features enabled:`);
      console.log(`   ✅ Type prefixing (Claude_, Repo_)`);
      console.log(`   ✅ Cross-service resolvers`);
      console.log(`   ✅ System health monitoring`);
      console.log(`   ✅ Batch query optimization`);
      console.log(`   ✅ Schema transforms`);
    });

    // Graceful shutdown
    process.on('SIGTERM', () => {
      console.log('SIGTERM signal received: closing HTTP server');
      server.close(() => {
        process.exit(0);
      });
    });

    process.on('SIGINT', () => {
      console.log('SIGINT signal received: closing HTTP server');
      server.close(() => {
        process.exit(0);
      });
    });

  } catch (error) {
    console.error('Failed to start gateway:', error);
    process.exit(1);
  }
}

start();