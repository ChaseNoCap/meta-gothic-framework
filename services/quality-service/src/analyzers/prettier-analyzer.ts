import { format, check, getFileInfo, resolveConfig, Options } from 'prettier';
import { readFile } from 'fs/promises';
import { createHash } from 'crypto';
import path from 'path';
import type { Violation } from '../types/index';
import type { BaseAnalyzer } from './base-analyzer';

export interface PrettierAnalyzerOptions {
  configFile?: string;
  defaultOptions?: Options;
  checkOnly?: boolean;
  extensions?: string[];
}

export class PrettierAnalyzer implements BaseAnalyzer {
  private options: PrettierAnalyzerOptions;
  private defaultConfig: Options;

  constructor(options: PrettierAnalyzerOptions = {}) {
    this.options = options;
    
    // Default Prettier configuration
    this.defaultConfig = options.defaultOptions || {
      printWidth: 80,
      tabWidth: 2,
      useTabs: false,
      semi: true,
      singleQuote: true,
      quoteProps: 'as-needed',
      jsxSingleQuote: false,
      trailingComma: 'es5',
      bracketSpacing: true,
      jsxBracketSameLine: false,
      arrowParens: 'always',
      proseWrap: 'preserve',
      htmlWhitespaceSensitivity: 'css',
      endOfLine: 'lf'
    };
  }

  /**
   * Analyze a single file and return violations
   */
  async analyzeFile(filePath: string): Promise<Violation[]> {
    try {
      // Check if file is supported by Prettier
      const fileInfo = await getFileInfo(filePath);
      if (fileInfo.ignored || !fileInfo.inferredParser) {
        return [];
      }

      // Check if we should analyze this file type
      if (this.options.extensions) {
        const ext = path.extname(filePath);
        if (!this.options.extensions.includes(ext)) {
          return [];
        }
      }

      // Read file content
      const content = await readFile(filePath, 'utf-8');
      
      // Resolve Prettier config for this file
      const config = await this.resolveConfig(filePath);
      
      // Check if file is formatted
      const isFormatted = await check(content, {
        ...config,
        filepath: filePath
      });

      if (isFormatted) {
        return [];
      }

      // File is not formatted, create violation
      const violation: Violation = {
        id: this.generateViolationId(filePath, 'prettier-format'),
        fileId: '', // Will be set by the quality engine
        rule: 'prettier/prettier',
        severity: 'warning',
        message: 'File is not formatted according to Prettier rules',
        lineNumber: 1,
        columnNumber: 1,
        toolType: 'prettier',
        autoFixable: true,
        status: 'active',
        createdAt: new Date(),
        resolvedAt: null,
        resolvedBy: null
      };

      // If we want more detailed information, we can format and diff
      if (!this.options.checkOnly) {
        try {
          const formatted = await format(content, {
            ...config,
            filepath: filePath
          });
          
          // Could add line-by-line diff here if needed
          const lines = content.split('\n');
          const formattedLines = formatted.split('\n');
          
          // Find first line that differs
          for (let i = 0; i < Math.max(lines.length, formattedLines.length); i++) {
            if (lines[i] !== formattedLines[i]) {
              violation.lineNumber = i + 1;
              violation.message = `Line ${i + 1}: Formatting issue detected`;
              break;
            }
          }
        } catch (error) {
          // If formatting fails, keep the generic message
          console.error(`Error formatting file ${filePath}:`, error);
        }
      }

      return [violation];
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

    for (const filePath of filePaths) {
      const violations = await this.analyzeFile(filePath);
      violationMap.set(filePath, violations);
    }

    return violationMap;
  }

  /**
   * Apply auto-fixes to a file
   */
  async fixFile(filePath: string): Promise<{ fixed: boolean; violations: Violation[] }> {
    try {
      // Check if file is supported
      const fileInfo = await getFileInfo(filePath);
      if (fileInfo.ignored || !fileInfo.inferredParser) {
        return { fixed: false, violations: [] };
      }

      // Read file content
      const content = await readFile(filePath, 'utf-8');
      
      // Resolve config
      const config = await this.resolveConfig(filePath);
      
      // Check if already formatted
      const isFormatted = await check(content, {
        ...config,
        filepath: filePath
      });

      if (isFormatted) {
        return { fixed: false, violations: [] };
      }

      // Format the file
      const formatted = await format(content, {
        ...config,
        filepath: filePath
      });

      // Write formatted content
      const { writeFile } = await import('fs/promises');
      await writeFile(filePath, formatted, 'utf-8');

      return { fixed: true, violations: [] };
    } catch (error) {
      console.error(`Error fixing file ${filePath}:`, error);
      
      // Return the violation if fix failed
      const violations = await this.analyzeFile(filePath);
      return { fixed: false, violations };
    }
  }

  /**
   * Resolve Prettier configuration for a file
   */
  private async resolveConfig(filePath: string): Promise<Options> {
    try {
      // Try to resolve config from file path
      const resolvedConfig = await resolveConfig(filePath, {
        config: this.options.configFile
      });

      if (resolvedConfig) {
        return { ...this.defaultConfig, ...resolvedConfig };
      }
    } catch (error) {
      console.error('Error resolving Prettier config:', error);
    }

    return this.defaultConfig;
  }

  /**
   * Generate a unique ID for a violation
   */
  private generateViolationId(filePath: string, rule: string): string {
    const hash = createHash('md5');
    hash.update(filePath);
    hash.update(rule);
    hash.update('prettier-formatting');
    hash.update(new Date().toISOString());
    
    const hex = hash.digest('hex');
    // Format as UUID
    return [
      hex.substring(0, 8),
      hex.substring(8, 12),
      hex.substring(12, 16),
      hex.substring(16, 20),
      hex.substring(20, 32)
    ].join('-');
  }

  /**
   * Get the tool type identifier
   */
  getToolType(): string {
    return 'prettier';
  }

  /**
   * Get supported file extensions
   */
  getSupportedExtensions(): string[] {
    return this.options.extensions || [
      '.js', '.jsx', '.ts', '.tsx',
      '.json', '.css', '.scss', '.less',
      '.html', '.vue', '.angular',
      '.graphql', '.markdown', '.md',
      '.yaml', '.yml'
    ];
  }
}