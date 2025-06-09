import { TimescaleQualityEngine } from '../../core/quality-engine.js';
import { MCPSessionManager } from '../session-manager.js';

export interface ToolSchema {
  type: 'object';
  properties: Record<string, any>;
  required?: string[];
}

export abstract class BaseTool {
  protected engine: TimescaleQualityEngine;
  protected sessionManager: MCPSessionManager;

  constructor(engine: TimescaleQualityEngine, sessionManager: MCPSessionManager) {
    this.engine = engine;
    this.sessionManager = sessionManager;
  }

  abstract get name(): string;
  abstract get description(): string;
  abstract get inputSchema(): ToolSchema;
  abstract execute(args: any): Promise<any>;
}