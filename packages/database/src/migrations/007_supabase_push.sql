CREATE TABLE supabase_push_state (
  "connectionId" UUID PRIMARY KEY REFERENCES connections(id) ON DELETE CASCADE,
  "receivedSequence" BIGINT NOT NULL DEFAULT 0,
  "processedSequence" BIGINT NOT NULL DEFAULT 0,
  "lastReceivedAt" TIMESTAMPTZ
);
CREATE TABLE supabase_push_batches (
  "connectionId" UUID NOT NULL REFERENCES connections(id) ON DELETE CASCADE,
  sequence BIGINT NOT NULL,
  payload JSONB NOT NULL,
  digest TEXT NOT NULL,
  "receivedAt" TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  "processedAt" TIMESTAMPTZ,
  PRIMARY KEY ("connectionId",sequence)
);
CREATE INDEX supabase_push_batches_pending ON supabase_push_batches("connectionId",sequence) WHERE "processedAt" IS NULL;
