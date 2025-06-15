// Core types and interfaces for the Quality Platform

export interface FileQuality {
  path: string;
  hash: string;
  score: number;
  violations: Violation[];
  lastChecked: string;
  trends?: any;
}

export interface QualityFile {
  id: string;
  path: string;
  hash: string;
  lastModified: Date;
  currentQualityScore: number | null;
  activeViolationCount: number;
  createdAt: Date;
  updatedAt: Date;
}

export interface Violation {
  id: string;
  fileId: string;
  rule: string;
  severity: 'error' | 'warning' | 'info';
  message: string;
  lineNumber: number | null;
  columnNumber: number | null;
  endLine?: number | null;
  endColumn?: number | null;
  toolType: string;
  autoFixable: boolean;
  status: 'active' | 'fixed' | 'ignored' | 'in_progress';
  createdAt: Date;
  resolvedAt: Date | null;
  resolvedBy: string | null;
}

export interface QualitySession {
  id: string;
  sessionType: 'INTERACTIVE' | 'HEADLESS' | 'REPORT' | 'WATCH';
  triggeredBy: string;
  status: 'in_progress' | 'completed' | 'failed';
  startedAt: Date;
  completedAt: Date | null;
  context: Record<string, unknown> | null;
  totalFilesChecked: number;
  totalViolationsFound: number;
  totalViolationsFixed: number;
}

export interface QualityMetric {
  time: Date;
  filePath: string;
  sessionId: string | null;
  qualityScore: number | null;
  violationCount: number | null;
  complexityScore: number | null;
  maintainabilityScore: number | null;
  testCoverage: number | null;
  toolType: string | null;
  metadata: Record<string, unknown> | null;
}

export interface ViolationEvent {
  time: Date;
  filePath: string;
  sessionId: string | null;
  eventType: 'created' | 'fixed' | 'ignored' | 'modified';
  violationId: string | null;
  rule: string | null;
  severity: string | null;
  toolType: string | null;
  autoFixable: boolean | null;
  resolvedBy: string | null;
  metadata: Record<string, unknown> | null;
}

export interface ProcessingContext {
  sessionType: QualitySession['sessionType'];
  triggeredBy: string;
  sessionId?: string;
  changeReason?: string;
  relatedFiles?: string[];
  workingDirectory?: string;
}

export interface QualityResult {
  session: QualitySession;
  violations: Violation[];
  metrics?: QualityMetric;
}

export interface DetailedMetrics {
  qualityScore: number;
  complexityScore: number;
  maintainabilityScore: number;
  violationsByType: Record<string, number>;
  violationsBySeverity: Record<string, number>;
}

export interface SessionActivity {
  time: Date;
  sessionId: string;
  activityType: string;
  filePath?: string;
  toolName?: string;
  durationMs?: number;
  success: boolean;
  details: Record<string, unknown> | null;
}

export interface MCPEvent {
  time: Date;
  eventType: string;
  sessionId?: string;
  clientType?: string;
  eventData: Record<string, unknown> | null;
}

// Tool-specific interfaces
export interface ESLintResult {
  filePath: string;
  messages: Array<{
    ruleId: string | null;
    severity: number;
    message: string;
    line: number;
    column: number;
    nodeType: string;
    messageId: string;
    endLine?: number;
    endColumn?: number;
    fix?: {
      range: [number, number];
      text: string;
    };
  }>;
  errorCount: number;
  warningCount: number;
  fixableErrorCount: number;
  fixableWarningCount: number;
  source?: string;
  output?: string;
}

export interface AnalysisOptions {
  includePatterns?: string[];
  excludePatterns?: string[];
  tools?: string[];
  fix?: boolean;
  cache?: boolean;
}

// Database query interfaces
export interface TimeRange {
  start: Date;
  end: Date;
  bucket?: 'minute' | 'hour' | 'day' | 'week' | 'month';
}

export interface QualityTrend {
  time: Date;
  avgQualityScore: number;
  avgViolationCount: number;
  sampleCount: number;
}

export interface ViolationPattern {
  rule: string;
  frequency: number;
  avgResolutionHours: number | null;
  toolType: string;
}

// Configuration interfaces
export interface QualityConfig {
  database: {
    connectionString: string;
    poolSize?: number;
    statementTimeout?: number;
    queryTimeout?: number;
  };
  analysis: {
    eslintConfig?: string;
    prettierConfig?: string;
    tsconfigPath?: string;
    customRules?: string[];
    excludePatterns?: string[];
  };
  scoring: {
    errorWeight?: number;
    warningWeight?: number;
    infoWeight?: number;
    maxScore?: number;
  };
  mcp?: {
    port?: number;
    heartbeatInterval?: number;
    sessionTimeout?: number;
  };
}

// Alias for convenience
export type Config = QualityConfig;