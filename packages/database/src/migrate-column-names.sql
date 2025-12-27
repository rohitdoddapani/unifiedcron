-- Migration script to rename columns from lowercase to camelCase
-- This fixes the PostgreSQL case-sensitivity issue where unquoted identifiers
-- were converted to lowercase during table creation

-- Rename columns in users table
ALTER TABLE users RENAME COLUMN createdat TO "createdAt";

-- Rename columns in connections table
ALTER TABLE connections RENAME COLUMN userid TO "userId";
ALTER TABLE connections RENAME COLUMN createdat TO "createdAt";

-- Rename columns in jobs table
ALTER TABLE jobs RENAME COLUMN connectionid TO "connectionId";
ALTER TABLE jobs RENAME COLUMN originid TO "originId";
ALTER TABLE jobs RENAME COLUMN lastseenat TO "lastSeenAt";

-- Rename jobRuns table and its columns
ALTER TABLE jobruns RENAME TO "jobRuns";
ALTER TABLE "jobRuns" RENAME COLUMN jobid TO "jobId";
ALTER TABLE "jobRuns" RENAME COLUMN startedat TO "startedAt";
ALTER TABLE "jobRuns" RENAME COLUMN endedat TO "endedAt";

-- Rename columns in alerts table
ALTER TABLE alerts RENAME COLUMN jobid TO "jobId";
ALTER TABLE alerts RENAME COLUMN createdat TO "createdAt";

-- Drop old indexes and recreate with correct column names
DROP INDEX IF EXISTS idx_connections_userid;
DROP INDEX IF EXISTS idx_jobs_connectionid;
DROP INDEX IF EXISTS idx_jobs_lastseenat;
DROP INDEX IF EXISTS idx_jobruns_jobid;
DROP INDEX IF EXISTS idx_jobruns_startedat;
DROP INDEX IF EXISTS idx_alerts_jobid;
DROP INDEX IF EXISTS idx_alerts_createdat;

-- Recreate indexes with correct column names
CREATE INDEX IF NOT EXISTS idx_connections_userId ON connections("userId");
CREATE INDEX IF NOT EXISTS idx_jobs_connectionId ON jobs("connectionId");
CREATE INDEX IF NOT EXISTS idx_jobs_lastSeenAt ON jobs("lastSeenAt");
CREATE INDEX IF NOT EXISTS idx_jobRuns_jobId ON "jobRuns"("jobId");
CREATE INDEX IF NOT EXISTS idx_jobRuns_startedAt ON "jobRuns"("startedAt");
CREATE INDEX IF NOT EXISTS idx_alerts_jobId ON alerts("jobId");
CREATE INDEX IF NOT EXISTS idx_alerts_createdAt ON alerts("createdAt");

-- Update foreign key constraints (these will be automatically updated when we rename the columns)

