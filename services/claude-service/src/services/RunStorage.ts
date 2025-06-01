import { v4 as uuidv4 } from 'uuid';
import * as fs from 'fs/promises';
import * as path from 'path';

export enum RunStatus {
  QUEUED = 'QUEUED',
  RUNNING = 'RUNNING',
  SUCCESS = 'SUCCESS',
  FAILED = 'FAILED',
  CANCELLED = 'CANCELLED',
  RETRYING = 'RETRYING',
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

export class RunStorage {
  private runs: Map<string, AgentRun> = new Map();
  private storageDir: string;
  private maxRetentionDays: number = 30;

  constructor(storageDir: string = '.agent-runs') {
    this.storageDir = storageDir;
    this.initializeStorage();
  }

  private async initializeStorage(): Promise<void> {
    try {
      await fs.mkdir(this.storageDir, { recursive: true });
      await this.loadExistingRuns();
    } catch (error) {
      console.error('Failed to initialize run storage:', error);
    }
  }

  private async loadExistingRuns(): Promise<void> {
    try {
      const files = await fs.readdir(this.storageDir);
      const runFiles = files.filter(f => f.endsWith('.json'));
      
      for (const file of runFiles) {
        try {
          const content = await fs.readFile(path.join(this.storageDir, file), 'utf-8');
          const run = JSON.parse(content, this.reviveDates);
          this.runs.set(run.id, run);
        } catch (error) {
          console.error(`Failed to load run from ${file}:`, error);
        }
      }
    } catch (error) {
      console.error('Failed to load existing runs:', error);
    }
  }

  private reviveDates(key: string, value: any): any {
    if (typeof value === 'string' && /^\d{4}-\d{2}-\d{2}T/.test(value)) {
      return new Date(value);
    }
    return value;
  }

  async saveRun(run: AgentRun): Promise<void> {
    this.runs.set(run.id, run);
    
    // Persist to file
    try {
      const filePath = path.join(this.storageDir, `${run.id}.json`);
      await fs.writeFile(filePath, JSON.stringify(run, null, 2));
    } catch (error) {
      console.error(`Failed to persist run ${run.id}:`, error);
    }
  }

  async getRun(id: string): Promise<AgentRun | null> {
    return this.runs.get(id) || null;
  }

  async getRunsByRepository(repository: string): Promise<AgentRun[]> {
    return Array.from(this.runs.values())
      .filter(run => run.repository === repository)
      .sort((a, b) => b.startedAt.getTime() - a.startedAt.getTime());
  }

  async getAllRuns(options?: {
    status?: RunStatus;
    startDate?: Date;
    endDate?: Date;
    limit?: number;
    offset?: number;
  }): Promise<{ runs: AgentRun[]; total: number }> {
    let runs = Array.from(this.runs.values());

    // Apply filters
    if (options?.status) {
      runs = runs.filter(run => run.status === options.status);
    }

    if (options?.startDate) {
      runs = runs.filter(run => run.startedAt >= options.startDate!);
    }

    if (options?.endDate) {
      runs = runs.filter(run => run.startedAt <= options.endDate!);
    }

    // Sort by most recent first
    runs.sort((a, b) => b.startedAt.getTime() - a.startedAt.getTime());

    const total = runs.length;

    // Apply pagination
    if (options?.offset !== undefined) {
      runs = runs.slice(options.offset);
    }

    if (options?.limit !== undefined) {
      runs = runs.slice(0, options.limit);
    }

    return { runs, total };
  }

  async retryRun(runId: string): Promise<AgentRun> {
    const originalRun = await this.getRun(runId);
    if (!originalRun) {
      throw new Error(`Run ${runId} not found`);
    }

    if (!originalRun.error?.recoverable) {
      throw new Error(`Run ${runId} is not recoverable`);
    }

    const newRun: AgentRun = {
      id: uuidv4(),
      repository: originalRun.repository,
      status: RunStatus.QUEUED,
      startedAt: new Date(),
      input: originalRun.input,
      retryCount: originalRun.retryCount + 1,
      parentRunId: runId,
    };

    await this.saveRun(newRun);
    
    // Update original run status
    originalRun.status = RunStatus.RETRYING;
    await this.saveRun(originalRun);

    return newRun;
  }

  async cancelRun(runId: string): Promise<AgentRun> {
    const run = await this.getRun(runId);
    if (!run) {
      throw new Error(`Run ${runId} not found`);
    }

    if (run.status !== RunStatus.RUNNING && run.status !== RunStatus.QUEUED) {
      throw new Error(`Cannot cancel run ${runId} with status ${run.status}`);
    }

    run.status = RunStatus.CANCELLED;
    run.completedAt = new Date();
    run.duration = run.completedAt.getTime() - run.startedAt.getTime();

    await this.saveRun(run);
    return run;
  }

  async deleteOldRuns(): Promise<number> {
    const cutoffDate = new Date();
    cutoffDate.setDate(cutoffDate.getDate() - this.maxRetentionDays);

    let deletedCount = 0;

    for (const [id, run] of this.runs.entries()) {
      if (run.startedAt < cutoffDate) {
        this.runs.delete(id);
        
        try {
          const filePath = path.join(this.storageDir, `${id}.json`);
          await fs.unlink(filePath);
          deletedCount++;
        } catch (error) {
          console.error(`Failed to delete run file ${id}:`, error);
        }
      }
    }

    return deletedCount;
  }

  async getRunStatistics(): Promise<{
    total: number;
    byStatus: Record<RunStatus, number>;
    byRepository: Record<string, number>;
    averageDuration: number;
    successRate: number;
  }> {
    const runs = Array.from(this.runs.values());
    const total = runs.length;

    const byStatus = runs.reduce((acc, run) => {
      acc[run.status] = (acc[run.status] || 0) + 1;
      return acc;
    }, {} as Record<RunStatus, number>);

    const byRepository = runs.reduce((acc, run) => {
      acc[run.repository] = (acc[run.repository] || 0) + 1;
      return acc;
    }, {} as Record<string, number>);

    const completedRuns = runs.filter(run => run.duration !== undefined);
    const averageDuration = completedRuns.length > 0
      ? completedRuns.reduce((sum, run) => sum + run.duration!, 0) / completedRuns.length
      : 0;

    const successCount = byStatus[RunStatus.SUCCESS] || 0;
    const failedCount = byStatus[RunStatus.FAILED] || 0;
    const successRate = successCount + failedCount > 0
      ? successCount / (successCount + failedCount)
      : 0;

    return {
      total,
      byStatus,
      byRepository,
      averageDuration,
      successRate,
    };
  }

  isRecoverable(error: any): boolean {
    // Determine if an error is recoverable based on error type
    const recoverableErrors = [
      'ETIMEDOUT',
      'ECONNREFUSED',
      'ECONNRESET',
      'RATE_LIMIT',
      'TIMEOUT',
    ];

    const errorCode = error.code || error.message || '';
    return recoverableErrors.some(code => errorCode.includes(code));
  }
}