import { getClient, query } from '@unifiedcron/database';
import { Alert, AlertType } from '@unifiedcron/shared';

export class AlertService {
  async createAlert(data: {
    jobId: string;
    type: AlertType;
    sourceRunId?: string;
    details: any;
  }): Promise<{ alert: Alert; created: boolean }> {
    if (!data.sourceRunId) {
      const result = await query(
        `INSERT INTO alerts ("jobId", type, "sourceRunId", status, details)
         VALUES ($1, $2, $3, 'open', $4)
         RETURNING *`,
        [data.jobId, data.type, null, JSON.stringify(data.details)]
      );

      return { alert: result.rows[0], created: true };
    }

    const client = await getClient();
    const lockScope = data.jobId;
    const lockKey = `${data.type}:${data.sourceRunId}`;

    try {
      await client.query('BEGIN');
      await client.query('SELECT pg_advisory_xact_lock(hashtext($1), hashtext($2))', [lockScope, lockKey]);

      const existing = await client.query(
        `SELECT *
         FROM alerts
         WHERE "jobId" = $1
           AND type = $2
           AND "sourceRunId" = $3
         LIMIT 1`,
        [data.jobId, data.type, data.sourceRunId]
      );
      if (existing.rows.length > 0) {
        await client.query('COMMIT');
        return { alert: existing.rows[0], created: false };
      }

      const inserted = await client.query(
        `INSERT INTO alerts ("jobId", type, "sourceRunId", status, details)
         VALUES ($1, $2, $3, 'open', $4)
         RETURNING *`,
        [data.jobId, data.type, data.sourceRunId, JSON.stringify(data.details)]
      );
      await client.query('COMMIT');
      return { alert: inserted.rows[0], created: true };
    } catch (error) {
      await client.query('ROLLBACK');
      throw error;
    } finally {
      client.release();
    }
  }

  async hasRecentAlert(jobId: string, type: AlertType, withinMinutes: number = 60): Promise<boolean> {
    const result = await query(
      `SELECT COUNT(*) as count
       FROM alerts 
       WHERE "jobId" = $1 
         AND type = $2 
         AND status = 'open'
         AND "createdAt" > NOW() - INTERVAL '${withinMinutes} minutes'`,
      [jobId, type]
    );

    return parseInt(result.rows[0].count) > 0;
  }

  async getAlertBySourceRun(jobId: string, type: AlertType, sourceRunId: string): Promise<Alert | null> {
    const result = await query(
      `SELECT *
       FROM alerts
       WHERE "jobId" = $1
         AND type = $2
         AND "sourceRunId" = $3
       LIMIT 1`,
      [jobId, type, sourceRunId]
    );

    return result.rows.length > 0 ? result.rows[0] : null;
  }

  async resolveOpenAlertsForJob(jobId: string, context?: { sourceRunId?: string; reason?: string }): Promise<number> {
    const resolvedAt = new Date().toISOString();
    const resolutionDetails = {
      resolved: true,
      resolvedAt,
      autoResolvedAt: resolvedAt,
      resolution: {
        source: 'auto_success',
        reason: context?.reason || 'Automatically resolved after a subsequent successful run.',
        ...(context?.sourceRunId ? { sourceRunId: context.sourceRunId } : {}),
      },
    };

    const result = await query(
      `UPDATE alerts
       SET status = 'resolved',
           "resolvedAt" = NOW(),
           "updatedAt" = NOW(),
           details = details || $2
       WHERE "jobId" = $1
         AND status = 'open'`,
      [jobId, JSON.stringify(resolutionDetails)]
    );

    return result.rowCount || 0;
  }
}
