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
} from '../types/index';
import { AnalyzerRegistry } from '../analyzers/base-analyzer';
import { ESLintAnalyzer } from '../analyzers/eslint-analyzer';
import { PrettierAnalyzer } from '../analyzers/prettier-analyzer';
import { TypeScriptAnalyzer } from '../analyzers/typescript-analyzer';

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
    const session = await this.createSession(context);
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

  async createSession(context: ProcessingContext): Promise<QualitySession> {
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
    if (!analyzer || !analyzer.fixFile) {
      return { fixed: false, violations: [] };
    }

    return analyzer.fixFile(filePath);
  }

  private setupAnalyzers(): void {
    // Register ESLint analyzer
    const eslintAnalyzer = new ESLintAnalyzer({
      configFile: this.config.analysis?.eslintConfig,
      cache: true,
      fix: false
    });
    this.analyzers.register('eslint', eslintAnalyzer);

    // Register Prettier analyzer
    const prettierAnalyzer = new PrettierAnalyzer({
      configFile: this.config.analysis?.prettierConfig,
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
        avg(EXTRACT(epoch FROM (resolved_at - time))/3600) as avg_resolution_hours
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
}