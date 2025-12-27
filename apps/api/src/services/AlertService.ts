import { query } from '@unifiedcron/database';
import { Alert, AlertType } from '@unifiedcron/shared';

export class AlertService {
  async getAlerts(
    userId: string,
    options: { type?: string; limit?: number; offset?: number } = {}
  ): Promise<Alert[]> {
    const { type, limit = 50, offset = 0 } = options;

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

  async resolveAlert(id: string, userId: string): Promise<Alert | null> {
    // Verify user owns the alert
    const alert = await this.getAlert(id, userId);
    if (!alert) {
      return null;
    }

    // Update alert with resolution details
    const result = await query(
      `UPDATE alerts 
       SET details = details || $1, "updatedAt" = NOW()
       WHERE id = $2
       RETURNING *`,
      [JSON.stringify({ resolved: true, resolvedAt: new Date().toISOString() }), id]
    );

    return result.rows.length > 0 ? result.rows[0] : null;
  }

  async getAlertStats(userId: string): Promise<any> {
    const result = await query(
      `SELECT 
         COUNT(*) as "totalAlerts",
         COUNT(CASE WHEN a.type = 'failure' THEN 1 END) as "failureAlerts",
         COUNT(CASE WHEN a.details->>'resolved' = 'true' THEN 1 END) as "resolvedAlerts",
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
    details: any;
  }): Promise<Alert> {
    const result = await query(
      `INSERT INTO alerts ("jobId", type, details)
       VALUES ($1, $2, $3)
       RETURNING *`,
      [data.jobId, data.type, JSON.stringify(data.details)]
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
}
