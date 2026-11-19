-- Remove previously persisted provider messages, including on direct re-execution.
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema = current_schema()
             AND table_name = 'ingestion_state' AND column_name = 'lastError') THEN
    UPDATE ingestion_state SET "lastError" = NULL;
  END IF;
END $$;
ALTER TABLE ingestion_state DROP COLUMN IF EXISTS "lastError";
ALTER TABLE ingestion_state ADD COLUMN IF NOT EXISTS "errorCode" TEXT;
