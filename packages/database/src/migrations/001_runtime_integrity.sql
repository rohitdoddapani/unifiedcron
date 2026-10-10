-- Additive runtime integrity migration for existing installations

ALTER TABLE connections
  ADD COLUMN IF NOT EXISTS "updatedAt" TIMESTAMPTZ DEFAULT NOW();

ALTER TABLE "jobRuns"
  ADD COLUMN IF NOT EXISTS "sourceRunId" VARCHAR(255),
  ADD COLUMN IF NOT EXISTS "createdAt" TIMESTAMPTZ DEFAULT NOW(),
  ADD COLUMN IF NOT EXISTS "updatedAt" TIMESTAMPTZ DEFAULT NOW();

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_constraint
    WHERE conname = 'jobruns_jobid_sourcerunid_key'
  ) THEN
    ALTER TABLE "jobRuns"
      ADD CONSTRAINT jobruns_jobid_sourcerunid_key UNIQUE ("jobId", "sourceRunId");
  END IF;
END
$$;

ALTER TABLE alerts
  ADD COLUMN IF NOT EXISTS "sourceRunId" VARCHAR(255),
  ADD COLUMN IF NOT EXISTS status VARCHAR(20) NOT NULL DEFAULT 'open',
  ADD COLUMN IF NOT EXISTS "resolvedAt" TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS "updatedAt" TIMESTAMPTZ DEFAULT NOW();

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_constraint
    WHERE conname = 'alerts_status_check'
  ) THEN
    ALTER TABLE alerts
      ADD CONSTRAINT alerts_status_check CHECK (status IN ('open', 'resolved'));
  END IF;
END
$$;

CREATE INDEX IF NOT EXISTS idx_jobRuns_sourceRunId ON "jobRuns"("sourceRunId");
CREATE INDEX IF NOT EXISTS idx_alerts_status ON alerts(status);
CREATE INDEX IF NOT EXISTS idx_alerts_sourceRunId ON alerts("sourceRunId");
