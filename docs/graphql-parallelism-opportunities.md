# GraphQL Parallelism Opportunities

## Current Sequential Operations

Looking at the git-server logs and the code, here are the current sequential operations that could benefit from parallelism:

### 1. Repository Scanning (Already Parallel ✅)
```
Line 25-35: Parallel git status calls for all repositories
Line 73-90: Parallel tracking branch resolution
Line 82-90: Parallel git log calls
```

### 2. Commit Message Generation (Currently Sequential ❌)
The `/api/claude/batch-commit-messages` endpoint processes each repository sequentially:
```javascript
for (const repo of repositories) {
  const prompt = generateCommitMessagePrompt(repo);
  const message = await callClaude(prompt); // Sequential!
  commitMessages[repo.name] = message;
}
```

### 3. Executive Summary (Single Call ✅)
Already efficient as a single operation.

## GraphQL Parallelism Opportunities

### 1. **Parallel Mutations for Commit Messages**
Instead of a single batch endpoint, GraphQL can execute multiple mutations in parallel:

```graphql
mutation GenerateMultipleCommitMessages {
  msg1: generateCommitMessage(input: { repository: "ui-components", ... }) {
    message
    confidence
  }
  msg2: generateCommitMessage(input: { repository: "meta-gothic", ... }) {
    message
    confidence
  }
  # ... more parallel mutations
}
```

### 2. **Parallel Queries for Repository Data**
Fetch multiple repository details simultaneously:

```graphql
query GetMultipleRepositories {
  repo1: repositoryDetails(path: "/path/to/repo1") {
    ...RepoDetails
  }
  repo2: repositoryDetails(path: "/path/to/repo2") {
    ...RepoDetails
  }
  # ... more parallel queries
}
```

### 3. **Streaming Subscriptions**
For real-time progress updates:

```graphql
subscription CommitMessageGeneration {
  commitMessageProgress(sessionId: "123") {
    repository
    status
    message
    progress
  }
}
```

## Implementation Strategy

### Phase 1: Update Claude Service for Parallel Processing

```typescript
// claude-service/src/resolvers/mutations/generateCommitMessage.ts
export async function generateCommitMessageResolver(
  parent: unknown,
  args: { input: CommitMessageInput },
  context: Context
) {
  // Each resolver instance runs independently
  // GraphQL executor handles parallelism
  const { sessionManager } = context;
  
  return sessionManager.generateCommitMessage(args.input);
}
```

### Phase 2: Implement Concurrent Session Management

```typescript
// claude-service/src/services/ClaudeSessionManager.ts
import PQueue from 'p-queue';

export class ClaudeSessionManager {
  private queue: PQueue;
  
  constructor() {
    // Limit concurrent Claude processes
    this.queue = new PQueue({ 
      concurrency: 5, // Adjust based on system resources
      interval: 1000,
      intervalCap: 3  // Rate limiting
    });
  }
  
  async generateCommitMessage(input: CommitMessageInput) {
    return this.queue.add(async () => {
      // Spawn Claude process
      const result = await this.spawnClaude(input);
      return result;
    });
  }
}
```

### Phase 3: Update UI to Use Parallel GraphQL

```typescript
// ui-components/src/services/graphqlChangeReviewService.ts
import { gql } from '@apollo/client';

const PARALLEL_COMMIT_MESSAGES = gql`
  mutation GenerateCommitMessages($inputs: [CommitMessageInput!]!) {
    commitMessages: generateCommitMessagesParallel(inputs: $inputs) {
      repository
      message
      confidence
      error
    }
  }
`;

// Or use field aliases for true parallelism
function buildParallelQuery(repositories: Repository[]) {
  const fields = repositories.map((repo, i) => `
    msg${i}: generateCommitMessage(input: {
      repository: "${repo.name}",
      diff: """${repo.diff}""",
      recentCommits: ${JSON.stringify(repo.recentCommits)}
    }) {
      message
      confidence
    }
  `).join('\n');
  
  return gql`
    mutation GenerateParallel {
      ${fields}
    }
  `;
}
```

### Phase 4: Add Progress Tracking

```typescript
// Use subscriptions for real-time progress
const PROGRESS_SUBSCRIPTION = gql`
  subscription OnCommitMessageProgress($sessionId: ID!) {
    commitMessageProgress(sessionId: $sessionId) {
      repository
      status
      progress
      estimatedTime
    }
  }
`;
```

## Performance Benefits

### Current (Sequential):
- 10 repositories × 3 seconds each = 30 seconds total

### With Parallelism (5 concurrent):
- 10 repositories ÷ 5 concurrent = 2 batches × 3 seconds = 6 seconds total
- **5x faster!**

### Additional Benefits:
1. **Better Resource Utilization**: Multiple CPU cores used effectively
2. **Improved UX**: Real-time progress updates via subscriptions
3. **Graceful Degradation**: Individual failures don't block entire batch
4. **Rate Limiting**: Built-in queue management prevents overwhelming Claude

## Other Parallelism Opportunities

### 1. **Git Operations**
```graphql
mutation ParallelGitOps {
  commit1: commitChanges(input: { path: "/repo1", message: "..." }) { success }
  commit2: commitChanges(input: { path: "/repo2", message: "..." }) { success }
  push1: pushChanges(input: { path: "/repo1" }) { success }
  push2: pushChanges(input: { path: "/repo2" }) { success }
}
```

### 2. **File Analysis**
```graphql
query ParallelFileAnalysis {
  file1: analyzeFile(path: "/src/index.ts") { complexity, suggestions }
  file2: analyzeFile(path: "/src/utils.ts") { complexity, suggestions }
}
```

### 3. **Dependency Checking**
```graphql
query ParallelDependencyCheck {
  pkg1: checkDependencies(package: "ui-components") { outdated, vulnerabilities }
  pkg2: checkDependencies(package: "claude-client") { outdated, vulnerabilities }
}
```

## Implementation Priority

1. **High Priority**: Parallel commit message generation (biggest bottleneck)
2. **Medium Priority**: Parallel git operations (commit/push)
3. **Low Priority**: File analysis and other operations

## Configuration Management ✅ COMPLETE

### User Preferences Page
A dedicated configuration page has been implemented to allow users to customize parallelism and automation settings:

**Completed Implementation:**
- ✅ GraphQL Schema created at `/services/meta-gothic-app/schema/config.graphql`
- ✅ Resolvers implemented with localStorage persistence
- ✅ Config UI page at `/config` with real-time saving
- ✅ Keyboard shortcut (Cmd+,) for quick access
- ✅ Navigation link added to main menu

```graphql
type UserConfig {
  id: ID!
  parallelism: ParallelismConfig!
  automation: AutomationConfig!
  createdAt: String!
  updatedAt: String!
}

type ParallelismConfig {
  # Number of concurrent Claude agents (1-10)
  concurrentAgents: Int!
  # Number of concurrent shell processes (1-20)  
  concurrentShells: Int!
  # Enable parallel git operations
  enableParallelGit: Boolean!
  # Batch size for processing repositories
  batchSize: Int!
}

type AutomationConfig {
  # Auto-commit after generating messages
  autoCommit: Boolean!
  # Auto-push after successful commits
  autoPush: Boolean!
  # Auto-retry failed operations
  autoRetry: Boolean!
  # Number of retry attempts (0-10)
  maxRetries: Int!
  # Skip confirmation dialogs
  skipConfirmations: Boolean!
}
```

### Configuration UI Components ✅ IMPLEMENTED
The configuration page provides a comprehensive UI for managing parallelism and automation settings:

**Features:**
- Number inputs with validation for concurrent agents (1-10) and shells (1-20)
- Toggle switches for automation preferences
- Real-time saving with 1-second debouncing
- Reset to defaults functionality
- Dark mode support
- Keyboard shortcuts display

Access the configuration page:
- Navigate to `/config` in the UI
- Use keyboard shortcut `Cmd+,` (or `Ctrl+,` on Windows/Linux)
- Click the "Config" link in the navigation menu

### Dynamic Parallelism Based on Config
```typescript
// claude-service/src/services/ClaudeSessionManager.ts
export class ClaudeSessionManager {
  private queue: PQueue;
  
  constructor(private config: UserConfig) {
    this.queue = new PQueue({ 
      concurrency: config.parallelism.maxConcurrentAgents,
      interval: 60000 / config.parallelism.requestsPerMinute,
      intervalCap: 1
    });
  }
  
  async updateConfig(newConfig: UserConfig) {
    this.config = newConfig;
    this.queue.concurrency = newConfig.parallelism.maxConcurrentAgents;
  }
}
```

## Agent Run Management

### Run Status and History
Each Claude agent run should be tracked with detailed status and output:

```graphql
type AgentRun {
  id: ID!
  repository: String!
  status: RunStatus!
  startedAt: DateTime!
  completedAt: DateTime
  duration: Int
  input: AgentInput!
  output: AgentOutput
  error: RunError
  retryCount: Int!
  parentRunId: ID
}

enum RunStatus {
  QUEUED
  RUNNING
  SUCCESS
  FAILED
  CANCELLED
  RETRYING
}

type AgentInput {
  prompt: String!
  diff: String!
  recentCommits: [String!]!
  model: String!
  temperature: Float!
}

type AgentOutput {
  message: String!
  confidence: Float!
  reasoning: String
  rawResponse: String!
  tokensUsed: Int!
}

type RunError {
  code: String!
  message: String!
  stackTrace: String
  recoverable: Boolean!
}

# Queries for run management
type Query {
  # Get specific run details
  agentRun(id: ID!): AgentRun
  
  # List all runs with filtering
  agentRuns(
    status: RunStatus
    repository: String
    startDate: DateTime
    endDate: DateTime
    limit: Int = 20
    offset: Int = 0
  ): AgentRunConnection!
  
  # Get runs for a specific repository
  repositoryRuns(repository: String!): [AgentRun!]!
}

# Mutations for run control
type Mutation {
  # Retry a failed run
  retryAgentRun(runId: ID!): AgentRun!
  
  # Cancel a running agent
  cancelAgentRun(runId: ID!): AgentRun!
  
  # Retry all failed runs in a batch
  retryFailedRuns(runIds: [ID!]!): [AgentRun!]!
}

# Real-time updates
type Subscription {
  # Subscribe to run status changes
  agentRunUpdates(runId: ID!): AgentRun!
  
  # Subscribe to all run updates
  allAgentRunUpdates: AgentRun!
}
```

### Agent Status UI Components
```typescript
// ui-components/src/pages/AgentStatus.tsx
export function AgentStatusPage() {
  const { data: runs, refetch } = useAgentRuns();
  const [selectedRun, setSelectedRun] = useState<string | null>(null);
  
  return (
    <div className="grid grid-cols-12 gap-4">
      {/* Run List */}
      <div className="col-span-4">
        <RunList 
          runs={runs}
          onSelectRun={setSelectedRun}
          onRetry={handleRetry}
        />
      </div>
      
      {/* Run Details */}
      <div className="col-span-8">
        {selectedRun && (
          <RunDetails runId={selectedRun} />
        )}
      </div>
    </div>
  );
}

// Component for individual run details
export function RunDetails({ runId }: { runId: string }) {
  const { data: run } = useAgentRun(runId);
  const [showRawOutput, setShowRawOutput] = useState(false);
  const retryMutation = useRetryRun();
  
  return (
    <div className="space-y-4">
      {/* Status Header */}
      <div className="flex justify-between items-center">
        <h2>{run.repository}</h2>
        <StatusBadge status={run.status} />
      </div>
      
      {/* Timing Info */}
      <div className="grid grid-cols-3 gap-4">
        <InfoCard
          label="Started"
          value={formatTime(run.startedAt)}
        />
        <InfoCard
          label="Duration"
          value={`${run.duration}ms`}
        />
        <InfoCard
          label="Tokens Used"
          value={run.output?.tokensUsed || 'N/A'}
        />
      </div>
      
      {/* Input Section */}
      <CollapsibleSection title="Input">
        <pre className="bg-gray-100 p-4 rounded overflow-auto">
          {run.input.prompt}
        </pre>
      </CollapsibleSection>
      
      {/* Output Section */}
      {run.output && (
        <CollapsibleSection title="Output">
          <div className="space-y-2">
            <p className="font-medium">Generated Message:</p>
            <pre className="bg-green-50 p-4 rounded">
              {run.output.message}
            </pre>
            <p className="text-sm text-gray-600">
              Confidence: {(run.output.confidence * 100).toFixed(1)}%
            </p>
          </div>
        </CollapsibleSection>
      )}
      
      {/* Error Section */}
      {run.error && (
        <CollapsibleSection title="Error Details" defaultOpen>
          <div className="bg-red-50 p-4 rounded space-y-2">
            <p className="font-medium text-red-800">
              {run.error.code}: {run.error.message}
            </p>
            {run.error.stackTrace && (
              <details>
                <summary className="cursor-pointer text-sm">
                  Stack Trace
                </summary>
                <pre className="text-xs mt-2 overflow-auto">
                  {run.error.stackTrace}
                </pre>
              </details>
            )}
          </div>
        </CollapsibleSection>
      )}
      
      {/* Raw Output Toggle */}
      <CollapsibleSection 
        title="Raw Claude Response" 
        defaultOpen={false}
      >
        <pre className="bg-gray-100 p-4 rounded text-xs overflow-auto max-h-96">
          {run.output?.rawResponse || 'No output available'}
        </pre>
      </CollapsibleSection>
      
      {/* Actions */}
      <div className="flex gap-2">
        {run.status === 'FAILED' && run.error?.recoverable && (
          <button
            onClick={() => retryMutation.mutate(runId)}
            className="px-4 py-2 bg-blue-500 text-white rounded"
          >
            Retry Run
          </button>
        )}
        {run.status === 'RUNNING' && (
          <button
            onClick={() => cancelRun(runId)}
            className="px-4 py-2 bg-red-500 text-white rounded"
          >
            Cancel Run
          </button>
        )}
      </div>
    </div>
  );
}
```

### Persistent Run Storage
```typescript
// claude-service/src/services/RunStorage.ts
export class RunStorage {
  private runs: Map<string, AgentRun> = new Map();
  
  async saveRun(run: AgentRun): Promise<void> {
    this.runs.set(run.id, run);
    // Persist to database/file in production
    await this.persistToStorage(run);
  }
  
  async getRun(id: string): Promise<AgentRun | null> {
    return this.runs.get(id) || null;
  }
  
  async getRunsByRepository(repository: string): Promise<AgentRun[]> {
    return Array.from(this.runs.values())
      .filter(run => run.repository === repository)
      .sort((a, b) => b.startedAt.getTime() - a.startedAt.getTime());
  }
  
  async retryRun(runId: string): Promise<AgentRun> {
    const originalRun = await this.getRun(runId);
    if (!originalRun) throw new Error('Run not found');
    
    const newRun: AgentRun = {
      id: generateId(),
      ...originalRun,
      status: 'QUEUED',
      retryCount: originalRun.retryCount + 1,
      parentRunId: runId,
      startedAt: new Date(),
      completedAt: null,
      output: null,
      error: null
    };
    
    await this.saveRun(newRun);
    // Queue for processing
    await this.queueRun(newRun);
    
    return newRun;
  }
}
```

### Enhanced Session Manager with Run Tracking
```typescript
// claude-service/src/services/ClaudeSessionManager.ts
export class ClaudeSessionManager {
  constructor(
    private config: UserConfig,
    private runStorage: RunStorage
  ) {}
  
  async generateCommitMessage(input: CommitMessageInput): Promise<AgentRun> {
    const run: AgentRun = {
      id: generateId(),
      repository: input.repository,
      status: 'QUEUED',
      startedAt: new Date(),
      input: {
        prompt: input.prompt,
        diff: input.diff,
        recentCommits: input.recentCommits,
        model: this.config.claude.preferredModel,
        temperature: this.config.claude.temperature
      },
      retryCount: 0
    };
    
    await this.runStorage.saveRun(run);
    
    return this.queue.add(async () => {
      try {
        run.status = 'RUNNING';
        await this.runStorage.saveRun(run);
        
        const result = await this.spawnClaude(run.input);
        
        run.status = 'SUCCESS';
        run.completedAt = new Date();
        run.duration = run.completedAt.getTime() - run.startedAt.getTime();
        run.output = {
          message: result.message,
          confidence: result.confidence,
          reasoning: result.reasoning,
          rawResponse: result.raw,
          tokensUsed: result.tokensUsed
        };
        
        await this.runStorage.saveRun(run);
        return run;
        
      } catch (error) {
        run.status = 'FAILED';
        run.completedAt = new Date();
        run.duration = run.completedAt.getTime() - run.startedAt.getTime();
        run.error = {
          code: error.code || 'UNKNOWN',
          message: error.message,
          stackTrace: error.stack,
          recoverable: this.isRecoverable(error)
        };
        
        await this.runStorage.saveRun(run);
        throw error;
      }
    });
  }
}
```

## Next Steps

### ✅ Completed (January 6, 2025)
1. ✅ Create configuration GraphQL schema and resolvers
2. ✅ Implement user preferences storage (localStorage initially, database later)
3. ✅ Build configuration UI page with real-time preview

### ✅ Completed (January 6, 2025) - Part 2
4. ✅ **Agent Run Storage Infrastructure** - Implement RunStorage service for persistent run history
   - File-based storage with JSON persistence
   - Full CRUD operations and retry functionality
   - Statistics and cleanup job implementation
   - Database schema designed for future migration
5. ✅ **Concurrent Session Management** - Update `ClaudeSessionManager` to support concurrent operations with run tracking
   - Integrated RunStorage with ClaudeSessionManager
   - Full run lifecycle tracking (QUEUED → RUNNING → SUCCESS/FAILED)
   - Automatic cleanup job running every 24 hours
   - Support for parallel execution with p-queue

### ✅ Completed (January 6, 2025) - Part 3
6. ✅ **Agent Status UI** - Create Agent Status UI page with run details and retry functionality
   - Split-view layout with run list and detailed view
   - Run statistics dashboard with success rate and performance metrics
   - Collapsible sections for input/output/error details
   - One-click retry functionality for failed runs
   - Status filtering and repository filtering
   - Mock API endpoints for development

### 📋 Upcoming
7. Implement parallel-friendly GraphQL resolvers
8. Update UI to use parallel queries/mutations
9. Add progress tracking via subscriptions
10. Implement dynamic rate limiting based on user config

## Current Sprint Progress

### Phase 1: Configuration Management System ✅ COMPLETE
- GraphQL schema defined
- Resolvers with localStorage persistence
- Full-featured Config UI page at `/config`
- Keyboard shortcuts and navigation integration
- Ready for integration with parallel execution features

### Phase 2: Agent Run Storage Infrastructure ✅ COMPLETE
**What was implemented:**
- **RunStorage Service** (`/services/claude-service/src/services/RunStorage.ts`)
  - File-based persistence to `/logs/claude-runs/` directory
  - Complete CRUD operations for agent runs
  - Run statistics and performance metrics
  - Retry functionality for failed runs
  
- **GraphQL Schema** (`/services/claude-service/schema/runs.graphql`)
  - Comprehensive schema for AgentRun, RunStatus, RunError types
  - Query operations for fetching runs with filtering
  - Mutations for retry and cancellation
  - Subscription definitions for real-time updates
  
- **ClaudeSessionManager Integration**
  - Full run lifecycle tracking
  - Automatic status updates (QUEUED → RUNNING → SUCCESS/FAILED)
  - Error handling with recoverable error detection
  - Performance metrics (duration, tokens used)
  
- **Automated Cleanup Job**
  - Runs every 24 hours to delete runs older than 30 days
  - Prevents unbounded storage growth
  - Logs statistics after each cleanup
  
- **Database Migration Plan**
  - SQL schema designed for future PostgreSQL/SQLite migration
  - Migration strategy documented
  - Repository pattern prepared for database abstraction

**Storage Details:**
- Currently uses JSON files: `/logs/claude-runs/{runId}.json`
- In-memory Map for fast runtime access
- Suitable for development and moderate usage
- Database migration path clearly defined for production scale

### Phase 3: Agent Status UI ✅ COMPLETE
**What was implemented:**
- **Agent Status Page** (`/packages/ui-components/src/pages/AgentStatus.tsx`)
  - Split-view layout: run list on left, details on right
  - Real-time filtering by status and repository
  - Search functionality for finding specific runs
  
- **Run Statistics Dashboard** (`/components/AgentStatus/RunStatistics.tsx`)
  - Total runs, success rate, average duration
  - Status distribution (queued, running, failed, etc.)
  - Top repositories by run count
  - Visual metrics with icons and badges
  
- **Run Details View** (`/components/AgentStatus/RunDetails.tsx`)
  - Tabbed interface for Output, Input, Raw Response, and Errors
  - Collapsible sections for better organization
  - Copy-to-clipboard functionality for messages and IDs
  - Syntax highlighting for code and diffs
  - Retry button for recoverable failures
  
- **Run List Component** (`/components/AgentStatus/RunList.tsx`)
  - Compact run display with status badges
  - Time ago display using date-fns
  - Quick retry button on failed runs
  - Visual status indicators with icons
  
- **API Integration**
  - Mock endpoints added to git-server.js for development
  - `/api/claude/runs` - Get filtered run history
  - `/api/claude/runs/statistics` - Get aggregated statistics
  - `/api/claude/runs/:id/retry` - Retry failed runs
  
**UI Features:**
- Dark mode support throughout
- Responsive design for different screen sizes
- Loading states and error handling
- Toast notifications for user feedback
- Keyboard navigation support