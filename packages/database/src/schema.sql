-- UnifiedCron Database Schema
-- Using camelCase for column names as per team preference

-- Users table
CREATE TABLE IF NOT EXISTS users (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  email VARCHAR(255) UNIQUE NOT NULL,
  name VARCHAR(255),
  "createdAt" TIMESTAMPTZ DEFAULT NOW()
);

-- Connections table
CREATE TABLE IF NOT EXISTS connections (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  "userId" UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  platform VARCHAR(50) NOT NULL CHECK (platform IN ('supabase', 'github', 'vercel', 'netlify', 'n8n')),
  label VARCHAR(255) NOT NULL,
  config JSONB NOT NULL, -- Encrypted configuration
  "createdAt" TIMESTAMPTZ DEFAULT NOW()
);

-- Jobs table (normalized view of external jobs)
CREATE TABLE IF NOT EXISTS jobs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  "connectionId" UUID NOT NULL REFERENCES connections(id) ON DELETE CASCADE,
  "originId" VARCHAR(255) NOT NULL, -- External identifier
  name VARCHAR(255) NOT NULL,
  cron VARCHAR(100) NOT NULL,
  platform VARCHAR(50) NOT NULL CHECK (platform IN ('supabase', 'github', 'vercel', 'netlify', 'n8n')),
  project VARCHAR(255) NOT NULL,
  metadata JSONB DEFAULT '{}',
  "lastSeenAt" TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE("connectionId", "originId")
);

-- Job runs table (optional cache)
CREATE TABLE IF NOT EXISTS "jobRuns" (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  "jobId" UUID NOT NULL REFERENCES jobs(id) ON DELETE CASCADE,
  status VARCHAR(20) NOT NULL CHECK (status IN ('succeeded', 'failed', 'running')),
  "startedAt" TIMESTAMPTZ NOT NULL,
  "endedAt" TIMESTAMPTZ,
  message TEXT
);

-- Alerts table
CREATE TABLE IF NOT EXISTS alerts (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  "jobId" UUID NOT NULL REFERENCES jobs(id) ON DELETE CASCADE,
  type VARCHAR(20) NOT NULL CHECK (type IN ('failure')),
  "createdAt" TIMESTAMPTZ DEFAULT NOW(),
  details JSONB DEFAULT '{}'
);

-- Indexes for better performance
CREATE INDEX IF NOT EXISTS idx_connections_userId ON connections("userId");
CREATE INDEX IF NOT EXISTS idx_connections_platform ON connections(platform);
CREATE INDEX IF NOT EXISTS idx_jobs_connectionId ON jobs("connectionId");
CREATE INDEX IF NOT EXISTS idx_jobs_platform ON jobs(platform);
CREATE INDEX IF NOT EXISTS idx_jobs_lastSeenAt ON jobs("lastSeenAt");
CREATE INDEX IF NOT EXISTS idx_jobRuns_jobId ON "jobRuns"("jobId");
CREATE INDEX IF NOT EXISTS idx_jobRuns_status ON "jobRuns"(status);
CREATE INDEX IF NOT EXISTS idx_jobRuns_startedAt ON "jobRuns"("startedAt");
CREATE INDEX IF NOT EXISTS idx_alerts_jobId ON alerts("jobId");
CREATE INDEX IF NOT EXISTS idx_alerts_type ON alerts(type);
CREATE INDEX IF NOT EXISTS idx_alerts_createdAt ON alerts("createdAt");

-- Views for easier querying
CREATE OR REPLACE VIEW job_details AS
SELECT 
  j.id,
  j.name,
  j.cron,
  j.platform,
  j.project,
  j.metadata,
  j."lastSeenAt",
  c.label as "connectionLabel",
  c."userId",
  (SELECT COUNT(*) FROM "jobRuns" jr WHERE jr."jobId" = j.id AND jr.status = 'failed') as "failureCount",
  (SELECT COUNT(*) FROM alerts a WHERE a."jobId" = j.id) as "alertCount"
FROM jobs j
JOIN connections c ON j."connectionId" = c.id;

-- Function to clean up old job runs (optional)
CREATE OR REPLACE FUNCTION cleanup_old_job_runs()
RETURNS void AS $$
BEGIN
  DELETE FROM "jobRuns" 
  WHERE "startedAt" < NOW() - INTERVAL '30 days';
END;
$$ LANGUAGE plpgsql;

-- Function to clean up old alerts (optional)
CREATE OR REPLACE FUNCTION cleanup_old_alerts()
RETURNS void AS $$
BEGIN
  DELETE FROM alerts 
  WHERE "createdAt" < NOW() - INTERVAL '90 days';
END;
$$ LANGUAGE plpgsql;
