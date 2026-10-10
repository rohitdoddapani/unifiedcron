ALTER TABLE jobs
  ADD COLUMN IF NOT EXISTS "removedAt" TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS "supersededById" UUID REFERENCES jobs(id),
  ADD COLUMN IF NOT EXISTS "legacyOriginId" TEXT,
  ADD COLUMN IF NOT EXISTS "lastFinishedAt" TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS "lastFinishedStatus" VARCHAR(20);
ALTER TABLE "jobRuns" ADD COLUMN IF NOT EXISTS "providerRunId" TEXT;
ALTER TABLE alerts ADD COLUMN IF NOT EXISTS "incidentModel" BOOLEAN NOT NULL DEFAULT FALSE;
UPDATE alerts SET "incidentModel"=true WHERE status='open';
ALTER TABLE alerts ALTER COLUMN "incidentModel" SET DEFAULT TRUE;

-- Preserve duplicate historical jobs/runs, but make only one stable identity discoverable.
UPDATE jobs SET "legacyOriginId" = "originId", "originId" = 'legacy:' || id::text
WHERE platform = 'supabase' AND metadata->>'jobId' ~ '^[0-9]+$' AND "legacyOriginId" IS NULL;
WITH ranked AS (
  SELECT id, row_number() OVER (PARTITION BY "connectionId", metadata->>'jobId' ORDER BY id) AS n,
    first_value(id) OVER (PARTITION BY "connectionId", metadata->>'jobId' ORDER BY id) AS winner
  FROM jobs WHERE platform = 'supabase' AND metadata->>'jobId' ~ '^[0-9]+$'
)
UPDATE jobs j SET "supersededById" = r.winner, "removedAt" = NOW()
FROM ranked r WHERE j.id = r.id AND r.n > 1;
UPDATE jobs SET "originId" = metadata->>'jobId'
WHERE platform = 'supabase' AND metadata->>'jobId' ~ '^[0-9]+$' AND "supersededById" IS NULL;
UPDATE alerts a SET status='resolved',"resolvedAt"=NOW(),"incidentModel"=false,
  details=COALESCE(details,'{}') || jsonb_build_object('resolution',jsonb_build_object('source','migration','reason','Job identity consolidated; historical records retained'))
FROM jobs j WHERE a."jobId"=j.id AND j."supersededById" IS NOT NULL AND a.status='open';

-- Keep all historical alerts; consolidate open incidents without deleting delivery history.
WITH ranked AS (
  SELECT id, row_number() OVER (PARTITION BY "jobId",type ORDER BY "createdAt",id) AS n,
    count(*) OVER (PARTITION BY "jobId",type) AS failures,
    first_value("sourceRunId") OVER (PARTITION BY "jobId",type ORDER BY "createdAt" DESC,id) AS last_source,
    first_value(COALESCE(details #>> '{jobRun,startTime}',"createdAt"::text)) OVER
      (PARTITION BY "jobId",type ORDER BY "createdAt" DESC,id) AS last_time
  FROM alerts WHERE status='open'
)
UPDATE alerts a SET details=COALESCE(details,'{}') || jsonb_build_object('failureCount',r.failures,
  'firstFailedRunId',a."sourceRunId",'lastFailedRunId',r.last_source,'lastFailedAt',r.last_time)
FROM ranked r WHERE a.id=r.id AND r.n=1;
WITH ranked AS (
  SELECT id, row_number() OVER (PARTITION BY "jobId",type ORDER BY "createdAt",id) AS n,
    first_value(id) OVER (PARTITION BY "jobId",type ORDER BY "createdAt",id) AS winner
  FROM alerts WHERE status = 'open'
)
UPDATE alerts a SET status = 'resolved', "resolvedAt" = NOW(), "updatedAt" = NOW(), "incidentModel"=false,
  details = COALESCE(details,'{}') || jsonb_build_object('supersededByAlertId',r.winner,
    'resolution',jsonb_build_object('source','migration','reason','Consolidated duplicate open incidents'))
FROM ranked r WHERE a.id = r.id AND r.n > 1;
CREATE UNIQUE INDEX IF NOT EXISTS alerts_one_open_incident ON alerts("jobId",type) WHERE status = 'open';
UPDATE notification_deliveries d SET status='failed',"nextRetryAt"=NULL,"claimToken"=NULL,"lockedUntil"=NULL,
  "errorMessage"='Superseded by a consolidated incident during upgrade',"updatedAt"=NOW()
FROM alerts a JOIN jobs j ON a."jobId"=j.id
WHERE d."alertId"=a.id AND d.status IN ('pending','retrying')
  AND (a.details ? 'supersededByAlertId' OR j."supersededById" IS NOT NULL);

CREATE TABLE IF NOT EXISTS ingestion_state (
  "connectionId" UUID NOT NULL REFERENCES connections(id) ON DELETE CASCADE,
  stream TEXT NOT NULL,
  cursor JSONB NOT NULL DEFAULT '{}',
  "lastSyncedAt" TIMESTAMPTZ,
  "lastErrorAt" TIMESTAMPTZ,
  "lastError" TEXT,
  "consecutiveFailures" INTEGER NOT NULL DEFAULT 0,
  "nextPollAt" TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  PRIMARY KEY ("connectionId",stream)
);
CREATE TABLE IF NOT EXISTS ingestion_gaps (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  "connectionId" UUID NOT NULL REFERENCES connections(id) ON DELETE CASCADE,
  stream TEXT NOT NULL,
  "fromRunId" TEXT NOT NULL,
  "toRunId" TEXT NOT NULL,
  "detectedAt" TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE ("connectionId",stream,"fromRunId","toRunId")
);

-- Open and resolved events need independent idempotency keys for each incident.
DO $$ DECLARE constraint_name text; BEGIN
  FOR constraint_name IN SELECT conname FROM pg_constraint
    WHERE conrelid = 'notification_deliveries'::regclass AND contype = 'u'
      AND array_length(conkey,1) = 2
      AND (SELECT attnum FROM pg_attribute WHERE attrelid=conrelid AND attname='endpointId') = ANY(conkey)
      AND (SELECT attnum FROM pg_attribute WHERE attrelid=conrelid AND attname='alertId') = ANY(conkey)
  LOOP EXECUTE format('ALTER TABLE notification_deliveries DROP CONSTRAINT %I',constraint_name); END LOOP;
END $$;
ALTER TABLE notification_deliveries ADD CONSTRAINT notification_deliveries_endpoint_alert_event_key UNIQUE ("endpointId","alertId",event);
