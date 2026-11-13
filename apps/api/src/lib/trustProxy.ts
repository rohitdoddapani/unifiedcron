import { isIP } from 'net';

/**
 * Express `trust proxy` setting derived from the TRUST_PROXY environment variable.
 *
 * Deployments differ: self-hosters may expose the API directly, behind one reverse
 * proxy, or behind a proxy plus a CDN. The setting has to describe the real topology,
 * because `req.ip` is only trustworthy when the number of trusted hops (or the set of
 * trusted proxy addresses) matches what actually sits in front of the API.
 */
export type TrustProxySetting = false | number | string[];

export class TrustProxyConfigError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'TrustProxyConfigError';
  }
}

// Express/proxy-addr address keywords for the usual private ranges.
const ADDRESS_KEYWORDS = new Set(['loopback', 'linklocal', 'uniquelocal']);
const DISABLED_VALUES = new Set(['', 'false', 'off', 'no', 'none', '0']);
// Guards against a typo'd hop count that would effectively trust the whole chain.
const MAX_HOPS = 10;

function isAddressOrSubnet(token: string): boolean {
  const slash = token.lastIndexOf('/');
  if (slash === -1) {
    return isIP(token) !== 0;
  }

  const address = token.slice(0, slash);
  const prefix = token.slice(slash + 1);
  const version = isIP(address);
  if (version === 0 || !/^\d{1,3}$/.test(prefix)) {
    return false;
  }

  const bits = Number(prefix);
  return bits >= 0 && bits <= (version === 4 ? 32 : 128);
}

/**
 * Parses TRUST_PROXY into an Express `trust proxy` value.
 *
 * Accepted forms:
 *   unset / `false` / `off` / `no` / `none` / `0` -> no proxy trusted (default)
 *   a positive integer                            -> number of trusted hops closest to the API
 *   a comma-separated list                        -> trusted proxy addresses, subnets, or the
 *                                                    keywords loopback/linklocal/uniquelocal
 *
 * `true` is deliberately rejected: trusting every hop lets any client prepend its own
 * X-Forwarded-For entry and choose the address the rate limiter keys on.
 */
export function parseTrustProxy(raw: string | undefined): TrustProxySetting {
  const value = (raw ?? '').trim();
  if (DISABLED_VALUES.has(value.toLowerCase())) {
    return false;
  }

  if (['true', 'all', '*'].includes(value.toLowerCase())) {
    throw new TrustProxyConfigError(
      'TRUST_PROXY=true would trust every X-Forwarded-For entry, letting any client spoof its address. ' +
        'Set the number of proxy hops in front of the API (for example TRUST_PROXY=1) or a list of ' +
        'trusted proxy addresses/subnets (for example TRUST_PROXY=172.18.0.0/16).'
    );
  }

  if (/^\d+$/.test(value)) {
    const hops = Number(value);
    if (hops > MAX_HOPS) {
      throw new TrustProxyConfigError(
        `TRUST_PROXY hop count ${hops} exceeds the maximum of ${MAX_HOPS}. Use the number of proxies that ` +
          'actually sit in front of the API, or list their addresses/subnets instead.'
      );
    }
    return hops;
  }

  const tokens = value.split(',').map((token) => token.trim()).filter(Boolean);
  const invalid = tokens.filter((token) => !ADDRESS_KEYWORDS.has(token.toLowerCase()) && !isAddressOrSubnet(token));
  if (tokens.length === 0 || invalid.length > 0) {
    throw new TrustProxyConfigError(
      `TRUST_PROXY value is not a hop count or a list of addresses/subnets (unrecognised: ${invalid.join(', ') || value}). ` +
        'Use a positive integer, or a comma-separated list of IPs, CIDR subnets, or loopback/linklocal/uniquelocal.'
    );
  }

  return tokens;
}

/**
 * Describes the configured setting for startup logs. Self-hosters need to see whether
 * forwarded addresses are being honoured, because it changes what the ingest rate limit means.
 */
export function describeTrustProxy(setting: TrustProxySetting): string {
  if (setting === false) {
    return 'disabled (req.ip is the connecting socket address; forwarded headers ignored)';
  }
  if (typeof setting === 'number') {
    return `${setting} trusted hop(s) closest to the API`;
  }
  return `trusted proxy addresses: ${setting.join(', ')}`;
}
