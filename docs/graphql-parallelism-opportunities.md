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

## Configuration Management

### User Preferences Page
A dedicated configuration page should allow users to customize parallelism and automation settings:

```graphql
type UserConfig {
  parallelism: ParallelismConfig!
  automation: AutomationConfig!
  claude: ClaudeConfig!
}

type ParallelismConfig {
  # Number of concurrent Claude agents for commit message generation
  maxConcurrentAgents: Int!
  # Number of parallel shell processes for git operations
  maxConcurrentShells: Int!
  # Rate limiting for API calls
  requestsPerMinute: Int!
}

type AutomationConfig {
  # Auto-commit after generating messages
  autoCommit: Boolean!
  # Auto-push after successful commits
  autoPush: Boolean!
  # Batch size for processing repositories
  batchSize: Int!
}

type ClaudeConfig {
  # Model preference (claude-3-opus, claude-3-sonnet, etc.)
  preferredModel: String!
  # Temperature for commit message generation
  temperature: Float!
  # Max tokens per request
  maxTokens: Int!
}
```

### Configuration UI Components
```typescript
// ui-components/src/pages/Config.tsx
export function ConfigPage() {
  const { data: config, mutate } = useUserConfig();
  
  return (
    <div className="space-y-6">
      <section>
        <h2>Parallelism Settings</h2>
        <NumberInput
          label="Concurrent Claude Agents"
          value={config.parallelism.maxConcurrentAgents}
          min={1}
          max={10}
          helperText="Number of Claude processes to run simultaneously"
        />
        <NumberInput
          label="Concurrent Shell Processes"
          value={config.parallelism.maxConcurrentShells}
          min={1}
          max={20}
          helperText="Number of git operations to run in parallel"
        />
      </section>
      
      <section>
        <h2>Automation Preferences</h2>
        <Toggle
          label="Auto-commit after message generation"
          checked={config.automation.autoCommit}
        />
        <Toggle
          label="Auto-push after successful commits"
          checked={config.automation.autoPush}
        />
      </section>
    </div>
  );
}
```

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

1. Create configuration GraphQL schema and resolvers
2. Implement user preferences storage (localStorage initially, database later)
3. Build configuration UI page with real-time preview
4. Implement RunStorage service for persistent run history
5. Create Agent Status UI page with run details and retry functionality
6. Update `ClaudeSessionManager` to support concurrent operations with run tracking
7. Implement parallel-friendly GraphQL resolvers
8. Update UI to use parallel queries/mutations
9. Add progress tracking via subscriptions
10. Implement dynamic rate limiting based on user config