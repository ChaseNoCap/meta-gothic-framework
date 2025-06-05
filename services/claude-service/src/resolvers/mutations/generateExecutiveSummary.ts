import type { Context } from '../../types/context.js';
import type { 
  ExecutiveSummaryInput,
  ExecutiveSummaryResult,
  Theme,
  RiskLevel,
  ImpactLevel
} from '../../types/generated.js';

/**
 * GraphQL resolver for executive summary generation
 * Analyzes multiple commit messages to create a high-level summary
 */
export async function generateExecutiveSummary(
  _parent: unknown,
  { input }: { input: ExecutiveSummaryInput },
  context: Context
): Promise<ExecutiveSummaryResult> {
  const { sessionManager } = context;
  
  try {
    // For now, generate a summary based on the input data
    // In production, this would call Claude API
    const parsedSummary = generateMockExecutiveSummary(input);
    
    return {
      success: true,
      summary: parsedSummary.summary,
      error: null,
      metadata: {
        repositoryCount: input.commitMessages.length,
        totalChanges: calculateTotalChanges(input.commitMessages),
        themes: parsedSummary.themes,
        riskLevel: parsedSummary.riskLevel,
        suggestedActions: parsedSummary.suggestedActions
      }
    };
  } catch (error: any) {
    console.error('Failed to generate executive summary:', error);
    
    return {
      success: false,
      summary: null,
      error: error.message || 'Failed to generate executive summary',
      metadata: {
        repositoryCount: input.commitMessages.length,
        totalChanges: calculateTotalChanges(input.commitMessages),
        themes: [],
        riskLevel: 'LOW' as RiskLevel,
        suggestedActions: []
      }
    };
  }
}

/**
 * Build the executive summary prompt with all context
 */
function buildExecutiveSummaryPrompt(input: ExecutiveSummaryInput): string {
  const commitDetails = input.commitMessages.map(cm => {
    const stats = cm.stats ? `(+${cm.stats.additions} -${cm.stats.deletions} in ${cm.stats.filesChanged} files)` : '';
    return `Repository: ${cm.repository}\nMessage: ${cm.message}\nStats: ${stats}`;
  }).join('\n\n');
  
  const audience = input.audience || 'technical team';
  const maxLength = input.maxLength || 500;
  const focusAreas = input.focusAreas?.length ? input.focusAreas.join(', ') : 'all areas';
  
  return `Generate an executive summary for the following repository changes.

Target Audience: ${audience}
Maximum Length: ${maxLength} words
Focus Areas: ${focusAreas}
${input.includeRiskAssessment ? '\nInclude a risk assessment of the changes.' : ''}
${input.includeRecommendations ? '\nInclude recommendations for next steps.' : ''}

Repository Changes:
${commitDetails}

Generate a structured executive summary that:
1. Identifies key themes and patterns across all changes
2. Highlights the most impactful modifications
3. ${input.includeRiskAssessment ? 'Assesses potential risks (LOW/MEDIUM/HIGH/CRITICAL)' : ''}
4. ${input.includeRecommendations ? 'Provides actionable recommendations' : ''}
5. Uses clear, concise language appropriate for ${audience}

Format the response as JSON with the following structure:
{
  "summary": "Executive summary text here",
  "themes": [
    {
      "name": "Theme name",
      "description": "Theme description",
      "affectedRepositories": ["repo1", "repo2"],
      "impact": "MINOR|MODERATE|MAJOR|CRITICAL"
    }
  ],
  "riskLevel": "LOW|MEDIUM|HIGH|CRITICAL",
  "suggestedActions": ["Action 1", "Action 2"]
}`;
}

/**
 * Parse the executive summary from Claude's response
 */
function parseExecutiveSummary(
  rawSummary: string, 
  input: ExecutiveSummaryInput
): {
  summary: string;
  themes: Theme[];
  riskLevel: RiskLevel;
  suggestedActions: string[];
} {
  try {
    // First, check if this is a Claude result wrapper
    let summaryData: any;
    try {
      const wrapper = JSON.parse(rawSummary);
      if (wrapper.type === 'result' && wrapper.result) {
        // Extract JSON from the result field, which may be wrapped in ```json...```
        const resultStr = wrapper.result;
        const jsonMatch = resultStr.match(/```json\s*([\s\S]*?)\s*```/);
        if (jsonMatch) {
          summaryData = JSON.parse(jsonMatch[1]);
        } else {
          summaryData = JSON.parse(resultStr);
        }
      } else {
        summaryData = wrapper;
      }
    } catch {
      // If not wrapped, try to parse directly
      summaryData = JSON.parse(rawSummary);
    }
    
    return {
      summary: summaryData.summary || rawSummary,
      themes: (summaryData.themes || []).map((t: any) => ({
        name: t.name || 'Unknown Theme',
        description: t.description || '',
        affectedRepositories: t.affectedRepositories || [],
        impact: (t.impact || 'MINOR') as ImpactLevel
      })),
      riskLevel: (summaryData.riskLevel || 'LOW') as RiskLevel,
      suggestedActions: summaryData.suggestedActions || []
    };
  } catch {
    // Fallback for non-JSON responses
    return {
      summary: extractSummaryText(rawSummary),
      themes: extractThemes(rawSummary, input),
      riskLevel: extractRiskLevel(rawSummary),
      suggestedActions: extractActions(rawSummary)
    };
  }
}

/**
 * Extract summary text from non-JSON response
 */
function extractSummaryText(text: string): string {
  // Remove any JSON-like structures or metadata
  const cleaned = text.replace(/```[\s\S]*?```/g, '')
    .replace(/\{[\s\S]*?\}/g, '')
    .trim();
  
  // Take the first substantive paragraph
  const paragraphs = cleaned.split('\n\n').filter(p => p.length > 50);
  return paragraphs[0] || text.slice(0, 500);
}

/**
 * Extract themes from text analysis
 */
function extractThemes(text: string, input: ExecutiveSummaryInput): Theme[] {
  const themes: Theme[] = [];
  
  // Look for common patterns
  if (text.toLowerCase().includes('feature') || text.toLowerCase().includes('new')) {
    themes.push({
      name: 'New Features',
      description: 'New functionality has been added',
      affectedRepositories: input.commitMessages
        .filter(cm => cm.message.toLowerCase().includes('feat'))
        .map(cm => cm.repository),
      impact: 'MODERATE' as ImpactLevel
    });
  }
  
  if (text.toLowerCase().includes('fix') || text.toLowerCase().includes('bug')) {
    themes.push({
      name: 'Bug Fixes',
      description: 'Issues have been resolved',
      affectedRepositories: input.commitMessages
        .filter(cm => cm.message.toLowerCase().includes('fix'))
        .map(cm => cm.repository),
      impact: 'MINOR' as ImpactLevel
    });
  }
  
  return themes;
}

/**
 * Extract risk level from text
 */
function extractRiskLevel(text: string): RiskLevel {
  const lowerText = text.toLowerCase();
  
  if (lowerText.includes('critical') || lowerText.includes('breaking')) {
    return 'CRITICAL' as RiskLevel;
  } else if (lowerText.includes('high risk') || lowerText.includes('significant')) {
    return 'HIGH' as RiskLevel;
  } else if (lowerText.includes('medium') || lowerText.includes('moderate')) {
    return 'MEDIUM' as RiskLevel;
  }
  
  return 'LOW' as RiskLevel;
}

/**
 * Extract suggested actions from text
 */
function extractActions(text: string): string[] {
  const actions: string[] = [];
  
  // Look for action-oriented phrases
  const actionPhrases = [
    /should\s+([^.]+)/gi,
    /recommend\s+([^.]+)/gi,
    /suggest\s+([^.]+)/gi,
    /consider\s+([^.]+)/gi
  ];
  
  actionPhrases.forEach(regex => {
    const matches = text.matchAll(regex);
    for (const match of matches) {
      if (match[1]) {
        actions.push(match[1].trim());
      }
    }
  });
  
  return actions.slice(0, 5); // Limit to 5 actions
}

/**
 * Calculate total changes from commit messages
 */
function calculateTotalChanges(commitMessages: Array<{ stats?: { filesChanged: number } }>): number {
  return commitMessages.reduce((total, cm) => {
    return total + (cm.stats?.filesChanged || 0);
  }, 0);
}

/**
 * Generate a mock executive summary based on input data
 * This is a temporary implementation until Claude API is integrated
 */
function generateMockExecutiveSummary(input: ExecutiveSummaryInput): {
  summary: string;
  themes: Theme[];
  riskLevel: RiskLevel;
  suggestedActions: string[];
} {
  const totalRepos = input.commitMessages.length;
  const totalAdditions = input.commitMessages.reduce((sum, cm) => sum + (cm.stats?.additions || 0), 0);
  const totalDeletions = input.commitMessages.reduce((sum, cm) => sum + (cm.stats?.deletions || 0), 0);
  const totalFiles = input.commitMessages.reduce((sum, cm) => sum + (cm.stats?.filesChanged || 0), 0);
  
  // Analyze commit types
  const commitTypes = input.commitMessages.reduce((types, cm) => {
    const type = cm.message.split(':')[0].toLowerCase();
    types[type] = (types[type] || 0) + 1;
    return types;
  }, {} as Record<string, number>);
  
  // Generate themes based on commit analysis
  const themes: Theme[] = [];
  
  if (commitTypes.feat > 0) {
    themes.push({
      name: 'New Features',
      description: `${commitTypes.feat} new features added across the repositories`,
      affectedRepositories: input.commitMessages
        .filter(cm => cm.message.toLowerCase().startsWith('feat'))
        .map(cm => cm.repository),
      impact: commitTypes.feat > 2 ? 'MAJOR' : 'MODERATE' as ImpactLevel
    });
  }
  
  if (commitTypes.fix > 0) {
    themes.push({
      name: 'Bug Fixes',
      description: `${commitTypes.fix} bug fixes implemented`,
      affectedRepositories: input.commitMessages
        .filter(cm => cm.message.toLowerCase().startsWith('fix'))
        .map(cm => cm.repository),
      impact: 'MINOR' as ImpactLevel
    });
  }
  
  if (commitTypes.refactor > 0) {
    themes.push({
      name: 'Code Refactoring',
      description: `${commitTypes.refactor} refactoring changes made`,
      affectedRepositories: input.commitMessages
        .filter(cm => cm.message.toLowerCase().startsWith('refactor'))
        .map(cm => cm.repository),
      impact: 'MODERATE' as ImpactLevel
    });
  }
  
  // Determine risk level based on changes
  let riskLevel: RiskLevel = 'LOW';
  if (totalFiles > 100 || totalAdditions > 1000) {
    riskLevel = 'HIGH';
  } else if (totalFiles > 50 || totalAdditions > 500) {
    riskLevel = 'MEDIUM';
  }
  
  // Generate summary text
  const summary = `This update encompasses ${totalRepos} repositories with a total of ${totalAdditions} additions and ${totalDeletions} deletions across ${totalFiles} files. The changes primarily focus on ${themes.map(t => t.name.toLowerCase()).join(', ') || 'general improvements'}. ${riskLevel === 'HIGH' ? 'Due to the extensive nature of these changes, careful testing is recommended.' : riskLevel === 'MEDIUM' ? 'These changes are moderate in scope and should be reviewed thoroughly.' : 'The changes are limited in scope with minimal risk.'}`;
  
  // Generate suggested actions
  const suggestedActions: string[] = [];
  
  if (riskLevel === 'HIGH' || riskLevel === 'MEDIUM') {
    suggestedActions.push('Conduct thorough testing of affected features');
  }
  
  if (commitTypes.feat > 0) {
    suggestedActions.push('Update documentation for new features');
    suggestedActions.push('Consider user training for new functionality');
  }
  
  if (totalFiles > 50) {
    suggestedActions.push('Review code changes for consistency and standards compliance');
  }
  
  if (input.includeRecommendations) {
    suggestedActions.push('Schedule a team review of the changes');
    suggestedActions.push('Monitor system performance after deployment');
  }
  
  return {
    summary,
    themes,
    riskLevel,
    suggestedActions: suggestedActions.slice(0, 5) // Limit to 5 actions
  };
}