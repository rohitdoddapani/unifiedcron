# Supabase Setup Guide

This guide will help you connect your Supabase project to UnifiedCron for discovering and monitoring cron jobs.

## Prerequisites

- A Supabase project (cloud or self-hosted)
- Admin access to your Supabase database
- Basic knowledge of SQL

## Current Support

UnifiedCron currently supports **Supabase only**. Other platforms (GitHub Actions, Vercel, Netlify, n8n) will be added in future releases.

## Step 1: Set Up Database Views

To allow UnifiedCron to read cron job information, you need to create public views in your Supabase database.

### 1.1 Access Supabase SQL Editor

1. Open your Supabase project dashboard
2. Navigate to **SQL Editor**
3. Create a new query

### 1.2 Run the Setup SQL

Copy and paste the following SQL into the SQL Editor:

```sql
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
```

### 1.3 Verify Setup

Run this query to verify the views were created:

```sql
SELECT table_name 
FROM information_schema.views 
WHERE table_schema = 'public' 
AND table_name IN ('cron_jobs_view', 'cron_job_run_logs');
```

You should see both views listed.

## Step 2: Get Your Supabase Credentials

### 2.1 Project URL

1. Go to **Settings** → **API** in your Supabase dashboard
2. Find your **Project URL** (looks like: `https://xxxxx.supabase.co`)
3. Copy this URL

### 2.2 Anonymous Key

1. In the same **Settings** → **API** page
2. Find the **anon public** key under "Project API keys"
3. Copy this key (starts with `eyJ...`)

**Note**: We use the anonymous key (not the service role key) for security. The views we created allow read-only access with the anon key.

## Step 3: Connect in UnifiedCron

### 3.1 Access Connections Page

1. Open UnifiedCron in your browser
2. Navigate to **Connections** page
3. Click **Add Supabase Connection**

### 3.2 Enter Connection Details

Fill in the form:

- **Connection Label**: A friendly name (e.g., "Production Database")
- **Project URL**: Your Supabase project URL
- **Anonymous Key**: Your Supabase anon key

### 3.3 Test Connection

Click **Test & Connect** to verify:

- The connection can reach your Supabase project
- The views are accessible
- Cron jobs can be discovered

## Step 4: Discover Jobs

After connecting:

1. Go to the **Dashboard**
2. Click **Refresh Jobs** on your connection
3. UnifiedCron will discover all active cron jobs from your Supabase database
4. Jobs will appear in the dashboard with their schedules

## Understanding Cron Jobs in Supabase

### Viewing Jobs in Supabase

To see your cron jobs directly in Supabase:

```sql
SELECT * FROM cron.job WHERE active = true;
```

### Viewing Job Run History

```sql
SELECT * FROM cron.job_run_details 
ORDER BY start_time DESC 
LIMIT 10;
```

## Security Considerations

### Read-Only Access

- UnifiedCron uses **read-only** access patterns
- The anonymous key only has `SELECT` permission on the views
- No modification of cron jobs is possible through UnifiedCron
- Your credentials are encrypted before storage

### Recommended Setup

1. **Separate projects**: Use different Supabase projects for production and staging
2. **Limited scope**: The views only expose necessary information
3. **Active jobs only**: Only active cron jobs are visible
4. **Encrypted storage**: All credentials are encrypted at rest

## Troubleshooting

### Connection Test Fails

**Error: "Failed to connect to Supabase"**

1. Verify your Project URL is correct
2. Check that your anon key is valid
3. Ensure the views were created successfully
4. Check Supabase project status (not paused)

**Error: "Permission denied"**

1. Verify the GRANT statements were executed
2. Check that the views exist:
   ```sql
   \dv cron_jobs_view
   \dv cron_job_run_logs
   ```
3. Re-run the GRANT statements if needed

### No Jobs Discovered

**Possible causes:**

1. **No active cron jobs**: 
   ```sql
   SELECT COUNT(*) FROM cron.job WHERE active = true;
   ```

2. **Views not accessible**:
   ```sql
   SET ROLE anon;
   SELECT * FROM cron_jobs_view LIMIT 1;
   ```

3. **Wrong project**: Verify you connected to the correct Supabase project

### Jobs Not Updating

- Jobs are discovered when you click "Refresh Jobs"
- Automatic refresh is not yet implemented (coming soon)
- Manual refresh is required for now

## Example Cron Job Setup

If you want to test with a sample cron job in Supabase:

```sql
-- Schedule a test job (runs every minute)
SELECT cron.schedule(
  'test-job', 
  '* * * * *', 
  $$SELECT NOW()$$
);

-- Verify it was created
SELECT * FROM cron.job WHERE jobname = 'test-job';

-- View its runs
SELECT * FROM cron.job_run_details 
WHERE jobid = (SELECT jobid FROM cron.job WHERE jobname = 'test-job')
ORDER BY start_time DESC;
```

## Next Steps

- Connect multiple Supabase projects
- Monitor job schedules
- View job metadata
- Set up additional connections as needed

## Future Features

Coming soon:
- Automatic job discovery refresh
- Job run monitoring and alerting
- Failure notifications
- Job statistics and analytics

## Support

For issues:
- Check Supabase logs in your project dashboard
- Verify the SQL views are set up correctly
- Review connection test error messages
- Open an issue on GitHub
