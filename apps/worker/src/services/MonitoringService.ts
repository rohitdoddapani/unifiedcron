import { query } from '@unifiedcron/database';
import { ConnectionService } from '../services/ConnectionService';
import { AlertService } from '../services/AlertService';
import { NotificationService } from '../services/NotificationService';
import { Connection } from '@unifiedcron/shared';
import * as integrations from '@unifiedcron/integrations';
import { logEvent } from '@unifiedcron/shared';

interface SupabaseRun {
  jobid: number;
  jobname: string;
  status: string;
  start_time: string;
  end_time?: string;
  return_message?: string;
}

interface JobRow {
  id: string;
  name: string;
  metadata?: { jobId?: number };
  userId: string;
  connectionLabel: string;
}

interface MonitoringMetrics {
  lastRunAt: string | null;
  lastRunStatus: 'idle' | 'running' | 'success' | 'error';
  connectionsScanned: number;
  runsIngested: number;
  alertsCreated: number;
  alertsResolved: number;
  deliveriesQueued: number;
}

type UpsertOutcome = 'inserted' | 'updated' | 'noop';

export class MonitoringService {
  private connectionService: ConnectionService;
  private alertService: AlertService;
  private notificationService: NotificationService;
  private metrics: MonitoringMetrics;

  constructor() {
    this.connectionService = new ConnectionService();
    this.alertService = new AlertService();
    this.notificationService = new NotificationService();
    this.metrics = {
      lastRunAt: null,
      lastRunStatus: 'idle',
      connectionsScanned: 0,
      runsIngested: 0,
      alertsCreated: 0,
      alertsResolved: 0,
      deliveriesQueued: 0,
    };
  }

  async monitorSupabaseJobs(): Promise<void> {
    this.metrics = {
      ...this.metrics,
      lastRunAt: new Date().toISOString(),
      lastRunStatus: 'running',
      connectionsScanned: 0,
      runsIngested: 0,
      alertsCreated: 0,
      alertsResolved: 0,
      deliveriesQueued: 0,
    };

    const connections = await this.getSupabaseConnections();
    this.metrics.connectionsScanned = connections.length;

    try {
      let failures = 0;
      for (const connection of connections) {
        try {
          await this.monitorConnection(connection);
        } catch (error) {
          failures++;
          logEvent('error', 'monitoring.connection_failed', { connectionId: connection.id,
            name: error instanceof Error ? error.name : 'Error' });
        }
      }

      this.metrics.lastRunStatus = failures ? 'error' : 'success';
    } catch (error) {
      this.metrics.lastRunStatus = 'error';
      throw error;
    }
  }

  async getHealthSnapshot(): Promise<Record<string, unknown>> {
    const deliveryMetrics = await this.notificationService.getDeliveryMetrics();
    return {
      ...this.metrics,
      deliveryMetrics,
    };
  }

  private async getSupabaseConnections(): Promise<Connection[]> {
    const result = await query(
      'SELECT * FROM connections WHERE platform = $1',
      ['supabase']
    );

    const connections = await Promise.all(
      result.rows.map(async (row: { id: string }) => ({
        ...row,
        config: await this.connectionService.getDecryptedConfig(row.id),
      }))
    );

    return connections.filter((connection) => !!connection.config);
  }

  private async monitorConnection(connection: Connection): Promise<void> {
    if (!connection.config?.projectUrl || !connection.config?.anonKey) {
      return;
    }

    const latestRuns = await integrations.getLatestJobRuns(
      connection.config.projectUrl,
      connection.config.anonKey
    );

    const jobs = await this.getConnectionJobs(connection.id);
    for (const job of jobs) {
      const supabaseJobId = Number(job.metadata?.jobId);
      if (!supabaseJobId || Number.isNaN(supabaseJobId)) {
        continue;
      }

      const latestRun = latestRuns.get(supabaseJobId) as SupabaseRun | undefined;
      if (!latestRun) {
        continue;
      }

      const normalizedRun = this.normalizeRun(latestRun);
      if (!normalizedRun) {
        continue;
      }

      const sourceRunId = this.buildSourceRunId(normalizedRun);
      const upsertOutcome = await this.storeJobRun(job.id, sourceRunId, normalizedRun);
      if (upsertOutcome !== 'noop') {
        this.metrics.runsIngested++;
      }

      if (normalizedRun.status === 'failed') {
        const createdAlert = await this.handleJobFailure(job, normalizedRun, sourceRunId);
        if (createdAlert) {
          this.metrics.alertsCreated++;
        }
      }

      if (normalizedRun.status === 'succeeded') {
        const resolved = await this.alertService.resolveOpenAlertsForJob(job.id, {
          sourceRunId,
          reason: 'Automatically resolved after a subsequent successful run.',
        });
        this.metrics.alertsResolved += resolved;
      }
    }
  }

  private async getConnectionJobs(connectionId: string): Promise<JobRow[]> {
    const result = await query(
      `SELECT j.*,
              c."userId" as "userId",
              c.label as "connectionLabel"
       FROM jobs j
       JOIN connections c ON j."connectionId" = c.id
       WHERE j."connectionId" = $1`,
      [connectionId]
    );

    return result.rows as JobRow[];
  }

  private async handleJobFailure(job: JobRow, run: SupabaseRun, sourceRunId: string): Promise<boolean> {
    const { alert, created } = await this.alertService.createAlert({
      jobId: job.id,
      type: 'failure',
      sourceRunId,
      details: {
        jobRun: {
          sourceRunId,
          status: run.status,
          startTime: run.start_time,
          endTime: run.end_time,
          message: run.return_message,
        },
        detectedAt: new Date().toISOString(),
      },
    });

    const payload = {
      event: 'alert.failure',
      alertId: alert.id,
      sourceRunId,
      createdAt: alert.createdAt,
      job: {
        id: job.id,
        name: job.name,
      },
      details: alert.details,
    };

    const queued = await this.notificationService.queueAlertFailureDeliveries(alert.id, job.userId, payload);
    this.metrics.deliveriesQueued += queued;
    return created;
  }

  private async storeJobRun(jobId: string, sourceRunId: string, run: SupabaseRun): Promise<UpsertOutcome> {
    const result = await query(
      `INSERT INTO "jobRuns" ("jobId", "sourceRunId", status, "startedAt", "endedAt", message, "updatedAt")
       VALUES ($1, $2, $3, $4, $5, $6, NOW())
       ON CONFLICT ("jobId", "sourceRunId")
       DO UPDATE SET status = EXCLUDED.status,
                     "startedAt" = EXCLUDED."startedAt",
                     "endedAt" = EXCLUDED."endedAt",
                     message = EXCLUDED.message,
                     "updatedAt" = NOW()
       WHERE "jobRuns".status IS DISTINCT FROM EXCLUDED.status
          OR "jobRuns"."startedAt" IS DISTINCT FROM EXCLUDED."startedAt"
          OR "jobRuns"."endedAt" IS DISTINCT FROM EXCLUDED."endedAt"
          OR "jobRuns".message IS DISTINCT FROM EXCLUDED.message
       RETURNING (xmax = 0) AS inserted`,
      [
        jobId,
        sourceRunId,
        run.status,
        new Date(run.start_time),
        run.end_time ? new Date(run.end_time) : null,
        run.return_message || null,
      ]
    );

    if (result.rowCount === 0) {
      return 'noop';
    }

    return result.rows[0].inserted ? 'inserted' : 'updated';
  }

  private buildSourceRunId(run: SupabaseRun): string {
    return `supabase:${run.jobid}:${run.start_time}`;
  }

  private normalizeRun(run: SupabaseRun): SupabaseRun | null {
    const parsedStart = new Date(run.start_time);
    if (Number.isNaN(parsedStart.getTime())) {
      console.warn(`Skipping run with invalid start_time for job ${run.jobid}:`, run.start_time);
      return null;
    }

    const parsedEnd = run.end_time ? new Date(run.end_time) : null;
    return {
      ...run,
      start_time: parsedStart.toISOString(),
      end_time: parsedEnd && !Number.isNaN(parsedEnd.getTime()) ? parsedEnd.toISOString() : undefined,
    };
  }

  async cleanupOldData(): Promise<void> {
    await query(
      'DELETE FROM "jobRuns" WHERE "startedAt" < NOW() - INTERVAL \'30 days\''
    );

    await query(
      'DELETE FROM alerts WHERE "createdAt" < NOW() - INTERVAL \'90 days\''
    );

    await query(
      `DELETE FROM notification_deliveries
       WHERE "createdAt" < NOW() - INTERVAL '30 days'
         AND status IN ('succeeded', 'failed')`
    );
  }
}
