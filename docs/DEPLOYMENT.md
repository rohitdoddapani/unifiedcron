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

## Docs Site (Nextra + Vercel)

Docs are hosted separately from the application containers.

1. Set the Vercel project root to `docs-site/`.
2. Use the default Next.js build settings.
3. Set the domain to `docs.unifiedcron.com`.

Source markdown lives in `docs/` and is mirrored into the Nextra site under `docs-site/pages/`.
