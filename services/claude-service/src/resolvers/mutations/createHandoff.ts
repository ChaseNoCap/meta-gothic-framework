import type { Context } from '../../types/context.js';
import type { HandoffInput, HandoffResult } from '../../types/generated.js';
import { writeFile } from 'fs/promises';
import { join } from 'path';

/**
 * Create a handoff document for session transfer
 */
export async function createHandoff(
  _parent: unknown,
  { input }: { input: HandoffInput },
  context: Context
): Promise<HandoffResult> {
  const { sessionManager, workspaceRoot } = context;
  
  try {
    const session = sessionManager.getSession(input.sessionId);
    if (!session) {
      return {
        success: false,
        documentPath: null,
        content: null,
        error: 'Session not found',
        sessionSummary: {
          interactionCount: 0,
          totalTokens: 0,
          topics: [],
          filesModified: []
        }
      };
    }
    
    // Generate handoff content
    const handoffContent = generateHandoffContent(session, input);
    
    // Save to file
    const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
    const filename = `handoff-${session.id}-${timestamp}.md`;
    const filepath = join(workspaceRoot, '.handoffs', filename);
    
    await writeFile(filepath, handoffContent, 'utf8');
    
    // Extract session summary
    const sessionSummary = extractSessionSummary(session);
    
    return {
      success: true,
      documentPath: filepath,
      content: handoffContent,
      error: null,
      sessionSummary
    };
  } catch (error: any) {
    return {
      success: false,
      documentPath: null,
      content: null,
      error: error.message || 'Failed to create handoff document',
      sessionSummary: {
        interactionCount: 0,
        totalTokens: 0,
        topics: [],
        filesModified: []
      }
    };
  }
}

/**
 * Generate handoff document content
 */
function generateHandoffContent(session: any, input: HandoffInput): string {
  const sections = [];
  
  // Header
  sections.push(`# Claude Session Handoff\n`);
  sections.push(`**Session ID:** ${session.id}`);
  sections.push(`**Created:** ${session.createdAt}`);
  sections.push(`**Last Activity:** ${session.lastActivity}`);
  sections.push(`**Target:** ${input.target || 'Next Developer'}\n`);
  
  // Notes
  if (input.notes) {
    sections.push(`## Notes\n${input.notes}\n`);
  }
  
  // Session Context
  sections.push(`## Session Context`);
  sections.push(`- **Working Directory:** ${session.workingDirectory}`);
  sections.push(`- **Model:** ${session.metadata.model}`);
  sections.push(`- **Status:** ${session.status}\n`);
  
  // History
  if (input.includeFullHistory && session.history.length > 0) {
    sections.push(`## Conversation History\n`);
    
    session.history.forEach((item: any, index: number) => {
      sections.push(`### Interaction ${index + 1}`);
      sections.push(`**Time:** ${item.timestamp}`);
      sections.push(`**Prompt:**\n\`\`\`\n${item.prompt}\n\`\`\``);
      if (item.response) {
        sections.push(`**Response:**\n\`\`\`\n${item.response}\n\`\`\``);
      }
      sections.push('');
    });
  } else {
    // Just summary
    sections.push(`## Summary`);
    sections.push(`Total interactions: ${session.history.length}`);
    sections.push(`Total tokens used: ${session.metadata.tokenUsage.inputTokens + session.metadata.tokenUsage.outputTokens}`);
  }
  
  // Token Usage
  sections.push(`## Resource Usage`);
  sections.push(`- **Input Tokens:** ${session.metadata.tokenUsage.inputTokens}`);
  sections.push(`- **Output Tokens:** ${session.metadata.tokenUsage.outputTokens}`);
  sections.push(`- **Estimated Cost:** $${session.metadata.tokenUsage.estimatedCost.toFixed(2)}`);
  
  return sections.join('\n');
}

/**
 * Extract session summary from session data
 */
function extractSessionSummary(session: any): any {
  const topics = extractTopics(session.history);
  const filesModified = extractModifiedFiles(session.history);
  
  return {
    interactionCount: session.history.length,
    totalTokens: session.metadata.tokenUsage.inputTokens + session.metadata.tokenUsage.outputTokens,
    topics,
    filesModified
  };
}

/**
 * Extract topics from conversation history
 */
function extractTopics(history: any[]): string[] {
  const topics = new Set<string>();
  
  history.forEach(item => {
    // Simple topic extraction based on keywords
    const prompt = item.prompt.toLowerCase();
    
    if (prompt.includes('commit')) topics.add('Git Operations');
    if (prompt.includes('test')) topics.add('Testing');
    if (prompt.includes('deploy')) topics.add('Deployment');
    if (prompt.includes('bug') || prompt.includes('fix')) topics.add('Bug Fixes');
    if (prompt.includes('feature')) topics.add('Feature Development');
    if (prompt.includes('refactor')) topics.add('Code Refactoring');
    if (prompt.includes('document')) topics.add('Documentation');
  });
  
  return Array.from(topics);
}

/**
 * Extract modified files from conversation history
 */
function extractModifiedFiles(history: any[]): string[] {
  const files = new Set<string>();
  
  history.forEach(item => {
    // Look for file paths in responses
    const filePathRegex = /[\/\w-]+\.(ts|js|tsx|jsx|json|md|yml|yaml)/g;
    const matches = (item.response || '').match(filePathRegex);
    
    if (matches) {
      matches.forEach((file: string) => files.add(file));
    }
  });
  
  return Array.from(files);
}

