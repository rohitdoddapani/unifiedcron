import { createHmac } from 'crypto';
import { lookup } from 'dns/promises';
import { BlockList, isIP } from 'net';
import http from 'http';
import https from 'https';

export const WEBHOOK_RETRY_MINUTES = [1, 5, 15, 30, 60] as const;
export const WEBHOOK_MAX_ATTEMPTS = WEBHOOK_RETRY_MINUTES.length + 1;
export const WEBHOOK_BODY_LIMIT = 4096;

const blocked = new BlockList();
for (const [address, prefix] of [
  ['0.0.0.0', 8], ['10.0.0.0', 8], ['100.64.0.0', 10], ['127.0.0.0', 8],
  ['169.254.0.0', 16], ['172.16.0.0', 12], ['192.0.0.0', 24], ['192.0.2.0', 24],
  ['192.168.0.0', 16], ['198.18.0.0', 15], ['198.51.100.0', 24], ['203.0.113.0', 24],
  ['224.0.0.0', 3],
] as [string, number][]) blocked.addSubnet(address, prefix, 'ipv4');
const globalV6 = new BlockList();
globalV6.addSubnet('2000::', 3, 'ipv6');
blocked.addSubnet('2001:db8::', 32, 'ipv6');
blocked.addSubnet('2001::', 32, 'ipv6');
blocked.addSubnet('2002::', 16, 'ipv6');

export function isPublicWebhookAddress(address: string): boolean {
  const family = isIP(address);
  if (family === 4) return !blocked.check(address, 'ipv4');
  if (family === 6) return globalV6.check(address, 'ipv6') && !blocked.check(address, 'ipv6');
  return false;
}

export function signWebhook(secret: string, timestamp: string, body: string): string {
  return createHmac('sha256', secret).update(`${timestamp}.${body}`).digest('hex');
}

export async function resolveWebhookTarget(rawUrl: string, allowPrivate = process.env.WEBHOOK_ALLOW_PRIVATE_NETWORK === 'true') {
  let url: URL;
  try { url = new URL(rawUrl); } catch { throw new Error('Invalid webhook URL'); }
  if (!['http:', 'https:'].includes(url.protocol) || url.username || url.password || url.hash) {
    throw new Error('Webhook URL must use HTTP(S) without credentials or fragments');
  }
  const hostname = url.hostname.replace(/^\[|\]$/g, '');
  const addresses = isIP(hostname)
    ? [{ address: hostname, family: isIP(hostname) }]
    : await lookup(hostname, { all: true, verbatim: true });
  if (!addresses.length || (!allowPrivate && addresses.some(item => !isPublicWebhookAddress(item.address)))) {
    throw new Error('Private or reserved webhook addresses are disabled');
  }
  return { url, address: addresses[0] };
}

export interface WebhookResult { status: number; body: string }

export async function sendWebhook(input: {
  url: string; secret: string; event: string; payload: Record<string, unknown>; deliveryId: string;
  timeoutMs?: number; allowPrivate?: boolean;
}): Promise<WebhookResult> {
  const timeoutMs = input.timeoutMs ?? 10_000;
  // Bound DNS resolution as well as socket activity. DNS is pinned for this request.
  let timer: ReturnType<typeof setTimeout> | undefined;
  const target = await Promise.race([
    resolveWebhookTarget(input.url, input.allowPrivate),
    new Promise<never>((_, reject) => { timer = setTimeout(() => reject(new Error('Webhook DNS timeout')), timeoutMs); }),
  ]).finally(() => clearTimeout(timer));
  const body = JSON.stringify(input.payload);
  const timestamp = Date.now().toString();
  return new Promise((resolve, reject) => {
    const transport = target.url.protocol === 'https:' ? https : http;
    const req = transport.request(target.url, {
      method: 'POST',
      family: target.address.family,
      lookup: (_hostname, _options, callback) => callback(null, target.address.address, target.address.family),
      headers: {
        'Content-Type': 'application/json', 'Content-Length': Buffer.byteLength(body),
        'User-Agent': 'UnifiedCron/1.0', 'x-unifiedcron-event': input.event,
        'x-unifiedcron-delivery-id': input.deliveryId, 'x-unifiedcron-timestamp': timestamp,
        'x-unifiedcron-signature': signWebhook(input.secret, timestamp, body),
      },
    }, res => {
      const chunks: Buffer[] = [];
      let size = 0;
      res.on('data', (chunk: Buffer) => {
        const remaining = WEBHOOK_BODY_LIMIT - size;
        if (remaining > 0) { chunks.push(chunk.subarray(0, remaining)); size += Math.min(chunk.length, remaining); }
        if (size >= WEBHOOK_BODY_LIMIT) {
          resolve({ status: res.statusCode || 0, body: Buffer.concat(chunks).toString('utf8') });
          res.destroy();
        }
      });
      res.on('end', () => resolve({ status: res.statusCode || 0, body: Buffer.concat(chunks).toString('utf8') }));
      res.on('error', reject);
    });
    const deadline = setTimeout(() => req.destroy(new Error('Webhook request timeout')), timeoutMs);
    req.on('close', () => clearTimeout(deadline));
    req.on('error', reject);
    req.end(body);
  });
}
