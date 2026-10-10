// Creates and removes a temporary account to check live registration and sign-in.
const assert = require('node:assert/strict');
const { randomBytes } = require('node:crypto');
const { query, closePool } = require('/app/packages/database/dist');
const email = `deployment-check-${randomBytes(8).toString('hex')}@example.com`;

async function main() {
  const web = 'https://dashboard.unifiedcron.com';
  const password = randomBytes(24).toString('hex');
  const registered = await fetch(`${web}/api/auth/register`, {
    method: 'POST', headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ email, password, name: 'Temporary deployment verification' }),
  });
  assert.equal(registered.status, 200, 'Dashboard registration proxy');
  const cookies = new Map();
  const remember = response => {
    for (const value of response.headers.getSetCookie()) {
      const pair = value.split(';')[0];
      const split = pair.indexOf('=');
      cookies.set(pair.slice(0, split), pair.slice(split + 1));
    }
  };
  const cookieHeader = () => [...cookies].map(([key, value]) => `${key}=${value}`).join('; ');
  const csrfResponse = await fetch(`${web}/api/auth/csrf`);
  remember(csrfResponse);
  const { csrfToken } = await csrfResponse.json();
  assert.ok(csrfToken);
  const signedIn = await fetch(`${web}/api/auth/callback/credentials`, {
    method: 'POST', redirect: 'manual',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded', Cookie: cookieHeader(), Origin: web, 'X-Auth-Return-Redirect': '1' },
    body: new URLSearchParams({ csrfToken, email, password, callbackUrl: web }),
  });
  remember(signedIn);
  assert.ok(signedIn.status === 200 || signedIn.status === 302, 'Credentials callback');
  const sessionResponse = await fetch(`${web}/api/auth/session`, { headers: { Cookie: cookieHeader() } });
  const session = await sessionResponse.json();
  assert.equal(session.user?.email, email, 'Signed-in session');
  assert.ok(session.accessToken, 'Session API access token');
  const owned = await fetch('https://api.unifiedcron.com/api/connections', { headers: { Authorization: `Bearer ${session.accessToken}`, Origin: web } });
  assert.equal(owned.status, 200);
  assert.deepEqual((await owned.json()).data, []);
  console.log('PRODUCTION_AUTH_OK: registration, credentials sign-in, session token, isolated API access');
}

main().catch(error => { console.error(error.message); process.exitCode = 1; }).finally(async () => {
  await query('DELETE FROM users WHERE email = $1', [email]);
  await closePool();
});
