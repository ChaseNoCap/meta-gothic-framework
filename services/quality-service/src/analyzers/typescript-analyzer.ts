import * as ts from 'typescript';
import { readFile } from 'fs/promises';
import { createHash } from 'crypto';
import path from 'path';
import type { Violation } from '../types/index';
import type { BaseAnalyzer } from './base-analyzer';

export interface TypeScriptAnalyzerOptions {
  configFile?: string;
  strictMode?: boolean;
  includeDeclarations?: boolean;
  skipLibCheck?: boolean;
}

export class TypeScriptAnalyzer implements BaseAnalyzer {
  private options: TypeScriptAnalyzerOptions;
  private program: ts.Program | null = null;
  private languageService: ts.LanguageService | null = null;

  constructor(options: TypeScriptAnalyzerOptions = {}) {
    this.options = options;
  }

  /**
   * Analyze a single file and return violations
   */
  async analyzeFile(filePath: string): Promise<Violation[]> {
    try {
      // Only analyze TypeScript files
      const ext = path.extname(filePath);
      if (!['.ts', '.tsx'].includes(ext)) {
        return [];
      }

      // Get or create the TypeScript program
      const program = await this.getProgram([filePath]);
      const sourceFile = program.getSourceFile(filePath);
      
      if (!sourceFile) {
        return [];
      }

      // Get diagnostics for the file
      const diagnostics = [
        ...program.getSyntacticDiagnostics(sourceFile),
        ...program.getSemanticDiagnostics(sourceFile)
      ];

      // If declarations are included, get declaration diagnostics
      if (this.options.includeDeclarations) {
        diagnostics.push(...program.getDeclarationDiagnostics(sourceFile));
      }

      // Convert diagnostics to violations
      return this.mapDiagnosticsToViolations(diagnostics, filePath);
    } catch (error) {
      console.error(`Error analyzing TypeScript file ${filePath}:`, error);
      return [];
    }
  }

  /**
   * Analyze multiple files
   */
  async analyzeFiles(filePaths: string[]): Promise<Map<string, Violation[]>> {
    const violationMap = new Map<string, Violation[]>();

    // Filter to only TypeScript files
    const tsFiles = filePaths.filter(fp => {
      const ext = path.extname(fp);
      return ['.ts', '.tsx'].includes(ext);
    });

    if (tsFiles.length === 0) {
      return violationMap;
    }

    try {
      // Create a single program for all files
      const program = await this.getProgram(tsFiles);

      for (const filePath of tsFiles) {
        const sourceFile = program.getSourceFile(filePath);
        if (!sourceFile) continue;

        const diagnostics = [
          ...program.getSyntacticDiagnostics(sourceFile),
          ...program.getSemanticDiagnostics(sourceFile)
        ];

        if (this.options.includeDeclarations) {
          diagnostics.push(...program.getDeclarationDiagnostics(sourceFile));
        }

        const violations = this.mapDiagnosticsToViolations(diagnostics, filePath);
        violationMap.set(filePath, violations);
      }
    } catch (error) {
      console.error('Error analyzing TypeScript files:', error);
    }

    return violationMap;
  }

  /**
   * TypeScript doesn't have auto-fix capability built-in
   */
  async fixFile(filePath: string): Promise<{ fixed: boolean; violations: Violation[] }> {
    // TypeScript compiler doesn't provide auto-fix functionality
    // Could potentially implement code fixes using the Language Service API
    // but that's more complex and context-dependent
    const violations = await this.analyzeFile(filePath);
    return { fixed: false, violations };
  }

  /**
   * Get or create TypeScript program
   */
  private async getProgram(fileNames: string[]): Promise<ts.Program> {
    // Parse tsconfig.json if provided
    let compilerOptions: ts.CompilerOptions = this.getDefaultCompilerOptions();
    
    if (this.options.configFile) {
      const configPath = path.resolve(this.options.configFile);
      const configFile = ts.readConfigFile(configPath, ts.sys.readFile);
      
      if (!configFile.error) {
        const parsedConfig = ts.parseJsonConfigFileContent(
          configFile.config,
          ts.sys,
          path.dirname(configPath)
        );
        compilerOptions = parsedConfig.options;
      }
    }

    // Apply analyzer-specific options
    if (this.options.strictMode !== undefined) {
      compilerOptions.strict = this.options.strictMode;
    }
    if (this.options.skipLibCheck !== undefined) {
      compilerOptions.skipLibCheck = this.options.skipLibCheck;
    }

    // Create program
    this.program = ts.createProgram(fileNames, compilerOptions);
    return this.program;
  }

  /**
   * Get default TypeScript compiler options
   */
  private getDefaultCompilerOptions(): ts.CompilerOptions {
    return {
      target: ts.ScriptTarget.ES2022,
      module: ts.ModuleKind.CommonJS,
      lib: ['es2022'],
      strict: true,
      esModuleInterop: true,
      skipLibCheck: true,
      forceConsistentCasingInFileNames: true,
      resolveJsonModule: true,
      allowJs: false,
      checkJs: false,
      noEmit: true,
      // Additional strict checks
      noImplicitAny: true,
      strictNullChecks: true,
      strictFunctionTypes: true,
      strictBindCallApply: true,
      strictPropertyInitialization: true,
      noImplicitThis: true,
      alwaysStrict: true,
      // Error reporting
      noUnusedLocals: true,
      noUnusedParameters: true,
      noImplicitReturns: true,
      noFallthroughCasesInSwitch: true,
      noUncheckedIndexedAccess: true,
      exactOptionalPropertyTypes: true
    };
  }

  /**
   * Map TypeScript diagnostics to violations
   */
  private mapDiagnosticsToViolations(diagnostics: ts.Diagnostic[], filePath: string): Violation[] {
    const violations: Violation[] = [];

    for (const diagnostic of diagnostics) {
      // Skip diagnostics without file information
      if (!diagnostic.file) continue;

      const { line, character } = diagnostic.file.getLineAndCharacterOfPosition(
        diagnostic.start || 0
      );

      const message = ts.flattenDiagnosticMessageText(
        diagnostic.messageText,
        '\n'
      );

      violations.push({
        id: this.generateViolationId(filePath, diagnostic),
        fileId: '', // Will be set by the quality engine
        rule: `TS${diagnostic.code}`,
        severity: this.mapDiagnosticCategory(diagnostic.category),
        message: message,
        lineNumber: line + 1, // TypeScript uses 0-based line numbers
        columnNumber: character + 1,
        toolType: 'typescript',
        autoFixable: false, // TypeScript doesn't provide auto-fix
        status: 'active',
        createdAt: new Date(),
        resolvedAt: null,
        resolvedBy: null
      });
    }

    return violations;
  }

  /**
   * Generate unique violation ID
   */
  private generateViolationId(filePath: string, diagnostic: ts.Diagnostic): string {
    const hash = createHash('md5');
    hash.update(filePath);
    hash.update(String(diagnostic.code));
    hash.update(String(diagnostic.start || 0));
    hash.update(ts.flattenDiagnosticMessageText(diagnostic.messageText, ''));
    
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
   * Map TypeScript diagnostic category to our severity
   */
  private mapDiagnosticCategory(category: ts.DiagnosticCategory): 'error' | 'warning' | 'info' {
    switch (category) {
      case ts.DiagnosticCategory.Error:
        return 'error';
      case ts.DiagnosticCategory.Warning:
        return 'warning';
      case ts.DiagnosticCategory.Suggestion:
      case ts.DiagnosticCategory.Message:
      default:
        return 'info';
    }
  }

  /**
   * Get the tool type identifier
   */
  getToolType(): string {
    return 'typescript';
  }

  /**
   * Get quick fixes for a diagnostic using Language Service
   */
  async getQuickFixes(filePath: string, lineNumber: number, columnNumber: number): Promise<ts.CodeFixAction[]> {
    // This would require implementing a full Language Service
    // which is beyond the scope of this basic analyzer
    return [];
  }
}