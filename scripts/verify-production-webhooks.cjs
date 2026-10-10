// Mutating release check: sends only to an owner-controlled temporary receiver and cleans its user/data.
const assert = require('node:assert/strict');
const { randomUUID } = require('node:crypto');
const { query, closePool } = require('/app/packages/database/dist');
const { NotificationService } = require('/app/apps/api/dist/services/NotificationService');
const { ConnectionService } = require('/app/apps/api/dist/services/ConnectionService');
const service = new NotificationService();
const receiver = process.env.VERIFICATION_RECEIVER;
const secret = process.env.VERIFICATION_SECRET;
assert.ok(receiver && secret, 'Temporary receiver settings are required');
let userId;
async function waitFor(check, seconds = 150) {
  const deadline = Date.now() + seconds * 1000;
  while (Date.now() < deadline) { const result = await check(); if (result) return result; await new Promise(resolve => setTimeout(resolve, 2000)); }
  throw new Error('Production webhook verification timed out');
}
async function main() {
  userId = (await query('INSERT INTO users(email,name) VALUES ($1,\'Temporary M3 verification\') RETURNING id', [`m3-${randomUUID()}@example.com`])).rows[0].id;
  const endpoints = {};
  for (const mode of ['success', 'retry', 'fail']) endpoints[mode] = await service.createWebhook(userId, { name: `Temporary ${mode}`, url: `${receiver}/${mode}`, secret });
  const connection = await new ConnectionService().createConnection({ userId, platform: 'supabase', label: 'Temporary M3 verification', config: {} });
  const job = (await query(`INSERT INTO jobs ("connectionId","originId",name,cron,platform,project)
    VALUES ($1,'m3-verification','Temporary failure','* * * * *','supabase','verification') RETURNING id`, [connection.id])).rows[0];
  const alert = (await query(`INSERT INTO alerts ("jobId",type,"sourceRunId",details)
    VALUES ($1,'failure',$2,'{"jobRun":{"status":"failed","message":"Temporary verification failure"}}') RETURNING id`, [job.id, `verification:${randomUUID()}`])).rows[0];
  const rows = await waitFor(async () => {
    const result = await query('SELECT * FROM notification_deliveries WHERE "alertId" = $1', [alert.id]);
    return result.rows.length === 3 && result.rows.every(row => row.attempt >= 1 && !row.claimToken) ? result.rows : null;
  });
  const success = rows.find(row => row.endpointId === endpoints.success.id);
  const retry = rows.find(row => row.endpointId === endpoints.retry.id);
  const failure = rows.find(row => row.endpointId === endpoints.fail.id);
  assert.equal(success.status, 'succeeded'); assert.equal(success.attempt, 1);
  assert.equal(retry.status, 'retrying'); assert.equal(retry.attempt, 1);
  assert.ok(retry.nextRetryAt.getTime() > Date.now(), 'Retry must be scheduled in the future');
  console.log('PASS live-signed-alert-outbox; waiting for natural one-minute retry');
  for (let attempt = 2; attempt <= 6; attempt++) {
    // Accelerate only this temporary user's terminal-failure example; real deliveries are untouched.
    await query('UPDATE notification_deliveries SET "nextRetryAt" = NOW() WHERE id = $1 AND status = \'retrying\'', [failure.id]);
    await waitFor(async () => {
      const row = (await query('SELECT * FROM notification_deliveries WHERE id = $1', [failure.id])).rows[0];
      return row.attempt === attempt && !row.claimToken ? row : null;
    });
  }
  const failed = await service.getDelivery(failure.id, userId);
  assert.equal(failed.status, 'failed'); assert.equal(failed.attempts.length, 6);
  assert.ok(failed.attempts.every(attempt => attempt.responseStatus === 503 && attempt.status === 'failed'));
  const recovered = await waitFor(async () => {
    const row = await service.getDelivery(retry.id, userId);
    return row.status === 'succeeded' ? row : null;
  });
  assert.equal(recovered.attempt, 2); assert.equal(recovered.attempts.length, 2);
  const tested = await service.testWebhook(endpoints.success.id, userId);
  await waitFor(async () => (await service.getDelivery(tested.id, userId)).status === 'succeeded');
  const stats = await (await fetch(`${receiver}/stats`)).json();
  assert.equal(stats.invalid, 0); assert.ok(stats.valid >= 10);
  console.log('PRODUCTION_WEBHOOKS_OK: signed alert, natural retry recovery, terminal failure history, signed test event');
}
main().catch(error => { console.error(error.message); process.exitCode = 1; }).finally(async () => {
  if (userId) await query('DELETE FROM users WHERE id = $1', [userId]);
  await closePool();
});
