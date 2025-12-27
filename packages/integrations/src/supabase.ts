import { ParsedJob } from '@unifiedcron/shared';

interface SupabaseCronJob {
  jobid: number;
  jobname: string;
  schedule: string;
  command: string;
  nodename?: string;
  nodeport?: number;
  database?: string;
  username?: string;
  active?: boolean;
  jobhost?: string;
}

interface SupabaseCronJobRun {
  jobid: number;
  jobname: string;
  status: string;
  start_time: string;
  end_time?: string;
  return_message?: string;
}

/**
 * Fetches cron jobs from Supabase using the public API
 */
export async function fetchSupabaseCronJobs(
  projectUrl: string,
  anonKey: string
): Promise<ParsedJob[]> {
  try {
    const response = await fetch(
      `${projectUrl}/rest/v1/cron_jobs_view`,
      {
        headers: {
          'apikey': anonKey,
          'Authorization': `Bearer ${anonKey}`,
          'Accept': 'application/json',
          'Content-Type': 'application/json'
        }
      }
    );

    if (!response.ok) {
      throw new Error(`Supabase API error: ${response.status} ${response.statusText}`);
    }

    const jobs = await response.json() as SupabaseCronJob[];
    
    return jobs.map(job => ({
      name: job.jobname,
      cron: job.schedule,
      metadata: {
        jobId: job.jobid,
        command: job.command,
        database: job.database,
        username: job.username,
        active: job.active,
        nodename: job.nodename,
        nodeport: job.nodeport,
        jobhost: job.jobhost
      }
    }));
  } catch (error) {
    console.error('Error fetching Supabase cron jobs:', error);
    throw error;
  }
}

/**
 * Fetches recent job runs from Supabase for monitoring
 */
export async function fetchSupabaseJobRuns(
  projectUrl: string,
  anonKey: string
): Promise<SupabaseCronJobRun[]> {
  try {
    const response = await fetch(
      `${projectUrl}/rest/v1/cron_job_run_logs?select=jobid,jobname,status,start_time,end_time,return_message&order=start_time.desc&limit=100`,
      {
        headers: {
          'apikey': anonKey,
          'Authorization': `Bearer ${anonKey}`,
          'Accept': 'application/json',
          'Content-Type': 'application/json'
        }
      }
    );

    if (!response.ok) {
      throw new Error(`Supabase API error: ${response.status} ${response.statusText}`);
    }

    return await response.json() as SupabaseCronJobRun[];
  } catch (error) {
    console.error('Error fetching Supabase job runs:', error);
    throw error;
  }
}

/**
 * Validates Supabase project access
 */
export async function validateSupabaseAccess(
  projectUrl: string,
  anonKey: string
): Promise<boolean> {
  try {
    const response = await fetch(
      `${projectUrl}/rest/v1/cron_jobs_view?select=count`,
      {
        headers: {
          'apikey': anonKey,
          'Authorization': `Bearer ${anonKey}`,
          'Accept': 'application/json',
          'Content-Type': 'application/json'
        }
      }
    );

    return response.ok;
  } catch (error) {
    console.error('Error validating Supabase access:', error);
    return false;
  }
}

/**
 * Gets the latest run for each job to check for failures
 */
export async function getLatestJobRuns(
  projectUrl: string,
  anonKey: string
): Promise<Map<number, SupabaseCronJobRun>> {
  try {
    const runs = await fetchSupabaseJobRuns(projectUrl, anonKey);
    const latestRuns = new Map<number, SupabaseCronJobRun>();

    for (const run of runs) {
      if (!latestRuns.has(run.jobid)) {
        latestRuns.set(run.jobid, run);
      }
    }

    return latestRuns;
  } catch (error) {
    console.error('Error getting latest job runs:', error);
    throw error;
  }
}
