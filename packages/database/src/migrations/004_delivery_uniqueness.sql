DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_constraint
    WHERE conname = 'notification_deliveries_endpointid_alertid_key'
  ) THEN
    ALTER TABLE notification_deliveries
      ADD CONSTRAINT notification_deliveries_endpointid_alertid_key UNIQUE ("endpointId", "alertId");
  END IF;
END
$$;
