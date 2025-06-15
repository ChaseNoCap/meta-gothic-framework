import { QueryResult, Pool, PoolClient } from 'pg';
import { createHash } from 'crypto';
import { readFile } from 'fs/promises';
import type { 
  QualityFile, 
  Violation, 
  QualitySession, 
  ProcessingContext, 
  QualityResult,
  DetailedMetrics,
  QualityMetric,
  TimeRange,
  QualityTrend,
  ViolationPattern,
  QualityConfig
} from '../types/index.js';
import { AnalyzerRegistry } from '../analyzers/base-analyzer.js';
import { ESLintAnalyzer } from '../analyzers/eslint-analyzer.js';
import { PrettierAnalyzer } from '../analyzers/prettier-analyzer.js';
import { TypeScriptAnalyzer } from '../analyzers/typescript-analyzer.js';

export class TimescaleQualityEngine {
  private pool: Pool;
  private config: QualityConfig;
  private analyzers: AnalyzerRegistry;

  constructor(config: QualityConfig) {
    this.config = config;
    this.pool = new Pool({
      connectionString: config.database.connectionString,
      max: config.database.poolSize || 10,
      statement_timeout: config.database.statementTimeout || 30000,
      query_timeout: config.database.queryTimeout || 30000,
    });

    // Initialize analyzer registry
    this.analyzers = new AnalyzerRegistry();
    this.setupAnalyzers();
  }

  async connect(): Promise<void> {
    // Test connection
    const client = await this.pool.connect();
    try {
      await client.query('SELECT NOW()');
    } finally {
      client.release();
    }
  }

  async disconnect(): Promise<void> {
    await this.pool.end();
  }

  async processFile(filePath: string, context: ProcessingContext): Promise<QualityResult> {
    const session = await this.createSessionFromContext(context);
    const client = await this.pool.connect();
    
    try {
      await this.recordSessionActivity(client, session.id, 'file_processing_started', {
        filePath,
        context
      });

      const violations = await this.analyzeFile(filePath);
      const fileHash = await this.getFileHash(filePath);
      
      await client.query('BEGIN');
      
      await this.updateCurrentState(client, filePath, fileHash, violations, session.id);
      const metrics = await this.recordQualityMetrics(client, filePath, violations, session.id);
      await this.recordViolationEvents(client, filePath, violations, session.id);
      
      await this.updateSessionStats(client, session.id, 1, violations.length, 0);
      
      await client.query('COMMIT');

      await this.recordSessionActivity(client, session.id, 'file_processing_completed', {
        filePath,
        violationCount: violations.length,
        qualityScore: metrics.qualityScore
      });
      
      return { 
        session, 
        violations,
        metrics
      };
    } catch (error) {
      await client.query('ROLLBACK');
      await this.recordSessionActivity(
        client,
        session.id, 
        'file_processing_error', 
        { 
          filePath,
          error: error instanceof Error ? error.message : 'Unknown error' 
        }
      );
      throw error;
    } finally {
      client.release();
    }
  }

  async createSessionFromContext(context: ProcessingContext): Promise<QualitySession> {
    const result: QueryResult<QualitySession> = await this.pool.query(`
      INSERT INTO quality_sessions (session_type, triggered_by, context)
      VALUES ($1, $2, $3)
      RETURNING *
    `, [context.sessionType, context.triggeredBy, JSON.stringify(context)]);

    return this.mapSession(result.rows[0]);
  }

  async completeSession(sessionId: string, status: 'completed' | 'failed'): Promise<void> {
    await this.pool.query(`
      UPDATE quality_sessions 
      SET status = $1, completed_at = NOW()
      WHERE id = $2
    `, [status, sessionId]);
  }

  /**
   * Get a specific analyzer by name
   */
  getAnalyzer(name: string): any {
    return this.analyzers.get(name);
  }

  /**
   * Apply auto-fixes for a specific file
   */
  async fixFile(filePath: string, analyzerName: string = 'eslint'): Promise<{ fixed: boolean; violations: Violation[] }> {
    const analyzer = this.analyzers.get(analyzerName);
    if (!analyzer) {
      return { fixed: false, violations: [] };
    }

    return analyzer.fix(filePath);
  }

  private setupAnalyzers(): void {
    // Register ESLint analyzer
    const eslintAnalyzer = new ESLintAnalyzer({
      ...(this.config.analysis?.eslintConfig && { configFile: this.config.analysis.eslintConfig }),
      cache: true,
      fix: false
    });
    this.analyzers.register('eslint', eslintAnalyzer);

    // Register Prettier analyzer
    const prettierAnalyzer = new PrettierAnalyzer({
      ...(this.config.analysis?.prettierConfig && { configFile: this.config.analysis.prettierConfig }),
      checkOnly: false
    });
    this.analyzers.register('prettier', prettierAnalyzer);

    // Register TypeScript analyzer
    const typeScriptAnalyzer = new TypeScriptAnalyzer({
      configFile: this.config.analysis?.tsconfigPath || './tsconfig.json',
      strictMode: true,
      skipLibCheck: true
    });
    this.analyzers.register('typescript', typeScriptAnalyzer);
  }

  private async analyzeFile(filePath: string): Promise<Violation[]> {
    // Use all registered analyzers to analyze the file
    return this.analyzers.analyzeFileWithAll(filePath);
  }

  private async getFileHash(filePath: string): Promise<string> {
    try {
      const content = await readFile(filePath, 'utf-8');
      return createHash('sha256').update(content).digest('hex');
    } catch (error) {
      // If file doesn't exist or can't be read, return a placeholder
      return createHash('sha256').update(filePath + Date.now()).digest('hex');
    }
  }

  private calculateQualityScore(violations: Violation[]): number {
    if (violations.length === 0) return 10.0;
    
    const errorWeight = this.config.scoring?.errorWeight || 3;
    const warningWeight = this.config.scoring?.warningWeight || 1;
    const infoWeight = this.config.scoring?.infoWeight || 0.1;
    const maxScore = this.config.scoring?.maxScore || 10;
    
    const weightedViolations = violations.reduce((sum, v) => {
      switch (v.severity) {
        case 'error': return sum + errorWeight;
        case 'warning': return sum + warningWeight;
        case 'info': return sum + infoWeight;
        default: return sum;
      }
    }, 0);
    
    return Math.max(0, maxScore - (weightedViolations * 0.5));
  }

  private async updateCurrentState(
    client: PoolClient,
    filePath: string,
    fileHash: string,
    violations: Violation[], 
    _sessionId: string
  ): Promise<QualityFile> {
    const fileResult: QueryResult<{ id: string }> = await client.query(`
      INSERT INTO files (path, hash, last_modified, current_quality_score, active_violation_count)
      VALUES ($1, $2, NOW(), $3, $4)
      ON CONFLICT (path) 
      DO UPDATE SET 
        hash = EXCLUDED.hash,
        last_modified = EXCLUDED.last_modified,
        current_quality_score = EXCLUDED.current_quality_score,
        active_violation_count = EXCLUDED.active_violation_count,
        updated_at = NOW()
      RETURNING id
    `, [
      filePath, 
      fileHash,
      this.calculateQualityScore(violations), 
      violations.length
    ]);
    
    const fileId = fileResult.rows[0]?.id;
    if (!fileId) throw new Error('Failed to create or update file');
    
    // Clear existing violations
    await client.query('DELETE FROM current_violations WHERE file_id = $1', [fileId]);
    
    // Insert new violations
    if (violations.length > 0) {
      const violationValues = violations.map((_, i) => 
        `($${i * 8 + 1}, $${i * 8 + 2}, $${i * 8 + 3}, $${i * 8 + 4}, $${i * 8 + 5}, $${i * 8 + 6}, $${i * 8 + 7}, $${i * 8 + 8})`
      ).join(',');
      
      const violationParams = violations.flatMap(v => [
        fileId, v.rule, v.severity, v.message, 
        v.lineNumber, v.columnNumber, v.toolType, v.autoFixable
      ]);
      
      await client.query(`
        INSERT INTO current_violations 
        (file_id, rule, severity, message, line_number, column_number, tool_type, auto_fixable)
        VALUES ${violationValues}
      `, violationParams);
    }
    
    // Return the file info
    const fileInfo = await client.query(`
      SELECT * FROM files WHERE id = $1
    `, [fileId]);
    
    return this.mapFile(fileInfo.rows[0]);
  }

  private async recordQualityMetrics(
    client: PoolClient,
    filePath: string, 
    violations: Violation[], 
    sessionId: string
  ): Promise<QualityMetric> {
    const metrics = await this.calculateDetailedMetrics(filePath, violations);
    
    const result = await client.query(`
      INSERT INTO quality_metrics 
      (time, file_path, session_id, quality_score, violation_count, complexity_score, maintainability_score, metadata)
      VALUES (NOW(), $1, $2, $3, $4, $5, $6, $7)
      RETURNING *
    `, [
      filePath,
      sessionId,
      metrics.qualityScore,
      violations.length,
      metrics.complexityScore,
      metrics.maintainabilityScore,
      JSON.stringify({ 
        violations_by_type: metrics.violationsByType,
        violations_by_severity: metrics.violationsBySeverity
      })
    ]);
    
    return this.mapMetric(result.rows[0]);
  }

  private async recordViolationEvents(
    client: PoolClient,
    filePath: string, 
    violations: Violation[], 
    sessionId: string
  ): Promise<void> {
    const previousViolations = await this.getPreviousViolations(client, filePath);
    const events = this.generateViolationEvents(violations, previousViolations);
    
    if (events.length > 0) {
      const eventValues = events.map((_, i) => 
        `(NOW(), $${i * 7 + 1}, $${i * 7 + 2}, $${i * 7 + 3}, $${i * 7 + 4}, $${i * 7 + 5}, $${i * 7 + 6}, $${i * 7 + 7})`
      ).join(',');
      
      const eventParams = events.flatMap(e => [
        filePath, sessionId, e.type, e.violationId, e.rule, e.severity, JSON.stringify(e.metadata)
      ]);
      
      await client.query(`
        INSERT INTO violation_events 
        (time, file_path, session_id, event_type, violation_id, rule, severity, metadata)
        VALUES ${eventValues}
      `, eventParams);
    }
  }

  private async recordSessionActivity(
    client: PoolClient,
    sessionId: string, 
    activityType: string, 
    details: Record<string, unknown>
  ): Promise<void> {
    await client.query(`
      INSERT INTO session_activities (time, session_id, activity_type, details, success)
      VALUES (NOW(), $1, $2, $3, $4)
    `, [sessionId, activityType, JSON.stringify(details), !activityType.includes('error')]);
  }

  private async updateSessionStats(
    client: PoolClient,
    sessionId: string,
    filesChecked: number,
    violationsFound: number,
    violationsFixed: number
  ): Promise<void> {
    await client.query(`
      UPDATE quality_sessions 
      SET 
        total_files_checked = total_files_checked + $2,
        total_violations_found = total_violations_found + $3,
        total_violations_fixed = total_violations_fixed + $4
      WHERE id = $1
    `, [sessionId, filesChecked, violationsFound, violationsFixed]);
  }

  private async calculateDetailedMetrics(
    _filePath: string, 
    violations: Violation[]
  ): Promise<DetailedMetrics> {
    const violationsByType = violations.reduce((acc, v) => {
      acc[v.toolType] = (acc[v.toolType] || 0) + 1;
      return acc;
    }, {} as Record<string, number>);

    const violationsBySeverity = violations.reduce((acc, v) => {
      acc[v.severity] = (acc[v.severity] || 0) + 1;
      return acc;
    }, {} as Record<string, number>);

    return {
      qualityScore: this.calculateQualityScore(violations),
      complexityScore: 5.0, // TODO: Implement actual complexity analysis
      maintainabilityScore: 7.0, // TODO: Implement actual maintainability analysis
      violationsByType,
      violationsBySeverity
    };
  }

  private async getPreviousViolations(client: PoolClient, filePath: string): Promise<Violation[]> {
    const result: QueryResult = await client.query(`
      SELECT cv.* FROM current_violations cv
      JOIN files f ON cv.file_id = f.id
      WHERE f.path = $1
    `, [filePath]);
    
    return result.rows.map(this.mapViolation);
  }

  private generateViolationEvents(
    current: Violation[], 
    _previous: Violation[]
  ): Array<{
    type: string;
    violationId: string | null;
    rule: string;
    severity: string;
    metadata: Record<string, unknown>;
  }> {
    // For now, just track all current violations as created
    // TODO: Implement proper diffing to detect fixed/modified violations
    return current.map(v => ({
      type: 'created',
      violationId: v.id,
      rule: v.rule,
      severity: v.severity,
      metadata: { 
        toolType: v.toolType,
        autoFixable: v.autoFixable
      }
    }));
  }

  // Public query methods

  async getQualityTrends(filePath: string, timeRange: TimeRange): Promise<QualityTrend[]> {
    const bucket = timeRange.bucket || 'hour';
    const result = await this.pool.query(`
      SELECT 
        time_bucket($1, time) as time,
        avg(quality_score) as avg_quality_score,
        avg(violation_count) as avg_violation_count,
        count(*) as sample_count
      FROM quality_metrics
      WHERE file_path = $2 
        AND time >= $3 
        AND time <= $4
      GROUP BY time_bucket($1, time)
      ORDER BY time
    `, [`1 ${bucket}`, filePath, timeRange.start, timeRange.end]);
    
    return result.rows.map(row => ({
      time: row.time,
      avgQualityScore: parseFloat(row.avg_quality_score),
      avgViolationCount: parseFloat(row.avg_violation_count),
      sampleCount: parseInt(row.sample_count)
    }));
  }

  async getViolationPatterns(filePath: string, days: number = 30): Promise<ViolationPattern[]> {
    const result = await this.pool.query(`
      SELECT 
        rule,
        tool_type,
        count(*) as frequency,
        NULL as avg_resolution_hours
      FROM violation_events
      WHERE file_path = $1 
        AND event_type = 'created' 
        AND time >= NOW() - INTERVAL '${days} days'
      GROUP BY rule, tool_type
      ORDER BY frequency DESC
      LIMIT 10
    `, [filePath]);
    
    return result.rows.map(row => ({
      rule: row.rule,
      toolType: row.tool_type,
      frequency: parseInt(row.frequency),
      avgResolutionHours: row.avg_resolution_hours ? parseFloat(row.avg_resolution_hours) : null
    }));
  }

  // Mapping functions to convert DB rows to typed objects

  private mapSession(row: any): QualitySession {
    return {
      id: row.id,
      sessionType: row.session_type,
      triggeredBy: row.triggered_by,
      status: row.status,
      startedAt: new Date(row.started_at),
      completedAt: row.completed_at ? new Date(row.completed_at) : null,
      context: row.context,
      totalFilesChecked: row.total_files_checked || 0,
      totalViolationsFound: row.total_violations_found || 0,
      totalViolationsFixed: row.total_violations_fixed || 0
    };
  }

  private mapFile(row: any): QualityFile {
    return {
      id: row.id,
      path: row.path,
      hash: row.hash,
      lastModified: new Date(row.last_modified),
      currentQualityScore: row.current_quality_score,
      activeViolationCount: row.active_violation_count,
      createdAt: new Date(row.created_at),
      updatedAt: new Date(row.updated_at)
    };
  }

  private mapViolation(row: any): Violation {
    return {
      id: row.id,
      fileId: row.file_id,
      rule: row.rule,
      severity: row.severity,
      message: row.message,
      lineNumber: row.line_number,
      columnNumber: row.column_number,
      toolType: row.tool_type,
      autoFixable: row.auto_fixable,
      status: row.status,
      createdAt: new Date(row.created_at),
      resolvedAt: row.resolved_at ? new Date(row.resolved_at) : null,
      resolvedBy: row.resolved_by
    };
  }

  private mapMetric(row: any): QualityMetric {
    return {
      time: new Date(row.time),
      filePath: row.file_path,
      sessionId: row.session_id,
      qualityScore: row.quality_score,
      violationCount: row.violation_count,
      complexityScore: row.complexity_score,
      maintainabilityScore: row.maintainability_score,
      testCoverage: row.test_coverage,
      toolType: row.tool_type,
      metadata: row.metadata
    };
  }

  // MCP Integration Methods

  async recordMCPEvent(event: {
    eventType: string;
    toolName: string;
    sessionId: string;
    payload?: any;
  }): Promise<void> {
    // Convert 'system' to null for UUID column
    const sessionId = event.sessionId === 'system' ? null : event.sessionId;
    
    await this.pool.query(`
      INSERT INTO mcp_events (time, event_type, session_id, client_type, event_data)
      VALUES (NOW(), $1, $2, $3, $4)
    `, [
      event.eventType,
      sessionId,
      `mcp:${event.toolName}`,
      JSON.stringify(event.payload || {})
    ]);
  }

  async createSession(sessionType: string, metadata?: any): Promise<QualitySession> {
    const result = await this.pool.query(`
      INSERT INTO quality_sessions (session_type, triggered_by, status, context)
      VALUES ($1, $2, $3, $4)
      RETURNING *
    `, [
      sessionType,
      metadata?.triggeredBy || 'user',
      'in_progress',
      JSON.stringify(metadata || {})
    ]);
    
    return this.mapSession(result.rows[0]);
  }

  async updateSessionMetadata(sessionId: string, metadata: any): Promise<void> {
    await this.pool.query(`
      UPDATE quality_sessions 
      SET context = context || $2
      WHERE id = $1
    `, [sessionId, JSON.stringify(metadata)]);
  }

  async endSession(sessionId: string): Promise<void> {
    await this.pool.query(`
      UPDATE quality_sessions 
      SET status = 'completed', completed_at = NOW()
      WHERE id = $1
    `, [sessionId]);
  }

  async recordSessionActivityPublic(sessionId: string, activityType: string, details: any): Promise<void> {
    const client = await this.pool.connect();
    try {
      await this.recordSessionActivity(client, sessionId, activityType, details);
    } finally {
      client.release();
    }
  }

  async getFileAnalysis(filePath: string): Promise<{
    file: QualityFile | null;
    violations: Violation[];
    score: number;
  }> {
    const client = await this.pool.connect();
    try {
      // Get file info
      const fileResult = await client.query(
        'SELECT * FROM files WHERE path = $1',
        [filePath]
      );
      
      if (fileResult.rows.length === 0) {
        return { file: null, violations: [], score: 0 };
      }
      
      const file = this.mapFile(fileResult.rows[0]);
      
      // Get current violations
      const violationsResult = await client.query(
        'SELECT * FROM current_violations WHERE file_id = $1 AND status = $2',
        [file.id, 'active']
      );
      
      const violations = violationsResult.rows.map(row => this.mapViolation(row));
      
      return {
        file,
        violations,
        score: file.currentQualityScore || 0
      };
    } finally {
      client.release();
    }
  }

  async getSuggestionsForFile(filePath: string): Promise<{
    violations: Violation[];
    suggestions: string[];
    autoFixableCount: number;
  }> {
    const analysis = await this.getFileAnalysis(filePath);
    
    const autoFixableCount = analysis.violations.filter(v => v.autoFixable).length;
    
    const suggestions = this.generateSuggestions(analysis.violations);
    
    return {
      violations: analysis.violations,
      suggestions,
      autoFixableCount
    };
  }

  private generateSuggestions(violations: Violation[]): string[] {
    const suggestions: string[] = [];
    
    // Group violations by rule
    const violationsByRule = violations.reduce((acc, v) => {
      if (!acc[v.rule]) acc[v.rule] = [];
      acc[v.rule]!.push(v);
      return acc;
    }, {} as Record<string, Violation[]>);
    
    // Generate suggestions based on patterns
    for (const [rule, ruleViolations] of Object.entries(violationsByRule)) {
      if (ruleViolations.length > 3) {
        suggestions.push(`Consider disabling or configuring rule '${rule}' - found ${ruleViolations.length} violations`);
      }
      
      const autoFixable = ruleViolations.filter(v => v.autoFixable).length;
      if (autoFixable > 0) {
        suggestions.push(`Rule '${rule}' has ${autoFixable} auto-fixable violations`);
      }
    }
    
    // Tool-specific suggestions
    const toolCounts = violations.reduce((acc, v) => {
      acc[v.toolType] = (acc[v.toolType] || 0) + 1;
      return acc;
    }, {} as Record<string, number>);
    
    for (const [tool, count] of Object.entries(toolCounts)) {
      if (tool === 'eslint' && count > 10) {
        suggestions.push(`High number of ESLint violations (${count}). Consider running with --fix`);
      }
      if (tool === 'prettier' && count > 0) {
        suggestions.push(`Formatting issues detected. Run Prettier to fix automatically`);
      }
      if (tool === 'typescript' && count > 5) {
        suggestions.push(`Multiple TypeScript errors. Check type definitions and imports`);
      }
    }
    
    return suggestions;
  }

  async applyAutoFix(filePath: string, toolType?: string): Promise<{
    fixed: boolean;
    fixedCount: number;
    remainingViolations: Violation[];
  }> {
    const analysis = await this.getFileAnalysis(filePath);
    
    if (!analysis.file) {
      throw new Error(`File not found: ${filePath}`);
    }
    
    // Get auto-fixable violations
    let violationsToFix = analysis.violations.filter(v => v.autoFixable);
    
    if (toolType) {
      violationsToFix = violationsToFix.filter(v => v.toolType === toolType);
    }
    
    if (violationsToFix.length === 0) {
      return {
        fixed: false,
        fixedCount: 0,
        remainingViolations: analysis.violations
      };
    }
    
    // Group by tool and apply fixes
    const toolGroups = violationsToFix.reduce((acc, v) => {
      if (!acc[v.toolType]) acc[v.toolType] = [];
      acc[v.toolType]!.push(v);
      return acc;
    }, {} as Record<string, Violation[]>);
    
    let totalFixed = 0;
    
    for (const [tool, violations] of Object.entries(toolGroups)) {
      const analyzer = this.analyzers.get(tool);
      if (!analyzer || !analyzer.fix) continue;
      
      try {
        const result = await analyzer.fix(filePath);
        if (result.fixed) {
          totalFixed += violations.length;
        }
      } catch (error) {
        console.error(`Failed to apply ${tool} fixes:`, error);
      }
    }
    
    // Re-analyze to get remaining violations
    const newAnalysis = await this.analyzeFile(filePath);
    
    return {
      fixed: totalFixed > 0,
      fixedCount: totalFixed,
      remainingViolations: newAnalysis
    };
  }

  async isConnected(): Promise<boolean> {
    try {
      const client = await this.pool.connect();
      await client.query('SELECT 1');
      client.release();
      return true;
    } catch {
      return false;
    }
  }

  async getSession(sessionId: string): Promise<QualitySession | null> {
    const client = await this.pool.connect();
    try {
      const result = await client.query(`
        SELECT * FROM quality_sessions WHERE id = $1
      `, [sessionId]);
      
      return result.rows[0] ? this.mapSession(result.rows[0]) : null;
    } finally {
      client.release();
    }
  }

  async getRecentSessions(limit: number = 10): Promise<QualitySession[]> {
    const client = await this.pool.connect();
    try {
      const result = await client.query(`
        SELECT * FROM quality_sessions 
        ORDER BY start_time DESC 
        LIMIT $1
      `, [limit]);
      
      return result.rows.map(row => this.mapSession(row));
    } finally {
      client.release();
    }
  }

  async getFileQuality(path: string): Promise<any> {
    const analysis = await this.getFileAnalysis(path);
    
    if (!analysis.file) {
      return null;
    }

    return {
      path: analysis.file.path,
      hash: analysis.file.hash,
      score: analysis.score,
      violations: analysis.violations.map(v => ({
        id: `${v.rule}-${v.lineNumber}-${v.columnNumber}`,
        tool: v.toolType,
        rule: v.rule,
        severity: v.severity,
        message: v.message,
        line: v.lineNumber,
        column: v.columnNumber,
        endLine: v.endLine,
        endColumn: v.endColumn,
        fixable: v.autoFixable,
        suggestions: []
      })),
      lastChecked: analysis.file.updatedAt || new Date().toISOString(),
      trends: null
    };
  }

  async getFileViolations(path: string): Promise<Violation[]> {
    const analysis = await this.getFileAnalysis(path);
    return analysis.violations;
  }

  async getViolationStats(filters: {
    sessionId?: string;
    severity?: string;
    tool?: string;
  }): Promise<any> {
    const client = await this.pool.connect();
    try {
      let whereClause = 'WHERE 1=1';
      const params: any[] = [];
      let paramIndex = 1;

      if (filters.sessionId) {
        whereClause += ` AND session_id = $${paramIndex++}`;
        params.push(filters.sessionId);
      }
      if (filters.severity) {
        whereClause += ` AND severity = $${paramIndex++}`;
        params.push(filters.severity);
      }
      if (filters.tool) {
        whereClause += ` AND tool_type = $${paramIndex++}`;
        params.push(filters.tool);
      }

      // Get total count
      const totalResult = await client.query(`
        SELECT COUNT(*) as total FROM violation_events ${whereClause}
      `, params);
      const total = parseInt(totalResult.rows[0]?.total || '0');

      // Get by severity
      const severityResult = await client.query(`
        SELECT severity, COUNT(*) as count 
        FROM violation_events ${whereClause}
        GROUP BY severity
      `, params);

      // Get by tool
      const toolResult = await client.query(`
        SELECT tool_type as tool, COUNT(*) as count 
        FROM violation_events ${whereClause}
        GROUP BY tool_type
      `, params);

      // Get top rules
      const rulesResult = await client.query(`
        SELECT rule, tool_type as tool, COUNT(*) as count 
        FROM violation_events ${whereClause}
        GROUP BY rule, tool_type
        ORDER BY count DESC
        LIMIT 10
      `, params);

      // Get fixable count
      const fixableResult = await client.query(`
        SELECT COUNT(*) as count 
        FROM violation_events ${whereClause}
        AND auto_fixable = true
      `, params);
      const fixableCount = parseInt(fixableResult.rows[0]?.count || '0');

      return {
        total,
        bySeverity: severityResult.rows,
        byTool: toolResult.rows,
        topRules: rulesResult.rows,
        fixableCount
      };
    } finally {
      client.release();
    }
  }

  async getQualityThresholds(): Promise<any> {
    // Return default thresholds for now
    // In a real implementation, these would be stored in the database
    return {
      errorThreshold: 0,
      warningThreshold: 5,
      passingScore: 7.0
    };
  }

  async updateQualityThresholds(thresholds: any): Promise<void> {
    // In a real implementation, this would update the database
    // For now, just log the update
    console.log('Updating quality thresholds:', thresholds);
  }
}