import type { GraphQLContext } from '../../graphql/context.js';

interface QualitySuggestionsArgs {
  path: string;
}

export async function qualitySuggestions(
  _parent: unknown,
  args: QualitySuggestionsArgs,
  context: GraphQLContext
) {
  const { path } = args;
  const { engine } = context;

  try {
    const result = await engine.getSuggestionsForFile(path);
    
    // Convert violations to quality suggestions
    const suggestions = [];
    
    // High impact: Errors
    const errors = result.violations.filter(v => v.severity === 'error');
    if (errors.length > 0) {
      suggestions.push({
        file: path,
        suggestion: `Fix ${errors.length} error${errors.length > 1 ? 's' : ''} to improve code reliability`,
        impact: 'HIGH',
        effort: 'MODERATE',
        category: 'MAINTAINABILITY'
      });
    }
    
    // Medium impact: Warnings
    const warnings = result.violations.filter(v => v.severity === 'warning');
    if (warnings.length > 0) {
      suggestions.push({
        file: path,
        suggestion: `Address ${warnings.length} warning${warnings.length > 1 ? 's' : ''} to enhance code quality`,
        impact: 'MEDIUM',
        effort: 'MINIMAL',
        category: 'MAINTAINABILITY'
      });
    }
    
    // Auto-fixable violations
    if (result.autoFixableCount > 0) {
      suggestions.push({
        file: path,
        suggestion: `Apply auto-fixes to resolve ${result.autoFixableCount} violation${result.autoFixableCount > 1 ? 's' : ''} automatically`,
        impact: 'MEDIUM',
        effort: 'MINIMAL',
        category: 'MAINTAINABILITY'
      });
    }
    
    // Add general suggestions from the engine
    result.suggestions.forEach(suggestion => {
      suggestions.push({
        file: path,
        suggestion,
        impact: 'LOW',
        effort: 'MODERATE',
        category: 'DOCUMENTATION'
      });
    });
    
    return suggestions;
  } catch (error) {
    console.error('Error getting quality suggestions:', error);
    throw new Error('Failed to get quality suggestions');
  }
}