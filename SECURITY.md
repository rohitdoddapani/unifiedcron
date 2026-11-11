# Security Policy

Report vulnerabilities privately using [GitHub private vulnerability reporting](https://github.com/rohitdoddapani/unifiedcron/security/advisories/new) if enabled. If that option is unavailable, open an issue asking for a private reporting channel without including vulnerability details, credentials, or exploit code. No verified security mailbox or PGP key is published here. Maintainer availability varies; there is no guaranteed response time or supported-version service commitment.

Include the affected commit or version, reproduction steps using data you own, expected impact, and a safe proof of concept. Do not put secrets in public issues or logs.

## Scope and stored data

UnifiedCron targets a single self-hosted tenant with multiple users and per-user resource ownership. It stores account emails and bcrypt password hashes; encrypted connection configurations and webhook signing secrets; job names, schedules, run outcomes, error text, alerts, and delivery history. Monitoring metadata can itself be sensitive. The API, worker, database, runtime environment, and backups belong to the deployment's trust boundary.

Connection configurations and webhook secrets use AES-256-GCM with a key derived from ENCRYPTION_KEY using scrypt with the literal constant salt `'salt'`; there is no per-deployment or per-record KDF salt. Encryption protects stored ciphertext, not an attacker who controls the running application or obtains both the database and key. Preserve the existing key across upgrades and restores. Simply replacing it makes existing ciphertext unreadable; rotation needs a tested re-encryption and recovery procedure.

## Integration blast radius

| Path | Credential and access | Impact of compromise |
| --- | --- | --- |
| Supabase signed push | No source database login is stored in UnifiedCron. A shared signing key authenticates metadata batches and acknowledgements. | Monitoring metadata and account information can leak. A stolen signing key can forge telemetry and acknowledgements; it does not itself grant database access. |
| Supabase direct reader | Dedicated PostgreSQL reader restricted to private metadata views, checked by connection validation with verified TLS. | The attacker can use the stolen credential with its actual database grants. Intended scope is read-only monitoring metadata; excessive or subsequently changed grants increase exposure. |
| n8n — planned, unavailable | Non-Enterprise API keys have access to all resources and capabilities of their account. Enterprise supports scoped keys. | A future stored key could expose the full connected account. Before shipping, require minimal Enterprise scopes or a dedicated low-privilege user where available, and implement read-only calls in UnifiedCron. Read-only client code cannot restrict a stolen key's upstream privileges. |

The n8n scope distinction follows [n8n's authentication documentation](https://docs.n8n.io/connect/n8n-api/authentication/). Other providers are planned, not available integrations.

Signed-push code includes timestamp/signature verification, ordered sequences, duplicate-payload digest checks, and a bounded durable inbox. Source installation is an explicit owner action. Pipeline tests and simulated telemetry do not establish that an owner's Supabase sender is installed or delivering live data; see [validation scope](docs/REVIEW_FIXES.md#validation-scope).

## Implemented boundaries and limits

User resource routes use verified JWT identity and ownership checks. Passwords are hashed with bcrypt. SQL queries use parameters. Push ingestion uses its signing protocol rather than a user session. Authentication and health routes have their own public entry points. The only request rate limits in the source are the push ingest limits described below; they do not cover authentication routes.

The Supabase push ingest route applies in-memory, per-process request limits, counted in separate tables per dimension: 60 per minute per connection and 3000 per minute per client address by default, both configurable (`PUSH_RATE_LIMIT_PER_CONNECTION`, `PUSH_RATE_LIMIT_PER_IP`). The per-connection cap is the per-sender control. The per-address cap is a coarse flood brake, not a per-sender one: hosted Supabase projects in a region share egress addresses, so unrelated connections can share an address counter. IPv6 clients are grouped by /64 so one host cannot mint keys by rotating addresses.

What the address key means depends on `TRUST_PROXY`. Unset, Express `trust proxy` is disabled, the key is the connecting socket address, and forwarded headers are ignored — so a forged `X-Forwarded-For` cannot change the key, but behind a reverse proxy every request carries the proxy's address and the per-address limit acts as one shared cap for the route rather than a per-client control. Set `TRUST_PROXY` to the number of proxy hops you operate, or to their addresses/subnets, to make it per-client; see [deployment](docs/DEPLOYMENT.md#reverse-proxy-and-client-addresses). `TRUST_PROXY=true` is rejected at startup because trusting every hop would let any client choose the address it is limited on. A hop count larger than the proxy chain actually in front of the API lets a client forge the entries beyond that chain, and a hop count is only sound while the proxy is the sole route to the API.

Each dimension's key table is bounded (20000 keys by default) and evicts its oldest window when full, so filling it cannot cause pushes from a previously-unseen connection to be rejected. The trade-off is that sustained key churn can evict a counter and reset its count, which weakens the per-key cap. These limits are an abuse brake and a memory bound, not an authentication control; timestamp and signature verification is what authenticates a push. Counters are per process and are not shared across API replicas or restarts.

Webhook delivery and direct-reader networking validate destinations and pin resolved addresses; these controls reduce SSRF exposure but are not a general network firewall. A compromised runtime can reach whatever its network and credentials allow. Webhook receivers must verify signatures and deduplicate stable delivery IDs because delivery is at least once.

The Express API applies Helmet defaults. This does not establish a Content Security Policy for the Next.js dashboard. This policy makes no blanket CSRF or XSS protection claim. There is no application authentication rate limiter or account lockout in the current source. Delivery retry backoff is not an authentication abuse control. No malware-scanning upload feature is implemented.

## Self-hosting responsibilities

Terminate public traffic with HTTPS, restrict database and administrative network access, protect runtime secrets and backups, and apply dependency and security updates. Configure exact allowed origins. Review source reader grants and webhook destinations. Restrict public registration and authentication exposure through deployment controls appropriate to your environment; the application does not supply authentication rate limiting or account lockout.

A runtime compromise can expose all users' data and decrypt stored provider credentials and webhook secrets. After an incident, recover from a trusted build and coordinate credential/session revocation and key recovery. Do not assume per-user API ownership checks contain an attacker who controls the host.
