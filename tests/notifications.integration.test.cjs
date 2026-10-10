const { test, before, after } = require('node:test');
const assert = require('node:assert/strict');
const http = require('node:http');
const { once } = require('node:events');
const { randomUUID, createHmac } = require('node:crypto');
assert.ok(process.env.TEST_DATABASE_URL, 'TEST_DATABASE_URL is required; never use production');
assert.ok(new URL(process.env.TEST_DATABASE_URL).pathname.endsWith('_test'), 'Database name must end in _test');
process.env.DATABASE_URL = process.env.TEST_DATABASE_URL;
process.env.NODE_ENV = 'production';
process.env.ENCRYPTION_KEY = 'integration-encryption-key';
process.env.JWT_SECRET = 'integration-jwt-secret';
process.env.WEBHOOK_ALLOW_PRIVATE_NETWORK = 'true';
const { query, closePool, migrate } = require('../packages/database/dist');
const { decrypt } = require('../packages/shared/dist');
const { NotificationService: ApiService } = require('../apps/api/dist/services/NotificationService');
const { NotificationService: WorkerService } = require('../apps/worker/dist/services/NotificationService');
const { AlertService } = require('../apps/worker/dist/services/AlertService');
const express = require('../apps/api/node_modules/express');
const jwt = require('../apps/api/node_modules/jsonwebtoken');
const { notificationsRouter } = require('../apps/api/dist/routes/notifications');
const { authenticate } = require('../apps/api/dist/middleware/auth');
const { errorHandler } = require('../apps/api/dist/middleware/errorHandler');
const apiService = new ApiService();
const worker = new WorkerService();
let receiver, apiServer, receiverUrl, apiUrl, userA, userB, jobId;
const received = [];
const secret = 'integration-signing-secret';
let mode = 'success';

async function request(path, user = userA, method = 'GET', body) {
  const response = await fetch(`${apiUrl}${path}`, { method,
    headers: { 'Content-Type': 'application/json', ...(user ? { Authorization: `Bearer ${jwt.sign({ userId: user }, process.env.JWT_SECRET)}` } : {}) },
    ...(body !== undefined ? { body: JSON.stringify(body) } : {}) });
  return { status: response.status, body: await response.json() };
}
async function delivery(id) { return (await query('SELECT * FROM notification_deliveries WHERE id = $1', [id])).rows[0]; }
async function due(id) { await query('UPDATE notification_deliveries SET "nextRetryAt" = NOW() - INTERVAL \'1 second\' WHERE id = $1', [id]); }

before(async () => {
  await migrate(); await migrate();
  const users = await query('INSERT INTO users (email) VALUES ($1),($2) RETURNING id', [`${randomUUID()}@example.com`, `${randomUUID()}@example.com`]);
  [userA, userB] = users.rows.map(row => row.id);
  const conn = await query('INSERT INTO connections ("userId", platform, label, config) VALUES ($1,\'supabase\',\'Integration test\',\'{}\') RETURNING id', [userA]);
  jobId = (await query('INSERT INTO jobs ("connectionId", "originId", name, cron, platform, project) VALUES ($1,\'test\',\'Test job\',\'* * * * *\',\'supabase\',\'test\') RETURNING id', [conn.rows[0].id])).rows[0].id;
  receiver = http.createServer(async (req, res) => {
    let body = ''; for await (const chunk of req) body += chunk;
    received.push({ body, headers: req.headers });
    // A short wait makes concurrent dispatch overlap.
    await new Promise(resolve => setTimeout(resolve, 30));
    res.statusCode = mode === 'failure' ? 503 : 200; res.end(mode === 'failure' ? 'unavailable' : 'accepted');
  });
  receiver.listen(0, '127.0.0.1'); await once(receiver, 'listening');
  receiverUrl = `http://127.0.0.1:${receiver.address().port}`;
  const app = express(); app.use(express.json()); app.use('/api/notifications', authenticate, notificationsRouter); app.use(errorHandler);
  apiServer = app.listen(0, '127.0.0.1'); await once(apiServer, 'listening');
  apiUrl = `http://127.0.0.1:${apiServer.address().port}`;
});

after(async () => {
  if (userA) await query('DELETE FROM users WHERE id IN ($1,$2)', [userA, userB]);
  receiver?.closeAllConnections(); receiver?.close(); apiServer?.closeAllConnections(); apiServer?.close(); await closePool();
});

test('webhook validation, secret storage, ownership, CRUD and signed durable test delivery', async () => {
  assert.equal((await request('/api/notifications/webhooks', null)).status, 401);
  for (const body of [{ name: '', url: receiverUrl }, { name: 'test', url: 'file:///tmp/test' }, { name: 'test', url: receiverUrl, active: 'yes' }, { name: 'test', url: receiverUrl, secret: 'short' }]) {
    assert.equal((await request('/api/notifications/webhooks', userA, 'POST', body)).status, 400);
  }
  process.env.WEBHOOK_ALLOW_PRIVATE_NETWORK = 'false';
  assert.equal((await request('/api/notifications/webhooks', userA, 'POST', { name: 'private', url: receiverUrl })).status, 400);
  process.env.WEBHOOK_ALLOW_PRIVATE_NETWORK = 'true';
  const created = await request('/api/notifications/webhooks', userA, 'POST', { name: 'Receiver', url: receiverUrl, secret });
  assert.equal(created.status, 201); assert.equal(created.body.data.secret, secret);
  const endpointId = created.body.data.id;
  const raw = (await query('SELECT secret, "secretEncrypted" FROM notification_endpoints WHERE id = $1', [endpointId])).rows[0];
  assert.equal(raw.secretEncrypted, true); assert.notEqual(raw.secret, secret);
  assert.equal(await decrypt(raw.secret, process.env.ENCRYPTION_KEY), secret);
  assert.equal((await request('/api/notifications/webhooks')).body.data[0].secret, undefined);
  for (const method of ['PATCH', 'DELETE']) assert.equal((await request(`/api/notifications/webhooks/${endpointId}`, userB, method, method === 'PATCH' ? { active: false } : undefined)).status, 404);
  assert.equal((await request(`/api/notifications/webhooks/${endpointId}/test`, userB, 'POST')).status, 404);
  assert.equal((await request('/api/notifications/deliveries?status=invalid')).status, 400);
  assert.equal((await request('/api/notifications/webhooks/not-a-uuid', userA, 'DELETE')).status, 400);
  await request(`/api/notifications/webhooks/${endpointId}`, userA, 'PATCH', { active: false });
  assert.equal((await request(`/api/notifications/webhooks/${endpointId}/test`, userA, 'POST')).status, 404);
  await request(`/api/notifications/webhooks/${endpointId}`, userA, 'PATCH', { active: true, name: 'Updated' });
  const queued = await request(`/api/notifications/webhooks/${endpointId}/test`, userA, 'POST');
  assert.equal(queued.status, 202);
  const before = received.length;
  await Promise.all([worker.processPendingDeliveries(), new WorkerService().processPendingDeliveries()]);
  assert.equal(received.length - before, 1, 'Concurrent workers must send only one attempt');
  const done = await delivery(queued.body.data.id); assert.equal(done.status, 'succeeded'); assert.equal(done.attempt, 1);
  const message = received.at(-1);
  assert.equal(message.headers['x-unifiedcron-signature'], createHmac('sha256', secret).update(`${message.headers['x-unifiedcron-timestamp']}.${message.body}`).digest('hex'));
  assert.equal(message.headers['x-unifiedcron-delivery-id'], done.id);
  const detail = await request(`/api/notifications/deliveries/${done.id}`);
  assert.equal(detail.body.data.attempts[0].status, 'succeeded'); assert.equal(detail.body.data.claimToken, undefined);
  assert.equal((await request(`/api/notifications/deliveries/${done.id}`, userB)).status, 404);
  assert.equal((await request('/api/notifications/deliveries', userB)).body.data.length, 0);
  assert.equal((await request('/api/notifications/metrics')).body.data.succeeded, 1);
  assert.equal((await request(`/api/notifications/webhooks/${endpointId}`, userA, 'DELETE')).status, 200);
});

test('five persisted backoff delays, six attempts, terminal state and eventual recovery', async () => {
  const endpoint = await apiService.createWebhook(userA, { name: 'Retry receiver', url: receiverUrl, secret });
  const queued = await apiService.testWebhook(endpoint.id, userA);
  mode = 'failure';
  for (let attempt = 1; attempt <= 6; attempt++) {
    await worker.processPendingDeliveries();
    const row = await delivery(queued.id);
    assert.equal(row.attempt, attempt);
    if (attempt <= 5) {
      assert.equal(row.status, 'retrying');
      const delta = row.nextRetryAt.getTime() - Date.now();
      assert.ok(Math.abs(delta - [1, 5, 15, 30, 60][attempt - 1] * 60_000) < 5000);
      await worker.processPendingDeliveries(); assert.equal((await delivery(queued.id)).attempt, attempt, 'No retry before due time');
      await due(queued.id);
    } else { assert.equal(row.status, 'failed'); assert.equal(row.nextRetryAt, null); }
  }
  const details = await apiService.getDelivery(queued.id, userA);
  assert.equal(details.attempts.length, 6); assert.ok(details.attempts.every(item => item.status === 'failed' && item.responseStatus === 503));
  mode = 'success'; await worker.processPendingDeliveries(); assert.equal((await delivery(queued.id)).attempt, 6);
  const recover = await apiService.testWebhook(endpoint.id, userA);
  mode = 'failure'; await worker.processPendingDeliveries();
  mode = 'success'; await due(recover.id); await worker.processPendingDeliveries();
  assert.equal((await delivery(recover.id)).status, 'succeeded'); assert.equal((await delivery(recover.id)).attempt, 2);
  await apiService.deleteWebhook(endpoint.id, userA);
});

test('lease recovery preserves attempt history and alert outbox repairs a crash without duplicates', async () => {
  const endpoint = await apiService.createWebhook(userA, { name: 'Outbox receiver', url: receiverUrl, secret });
  const alertService = new AlertService();
  const data = { jobId, type: 'failure', sourceRunId: `integration:${randomUUID()}`, details: { message: 'Simulated failed run' } };
  const alerts = await Promise.all([alertService.createAlert(data), alertService.createAlert(data)]);
  assert.equal(alerts.filter(item => item.created).length, 1);
  await worker.reconcileAlerts(); await worker.reconcileAlerts();
  const rows = (await query('SELECT * FROM notification_deliveries WHERE "alertId" = $1', [alerts[0].alert.id])).rows;
  assert.equal(rows.length, 1);
  const id = rows[0].id;
  await query(`UPDATE notification_deliveries SET attempt = 1, "claimToken" = gen_random_uuid(), "lockedUntil" = NOW() - INTERVAL '1 second' WHERE id = $1`, [id]);
  await query('INSERT INTO notification_delivery_attempts ("deliveryId",attempt,status) VALUES ($1,1,\'processing\')', [id]);
  await worker.processPendingDeliveries();
  assert.equal((await delivery(id)).status, 'retrying'); assert.equal((await delivery(id)).attempt, 1);
  await due(id); await worker.processPendingDeliveries();
  assert.equal((await delivery(id)).status, 'succeeded');
  const detail = await apiService.getDelivery(id, userA);
  assert.equal(detail.attempts[0].status, 'failed'); assert.match(detail.attempts[0].errorMessage, /lease expired/);
  assert.equal(detail.attempts[1].status, 'succeeded');
  const finalLease = await apiService.testWebhook(endpoint.id, userA);
  await query(`UPDATE notification_deliveries SET attempt = 6, "claimToken" = gen_random_uuid(), "lockedUntil" = NOW() - INTERVAL '1 second' WHERE id = $1`, [finalLease.id]);
  await query('INSERT INTO notification_delivery_attempts ("deliveryId",attempt,status) VALUES ($1,6,\'processing\')', [finalLease.id]);
  await worker.processPendingDeliveries(); assert.equal((await delivery(finalLease.id)).status, 'failed');
  await apiService.deleteWebhook(endpoint.id, userA);
});

test('legacy plaintext webhook secrets upgrade safely and generated secrets are exposed once', async () => {
  const raw = await query('INSERT INTO notification_endpoints ("userId",name,url,secret) VALUES ($1,\'Legacy\',$2,$3) RETURNING id', [userA, receiverUrl, secret]);
  await apiService.encryptLegacySecrets(); await apiService.encryptLegacySecrets();
  const stored = (await query('SELECT * FROM notification_endpoints WHERE id = $1', [raw.rows[0].id])).rows[0];
  assert.equal(stored.secretEncrypted, true); assert.equal(await decrypt(stored.secret, process.env.ENCRYPTION_KEY), secret);
  const generated = await apiService.createWebhook(userA, { name: 'Generated', url: receiverUrl });
  assert.equal(generated.secret.length, 64);
  assert.ok((await apiService.listWebhooks(userA)).every(endpoint => !('secret' in endpoint)));
});
