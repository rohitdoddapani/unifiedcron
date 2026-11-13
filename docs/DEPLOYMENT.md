# Deployment Guide

Webhook configuration, receiver signing verification, retry behavior, and upgrade details are in [NOTIFICATIONS.md](./NOTIFICATIONS.md).

The API owns CORS. Do not inject duplicate Access-Control headers or bypass OPTIONS in the reverse proxy.

## Milestone 3 Release Record

Active deployment using `docker-compose.prod.yml`.
Database, API, dashboard, landing and worker pass health checks. Migration {{MIGRATION_NUMBER_3}} was rehearsed twice
on a restored database before production cutover. Existing users/connections/jobs are preserved.
Live signed simulated alert delivery, natural retry recovery, terminal failure history,
and queued test-send passed. Temporary verification data and test routes are removed.

M3 backups are stored in a private runbook location, including PostgreSQL/source/environment,
proxy configuration/database backups, build logs and `webhooks-check.log`.
Retained images: `unifiedcron-api:pre-m3-<date>`, `unifiedcron-web:pre-m3-<date>`,
`unifiedcron-worker:pre-m3-<date>`.

For webhook verification, `scripts/verify-production-webhooks.cjs` expects
`VERIFICATION_RECEIVER` and `VERIFICATION_SECRET` pointing to an owner-controlled temporary receiver.
It creates and cleans a temporary user and verifies live dispatch. It accelerates retry timestamps
only for its temporary terminal-failure example; normal delivery records are untouched.
Do not leave `scripts/webhook-deployment-receiver.cjs` exposed as a permanent public service.

This guide covers production and self-host deployments using the split Compose files.

## Self-Host (End Users)

Use the self-host compose file, which excludes `landing` and `docs`:

```bash
cp docker-compose.env.example .env
# Edit .env with your configuration

docker compose -f docker-compose.selfhost.yml up -d
```

Services:
- Web UI: http://localhost:3000
- API: http://localhost:3001
- Worker health: http://localhost:3003/health
- API health: http://localhost:3001/health
- API DB health: http://localhost:3001/health/database

Runtime topology:
- `db` (PostgreSQL): persistent data store
- `api` (Express): authenticated data API
- `web` (Next.js): dashboard UI
- `worker` (Node cron): run ingestion, alert creation, auto-resolution

Smoke test (recommended after deploy/update):

```bash
POSTGRES_PORT=5434 pnpm smoke:compose
```

Expected success marker:

```text
COMPOSE_SMOKE_OK
```

## Production

Signed-push application release: {{RELEASE_SHA_2}}, deployed {{DEPLOYMENT_DATE}}.
CI run passed both gates; unit and integration tests passed.
Migration {{MIGRATION_NUMBER_2}} passed twice on a production copy and once live, preserving counts.
All services, HTTPS, auth/session, CORS and ownership checks passed.
Temporary smoke data and test databases were removed.
Backups/logs are stored in a private runbook; API/web/worker rollback tags `pre-push-<date>`.
Set `INGEST_PUBLIC_URL` to the public HTTPS API origin.
The owner must create/migrate a signed-push connection.

Previous reader/ingestion release: <sha>, deployed <date>.
Backup and verification logs are stored in a private runbook.
Migration {{MIGRATION_NUMBER_1}} passed twice on a production copy and on live data; counts remained.
All services and public HTTPS/auth/CORS/ownership checks passed.
Rollback image tags are `unifiedcron-{api,web,worker,landing}:pre-review-<date>`.

Verified host: SSH key authentication used for production access.
Production PostgreSQL uses host port <port> (local development uses <port>).

Production updates must preserve the server's `.env` and `db-data`. Build images before
recreating running services. Keep `ENCRYPTION_KEY` unchanged so stored connections remain readable.
Set `NEXT_PUBLIC_API_URL=https://api.unifiedcron.com`,
`NEXTAUTH_URL=https://dashboard.unifiedcron.com`, and
`ALLOWED_ORIGINS=https://dashboard.unifiedcron.com,https://unifiedcron.com`.
Supply an explicit `JWT_SECRET` shared by web/API.

Upgrade backup location for the <date> update:
stored in a private runbook. This contains a PostgreSQL dump,
source archive, environment backup, and build log.
Rollback image tags are `unifiedcron-api:pre-<date>`, `unifiedcron-web:pre-<date>`,
and `unifiedcron-landing:pre-<date>`.

Rehearse ordered migrations on a restored database copy before migrating the live database.
Use the API image's migration tool with the compose environment.
After migration, recreate `api`, `web`, and `worker`; leave the existing database and landing service in place.
Verify proxy HTTPS responses, auth session, CORS preflight, authenticated ownership,
connection decryption, and worker database health. Never run `smoke:compose` against production.

For rollback, stop the worker and tag the retained API/web images back to their original names,
then recreate those services. A database restore requires accounting for writes since backup.

Verification scripts run inside the API container:

```bash
docker compose -f docker-compose.prod.yml exec -T api node < scripts/verify-production.cjs
docker compose -f docker-compose.prod.yml exec -T api node < scripts/verify-production-auth.cjs
```

The first checks authenticated routes, ownership, config decryption, migrations, CORS and worker health.
The second creates a temporary account, checks HTTPS registration/sign-in/session access,
and removes the account afterward. Expected markers: `PRODUCTION_VERIFY_OK` and `PRODUCTION_AUTH_OK`.

The production compose file includes `landing`:

```bash
cp docker-compose.env.example .env
# Edit .env with your configuration

docker compose -f docker-compose.prod.yml up -d
```

Notes:
- `docker-compose.prod.yml` expects the external `proxy` network to exist.
- Configure your reverse proxy to route:
  - `unifiedcron.com` → landing (port 3002)
  - `dashboard.unifiedcron.com` → web (port 3000)
  - `api.unifiedcron.com` → api (port 3001)

## Reverse Proxy and Client Addresses

The signed-push ingest route rate limits per client address. The API only believes
`X-Forwarded-For` as far as `TRUST_PROXY` allows, so this setting has to describe the
topology you actually run.

| Topology | Setting |
| --- | --- |
| API reached directly, no proxy | leave `TRUST_PROXY` unset |
| One reverse proxy you operate (the layout above) | `TRUST_PROXY=1` |
| Proxy plus a CDN, and the proxy accepts traffic only from the CDN | `TRUST_PROXY=2` |
| Proxy plus a CDN, origin also reachable directly, or you are unsure | `TRUST_PROXY=1` |
| Proxy address known and stable | `TRUST_PROXY=172.18.0.0/16` (its address or subnet) |

Count only hops you operate, counting from the API outwards: the count is how many
addresses closest to the API are trusted, and the first untrusted one becomes the key. Each
trusted hop is one `X-Forwarded-For` entry a client could otherwise forge, so a count
higher than the real chain lets callers pick the address they are limited on.

**If you are not certain what sits in front of your proxy, use `TRUST_PROXY=1`.** One hop is
sound whether or not the layer above it is restricted, because the only entry it trusts is
the one your own proxy appends. With a CDN in front, the key is then the CDN edge address
that contacted your proxy, so clients behind one edge share an address counter — acceptable,
because the per-address cap is a coarse flood brake and the 60/min per-connection cap is the
per-sender control. Raise it to `2` only once the origin is confirmed CDN-only; that buys
finer keys, nothing more.

A hop count is only sound while every layer you trust is the sole route to the layer behind
it. A caller that reaches a trusted layer directly supplies the forwarded entries the count
would otherwise skip, so it chooses its own key. Two things to close:

- **The API port.** `docker-compose.prod.yml` publishes the API on `127.0.0.1` only; the
  reverse proxy reaches it over the `proxy` Docker network, so nothing off-host can connect
  to it. `docker-compose.selfhost.yml` and `docker-compose.yml` publish it on all
  interfaces, because the dashboard is normally reached directly in those layouts — if you
  set `TRUST_PROXY` with one of those files, restrict the port at the firewall or add the
  `127.0.0.1:` prefix yourself.
- **The layer in front of your proxy.** With a CDN counted as a hop, the proxy must accept
  traffic only from the CDN (origin firewall or allowlisted CDN ranges). A request that
  reaches the proxy directly on port 443 still gets the CDN's hop subtracted from its own
  forged header.

Trusting proxy addresses or subnets instead of a hop count removes the second concern,
because a direct caller's socket address is not in the trusted set. It does not remove the
first: when the API port is published, a connection arriving through Docker's userland proxy
reaches the container from the bridge gateway address, which falls inside the very subnet you
trusted. Restricting the port is the control that both forms depend on.

### Confirm the topology before you set it

Run this on the server. It answers both questions the setting depends on — whether the proxy
reaches the API over the Docker network, and which subnet that network uses:

```bash
# Containers attached to the `proxy` network. Your proxy container listed alongside
# unifiedcron-api means it routes over the network, and the loopback bind is correct.
docker network inspect proxy --format '{{range .Containers}}{{.Name}} {{end}}'

# The subnet to use if you prefer trusting an address range over a hop count.
docker network inspect proxy --format '{{range .IPAM.Config}}{{.Subnet}} {{end}}'
```

If your proxy is **not** on that network and reaches the API through the host's published
port from another machine, the loopback bind blocks it. Set `API_BIND_ADDRESS=0.0.0.0` in
`.env` to restore the old behaviour, and restrict port 3001 to the proxy at the firewall —
otherwise no `TRUST_PROXY` value is trustworthy. Changing either takes effect when you
recreate `api`; nothing else in the stack is affected.

Then check what is actually reachable from off-host — run this from another machine, not the
server:

```bash
# Expect a timeout or refused connection for the API and database ports.
nc -zv -w 5 your-server-address 3001
nc -zv -w 5 your-server-address 5432
```

On the server, `docker compose -f docker-compose.prod.yml ps` shows the bind address of each
published port (`127.0.0.1:3001->3001/tcp` is restricted; `0.0.0.0:3001->3001/tcp` is not),
and a host firewall can still be blocking a port that compose publishes widely.

`TRUST_PROXY=true` is rejected and the API exits at startup, as is an unparseable value.
The startup log line `🔁 Trust proxy:` reports what was applied, and a production process
with the setting unset logs a warning that the per-address ingest limit is acting as a
single shared cap for the route.

Your proxy must append the observed client address to `X-Forwarded-For` rather than
replacing or dropping it. Verify after deploying: the ingest route is signature-protected,
so check an address-bearing route reaches the API with the real client address rather than
trusting the setting alone. Limit values are in `docker-compose.env.example`; what the
limits do and do not guarantee is in [SECURITY.md](../SECURITY.md).

## Docs Site (Nextra + Vercel)

Docs are hosted separately from the application containers.

1. Set the Vercel project root to `docs-site/`.
2. Use the default Next.js build settings.
3. Set the domain to `docs.unifiedcron.com`.

Source markdown lives in `docs/` and is mirrored into the Nextra site under `docs-site/pages/`.
