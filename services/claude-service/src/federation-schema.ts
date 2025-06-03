import gql from 'graphql-tag';

export const typeDefs = gql`
  extend schema @link(url: "https://specs.apollo.dev/federation/v2.10", import: ["@key", "@shareable", "@external"])

  type Query {
    """List all active Claude sessions"""
    sessions: [ClaudeSession!]!
    
    """Get details of a specific session"""
    session(id: ID!): ClaudeSession
    
    """Check service health and Claude availability"""
    health: HealthStatus!
    
    """Get performance metrics for operations"""
    performanceMetrics(operation: String, lastMinutes: Int): PerformanceReport!
  }

  type Mutation {
    """Execute a Claude command in a new or existing session"""
    executeCommand(input: ClaudeExecuteInput!): ClaudeExecuteResult!
    
    """Continue an existing Claude session with a new prompt"""
    continueSession(input: ContinueSessionInput!): ClaudeExecuteResult!
    
    """Kill an active Claude session"""
    killSession(id: ID!): Boolean!
    
    """Create a handoff document for session transfer"""
    createHandoff(input: HandoffInput!): HandoffResult!
    
    """Generate commit messages for multiple repositories"""
    generateCommitMessages(input: BatchCommitMessageInput!): BatchCommitMessageResult!
    
    """Generate executive summary from multiple commit messages"""
    generateExecutiveSummary(input: ExecutiveSummaryInput!): ExecutiveSummaryResult!
  }

  type Subscription {
    """Subscribe to real-time command output from a Claude session"""
    commandOutput(sessionId: ID!): CommandOutput!
    
    """Subscribe to progress updates for agent runs"""
    agentRunProgress(runId: ID!): AgentRunProgress!
    
    """Subscribe to aggregate progress for multiple runs"""
    batchProgress(batchId: ID!): BatchProgress!
  }

  # Types

  type ClaudeSession {
    """Unique session identifier"""
    id: ID!
    
    """Session creation timestamp"""
    createdAt: String!
    
    """Last activity timestamp"""
    lastActivity: String!
    
    """Current session status"""
    status: SessionStatus!
    
    """Process ID if active"""
    pid: Int
    
    """Current working directory"""
    workingDirectory: String!
    
    """Session metadata"""
    metadata: SessionMetadata!
    
    """Command history"""
    history: [CommandHistoryItem!]!
  }

  enum SessionStatus {
    """Session is active and ready"""
    ACTIVE
    
    """Session is processing a command"""
    PROCESSING
    
    """Session is idle"""
    IDLE
    
    """Session has been terminated"""
    TERMINATED
    
    """Session encountered an error"""
    ERROR
  }

  type SessionMetadata {
    """Project context if loaded"""
    projectContext: String
    
    """Model being used"""
    model: String!
    
    """Token usage statistics"""
    tokenUsage: TokenUsage!
    
    """Custom flags or options"""
    flags: [String!]!
  }

  type TokenUsage {
    """Total input tokens used"""
    inputTokens: Int!
    
    """Total output tokens used"""
    outputTokens: Int!
    
    """Estimated cost in USD"""
    estimatedCost: Float!
  }

  type CommandHistoryItem {
    """Command timestamp"""
    timestamp: String!
    
    """The prompt or command sent"""
    prompt: String!
    
    """Response received"""
    response: String
    
    """Execution time in milliseconds"""
    executionTime: Int!
    
    """Whether command succeeded"""
    success: Boolean!
  }

  type HealthStatus {
    """Service health status"""
    status: String! @shareable
    
    """Service version"""
    version: String!
    
    """Claude CLI availability"""
    claudeAvailable: Boolean!
    
    """Service uptime in seconds"""
    uptime: Int!
  }

  type ClaudeExecuteResult {
    """Session ID for this execution"""
    sessionId: ID!
    
    """Whether execution started successfully"""
    success: Boolean!
    
    """Error message if failed to start"""
    error: String
    
    """Initial response if available immediately"""
    initialResponse: String
    
    """Execution metadata"""
    metadata: ExecutionMetadata!
  }

  type ExecutionMetadata {
    """When execution started"""
    startTime: String!
    
    """Process ID"""
    pid: Int
    
    """Estimated completion time"""
    estimatedTime: Int
    
    """Command flags used"""
    flags: [String!]!
  }

  type CommandOutput {
    """Session ID this output belongs to"""
    sessionId: ID!
    
    """Output type"""
    type: OutputType!
    
    """The actual output content"""
    content: String!
    
    """Timestamp of this output"""
    timestamp: String!
    
    """Whether this is the final output"""
    isFinal: Boolean!
    
    """Token count for this output chunk"""
    tokens: Int
  }

  enum OutputType {
    """Standard output"""
    STDOUT
    
    """Error output"""
    STDERR
    
    """System message"""
    SYSTEM
    
    """Progress update"""
    PROGRESS
    
    """Final response"""
    FINAL
  }

  type HandoffResult {
    """Whether handoff document was created successfully"""
    success: Boolean!
    
    """Path to handoff document"""
    documentPath: String
    
    """Handoff document content"""
    content: String
    
    """Error message if failed"""
    error: String
    
    """Session state summary"""
    sessionSummary: SessionSummary!
  }

  type SessionSummary {
    """Number of interactions in session"""
    interactionCount: Int!
    
    """Total tokens used"""
    totalTokens: Int!
    
    """Key topics discussed"""
    topics: [String!]!
    
    """Files modified during session"""
    filesModified: [String!]!
  }

  type BatchCommitMessageResult {
    """Total repositories processed"""
    totalRepositories: Int!
    
    """Number of successful generations"""
    successCount: Int!
    
    """Individual results per repository"""
    results: [CommitMessageResult!]!
    
    """Total token usage"""
    totalTokenUsage: TokenUsage!
    
    """Execution time in milliseconds"""
    executionTime: Int!
  }

  type CommitMessageResult {
    """Repository path"""
    repositoryPath: String!
    
    """Repository name"""
    repositoryName: String!
    
    """Whether generation succeeded"""
    success: Boolean!
    
    """Generated commit message"""
    message: String
    
    """Error if generation failed"""
    error: String
    
    """Confidence score (0-1)"""
    confidence: Float
    
    """Suggested commit type (feat, fix, chore, etc.)"""
    commitType: String
  }

  type ExecutiveSummaryResult {
    """Whether summary generation succeeded"""
    success: Boolean!
    
    """The generated executive summary"""
    summary: String
    
    """Error if generation failed"""
    error: String
    
    """Summary metadata"""
    metadata: SummaryMetadata!
  }

  type SummaryMetadata {
    """Number of repositories analyzed"""
    repositoryCount: Int!
    
    """Total changes summarized"""
    totalChanges: Int!
    
    """Key themes identified"""
    themes: [Theme!]!
    
    """Risk assessment"""
    riskLevel: RiskLevel!
    
    """Suggested actions"""
    suggestedActions: [String!]!
  }

  type Theme {
    """Theme name"""
    name: String!
    
    """Theme description"""
    description: String!
    
    """Affected repositories"""
    affectedRepositories: [String!]!
    
    """Impact level"""
    impact: ImpactLevel!
  }

  enum RiskLevel {
    """No significant risks identified"""
    LOW
    
    """Minor risks that should be monitored"""
    MEDIUM
    
    """Significant risks requiring attention"""
    HIGH
    
    """Critical risks requiring immediate action"""
    CRITICAL
  }

  enum ImpactLevel {
    """Minor impact on functionality"""
    MINOR
    
    """Moderate impact, backwards compatible"""
    MODERATE
    
    """Major impact, may break compatibility"""
    MAJOR
    
    """Critical impact on core functionality"""
    CRITICAL
  }

  # Input Types

  input ClaudeExecuteInput {
    """The prompt or command to execute"""
    prompt: String!
    
    """Optional session ID to reuse"""
    sessionId: ID
    
    """Working directory for the command"""
    workingDirectory: String
    
    """Additional context to provide"""
    context: ContextInput
    
    """Command options"""
    options: CommandOptions
  }

  input ContextInput {
    """Files to include in context"""
    files: [String!]
    
    """Project-specific context"""
    projectContext: String
    
    """Additional instructions"""
    instructions: String
    
    """Maximum context size in tokens"""
    maxTokens: Int
  }

  input CommandOptions {
    """Model to use (if different from default)"""
    model: String
    
    """Temperature setting"""
    temperature: Float
    
    """Maximum response tokens"""
    maxTokens: Int
    
    """Custom flags to pass to Claude CLI"""
    customFlags: [String!]
    
    """Whether to stream output"""
    stream: Boolean
  }

  input ContinueSessionInput {
    """Session ID to continue"""
    sessionId: ID!
    
    """New prompt to send"""
    prompt: String!
    
    """Optional additional context"""
    additionalContext: ContextInput
  }

  input HandoffInput {
    """Session ID to create handoff for"""
    sessionId: ID!
    
    """Target for handoff (user, team, etc.)"""
    target: String
    
    """Additional notes for handoff"""
    notes: String
    
    """Whether to include full history"""
    includeFullHistory: Boolean
  }

  input BatchCommitMessageInput {
    """Repository information for commit message generation"""
    repositories: [RepositoryCommitInfo!]!
    
    """Style guide for commit messages"""
    styleGuide: CommitStyleGuide
    
    """Additional context for all commits"""
    globalContext: String
    
    """Whether to analyze relationships between changes"""
    analyzeRelationships: Boolean
  }

  input RepositoryCommitInfo {
    """Repository path"""
    path: String!
    
    """Repository name"""
    name: String!
    
    """Git diff of changes"""
    diff: String!
    
    """Files changed"""
    filesChanged: [String!]!
    
    """Recent commit history for style matching"""
    recentCommits: [String!]
    
    """Additional repository context"""
    context: String
  }

  input CommitStyleGuide {
    """Preferred format (conventional, descriptive, etc.)"""
    format: String
    
    """Maximum message length"""
    maxLength: Int
    
    """Whether to include scope"""
    includeScope: Boolean
    
    """Whether to include body"""
    includeBody: Boolean
    
    """Custom examples"""
    examples: [String!]
  }

  input ExecutiveSummaryInput {
    """Commit messages to summarize"""
    commitMessages: [CommitMessageInfo!]!
    
    """Target audience for summary"""
    audience: String
    
    """Desired summary length"""
    maxLength: Int
    
    """Focus areas for summary"""
    focusAreas: [String!]
    
    """Whether to include risk assessment"""
    includeRiskAssessment: Boolean
    
    """Whether to include recommendations"""
    includeRecommendations: Boolean
  }

  input CommitMessageInfo {
    """Repository name"""
    repository: String!
    
    """Commit message"""
    message: String!
    
    """Change statistics"""
    stats: ChangeStats
  }

  input ChangeStats {
    """Files changed"""
    filesChanged: Int!
    
    """Lines added"""
    additions: Int!
    
    """Lines deleted"""
    deletions: Int!
  }

  # Performance Monitoring Types

  type PerformanceReport {
    """Aggregated metrics by operation"""
    operations: [OperationMetrics!]!
    
    """Comparison of parallel vs sequential execution"""
    parallelComparison: ParallelComparison
    
    """Time range of the report"""
    timeRange: TimeRange!
    
    """Total operations tracked"""
    totalOperations: Int!
  }

  type OperationMetrics {
    """Operation name"""
    operation: String!
    
    """Number of executions"""
    count: Int!
    
    """Total duration in milliseconds"""
    totalDuration: Float!
    
    """Average duration in milliseconds"""
    averageDuration: Float!
    
    """Minimum duration in milliseconds"""
    minDuration: Float!
    
    """Maximum duration in milliseconds"""
    maxDuration: Float!
    
    """95th percentile duration"""
    p95Duration: Float!
    
    """99th percentile duration"""
    p99Duration: Float!
    
    """Success rate percentage"""
    successRate: Float!
  }

  type ParallelComparison {
    """Metrics for parallel execution"""
    parallel: OperationMetrics
    
    """Metrics for sequential execution"""
    sequential: OperationMetrics
    
    """Speed improvement factor (sequential/parallel)"""
    speedup: Float!
    
    """Efficiency percentage"""
    efficiency: Float!
  }

  type TimeRange {
    """Start time of the range"""
    start: String!
    
    """End time of the range"""
    end: String!
    
    """Duration in minutes"""
    durationMinutes: Int!
  }

  # Progress Tracking Types

  type AgentRunProgress {
    """Run ID this progress update is for"""
    runId: ID!
    
    """Repository being processed"""
    repository: String!
    
    """Current stage of processing"""
    stage: ProgressStage!
    
    """Progress percentage (0-100)"""
    percentage: Float!
    
    """Estimated time remaining in seconds"""
    estimatedTimeRemaining: Int
    
    """Current operation description"""
    currentOperation: String
    
    """Timestamp of this update"""
    timestamp: String!
    
    """Whether this run is complete"""
    isComplete: Boolean!
    
    """Error if any occurred"""
    error: String
  }

  type BatchProgress {
    """Batch ID for this group of operations"""
    batchId: ID!
    
    """Total number of operations in batch"""
    totalOperations: Int!
    
    """Number of completed operations"""
    completedOperations: Int!
    
    """Number of failed operations"""
    failedOperations: Int!
    
    """Overall progress percentage"""
    overallPercentage: Float!
    
    """Individual run progress"""
    runProgress: [AgentRunProgress!]!
    
    """Estimated total time remaining"""
    estimatedTimeRemaining: Int
    
    """Batch start time"""
    startTime: String!
    
    """Whether batch is complete"""
    isComplete: Boolean!
  }

  enum ProgressStage {
    """Queued for processing"""
    QUEUED
    
    """Initializing Claude session"""
    INITIALIZING
    
    """Loading context and files"""
    LOADING_CONTEXT
    
    """Processing with Claude"""
    PROCESSING
    
    """Parsing response"""
    PARSING_RESPONSE
    
    """Saving results"""
    SAVING_RESULTS
    
    """Completed successfully"""
    COMPLETED
    
    """Failed with error"""
    FAILED
    
    """Cancelled by user"""
    CANCELLED
  }
`;