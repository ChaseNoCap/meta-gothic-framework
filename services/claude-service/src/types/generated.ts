// This file should be generated from GraphQL schema
// For now, we'll define basic types manually

export type SessionStatus = 'ACTIVE' | 'PROCESSING' | 'IDLE' | 'TERMINATED' | 'ERROR';
export type OutputType = 'STDOUT' | 'STDERR' | 'SYSTEM' | 'PROGRESS' | 'FINAL';
export type RiskLevel = 'LOW' | 'MEDIUM' | 'HIGH' | 'CRITICAL';
export type ImpactLevel = 'MINOR' | 'MODERATE' | 'MAJOR' | 'CRITICAL';
export type RunStatus = 'QUEUED' | 'RUNNING' | 'SUCCESS' | 'FAILED' | 'CANCELLED' | 'RETRYING';

export interface ClaudeSession {
  id: string;
  createdAt: string;
  lastActivity: string;
  status: SessionStatus;
  pid: number | null;
  workingDirectory: string;
  metadata: SessionMetadata;
  history: CommandHistoryItem[];
}

export interface SessionMetadata {
  projectContext?: string;
  model: string;
  tokenUsage: TokenUsage;
  flags: string[];
}

export interface TokenUsage {
  inputTokens: number;
  outputTokens: number;
  estimatedCost: number;
}

export interface CommandHistoryItem {
  timestamp: string;
  prompt: string;
  response?: string;
  executionTime: number;
  success: boolean;
}

export interface HealthStatus {
  healthy: boolean;
  version: string;
  claudeAvailable: boolean;
  claudeVersion: string | null;
  activeSessions: number;
  resources: ResourceUsage;
}

export interface ResourceUsage {
  memoryUsage: number;
  cpuUsage: number;
  activeProcesses: number;
}

export interface ClaudeExecuteInput {
  prompt: string;
  sessionId?: string;
  workingDirectory?: string;
  context?: ContextInput;
  options?: CommandOptions;
}

export interface ContextInput {
  files?: string[];
  projectContext?: string;
  instructions?: string;
  maxTokens?: number;
}

export interface CommandOptions {
  model?: string;
  temperature?: number;
  maxTokens?: number;
  customFlags?: string[];
  stream?: boolean;
}

export interface ClaudeExecuteResult {
  sessionId: string;
  success: boolean;
  error: string | null;
  initialResponse: string | null;
  metadata: ExecutionMetadata;
}

export interface ExecutionMetadata {
  startTime: string;
  pid?: number;
  estimatedTime?: number;
  flags: string[];
}

export interface CommandOutput {
  sessionId: string;
  type: OutputType;
  content: string;
  timestamp: string;
  isFinal: boolean;
  tokens?: number;
}

export interface ContinueSessionInput {
  sessionId: string;
  prompt: string;
  additionalContext?: ContextInput;
}

export interface HandoffInput {
  sessionId: string;
  target?: string;
  notes?: string;
  includeFullHistory?: boolean;
}

export interface HandoffResult {
  success: boolean;
  documentPath: string | null;
  content: string | null;
  error: string | null;
  sessionSummary: SessionSummary;
}

export interface SessionSummary {
  interactionCount: number;
  totalTokens: number;
  topics: string[];
  filesModified: string[];
}

export interface BatchCommitMessageInput {
  repositories: RepositoryCommitInfo[];
  styleGuide?: CommitStyleGuide;
  globalContext?: string;
  analyzeRelationships?: boolean;
}

export interface RepositoryCommitInfo {
  path: string;
  name: string;
  diff: string;
  filesChanged: string[];
  recentCommits?: string[];
  context?: string;
}

export interface CommitStyleGuide {
  format?: string;
  maxLength?: number;
  includeScope?: boolean;
  includeBody?: boolean;
  examples?: string[];
}

export interface BatchCommitMessageResult {
  totalRepositories: number;
  successCount: number;
  results: CommitMessageResult[];
  totalTokenUsage: TokenUsage;
  executionTime: number;
}

export interface CommitMessageResult {
  repositoryPath: string;
  repositoryName: string;
  success: boolean;
  message: string | null;
  error: string | null;
  confidence?: number;
  commitType?: string | null;
}

export interface ExecutiveSummaryInput {
  commitMessages: CommitMessageInfo[];
  audience?: string;
  maxLength?: number;
  focusAreas?: string[];
  includeRiskAssessment?: boolean;
  includeRecommendations?: boolean;
}

export interface CommitMessageInfo {
  repository: string;
  message: string;
  stats?: ChangeStats;
}

export interface ChangeStats {
  filesChanged: number;
  additions: number;
  deletions: number;
}

export interface ExecutiveSummaryResult {
  success: boolean;
  summary: string | null;
  error: string | null;
  metadata: SummaryMetadata;
}

export interface SummaryMetadata {
  repositoryCount: number;
  totalChanges: number;
  themes: Theme[];
  riskLevel: RiskLevel;
  suggestedActions: string[];
}

export interface Theme {
  name: string;
  description: string;
  affectedRepositories: string[];
  impact: ImpactLevel;
}

export interface AgentRun {
  id: string;
  repository: string;
  status: RunStatus;
  startedAt: Date;
  completedAt?: Date;
  duration?: number;
  input: AgentInput;
  output?: AgentOutput;
  error?: RunError;
  retryCount: number;
  parentRunId?: string;
}

export interface AgentInput {
  prompt: string;
  diff: string;
  recentCommits: string[];
  model: string;
  temperature: number;
}

export interface AgentOutput {
  message: string;
  confidence: number;
  reasoning?: string;
  rawResponse: string;
  tokensUsed: number;
}

export interface RunError {
  code: string;
  message: string;
  stackTrace?: string;
  recoverable: boolean;
}