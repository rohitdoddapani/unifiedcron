-- Run in the SQL editor of every project that used the legacy UnifiedCron setup.
-- This revokes only UnifiedCron's public cron interfaces; jobs/history are retained.
BEGIN;
DO $$
DECLARE object_name text; role_name text;
BEGIN
  FOREACH object_name IN ARRAY ARRAY['public.cron_jobs_view', 'public.cron_job_run_logs'] LOOP
    IF to_regclass(object_name) IS NOT NULL THEN
      EXECUTE format('REVOKE ALL ON %s FROM PUBLIC', object_name);
      FOREACH role_name IN ARRAY ARRAY['anon','authenticated'] LOOP
        IF EXISTS (SELECT 1 FROM pg_roles WHERE rolname = role_name) THEN
          EXECUTE format('REVOKE ALL ON %s FROM %I', object_name, role_name);
        END IF;
      END LOOP;
    END IF;
  END LOOP;
  IF to_regprocedure('public.get_latest_job_runs()') IS NOT NULL THEN
    REVOKE ALL ON FUNCTION public.get_latest_job_runs() FROM PUBLIC;
    FOREACH role_name IN ARRAY ARRAY['anon','authenticated'] LOOP
      IF EXISTS (SELECT 1 FROM pg_roles WHERE rolname = role_name) THEN
        EXECUTE format('REVOKE ALL ON FUNCTION public.get_latest_job_runs() FROM %I', role_name);
      END IF;
    END LOOP;
  END IF;
END $$;
COMMIT;
