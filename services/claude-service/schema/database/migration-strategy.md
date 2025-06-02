# Database Migration Strategy for Agent Runs

## Current State
- File-based storage using JSON files in `/logs/claude-runs/` directory
- In-memory Map for runtime access
- Suitable for development and small-scale usage

## Target State
- SQLite for local development and testing
- PostgreSQL for production deployment
- TypeORM or Prisma for database abstraction

## Migration Plan

### Phase 1: Dual Storage (Current)
Keep file-based storage but prepare for database:
- ✅ RunStorage class with abstract interface
- ✅ Consistent data models
- ✅ Database schema designed

### Phase 2: SQLite Integration
Add SQLite support alongside file storage:
```typescript
// Example implementation
export class DatabaseRunStorage extends RunStorage {
  private db: Database;
  
  constructor(dbPath: string = './claude-runs.db') {
    this.db = new Database(dbPath);
    this.initializeDatabase();
  }
}
```

### Phase 3: Database Abstraction Layer
Implement repository pattern:
```typescript
interface IRunRepository {
  save(run: AgentRun): Promise<void>;
  findById(id: string): Promise<AgentRun | null>;
  findByRepository(repository: string): Promise<AgentRun[]>;
  // ... other methods
}

class FileRunRepository implements IRunRepository { }
class SQLiteRunRepository implements IRunRepository { }
class PostgresRunRepository implements IRunRepository { }
```

### Phase 4: Migration Tools
Create migration utilities:
1. **File to Database migrator**
   ```bash
   npm run migrate:runs -- --from file --to sqlite
   ```

2. **Backup utilities**
   ```bash
   npm run backup:runs -- --format json
   ```

### Phase 5: Production Setup
PostgreSQL configuration:
```yaml
database:
  type: postgres
  host: ${DB_HOST}
  port: ${DB_PORT}
  username: ${DB_USER}
  password: ${DB_PASSWORD}
  database: meta_gothic
  schema: claude_runs
```

## Benefits of Database Migration

### Performance
- Indexed queries for fast lookups
- Materialized views for statistics
- Efficient pagination
- Full-text search on prompts

### Scalability
- Handle millions of runs
- Concurrent access support
- Connection pooling
- Read replicas for queries

### Features
- Advanced querying (date ranges, aggregations)
- Real-time statistics
- Automatic cleanup jobs
- Transaction support

### Reliability
- ACID compliance
- Backup and restore
- Point-in-time recovery
- Replication support

## Implementation Timeline

1. **Week 1**: SQLite integration for local dev
2. **Week 2**: Repository pattern implementation
3. **Week 3**: Migration tools and tests
4. **Week 4**: PostgreSQL setup and deployment

## Configuration Examples

### SQLite (Development)
```typescript
{
  type: 'sqlite',
  database: './data/claude-runs.db',
  synchronize: true, // Auto-create tables in dev
  logging: true
}
```

### PostgreSQL (Production)
```typescript
{
  type: 'postgres',
  url: process.env.DATABASE_URL,
  ssl: { rejectUnauthorized: false },
  synchronize: false, // Use migrations in prod
  logging: ['error'],
  poolSize: 10
}
```

## Query Examples

### Find failed runs in last 24 hours
```sql
SELECT r.*, i.prompt, e.message as error_message
FROM agent_runs r
JOIN agent_inputs i ON r.id = i.run_id
JOIN run_errors e ON r.id = e.run_id
WHERE r.status = 'FAILED'
  AND r.started_at > NOW() - INTERVAL '24 hours'
ORDER BY r.started_at DESC;
```

### Repository performance stats
```sql
SELECT 
  repository,
  COUNT(*) as total_runs,
  AVG(duration) as avg_duration_ms,
  PERCENTILE_CONT(0.95) WITHIN GROUP (ORDER BY duration) as p95_duration,
  SUM(CASE WHEN status = 'SUCCESS' THEN 1 ELSE 0 END)::FLOAT / COUNT(*) as success_rate
FROM agent_runs
WHERE started_at > NOW() - INTERVAL '7 days'
GROUP BY repository
ORDER BY total_runs DESC;
```

### Find runs with similar prompts
```sql
SELECT r.*, i.prompt, 
  ts_rank(to_tsvector('english', i.prompt), query) AS rank
FROM agent_runs r
JOIN agent_inputs i ON r.id = i.run_id,
  to_tsquery('english', 'commit & message & generation') query
WHERE to_tsvector('english', i.prompt) @@ query
ORDER BY rank DESC
LIMIT 10;
```

## Next Steps

1. Choose ORM/query builder (TypeORM vs Prisma)
2. Implement SQLite storage class
3. Add database configuration to services
4. Create migration scripts
5. Update deployment documentation