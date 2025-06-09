-- Migration: Add WATCH session type
-- Date: 2025-06-09
-- Description: Adds WATCH as a valid session type for file watching functionality

-- Drop the existing constraint
ALTER TABLE quality_sessions 
DROP CONSTRAINT IF EXISTS quality_sessions_session_type_check;

-- Add the new constraint with WATCH included
ALTER TABLE quality_sessions 
ADD CONSTRAINT quality_sessions_session_type_check 
CHECK (session_type IN ('INTERACTIVE', 'HEADLESS', 'REPORT', 'WATCH'));

-- Add comment for documentation
COMMENT ON COLUMN quality_sessions.session_type IS 'Type of quality check session: INTERACTIVE (MCP with Claude), HEADLESS (standalone), REPORT (scheduled reports), WATCH (file watching)';