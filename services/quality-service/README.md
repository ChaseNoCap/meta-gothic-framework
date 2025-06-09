# Quality Service

A comprehensive code quality enforcement system with TimescaleDB for time-series analytics, providing three distinct flows:

1. **Web Portal**: Real-time dashboards and quality reports
2. **MCP Server**: Interactive Claude integration for live quality feedback
3. **Headless Engine**: Automated quality checks and CI/CD integration

## 🚀 Quick Start

### Prerequisites

- Node.js 20+
- PostgreSQL 15+ with TimescaleDB extension
- pnpm or npm

### 1. Install TimescaleDB

#### macOS (using Homebrew):
```bash
# First, install PostgreSQL
brew install postgresql@15
brew services start postgresql@15

# Add TimescaleDB tap
brew tap timescale/tap

# Install TimescaleDB tools
brew install timescaledb-tools

# For existing PostgreSQL, download and install TimescaleDB
# Visit: https://docs.timescale.com/self-hosted/latest/install/installation-macos/

# Alternative: Use PostgreSQL with TimescaleDB Docker image
docker run -d --name timescaledb -p 5432:5432 \
  -e POSTGRES_PASSWORD=postgres \
  timescale/timescaledb:latest-pg15
```

#### Ubuntu/Debian:
```bash
# Add TimescaleDB PPA
sudo add-apt-repository ppa:timescale/timescaledb-ppa
sudo apt update

# Install TimescaleDB
sudo apt install timescaledb-2-postgresql-15

# Initialize TimescaleDB
sudo timescaledb-tune --quiet --yes

# Restart PostgreSQL
sudo systemctl restart postgresql
```

### 2. Create Database

```bash
# Create the quality service database
createdb quality_service

# Or with specific user
createdb -U postgres quality_service
```

#### 🚀 Quick Start (PostgreSQL Only)

If you want to get started quickly without TimescaleDB:

```bash
# The setup script automatically detects if TimescaleDB is available
npm run db:setup

# This will use PostgreSQL-only schema if TimescaleDB isn't installed
# You can add TimescaleDB later for enhanced time-series features
```

### 3. Install Dependencies

```bash
cd services/quality-service
npm install
```

### 4. Set Up Database Schema

```bash
# Using default local connection
npm run db:setup

# Or with custom database URL
DATABASE_URL=postgresql://user:password@localhost:5432/quality_service npm run db:setup
```

### 5. Configure Environment

Create a `.env` file:

```env
# Database
DATABASE_URL=postgresql://localhost:5432/quality_service

# MCP Server (optional)
MCP_PORT=3006

# Web Portal (optional)
WEB_PORT=3007
VITE_GRAPHQL_ENDPOINT=http://localhost:3007/graphql
```

## 🏗️ Architecture

### Core Components

1. **TimescaleQualityEngine**: Core quality analysis engine
   - File processing and violation tracking
   - Quality score calculation
   - Time-series metrics storage

2. **MCP Server**: Model Context Protocol server for Claude
   - Real-time quality feedback during editing
   - Interactive quality tools
   - Session management

3. **Web Portal**: React dashboard with GraphQL API
   - Quality trends visualization
   - Violation tracking
   - Session monitoring

### Database Schema

The service uses TimescaleDB hypertables for efficient time-series data:

- **Current State Tables**: `files`, `current_violations`, `quality_sessions`
- **Time-Series Tables**: `quality_metrics`, `violation_events`, `session_activities`, `mcp_events`
- **Continuous Aggregates**: Hourly and daily quality metrics

## 🧪 Development

### Run Tests
```bash
npm test
```

### Run in Development Mode
```bash
# Start all services
npm run dev

# Or individually:
# MCP Server
npm run mcp:dev

# Web Portal
npm run web:dev
```

### Build for Production
```bash
npm run build
```

## 📊 Usage Examples

### Processing a File

```typescript
import { TimescaleQualityEngine } from './src/core/quality-engine.js';

const engine = new TimescaleQualityEngine({
  database: {
    connectionString: 'postgresql://localhost/quality_service'
  },
  scoring: {
    errorWeight: 3,
    warningWeight: 1,
    infoWeight: 0.1
  }
});

await engine.connect();

const result = await engine.processFile('./src/index.ts', {
  sessionType: 'HEADLESS',
  triggeredBy: 'manual'
});

console.log(`Quality Score: ${result.metrics?.qualityScore}`);
console.log(`Violations: ${result.violations.length}`);
```

### Querying Quality Trends

```typescript
const trends = await engine.getQualityTrends('./src/index.ts', {
  start: new Date(Date.now() - 7 * 24 * 60 * 60 * 1000),
  end: new Date(),
  bucket: 'day'
});

trends.forEach(trend => {
  console.log(`${trend.time}: Score ${trend.avgQualityScore.toFixed(2)}`);
});
```

## 🔌 MCP Integration

The MCP server provides tools for Claude integration:

- `quality_check_interactive`: Run real-time quality checks
- `get_quality_suggestions`: Get actionable improvement suggestions
- `apply_quality_fix`: Apply automated fixes

To use with Claude:
```bash
# Start the MCP server
npm run mcp:start

# Configure Claude to connect to localhost:3006
```

## 📈 Web Portal

Access the quality dashboard at `http://localhost:3007` after starting:

```bash
npm run web:start
```

Features:
- Real-time quality metrics
- Violation trends
- Session history
- File-by-file analysis

## 🚦 API Reference

### GraphQL Queries

```graphql
# Get quality overview
query QualityOverview($timeRange: TimeRange!) {
  qualityOverview(timeRange: $timeRange) {
    avgQuality
    totalViolations
    totalFiles
    trendsDirection
  }
}

# Get file quality trends
query FileTrends($path: String!, $timeRange: TimeRange!) {
  file(path: $path) {
    qualityTrend(timeRange: $timeRange) {
      time
      qualityScore
      violationCount
    }
  }
}
```

### GraphQL Mutations

```graphql
# Trigger quality check
mutation TriggerCheck($filePath: String!) {
  triggerQualityCheck(filePath: $filePath) {
    id
    status
  }
}
```

## 🔧 Configuration

### Quality Scoring

Configure scoring weights in the engine config:

```typescript
{
  scoring: {
    errorWeight: 3,      // Errors have high impact
    warningWeight: 1,    // Warnings have medium impact
    infoWeight: 0.1,     // Info has low impact
    maxScore: 10         // Maximum quality score
  }
}
```

### Analysis Tools

Currently supports:
- ESLint (planned)
- Prettier (planned)
- TypeScript Compiler (planned)
- Custom rules (planned)

## 📊 Monitoring

### Database Metrics

Monitor TimescaleDB performance:

```sql
-- Check chunk sizes
SELECT hypertable_name, 
       pg_size_pretty(hypertable_size) as size
FROM timescaledb_information.hypertables;

-- Check compression status
SELECT hypertable_name,
       number_compressed_chunks,
       number_uncompressed_chunks
FROM timescaledb_information.hypertables;
```

### Application Metrics

The service tracks:
- Processing time per file
- Session durations
- Tool performance
- Error rates

## 🤝 Contributing

1. Create a feature branch
2. Add tests for new functionality
3. Ensure all tests pass
4. Submit a pull request

## 📄 License

Part of the Meta GOTHIC Framework