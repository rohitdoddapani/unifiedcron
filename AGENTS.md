# UnifiedCron Agent Handoff

Last inspected: {{DATE}}. Update this file when milestone status or operating procedures change.

## Product and Scope

UnifiedCron is a self-hostable dashboard that discovers and monitors cron jobs across providers.
The current delivery target is single-tenant self-hosting with multiple users and per-user resource ownership.
Supabase is the first integration to harden for production. Other providers belong to a later hardening phase.
Monitoring runs in a dedicated worker, separate from the API. Alert channels for v1 are in-app and webhooks.
Upgrades must preserve existing data and encrypted connection credentials.
Private product positioning and roadmap notes may exist locally in `docs/PRODUCT_DIRECTION.md`.
The owner requested that this strategy document remain untracked; read it if present, but do not publish it.
Public technical follow-up and owner actions are in `docs/REVIEW_FIXES.md`.

## Workspace and Access

- Local checkout: <path-to-private-runbook>
- Git remote: `git@github.com:rohitdoddapani/unifiedcron.git`.
- Release branch: `main`. Use `git log` to identify the committed deployment revision.
- Docker context observed: <context>.
- Current container health verified via Docker Desktop socket.
- Build, migration, API, worker, and CORS checks use local Docker Compose.
- Production access verified using SSH key authentication.
- Owner authorized inspecting and upgrading this deployment.
- Baseline data counts: <counts>.
- Production PostgreSQL host port <port>, local development uses port 5434.
- Backups and previous image tags documented in a private runbook.
- `docs/DEPLOYMENT.md` now records verified production access and upgrade/rollback procedures. CI does not automatically deploy.
- Local `.env`, `.env.local`, and `apps/web/.env.local` exist. They are sensitive and may contain provider credentials. Do not print their contents or copy secrets into documentation.

## Repository Map

- `apps/web`: Next.js dashboard, NextAuth sessions, session-backed API client in `src/lib/api.ts`.
- `apps/api`: Express API, JWT authentication, ownership checks, connections/jobs/alerts/notification routes.
- `apps/worker`: Supabase monitoring, run ingestion, alert lifecycle, webhook delivery processing, health server.
- `apps/landing`: public landing page; excluded from self-host compose.
- `packages/database`: PostgreSQL access, base schemas, ordered migrations and migration runner.
- `packages/shared`: shared types, schemas, and encryption helpers.
- `packages/integrations`: provider discovery and run-fetching code.
- `docs`: operational/development Markdown; mirror relevant updates to `docs-site/pages`.
- `.github/workflows`: CI quality and compose smoke jobs; no deployment job found.
- `scripts/smoke-compose.sh`: local migration and API/web/worker smoke flow.

## Roadmap and Evidence

### Security/Ingestion Review Follow-up

Release {{RELEASE_SHA_1}} deployed on {{DEPLOYMENT_DATE}}.
GitHub Actions workflow passed quality gates and compose-smoke tests.
Migration {{MIGRATION_NUMBER_1}} passed on a restored production copy; counts {{DEPLOYMENT_COUNTS}}.
All services healthy; HTTPS, auth, CORS and ownership verification passed.
Backups and verification logs documented in a private runbook.
Rollback images documented in a private runbook.
Reader setup documented in a private runbook.
Migration {{MIGRATION_NUMBER_2}} passed on a restored production copy and once live; counts {{DEPLOYMENT_COUNTS}}.
All services healthy; public HTTPS, sign-in/session, CORS and ownership checks passed.
Temporary telemetry checks passed: {{TELEMETRY_CHECKS}}.
Backups and rollback tags documented in a private runbook.
Cloud sender installation requires owner handoff with private key.

See `docs/REVIEW_FIXES.md` and `docs/SUPABASE_SETUP.md`.
New connections require a dedicated PostgreSQL reader with verified TLS, private metadata views,
checked/pinned DNS and cloud-host restrictions. API responses hide connection credentials.
Legacy configs remain decryptable but monitoring through anon/PostgREST is disabled; owners must run
`docs/supabase-cleanup.sql` in their cloud project's SQL Editor and switch credentials.
See a private runbook for details.

Worker ingestion now rediscovers jobs, pages by numeric runid, refreshes unfinished runs, and commits
cache changes with stream cursors. Stable job IDs survive renames and missing jobs are archived.
First sync is bounded to seven days / 10,000 rows; purge gaps and catch-up/error state are visible.
Failures accumulate in one open incident; open/resolve notifications have independent idempotency keys.
Polling is normally every minute with concurrency/backoff, separate from 15-second notification dispatch.
Migration 006 preserves historical rows and consolidates duplicates without deleting history.
Test coverage includes real PostgreSQL TLS/RLS fixtures, denied writes/commands, API credential redaction,
1,105-run paging, status updates, rollback/replay, gaps, failure storms and safe recovery ordering.
Cloud reader/pooler validation still requires owner-supplied credentials.

Missed-run/duration detection, workspace grouping and further live integrations remain roadmap work.
Hosting/pricing decisions are not changed by this review patch. Non-Supabase landing claims are marked planned.

### Milestone 1: Security, Identity, Schema Integrity

Previously implemented: authenticated user data routes; session-driven frontend identity;
removal of default-user utilities; additive migration runner; encrypted-config compatibility;
required JWT/NextAuth secrets; offline font strategy; lint/quality commands.
Previous migrations and type checks passed. Revalidate before release.

### Milestone 2: Monitoring and In-App Alerts

Previously implemented: worker typing/config fixes; deterministic `sourceRunId` and run upsert;
idempotent failed-run alerts; open/resolved lifecycle; automatic resolution on success;
manual resolution metadata; API-backed alerts UI with filters and timeline; worker compose services and docs.

Local smoke tests passed: `COMPOSE_SMOKE_OK`, manual resolve/filter checks,
worker auto-resolution metadata checks, API/web/worker type checks, and healthy local services.
The auto-resolution smoke uses seeded data and does not prove live Supabase polling scenarios.
See a private runbook for verification procedures.

### Milestone 3: Completed Features

Implemented signed webhook CRUD/edit/test APIs; Notifications UI with one-time secrets, pause/resume,
status filters, pagination and per-attempt history; encrypted secrets with legacy conversion;
validated destinations and pinned DNS; bounded transport; durable retries, leases and outbox repair.
Webhook dispatch runs every 15 seconds independently of monitoring, with 1/5/15/30/60-minute backoff
and six maximum attempts. Receivers must deduplicate the stable delivery ID (at-least-once delivery).
Worker has non-overlapping cycles, graceful shutdown, structured logs, health/metrics and database failure responses.

Root `pnpm test` builds services and runs transport/security tests plus health-check regression.
`TEST_DATABASE_URL=... pnpm test:integration` runs PostgreSQL suites covering ownership,
concurrent dispatch, backoff delays, terminal failure, recovery, crashed leases,
outbox repair and encryption compatibility. Database name must end in `_test`.
CI includes service builds, type checks, lint, unit tests, PostgreSQL integration tests, builds and compose smoke.
Workflow runs on main pushes and pull requests. Inspect GitHub Actions result for the release revision.

Verified: type checks/lint/builds; unit and integration suites; browser registration,
sign-in, endpoint creation, test-send and attempt history.
Migration passed on a restored production copy and on production.
Production auth/isolation checks passed.

Runbook: `docs/NOTIFICATIONS.md`, mirrored to `docs-site/pages/notifications.mdx`.

CI smoke portability: do not assume ripgrep is installed on runners. The smoke script uses Docker inspect
for exact container health status and Node for HTML title extraction. `tests/smoke.unit.test.cjs` covers
healthy versus unhealthy/starting/missing container/inspect failure cases.

### Production Deployment

The local source snapshot is transferred to production servers with rsync,
excluding env files, database data, dependency/build directories and Git metadata.
Deployment uses committed source; the release commit records the snapshot in Git.
API/web/worker images are rebuilt; db and landing are retained. All services pass health checks.
Migrations pass on a restored production copy, then on the live database.
Baseline users/connections/jobs remain <counts>.
Live HTTPS endpoints return 200.
Hosted CORS and authentication checks pass.
`scripts/verify-production.cjs` runs read-only checks inside API.
`scripts/verify-production-auth.cjs` verifies HTTPS registration, credentials sign-in,
session API token and isolated access; it removes the temporary account afterward.
Worker cycles verify ingestion and alerting.

Build practices: pin Docker pnpm version, use build-only auth placeholders
for Next.js compilation (real secrets remain runtime env), exclude db-data from Docker/Git,
and run additive migrations before current base schema indexes on existing databases.

## Local Runtime

Use `docker-compose.selfhost.yml` with `db`, `api`, `web`, and `worker`.
Pass the override consistently to avoid port conflicts.

```bash
POSTGRES_PORT={{LOCAL_POSTGRES_PORT}} docker compose --env-file .env.local -f docker-compose.selfhost.yml up -d --build
POSTGRES_PORT={{LOCAL_POSTGRES_PORT}} docker compose --env-file .env.local -f docker-compose.selfhost.yml ps
POSTGRES_PORT={{LOCAL_POSTGRES_PORT}} docker compose --env-file .env.local -f docker-compose.selfhost.yml logs --tail=100 api web worker
```

- Dashboard: `http://localhost:3000`.
- API: `http://localhost:3001`; health: `/health` and `/health/database`.
- Worker: `http://localhost:3003/health` and `/metrics` (JSON snapshots).
- Local PostgreSQL: `127.0.0.1:<port>`; container PostgreSQL port: 5432.
- Persistent DB files: `./db-data`; never delete/reset them to repair migrations.
- `pnpm dev` starts web/API only; start `pnpm dev:worker` separately.
- Worker monitoring runs with retry/backoff; cleanup schedule documented in a private runbook.
- Webhook dispatch runs independently every 15 seconds.

Environment contract: `DATABASE_URL`, `ENCRYPTION_KEY`, `JWT_SECRET`, `NEXTAUTH_SECRET`,
`NEXTAUTH_URL`, `NEXT_PUBLIC_API_URL`, `ALLOWED_ORIGINS`, and worker configuration.
Use env examples for names, not real secrets.

## CORS Configuration

API containers run with `NODE_ENV=production`. Compose files pass an explicit allowlist.
API matching normalizes trailing slashes. Configure exact origins explicitly for custom domains/ports.
Wildcard origin reflection was removed; use exact origins. Hosted deployments require an explicit allowlist.

## Validation and Migration

```bash
pnpm install --frozen-lockfile
pnpm type-check
pnpm lint
pnpm test
pnpm build
pnpm db:migrate
POSTGRES_PORT=<port> SMOKE_BUILD=true KEEP_STACK_RUNNING=true pnpm smoke:compose
```

`pnpm db:migrate` uses the configured `DATABASE_URL`; verify its target before running.
Migrations are ordered; add new migrations rather than editing base schema.
Retain legacy encrypted-config reader compatibility until verified.

The smoke script is mutating: it runs migrations and inserts test data.
It defaults to stopping the stack unless `KEEP_STACK_RUNNING=true`.
Do not run it against production. Migration logging omits credentials.
Expected local success marker: `COMPOSE_SMOKE_OK`.

## Production Topology

`docker-compose.prod.yml` adds landing and requires an external `proxy` network.
Domain mapping: `unifiedcron.com` -> landing:3002;
`dashboard.unifiedcron.com` -> web:3000; `api.unifiedcron.com` -> api:3001.
Docs site is intended for separate Vercel hosting at `docs.unifiedcron.com`.
Reverse proxy routes are configured per deployment.
Use SSH key authentication to access production servers. Preserve `.env` and `db-data`.
Build first, test migrations on a restored database copy, then migrate production and recreate services.
Do not run the local compose smoke script against production.

## Working Rules

- Inspect `git status` first and preserve uncommitted work.
- Do not reset unrelated work. Use `codex/` prefix for new branches.
- Never commit env secrets, `db-data` or private strategy notes.
- Derive API identity from verified tokens.
- Keep API and worker config aligned.
- Distinguish implementation, tests, runtime checks, and production verification.
- Record validated evidence; do not infer release readiness from scaffolding.
