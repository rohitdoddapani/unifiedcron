export function supabaseSetupSql(password: string): string {
  if (!/^[a-f0-9]{64}$/.test(password)) throw new Error('Setup requires a generated 32-byte hexadecimal password');
  return `BEGIN;
CREATE ROLE unifiedcron_reader WITH LOGIN PASSWORD '${password}'
  NOSUPERUSER NOCREATEDB NOCREATEROLE NOINHERIT NOBYPASSRLS CONNECTION LIMIT 3;
ALTER ROLE unifiedcron_reader SET default_transaction_read_only = on;
ALTER ROLE unifiedcron_reader SET statement_timeout = '5s';
CREATE SCHEMA IF NOT EXISTS unifiedcron;
REVOKE ALL ON SCHEMA unifiedcron FROM PUBLIC;
CREATE OR REPLACE VIEW unifiedcron.jobs WITH (security_barrier = true) AS
 SELECT jobid, jobname, schedule, active FROM cron.job;
CREATE OR REPLACE VIEW unifiedcron.runs WITH (security_barrier = true) AS
 SELECT runid, jobid, status, start_time, end_time, return_message FROM cron.job_run_details;
REVOKE ALL ON ALL TABLES IN SCHEMA unifiedcron FROM PUBLIC;
DO $$ DECLARE r text; BEGIN
 FOREACH r IN ARRAY ARRAY['anon','authenticated','service_role'] LOOP
  IF EXISTS (SELECT 1 FROM pg_roles WHERE rolname = r) THEN
   EXECUTE format('REVOKE ALL ON SCHEMA unifiedcron FROM %I', r);
   EXECUTE format('REVOKE ALL ON ALL TABLES IN SCHEMA unifiedcron FROM %I', r);
  END IF;
 END LOOP;
END $$;
GRANT USAGE ON SCHEMA unifiedcron TO unifiedcron_reader;
GRANT SELECT (jobid,jobname,schedule,active) ON unifiedcron.jobs TO unifiedcron_reader;
GRANT SELECT (runid,jobid,status,start_time,end_time,return_message) ON unifiedcron.runs TO unifiedcron_reader;
COMMIT;`;
}
