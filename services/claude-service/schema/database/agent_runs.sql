-- Agent Runs Database Schema
-- This schema is designed for future migration from file-based storage
-- Supports SQLite for local development and PostgreSQL for production

-- Main agent runs table
CREATE TABLE agent_runs (
    id UUID PRIMARY KEY,
    repository VARCHAR(255) NOT NULL,
    status VARCHAR(20) NOT NULL CHECK (status IN ('QUEUED', 'RUNNING', 'SUCCESS', 'FAILED', 'CANCELLED', 'RETRYING')),
    started_at TIMESTAMP NOT NULL,
    completed_at TIMESTAMP,
    duration INTEGER, -- milliseconds
    retry_count INTEGER NOT NULL DEFAULT 0,
    parent_run_id UUID REFERENCES agent_runs(id),
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    
    -- Indexes for common queries
    INDEX idx_repository (repository),
    INDEX idx_status (status),
    INDEX idx_started_at (started_at),
    INDEX idx_parent_run (parent_run_id)
);

-- Agent inputs table (normalized)
CREATE TABLE agent_inputs (
    run_id UUID PRIMARY KEY REFERENCES agent_runs(id) ON DELETE CASCADE,
    prompt TEXT NOT NULL,
    diff TEXT NOT NULL,
    recent_commits JSONB NOT NULL, -- Array of commit messages
    model VARCHAR(100) NOT NULL,
    temperature DECIMAL(3,2) NOT NULL
);

-- Agent outputs table (normalized)
CREATE TABLE agent_outputs (
    run_id UUID PRIMARY KEY REFERENCES agent_runs(id) ON DELETE CASCADE,
    message TEXT NOT NULL,
    confidence DECIMAL(3,2) NOT NULL,
    reasoning TEXT,
    raw_response TEXT NOT NULL,
    tokens_used INTEGER NOT NULL
);

-- Run errors table
CREATE TABLE run_errors (
    run_id UUID PRIMARY KEY REFERENCES agent_runs(id) ON DELETE CASCADE,
    code VARCHAR(100) NOT NULL,
    message TEXT NOT NULL,
    stack_trace TEXT,
    recoverable BOOLEAN NOT NULL DEFAULT false
);

-- Repository statistics materialized view (for performance)
CREATE MATERIALIZED VIEW repository_stats AS
SELECT 
    repository,
    COUNT(*) as total_runs,
    COUNT(CASE WHEN status = 'SUCCESS' THEN 1 END) as successful_runs,
    COUNT(CASE WHEN status = 'FAILED' THEN 1 END) as failed_runs,
    AVG(duration) as avg_duration,
    MAX(started_at) as last_run_at
FROM agent_runs
GROUP BY repository;

-- Create index on materialized view
CREATE INDEX idx_repo_stats_repository ON repository_stats(repository);

-- Function to clean up old runs (PostgreSQL)
CREATE OR REPLACE FUNCTION cleanup_old_runs(retention_days INTEGER DEFAULT 30)
RETURNS INTEGER AS $$
DECLARE
    deleted_count INTEGER;
BEGIN
    DELETE FROM agent_runs 
    WHERE started_at < CURRENT_TIMESTAMP - INTERVAL '1 day' * retention_days
    RETURNING COUNT(*) INTO deleted_count;
    
    RETURN deleted_count;
END;
$$ LANGUAGE plpgsql;

-- Trigger to update materialized view (PostgreSQL)
CREATE OR REPLACE FUNCTION refresh_repository_stats()
RETURNS TRIGGER AS $$
BEGIN
    REFRESH MATERIALIZED VIEW CONCURRENTLY repository_stats;
    RETURN NULL;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER update_repo_stats
AFTER INSERT OR UPDATE OR DELETE ON agent_runs
FOR EACH STATEMENT
EXECUTE FUNCTION refresh_repository_stats();

-- Indexes for performance optimization
CREATE INDEX idx_runs_composite ON agent_runs(repository, status, started_at DESC);
CREATE INDEX idx_runs_date_range ON agent_runs(started_at, completed_at);

-- Full-text search index on prompts (PostgreSQL)
CREATE INDEX idx_prompt_search ON agent_inputs USING gin(to_tsvector('english', prompt));

-- Comments for documentation
COMMENT ON TABLE agent_runs IS 'Stores all Claude agent run history with status tracking';
COMMENT ON TABLE agent_inputs IS 'Stores input parameters for each agent run';
COMMENT ON TABLE agent_outputs IS 'Stores successful outputs from Claude';
COMMENT ON TABLE run_errors IS 'Stores error details for failed runs';
COMMENT ON COLUMN agent_runs.duration IS 'Run duration in milliseconds';
COMMENT ON COLUMN agent_runs.parent_run_id IS 'References the original run if this is a retry';