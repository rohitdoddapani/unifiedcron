-- UnifiedCron Database Schema
-- Using camelCase for column names as per team preference

CREATE EXTENSION IF NOT EXISTS pgcrypto;

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
  "createdAt" TIMESTAMPTZ DEFAULT NOW(),
  "updatedAt" TIMESTAMPTZ DEFAULT NOW()
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
  "sourceRunId" VARCHAR(255),
  status VARCHAR(20) NOT NULL CHECK (status IN ('succeeded', 'failed', 'running')),
  "startedAt" TIMESTAMPTZ NOT NULL,
  "endedAt" TIMESTAMPTZ,
  message TEXT,
  "createdAt" TIMESTAMPTZ DEFAULT NOW(),
  "updatedAt" TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE("jobId", "sourceRunId")
);

-- Alerts table
CREATE TABLE IF NOT EXISTS alerts (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  "jobId" UUID NOT NULL REFERENCES jobs(id) ON DELETE CASCADE,
  type VARCHAR(20) NOT NULL CHECK (type IN ('failure')),
  "sourceRunId" VARCHAR(255),
  status VARCHAR(20) NOT NULL DEFAULT 'open' CHECK (status IN ('open', 'resolved')),
  "resolvedAt" TIMESTAMPTZ,
  "createdAt" TIMESTAMPTZ DEFAULT NOW(),
  "updatedAt" TIMESTAMPTZ DEFAULT NOW(),
  details JSONB DEFAULT '{}'
);

-- Notification endpoints (webhooks)
CREATE TABLE IF NOT EXISTS notification_endpoints (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  "userId" UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  type VARCHAR(20) NOT NULL DEFAULT 'webhook' CHECK (type IN ('webhook')),
  name VARCHAR(255) NOT NULL,
  url TEXT NOT NULL,
  secret VARCHAR(255) NOT NULL,
  "secretEncrypted" BOOLEAN NOT NULL DEFAULT FALSE,
  active BOOLEAN NOT NULL DEFAULT TRUE,
  "createdAt" TIMESTAMPTZ DEFAULT NOW(),
  "updatedAt" TIMESTAMPTZ DEFAULT NOW()
);

-- Notification deliveries (retry and observability)
CREATE TABLE IF NOT EXISTS notification_deliveries (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  "endpointId" UUID NOT NULL REFERENCES notification_endpoints(id) ON DELETE CASCADE,
  "alertId" UUID REFERENCES alerts(id) ON DELETE CASCADE,
  event VARCHAR(50) NOT NULL DEFAULT 'alert.failure',
  payload JSONB NOT NULL,
  status VARCHAR(20) NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'retrying', 'succeeded', 'failed')),
  attempt INTEGER NOT NULL DEFAULT 0,
  "nextRetryAt" TIMESTAMPTZ,
  "responseStatus" INTEGER,
  "responseBody" TEXT,
  "errorMessage" TEXT,
  "deliveredAt" TIMESTAMPTZ,
  "createdAt" TIMESTAMPTZ DEFAULT NOW(),
  "updatedAt" TIMESTAMPTZ DEFAULT NOW(),
  "claimToken" UUID,
  "lockedUntil" TIMESTAMPTZ,
  UNIQUE("endpointId", "alertId")
);

CREATE TABLE IF NOT EXISTS notification_delivery_attempts (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  "deliveryId" UUID NOT NULL REFERENCES notification_deliveries(id) ON DELETE CASCADE,
  attempt INTEGER NOT NULL,
  status VARCHAR(20) NOT NULL CHECK (status IN ('processing', 'succeeded', 'failed')),
  "startedAt" TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  "finishedAt" TIMESTAMPTZ,
  "responseStatus" INTEGER,
  "responseBody" TEXT,
  "errorMessage" TEXT,
  UNIQUE ("deliveryId", attempt)
);

-- Indexes for better performance
CREATE INDEX IF NOT EXISTS idx_connections_userId ON connections("userId");
CREATE INDEX IF NOT EXISTS idx_connections_platform ON connections(platform);
CREATE INDEX IF NOT EXISTS idx_jobs_connectionId ON jobs("connectionId");
CREATE INDEX IF NOT EXISTS idx_jobs_platform ON jobs(platform);
CREATE INDEX IF NOT EXISTS idx_jobs_lastSeenAt ON jobs("lastSeenAt");
CREATE INDEX IF NOT EXISTS idx_jobRuns_jobId ON "jobRuns"("jobId");
CREATE INDEX IF NOT EXISTS idx_jobRuns_sourceRunId ON "jobRuns"("sourceRunId");
CREATE INDEX IF NOT EXISTS idx_jobRuns_status ON "jobRuns"(status);
CREATE INDEX IF NOT EXISTS idx_jobRuns_startedAt ON "jobRuns"("startedAt");
CREATE INDEX IF NOT EXISTS idx_alerts_jobId ON alerts("jobId");
CREATE INDEX IF NOT EXISTS idx_alerts_type ON alerts(type);
CREATE INDEX IF NOT EXISTS idx_alerts_status ON alerts(status);
CREATE INDEX IF NOT EXISTS idx_alerts_sourceRunId ON alerts("sourceRunId");
CREATE INDEX IF NOT EXISTS idx_alerts_createdAt ON alerts("createdAt");
CREATE INDEX IF NOT EXISTS idx_notification_endpoints_userId ON notification_endpoints("userId");
CREATE INDEX IF NOT EXISTS idx_notification_endpoints_active ON notification_endpoints(active);
CREATE INDEX IF NOT EXISTS idx_notification_deliveries_endpointId ON notification_deliveries("endpointId");
CREATE INDEX IF NOT EXISTS idx_notification_deliveries_alertId ON notification_deliveries("alertId");
CREATE INDEX IF NOT EXISTS idx_notification_deliveries_status ON notification_deliveries(status);
CREATE INDEX IF NOT EXISTS idx_notification_deliveries_nextRetryAt ON notification_deliveries("nextRetryAt");

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
