import { query } from '@unifiedcron/database';
import { ConnectionService } from '../services/ConnectionService';
import { AlertService } from '../services/AlertService';
import { Connection, Platform } from '@unifiedcron/shared';
import * as integrations from '@unifiedcron/integrations';

export class MonitoringService {
  private connectionService: ConnectionService;
  private alertService: AlertService;

  constructor() {
    this.connectionService = new ConnectionService();
    this.alertService = new AlertService();
  }

  async monitorSupabaseJobs(): Promise<void> {
    console.log('🔍 Monitoring Supabase jobs...');

    // Get all Supabase connections
    const connections = await this.getSupabaseConnections();
    
    for (const connection of connections) {
      try {
        await this.monitorConnection(connection);
      } catch (error) {
        console.error(`Failed to monitor connection ${connection.id}:`, error);
      }
    }
  }

  private async getSupabaseConnections(): Promise<Connection[]> {
    const result = await query(
      'SELECT * FROM connections WHERE platform = $1',
      ['supabase']
    );

    // Decrypt configs for all connections
    const connections = await Promise.all(
      result.rows.map(async (row) => ({
        ...row,
        config: await this.connectionService.getDecryptedConfig(row.id)
      }))
    );

    return connections.filter(conn => conn.config);
  }

  private async monitorConnection(connection: Connection): Promise<void> {
    console.log(`📊 Monitoring connection: ${connection.label}`);

    try {
      // Get latest job runs from Supabase
      const latestRuns = await integrations.getLatestJobRuns(
        connection.config!.projectUrl!,
        connection.config!.anonKey!
      );

      // Get our jobs for this connection
      const jobs = await this.getConnectionJobs(connection.id);

      for (const job of jobs) {
        const supabaseJobId = job.metadata?.jobId;
        if (!supabaseJobId) {
          continue;
        }

        const latestRun = latestRuns.get(supabaseJobId);
        if (!latestRun) {
          continue;
        }

        // Check if the job failed
        if (latestRun.status === 'failed') {
          await this.handleJobFailure(job.id, latestRun);
        }

        // Store the job run in our database
        await this.storeJobRun(job.id, latestRun);
      }
    } catch (error) {
      console.error(`Error monitoring connection ${connection.id}:`, error);
    }
  }

  private async getConnectionJobs(connectionId: string): Promise<any[]> {
    const result = await query(
      'SELECT * FROM jobs WHERE "connectionId" = $1',
      [connectionId]
    );

    return result.rows;
  }

  private async handleJobFailure(jobId: string, run: any): Promise<void> {
    // Check if we already have a recent alert for this job
    const hasRecentAlert = await this.alertService.hasRecentAlert(
      jobId,
      'failure',
      60 // within 60 minutes
    );

    if (hasRecentAlert) {
      console.log(`⏭️  Skipping alert for job ${jobId} - recent alert exists`);
      return;
    }

    // Create a new alert
    const alert = await this.alertService.createAlert({
      jobId,
      type: 'failure',
      details: {
        jobRun: {
          status: run.status,
          startTime: run.start_time,
          endTime: run.end_time,
          message: run.return_message
        },
        detectedAt: new Date().toISOString()
      }
    });

    console.log(`🚨 Created failure alert for job ${jobId}: ${alert.id}`);

    // TODO: Send notification (email, Slack, webhook, etc.)
    await this.sendFailureNotification(alert);
  }

  private async storeJobRun(jobId: string, run: any): Promise<void> {
    try {
      await query(
        `INSERT INTO "jobRuns" ("jobId", status, "startedAt", "endedAt", message)
         VALUES ($1, $2, $3, $4, $5)
         ON CONFLICT DO NOTHING`,
        [
          jobId,
          run.status,
          new Date(run.start_time),
          run.end_time ? new Date(run.end_time) : null,
          run.return_message
        ]
      );
    } catch (error) {
      console.error('Failed to store job run:', error);
    }
  }

  private async sendFailureNotification(alert: any): Promise<void> {
    // TODO: Implement notification sending
    // This could be:
    // - Email via SendGrid/SES
    // - Slack webhook
    // - Discord webhook
    // - Custom webhook
    
    console.log(`📧 TODO: Send failure notification for alert ${alert.id}`);
    
    // For now, just log the alert details
    console.log('Alert details:', {
      jobId: alert.jobId,
      type: alert.type,
      details: alert.details,
      createdAt: alert.createdAt
    });
  }

  async cleanupOldData(): Promise<void> {
    console.log('🧹 Cleaning up old data...');

    try {
      // Clean up old job runs (older than 30 days)
      const jobRunsResult = await query(
        'DELETE FROM "jobRuns" WHERE "startedAt" < NOW() - INTERVAL \'30 days\''
      );
      console.log(`🗑️  Deleted ${jobRunsResult.rowCount} old job runs`);

      // Clean up old alerts (older than 90 days)
      const alertsResult = await query(
        'DELETE FROM alerts WHERE "createdAt" < NOW() - INTERVAL \'90 days\''
      );
      console.log(`🗑️  Deleted ${alertsResult.rowCount} old alerts`);

      // Update last seen timestamps for jobs that haven't been seen recently
      const staleJobsResult = await query(
        'UPDATE jobs SET "lastSeenAt" = NOW() WHERE "lastSeenAt" < NOW() - INTERVAL \'7 days\''
      );
      console.log(`🔄 Updated ${staleJobsResult.rowCount} stale job timestamps`);

    } catch (error) {
      console.error('Cleanup failed:', error);
    }
  }
}
