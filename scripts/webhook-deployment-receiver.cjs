// Temporary deployment receiver; do not run as a permanent production service.
const http = require('node:http');
const { createHmac, timingSafeEqual } = require('node:crypto');
const secret = process.env.VERIFICATION_SECRET;
if (!secret) throw new Error('VERIFICATION_SECRET is required');
const counts = new Map();
let valid = 0;
let invalid = 0;
http.createServer(async (req, res) => {
  if (req.method === 'GET' && req.url === '/stats') { res.end(JSON.stringify({ valid, invalid })); return; }
  if (req.method !== 'POST') { res.writeHead(404); res.end(); return; }
  let body = ''; for await (const chunk of req) body += chunk;
  const timestamp = req.headers['x-unifiedcron-timestamp'] || '';
  const signature = req.headers['x-unifiedcron-signature'] || '';
  const expected = createHmac('sha256', secret).update(`${timestamp}.${body}`).digest();
  if (!/^[a-f0-9]{64}$/.test(signature) || Math.abs(Date.now() - Number(timestamp)) > 300000 || !timingSafeEqual(expected, Buffer.from(signature, 'hex'))) {
    invalid++; res.writeHead(401); res.end('Invalid signature'); return;
  }
  valid++;
  const id = req.headers['x-unifiedcron-delivery-id'];
  const count = (counts.get(id) || 0) + 1; counts.set(id, count);
  const fail = req.url === '/fail' || (req.url === '/retry' && count === 1);
  res.writeHead(fail ? 503 : 200); res.end(fail ? 'Temporary verification failure' : 'Signature verified');
}).listen(3199, '0.0.0.0');
