-- Notification webhooks and delivery logs

CREATE TABLE IF NOT EXISTS notification_endpoints (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  "userId" UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  type VARCHAR(20) NOT NULL DEFAULT 'webhook' CHECK (type IN ('webhook')),
  name VARCHAR(255) NOT NULL,
  url TEXT NOT NULL,
  secret VARCHAR(255) NOT NULL,
  active BOOLEAN NOT NULL DEFAULT TRUE,
  "createdAt" TIMESTAMPTZ DEFAULT NOW(),
  "updatedAt" TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS notification_deliveries (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  "endpointId" UUID NOT NULL REFERENCES notification_endpoints(id) ON DELETE CASCADE,
  "alertId" UUID NOT NULL REFERENCES alerts(id) ON DELETE CASCADE,
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
  UNIQUE("endpointId", "alertId")
);

CREATE INDEX IF NOT EXISTS idx_notification_endpoints_userId ON notification_endpoints("userId");
CREATE INDEX IF NOT EXISTS idx_notification_endpoints_active ON notification_endpoints(active);
CREATE INDEX IF NOT EXISTS idx_notification_deliveries_endpointId ON notification_deliveries("endpointId");
CREATE INDEX IF NOT EXISTS idx_notification_deliveries_alertId ON notification_deliveries("alertId");
CREATE INDEX IF NOT EXISTS idx_notification_deliveries_status ON notification_deliveries(status);
CREATE INDEX IF NOT EXISTS idx_notification_deliveries_nextRetryAt ON notification_deliveries("nextRetryAt");
