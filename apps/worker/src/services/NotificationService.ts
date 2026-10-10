import { getClient, query } from '@unifiedcron/database';
import { decrypt, logEvent, sendWebhook, WEBHOOK_MAX_ATTEMPTS, WEBHOOK_RETRY_MINUTES } from '@unifiedcron/shared';

interface Delivery {
  id: string; endpointId: string; attempt: number; event: string; claimToken: string;
  payload: Record<string, unknown>; url: string; secret: string; secretEncrypted: boolean;
}

export class NotificationService {
  async queueAlertFailureDeliveries(alertId: string, userId: string, payload: Record<string, unknown>): Promise<number> {
    const result = await query(
      `INSERT INTO notification_deliveries ("endpointId", "alertId", event, payload, status, "nextRetryAt")
       SELECT ne.id, $1, 'alert.failure', $3::jsonb, 'pending', NOW()
       FROM notification_endpoints ne WHERE ne."userId" = $2 AND ne.active = true
       AND ne."createdAt" <= (SELECT "createdAt" FROM alerts WHERE id = $1)
       ON CONFLICT ("endpointId", "alertId", event) DO NOTHING`,
      [alertId, userId, JSON.stringify(payload)]
    );
    return result.rowCount || 0;
  }

  // Repair the outbox if a process stopped between alert creation and enqueueing.
  async reconcileAlerts(): Promise<void> {
    await query(`INSERT INTO notification_deliveries ("endpointId","alertId",event,payload,"nextRetryAt")
      SELECT ne.id,a.id,ev.event,jsonb_build_object('event',ev.event,'alertId',a.id,'sourceRunId',a."sourceRunId",
        'createdAt',ev.at,'job',jsonb_build_object('id',j.id,'name',j.name),'details',a.details),NOW()
      FROM alerts a JOIN jobs j ON a."jobId"=j.id JOIN connections c ON j."connectionId"=c.id
      JOIN notification_endpoints ne ON ne."userId"=c."userId"
      CROSS JOIN LATERAL (VALUES ('alert.failure',a."createdAt"),('alert.resolved',a."resolvedAt")) ev(event,at)
      WHERE ne.active=true AND ne."createdAt"<=a."createdAt" AND a.type='failure'
        AND j."supersededById" IS NULL AND NOT (COALESCE(a.details,'{}') ? 'supersededByAlertId')
        AND a."sourceRunId" IS NOT NULL AND COALESCE(a.details->>'backfill','false')<>'true'
        AND (ev.event='alert.failure' OR (a.status='resolved' AND a."incidentModel"=true))
      ON CONFLICT ("endpointId","alertId",event) DO NOTHING`);
  }

  async processPendingDeliveries(): Promise<void> {
    const client = await getClient();
    let deliveries: Delivery[];
    try {
      await client.query('BEGIN');
      // Expired leases count as failed attempts and obey the same retry policy.
      await client.query(`UPDATE notification_delivery_attempts a SET status = 'failed', "finishedAt" = NOW(),
        "errorMessage" = 'Worker lease expired; delivery outcome unknown'
        FROM notification_deliveries d WHERE a."deliveryId" = d.id AND a.attempt = d.attempt
        AND a.status = 'processing' AND d."lockedUntil" <= NOW()`);
      await client.query(`UPDATE notification_deliveries SET
        status = CASE WHEN attempt >= $1 THEN 'failed' ELSE 'retrying' END,
        "nextRetryAt" = CASE WHEN attempt >= $1 THEN NULL ELSE NOW() +
          (ARRAY[1,5,15,30,60])[attempt] * INTERVAL '1 minute' END,
        "errorMessage" = 'Worker lease expired; delivery outcome unknown',
        "claimToken" = NULL, "lockedUntil" = NULL, "updatedAt" = NOW()
        WHERE status IN ('pending','retrying') AND "lockedUntil" <= NOW()`, [WEBHOOK_MAX_ATTEMPTS]);
      const claimed = await client.query(`WITH due AS (
          SELECT d.id FROM notification_deliveries d JOIN notification_endpoints ne ON ne.id = d."endpointId"
          WHERE d.status IN ('pending','retrying') AND ne.active = true
            AND d.attempt < $1 AND d."claimToken" IS NULL AND d."nextRetryAt" <= NOW()
            AND (d.event <> 'alert.resolved' OR NOT EXISTS (
              SELECT 1 FROM notification_deliveries opener WHERE opener."endpointId"=d."endpointId"
              AND opener."alertId"=d."alertId" AND opener.event='alert.failure' AND opener.status IN ('pending','retrying')))
          ORDER BY d."nextRetryAt", d.id LIMIT 20 FOR UPDATE OF d SKIP LOCKED
        ), claimed AS (
          UPDATE notification_deliveries d SET "claimToken" = gen_random_uuid(),
            "lockedUntil" = NOW() + INTERVAL '120 seconds', attempt = attempt + 1, "updatedAt" = NOW()
          FROM due WHERE d.id = due.id RETURNING d.*
        ) SELECT claimed.*, ne.url, ne.secret, ne."secretEncrypted"
          FROM claimed JOIN notification_endpoints ne ON ne.id = claimed."endpointId"`, [WEBHOOK_MAX_ATTEMPTS]);
      deliveries = claimed.rows;
      for (const delivery of deliveries) {
        await client.query(`INSERT INTO notification_delivery_attempts ("deliveryId", attempt, status)
          VALUES ($1, $2, 'processing')`, [delivery.id, delivery.attempt]);
      }
      await client.query('COMMIT');
    } catch (error) {
      await client.query('ROLLBACK');
      throw error;
    } finally { client.release(); }
    // Four batches bound resource use and finish within the lease even at the timeout.
    for (let i = 0; i < deliveries.length; i += 5) {
      await Promise.all(deliveries.slice(i, i + 5).map(delivery => this.deliver(delivery)));
    }
  }

  async getDeliveryMetrics(): Promise<Record<string, number>> {
    const result = await query('SELECT status, COUNT(*)::int as count FROM notification_deliveries GROUP BY status');
    return result.rows.reduce((acc: Record<string, number>, row: { status: string; count: number }) => {
      acc[row.status] = Number(row.count); return acc;
    }, { pending: 0, retrying: 0, succeeded: 0, failed: 0 });
  }

  private async deliver(delivery: Delivery): Promise<void> {
    let status: number | null = null;
    let body: string | null = null;
    let errorMessage: string | null = null;
    try {
      const secret = delivery.secretEncrypted
        ? await decrypt(delivery.secret, process.env.ENCRYPTION_KEY || '') : delivery.secret;
      const response = await sendWebhook({ url: delivery.url, secret, payload: delivery.payload,
        event: delivery.event, deliveryId: delivery.id });
      status = response.status; body = response.body;
      if (status < 200 || status >= 300) errorMessage = `HTTP ${status}`;
    } catch (error) {
      // Transport errors have no credential-bearing request URLs.
      errorMessage = error instanceof Error ? error.message.slice(0, 512) : 'Webhook delivery failed';
    }
    const succeeded = !errorMessage;
    const retry = WEBHOOK_RETRY_MINUTES[delivery.attempt - 1];
    const terminal = !succeeded && retry === undefined;
    const client = await getClient();
    try {
      await client.query('BEGIN');
      const result = await client.query(`UPDATE notification_deliveries SET status = $3::text,
        "responseStatus" = $4, "responseBody" = $5, "errorMessage" = $6,
        "deliveredAt" = CASE WHEN $3::text = 'succeeded' THEN NOW() ELSE NULL END,
        "nextRetryAt" = CASE WHEN $3::text = 'retrying' THEN NOW() + $7::int * INTERVAL '1 minute' ELSE NULL END,
        "claimToken" = NULL, "lockedUntil" = NULL, "updatedAt" = NOW()
        WHERE id = $1 AND "claimToken" = $2`,
      [delivery.id, delivery.claimToken, succeeded ? 'succeeded' : terminal ? 'failed' : 'retrying',
        status, body, errorMessage, retry ?? null]);
      if (result.rowCount) {
        await client.query(`UPDATE notification_delivery_attempts SET status = $3, "finishedAt" = NOW(),
          "responseStatus" = $4, "responseBody" = $5, "errorMessage" = $6 WHERE "deliveryId" = $1 AND attempt = $2`,
        [delivery.id, delivery.attempt, succeeded ? 'succeeded' : 'failed', status, body, errorMessage]);
      }
      await client.query('COMMIT');
      logEvent(succeeded ? 'info' : 'warn', 'webhook.delivery', { deliveryId: delivery.id,
        endpointId: delivery.endpointId, attempt: delivery.attempt, status: succeeded ? 'succeeded' : terminal ? 'failed' : 'retrying', responseStatus: status });
    } catch (error) { await client.query('ROLLBACK'); throw error; }
    finally { client.release(); }
  }
}
