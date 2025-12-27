-- Supabase Setup SQL for UnifiedCron
-- Run this in your Supabase SQL editor to create the required views

-- Create a view for cron jobs (read-only access for anon users)
CREATE OR REPLACE VIEW cron_jobs_view AS
SELECT 
  jobid,
  jobname,
  schedule,
  command,
  nodename,
  nodeport,
  database,
  username,
  active,
  jobhost
FROM cron.job
WHERE active = true;

-- Create a view for job run logs (read-only access for anon users)
CREATE OR REPLACE VIEW cron_job_run_logs AS
SELECT 
  jrd.jobid,
  j.jobname,
  jrd.status,
  jrd.start_time,
  jrd.end_time,
  jrd.return_message
FROM cron.job_run_details jrd
JOIN cron.job j ON jrd.jobid = j.jobid
ORDER BY jrd.start_time DESC;

-- Grant read access to anonymous users
GRANT SELECT ON cron_jobs_view TO anon;
GRANT SELECT ON cron_job_run_logs TO anon;

-- Optional: Create indexes for better performance
CREATE INDEX IF NOT EXISTS idx_cron_job_run_details_jobid_start_time 
ON cron.job_run_details(jobid, start_time DESC);

-- Optional: Create a function to get the latest run per job
CREATE OR REPLACE FUNCTION get_latest_job_runs()
RETURNS TABLE (
  jobid bigint,
  jobname text,
  status text,
  start_time timestamptz,
  end_time timestamptz,
  return_message text
) AS $$
BEGIN
  RETURN QUERY
  WITH latest_runs AS (
    SELECT DISTINCT ON (jrd.jobid)
      jrd.jobid,
      j.jobname,
      jrd.status,
      jrd.start_time,
      jrd.end_time,
      jrd.return_message
    FROM cron.job_run_details jrd
    JOIN cron.job j ON jrd.jobid = j.jobid
    ORDER BY jrd.jobid, jrd.start_time DESC
  )
  SELECT * FROM latest_runs;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Grant execute permission to anon users
GRANT EXECUTE ON FUNCTION get_latest_job_runs() TO anon;
