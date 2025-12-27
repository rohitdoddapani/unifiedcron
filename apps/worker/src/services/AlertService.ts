import { query } from '@unifiedcron/database';
import { Alert, AlertType } from '@unifiedcron/shared';

export class AlertService {
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

