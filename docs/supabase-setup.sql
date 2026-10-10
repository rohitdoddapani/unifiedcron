-- Secure UnifiedCron reader setup. Run as an administrator in your project's SQL editor.
-- Replace the password placeholder with a long, unique generated password before running.
-- This is intentionally separate from public/PostgREST. Never grant these views to anon.
-- If the role already exists, rotate its password deliberately rather than rerunning CREATE ROLE.
BEGIN;
CREATE ROLE unifiedcron_reader WITH LOGIN PASSWORD 'REPLACE_WITH_GENERATED_PASSWORD'
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
DO $$
DECLARE role_name text;
BEGIN
  FOREACH role_name IN ARRAY ARRAY['anon','authenticated','service_role'] LOOP
    IF EXISTS (SELECT 1 FROM pg_roles WHERE rolname = role_name) THEN
      EXECUTE format('REVOKE ALL ON SCHEMA unifiedcron FROM %I', role_name);
      EXECUTE format('REVOKE ALL ON ALL TABLES IN SCHEMA unifiedcron FROM %I', role_name);
    END IF;
  END LOOP;
END $$;
GRANT USAGE ON SCHEMA unifiedcron TO unifiedcron_reader;
GRANT SELECT (jobid,jobname,schedule,active) ON unifiedcron.jobs TO unifiedcron_reader;
GRANT SELECT (runid,jobid,status,start_time,end_time,return_message) ON unifiedcron.runs TO unifiedcron_reader;
COMMIT;
-- Also run docs/supabase-cleanup.sql if you installed the former anon-key setup.
-- pg_cron RLS hides other users' jobs from a plain reader. These administrator-owned
-- private views expose only the named columns and never expose command or write access.
