import { GraphQLResolveInfo } from 'graphql';
import { Context } from '../types/context';
export type Maybe<T> = T | null;
export type InputMaybe<T> = Maybe<T>;
export type Exact<T extends { [key: string]: unknown }> = { [K in keyof T]: T[K] };
export type MakeOptional<T, K extends keyof T> = Omit<T, K> & { [SubKey in K]?: Maybe<T[SubKey]> };
export type MakeMaybe<T, K extends keyof T> = Omit<T, K> & { [SubKey in K]: Maybe<T[SubKey]> };
export type MakeEmpty<T extends { [key: string]: unknown }, K extends keyof T> = { [_ in K]?: never };
export type Incremental<T> = T | { [P in keyof T]?: P extends ' $fragmentName' | '__typename' ? T[P] : never };
export type RequireFields<T, K extends keyof T> = Omit<T, K> & { [P in K]-?: NonNullable<T[P]> };
/** All built-in and custom scalars, mapped to their actual values */
export type Scalars = {
  ID: { input: string; output: string; }
  String: { input: string; output: string; }
  Boolean: { input: boolean; output: boolean; }
  Int: { input: number; output: number; }
  Float: { input: number; output: number; }
};

export type AgentInput = {
  __typename?: 'AgentInput';
  diff: Scalars['String']['output'];
  model: Scalars['String']['output'];
  prompt: Scalars['String']['output'];
  recentCommits: Array<Scalars['String']['output']>;
  temperature: Scalars['Float']['output'];
};

export type AgentOutput = {
  __typename?: 'AgentOutput';
  confidence: Scalars['Float']['output'];
  message: Scalars['String']['output'];
  rawResponse: Scalars['String']['output'];
  reasoning: Maybe<Scalars['String']['output']>;
  tokensUsed: Scalars['Int']['output'];
};

export type AgentRun = {
  __typename?: 'AgentRun';
  completedAt: Maybe<Scalars['String']['output']>;
  duration: Maybe<Scalars['Int']['output']>;
  error: Maybe<RunError>;
  id: Scalars['ID']['output'];
  input: AgentInput;
  output: Maybe<AgentOutput>;
  parentRunId: Maybe<Scalars['ID']['output']>;
  repository: Scalars['String']['output'];
  retryCount: Scalars['Int']['output'];
  startedAt: Scalars['String']['output'];
  status: RunStatus;
};

export type AgentRunConnection = {
  __typename?: 'AgentRunConnection';
  runs: Array<AgentRun>;
  total: Scalars['Int']['output'];
};

export type AgentRunProgress = {
  __typename?: 'AgentRunProgress';
  /** Current operation description */
  currentOperation: Maybe<Scalars['String']['output']>;
  /** Error if any occurred */
  error: Maybe<Scalars['String']['output']>;
  /** Estimated time remaining in seconds */
  estimatedTimeRemaining: Maybe<Scalars['Int']['output']>;
  /** Whether this run is complete */
  isComplete: Scalars['Boolean']['output'];
  /** Progress percentage (0-100) */
  percentage: Scalars['Float']['output'];
  /** Repository being processed */
  repository: Scalars['String']['output'];
  /** Run ID this progress update is for */
  runId: Scalars['ID']['output'];
  /** Current stage of processing */
  stage: ProgressStage;
  /** Timestamp of this update */
  timestamp: Scalars['String']['output'];
};

export type BatchCommitMessageInput = {
  /** Whether to analyze relationships between changes */
  analyzeRelationships: InputMaybe<Scalars['Boolean']['input']>;
  /** Additional context for all commits */
  globalContext: InputMaybe<Scalars['String']['input']>;
  /** Repository information for commit message generation */
  repositories: Array<RepositoryCommitInfo>;
  /** Style guide for commit messages */
  styleGuide: InputMaybe<CommitStyleGuide>;
};

export type BatchCommitMessageResult = {
  __typename?: 'BatchCommitMessageResult';
  /** Execution time in milliseconds */
  executionTime: Scalars['Int']['output'];
  /** Individual results per repository */
  results: Array<CommitMessageResult>;
  /** Number of successful generations */
  successCount: Scalars['Int']['output'];
  /** Total repositories processed */
  totalRepositories: Scalars['Int']['output'];
  /** Total token usage */
  totalTokenUsage: TokenUsage;
};

export type BatchProgress = {
  __typename?: 'BatchProgress';
  /** Batch ID for this group of operations */
  batchId: Scalars['ID']['output'];
  /** Number of completed operations */
  completedOperations: Scalars['Int']['output'];
  /** Estimated total time remaining */
  estimatedTimeRemaining: Maybe<Scalars['Int']['output']>;
  /** Number of failed operations */
  failedOperations: Scalars['Int']['output'];
  /** Whether batch is complete */
  isComplete: Scalars['Boolean']['output'];
  /** Overall progress percentage */
  overallPercentage: Scalars['Float']['output'];
  /** Individual run progress */
  runProgress: Array<AgentRunProgress>;
  /** Batch start time */
  startTime: Scalars['String']['output'];
  /** Total number of operations in batch */
  totalOperations: Scalars['Int']['output'];
};

export type ChangeStats = {
  /** Lines added */
  additions: Scalars['Int']['input'];
  /** Lines deleted */
  deletions: Scalars['Int']['input'];
  /** Files changed */
  filesChanged: Scalars['Int']['input'];
};

export type ClaudeExecuteInput = {
  /** Additional context to provide */
  context: InputMaybe<ContextInput>;
  /** Command options */
  options: InputMaybe<CommandOptions>;
  /** The prompt or command to execute */
  prompt: Scalars['String']['input'];
  /** Optional session ID to reuse */
  sessionId: InputMaybe<Scalars['ID']['input']>;
  /** Working directory for the command */
  workingDirectory: InputMaybe<Scalars['String']['input']>;
};

export type ClaudeExecuteResult = {
  __typename?: 'ClaudeExecuteResult';
  /** Error message if failed to start */
  error: Maybe<Scalars['String']['output']>;
  /** Initial response if available immediately */
  initialResponse: Maybe<Scalars['String']['output']>;
  /** Execution metadata */
  metadata: ExecutionMetadata;
  /** Session ID for this execution */
  sessionId: Scalars['ID']['output'];
  /** Whether execution started successfully */
  success: Scalars['Boolean']['output'];
};

export type ClaudeHealthStatus = {
  __typename?: 'ClaudeHealthStatus';
  /** Number of active sessions */
  activeSessions: Scalars['Int']['output'];
  /** Claude CLI availability */
  claudeAvailable: Scalars['Boolean']['output'];
  /** Claude CLI version if available */
  claudeVersion: Maybe<Scalars['String']['output']>;
  /** Whether service is healthy */
  healthy: Scalars['Boolean']['output'];
  /** System resource usage */
  resources: ClaudeResourceUsage;
  /** Service version */
  version: Scalars['String']['output'];
};

export type ClaudeResourceUsage = {
  __typename?: 'ClaudeResourceUsage';
  /** Number of active processes */
  activeProcesses: Scalars['Int']['output'];
  /** CPU usage percentage */
  cpuUsage: Scalars['Float']['output'];
  /** Memory usage in MB */
  memoryUsage: Scalars['Float']['output'];
};

export type ClaudeSession = {
  __typename?: 'ClaudeSession';
  /** Session creation timestamp */
  createdAt: Scalars['String']['output'];
  /** Command history */
  history: Array<CommandHistoryItem>;
  /** Unique session identifier */
  id: Scalars['ID']['output'];
  /** Last activity timestamp */
  lastActivity: Scalars['String']['output'];
  /** Session metadata */
  metadata: SessionMetadata;
  /** Process ID if active */
  pid: Maybe<Scalars['Int']['output']>;
  /** Current session status */
  status: SessionStatus;
  /** Current working directory */
  workingDirectory: Scalars['String']['output'];
};

export type CommandHistoryItem = {
  __typename?: 'CommandHistoryItem';
  /** Execution time in milliseconds */
  executionTime: Scalars['Int']['output'];
  /** The prompt or command sent */
  prompt: Scalars['String']['output'];
  /** Response received */
  response: Maybe<Scalars['String']['output']>;
  /** Whether command succeeded */
  success: Scalars['Boolean']['output'];
  /** Command timestamp */
  timestamp: Scalars['String']['output'];
};

export type CommandOptions = {
  /** Custom flags to pass to Claude CLI */
  customFlags: InputMaybe<Array<Scalars['String']['input']>>;
  /** Maximum response tokens */
  maxTokens: InputMaybe<Scalars['Int']['input']>;
  /** Model to use (if different from default) */
  model: InputMaybe<Scalars['String']['input']>;
  /** Whether to stream output */
  stream: InputMaybe<Scalars['Boolean']['input']>;
  /** Temperature setting */
  temperature: InputMaybe<Scalars['Float']['input']>;
};

export type CommandOutput = {
  __typename?: 'CommandOutput';
  /** The actual output content */
  content: Scalars['String']['output'];
  /** Whether this is the final output */
  isFinal: Scalars['Boolean']['output'];
  /** Session ID this output belongs to */
  sessionId: Scalars['ID']['output'];
  /** Timestamp of this output */
  timestamp: Scalars['String']['output'];
  /** Token count for this output chunk */
  tokens: Maybe<Scalars['Int']['output']>;
  /** Output type */
  type: OutputType;
};

export type CommitMessageInfo = {
  /** Commit message */
  message: Scalars['String']['input'];
  /** Repository name */
  repository: Scalars['String']['input'];
  /** Change statistics */
  stats: InputMaybe<ChangeStats>;
};

export type CommitMessageResult = {
  __typename?: 'CommitMessageResult';
  /** Suggested commit type (feat, fix, chore, etc.) */
  commitType: Maybe<Scalars['String']['output']>;
  /** Confidence score (0-1) */
  confidence: Maybe<Scalars['Float']['output']>;
  /** Error if generation failed */
  error: Maybe<Scalars['String']['output']>;
  /** Generated commit message */
  message: Maybe<Scalars['String']['output']>;
  /** Repository name */
  repositoryName: Scalars['String']['output'];
  /** Repository path */
  repositoryPath: Scalars['String']['output'];
  /** Whether generation succeeded */
  success: Scalars['Boolean']['output'];
};

export type CommitStyleGuide = {
  /** Custom examples */
  examples: InputMaybe<Array<Scalars['String']['input']>>;
  /** Preferred format (conventional, descriptive, etc.) */
  format: InputMaybe<Scalars['String']['input']>;
  /** Whether to include body */
  includeBody: InputMaybe<Scalars['Boolean']['input']>;
  /** Whether to include scope */
  includeScope: InputMaybe<Scalars['Boolean']['input']>;
  /** Maximum message length */
  maxLength: InputMaybe<Scalars['Int']['input']>;
};

export type ContextInput = {
  /** Files to include in context */
  files: InputMaybe<Array<Scalars['String']['input']>>;
  /** Additional instructions */
  instructions: InputMaybe<Scalars['String']['input']>;
  /** Maximum context size in tokens */
  maxTokens: InputMaybe<Scalars['Int']['input']>;
  /** Project-specific context */
  projectContext: InputMaybe<Scalars['String']['input']>;
};

export type ContinueSessionInput = {
  /** Optional additional context */
  additionalContext: InputMaybe<ContextInput>;
  /** New prompt to send */
  prompt: Scalars['String']['input'];
  /** Session ID to continue */
  sessionId: Scalars['ID']['input'];
};

export type ExecutionMetadata = {
  __typename?: 'ExecutionMetadata';
  /** Estimated completion time */
  estimatedTime: Maybe<Scalars['Int']['output']>;
  /** Command flags used */
  flags: Array<Scalars['String']['output']>;
  /** Process ID */
  pid: Maybe<Scalars['Int']['output']>;
  /** When execution started */
  startTime: Scalars['String']['output'];
};

export type ExecutiveSummaryInput = {
  /** Target audience for summary */
  audience: InputMaybe<Scalars['String']['input']>;
  /** Commit messages to summarize */
  commitMessages: Array<CommitMessageInfo>;
  /** Focus areas for summary */
  focusAreas: InputMaybe<Array<Scalars['String']['input']>>;
  /** Whether to include recommendations */
  includeRecommendations: InputMaybe<Scalars['Boolean']['input']>;
  /** Whether to include risk assessment */
  includeRiskAssessment: InputMaybe<Scalars['Boolean']['input']>;
  /** Desired summary length */
  maxLength: InputMaybe<Scalars['Int']['input']>;
};

export type ExecutiveSummaryResult = {
  __typename?: 'ExecutiveSummaryResult';
  /** Error if generation failed */
  error: Maybe<Scalars['String']['output']>;
  /** Summary metadata */
  metadata: SummaryMetadata;
  /** Whether summary generation succeeded */
  success: Scalars['Boolean']['output'];
  /** The generated executive summary */
  summary: Maybe<Scalars['String']['output']>;
};

export type HandoffInput = {
  /** Whether to include full history */
  includeFullHistory: InputMaybe<Scalars['Boolean']['input']>;
  /** Additional notes for handoff */
  notes: InputMaybe<Scalars['String']['input']>;
  /** Session ID to create handoff for */
  sessionId: Scalars['ID']['input'];
  /** Target for handoff (user, team, etc.) */
  target: InputMaybe<Scalars['String']['input']>;
};

export type HandoffResult = {
  __typename?: 'HandoffResult';
  /** Handoff document content */
  content: Maybe<Scalars['String']['output']>;
  /** Path to handoff document */
  documentPath: Maybe<Scalars['String']['output']>;
  /** Error message if failed */
  error: Maybe<Scalars['String']['output']>;
  /** Session state summary */
  sessionSummary: SessionSummary;
  /** Whether handoff document was created successfully */
  success: Scalars['Boolean']['output'];
};

export type ImpactLevel =
  /** Critical impact on core functionality */
  | 'CRITICAL'
  /** Major impact, may break compatibility */
  | 'MAJOR'
  /** Minor impact on functionality */
  | 'MINOR'
  /** Moderate impact, backwards compatible */
  | 'MODERATE';

export type Mutation = {
  __typename?: 'Mutation';
  /** Cancel a running agent */
  cancelAgentRun: AgentRun;
  /** Continue an existing Claude session with a new prompt */
  continueSession: ClaudeExecuteResult;
  /** Create a handoff document for session transfer */
  createHandoff: HandoffResult;
  /** Delete old runs (admin only) */
  deleteOldRuns: Scalars['Int']['output'];
  /** Execute a Claude command in a new or existing session */
  executeCommand: ClaudeExecuteResult;
  /** Generate commit messages for multiple repositories */
  generateCommitMessages: BatchCommitMessageResult;
  /** Generate executive summary from multiple commit messages */
  generateExecutiveSummary: ExecutiveSummaryResult;
  /** Kill an active Claude session */
  killSession: Scalars['Boolean']['output'];
  /** Retry a failed run */
  retryAgentRun: AgentRun;
  /** Retry all failed runs in a batch */
  retryFailedRuns: Array<AgentRun>;
};


export type MutationCancelAgentRunArgs = {
  runId: Scalars['ID']['input'];
};


export type MutationContinueSessionArgs = {
  input: ContinueSessionInput;
};


export type MutationCreateHandoffArgs = {
  input: HandoffInput;
};


export type MutationExecuteCommandArgs = {
  input: ClaudeExecuteInput;
};


export type MutationGenerateCommitMessagesArgs = {
  input: BatchCommitMessageInput;
};


export type MutationGenerateExecutiveSummaryArgs = {
  input: ExecutiveSummaryInput;
};


export type MutationKillSessionArgs = {
  id: Scalars['ID']['input'];
};


export type MutationRetryAgentRunArgs = {
  runId: Scalars['ID']['input'];
};


export type MutationRetryFailedRunsArgs = {
  runIds: Array<Scalars['ID']['input']>;
};

export type OperationMetrics = {
  __typename?: 'OperationMetrics';
  /** Average duration in milliseconds */
  averageDuration: Scalars['Float']['output'];
  /** Number of executions */
  count: Scalars['Int']['output'];
  /** Maximum duration in milliseconds */
  maxDuration: Scalars['Float']['output'];
  /** Minimum duration in milliseconds */
  minDuration: Scalars['Float']['output'];
  /** Operation name */
  operation: Scalars['String']['output'];
  /** 95th percentile duration */
  p95Duration: Scalars['Float']['output'];
  /** 99th percentile duration */
  p99Duration: Scalars['Float']['output'];
  /** Success rate percentage */
  successRate: Scalars['Float']['output'];
  /** Total duration in milliseconds */
  totalDuration: Scalars['Float']['output'];
};

export type OutputType =
  /** Final response */
  | 'FINAL'
  /** Progress update */
  | 'PROGRESS'
  /** Error output */
  | 'STDERR'
  /** Standard output */
  | 'STDOUT'
  /** System message */
  | 'SYSTEM';

export type ParallelComparison = {
  __typename?: 'ParallelComparison';
  /** Efficiency percentage */
  efficiency: Scalars['Float']['output'];
  /** Metrics for parallel execution */
  parallel: Maybe<OperationMetrics>;
  /** Metrics for sequential execution */
  sequential: Maybe<OperationMetrics>;
  /** Speed improvement factor (sequential/parallel) */
  speedup: Scalars['Float']['output'];
};

export type PerformanceReport = {
  __typename?: 'PerformanceReport';
  /** Aggregated metrics by operation */
  operations: Array<OperationMetrics>;
  /** Comparison of parallel vs sequential execution */
  parallelComparison: Maybe<ParallelComparison>;
  /** Time range of the report */
  timeRange: TimeRange;
  /** Total operations tracked */
  totalOperations: Scalars['Int']['output'];
};

export type ProgressStage =
  /** Cancelled by user */
  | 'CANCELLED'
  /** Completed successfully */
  | 'COMPLETED'
  /** Failed with error */
  | 'FAILED'
  /** Initializing Claude session */
  | 'INITIALIZING'
  /** Loading context and files */
  | 'LOADING_CONTEXT'
  /** Parsing response */
  | 'PARSING_RESPONSE'
  /** Processing with Claude */
  | 'PROCESSING'
  /** Queued for processing */
  | 'QUEUED'
  /** Saving results */
  | 'SAVING_RESULTS';

export type Query = {
  __typename?: 'Query';
  /** Get specific run details */
  agentRun: Maybe<AgentRun>;
  /** List all runs with filtering */
  agentRuns: AgentRunConnection;
  /** Check Claude service health and CLI availability */
  claudeHealth: ClaudeHealthStatus;
  /** Get performance metrics for operations */
  performanceMetrics: PerformanceReport;
  /** Get runs for a specific repository */
  repositoryRuns: Array<AgentRun>;
  /** Get run statistics */
  runStatistics: RunStatistics;
  /** Get details of a specific session */
  session: Maybe<ClaudeSession>;
  /** List all active Claude sessions */
  sessions: Array<ClaudeSession>;
};


export type QueryAgentRunArgs = {
  id: Scalars['ID']['input'];
};


export type QueryAgentRunsArgs = {
  endDate: InputMaybe<Scalars['String']['input']>;
  limit?: InputMaybe<Scalars['Int']['input']>;
  offset?: InputMaybe<Scalars['Int']['input']>;
  repository: InputMaybe<Scalars['String']['input']>;
  startDate: InputMaybe<Scalars['String']['input']>;
  status: InputMaybe<RunStatus>;
};


export type QueryPerformanceMetricsArgs = {
  lastMinutes: InputMaybe<Scalars['Int']['input']>;
  operation: InputMaybe<Scalars['String']['input']>;
};


export type QueryRepositoryRunsArgs = {
  repository: Scalars['String']['input'];
};


export type QuerySessionArgs = {
  id: Scalars['ID']['input'];
};

export type RepositoryCommitInfo = {
  /** Additional repository context */
  context: InputMaybe<Scalars['String']['input']>;
  /** Git diff of changes */
  diff: Scalars['String']['input'];
  /** Files changed */
  filesChanged: Array<Scalars['String']['input']>;
  /** Repository name */
  name: Scalars['String']['input'];
  /** Repository path */
  path: Scalars['String']['input'];
  /** Recent commit history for style matching */
  recentCommits: InputMaybe<Array<Scalars['String']['input']>>;
};

export type RepositoryCount = {
  __typename?: 'RepositoryCount';
  count: Scalars['Int']['output'];
  repository: Scalars['String']['output'];
};

export type RiskLevel =
  /** Critical risks requiring immediate action */
  | 'CRITICAL'
  /** Significant risks requiring attention */
  | 'HIGH'
  /** No significant risks identified */
  | 'LOW'
  /** Minor risks that should be monitored */
  | 'MEDIUM';

export type RunError = {
  __typename?: 'RunError';
  code: Scalars['String']['output'];
  message: Scalars['String']['output'];
  recoverable: Scalars['Boolean']['output'];
  stackTrace: Maybe<Scalars['String']['output']>;
};

export type RunStatistics = {
  __typename?: 'RunStatistics';
  averageDuration: Scalars['Float']['output'];
  byRepository: Array<RepositoryCount>;
  byStatus: StatusCount;
  successRate: Scalars['Float']['output'];
  total: Scalars['Int']['output'];
};

export type RunStatus =
  | 'CANCELLED'
  | 'FAILED'
  | 'QUEUED'
  | 'RETRYING'
  | 'RUNNING'
  | 'SUCCESS';

export type SessionMetadata = {
  __typename?: 'SessionMetadata';
  /** Custom flags or options */
  flags: Array<Scalars['String']['output']>;
  /** Model being used */
  model: Scalars['String']['output'];
  /** Project context if loaded */
  projectContext: Maybe<Scalars['String']['output']>;
  /** Token usage statistics */
  tokenUsage: TokenUsage;
};

export type SessionStatus =
  /** Session is active and ready */
  | 'ACTIVE'
  /** Session encountered an error */
  | 'ERROR'
  /** Session is idle */
  | 'IDLE'
  /** Session is processing a command */
  | 'PROCESSING'
  /** Session has been terminated */
  | 'TERMINATED';

export type SessionSummary = {
  __typename?: 'SessionSummary';
  /** Files modified during session */
  filesModified: Array<Scalars['String']['output']>;
  /** Number of interactions in session */
  interactionCount: Scalars['Int']['output'];
  /** Key topics discussed */
  topics: Array<Scalars['String']['output']>;
  /** Total tokens used */
  totalTokens: Scalars['Int']['output'];
};

export type StatusCount = {
  __typename?: 'StatusCount';
  CANCELLED: Scalars['Int']['output'];
  FAILED: Scalars['Int']['output'];
  QUEUED: Scalars['Int']['output'];
  RETRYING: Scalars['Int']['output'];
  RUNNING: Scalars['Int']['output'];
  SUCCESS: Scalars['Int']['output'];
};

export type Subscription = {
  __typename?: 'Subscription';
  /** Subscribe to progress updates for agent runs */
  agentRunProgress: AgentRunProgress;
  /** Subscribe to run status changes */
  agentRunUpdates: AgentRun;
  /** Subscribe to all run updates */
  allAgentRunUpdates: AgentRun;
  /** Subscribe to aggregate progress for multiple runs */
  batchProgress: BatchProgress;
  /** Subscribe to real-time command output from a Claude session */
  commandOutput: CommandOutput;
};


export type SubscriptionAgentRunProgressArgs = {
  runId: Scalars['ID']['input'];
};


export type SubscriptionAgentRunUpdatesArgs = {
  runId: Scalars['ID']['input'];
};


export type SubscriptionBatchProgressArgs = {
  batchId: Scalars['ID']['input'];
};


export type SubscriptionCommandOutputArgs = {
  sessionId: Scalars['ID']['input'];
};

export type SummaryMetadata = {
  __typename?: 'SummaryMetadata';
  /** Number of repositories analyzed */
  repositoryCount: Scalars['Int']['output'];
  /** Risk assessment */
  riskLevel: RiskLevel;
  /** Suggested actions */
  suggestedActions: Array<Scalars['String']['output']>;
  /** Key themes identified */
  themes: Array<Theme>;
  /** Total changes summarized */
  totalChanges: Scalars['Int']['output'];
};

export type Theme = {
  __typename?: 'Theme';
  /** Affected repositories */
  affectedRepositories: Array<Scalars['String']['output']>;
  /** Theme description */
  description: Scalars['String']['output'];
  /** Impact level */
  impact: ImpactLevel;
  /** Theme name */
  name: Scalars['String']['output'];
};

export type TimeRange = {
  __typename?: 'TimeRange';
  /** Duration in minutes */
  durationMinutes: Scalars['Int']['output'];
  /** End time of the range */
  end: Scalars['String']['output'];
  /** Start time of the range */
  start: Scalars['String']['output'];
};

export type TokenUsage = {
  __typename?: 'TokenUsage';
  /** Estimated cost in USD */
  estimatedCost: Scalars['Float']['output'];
  /** Total input tokens used */
  inputTokens: Scalars['Int']['output'];
  /** Total output tokens used */
  outputTokens: Scalars['Int']['output'];
};

export type WithIndex<TObject> = TObject & Record<string, any>;
export type ResolversObject<TObject> = WithIndex<TObject>;

export type ResolverTypeWrapper<T> = Promise<T> | T;


export type ResolverWithResolve<TResult, TParent, TContext, TArgs> = {
  resolve: ResolverFn<TResult, TParent, TContext, TArgs>;
};
export type Resolver<TResult, TParent = {}, TContext = {}, TArgs = {}> = ResolverFn<TResult, TParent, TContext, TArgs> | ResolverWithResolve<TResult, TParent, TContext, TArgs>;

export type ResolverFn<TResult, TParent, TContext, TArgs> = (
  parent: TParent,
  args: TArgs,
  context: TContext,
  info: GraphQLResolveInfo
) => Promise<TResult> | TResult;

export type SubscriptionSubscribeFn<TResult, TParent, TContext, TArgs> = (
  parent: TParent,
  args: TArgs,
  context: TContext,
  info: GraphQLResolveInfo
) => AsyncIterable<TResult> | Promise<AsyncIterable<TResult>>;

export type SubscriptionResolveFn<TResult, TParent, TContext, TArgs> = (
  parent: TParent,
  args: TArgs,
  context: TContext,
  info: GraphQLResolveInfo
) => TResult | Promise<TResult>;

export interface SubscriptionSubscriberObject<TResult, TKey extends string, TParent, TContext, TArgs> {
  subscribe: SubscriptionSubscribeFn<{ [key in TKey]: TResult }, TParent, TContext, TArgs>;
  resolve?: SubscriptionResolveFn<TResult, { [key in TKey]: TResult }, TContext, TArgs>;
}

export interface SubscriptionResolverObject<TResult, TParent, TContext, TArgs> {
  subscribe: SubscriptionSubscribeFn<any, TParent, TContext, TArgs>;
  resolve: SubscriptionResolveFn<TResult, any, TContext, TArgs>;
}

export type SubscriptionObject<TResult, TKey extends string, TParent, TContext, TArgs> =
  | SubscriptionSubscriberObject<TResult, TKey, TParent, TContext, TArgs>
  | SubscriptionResolverObject<TResult, TParent, TContext, TArgs>;

export type SubscriptionResolver<TResult, TKey extends string, TParent = {}, TContext = {}, TArgs = {}> =
  | ((...args: any[]) => SubscriptionObject<TResult, TKey, TParent, TContext, TArgs>)
  | SubscriptionObject<TResult, TKey, TParent, TContext, TArgs>;

export type TypeResolveFn<TTypes, TParent = {}, TContext = {}> = (
  parent: TParent,
  context: TContext,
  info: GraphQLResolveInfo
) => Maybe<TTypes> | Promise<Maybe<TTypes>>;

export type IsTypeOfResolverFn<T = {}, TContext = {}> = (obj: T, context: TContext, info: GraphQLResolveInfo) => boolean | Promise<boolean>;

export type NextResolverFn<T> = () => Promise<T>;

export type DirectiveResolverFn<TResult = {}, TParent = {}, TContext = {}, TArgs = {}> = (
  next: NextResolverFn<TResult>,
  parent: TParent,
  args: TArgs,
  context: TContext,
  info: GraphQLResolveInfo
) => TResult | Promise<TResult>;



/** Mapping between all available schema types and the resolvers types */
export type ResolversTypes = ResolversObject<{
  AgentInput: ResolverTypeWrapper<AgentInput>;
  AgentOutput: ResolverTypeWrapper<AgentOutput>;
  AgentRun: ResolverTypeWrapper<AgentRun>;
  AgentRunConnection: ResolverTypeWrapper<AgentRunConnection>;
  AgentRunProgress: ResolverTypeWrapper<AgentRunProgress>;
  BatchCommitMessageInput: BatchCommitMessageInput;
  BatchCommitMessageResult: ResolverTypeWrapper<BatchCommitMessageResult>;
  BatchProgress: ResolverTypeWrapper<BatchProgress>;
  Boolean: ResolverTypeWrapper<Scalars['Boolean']['output']>;
  ChangeStats: ChangeStats;
  ClaudeExecuteInput: ClaudeExecuteInput;
  ClaudeExecuteResult: ResolverTypeWrapper<ClaudeExecuteResult>;
  ClaudeHealthStatus: ResolverTypeWrapper<ClaudeHealthStatus>;
  ClaudeResourceUsage: ResolverTypeWrapper<ClaudeResourceUsage>;
  ClaudeSession: ResolverTypeWrapper<ClaudeSession>;
  CommandHistoryItem: ResolverTypeWrapper<CommandHistoryItem>;
  CommandOptions: CommandOptions;
  CommandOutput: ResolverTypeWrapper<CommandOutput>;
  CommitMessageInfo: CommitMessageInfo;
  CommitMessageResult: ResolverTypeWrapper<CommitMessageResult>;
  CommitStyleGuide: CommitStyleGuide;
  ContextInput: ContextInput;
  ContinueSessionInput: ContinueSessionInput;
  ExecutionMetadata: ResolverTypeWrapper<ExecutionMetadata>;
  ExecutiveSummaryInput: ExecutiveSummaryInput;
  ExecutiveSummaryResult: ResolverTypeWrapper<ExecutiveSummaryResult>;
  Float: ResolverTypeWrapper<Scalars['Float']['output']>;
  HandoffInput: HandoffInput;
  HandoffResult: ResolverTypeWrapper<HandoffResult>;
  ID: ResolverTypeWrapper<Scalars['ID']['output']>;
  ImpactLevel: ImpactLevel;
  Int: ResolverTypeWrapper<Scalars['Int']['output']>;
  Mutation: ResolverTypeWrapper<{}>;
  OperationMetrics: ResolverTypeWrapper<OperationMetrics>;
  OutputType: OutputType;
  ParallelComparison: ResolverTypeWrapper<ParallelComparison>;
  PerformanceReport: ResolverTypeWrapper<PerformanceReport>;
  ProgressStage: ProgressStage;
  Query: ResolverTypeWrapper<{}>;
  RepositoryCommitInfo: RepositoryCommitInfo;
  RepositoryCount: ResolverTypeWrapper<RepositoryCount>;
  RiskLevel: RiskLevel;
  RunError: ResolverTypeWrapper<RunError>;
  RunStatistics: ResolverTypeWrapper<RunStatistics>;
  RunStatus: RunStatus;
  SessionMetadata: ResolverTypeWrapper<SessionMetadata>;
  SessionStatus: SessionStatus;
  SessionSummary: ResolverTypeWrapper<SessionSummary>;
  StatusCount: ResolverTypeWrapper<StatusCount>;
  String: ResolverTypeWrapper<Scalars['String']['output']>;
  Subscription: ResolverTypeWrapper<{}>;
  SummaryMetadata: ResolverTypeWrapper<SummaryMetadata>;
  Theme: ResolverTypeWrapper<Theme>;
  TimeRange: ResolverTypeWrapper<TimeRange>;
  TokenUsage: ResolverTypeWrapper<TokenUsage>;
}>;

/** Mapping between all available schema types and the resolvers parents */
export type ResolversParentTypes = ResolversObject<{
  AgentInput: AgentInput;
  AgentOutput: AgentOutput;
  AgentRun: AgentRun;
  AgentRunConnection: AgentRunConnection;
  AgentRunProgress: AgentRunProgress;
  BatchCommitMessageInput: BatchCommitMessageInput;
  BatchCommitMessageResult: BatchCommitMessageResult;
  BatchProgress: BatchProgress;
  Boolean: Scalars['Boolean']['output'];
  ChangeStats: ChangeStats;
  ClaudeExecuteInput: ClaudeExecuteInput;
  ClaudeExecuteResult: ClaudeExecuteResult;
  ClaudeHealthStatus: ClaudeHealthStatus;
  ClaudeResourceUsage: ClaudeResourceUsage;
  ClaudeSession: ClaudeSession;
  CommandHistoryItem: CommandHistoryItem;
  CommandOptions: CommandOptions;
  CommandOutput: CommandOutput;
  CommitMessageInfo: CommitMessageInfo;
  CommitMessageResult: CommitMessageResult;
  CommitStyleGuide: CommitStyleGuide;
  ContextInput: ContextInput;
  ContinueSessionInput: ContinueSessionInput;
  ExecutionMetadata: ExecutionMetadata;
  ExecutiveSummaryInput: ExecutiveSummaryInput;
  ExecutiveSummaryResult: ExecutiveSummaryResult;
  Float: Scalars['Float']['output'];
  HandoffInput: HandoffInput;
  HandoffResult: HandoffResult;
  ID: Scalars['ID']['output'];
  Int: Scalars['Int']['output'];
  Mutation: {};
  OperationMetrics: OperationMetrics;
  ParallelComparison: ParallelComparison;
  PerformanceReport: PerformanceReport;
  Query: {};
  RepositoryCommitInfo: RepositoryCommitInfo;
  RepositoryCount: RepositoryCount;
  RunError: RunError;
  RunStatistics: RunStatistics;
  SessionMetadata: SessionMetadata;
  SessionSummary: SessionSummary;
  StatusCount: StatusCount;
  String: Scalars['String']['output'];
  Subscription: {};
  SummaryMetadata: SummaryMetadata;
  Theme: Theme;
  TimeRange: TimeRange;
  TokenUsage: TokenUsage;
}>;

export type AgentInputResolvers<ContextType = Context, ParentType extends ResolversParentTypes['AgentInput'] = ResolversParentTypes['AgentInput']> = ResolversObject<{
  diff: Resolver<ResolversTypes['String'], ParentType, ContextType>;
  model: Resolver<ResolversTypes['String'], ParentType, ContextType>;
  prompt: Resolver<ResolversTypes['String'], ParentType, ContextType>;
  recentCommits: Resolver<Array<ResolversTypes['String']>, ParentType, ContextType>;
  temperature: Resolver<ResolversTypes['Float'], ParentType, ContextType>;
  __isTypeOf?: IsTypeOfResolverFn<ParentType, ContextType>;
}>;

export type AgentOutputResolvers<ContextType = Context, ParentType extends ResolversParentTypes['AgentOutput'] = ResolversParentTypes['AgentOutput']> = ResolversObject<{
  confidence: Resolver<ResolversTypes['Float'], ParentType, ContextType>;
  message: Resolver<ResolversTypes['String'], ParentType, ContextType>;
  rawResponse: Resolver<ResolversTypes['String'], ParentType, ContextType>;
  reasoning: Resolver<Maybe<ResolversTypes['String']>, ParentType, ContextType>;
  tokensUsed: Resolver<ResolversTypes['Int'], ParentType, ContextType>;
  __isTypeOf?: IsTypeOfResolverFn<ParentType, ContextType>;
}>;

export type AgentRunResolvers<ContextType = Context, ParentType extends ResolversParentTypes['AgentRun'] = ResolversParentTypes['AgentRun']> = ResolversObject<{
  completedAt: Resolver<Maybe<ResolversTypes['String']>, ParentType, ContextType>;
  duration: Resolver<Maybe<ResolversTypes['Int']>, ParentType, ContextType>;
  error: Resolver<Maybe<ResolversTypes['RunError']>, ParentType, ContextType>;
  id: Resolver<ResolversTypes['ID'], ParentType, ContextType>;
  input: Resolver<ResolversTypes['AgentInput'], ParentType, ContextType>;
  output: Resolver<Maybe<ResolversTypes['AgentOutput']>, ParentType, ContextType>;
  parentRunId: Resolver<Maybe<ResolversTypes['ID']>, ParentType, ContextType>;
  repository: Resolver<ResolversTypes['String'], ParentType, ContextType>;
  retryCount: Resolver<ResolversTypes['Int'], ParentType, ContextType>;
  startedAt: Resolver<ResolversTypes['String'], ParentType, ContextType>;
  status: Resolver<ResolversTypes['RunStatus'], ParentType, ContextType>;
  __isTypeOf?: IsTypeOfResolverFn<ParentType, ContextType>;
}>;

export type AgentRunConnectionResolvers<ContextType = Context, ParentType extends ResolversParentTypes['AgentRunConnection'] = ResolversParentTypes['AgentRunConnection']> = ResolversObject<{
  runs: Resolver<Array<ResolversTypes['AgentRun']>, ParentType, ContextType>;
  total: Resolver<ResolversTypes['Int'], ParentType, ContextType>;
  __isTypeOf?: IsTypeOfResolverFn<ParentType, ContextType>;
}>;

export type AgentRunProgressResolvers<ContextType = Context, ParentType extends ResolversParentTypes['AgentRunProgress'] = ResolversParentTypes['AgentRunProgress']> = ResolversObject<{
  currentOperation: Resolver<Maybe<ResolversTypes['String']>, ParentType, ContextType>;
  error: Resolver<Maybe<ResolversTypes['String']>, ParentType, ContextType>;
  estimatedTimeRemaining: Resolver<Maybe<ResolversTypes['Int']>, ParentType, ContextType>;
  isComplete: Resolver<ResolversTypes['Boolean'], ParentType, ContextType>;
  percentage: Resolver<ResolversTypes['Float'], ParentType, ContextType>;
  repository: Resolver<ResolversTypes['String'], ParentType, ContextType>;
  runId: Resolver<ResolversTypes['ID'], ParentType, ContextType>;
  stage: Resolver<ResolversTypes['ProgressStage'], ParentType, ContextType>;
  timestamp: Resolver<ResolversTypes['String'], ParentType, ContextType>;
  __isTypeOf?: IsTypeOfResolverFn<ParentType, ContextType>;
}>;

export type BatchCommitMessageResultResolvers<ContextType = Context, ParentType extends ResolversParentTypes['BatchCommitMessageResult'] = ResolversParentTypes['BatchCommitMessageResult']> = ResolversObject<{
  executionTime: Resolver<ResolversTypes['Int'], ParentType, ContextType>;
  results: Resolver<Array<ResolversTypes['CommitMessageResult']>, ParentType, ContextType>;
  successCount: Resolver<ResolversTypes['Int'], ParentType, ContextType>;
  totalRepositories: Resolver<ResolversTypes['Int'], ParentType, ContextType>;
  totalTokenUsage: Resolver<ResolversTypes['TokenUsage'], ParentType, ContextType>;
  __isTypeOf?: IsTypeOfResolverFn<ParentType, ContextType>;
}>;

export type BatchProgressResolvers<ContextType = Context, ParentType extends ResolversParentTypes['BatchProgress'] = ResolversParentTypes['BatchProgress']> = ResolversObject<{
  batchId: Resolver<ResolversTypes['ID'], ParentType, ContextType>;
  completedOperations: Resolver<ResolversTypes['Int'], ParentType, ContextType>;
  estimatedTimeRemaining: Resolver<Maybe<ResolversTypes['Int']>, ParentType, ContextType>;
  failedOperations: Resolver<ResolversTypes['Int'], ParentType, ContextType>;
  isComplete: Resolver<ResolversTypes['Boolean'], ParentType, ContextType>;
  overallPercentage: Resolver<ResolversTypes['Float'], ParentType, ContextType>;
  runProgress: Resolver<Array<ResolversTypes['AgentRunProgress']>, ParentType, ContextType>;
  startTime: Resolver<ResolversTypes['String'], ParentType, ContextType>;
  totalOperations: Resolver<ResolversTypes['Int'], ParentType, ContextType>;
  __isTypeOf?: IsTypeOfResolverFn<ParentType, ContextType>;
}>;

export type ClaudeExecuteResultResolvers<ContextType = Context, ParentType extends ResolversParentTypes['ClaudeExecuteResult'] = ResolversParentTypes['ClaudeExecuteResult']> = ResolversObject<{
  error: Resolver<Maybe<ResolversTypes['String']>, ParentType, ContextType>;
  initialResponse: Resolver<Maybe<ResolversTypes['String']>, ParentType, ContextType>;
  metadata: Resolver<ResolversTypes['ExecutionMetadata'], ParentType, ContextType>;
  sessionId: Resolver<ResolversTypes['ID'], ParentType, ContextType>;
  success: Resolver<ResolversTypes['Boolean'], ParentType, ContextType>;
  __isTypeOf?: IsTypeOfResolverFn<ParentType, ContextType>;
}>;

export type ClaudeHealthStatusResolvers<ContextType = Context, ParentType extends ResolversParentTypes['ClaudeHealthStatus'] = ResolversParentTypes['ClaudeHealthStatus']> = ResolversObject<{
  activeSessions: Resolver<ResolversTypes['Int'], ParentType, ContextType>;
  claudeAvailable: Resolver<ResolversTypes['Boolean'], ParentType, ContextType>;
  claudeVersion: Resolver<Maybe<ResolversTypes['String']>, ParentType, ContextType>;
  healthy: Resolver<ResolversTypes['Boolean'], ParentType, ContextType>;
  resources: Resolver<ResolversTypes['ClaudeResourceUsage'], ParentType, ContextType>;
  version: Resolver<ResolversTypes['String'], ParentType, ContextType>;
  __isTypeOf?: IsTypeOfResolverFn<ParentType, ContextType>;
}>;

export type ClaudeResourceUsageResolvers<ContextType = Context, ParentType extends ResolversParentTypes['ClaudeResourceUsage'] = ResolversParentTypes['ClaudeResourceUsage']> = ResolversObject<{
  activeProcesses: Resolver<ResolversTypes['Int'], ParentType, ContextType>;
  cpuUsage: Resolver<ResolversTypes['Float'], ParentType, ContextType>;
  memoryUsage: Resolver<ResolversTypes['Float'], ParentType, ContextType>;
  __isTypeOf?: IsTypeOfResolverFn<ParentType, ContextType>;
}>;

export type ClaudeSessionResolvers<ContextType = Context, ParentType extends ResolversParentTypes['ClaudeSession'] = ResolversParentTypes['ClaudeSession']> = ResolversObject<{
  createdAt: Resolver<ResolversTypes['String'], ParentType, ContextType>;
  history: Resolver<Array<ResolversTypes['CommandHistoryItem']>, ParentType, ContextType>;
  id: Resolver<ResolversTypes['ID'], ParentType, ContextType>;
  lastActivity: Resolver<ResolversTypes['String'], ParentType, ContextType>;
  metadata: Resolver<ResolversTypes['SessionMetadata'], ParentType, ContextType>;
  pid: Resolver<Maybe<ResolversTypes['Int']>, ParentType, ContextType>;
  status: Resolver<ResolversTypes['SessionStatus'], ParentType, ContextType>;
  workingDirectory: Resolver<ResolversTypes['String'], ParentType, ContextType>;
  __isTypeOf?: IsTypeOfResolverFn<ParentType, ContextType>;
}>;

export type CommandHistoryItemResolvers<ContextType = Context, ParentType extends ResolversParentTypes['CommandHistoryItem'] = ResolversParentTypes['CommandHistoryItem']> = ResolversObject<{
  executionTime: Resolver<ResolversTypes['Int'], ParentType, ContextType>;
  prompt: Resolver<ResolversTypes['String'], ParentType, ContextType>;
  response: Resolver<Maybe<ResolversTypes['String']>, ParentType, ContextType>;
  success: Resolver<ResolversTypes['Boolean'], ParentType, ContextType>;
  timestamp: Resolver<ResolversTypes['String'], ParentType, ContextType>;
  __isTypeOf?: IsTypeOfResolverFn<ParentType, ContextType>;
}>;

export type CommandOutputResolvers<ContextType = Context, ParentType extends ResolversParentTypes['CommandOutput'] = ResolversParentTypes['CommandOutput']> = ResolversObject<{
  content: Resolver<ResolversTypes['String'], ParentType, ContextType>;
  isFinal: Resolver<ResolversTypes['Boolean'], ParentType, ContextType>;
  sessionId: Resolver<ResolversTypes['ID'], ParentType, ContextType>;
  timestamp: Resolver<ResolversTypes['String'], ParentType, ContextType>;
  tokens: Resolver<Maybe<ResolversTypes['Int']>, ParentType, ContextType>;
  type: Resolver<ResolversTypes['OutputType'], ParentType, ContextType>;
  __isTypeOf?: IsTypeOfResolverFn<ParentType, ContextType>;
}>;

export type CommitMessageResultResolvers<ContextType = Context, ParentType extends ResolversParentTypes['CommitMessageResult'] = ResolversParentTypes['CommitMessageResult']> = ResolversObject<{
  commitType: Resolver<Maybe<ResolversTypes['String']>, ParentType, ContextType>;
  confidence: Resolver<Maybe<ResolversTypes['Float']>, ParentType, ContextType>;
  error: Resolver<Maybe<ResolversTypes['String']>, ParentType, ContextType>;
  message: Resolver<Maybe<ResolversTypes['String']>, ParentType, ContextType>;
  repositoryName: Resolver<ResolversTypes['String'], ParentType, ContextType>;
  repositoryPath: Resolver<ResolversTypes['String'], ParentType, ContextType>;
  success: Resolver<ResolversTypes['Boolean'], ParentType, ContextType>;
  __isTypeOf?: IsTypeOfResolverFn<ParentType, ContextType>;
}>;

export type ExecutionMetadataResolvers<ContextType = Context, ParentType extends ResolversParentTypes['ExecutionMetadata'] = ResolversParentTypes['ExecutionMetadata']> = ResolversObject<{
  estimatedTime: Resolver<Maybe<ResolversTypes['Int']>, ParentType, ContextType>;
  flags: Resolver<Array<ResolversTypes['String']>, ParentType, ContextType>;
  pid: Resolver<Maybe<ResolversTypes['Int']>, ParentType, ContextType>;
  startTime: Resolver<ResolversTypes['String'], ParentType, ContextType>;
  __isTypeOf?: IsTypeOfResolverFn<ParentType, ContextType>;
}>;

export type ExecutiveSummaryResultResolvers<ContextType = Context, ParentType extends ResolversParentTypes['ExecutiveSummaryResult'] = ResolversParentTypes['ExecutiveSummaryResult']> = ResolversObject<{
  error: Resolver<Maybe<ResolversTypes['String']>, ParentType, ContextType>;
  metadata: Resolver<ResolversTypes['SummaryMetadata'], ParentType, ContextType>;
  success: Resolver<ResolversTypes['Boolean'], ParentType, ContextType>;
  summary: Resolver<Maybe<ResolversTypes['String']>, ParentType, ContextType>;
  __isTypeOf?: IsTypeOfResolverFn<ParentType, ContextType>;
}>;

export type HandoffResultResolvers<ContextType = Context, ParentType extends ResolversParentTypes['HandoffResult'] = ResolversParentTypes['HandoffResult']> = ResolversObject<{
  content: Resolver<Maybe<ResolversTypes['String']>, ParentType, ContextType>;
  documentPath: Resolver<Maybe<ResolversTypes['String']>, ParentType, ContextType>;
  error: Resolver<Maybe<ResolversTypes['String']>, ParentType, ContextType>;
  sessionSummary: Resolver<ResolversTypes['SessionSummary'], ParentType, ContextType>;
  success: Resolver<ResolversTypes['Boolean'], ParentType, ContextType>;
  __isTypeOf?: IsTypeOfResolverFn<ParentType, ContextType>;
}>;

export type MutationResolvers<ContextType = Context, ParentType extends ResolversParentTypes['Mutation'] = ResolversParentTypes['Mutation']> = ResolversObject<{
  cancelAgentRun: Resolver<ResolversTypes['AgentRun'], ParentType, ContextType, RequireFields<MutationCancelAgentRunArgs, 'runId'>>;
  continueSession: Resolver<ResolversTypes['ClaudeExecuteResult'], ParentType, ContextType, RequireFields<MutationContinueSessionArgs, 'input'>>;
  createHandoff: Resolver<ResolversTypes['HandoffResult'], ParentType, ContextType, RequireFields<MutationCreateHandoffArgs, 'input'>>;
  deleteOldRuns: Resolver<ResolversTypes['Int'], ParentType, ContextType>;
  executeCommand: Resolver<ResolversTypes['ClaudeExecuteResult'], ParentType, ContextType, RequireFields<MutationExecuteCommandArgs, 'input'>>;
  generateCommitMessages: Resolver<ResolversTypes['BatchCommitMessageResult'], ParentType, ContextType, RequireFields<MutationGenerateCommitMessagesArgs, 'input'>>;
  generateExecutiveSummary: Resolver<ResolversTypes['ExecutiveSummaryResult'], ParentType, ContextType, RequireFields<MutationGenerateExecutiveSummaryArgs, 'input'>>;
  killSession: Resolver<ResolversTypes['Boolean'], ParentType, ContextType, RequireFields<MutationKillSessionArgs, 'id'>>;
  retryAgentRun: Resolver<ResolversTypes['AgentRun'], ParentType, ContextType, RequireFields<MutationRetryAgentRunArgs, 'runId'>>;
  retryFailedRuns: Resolver<Array<ResolversTypes['AgentRun']>, ParentType, ContextType, RequireFields<MutationRetryFailedRunsArgs, 'runIds'>>;
}>;

export type OperationMetricsResolvers<ContextType = Context, ParentType extends ResolversParentTypes['OperationMetrics'] = ResolversParentTypes['OperationMetrics']> = ResolversObject<{
  averageDuration: Resolver<ResolversTypes['Float'], ParentType, ContextType>;
  count: Resolver<ResolversTypes['Int'], ParentType, ContextType>;
  maxDuration: Resolver<ResolversTypes['Float'], ParentType, ContextType>;
  minDuration: Resolver<ResolversTypes['Float'], ParentType, ContextType>;
  operation: Resolver<ResolversTypes['String'], ParentType, ContextType>;
  p95Duration: Resolver<ResolversTypes['Float'], ParentType, ContextType>;
  p99Duration: Resolver<ResolversTypes['Float'], ParentType, ContextType>;
  successRate: Resolver<ResolversTypes['Float'], ParentType, ContextType>;
  totalDuration: Resolver<ResolversTypes['Float'], ParentType, ContextType>;
  __isTypeOf?: IsTypeOfResolverFn<ParentType, ContextType>;
}>;

export type ParallelComparisonResolvers<ContextType = Context, ParentType extends ResolversParentTypes['ParallelComparison'] = ResolversParentTypes['ParallelComparison']> = ResolversObject<{
  efficiency: Resolver<ResolversTypes['Float'], ParentType, ContextType>;
  parallel: Resolver<Maybe<ResolversTypes['OperationMetrics']>, ParentType, ContextType>;
  sequential: Resolver<Maybe<ResolversTypes['OperationMetrics']>, ParentType, ContextType>;
  speedup: Resolver<ResolversTypes['Float'], ParentType, ContextType>;
  __isTypeOf?: IsTypeOfResolverFn<ParentType, ContextType>;
}>;

export type PerformanceReportResolvers<ContextType = Context, ParentType extends ResolversParentTypes['PerformanceReport'] = ResolversParentTypes['PerformanceReport']> = ResolversObject<{
  operations: Resolver<Array<ResolversTypes['OperationMetrics']>, ParentType, ContextType>;
  parallelComparison: Resolver<Maybe<ResolversTypes['ParallelComparison']>, ParentType, ContextType>;
  timeRange: Resolver<ResolversTypes['TimeRange'], ParentType, ContextType>;
  totalOperations: Resolver<ResolversTypes['Int'], ParentType, ContextType>;
  __isTypeOf?: IsTypeOfResolverFn<ParentType, ContextType>;
}>;

export type QueryResolvers<ContextType = Context, ParentType extends ResolversParentTypes['Query'] = ResolversParentTypes['Query']> = ResolversObject<{
  agentRun: Resolver<Maybe<ResolversTypes['AgentRun']>, ParentType, ContextType, RequireFields<QueryAgentRunArgs, 'id'>>;
  agentRuns: Resolver<ResolversTypes['AgentRunConnection'], ParentType, ContextType, RequireFields<QueryAgentRunsArgs, 'limit' | 'offset'>>;
  claudeHealth: Resolver<ResolversTypes['ClaudeHealthStatus'], ParentType, ContextType>;
  performanceMetrics: Resolver<ResolversTypes['PerformanceReport'], ParentType, ContextType, QueryPerformanceMetricsArgs>;
  repositoryRuns: Resolver<Array<ResolversTypes['AgentRun']>, ParentType, ContextType, RequireFields<QueryRepositoryRunsArgs, 'repository'>>;
  runStatistics: Resolver<ResolversTypes['RunStatistics'], ParentType, ContextType>;
  session: Resolver<Maybe<ResolversTypes['ClaudeSession']>, ParentType, ContextType, RequireFields<QuerySessionArgs, 'id'>>;
  sessions: Resolver<Array<ResolversTypes['ClaudeSession']>, ParentType, ContextType>;
}>;

export type RepositoryCountResolvers<ContextType = Context, ParentType extends ResolversParentTypes['RepositoryCount'] = ResolversParentTypes['RepositoryCount']> = ResolversObject<{
  count: Resolver<ResolversTypes['Int'], ParentType, ContextType>;
  repository: Resolver<ResolversTypes['String'], ParentType, ContextType>;
  __isTypeOf?: IsTypeOfResolverFn<ParentType, ContextType>;
}>;

export type RunErrorResolvers<ContextType = Context, ParentType extends ResolversParentTypes['RunError'] = ResolversParentTypes['RunError']> = ResolversObject<{
  code: Resolver<ResolversTypes['String'], ParentType, ContextType>;
  message: Resolver<ResolversTypes['String'], ParentType, ContextType>;
  recoverable: Resolver<ResolversTypes['Boolean'], ParentType, ContextType>;
  stackTrace: Resolver<Maybe<ResolversTypes['String']>, ParentType, ContextType>;
  __isTypeOf?: IsTypeOfResolverFn<ParentType, ContextType>;
}>;

export type RunStatisticsResolvers<ContextType = Context, ParentType extends ResolversParentTypes['RunStatistics'] = ResolversParentTypes['RunStatistics']> = ResolversObject<{
  averageDuration: Resolver<ResolversTypes['Float'], ParentType, ContextType>;
  byRepository: Resolver<Array<ResolversTypes['RepositoryCount']>, ParentType, ContextType>;
  byStatus: Resolver<ResolversTypes['StatusCount'], ParentType, ContextType>;
  successRate: Resolver<ResolversTypes['Float'], ParentType, ContextType>;
  total: Resolver<ResolversTypes['Int'], ParentType, ContextType>;
  __isTypeOf?: IsTypeOfResolverFn<ParentType, ContextType>;
}>;

export type SessionMetadataResolvers<ContextType = Context, ParentType extends ResolversParentTypes['SessionMetadata'] = ResolversParentTypes['SessionMetadata']> = ResolversObject<{
  flags: Resolver<Array<ResolversTypes['String']>, ParentType, ContextType>;
  model: Resolver<ResolversTypes['String'], ParentType, ContextType>;
  projectContext: Resolver<Maybe<ResolversTypes['String']>, ParentType, ContextType>;
  tokenUsage: Resolver<ResolversTypes['TokenUsage'], ParentType, ContextType>;
  __isTypeOf?: IsTypeOfResolverFn<ParentType, ContextType>;
}>;

export type SessionSummaryResolvers<ContextType = Context, ParentType extends ResolversParentTypes['SessionSummary'] = ResolversParentTypes['SessionSummary']> = ResolversObject<{
  filesModified: Resolver<Array<ResolversTypes['String']>, ParentType, ContextType>;
  interactionCount: Resolver<ResolversTypes['Int'], ParentType, ContextType>;
  topics: Resolver<Array<ResolversTypes['String']>, ParentType, ContextType>;
  totalTokens: Resolver<ResolversTypes['Int'], ParentType, ContextType>;
  __isTypeOf?: IsTypeOfResolverFn<ParentType, ContextType>;
}>;

export type StatusCountResolvers<ContextType = Context, ParentType extends ResolversParentTypes['StatusCount'] = ResolversParentTypes['StatusCount']> = ResolversObject<{
  CANCELLED: Resolver<ResolversTypes['Int'], ParentType, ContextType>;
  FAILED: Resolver<ResolversTypes['Int'], ParentType, ContextType>;
  QUEUED: Resolver<ResolversTypes['Int'], ParentType, ContextType>;
  RETRYING: Resolver<ResolversTypes['Int'], ParentType, ContextType>;
  RUNNING: Resolver<ResolversTypes['Int'], ParentType, ContextType>;
  SUCCESS: Resolver<ResolversTypes['Int'], ParentType, ContextType>;
  __isTypeOf?: IsTypeOfResolverFn<ParentType, ContextType>;
}>;

export type SubscriptionResolvers<ContextType = Context, ParentType extends ResolversParentTypes['Subscription'] = ResolversParentTypes['Subscription']> = ResolversObject<{
  agentRunProgress: SubscriptionResolver<ResolversTypes['AgentRunProgress'], "agentRunProgress", ParentType, ContextType, RequireFields<SubscriptionAgentRunProgressArgs, 'runId'>>;
  agentRunUpdates: SubscriptionResolver<ResolversTypes['AgentRun'], "agentRunUpdates", ParentType, ContextType, RequireFields<SubscriptionAgentRunUpdatesArgs, 'runId'>>;
  allAgentRunUpdates: SubscriptionResolver<ResolversTypes['AgentRun'], "allAgentRunUpdates", ParentType, ContextType>;
  batchProgress: SubscriptionResolver<ResolversTypes['BatchProgress'], "batchProgress", ParentType, ContextType, RequireFields<SubscriptionBatchProgressArgs, 'batchId'>>;
  commandOutput: SubscriptionResolver<ResolversTypes['CommandOutput'], "commandOutput", ParentType, ContextType, RequireFields<SubscriptionCommandOutputArgs, 'sessionId'>>;
}>;

export type SummaryMetadataResolvers<ContextType = Context, ParentType extends ResolversParentTypes['SummaryMetadata'] = ResolversParentTypes['SummaryMetadata']> = ResolversObject<{
  repositoryCount: Resolver<ResolversTypes['Int'], ParentType, ContextType>;
  riskLevel: Resolver<ResolversTypes['RiskLevel'], ParentType, ContextType>;
  suggestedActions: Resolver<Array<ResolversTypes['String']>, ParentType, ContextType>;
  themes: Resolver<Array<ResolversTypes['Theme']>, ParentType, ContextType>;
  totalChanges: Resolver<ResolversTypes['Int'], ParentType, ContextType>;
  __isTypeOf?: IsTypeOfResolverFn<ParentType, ContextType>;
}>;

export type ThemeResolvers<ContextType = Context, ParentType extends ResolversParentTypes['Theme'] = ResolversParentTypes['Theme']> = ResolversObject<{
  affectedRepositories: Resolver<Array<ResolversTypes['String']>, ParentType, ContextType>;
  description: Resolver<ResolversTypes['String'], ParentType, ContextType>;
  impact: Resolver<ResolversTypes['ImpactLevel'], ParentType, ContextType>;
  name: Resolver<ResolversTypes['String'], ParentType, ContextType>;
  __isTypeOf?: IsTypeOfResolverFn<ParentType, ContextType>;
}>;

export type TimeRangeResolvers<ContextType = Context, ParentType extends ResolversParentTypes['TimeRange'] = ResolversParentTypes['TimeRange']> = ResolversObject<{
  durationMinutes: Resolver<ResolversTypes['Int'], ParentType, ContextType>;
  end: Resolver<ResolversTypes['String'], ParentType, ContextType>;
  start: Resolver<ResolversTypes['String'], ParentType, ContextType>;
  __isTypeOf?: IsTypeOfResolverFn<ParentType, ContextType>;
}>;

export type TokenUsageResolvers<ContextType = Context, ParentType extends ResolversParentTypes['TokenUsage'] = ResolversParentTypes['TokenUsage']> = ResolversObject<{
  estimatedCost: Resolver<ResolversTypes['Float'], ParentType, ContextType>;
  inputTokens: Resolver<ResolversTypes['Int'], ParentType, ContextType>;
  outputTokens: Resolver<ResolversTypes['Int'], ParentType, ContextType>;
  __isTypeOf?: IsTypeOfResolverFn<ParentType, ContextType>;
}>;

export type Resolvers<ContextType = Context> = ResolversObject<{
  AgentInput: AgentInputResolvers<ContextType>;
  AgentOutput: AgentOutputResolvers<ContextType>;
  AgentRun: AgentRunResolvers<ContextType>;
  AgentRunConnection: AgentRunConnectionResolvers<ContextType>;
  AgentRunProgress: AgentRunProgressResolvers<ContextType>;
  BatchCommitMessageResult: BatchCommitMessageResultResolvers<ContextType>;
  BatchProgress: BatchProgressResolvers<ContextType>;
  ClaudeExecuteResult: ClaudeExecuteResultResolvers<ContextType>;
  ClaudeHealthStatus: ClaudeHealthStatusResolvers<ContextType>;
  ClaudeResourceUsage: ClaudeResourceUsageResolvers<ContextType>;
  ClaudeSession: ClaudeSessionResolvers<ContextType>;
  CommandHistoryItem: CommandHistoryItemResolvers<ContextType>;
  CommandOutput: CommandOutputResolvers<ContextType>;
  CommitMessageResult: CommitMessageResultResolvers<ContextType>;
  ExecutionMetadata: ExecutionMetadataResolvers<ContextType>;
  ExecutiveSummaryResult: ExecutiveSummaryResultResolvers<ContextType>;
  HandoffResult: HandoffResultResolvers<ContextType>;
  Mutation: MutationResolvers<ContextType>;
  OperationMetrics: OperationMetricsResolvers<ContextType>;
  ParallelComparison: ParallelComparisonResolvers<ContextType>;
  PerformanceReport: PerformanceReportResolvers<ContextType>;
  Query: QueryResolvers<ContextType>;
  RepositoryCount: RepositoryCountResolvers<ContextType>;
  RunError: RunErrorResolvers<ContextType>;
  RunStatistics: RunStatisticsResolvers<ContextType>;
  SessionMetadata: SessionMetadataResolvers<ContextType>;
  SessionSummary: SessionSummaryResolvers<ContextType>;
  StatusCount: StatusCountResolvers<ContextType>;
  Subscription: SubscriptionResolvers<ContextType>;
  SummaryMetadata: SummaryMetadataResolvers<ContextType>;
  Theme: ThemeResolvers<ContextType>;
  TimeRange: TimeRangeResolvers<ContextType>;
  TokenUsage: TokenUsageResolvers<ContextType>;
}>;

