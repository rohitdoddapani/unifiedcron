import { query } from '@unifiedcron/database';
import { Alert, AlertType } from '@unifiedcron/shared';

type ResolutionSource = 'manual' | 'auto_success';

interface ResolutionMetadata {
  source?: ResolutionSource;
  reason?: string;
  resolvedByUserId?: string;
  sourceRunId?: string;
}

export class AlertService {
  async getAlerts(
    userId: string,
    options: { type?: string; status?: string; limit?: number; offset?: number } = {}
  ): Promise<Alert[]> {
    const { type, status, limit = 50, offset = 0 } = options;

    let queryStr = `
      SELECT a.*, j.name as "jobName", j.platform, j.project, c.label as "connectionLabel"
      FROM alerts a
      JOIN jobs j ON a."jobId" = j.id
      JOIN connections c ON j."connectionId" = c.id
      WHERE c."userId" = $1
    `;
    
    const params: any[] = [userId];
    let paramCount = 1;

    if (type) {
      paramCount++;
      queryStr += ` AND a.type = $${paramCount}`;
      params.push(type);
    }

    if (status) {
      paramCount++;
      queryStr += ` AND a.status = $${paramCount}`;
      params.push(status);
    }

    queryStr += ` ORDER BY a."createdAt" DESC LIMIT $${++paramCount} OFFSET $${++paramCount}`;
    params.push(limit, offset);

    const result = await query(queryStr, params);
    return result.rows;
  }

  async getAlert(id: string, userId: string): Promise<Alert | null> {
    const result = await query(
      `SELECT a.*, j.name as "jobName", j.platform, j.project, c.label as "connectionLabel"
       FROM alerts a
       JOIN jobs j ON a."jobId" = j.id
       JOIN connections c ON j."connectionId" = c.id
       WHERE a.id = $1 AND c."userId" = $2`,
      [id, userId]
    );

    return result.rows.length > 0 ? result.rows[0] : null;
  }

  async resolveAlert(id: string, userId: string, resolution: ResolutionMetadata = {}): Promise<Alert | null> {
    // Verify user owns the alert
    const alert = await this.getAlert(id, userId);
    if (!alert) {
      return null;
    }

    if (alert.status === 'resolved') {
      return alert;
    }

    const resolvedAt = new Date().toISOString();
    const source: ResolutionSource = resolution.source || 'manual';
    const reason = resolution.reason?.trim() || (
      source === 'manual'
        ? 'Resolved manually from dashboard.'
        : 'Automatically resolved after a subsequent successful run.'
    );
    const resolutionDetails: Record<string, unknown> = {
      resolved: true,
      resolvedAt,
      resolution: {
        source,
        reason,
        ...(resolution.resolvedByUserId ? { resolvedByUserId: resolution.resolvedByUserId } : {}),
        ...(resolution.sourceRunId ? { sourceRunId: resolution.sourceRunId } : {}),
      },
      ...(source === 'auto_success' ? { autoResolvedAt: resolvedAt } : {}),
    };

    // Update alert with resolution details
    const result = await query(
      `UPDATE alerts 
       SET status = 'resolved',
           "resolvedAt" = NOW(),
           details = details || $1,
           "updatedAt" = NOW()
       WHERE id = $2
         AND status = 'open'
       RETURNING *`,
      [JSON.stringify(resolutionDetails), id]
    );

    return result.rows.length > 0 ? result.rows[0] : alert;
  }

  async getAlertStats(userId: string): Promise<any> {
    const result = await query(
      `SELECT 
         COUNT(*) as "totalAlerts",
         COUNT(CASE WHEN a.type = 'failure' THEN 1 END) as "failureAlerts",
         COUNT(CASE WHEN a.status = 'resolved' THEN 1 END) as "resolvedAlerts",
         COUNT(CASE WHEN a.status = 'open' THEN 1 END) as "openAlerts",
         COUNT(CASE WHEN a."createdAt" > NOW() - INTERVAL '24 hours' THEN 1 END) as "recentAlerts",
         COUNT(CASE WHEN a."createdAt" > NOW() - INTERVAL '7 days' THEN 1 END) as "weeklyAlerts"
       FROM alerts a
       JOIN jobs j ON a."jobId" = j.id
       JOIN connections c ON j."connectionId" = c.id
       WHERE c."userId" = $1`,
      [userId]
    );

    return result.rows[0];
  }

  async createAlert(data: {
    jobId: string;
    type: AlertType;
    sourceRunId?: string;
    details: any;
  }): Promise<Alert> {
    const existing = await this.getAlertBySourceRun(data.jobId, data.type, data.sourceRunId);
    if (existing) {
      return existing;
    }

    const result = await query(
      `INSERT INTO alerts ("jobId", type, "sourceRunId", status, details)
       VALUES ($1, $2, $3, 'open', $4)
       RETURNING *`,
      [data.jobId, data.type, data.sourceRunId || null, JSON.stringify(data.details)]
    );

    return result.rows[0];
  }

  async getJobAlerts(jobId: string, type?: AlertType): Promise<Alert[]> {
    let queryStr = 'SELECT * FROM alerts WHERE "jobId" = $1';
    const params: any[] = [jobId];

    if (type) {
      queryStr += ' AND type = $2';
      params.push(type);
    }

    queryStr += ' ORDER BY "createdAt" DESC';

    const result = await query(queryStr, params);
    return result.rows;
  }

  async hasRecentAlert(jobId: string, type: AlertType, withinMinutes: number = 60): Promise<boolean> {
    const result = await query(
      `SELECT COUNT(*) as count
       FROM alerts 
       WHERE "jobId" = $1 
         AND type = $2 
         AND "createdAt" > NOW() - INTERVAL '${withinMinutes} minutes'`,
      [jobId, type]
    );

    return parseInt(result.rows[0].count) > 0;
  }

  async getAlertBySourceRun(jobId: string, type: AlertType, sourceRunId?: string): Promise<Alert | null> {
    if (!sourceRunId) {
      return null;
    }

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
}
