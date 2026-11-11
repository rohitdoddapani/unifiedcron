/**
 * Fixed-window request counter with a bounded key table.
 *
 * The ingest path needs an abuse brake that cannot be turned into an outage. An earlier
 * implementation shared one 5000-entry table between every dimension and reported
 * "limited" for any key it had no room for, so filling the table inside a single window
 * rejected pushes for every connection it had not already seen. This limiter instead
 * evicts its oldest window to make room, so a previously-unseen key is never rejected
 * because the table is full.
 *
 * Trade-off: under heavy key churn an attacker can evict a legitimate key's counter and
 * reset its count, which weakens the per-key cap. That is the deliberate choice for an
 * ingestion path, where dropping real telemetry is worse than admitting extra requests.
 * Signature verification, not this limiter, is what authenticates a push.
 *
 * Entries are inserted with a fixed window length and are never re-dated in place, so
 * Map insertion order is also expiry order: the front of the map is always the oldest
 * window. Sweeping the front is therefore O(1) amortised per request rather than a scan
 * of the whole table.
 */
import { isIP } from 'net';

export interface FixedWindowRateLimiterOptions {
  /** Requests allowed per key per window. */
  limit: number;
  /** Window length in milliseconds. */
  windowMs?: number;
  /** Maximum number of distinct keys tracked at once. */
  maxKeys?: number;
}

interface Window {
  count: number;
  resetAt: number;
}

export const DEFAULT_WINDOW_MS = 60_000;
export const DEFAULT_MAX_KEYS = 20_000;

export class FixedWindowRateLimiter {
  private readonly windows = new Map<string, Window>();
  private readonly limit: number;
  private readonly windowMs: number;
  private readonly maxKeys: number;
  private evictions = 0;

  constructor(options: FixedWindowRateLimiterOptions) {
    this.limit = Math.max(1, Math.floor(options.limit));
    this.windowMs = Math.max(1, Math.floor(options.windowMs ?? DEFAULT_WINDOW_MS));
    this.maxKeys = Math.max(1, Math.floor(options.maxKeys ?? DEFAULT_MAX_KEYS));
  }

  /**
   * Records one request against `key` and reports whether it exceeded the cap.
   * A key that is not currently tracked is always admitted.
   */
  exceeded(key: string, now: number = Date.now()): boolean {
    const existing = this.windows.get(key);
    if (existing && existing.resetAt > now) {
      existing.count += 1;
      return existing.count > this.limit;
    }

    if (existing) {
      // Expired: drop it so the re-inserted window keeps the table in expiry order.
      this.windows.delete(key);
    }

    this.dropExpired(now);
    this.evictOldest();
    this.windows.set(key, { count: 1, resetAt: now + this.windowMs });
    return false;
  }

  /** Number of keys currently tracked. */
  get size(): number {
    return this.windows.size;
  }

  /** Keys discarded to stay within maxKeys; useful for capacity monitoring. */
  get evictedKeys(): number {
    return this.evictions;
  }

  /** Remaining allowance for a key in its current window, for diagnostics and headers. */
  remaining(key: string, now: number = Date.now()): number {
    const existing = this.windows.get(key);
    if (!existing || existing.resetAt <= now) {
      return this.limit;
    }
    return Math.max(0, this.limit - existing.count);
  }

  private dropExpired(now: number): void {
    for (const [key, window] of this.windows) {
      if (window.resetAt > now) {
        break;
      }
      this.windows.delete(key);
    }
  }

  private evictOldest(): void {
    while (this.windows.size >= this.maxKeys) {
      const oldest = this.windows.keys().next();
      if (oldest.done) {
        return;
      }
      this.windows.delete(oldest.value);
      this.evictions += 1;
    }
  }
}

function expandIPv6(address: string): string[] | null {
  const halves = address.split('::');
  if (halves.length > 2) {
    return null;
  }

  const head = halves[0] ? halves[0].split(':') : [];
  const tail = halves.length === 2 && halves[1] ? halves[1].split(':') : [];
  if (halves.length === 1) {
    return head.length === 8 ? head : null;
  }

  const missing = 8 - head.length - tail.length;
  if (missing < 1) {
    return null;
  }

  return [...head, ...Array(missing).fill('0'), ...tail];
}

/**
 * Collapses a client address to the unit a limiter key should represent.
 *
 * A single host routinely holds an entire IPv6 /64, so keying on the full address lets one
 * machine mint effectively unlimited keys: it would churn the table and let a per-key cap be
 * sidestepped one address at a time. Grouping IPv6 by /64 keeps one host on one key. IPv4
 * addresses, and IPv4 addresses arriving in IPv4-mapped form, are used as-is.
 */
export function normalizeClientAddress(address: string): string {
  const withoutZone = address.trim().toLowerCase().split('%')[0];
  if (!withoutZone) {
    return 'unknown';
  }

  const mapped = /^(?:::ffff:)(\d+\.\d+\.\d+\.\d+)$/.exec(withoutZone);
  if (mapped) {
    return mapped[1];
  }

  if (isIP(withoutZone) !== 6) {
    return withoutZone;
  }

  const hextets = expandIPv6(withoutZone);
  if (!hextets) {
    return withoutZone;
  }

  return `${hextets.slice(0, 4).map((part) => part.replace(/^0+(?=.)/, '')).join(':')}::/64`;
}

/**
 * Limiter key for the connecting client.
 *
 * `req.ip` honours forwarded headers only to the extent the deployment's `trust proxy`
 * setting allows, so with TRUST_PROXY unset this is the socket peer and a forged
 * X-Forwarded-For changes nothing.
 */
export function clientAddressKey(req: { ip?: string; socket?: { remoteAddress?: string } }): string {
  return `ip:${normalizeClientAddress(req.ip || req.socket?.remoteAddress || 'unknown')}`;
}

function positiveIntFromEnv(name: string, fallback: number): number {
  const raw = (process.env[name] ?? '').trim();
  if (!/^\d+$/.test(raw)) {
    return fallback;
  }
  const value = Number(raw);
  return value > 0 ? value : fallback;
}

/**
 * Per-address cap for the signed-push ingest route.
 *
 * Senders are hosted Supabase projects, and projects in the same region share egress
 * addresses, so several connections legitimately arrive from one address. The default is
 * a coarse flood brake well above the per-connection cap; the per-connection limit is the
 * per-sender control.
 */
export const PUSH_IP_LIMIT = positiveIntFromEnv('PUSH_RATE_LIMIT_PER_IP', 3000);

/** Per-connection cap for the signed-push ingest route. */
export const PUSH_CONNECTION_LIMIT = positiveIntFromEnv('PUSH_RATE_LIMIT_PER_CONNECTION', 60);

/** Keys tracked per dimension. Bounds memory; reaching it evicts, it does not reject. */
export const PUSH_MAX_KEYS = positiveIntFromEnv('PUSH_RATE_LIMIT_MAX_KEYS', DEFAULT_MAX_KEYS);

/**
 * Separate tables per dimension: address churn cannot evict connection counters, and a
 * burst of unknown connection ids cannot evict address counters.
 */
export const pushAddressLimiter = new FixedWindowRateLimiter({ limit: PUSH_IP_LIMIT, maxKeys: PUSH_MAX_KEYS });
export const pushConnectionLimiter = new FixedWindowRateLimiter({ limit: PUSH_CONNECTION_LIMIT, maxKeys: PUSH_MAX_KEYS });
