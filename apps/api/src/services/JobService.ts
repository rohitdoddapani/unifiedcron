import { query, syncSupabaseJobs } from '@unifiedcron/database';
import { Job, JobRun } from '@unifiedcron/shared';
import { ConnectionService } from './ConnectionService';
import * as integrations from '@unifiedcron/integrations';

export class JobService {
  private connectionService: ConnectionService;

  constructor() {
    this.connectionService = new ConnectionService();
  }

  async getJobs(
    userId: string,
    options: { platform?: string; limit?: number; offset?: number } = {}
  ): Promise<Job[]> {
    const { platform, limit = 100, offset = 0 } = options;

    let queryStr = `
      SELECT j.*, c.label as "connectionLabel"
      FROM jobs j
      JOIN connections c ON j."connectionId" = c.id
      WHERE c."userId" = $1 AND j."removedAt" IS NULL
    `;
    
    const params: any[] = [userId];
    let paramCount = 1;

    if (platform) {
      paramCount++;
      queryStr += ` AND j.platform = $${paramCount}`;
      params.push(platform);
    }

    queryStr += ` ORDER BY j."lastSeenAt" DESC LIMIT $${++paramCount} OFFSET $${++paramCount}`;
    params.push(limit, offset);

    const result = await query(queryStr, params);
    return result.rows.map((row: Job) => this.safeJob(row));
  }

  async getJob(id: string, userId: string): Promise<Job | null> {
    const result = await query(
      `SELECT j.*, c.label as "connectionLabel"
       FROM jobs j
       JOIN connections c ON j."connectionId" = c.id
       WHERE j.id = $1 AND c."userId" = $2`,
      [id, userId]
    );

    return result.rows.length > 0 ? this.safeJob(result.rows[0]) : null;
  }

  async refreshJobs(connectionId: string, userId: string) {
    const connection = await this.connectionService.getConnection(connectionId, userId);
    if (!connection) throw new Error('Connection not found or access denied');
    if (connection.platform !== 'supabase') throw new Error('Unsupported platform');
    const jobs = await integrations.fetchSupabaseCronJobs(connection.config);
    return syncSupabaseJobs(connectionId, connection.label, jobs);
  }

  async getJobRuns(
    jobId: string,
    userId: string,
    options: { limit?: number; offset?: number } = {}
  ): Promise<JobRun[]> {
    const { limit = 50, offset = 0 } = options;

    // Verify user owns the job
    const job = await this.getJob(jobId, userId);
    if (!job) {
      throw new Error('Job not found or access denied');
    }

    const result = await query(
      `SELECT * FROM "jobRuns"
       WHERE "jobId" IN (SELECT id FROM jobs WHERE id=$1 OR "supersededById"=$1)
       ORDER BY "startedAt" DESC
       LIMIT $2 OFFSET $3`,
      [jobId, limit, offset]
    );

    return result.rows;
  }

  async getJobStats(jobId: string, userId: string): Promise<any> {
    // Verify user owns the job
    const job = await this.getJob(jobId, userId);
    if (!job) {
      throw new Error('Job not found or access denied');
    }

    const statsResult = await query(
      `SELECT 
         COUNT(*) as "totalRuns",
         COUNT(CASE WHEN status = 'succeeded' THEN 1 END) as "successfulRuns",
         COUNT(CASE WHEN status = 'failed' THEN 1 END) as "failedRuns",
         COUNT(CASE WHEN status = 'running' THEN 1 END) as "runningRuns",
         MAX("startedAt") as "lastRun",
         AVG(CASE WHEN "endedAt" IS NOT NULL THEN EXTRACT(EPOCH FROM ("endedAt" - "startedAt")) END) as "avgDuration"
       FROM "jobRuns"
       WHERE "jobId" IN (SELECT id FROM jobs WHERE id=$1 OR "supersededById"=$1)`,
      [jobId]
    );

    const alertCountResult = await query(
      'SELECT COUNT(*) as "alertCount" FROM alerts WHERE "jobId" IN (SELECT id FROM jobs WHERE id=$1 OR "supersededById"=$1)',
      [jobId]
    );

    return {
      ...statsResult.rows[0],
      alertCount: parseInt(alertCountResult.rows[0].alertCount)
    };
  }

  private safeJob(job: Job): Job {
    const { command: _command, ...metadata } = job.metadata || {};
    return { ...job, metadata };
  }
}
