# Quality Service MCP Server

This MCP (Model Context Protocol) server provides real-time code quality analysis for Claude during editing sessions.

## Features

- **Real-time Quality Analysis**: Get instant feedback on code quality issues
- **Intelligent Suggestions**: Receive contextual improvement suggestions
- **Auto-fix Support**: Apply automatic fixes for common issues
- **Session Management**: Track quality improvements across editing sessions
- **TimescaleDB Integration**: Store and analyze quality metrics over time

## Setup

### Prerequisites

1. PostgreSQL with TimescaleDB extension installed
2. Node.js 20+ 
3. Claude Desktop or CLI with MCP support

### Database Setup

```bash
# Set up the database (with TimescaleDB if available)
npm run db:setup

# Or for PostgreSQL without TimescaleDB
npm run db:setup:flexible
```

### Installation

```bash
# Install dependencies
npm install

# Build the service
npm run build
```

## Running the MCP Server

### Standalone Mode (for Claude)

```bash
# Start the MCP server
npm run start:mcp
```

### As Part of Quality Service

```bash
# Start the full quality service (includes MCP server)
npm run start
```

## Configuring Claude to Use the MCP Server

### Option 1: Claude Desktop Configuration

Add to your Claude configuration file (`~/.claude/mcp.json` or similar):

```json
{
  "mcpServers": {
    "quality-service": {
      "command": "npm",
      "args": ["run", "start:mcp"],
      "cwd": "/Users/josh/Documents/meta-gothic-framework/services/quality-service",
      "env": {
        "DATABASE_URL": "postgresql://josh@localhost:5432/quality_service"
      }
    }
  }
}
```

### Option 2: Project-Level Configuration

Create `.claude/mcp.json` in your project root:

```json
{
  "quality-service": {
    "command": "npm",
    "args": ["run", "start:mcp"],
    "cwd": "./services/quality-service",
    "env": {
      "DATABASE_URL": "postgresql://josh@localhost:5432/quality_service"
    }
  }
}
```

## Available Tools

### 1. `quality_check_interactive`

Performs real-time quality analysis on a file.

**Parameters:**
- `filePath` (string, required): Absolute path to the file
- `sessionId` (string, required): MCP session ID for tracking
- `claudeSessionId` (string, optional): Claude session ID for correlation
- `includeFixable` (boolean, optional): Whether to highlight auto-fixable violations

**Example:**
```json
{
  "filePath": "/Users/josh/project/src/index.ts",
  "sessionId": "session-123",
  "includeFixable": true
}
```

### 2. `get_quality_suggestions`

Provides intelligent improvement suggestions based on violation patterns.

**Parameters:**
- `filePath` (string, required): Absolute path to the file
- `sessionId` (string, required): MCP session ID for tracking
- `violationType` (string, optional): Focus on specific tool (eslint, prettier, typescript)
- `maxSuggestions` (integer, optional): Maximum suggestions to return (default: 10)

**Example:**
```json
{
  "filePath": "/Users/josh/project/src/utils.ts",
  "sessionId": "session-123",
  "violationType": "eslint",
  "maxSuggestions": 5
}
```

### 3. `apply_quality_fix`

Applies automatic fixes for code quality violations.

**Parameters:**
- `filePath` (string, required): Absolute path to the file
- `sessionId` (string, required): MCP session ID for tracking
- `toolType` (string, optional): Specific tool to use (eslint, prettier, all)
- `dryRun` (boolean, optional): Preview fixes without applying

**Example:**
```json
{
  "filePath": "/Users/josh/project/src/component.tsx",
  "sessionId": "session-123",
  "toolType": "prettier",
  "dryRun": false
}
```

## Environment Variables

- `DATABASE_URL`: PostgreSQL connection string (default: `postgresql://josh@localhost:5432/quality_service`)
- `ESLINT_CONFIG`: Path to custom ESLint config file
- `PRETTIER_CONFIG`: Path to custom Prettier config file
- `TSCONFIG_PATH`: Path to TypeScript config (default: `./tsconfig.json`)
- `LOG_LEVEL`: Logging level (debug, info, warn, error)

## Monitoring

The MCP server tracks all tool usage in the `mcp_events` table:

```sql
-- View recent MCP activity
SELECT 
  time,
  event_type,
  session_id,
  client_type,
  event_data
FROM mcp_events
ORDER BY time DESC
LIMIT 20;

-- View tool usage statistics
SELECT 
  client_type,
  COUNT(*) as usage_count,
  COUNT(DISTINCT session_id) as unique_sessions
FROM mcp_events
WHERE event_type = 'TOOL_CALLED'
GROUP BY client_type;
```

## Troubleshooting

### Connection Issues

1. Verify PostgreSQL is running:
   ```bash
   pg_isready -h localhost -p 5432
   ```

2. Check database exists:
   ```bash
   psql -U josh -d quality_service -c "SELECT 1"
   ```

3. Test MCP server directly:
   ```bash
   echo '{"jsonrpc":"2.0","id":1,"method":"tools/list","params":{}}' | npm run start:mcp
   ```

### Performance Issues

1. Check database indexes:
   ```sql
   SELECT indexname, indexdef 
   FROM pg_indexes 
   WHERE tablename IN ('files', 'current_violations', 'quality_metrics');
   ```

2. Monitor active sessions:
   ```sql
   SELECT * FROM quality_sessions 
   WHERE status = 'active' 
   ORDER BY started_at DESC;
   ```

## Development

### Testing the MCP Server

```bash
# Run the test script
node test-mcp.js
```

### Adding New Tools

1. Create tool class in `src/mcp/tools/`
2. Extend `BaseTool` class
3. Register in `src/mcp/server.ts`
4. Update this documentation

## Architecture

```
┌─────────────────┐     ┌──────────────┐     ┌──────────────┐
│   Claude IDE    │────▶│  MCP Server  │────▶│  TimescaleDB │
└─────────────────┘     └──────────────┘     └──────────────┘
                               │
                               ▼
                        ┌──────────────┐
                        │   Analyzers  │
                        ├──────────────┤
                        │    ESLint    │
                        │   Prettier   │
                        │  TypeScript  │
                        └──────────────┘
```

The MCP server acts as a bridge between Claude and the quality analysis engine, providing real-time feedback during code editing sessions.