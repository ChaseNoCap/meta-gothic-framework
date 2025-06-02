import Fastify from 'fastify';
import mercurius from 'mercurius';
import websocket from '@fastify/websocket';
// Node.js 18+ has native fetch, no import needed

const PORT = process.env.GATEWAY_PORT || 3000;
const HOST = process.env.GATEWAY_HOST || '0.0.0.0';

// Simple schema that delegates to downstream services
const schema = `
  type Query {
    # From repo-agent service
    gitStatus(path: String!): GitStatus
    scanAllRepositories: [RepositoryScan!]!
    scanAllDetailed: DetailedScanReport!
    isRepositoryClean(path: String!): RepositoryCleanStatus!
    latestCommit(path: String!): CommitInfo!
    
    # From claude service
    sessions: [ClaudeSession!]!
    health: HealthStatus!
  }
  
  type Mutation {
    # From repo-agent service
    executeGitCommand(input: GitCommandInput!): GitCommandResult!
    commitChanges(input: CommitInput!): CommitResult!
    batchCommit(input: BatchCommitInput!): BatchCommitResult!
    
    # From claude service
    executeCommand(input: ClaudeExecuteInput!): ClaudeExecuteResult!
    generateCommitMessages(input: BatchCommitMessageInput!): BatchCommitMessageResult!
    generateExecutiveSummary(input: ExecutiveSummaryInput!): ExecutiveSummaryResult!
  }
  
  type Subscription {
    # From claude service
    commandOutput(sessionId: ID!): CommandOutput!
  }
  
  # Types (simplified for now)
  type GitStatus {
    branch: String!
    isDirty: Boolean!
    files: [FileStatus!]!
    ahead: Int!
    behind: Int!
    hasRemote: Boolean!
    stashes: [Stash!]!
  }
  
  type FileStatus {
    path: String!
    status: String!
    statusDescription: String!
    isStaged: Boolean!
  }
  
  type Stash {
    index: Int!
    message: String!
    timestamp: String!
  }
  
  type RepositoryScan {
    name: String!
    path: String!
    isDirty: Boolean!
    branch: String!
    uncommittedCount: Int!
    type: RepositoryType!
  }
  
  enum RepositoryType {
    REGULAR
    SUBMODULE
    BARE
    WORKTREE
  }
  
  type DetailedScanReport {
    repositories: [DetailedRepository!]!
    statistics: ScanStatistics!
    metadata: ScanMetadata!
  }
  
  type ScanStatistics {
    totalRepositories: Int!
    dirtyRepositories: Int!
    totalUncommittedFiles: Int!
    totalAdditions: Int!
    totalDeletions: Int!
    changesByType: ChangesByType!
  }
  
  type ChangesByType {
    modified: Int!
    added: Int!
    deleted: Int!
    renamed: Int!
    untracked: Int!
  }
  
  type ScanMetadata {
    startTime: String!
    endTime: String!
    duration: Int!
    workspaceRoot: String!
  }
  
  type DetailedRepository {
    name: String!
    path: String!
    status: GitStatus!
    stagedDiff: String
    unstagedDiff: String
    recentCommits: [Commit!]!
    remotes: [Remote!]!
    config: RepositoryConfig!
  }
  
  type Commit {
    hash: String!
    message: String!
    author: String!
    authorEmail: String!
    timestamp: String!
  }
  
  type Remote {
    name: String!
    fetchUrl: String!
    pushUrl: String!
  }
  
  type RepositoryConfig {
    defaultBranch: String!
    isBare: Boolean!
    isShallow: Boolean!
  }
  
  type ClaudeSession {
    id: ID!
    status: String!
    createdAt: String!
  }
  
  type HealthStatus {
    status: String!
    claudeAvailable: Boolean!
  }
  
  type GitCommandResult {
    success: Boolean!
    output: String
    error: String
  }
  
  type CommitResult {
    success: Boolean!
    commitHash: String
    error: String
    repository: String!
    committedFiles: [String!]!
  }
  
  type RepositoryCleanStatus {
    isClean: Boolean!
    uncommittedFiles: Int!
    latestCommitHash: String!
    repository: String!
  }
  
  type CommitInfo {
    hash: String!
    shortHash: String!
    message: String!
    author: String!
    timestamp: String!
    repository: String!
  }
  
  type ClaudeExecuteResult {
    sessionId: String!
    status: String!
    output: String
    error: String
  }
  
  type BatchCommitMessageResult {
    totalRepositories: Int!
    successCount: Int!
    results: [CommitMessageResult!]!
    totalTokenUsage: TokenUsage!
    executionTime: Int!
  }
  
  type CommitMessageResult {
    repositoryPath: String!
    repositoryName: String!
    success: Boolean!
    message: String
    error: String
    confidence: Float
    commitType: String
  }
  
  type TokenUsage {
    inputTokens: Int!
    outputTokens: Int!
    estimatedCost: Float!
  }
  
  type CommandOutput {
    type: String!
    content: String!
    timestamp: String!
  }
  
  # Input types
  input GitCommandInput {
    command: String!
    args: [String!]!
    cwd: String!
  }
  
  input CommitInput {
    repository: String!
    message: String!
    files: [String!]
    stageAll: Boolean
    author: String
    authorEmail: String
  }
  
  input ClaudeExecuteInput {
    command: String!
    args: [String!]!
    projectPath: String!
  }
  
  input BatchCommitMessageInput {
    repositories: [RepositoryInput!]!
    styleGuide: CommitStyleGuide
    globalContext: String
    analyzeRelationships: Boolean
  }
  
  input CommitStyleGuide {
    format: String
    maxLength: Int
    includeScope: Boolean
    includeBody: Boolean
    examples: [String!]
  }
  
  input RepositoryInput {
    path: String!
    name: String!
    diff: String!
    filesChanged: [String!]!
    recentCommits: [String!]
    context: String
  }
  
  input BatchCommitInput {
    commits: [CommitInput!]!
    continueOnError: Boolean
  }
  
  type BatchCommitResult {
    totalRepositories: Int!
    successCount: Int!
    results: [CommitResult!]!
    executionTime: Int!
  }
  
  input ExecutiveSummaryInput {
    commitMessages: [CommitMessageInput!]!
    audience: String
    maxLength: Int
    focusAreas: [String!]
    includeRiskAssessment: Boolean
    includeRecommendations: Boolean
  }
  
  input CommitMessageInput {
    repository: String!
    message: String!
    stats: ChangeStats
  }
  
  input ChangeStats {
    filesChanged: Int!
    additions: Int!
    deletions: Int!
  }
  
  type ExecutiveSummaryResult {
    success: Boolean!
    summary: String
    error: String
    metadata: SummaryMetadata!
  }
  
  type SummaryMetadata {
    repositoryCount: Int!
    totalChanges: Int!
    themes: [Theme!]!
    riskLevel: String!
    suggestedActions: [String!]!
  }
  
  type Theme {
    name: String!
    description: String!
    affectedRepositories: [String!]!
    impact: String!
  }
`;

// Proxy resolvers that forward to downstream services
const resolvers = {
  Query: {
    gitStatus: async (_: any, args: any) => {
      const response = await fetch('http://127.0.0.1:3004/graphql', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          query: `query GetGitStatus($path: String!) {
            gitStatus(path: $path) {
              branch
              files { path status staged }
              hasChanges
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
              path name hasChanges branch
            }
          }`
        })
      });
      const result = await response.json();
      return result.data?.scanAllRepositories || [];
    },
    
    scanAllDetailed: async () => {
      try {
        const response = await fetch('http://127.0.0.1:3004/graphql', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            query: `query {
              scanAllDetailed {
                repositories {
                  name
                  path
                  status {
                    branch
                    isDirty
                    files {
                      path
                      status
                      statusDescription
                      isStaged
                    }
                    ahead
                    behind
                    hasRemote
                    stashes {
                      index
                      message
                      timestamp
                    }
                  }
                  stagedDiff
                  unstagedDiff
                  recentCommits {
                    hash
                    message
                    author
                    authorEmail
                    timestamp
                  }
                  remotes {
                    name
                    fetchUrl
                    pushUrl
                  }
                  config {
                    defaultBranch
                    isBare
                    isShallow
                  }
                }
                statistics {
                  totalRepositories
                  dirtyRepositories
                  totalUncommittedFiles
                  totalAdditions
                  totalDeletions
                  changesByType {
                    modified
                    added
                    deleted
                    renamed
                    untracked
                  }
                }
                metadata {
                  startTime
                  endTime
                  duration
                  workspaceRoot
                }
              }
            }`
          })
        });
        const result = await response.json();
        return result.data?.scanAllDetailed || {
          repositories: [],
          statistics: {
            totalRepositories: 0,
            dirtyRepositories: 0,
            totalUncommittedFiles: 0,
            totalAdditions: 0,
            totalDeletions: 0,
            changesByType: {
              modified: 0,
              added: 0,
              deleted: 0,
              renamed: 0,
              untracked: 0
            }
          },
          metadata: {
            startTime: new Date().toISOString(),
            endTime: new Date().toISOString(),
            duration: 0,
            workspaceRoot: '/'
          }
        };
      } catch (error) {
        console.error('Error fetching scanAllDetailed:', error);
        return {
          repositories: [],
          statistics: {
            totalRepositories: 0,
            dirtyRepositories: 0,
            totalUncommittedFiles: 0,
            totalAdditions: 0,
            totalDeletions: 0,
            changesByType: {
              modified: 0,
              added: 0,
              deleted: 0,
              renamed: 0,
              untracked: 0
            }
          },
          metadata: {
            startTime: new Date().toISOString(),
            endTime: new Date().toISOString(),
            duration: 0,
            workspaceRoot: '/'
          }
        };
      }
    },
    
    sessions: async () => {
      const response = await fetch('http://127.0.0.1:3002/graphql', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          query: `query {
            sessions {
              id status createdAt
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
                status claudeAvailable
              }
            }`
          })
        });
        const result = await response.json();
        return result.data?.health || { status: 'error', claudeAvailable: false };
      } catch (error) {
        console.error('Error fetching health:', error);
        return { status: 'error', claudeAvailable: false };
      }
    },
    
    isRepositoryClean: async (_: any, args: any) => {
      const response = await fetch('http://127.0.0.1:3004/graphql', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          query: `query IsRepositoryClean($path: String!) {
            isRepositoryClean(path: $path) {
              isClean
              uncommittedFiles
              latestCommitHash
              repository
            }
          }`,
          variables: { path: args.path }
        })
      });
      const result = await response.json();
      return result.data?.isRepositoryClean;
    },
    
    latestCommit: async (_: any, args: any) => {
      const response = await fetch('http://127.0.0.1:3004/graphql', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          query: `query LatestCommit($path: String!) {
            latestCommit(path: $path) {
              hash
              shortHash
              message
              author
              timestamp
              repository
            }
          }`,
          variables: { path: args.path }
        })
      });
      const result = await response.json();
      return result.data?.latestCommit;
    }
  },
  
  Mutation: {
    executeGitCommand: async (_: any, args: any) => {
      const response = await fetch('http://127.0.0.1:3004/graphql', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          query: `mutation ExecuteGitCommand($input: GitCommandInput!) {
            executeGitCommand(input: $input) {
              success output error
            }
          }`,
          variables: { input: args.input }
        })
      });
      const result = await response.json();
      return result.data?.executeGitCommand;
    },
    
    generateCommitMessages: async (_: any, args: any) => {
      try {
        // Create AbortController with 2 minute timeout for Claude operations
        const controller = new AbortController();
        const timeoutId = setTimeout(() => controller.abort(), 120000);
        
        const response = await fetch('http://127.0.0.1:3002/graphql', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          signal: controller.signal,
          body: JSON.stringify({
            query: `mutation GenerateCommitMessages($input: BatchCommitMessageInput!) {
              generateCommitMessages(input: $input) {
                totalRepositories
                successCount
                results {
                  repositoryPath
                  repositoryName
                  success
                  message
                  error
                  confidence
                  commitType
                }
                totalTokenUsage {
                  inputTokens
                  outputTokens
                  estimatedCost
                }
                executionTime
              }
            }`,
            variables: { input: args.input }
          })
        });
        
        clearTimeout(timeoutId);
        
        if (!response.ok) {
          throw new Error(`HTTP error! status: ${response.status}`);
        }
        
        const result = await response.json();
        console.log('Gateway: generateCommitMessages response:', result);
        if (result.errors) {
          console.error('Gateway: GraphQL errors:', result.errors);
          throw new Error(result.errors[0]?.message || 'GraphQL error');
        }
        if (!result.data || !result.data.generateCommitMessages) {
          console.error('Gateway: No data in result:', result);
          // Return a default error response instead of null
          return {
            totalRepositories: 0,
            successCount: 0,
            results: [],
            totalTokenUsage: { inputTokens: 0, outputTokens: 0, estimatedCost: 0 },
            executionTime: 0
          };
        }
        return result.data.generateCommitMessages;
      } catch (error) {
        console.error('Gateway: Error calling generateCommitMessages:', error);
        // Return error response instead of throwing
        return {
          totalRepositories: 0,
          successCount: 0,
          results: [],
          totalTokenUsage: { inputTokens: 0, outputTokens: 0, estimatedCost: 0 },
          executionTime: 0
        };
      }
    },
    
    generateExecutiveSummary: async (_: any, args: any) => {
      console.log('Gateway: generateExecutiveSummary called with:', JSON.stringify(args.input));
      try {
        // Create AbortController with 2 minute timeout for Claude operations
        const controller = new AbortController();
        const timeoutId = setTimeout(() => controller.abort(), 120000);
        
        console.log('Gateway: Calling Claude service at http://127.0.0.1:3002/graphql');
        const response = await fetch('http://127.0.0.1:3002/graphql', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          signal: controller.signal,
          body: JSON.stringify({
            query: `mutation GenerateExecutiveSummary($input: ExecutiveSummaryInput!) {
              generateExecutiveSummary(input: $input) {
                success
                summary
                error
                metadata {
                  repositoryCount
                  totalChanges
                  themes {
                    name
                    description
                    affectedRepositories
                    impact
                  }
                  riskLevel
                  suggestedActions
                }
              }
            }`,
            variables: { input: args.input }
          })
        });
        
        clearTimeout(timeoutId);
        
        if (!response.ok) {
          throw new Error(`HTTP error! status: ${response.status}`);
        }
        
        const result = await response.json();
        console.log('Gateway: generateExecutiveSummary response:', JSON.stringify(result).substring(0, 200));
        if (result.errors) {
          console.error('Gateway: GraphQL errors:', result.errors);
          throw new Error(result.errors[0]?.message || 'GraphQL error');
        }
        if (!result.data || !result.data.generateExecutiveSummary) {
          console.error('Gateway: No data in result:', JSON.stringify(result).substring(0, 500));
          // Return a default error response instead of null
          return {
            success: false,
            summary: null,
            error: 'Failed to generate executive summary - no data returned',
            metadata: {
              repositoryCount: 0,
              totalChanges: 0,
              themes: [],
              riskLevel: 'UNKNOWN',
              suggestedActions: []
            }
          };
        }
        return result.data.generateExecutiveSummary;
      } catch (error) {
        console.error('Gateway: Error calling generateExecutiveSummary:', error);
        // Return error response instead of throwing
        return {
          success: false,
          summary: null,
          error: error instanceof Error ? error.message : 'Unknown error',
          metadata: {
            repositoryCount: 0,
            totalChanges: 0,
            themes: [],
            riskLevel: 'UNKNOWN',
            suggestedActions: []
          }
        };
      }
    },
    
    batchCommit: async (_: any, args: any) => {
      const response = await fetch('http://127.0.0.1:3004/graphql', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          query: `mutation BatchCommit($input: BatchCommitInput!) {
            batchCommit(input: $input) {
              totalRepositories
              successCount
              results {
                success
                commitHash
                error
                repository
                committedFiles
              }
              executionTime
            }
          }`,
          variables: { input: args.input }
        })
      });
      const result = await response.json();
      return result.data?.batchCommit || {
        totalRepositories: 0,
        successCount: 0,
        results: [],
        executionTime: 0
      };
    }
  }
};

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

  // Register websocket support
  await app.register(websocket);

  // CORS support
  await app.register(import('@fastify/cors'), {
    origin: true, // Allow all origins in development
    credentials: true,
    methods: ['GET', 'POST', 'OPTIONS'],
    allowedHeaders: ['Content-Type', 'Authorization']
  });

  // Health check
  app.get('/health', async () => {
    return {
      status: 'healthy',
      service: 'meta-gothic-gateway',
      timestamp: new Date().toISOString()
    };
  });

  // Register GraphQL
  await app.register(mercurius, {
    schema,
    resolvers,
    graphiql: true
  });

  try {
    await app.listen({ port: PORT as number, host: HOST });
    app.log.info(`🌐 Simple Gateway ready at http://${HOST}:${PORT}/graphql`);
    app.log.info(`🚀 GraphiQL available at http://${HOST}:${PORT}/graphiql`);
  } catch (err) {
    app.log.error(err);
    process.exit(1);
  }
}

start().catch((err) => {
  console.error('Failed to start gateway:', err);
  process.exit(1);
});