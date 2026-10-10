const { test } = require('node:test');
const assert = require('node:assert/strict');
const http = require('node:http');
const { createHmac } = require('node:crypto');
const { once } = require('node:events');
const { isPublicWebhookAddress, resolveWebhookTarget, sendWebhook, WEBHOOK_BODY_LIMIT } = require('../packages/shared/dist');

async function receiver(t, handler) {
  const server = http.createServer(handler);
  server.listen(0, '127.0.0.1'); await once(server, 'listening');
  t.after(() => { server.closeAllConnections(); server.close(); });
  return `http://127.0.0.1:${server.address().port}`;
}

test('reserved IPv4/IPv6 addresses and URL credentials cannot be used by default', async () => {
  for (const ip of ['127.0.0.1', '10.1.2.3', '169.254.169.254', '100.64.0.1', '192.168.1.1', '::1', '::ffff:127.0.0.1', 'fc00::1', 'fe80::1', '2001:db8::1', '2002:7f00:1::']) assert.equal(isPublicWebhookAddress(ip), false, ip);
  for (const ip of ['8.8.8.8', '1.1.1.1', '2606:4700:4700::1111']) assert.equal(isPublicWebhookAddress(ip), true, ip);
  for (const url of ['http://127.0.0.1/', 'http://[::1]/', 'file:///etc/passwd', 'https://user:pass@example.com', 'https://example.com/#fragment']) await assert.rejects(resolveWebhookTarget(url, false));
});

test('receiver can verify timestamp/body HMAC and stable delivery identity', async t => {
  const secret = 'a-test-signing-secret';
  let received;
  const url = await receiver(t, async (req, res) => {
    let body = ''; for await (const chunk of req) body += chunk;
    received = { body, headers: req.headers }; res.end('accepted');
  });
  const result = await sendWebhook({ url, secret, payload: { event: 'alert.failure', name: 'Unicode: café' }, event: 'alert.failure', deliveryId: 'stable-id', allowPrivate: true });
  assert.equal(result.status, 200);
  assert.equal(received.headers['x-unifiedcron-delivery-id'], 'stable-id');
  assert.equal(received.headers['x-unifiedcron-event'], 'alert.failure');
  assert.equal(received.headers['x-unifiedcron-signature'], createHmac('sha256', secret).update(`${received.headers['x-unifiedcron-timestamp']}.${received.body}`).digest('hex'));
});

test('DNS hostnames use the validated address with Node automatic family selection disabled', async t => {
  const server = http.createServer((_req, res) => res.end('DNS pin accepted'));
  server.listen(0); await once(server, 'listening');
  t.after(() => { server.closeAllConnections(); server.close(); });
  const result = await sendWebhook({ url: `http://localhost:${server.address().port}`, secret: 'test',
    payload: {}, event: 'test', deliveryId: 'dns-test', allowPrivate: true });
  assert.equal(result.status, 200);
});

test('redirects are not followed, response storage is bounded, and hung requests time out', async t => {
  let redirected = 0;
  const url = await receiver(t, (req, res) => {
    if (req.url === '/redirect') { res.writeHead(302, { Location: '/target' }); res.end(); }
    else if (req.url === '/target') { redirected++; res.end(); }
    else if (req.url === '/large') res.end('x'.repeat(20_000));
    // /hang deliberately never responds.
  });
  const input = { secret: 'test', payload: {}, event: 'test', deliveryId: 'test', allowPrivate: true };
  assert.equal((await sendWebhook({ ...input, url: `${url}/redirect` })).status, 302);
  assert.equal(redirected, 0);
  assert.equal((await sendWebhook({ ...input, url: `${url}/large` })).body.length, WEBHOOK_BODY_LIMIT);
  await assert.rejects(sendWebhook({ ...input, url: `${url}/hang`, timeoutMs: 100 }), /timeout/);
});
