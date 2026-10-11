import { query } from '@unifiedcron/database';
import { logEvent, Connection } from '@unifiedcron/shared';
import { ConnectionService } from './ConnectionService';
import { NotificationService } from './NotificationService';
import { SupabaseIngestionService } from './SupabaseIngestionService';

export class MonitoringService {
  private connections = new ConnectionService();
  private ingestion = new SupabaseIngestionService();
  private notifications = new NotificationService();
  private metrics = { lastRunAt: null as string | null, lastRunStatus: 'idle', connectionsScanned: 0, runsIngested: 0 };

  async monitorSupabaseJobs(): Promise<void> {
    this.metrics = { lastRunAt: new Date().toISOString(), lastRunStatus: 'running', connectionsScanned: 0, runsIngested: 0 };
    const rows = (await query(`SELECT c.* FROM connections c LEFT JOIN ingestion_state s
      ON s."connectionId"=c.id AND s.stream='supabase.runs'
      WHERE c.platform='supabase' AND (s."nextPollAt" IS NULL OR s."nextPollAt" <= NOW())`)).rows;
    let failures = 0;
    for (let i = 0; i < rows.length; i += 3) {
      await Promise.all(rows.slice(i,i+3).map(async (row: Connection) => {
        this.metrics.connectionsScanned++;
        try {
          await new Promise(resolve => setTimeout(resolve, Math.floor(Math.random()*1000)));
          const config = await this.connections.getDecryptedConfig(row.id);
          if (!config) throw new Error('Connection credentials are unavailable');
          const result = await this.ingestion.sync({ ...row, config });
          this.metrics.runsIngested += result.runs;
        } catch (error) {
          failures++;
          logEvent('error','monitoring.connection_failed',{connectionId:row.id,name:error instanceof Error ? error.name : 'Error'});
        }
      }));
    }
    this.metrics.lastRunStatus = failures ? 'error' : 'success';
  }

  async getHealthSnapshot() {
    return { ...this.metrics, deliveryMetrics: await this.notifications.getDeliveryMetrics() };
  }

  async cleanupOldData() {
    // Retain the digest for retry receipts, but discard processed telemetry bodies.
    await query(`UPDATE supabase_push_batches SET payload='{}'::jsonb WHERE "processedAt" < NOW()-INTERVAL '7 days' AND payload<>'{}'::jsonb`);
    // Error text can contain sensitive provider data. Retain it for seven days only.
    await query(`UPDATE "jobRuns" SET message=NULL WHERE message IS NOT NULL AND "startedAt" < NOW()-INTERVAL '7 days'`);
    await query(`UPDATE alerts SET details=jsonb_set(details,'{jobRun,message}','null'::jsonb)
      WHERE "createdAt" < NOW()-INTERVAL '7 days' AND details #>> '{jobRun,message}' IS NOT NULL`);
    await query(`UPDATE notification_deliveries SET payload=jsonb_set(payload,'{details,jobRun,message}','null'::jsonb)
      WHERE "createdAt" < NOW()-INTERVAL '7 days' AND payload #>> '{details,jobRun,message}' IS NOT NULL`);
    await query(`DELETE FROM "jobRuns" WHERE "startedAt" < NOW()-INTERVAL '30 days'`);
    await query(`DELETE FROM alerts WHERE status='resolved' AND "resolvedAt" < NOW()-INTERVAL '90 days'`);
    await query(`DELETE FROM notification_deliveries WHERE "createdAt" < NOW()-INTERVAL '30 days' AND status IN ('succeeded','failed')`);
  }
}
