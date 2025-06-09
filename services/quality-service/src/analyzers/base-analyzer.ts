import type { Violation } from '../types/index';

/**
 * Base interface for all code analyzers
 */
export interface BaseAnalyzer {
  /**
   * Analyze a single file and return violations
   */
  analyzeFile(filePath: string): Promise<Violation[]>;

  /**
   * Analyze multiple files and return a map of file paths to violations
   */
  analyzeFiles(filePaths: string[]): Promise<Map<string, Violation[]>>;

  /**
   * Apply auto-fixes to a file if supported
   */
  fixFile?(filePath: string): Promise<{ fixed: boolean; violations: Violation[] }>;

  /**
   * Get the tool type identifier
   */
  getToolType(): string;
}

/**
 * Options for configuring analyzers
 */
export interface AnalyzerOptions {
  configFile?: string;
  enabled?: boolean;
  severity?: 'error' | 'warning' | 'info';
  fix?: boolean;
  cache?: boolean;
}

/**
 * Registry for managing multiple analyzers
 */
export class AnalyzerRegistry {
  private analyzers: Map<string, BaseAnalyzer> = new Map();

  /**
   * Register an analyzer
   */
  register(name: string, analyzer: BaseAnalyzer): void {
    this.analyzers.set(name, analyzer);
  }

  /**
   * Get an analyzer by name
   */
  get(name: string): BaseAnalyzer | undefined {
    return this.analyzers.get(name);
  }

  /**
   * Get all registered analyzers
   */
  getAll(): BaseAnalyzer[] {
    return Array.from(this.analyzers.values());
  }

  /**
   * Get all analyzer names
   */
  getNames(): string[] {
    return Array.from(this.analyzers.keys());
  }

  /**
   * Check if an analyzer is registered
   */
  has(name: string): boolean {
    return this.analyzers.has(name);
  }

  /**
   * Remove an analyzer
   */
  remove(name: string): boolean {
    return this.analyzers.delete(name);
  }

  /**
   * Clear all analyzers
   */
  clear(): void {
    this.analyzers.clear();
  }

  /**
   * Analyze a file with all registered analyzers
   */
  async analyzeFileWithAll(filePath: string): Promise<Violation[]> {
    const allViolations: Violation[] = [];

    for (const analyzer of this.analyzers.values()) {
      try {
        const violations = await analyzer.analyzeFile(filePath);
        allViolations.push(...violations);
      } catch (error) {
        console.error(`Error in analyzer ${analyzer.getToolType()}:`, error);
      }
    }

    return allViolations;
  }
}