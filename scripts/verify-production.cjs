// Run through stdin inside the API container after migrating and deploying.
const assert = require('node:assert/strict');
const jwt = require('jsonwebtoken');
const { query, closePool } = require('/app/packages/database/dist');
const { ConnectionService } = require('/app/apps/api/dist/services/ConnectionService');

async function main() {
  const api = 'http://localhost:3001';
  const origin = 'https://dashboard.unifiedcron.com';
  const health = await fetch(`${api}/health/database`);
  assert.equal(health.status, 200);
  for (const path of ['/api/connections', '/api/jobs', '/api/alerts', '/api/notifications/webhooks']) {
    assert.equal((await fetch(`${api}${path}`)).status, 401);
  }
  const preflight = await fetch(`${api}/api/alerts?status=open`, {
    method: 'OPTIONS',
    headers: { Origin: origin, 'Access-Control-Request-Method': 'GET', 'Access-Control-Request-Headers': 'authorization,content-type' },
  });
  assert.equal(preflight.status, 204);
  assert.equal(preflight.headers.get('access-control-allow-origin'), origin);
  const blocked = await fetch(`${api}/api/alerts`, { method: 'OPTIONS', headers: { Origin: 'https://untrusted.example', 'Access-Control-Request-Method': 'GET' } });
  assert.equal(blocked.headers.get('access-control-allow-origin'), null);
  const users = await query('SELECT id FROM users');
  const connections = new ConnectionService();
  let connectionCount = 0;
  for (const user of users.rows) {
    const token = jwt.sign({ userId: user.id }, process.env.JWT_SECRET, { expiresIn: '5m' });
    const headers = { Authorization: `Bearer ${token}` };
    for (const path of ['/api/connections', '/api/jobs', '/api/alerts?status=open', '/api/notifications/webhooks']) {
      const response = await fetch(`${api}${path}`, { headers });
      assert.equal(response.status, 200, path);
      assert.equal((await response.json()).success, true);
    }
    const owned = await connections.getConnections(user.id);
    for (const connection of owned) {
      assert.equal(connection.userId, user.id);
      assert.ok(Object.keys(connection.config).length, 'Connection config must still decrypt');
      connectionCount++;
      for (const other of users.rows.filter(row => row.id !== user.id)) {
        const otherToken = jwt.sign({ userId: other.id }, process.env.JWT_SECRET, { expiresIn: '5m' });
        const response = await fetch(`${api}/api/connections/${connection.id}`, { headers: { Authorization: `Bearer ${otherToken}` } });
        assert.equal(response.status, 404, 'Cross-user connection access must fail');
      }
    }
  }
  const worker = await fetch('http://unifiedcron-worker:3003/health');
  assert.equal(worker.status, 200);
  const migrations = await query('SELECT name FROM schema_migrations ORDER BY name');
  assert.ok(migrations.rows.some(row => row.name === '005_webhook_reliability.sql'));
  console.log(JSON.stringify({ result: 'PRODUCTION_VERIFY_OK', users: users.rows.length, connectionsDecrypted: connectionCount, migrations: migrations.rows.map(row => row.name) }));
}

main().catch(error => { console.error(error.message); process.exitCode = 1; }).finally(closePool);
