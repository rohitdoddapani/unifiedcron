import { randomBytes } from 'crypto';
import { getClient, query } from '@unifiedcron/database';
import { encrypt, resolveWebhookTarget } from '@unifiedcron/shared';
import { z } from '@unifiedcron/shared';

export const WebhookInput = z.object({
  name: z.string().trim().min(1).max(100), url: z.string().trim().url().max(2048),
  secret: z.string().min(16).max(255).optional(), active: z.boolean().optional(),
}).strict();
export const WebhookUpdate = WebhookInput.partial().refine(value => Object.keys(value).length > 0, 'No updates provided');

export class NotificationService {
  async listWebhooks(userId: string) {
    return (await query(`SELECT id, name, url, active, "createdAt", "updatedAt" FROM notification_endpoints
      WHERE "userId" = $1 ORDER BY "createdAt" DESC`, [userId])).rows;
  }

  async createWebhook(userId: string, input: z.infer<typeof WebhookInput>) {
    await this.validateTarget(input.url);
    const secret = input.secret || randomBytes(32).toString('hex');
    const encrypted = await encrypt(secret, this.encryptionKey());
    const result = await query(`INSERT INTO notification_endpoints
      ("userId", name, url, secret, "secretEncrypted", active) VALUES ($1,$2,$3,$4,true,$5)
      RETURNING id, name, url, active, "createdAt", "updatedAt"`,
    [userId, input.name, input.url, encrypted, input.active ?? true]);
    return { ...result.rows[0], secret }; // Only exposed on creation or explicit rotation.
  }

  async updateWebhook(id: string, userId: string, input: z.infer<typeof WebhookUpdate>) {
    if (!(await query('SELECT id FROM notification_endpoints WHERE id = $1 AND "userId" = $2', [id, userId])).rowCount) return null;
    if (input.url) await this.validateTarget(input.url);
    const encrypted = input.secret ? await encrypt(input.secret, this.encryptionKey()) : null;
    const result = await query(`UPDATE notification_endpoints SET name = COALESCE($3,name), url = COALESCE($4,url),
      active = COALESCE($5,active), secret = COALESCE($6,secret),
      "secretEncrypted" = CASE WHEN $6::text IS NOT NULL THEN true ELSE "secretEncrypted" END, "updatedAt" = NOW()
      WHERE id = $1 AND "userId" = $2 RETURNING id, name, url, active, "createdAt", "updatedAt"`,
    [id, userId, input.name ?? null, input.url ?? null, input.active ?? null, encrypted]);
    return result.rows[0] ? { ...result.rows[0], ...(input.secret ? { secret: input.secret } : {}) } : null;
  }

  async deleteWebhook(id: string, userId: string): Promise<boolean> {
    return !!(await query('DELETE FROM notification_endpoints WHERE id = $1 AND "userId" = $2', [id, userId])).rowCount;
  }

  async testWebhook(id: string, userId: string) {
    // Test events use the same durable queue, signing, timeouts and attempt history as alerts.
    const result = await query(`INSERT INTO notification_deliveries ("endpointId", event, payload, "nextRetryAt")
      SELECT id, 'webhook.test', jsonb_build_object('event','webhook.test','endpointId',id,
        'timestamp',NOW(),'message','UnifiedCron webhook test event'), NOW()
      FROM notification_endpoints WHERE id = $1 AND "userId" = $2 AND active = true RETURNING id, status`, [id, userId]);
    return result.rows[0] || null;
  }

  async listDeliveries(userId: string, options: { status?: string; endpointId?: string; limit: number; offset: number }) {
    const result = await query(`SELECT d.id, d."endpointId", ne.name AS "endpointName", d."alertId", d.event,
      d.status, d.attempt, d."nextRetryAt", d."responseStatus", d."errorMessage", d."deliveredAt", d."createdAt",
      d."lockedUntil" IS NOT NULL AS processing
      FROM notification_deliveries d JOIN notification_endpoints ne ON ne.id = d."endpointId"
      WHERE ne."userId" = $1 AND ($2::text IS NULL OR d.status = $2)
        AND ($3::uuid IS NULL OR d."endpointId" = $3) ORDER BY d."createdAt" DESC, d.id DESC LIMIT $4 OFFSET $5`,
    [userId, options.status ?? null, options.endpointId ?? null, options.limit, options.offset]);
    return result.rows;
  }

  async getDelivery(id: string, userId: string) {
    const result = await query(`SELECT d.*, ne.name AS "endpointName" FROM notification_deliveries d
      JOIN notification_endpoints ne ON ne.id = d."endpointId" WHERE d.id = $1 AND ne."userId" = $2`, [id, userId]);
    if (!result.rows[0]) return null;
    const { claimToken: _claimToken, ...delivery } = result.rows[0];
    const attempts = await query('SELECT * FROM notification_delivery_attempts WHERE "deliveryId" = $1 ORDER BY attempt', [id]);
    return { ...delivery, attempts: attempts.rows };
  }

  async getMetrics(userId: string) {
    const result = await query(`SELECT d.status, count(*)::int AS count FROM notification_deliveries d
      JOIN notification_endpoints ne ON d."endpointId" = ne.id WHERE ne."userId" = $1 GROUP BY d.status`, [userId]);
    return Object.fromEntries(result.rows.map((row: { status: string; count: number }) => [row.status, row.count]));
  }

  async encryptLegacySecrets(): Promise<void> {
    const client = await getClient();
    try {
      await client.query('BEGIN');
      const result = await client.query('SELECT id, secret FROM notification_endpoints WHERE "secretEncrypted" = false FOR UPDATE');
      for (const row of result.rows) {
        await client.query('UPDATE notification_endpoints SET secret = $2, "secretEncrypted" = true WHERE id = $1',
          [row.id, await encrypt(row.secret, this.encryptionKey())]);
      }
      await client.query('COMMIT');
    } catch (error) { await client.query('ROLLBACK'); throw error; }
    finally { client.release(); }
  }

  private encryptionKey(): string {
    if (!process.env.ENCRYPTION_KEY) throw new Error('ENCRYPTION_KEY is required');
    return process.env.ENCRYPTION_KEY;
  }

  private async validateTarget(url: string): Promise<void> {
    let timer: ReturnType<typeof setTimeout> | undefined;
    try {
      await Promise.race([resolveWebhookTarget(url), new Promise<never>((_, reject) => {
        timer = setTimeout(() => reject(new Error('DNS timeout')), 5000);
      })]);
    }
    catch {
      const error = new Error('Webhook URL must resolve to an allowed HTTP(S) destination; private networks are disabled by default');
      error.name = 'WebhookValidationError';
      throw error;
    }
    finally { clearTimeout(timer); }
  }
}
