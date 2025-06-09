import { ESLint } from 'eslint';
import { createHash } from 'crypto';
import type { Violation } from '../types/index.js';
import type { BaseAnalyzer } from './base-analyzer.js';

export interface ESLintAnalyzerOptions {
  configFile?: string;
  fix?: boolean;
  cache?: boolean;
  cacheLocation?: string;
  extensions?: string[];
}

export class ESLintAnalyzer implements BaseAnalyzer {
  private eslint: ESLint;

  constructor(options: ESLintAnalyzerOptions = {}) {
    
    // Initialize ESLint with configuration
    this.eslint = new ESLint({
      fix: options.fix || false,
      cache: options.cache || false,
      cacheLocation: options.cacheLocation || '.eslintcache',
      ...(options.configFile && { overrideConfigFile: options.configFile })
    });
  }

  /**
   * Analyze a single file and return violations
   */
  async analyzeFile(filePath: string): Promise<Violation[]> {
    try {
      // Check if file should be ignored
      const isIgnored = await this.eslint.isPathIgnored(filePath);
      if (isIgnored) {
        return [];
      }

      // Lint the file
      const results = await this.eslint.lintFiles([filePath]);
      
      if (results.length === 0) {
        return [];
      }

      const result = results[0];
      if (!result) {
        return [];
      }
      return this.mapESLintResultToViolations(result);
    } catch (error) {
      console.error(`Error analyzing file ${filePath}:`, error);
      return [];
    }
  }

  /**
   * Analyze multiple files
   */
  async analyzeFiles(filePaths: string[]): Promise<Map<string, Violation[]>> {
    const violationMap = new Map<string, Violation[]>();

    try {
      // Filter out ignored files
      const filesToLint = [];
      for (const filePath of filePaths) {
        const isIgnored = await this.eslint.isPathIgnored(filePath);
        if (!isIgnored) {
          filesToLint.push(filePath);
        }
      }

      if (filesToLint.length === 0) {
        return violationMap;
      }

      // Lint all files
      const results = await this.eslint.lintFiles(filesToLint);

      // Map results to violations
      for (const result of results) {
        const violations = this.mapESLintResultToViolations(result);
        violationMap.set(result.filePath, violations);
      }

      return violationMap;
    } catch (error) {
      console.error('Error analyzing files:', error);
      return violationMap;
    }
  }

  /**
   * Apply auto-fixes to a file
   */
  async fix(filePath: string): Promise<{ fixed: boolean; violations: Violation[] }> {
    try {
      // Create a new ESLint instance with fix enabled
      const eslintWithFix = new ESLint({
        fix: true,
        cache: false
      });

      const results = await eslintWithFix.lintFiles([filePath]);
      
      if (results.length === 0) {
        return { fixed: false, violations: [] };
      }

      const result = results[0];
      if (!result) {
        return { fixed: false, violations: [] };
      }
      
      // Write the fixed content if any fixes were applied
      if (result.output) {
        await ESLint.outputFixes(results);
      }

      const violations = this.mapESLintResultToViolations(result);
      return { 
        fixed: result.output !== undefined, 
        violations 
      };
    } catch (error) {
      console.error(`Error fixing file ${filePath}:`, error);
      return { fixed: false, violations: [] };
    }
  }

  /**
   * Map ESLint results to our Violation format
   */
  private mapESLintResultToViolations(result: ESLint.LintResult): Violation[] {
    const violations: Violation[] = [];

    for (const message of result.messages) {
      violations.push({
        id: this.generateViolationId(result.filePath, message),
        fileId: '', // Will be set by the quality engine
        rule: message.ruleId || 'unknown',
        severity: this.mapSeverity(message.severity),
        message: message.message,
        lineNumber: message.line || null,
        columnNumber: message.column || null,
        toolType: 'eslint',
        autoFixable: message.fix !== undefined,
        status: 'active',
        createdAt: new Date(),
        resolvedAt: null,
        resolvedBy: null
      });
    }

    return violations;
  }

  /**
   * Generate a unique ID for a violation
   */
  private generateViolationId(filePath: string, message: any): string {
    // Generate a UUID-like string from violation details
    const hash = createHash('md5');
    hash.update(filePath);
    hash.update(message.ruleId || 'unknown');
    hash.update(String(message.line || 0));
    hash.update(String(message.column || 0));
    hash.update(message.message);
    
    const hex = hash.digest('hex');
    // Format as UUID: xxxxxxxx-xxxx-xxxx-xxxx-xxxxxxxxxxxx
    return [
      hex.substring(0, 8),
      hex.substring(8, 12),
      hex.substring(12, 16),
      hex.substring(16, 20),
      hex.substring(20, 32)
    ].join('-');
  }

  /**
   * Map ESLint severity to our severity levels
   */
  private mapSeverity(eslintSeverity: number): 'error' | 'warning' | 'info' {
    switch (eslintSeverity) {
      case 2:
        return 'error';
      case 1:
        return 'warning';
      default:
        return 'info';
    }
  }


  /**
   * Get ESLint formatter
   */
  async formatResults(results: ESLint.LintResult[]): Promise<string> {
    const formatter = await this.eslint.loadFormatter('stylish');
    return formatter.format(results, {
      cwd: process.cwd(),
      rulesMeta: {}
    });
  }

  /**
   * Get the tool type identifier
   */
  getToolType(): string {
    return 'eslint';
  }
}