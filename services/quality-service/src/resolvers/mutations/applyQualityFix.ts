import { readFile } from 'fs/promises';
import type { GraphQLContext } from '../../graphql/context.js';

interface ApplyQualityFixInput {
  path: string;
  violationId: string;
  preview?: boolean;
}

export async function applyQualityFix(
  _parent: unknown,
  args: { input: ApplyQualityFixInput },
  context: GraphQLContext
) {
  const { path, violationId, preview = true } = args.input;
  const { engine } = context;

  try {
    // Get current content
    const originalContent = await readFile(path, 'utf-8');
    
    // Get violations for the file
    const analysis = await engine.getFileAnalysis(path);
    
    // Find the specific violation
    const violation = analysis.violations.find(v => 
      `${v.rule}-${v.lineNumber}-${v.columnNumber}` === violationId
    );
    
    if (!violation) {
      return {
        success: false,
        originalContent,
        fixedContent: originalContent,
        violation: null,
        error: 'Violation not found'
      };
    }

    if (!violation.autoFixable) {
      return {
        success: false,
        originalContent,
        fixedContent: originalContent,
        violation: {
          id: violationId,
          tool: violation.toolType,
          rule: violation.rule,
          severity: violation.severity,
          message: violation.message,
          line: violation.lineNumber,
          column: violation.columnNumber,
          endLine: violation.endLine,
          endColumn: violation.endColumn,
          fixable: false,
          suggestions: []
        },
        error: 'Violation is not auto-fixable'
      };
    }

    // If preview mode, just return what would be fixed
    if (preview) {
      return {
        success: false,
        originalContent,
        fixedContent: originalContent, // Would be modified by the fix
        violation: {
          id: violationId,
          tool: violation.toolType,
          rule: violation.rule,
          severity: violation.severity,
          message: violation.message,
          line: violation.lineNumber,
          column: violation.columnNumber,
          endLine: violation.endLine,
          endColumn: violation.endColumn,
          fixable: true,
          suggestions: []
        },
        error: null
      };
    }

    // Apply the fix
    const fixResult = await engine.applyAutoFix(path, violation.toolType);
    
    if (fixResult.fixed) {
      const fixedContent = await readFile(path, 'utf-8');
      
      return {
        success: true,
        originalContent,
        fixedContent,
        violation: {
          id: violationId,
          tool: violation.toolType,
          rule: violation.rule,
          severity: violation.severity,
          message: violation.message,
          line: violation.lineNumber,
          column: violation.columnNumber,
          endLine: violation.endLine,
          endColumn: violation.endColumn,
          fixable: true,
          suggestions: []
        },
        error: null
      };
    } else {
      return {
        success: false,
        originalContent,
        fixedContent: originalContent,
        violation: {
          id: violationId,
          tool: violation.toolType,
          rule: violation.rule,
          severity: violation.severity,
          message: violation.message,
          line: violation.lineNumber,
          column: violation.columnNumber,
          endLine: violation.endLine,
          endColumn: violation.endColumn,
          fixable: true,
          suggestions: []
        },
        error: 'Failed to apply fix'
      };
    }
  } catch (error) {
    console.error('Error applying quality fix:', error);
    throw new Error('Failed to apply quality fix');
  }
}