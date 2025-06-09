-- TimescaleDB optimized schema for Code Quality Platform

-- Enable required extensions
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";
CREATE EXTENSION IF NOT EXISTS timescaledb;

-- CURRENT STATE TABLES (Regular PostgreSQL tables)

-- Files being tracked for quality
CREATE TABLE IF NOT EXISTS files (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  path TEXT NOT NULL UNIQUE,
  hash TEXT NOT NULL,
  last_modified TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  current_quality_score REAL,
  active_violation_count INTEGER DEFAULT 0,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_files_path ON files(path);
CREATE INDEX idx_files_last_modified ON files(last_modified);
CREATE INDEX idx_files_quality_score ON files(current_quality_score);

-- Current violations for each file
CREATE TABLE IF NOT EXISTS current_violations (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  file_id UUID NOT NULL REFERENCES files(id) ON DELETE CASCADE,
  rule TEXT NOT NULL,
  severity TEXT NOT NULL CHECK (severity IN ('error', 'warning', 'info')),
  message TEXT NOT NULL,
  line_number INTEGER,
  column_number INTEGER,
  tool_type TEXT NOT NULL,
  auto_fixable BOOLEAN DEFAULT false,
  status TEXT DEFAULT 'active' CHECK (status IN ('active', 'fixed', 'ignored', 'in_progress')),
  created_at TIMESTAMPTZ DEFAULT NOW(),
  resolved_at TIMESTAMPTZ,
  resolved_by TEXT
);

CREATE INDEX idx_violations_file_id ON current_violations(file_id);
CREATE INDEX idx_violations_status ON current_violations(status);
CREATE INDEX idx_violations_rule ON current_violations(rule);
CREATE INDEX idx_violations_severity ON current_violations(severity);
CREATE INDEX idx_violations_tool_type ON current_violations(tool_type);

-- Quality check sessions
CREATE TABLE IF NOT EXISTS quality_sessions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  session_type TEXT NOT NULL CHECK (session_type IN ('INTERACTIVE', 'HEADLESS', 'REPORT', 'WATCH')),
  triggered_by TEXT NOT NULL,
  status TEXT DEFAULT 'in_progress' CHECK (status IN ('in_progress', 'completed', 'failed')),
  started_at TIMESTAMPTZ DEFAULT NOW(),
  completed_at TIMESTAMPTZ,
  context JSONB,
  total_files_checked INTEGER DEFAULT 0,
  total_violations_found INTEGER DEFAULT 0,
  total_violations_fixed INTEGER DEFAULT 0
);

CREATE INDEX idx_sessions_type ON quality_sessions(session_type);
CREATE INDEX idx_sessions_status ON quality_sessions(status);
CREATE INDEX idx_sessions_started_at ON quality_sessions(started_at);

-- TIME-SERIES TABLES (TimescaleDB hypertables)

-- Quality metrics over time
CREATE TABLE IF NOT EXISTS quality_metrics (
  time TIMESTAMPTZ NOT NULL,
  file_path TEXT NOT NULL,
  session_id UUID REFERENCES quality_sessions(id),
  quality_score REAL,
  violation_count INTEGER,
  complexity_score REAL,
  maintainability_score REAL,
  test_coverage REAL,
  tool_type TEXT,
  metadata JSONB
);

-- Convert to hypertable with 1 day chunks
SELECT create_hypertable('quality_metrics', 'time', chunk_time_interval => INTERVAL '1 day', if_not_exists => TRUE);

-- Create indexes for common queries
CREATE INDEX idx_quality_metrics_file_time ON quality_metrics(file_path, time DESC);
CREATE INDEX idx_quality_metrics_session ON quality_metrics(session_id, time DESC);

-- Violation events for tracking changes
CREATE TABLE IF NOT EXISTS violation_events (
  time TIMESTAMPTZ NOT NULL,
  file_path TEXT NOT NULL,
  session_id UUID REFERENCES quality_sessions(id),
  event_type TEXT NOT NULL CHECK (event_type IN ('created', 'fixed', 'ignored', 'modified')),
  violation_id UUID,
  rule TEXT,
  severity TEXT,
  tool_type TEXT,
  auto_fixable BOOLEAN,
  resolved_by TEXT,
  metadata JSONB
);

-- Convert to hypertable with 1 day chunks
SELECT create_hypertable('violation_events', 'time', chunk_time_interval => INTERVAL '1 day', if_not_exists => TRUE);

-- Create indexes for event queries
CREATE INDEX idx_violation_events_file_time ON violation_events(file_path, time DESC);
CREATE INDEX idx_violation_events_type ON violation_events(event_type, time DESC);
CREATE INDEX idx_violation_events_session ON violation_events(session_id);

-- Session activity tracking
CREATE TABLE IF NOT EXISTS session_activities (
  time TIMESTAMPTZ NOT NULL,
  session_id UUID NOT NULL REFERENCES quality_sessions(id),
  activity_type TEXT NOT NULL,
  file_path TEXT,
  tool_name TEXT,
  duration_ms INTEGER,
  success BOOLEAN,
  details JSONB
);

-- Convert to hypertable with 1 hour chunks for higher granularity
SELECT create_hypertable('session_activities', 'time', chunk_time_interval => INTERVAL '1 hour', if_not_exists => TRUE);

-- Create indexes for activity queries
CREATE INDEX idx_session_activities_session ON session_activities(session_id, time DESC);
CREATE INDEX idx_session_activities_type ON session_activities(activity_type, time DESC);

-- MCP events for Claude integration tracking
CREATE TABLE IF NOT EXISTS mcp_events (
  time TIMESTAMPTZ NOT NULL,
  event_type TEXT NOT NULL,
  session_id UUID,
  client_type TEXT,
  event_data JSONB
);

-- Convert to hypertable with 1 hour chunks
SELECT create_hypertable('mcp_events', 'time', chunk_time_interval => INTERVAL '1 hour', if_not_exists => TRUE);

-- Create indexes for MCP queries
CREATE INDEX idx_mcp_events_type ON mcp_events(event_type, time DESC);
CREATE INDEX idx_mcp_events_session ON mcp_events(session_id, time DESC);

-- CONTINUOUS AGGREGATES for common queries

-- Hourly quality metrics aggregate
CREATE MATERIALIZED VIEW quality_metrics_hourly
WITH (timescaledb.continuous) AS
SELECT
  time_bucket('1 hour', time) AS hour,
  file_path,
  avg(quality_score) AS avg_quality_score,
  avg(violation_count) AS avg_violation_count,
  avg(complexity_score) AS avg_complexity_score,
  avg(maintainability_score) AS avg_maintainability_score,
  count(*) AS sample_count
FROM quality_metrics
GROUP BY hour, file_path
WITH NO DATA;

-- Daily quality metrics aggregate
CREATE MATERIALIZED VIEW quality_metrics_daily
WITH (timescaledb.continuous) AS
SELECT
  time_bucket('1 day', time) AS day,
  file_path,
  avg(quality_score) AS avg_quality_score,
  avg(violation_count) AS avg_violation_count,
  max(quality_score) AS max_quality_score,
  min(quality_score) AS min_quality_score,
  count(*) AS sample_count
FROM quality_metrics
GROUP BY day, file_path
WITH NO DATA;

-- Refresh policies for continuous aggregates
SELECT add_continuous_aggregate_policy('quality_metrics_hourly',
  start_offset => INTERVAL '3 hours',
  end_offset => INTERVAL '1 hour',
  schedule_interval => INTERVAL '1 hour',
  if_not_exists => TRUE);

SELECT add_continuous_aggregate_policy('quality_metrics_daily',
  start_offset => INTERVAL '3 days',
  end_offset => INTERVAL '1 day',
  schedule_interval => INTERVAL '1 day',
  if_not_exists => TRUE);

-- RETENTION POLICIES

-- Keep raw metrics for 30 days
SELECT add_retention_policy('quality_metrics', INTERVAL '30 days', if_not_exists => TRUE);

-- Keep violation events for 90 days
SELECT add_retention_policy('violation_events', INTERVAL '90 days', if_not_exists => TRUE);

-- Keep session activities for 7 days
SELECT add_retention_policy('session_activities', INTERVAL '7 days', if_not_exists => TRUE);

-- Keep MCP events for 7 days
SELECT add_retention_policy('mcp_events', INTERVAL '7 days', if_not_exists => TRUE);

-- COMPRESSION POLICIES

-- Compress quality metrics older than 7 days
SELECT add_compression_policy('quality_metrics', INTERVAL '7 days', if_not_exists => TRUE);

-- Compress violation events older than 14 days
SELECT add_compression_policy('violation_events', INTERVAL '14 days', if_not_exists => TRUE);