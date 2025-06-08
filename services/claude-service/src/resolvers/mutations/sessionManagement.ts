import { Context } from '../../types/context.js';
import { v4 as uuidv4 } from 'uuid';

// Fork a session from a specific point
export async function forkSession(
  _parent: unknown,
  { input }: { input: any },
  context: Context
) {
  const { sessionId, messageIndex, name, includeHistory } = input;
  
  console.log('[ForkSession] Input:', { sessionId, messageIndex, name, includeHistory });
  
  // Get the original session
  const originalSession = context.sessionManager.getSession(sessionId);
  if (!originalSession) {
    throw new Error(`Session ${sessionId} not found`);
  }
  
  console.log('[ForkSession] Original session history length:', originalSession.history?.length || 0);

  // Create a new session ID
  const forkedSessionId = uuidv4();
  
  // Get history up to the fork point
  const originalHistory = originalSession.history || [];
  const historyToInclude = includeHistory && messageIndex !== undefined && originalHistory.length > 0
    ? originalHistory.slice(0, messageIndex + 1)
    : includeHistory
    ? originalHistory
    : [];

  // Get the Claude session ID from the fork point message
  let forkPointClaudeSessionId = undefined;
  if (messageIndex !== undefined && originalHistory[messageIndex]) {
    forkPointClaudeSessionId = originalHistory[messageIndex].claudeSessionId;
    console.log('[ForkSession] Fork point details:', {
      messageIndex,
      historyEntry: {
        prompt: originalHistory[messageIndex].prompt?.substring(0, 50),
        response: originalHistory[messageIndex].response?.substring(0, 50),
        claudeSessionId: forkPointClaudeSessionId
      },
      totalHistoryLength: originalHistory.length
    });
  } else {
    console.log('[ForkSession] No specific fork point, using latest history');
  }

  // Create the forked session in the correct format for SessionData
  const forkedSessionData = {
    id: forkedSessionId,
    process: undefined,
    status: 'ACTIVE' as const, // Set to active so commands can be executed
    createdAt: new Date(),
    lastActivity: new Date(),
    workingDirectory: originalSession.workingDirectory,
    history: historyToInclude,
    metadata: {
      ...originalSession.metadata,
      claudeSessionId: forkPointClaudeSessionId, // Use the Claude session ID from the fork point!
      name: name || `Fork of ${originalSession.metadata?.name || 'Session'}`,
      forkedFrom: sessionId,
      forkPoint: messageIndex || (originalSession.history?.length || 0)
    }
  };

  // Store the forked session using the public method
  context.sessionManager.addSession(forkedSessionId, forkedSessionData);
  
  console.log('[ForkSession] Forked session history length:', forkedSessionData.history.length);
  console.log('[ForkSession] Forked session ID:', forkedSessionId);
  console.log('[ForkSession] First history entry:', forkedSessionData.history[0]);
  console.log('[ForkSession] Session manager type:', context.sessionManager.constructor.name);
  
  // Get the mapped version for return
  const forkedSession = context.sessionManager.getSession(forkedSessionId);
  console.log('[ForkSession] Retrieved forked session:', forkedSession ? 'Found' : 'Not found');
  console.log('[ForkSession] Retrieved session history length:', forkedSession?.history?.length || 0);

  return {
    session: forkedSession,
    parentSession: originalSession,
    forkMetadata: {
      forkedAt: new Date().toISOString(),
      forkPoint: messageIndex || (originalSession.history?.length || 0),
      sharedMessages: historyToInclude.length
    }
  };
}

// Create a session template
export async function createSessionTemplate(
  _parent: unknown,
  { input }: { input: any },
  context: Context
) {
  const { sessionId, name, description, tags, includeHistory, variables } = input;
  
  const session = context.sessionManager.getSession(sessionId);
  if (!session) {
    throw new Error(`Session ${sessionId} not found`);
  }

  const templateId = uuidv4();
  const template = {
    id: templateId,
    name,
    description,
    tags: tags || [],
    createdAt: new Date().toISOString(),
    lastUsedAt: null,
    usageCount: 0,
    variables: (variables || []).map((v: any) => ({
      name: v.name,
      description: v.description,
      defaultValue: v.defaultValue,
      required: v.required !== false
    })),
    initialContext: includeHistory ? JSON.stringify(session.history) : session.history[0]?.prompt || '',
    settings: {
      model: session.metadata.model,
      temperature: 0.7, // Default temperature
      maxTokens: null,
      customFlags: session.metadata.flags || []
    }
  };

  // Store template (in production, this would go to a database)
  if (!context.sessionManager.templates) {
    context.sessionManager.templates = new Map();
  }
  context.sessionManager.templates.set(templateId, template);

  return template;
}

// Create session from template
export async function createSessionFromTemplate(
  _parent: unknown,
  { templateId, name }: { templateId: string; name?: string },
  context: Context
) {
  const template = context.sessionManager.templates?.get(templateId);
  if (!template) {
    throw new Error(`Template ${templateId} not found`);
  }

  // Update template usage
  template.usageCount++;
  template.lastUsedAt = new Date().toISOString();

  // Create new session in the correct format for SessionData
  const sessionId = uuidv4();
  const sessionData = {
    id: sessionId,
    process: undefined,
    status: 'IDLE' as const,
    createdAt: new Date(),
    lastActivity: new Date(),
    workingDirectory: process.cwd(),
    history: [],
    metadata: {
      projectContext: template.initialContext,
      model: template.settings.model,
      tokenUsage: {
        inputTokens: 0,
        outputTokens: 0,
        estimatedCost: 0
      },
      flags: template.settings.customFlags,
      fromTemplate: templateId
    }
  };

  context.sessionManager.sessions.set(sessionId, sessionData);

  // Return the mapped version
  return context.sessionManager.getSession(sessionId);
}

// Batch session operations
export async function batchSessionOperation(
  _parent: unknown,
  { input }: { input: any },
  context: Context
) {
  const { sessionIds, operation, parameters } = input;
  const results = [];
  let successCount = 0;
  let failedCount = 0;

  for (const sessionId of sessionIds) {
    try {
      let resultData = null;
      
      switch (operation) {
        case 'ARCHIVE':
          resultData = await archiveSessionInternal(sessionId, context);
          break;
        case 'DELETE':
          context.sessionManager.sessions.delete(sessionId);
          resultData = { deleted: true };
          break;
        case 'EXPORT':
          const session = context.sessionManager.getSession(sessionId);
          resultData = { 
            exported: true, 
            data: JSON.stringify(session)
          };
          break;
        case 'TAG':
          // Add tags to session metadata
          const tagSession = context.sessionManager.sessions.get(sessionId);
          if (tagSession) {
            tagSession.metadata.tags = parameters ? JSON.parse(parameters) : [];
            resultData = { tagged: true };
          }
          break;
        case 'ANALYZE':
          // Trigger analysis (placeholder)
          resultData = { analyzed: true };
          break;
      }

      results.push({
        sessionId,
        success: true,
        resultData: JSON.stringify(resultData)
      });
      successCount++;
    } catch (error) {
      results.push({
        sessionId,
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error'
      });
      failedCount++;
    }
  }

  return {
    totalProcessed: sessionIds.length,
    successCount,
    failedCount,
    results
  };
}

// Archive a session
export async function archiveSession(
  _parent: unknown,
  { sessionId }: { sessionId: string },
  context: Context
) {
  return archiveSessionInternal(sessionId, context);
}

async function archiveSessionInternal(sessionId: string, context: Context) {
  const session = context.sessionManager.getSession(sessionId);
  if (!session) {
    throw new Error(`Session ${sessionId} not found`);
  }

  // Simulate archiving (in production, this would compress and store)
  const sessionData = JSON.stringify(session);
  const originalSize = new TextEncoder().encode(sessionData).length;
  const compressedSize = Math.floor(originalSize * 0.3); // Simulate 70% compression

  const archiveId = uuidv4();
  const archivePath = `/archives/sessions/${sessionId}-${Date.now()}.gz`;

  // Remove from active sessions
  context.sessionManager.sessions.delete(sessionId);

  return {
    archiveId,
    archivePath,
    sizeBytes: compressedSize,
    compressionRatio: originalSize / compressedSize
  };
}

// Share a session
export async function shareSession(
  _parent: unknown,
  { input }: { input: any },
  context: Context
) {
  const { sessionId, recipients, permission, message, expiresAt } = input;
  
  const session = context.sessionManager.getSession(sessionId);
  if (!session) {
    throw new Error(`Session ${sessionId} not found`);
  }

  const shareId = uuidv4();
  const shareCode = Math.random().toString(36).substring(2, 8).toUpperCase();
  const shareUrl = `https://claude.metaGOTHIC.com/shared/${shareCode}`;

  // Store share info (in production, this would go to a database)
  if (!context.sessionManager.shares) {
    context.sessionManager.shares = new Map();
  }
  
  context.sessionManager.shares.set(shareId, {
    id: shareId,
    sessionId,
    recipients,
    permission,
    message,
    shareCode,
    createdAt: new Date().toISOString(),
    expiresAt: expiresAt || new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString() // 7 days default
  });

  return {
    shareId,
    shareUrl,
    shareCode,
    expiresAt: expiresAt || new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString()
  };
}