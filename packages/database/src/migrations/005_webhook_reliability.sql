-- Delivery leases and immutable per-attempt history; compatible with existing rows.
ALTER TABLE notification_deliveries
  ALTER COLUMN "alertId" DROP NOT NULL,
  ADD COLUMN IF NOT EXISTS "claimToken" UUID,
  ADD COLUMN IF NOT EXISTS "lockedUntil" TIMESTAMPTZ;

ALTER TABLE notification_endpoints
  ADD COLUMN IF NOT EXISTS "secretEncrypted" BOOLEAN NOT NULL DEFAULT FALSE;

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

CREATE INDEX IF NOT EXISTS idx_delivery_due ON notification_deliveries ("nextRetryAt", "lockedUntil")
  WHERE status IN ('pending', 'retrying');
