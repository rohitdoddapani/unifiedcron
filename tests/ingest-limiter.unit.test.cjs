// Env must be set before the API dist modules are loaded: the shared ingest limiters read
// their caps at import time. node:test runs each test file in its own process.
process.env.PUSH_RATE_LIMIT_PER_CONNECTION = '5';
// A small table keeps the end-to-end exhaustion test to a few hundred real requests.
process.env.PUSH_RATE_LIMIT_MAX_KEYS = '300';

const { test } = require('node:test');
const assert = require('node:assert/strict');
const { once } = require('node:events');
const express = require('../apps/api/node_modules/express');
const {
  FixedWindowRateLimiter,
  clientAddressKey,
  normalizeClientAddress,
  pushAddressLimiter,
  pushConnectionLimiter,
  PUSH_CONNECTION_LIMIT,
  PUSH_IP_LIMIT,
  PUSH_MAX_KEYS,
  DEFAULT_MAX_KEYS,
} = require('../apps/api/dist/lib/rateLimit');
const { parseTrustProxy, describeTrustProxy, TrustProxyConfigError } = require('../apps/api/dist/lib/trustProxy');
const { ingestRouter } = require('../apps/api/dist/routes/ingest');

const UUID_A = '00000000-0000-0000-0000-00000000000a';
const UUID_B = '00000000-0000-0000-0000-00000000000b';
const UUID_C = '00000000-0000-0000-0000-00000000000c';

async function serve(t, build) {
  const app = express();
  build(app);
  const server = app.listen(0, '127.0.0.1');
  await once(server, 'listening');
  t.after(() => { server.closeAllConnections(); server.close(); });
  return `http://127.0.0.1:${server.address().port}`;
}

// Asks the app for the limiter key it would use, so keying is observed through real Express
// trust-proxy resolution rather than a reimplementation of it.
async function keyFor(base, forwardedFor) {
  const response = await fetch(`${base}/key`, forwardedFor === undefined ? undefined : {
    headers: { 'x-forwarded-for': forwardedFor },
  });
  return (await response.json()).key;
}

test('TRUST_PROXY rejects blanket trust and accepts only topology-specific settings', () => {
  for (const value of [undefined, '', '  ', 'false', 'off', 'no', 'none', '0']) {
    assert.equal(parseTrustProxy(value), false, JSON.stringify(value));
  }
  assert.equal(parseTrustProxy('1'), 1);
  assert.equal(parseTrustProxy(' 2 '), 2);
  assert.deepEqual(parseTrustProxy('172.18.0.0/16'), ['172.18.0.0/16']);
  assert.deepEqual(parseTrustProxy('loopback, 10.0.0.5, 2001:db8::/32'), ['loopback', '10.0.0.5', '2001:db8::/32']);

  // Blanket trust would let any client choose the address the limiter keys on.
  for (const value of ['true', 'TRUE', 'all', '*']) {
    assert.throws(() => parseTrustProxy(value), TrustProxyConfigError, value);
  }
  for (const value of ['11', 'yes-please', '10.0.0.0/64', 'not-an-address', '1.2.3']) {
    assert.throws(() => parseTrustProxy(value), TrustProxyConfigError, value);
  }
  assert.match(describeTrustProxy(false), /forwarded headers ignored/);
  assert.match(describeTrustProxy(1), /1 trusted hop/);
});

test('with TRUST_PROXY unset a forged X-Forwarded-For cannot change or multiply the limiter key', async (t) => {
  const base = await serve(t, (app) => {
    app.set('trust proxy', parseTrustProxy(undefined));
    app.get('/key', (req, res) => res.json({ key: clientAddressKey(req) }));
  });

  const direct = await keyFor(base);
  assert.equal(direct, 'ip:127.0.0.1');
  // Every forged value resolves to the same socket-derived key, so spoofing buys no fresh bucket.
  for (const forged of ['9.9.9.9', '1.2.3.4, 5.6.7.8', '2001:db8::1']) {
    assert.equal(await keyFor(base, forged), direct, forged);
  }
});

test('behind one trusted hop the client cannot select an earlier forwarded entry', async (t) => {
  const base = await serve(t, (app) => {
    // The documented production topology: exactly one reverse proxy in front of the API.
    app.set('trust proxy', parseTrustProxy('1'));
    app.get('/key', (req, res) => res.json({ key: clientAddressKey(req) }));
  });

  // The proxy appends the address it observed, so only the last entry is honoured.
  assert.equal(await keyFor(base, '9.9.9.9, 203.0.113.7'), 'ip:203.0.113.7');
  assert.equal(await keyFor(base, '1.1.1.1, 2.2.2.2, 203.0.113.7'), 'ip:203.0.113.7');
  // Changing the forged prefix does not move the real client to a different counter.
  assert.equal(await keyFor(base, '8.8.8.8, 203.0.113.7'), 'ip:203.0.113.7');
});

test('IPv6 clients are grouped by /64 so one host cannot mint unlimited keys', () => {
  assert.equal(normalizeClientAddress('2001:db8:1:2:3:4:5:6'), '2001:db8:1:2::/64');
  assert.equal(normalizeClientAddress('2001:db8:1:2::dead:beef'), '2001:db8:1:2::/64');
  assert.equal(normalizeClientAddress('2001:DB8:1:2:FFFF::1'), '2001:db8:1:2::/64');
  assert.equal(normalizeClientAddress('2001:db8:1:2::1%eth0'), '2001:db8:1:2::/64');
  // A different /64 is still a different key.
  assert.notEqual(normalizeClientAddress('2001:db8:1:3::1'), '2001:db8:1:2::/64');
  // IPv4, including IPv4-mapped form, keeps full address precision.
  assert.equal(normalizeClientAddress('203.0.113.7'), '203.0.113.7');
  assert.equal(normalizeClientAddress('::ffff:203.0.113.7'), '203.0.113.7');
  assert.equal(normalizeClientAddress(''), 'unknown');

  const limiter = new FixedWindowRateLimiter({ limit: 2 });
  const rotation = ['2001:db8:1:2::1', '2001:db8:1:2::2', '2001:db8:1:2::3'].map((address) =>
    clientAddressKey({ ip: address }));
  assert.equal(limiter.exceeded(rotation[0]), false);
  assert.equal(limiter.exceeded(rotation[1]), false);
  assert.equal(limiter.exceeded(rotation[2]), true, 'address rotation within one /64 shares a counter');
});

test('a full key table evicts its oldest window instead of rejecting unseen keys', () => {
  const limiter = new FixedWindowRateLimiter({ limit: 10, maxKeys: 100 });
  for (let i = 0; i < 100_000; i += 1) {
    assert.equal(limiter.exceeded(`flood:${i}`), false, `flood key ${i} was rejected`);
  }
  assert.ok(limiter.size <= 100, `table stayed bounded (size ${limiter.size})`);
  assert.ok(limiter.evictedKeys > 0, 'eviction happened rather than rejection');
  assert.equal(limiter.exceeded('legitimate-new-key'), false);
});

test('a key table exhausted through the route does not 429 a previously-unseen connection', async (t) => {
  const base = await serve(t, (app) => {
    app.set('trust proxy', parseTrustProxy(undefined));
    // No express.raw here: a request that clears the limiter reaches the body check and gets
    // 415, which proves admission without needing a database or a valid signature.
    app.use('/api/ingest', ingestRouter);
  });

  assert.ok(DEFAULT_MAX_KEYS > 5000, 'default key table is larger than the old 5000-entry bound');
  // Fill the route's own connection table past its bound using real requests, inside one window.
  for (let i = 0; i < PUSH_MAX_KEYS + 100; i += 1) {
    const id = `00000000-0000-0000-0000-${String(i).padStart(12, '0')}`;
    const status = (await fetch(`${base}/api/ingest/supabase/${id}`, { method: 'POST' })).status;
    assert.equal(status, 415, `flood request ${i} was rate limited`);
  }
  assert.ok(pushConnectionLimiter.size <= PUSH_MAX_KEYS, `table stayed bounded (${pushConnectionLimiter.size})`);
  assert.ok(pushConnectionLimiter.evictedKeys > 0, 'the full table evicted rather than rejected');

  // Also exhaust the address table directly, since one test client has only one address.
  for (let i = 0; i < PUSH_MAX_KEYS + 100; i += 1) {
    assert.equal(pushAddressLimiter.exceeded(`ip:198.51.100.${i}`), false, `address key ${i} was rejected`);
  }
  assert.ok(pushAddressLimiter.size <= PUSH_MAX_KEYS);

  const response = await fetch(`${base}/api/ingest/supabase/${UUID_C}`, { method: 'POST' });
  assert.notEqual(response.status, 429, 'exhausted tables must not reject a new connection');
  assert.equal(response.status, 415);
});

test('genuine abuse of one connection still trips the limit without touching another', async (t) => {
  const base = await serve(t, (app) => {
    app.set('trust proxy', parseTrustProxy(undefined));
    app.use('/api/ingest', ingestRouter);
  });

  assert.equal(PUSH_CONNECTION_LIMIT, 5, 'PUSH_RATE_LIMIT_PER_CONNECTION is configurable');
  assert.equal(PUSH_IP_LIMIT, 3000, 'per-address cap keeps its default when unset');

  const statuses = [];
  for (let i = 0; i < PUSH_CONNECTION_LIMIT + 2; i += 1) {
    statuses.push((await fetch(`${base}/api/ingest/supabase/${UUID_A}`, { method: 'POST' })).status);
  }
  assert.deepEqual(statuses.slice(0, PUSH_CONNECTION_LIMIT), Array(PUSH_CONNECTION_LIMIT).fill(415));
  assert.deepEqual(statuses.slice(PUSH_CONNECTION_LIMIT), [429, 429], 'abuse past the cap is rejected');

  // Case variants of the same id share one counter rather than resetting it.
  assert.equal((await fetch(`${base}/api/ingest/supabase/${UUID_A.toUpperCase()}`, { method: 'POST' })).status, 429);
  // A different connection is unaffected by the abused one.
  assert.equal((await fetch(`${base}/api/ingest/supabase/${UUID_B}`, { method: 'POST' })).status, 415);
});

test('counters reset when the window rolls over', () => {
  const limiter = new FixedWindowRateLimiter({ limit: 2, windowMs: 60_000 });
  const start = 1_000_000;
  assert.equal(limiter.exceeded('k', start), false);
  assert.equal(limiter.exceeded('k', start + 1), false);
  assert.equal(limiter.exceeded('k', start + 2), true);
  assert.equal(limiter.remaining('k', start + 2), 0);
  assert.equal(limiter.exceeded('k', start + 60_001), false, 'new window admits the key again');
  assert.equal(limiter.remaining('k', start + 60_001), 1);
});

test('address churn cannot starve the connection dimension', () => {
  const addresses = new FixedWindowRateLimiter({ limit: 10, maxKeys: 50 });
  const connections = new FixedWindowRateLimiter({ limit: 10, maxKeys: 50 });
  assert.equal(connections.exceeded('connection:real'), false);
  for (let i = 0; i < 5000; i += 1) {
    addresses.exceeded(`ip:198.51.100.${i}`);
  }
  // The connection table is untouched by address pressure, so its counter still holds.
  assert.equal(connections.size, 1);
  assert.equal(connections.remaining('connection:real'), 9);
});
