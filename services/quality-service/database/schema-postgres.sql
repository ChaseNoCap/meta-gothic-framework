-- PostgreSQL-only schema (without TimescaleDB)
-- This schema works with regular PostgreSQL for development

-- Enable required extensions
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

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
  session_type TEXT NOT NULL CHECK (session_type IN ('INTERACTIVE', 'HEADLESS', 'REPORT')),
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

-- TIME-SERIES TABLES (Regular tables without TimescaleDB)

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

-- Create indexes for common queries
CREATE INDEX idx_quality_metrics_time ON quality_metrics(time DESC);
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

-- Create indexes for event queries
CREATE INDEX idx_violation_events_time ON violation_events(time DESC);
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

-- Create indexes for activity queries
CREATE INDEX idx_session_activities_time ON session_activities(time DESC);
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

-- Create indexes for MCP queries
CREATE INDEX idx_mcp_events_time ON mcp_events(time DESC);
CREATE INDEX idx_mcp_events_type ON mcp_events(event_type, time DESC);
CREATE INDEX idx_mcp_events_session ON mcp_events(session_id, time DESC);

-- Create views for common aggregations (instead of continuous aggregates)

-- Hourly quality metrics view
CREATE OR REPLACE VIEW quality_metrics_hourly AS
SELECT
  date_trunc('hour', time) AS hour,
  file_path,
  avg(quality_score) AS avg_quality_score,
  avg(violation_count) AS avg_violation_count,
  avg(complexity_score) AS avg_complexity_score,
  avg(maintainability_score) AS avg_maintainability_score,
  count(*) AS sample_count
FROM quality_metrics
GROUP BY date_trunc('hour', time), file_path;

-- Daily quality metrics view
CREATE OR REPLACE VIEW quality_metrics_daily AS
SELECT
  date_trunc('day', time) AS day,
  file_path,
  avg(quality_score) AS avg_quality_score,
  avg(violation_count) AS avg_violation_count,
  max(quality_score) AS max_quality_score,
  min(quality_score) AS min_quality_score,
  count(*) AS sample_count
FROM quality_metrics
GROUP BY date_trunc('day', time), file_path;