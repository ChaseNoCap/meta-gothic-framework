import { Server } from '@modelcontextprotocol/sdk/server/index.js';
import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js';
import { ListToolsRequestSchema, CallToolRequestSchema } from '@modelcontextprotocol/sdk/types.js';
import { TimescaleQualityEngine } from '../core/quality-engine.js';
import { QualityCheckTool } from './tools/quality-check-tool.js';
import { SuggestionsTool } from './tools/suggestions-tool.js';
import { ApplyFixTool } from './tools/apply-fix-tool.js';
import { MCPSessionManager } from './session-manager.js';
import { logger } from '../utils/logger.js';
import type { Config } from '../types/index.js';

export class QualityMCPServer {
  private server: Server;
  private engine: TimescaleQualityEngine;
  private sessionManager: MCPSessionManager;
  private tools: Map<string, any>;

  constructor(engine: TimescaleQualityEngine, config: Config) {
    this.engine = engine;
    this.server = new Server(
      {
        name: 'quality-service-mcp',
        version: '1.0.0',
      },
      {
        capabilities: {
          tools: {},
        },
      }
    );

    this.sessionManager = new MCPSessionManager(engine, config);
    this.tools = new Map();
    this.initializeTools();
    this.setupHandlers();
  }

  private initializeTools(): void {
    const qualityCheck = new QualityCheckTool(this.engine, this.sessionManager);
    const suggestions = new SuggestionsTool(this.engine, this.sessionManager);
    const applyFix = new ApplyFixTool(this.engine, this.sessionManager);

    this.tools.set('quality_check_interactive', qualityCheck);
    this.tools.set('get_quality_suggestions', suggestions);
    this.tools.set('apply_quality_fix', applyFix);
  }

  private setupHandlers(): void {
    // Handle tool listing
    this.server.setRequestHandler(ListToolsRequestSchema, async () => {
      const tools = Array.from(this.tools.entries()).map(([name, tool]) => ({
        name,
        description: tool.description,
        inputSchema: tool.inputSchema,
      }));

      return { tools };
    });

    // Handle tool execution
    this.server.setRequestHandler(CallToolRequestSchema, async (request) => {
      const { name, arguments: args } = request.params;
      
      const tool = this.tools.get(name);
      if (!tool) {
        throw new Error(`Unknown tool: ${name}`);
      }

      try {
        // Track MCP event
        await this.engine.recordMCPEvent({
          eventType: 'TOOL_CALLED',
          toolName: name,
          sessionId: String(args?.['sessionId'] || 'anonymous'),
          payload: args,
        });

        // Execute tool
        const result = await tool.execute(args as any);

        // Track completion
        await this.engine.recordMCPEvent({
          eventType: 'TOOL_COMPLETED',
          toolName: name,
          sessionId: String(args?.['sessionId'] || 'anonymous'),
          payload: { success: true },
        });

        return result;
      } catch (error) {
        // Track error
        await this.engine.recordMCPEvent({
          eventType: 'TOOL_ERROR',
          toolName: name,
          sessionId: String(args?.['sessionId'] || 'anonymous'),
          payload: { 
            error: error instanceof Error ? error.message : 'Unknown error',
          },
        });

        logger.error('MCP tool execution failed', {
          tool: name,
          error: error instanceof Error ? error.message : error,
          args,
        });

        throw error;
      }
    });

    // Error handling
    this.server.onerror = (error) => {
      logger.error('MCP server error', error);
    };
  }

  async start(): Promise<void> {
    const transport = new StdioServerTransport();
    await this.server.connect(transport);
    
    logger.info('MCP server started', {
      tools: Array.from(this.tools.keys()),
    });

    // Record server start event
    await this.engine.recordMCPEvent({
      eventType: 'SERVER_STARTED',
      toolName: 'server',
      sessionId: 'system',
      payload: { timestamp: new Date().toISOString() },
    });
  }

  async stop(): Promise<void> {
    // Record server stop event
    await this.engine.recordMCPEvent({
      eventType: 'SERVER_STOPPED',
      toolName: 'server',
      sessionId: 'system',
      payload: { timestamp: new Date().toISOString() },
    });

    await this.server.close();
    logger.info('MCP server stopped');
  }
}