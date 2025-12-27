import { query } from '@unifiedcron/database';
import { Job, JobRun, Platform, ParsedJob } from '@unifiedcron/shared';
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
      WHERE c."userId" = $1
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
    return result.rows;
  }

  async getJob(id: string, userId: string): Promise<Job | null> {
    const result = await query(
      `SELECT j.*, c.label as "connectionLabel"
       FROM jobs j
       JOIN connections c ON j."connectionId" = c.id
       WHERE j.id = $1 AND c."userId" = $2`,
      [id, userId]
    );

    return result.rows.length > 0 ? result.rows[0] : null;
  }

  async refreshJobs(connectionId: string, userId: string): Promise<{ added: number; updated: number; errors: string[] }> {
    // Verify user owns the connection
    const connection = await this.connectionService.getConnection(connectionId, userId);
    if (!connection) {
      throw new Error('Connection not found or access denied');
    }

    const config = await this.connectionService.getDecryptedConfig(connectionId);
    if (!config) {
      throw new Error('Failed to decrypt connection config');
    }

    let parsedJobs: ParsedJob[] = [];
    const errors: string[] = [];

    try {
      // Currently only Supabase is supported
      if (connection.platform !== 'supabase') {
        throw new Error(`Platform '${connection.platform}' is not supported. Only Supabase is currently available.`);
      }

      parsedJobs = await integrations.fetchSupabaseCronJobs(
        config.projectUrl!,
        config.anonKey!
      );

      // Store or update jobs
      let added = 0;
      let updated = 0;

      for (const parsedJob of parsedJobs) {
        try {
          const existingJob = await this.getJobByOriginId(connectionId, parsedJob.name);
          
          const jobData = {
            connectionId,
            originId: parsedJob.name,
            name: parsedJob.name,
            cron: parsedJob.cron,
            platform: connection.platform,
            project: this.getProjectName(connection.platform, config),
            metadata: parsedJob.metadata || {}
          };

          if (existingJob) {
            await this.updateJob(existingJob.id, jobData);
            updated++;
          } else {
            await this.createJob(jobData);
            added++;
          }
        } catch (error) {
          errors.push(`Failed to process job ${parsedJob.name}: ${error instanceof Error ? error.message : 'Unknown error'}`);
        }
      }

      return { added, updated, errors };
    } catch (error) {
      throw new Error(`Failed to refresh jobs: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
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
       WHERE "jobId" = $1
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
       WHERE "jobId" = $1`,
      [jobId]
    );

    const alertCountResult = await query(
      'SELECT COUNT(*) as "alertCount" FROM alerts WHERE "jobId" = $1',
      [jobId]
    );

    return {
      ...statsResult.rows[0],
      alertCount: parseInt(alertCountResult.rows[0].alertCount)
    };
  }

  private async createJob(data: {
    connectionId: string;
    originId: string;
    name: string;
    cron: string;
    platform: Platform;
    project: string;
    metadata: any;
  }): Promise<Job> {
    const result = await query(
      `INSERT INTO jobs ("connectionId", "originId", name, cron, platform, project, metadata)
       VALUES ($1, $2, $3, $4, $5, $6, $7)
       RETURNING *`,
      [data.connectionId, data.originId, data.name, data.cron, data.platform, data.project, JSON.stringify(data.metadata)]
    );

    return result.rows[0];
  }

  private async updateJob(id: string, data: {
    name: string;
    cron: string;
    metadata: any;
  }): Promise<Job> {
    const result = await query(
      `UPDATE jobs 
       SET name = $1, cron = $2, metadata = $3, "lastSeenAt" = NOW()
       WHERE id = $4
       RETURNING *`,
      [data.name, data.cron, JSON.stringify(data.metadata), id]
    );

    return result.rows[0];
  }

  private async getJobByOriginId(connectionId: string, originId: string): Promise<Job | null> {
    const result = await query(
      'SELECT * FROM jobs WHERE "connectionId" = $1 AND "originId" = $2',
      [connectionId, originId]
    );

    return result.rows.length > 0 ? result.rows[0] : null;
  }

  private getProjectName(platform: Platform, config: any): string {
    // Currently only Supabase is supported
    if (platform === 'supabase') {
      return config.projectUrl ? new URL(config.projectUrl).hostname : 'unknown';
    }
    return 'unknown';
  }
}
