# Deployment Guide

Webhook configuration, receiver signing verification, retry behavior, and upgrade details are in [NOTIFICATIONS.md](./NOTIFICATIONS.md).

The API owns CORS. Do not inject duplicate Access-Control headers or bypass OPTIONS in the reverse proxy.
On 2026-10-10 the legacy Nginx Proxy Manager advanced CORS configuration for `api.unifiedcron.com`
was removed from both its saved configuration and generated file. Proxy backups are in the M3 backup directory.

## Milestone 3 Release Record (2026-10-10)

Active deployment: `my-server:/srv/unifiedcron`, using `docker-compose.prod.yml`.
Database, API, dashboard, landing and worker passed health checks. Migration 005 was rehearsed twice
on a restored database before production cutover. Existing users/connections/jobs were preserved.
Live signed simulated alert delivery, natural one-minute retry recovery, terminal failure history,
and queued test-send passed. Temporary verification data, receiver and proxy route were removed.

M3 backups are at `/srv/unifiedcron-backups/20261010-m3`, including PostgreSQL/source/environment,
proxy configuration/database backups, build logs and `webhooks-check.log`.
Retained images: `unifiedcron-api:pre-m3-20261010`, `unifiedcron-web:pre-m3-20261010`,
`unifiedcron-worker:pre-m3-20261010`. Follow the encrypted-secret rollback guidance in the notification runbook.
The deployed source snapshot is tracked by the follow-up Git release commit. Its revision is recorded in
`/srv/unifiedcron-backups/20261010-m3/release-commit.txt`; deployed files and image identifiers are also retained there.

For a future controlled webhook verification, `scripts/verify-production-webhooks.cjs` expects
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

## Production (Hetzner)

Verified host (2026-10-10): SSH alias `my-server`, hostname `tropis-ubuntu`,
checkout `/srv/unifiedcron`. Access uses the owner's local SSH configuration.
The shared reverse proxy is Nginx Proxy Manager; other applications also run on this host.
Production PostgreSQL uses host port 5432 (local development uses 5434).

Production updates must preserve the server's `.env` and `db-data`. Build images before
recreating running services. Keep `ENCRYPTION_KEY` unchanged so stored connections remain readable.
Set `NEXT_PUBLIC_API_URL=https://api.unifiedcron.com`,
`NEXTAUTH_URL=https://dashboard.unifiedcron.com`, and
`ALLOWED_ORIGINS=https://dashboard.unifiedcron.com,https://unifiedcron.com`.
Supply an explicit `JWT_SECRET` shared by web/API.

Upgrade backup location for the 2026-10-10 update:
`/srv/unifiedcron-backups/20261010-upgrade`. This contains a PostgreSQL custom-format dump,
source archive, environment backup, and build log. Access is restricted because the backup contains secrets.
Rollback image tags are `unifiedcron-api:pre-20261010`, `unifiedcron-web:pre-20261010`,
and `unifiedcron-landing:pre-20261010`.

Rehearse ordered migrations on a restored database copy before migrating the live database.
The runner adds columns before applying current schema indexes on existing installations.
Use the new API image's `node /app/packages/database/dist/migrate.js` with the compose environment.
After migration, recreate `api`, `web`, and `worker`; leave the existing database and landing service in place.
Verify proxy HTTPS responses, auth session, CORS preflight, authenticated ownership,
connection decryption, and worker database health. Never run `smoke:compose` against production.

For rollback, stop the worker and tag the retained API/web images back to their original names,
then recreate those services using the backed-up compose/environment. Additive migrations can
remain for application rollback. A database restore is a separate recovery operation that requires
accounting for any writes made since backup; never restore blindly over live data.

Verification scripts run inside the API container:

```bash
docker compose -f docker-compose.prod.yml exec -T api node < scripts/verify-production.cjs
docker compose -f docker-compose.prod.yml exec -T api node < scripts/verify-production-auth.cjs
```

The first checks authenticated routes, ownership, config decryption, migrations, CORS and worker health.
The second creates a temporary account, checks real HTTPS registration/sign-in/session access,
and removes the account afterward. Expected markers: `PRODUCTION_VERIFY_OK` and `PRODUCTION_AUTH_OK`.
The 2026-10-10 deployment passed both and ingested a live Supabase run.
The initial deployment used local source directly; the follow-up release commit records it in Git.

The production compose file includes `landing` in addition to core services:

```bash
cp docker-compose.env.example .env
# Edit .env with your configuration

docker compose -f docker-compose.prod.yml up -d
```

Notes:
- `docker-compose.prod.yml` expects the external `proxy` network to exist.
- Configure your reverse proxy (nginx/traefik) to route:
  - `unifiedcron.com` → landing (port 3002)
  - `dashboard.unifiedcron.com` → web (port 3000)
  - `api.unifiedcron.com` → api (port 3001)

## Docs Site (Nextra + Vercel)

Docs are hosted separately from the application containers.

1. Set the Vercel project root to `docs-site/`.
2. Use the default Next.js build settings.
3. Set the domain to `docs.unifiedcron.com`.

Source markdown lives in `docs/` and is mirrored into the Nextra site under `docs-site/pages/`.
