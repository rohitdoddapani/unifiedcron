-- Normalize legacy encrypted connection config payloads
-- Legacy rows may store config as a JSON string value instead of {"encrypted": "..."}.

UPDATE connections
SET
  config = jsonb_build_object('encrypted', trim(both '"' from config::text)),
  "updatedAt" = NOW()
WHERE jsonb_typeof(config) = 'string';
