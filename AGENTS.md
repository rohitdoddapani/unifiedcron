# UnifiedCron Agent Handoff

Last inspected: 2026-10-10. Update this file when milestone status or operating procedures change.

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

- Local checkout: `/Users/rohith/Documents/personal/unifiedcron/unifiedcron`.
- Git remote: `git@github.com:rohitdoddapani/unifiedcron.git`.
- Release branch: `main`. Use `git log` and the server's release record to identify the committed deployment revision.
- Docker context observed: `desktop-linux`, using the local Docker Desktop socket at `/Users/rohith/.docker/run/docker.sock`.
- On 2026-10-10 the Docker daemon was unavailable; current container health could not be verified.
- Previous build, migration, API, worker, and CORS checks used local Docker Compose, not a remote production host.
- Production access verified on 2026-10-10 using `ssh my-server` (local SSH configuration/key authentication), as root on `tropis-ubuntu`, at `/srv/unifiedcron`. Server address supplied by owner: `46.62.141.137`.
- Owner authorized inspecting and upgrading this deployment. Limit operations to UnifiedCron: this host also runs Supabase, n8n, Appsmith, other apps, and a shared proxy.
- Before this upgrade production was at commit `4e46e0d`, with db/api/web/landing healthy and no worker. Baseline data counts: 4 users, 1 connection, 1 job.
- Production uses PostgreSQL host port 5432, unlike local port 5434. Never transfer local env files or database directories.
- Pre-upgrade backup: `/srv/unifiedcron-backups/20261010-upgrade`, containing restricted database dump, source archive, environment copy and build log. Previous image tags: `unifiedcron-api:pre-20261010`, `unifiedcron-web:pre-20261010`, `unifiedcron-landing:pre-20261010`.
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

Release `72942f081ab586c9b5224840027b58ee372855da` deployed to Hetzner on 2026-10-10
(America/Chicago). GitHub run 38087627163 passed quality and compose-smoke.
Migration 006 passed twice on a restored production copy, preserving 4 users, 1 connection,
1 job and 89 runs; credential decryption and stable identity checks passed.
Live migration and API/web/worker/landing rebuilds completed; all five services are healthy.
HTTPS, auth registration/sign-in/session, CORS and ownership verification passed; counts remain 4/1/1/89.
Restricted backups and verification logs: `/srv/unifiedcron-backups/20261010-review`.
Rollback images: `unifiedcron-{api,web,worker,landing}:pre-review-20261010`.
The owner's cloud Supabase cleanup was executed in its SQL Editor and verified:
PUBLIC/anon/authenticated cannot select the legacy views or execute the legacy function.
No upstream jobs or run history were deleted. Review exposed commands for credentials that need rotation.
Reader setup is prepared but NOT executed: the owner must enter its new password and submit it.
Existing production connection remains legacy; worker records an explicit migration-required error.
Do not report live cloud ingestion restored until reader credentials/TLS are configured and validated.

See `docs/REVIEW_FIXES.md` and the rewritten `docs/SUPABASE_SETUP.md`.
New connections require a dedicated PostgreSQL reader with verified TLS, private metadata views,
checked/pinned DNS and cloud-host restrictions. API responses hide connection credentials.
Legacy configs remain decryptable but monitoring through anon/PostgREST is disabled; owners must run
`docs/supabase-cleanup.sql` in their cloud project's SQL Editor and switch credentials.
The app cannot revoke upstream public grants with an anon key. Do not report cloud cleanup as completed without evidence.

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
Previous local migrations and type checks passed. Revalidate before release; historical success is not current production verification.

### Milestone 2: Monitoring and In-App Alerts

Previously reported complete: worker typing/config fixes; deterministic `sourceRunId` and run upsert;
idempotent failed-run alerts; open/resolved lifecycle; automatic resolution on success;
manual resolution metadata; API-backed alerts UI with filters and timeline; worker compose services and docs.

Previous local smoke evidence: `COMPOSE_SMOKE_OK`, manual resolve/filter checks,
worker auto-resolution metadata checks, API/web/worker type checks, and healthy local services.
The auto-resolution smoke calls the worker alert service directly with seeded data.
It does not by itself prove a full live Supabase polling failure-to-success sequence or concurrent ingestion behavior.
Do not claim those scenarios are verified without testing them.

### Milestone 3: Completed and Deployed on 2026-10-10

Implemented signed webhook CRUD/edit/test APIs; Notifications UI with one-time secrets, pause/resume,
status filters, pagination and per-attempt history; encrypted secrets with legacy conversion;
validated destinations and pinned DNS; bounded transport; durable retries, leases and outbox repair.
Webhook dispatch runs every 15 seconds independently of monitoring, with 1/5/15/30/60-minute backoff
and six maximum attempts. Receivers must deduplicate the stable delivery ID (at-least-once delivery).
Worker has non-overlapping cycles, graceful shutdown, structured logs, health/metrics and database failure responses.

Root `pnpm test` builds services and runs transport/security tests plus a shell health-check regression.
`TEST_DATABASE_URL=... pnpm test:integration` runs four real PostgreSQL suites covering ownership,
concurrent dispatch, all backoff delays, terminal failure, eventual recovery, crashed leases,
outbox repair and encryption compatibility. Database name must end in `_test`.
Legacy leaf-package Jest scripts are not the release gate; use the root commands.
CI includes service builds, type checks, lint, unit tests, PostgreSQL integration tests, builds and compose smoke.
Workflow runs on main pushes and pull requests. Inspect the GitHub Actions result for the release revision; do not infer success from configuration alone.

Verified: type checks/lint/builds; transport/security unit and four integration suites; real browser registration,
sign-in, endpoint creation, test-send and attempt history; mobile layout at 390px with no horizontal overflow.
Migration 005 passed twice on a restored production copy, then on production.
Production auth/isolation checks passed. Live HTTPS signed simulated failure alerts, natural one-minute retry
recovery, six-attempt terminal failure history and signed test-send passed (`PRODUCTION_WEBHOOKS_OK`).
Terminal-failure delays were accelerated only for temporary test records; the full persisted schedule was checked in isolation.
Temporary users/data, receiver, proxy test route and test databases were cleaned up.

M3 backups: `/srv/unifiedcron-backups/20261010-m3` (database/source/env/proxy backups, build and verification logs).
Rollback image tags: `unifiedcron-api:pre-m3-20261010`, `unifiedcron-web:pre-m3-20261010`,
`unifiedcron-worker:pre-m3-20261010`. Older workers cannot read encrypted webhook secrets; consult the runbook before rollback.
Staging source: `/srv/unifiedcron-m3-release`; active source remains `/srv/unifiedcron`.
Runbook: `docs/NOTIFICATIONS.md`, mirrored to `docs-site/pages/notifications.mdx`.
Next work: user acceptance, checking release CI, and choosing post-M3 features.

CI smoke portability: do not assume ripgrep is installed on runners. The smoke script uses Docker inspect
for exact container health status and Node for HTML title extraction. `tests/smoke.unit.test.cjs` covers
healthy versus unhealthy/starting/missing container/inspect failure cases.

### Production Deployment Verified on 2026-10-10

The current local source snapshot was transferred to `/srv/unifiedcron` with rsync,
excluding env files, database data, dependency/build directories and Git metadata.
Initial deployment used uncommitted source; the follow-up release commit records that snapshot in Git.
The server's release revision is recorded in `/srv/unifiedcron-backups/20261010-m3/release-commit.txt`.
API/web/worker images were rebuilt; db and landing were retained. All five services passed health checks.
All four migrations passed twice on a restored production copy, then passed on the live database.
Baseline users/connections/jobs remained 4/1/1. Existing connection credentials still decrypt.
Live HTTPS landing/dashboard/auth-session/database-health returned 200.
Hosted CORS, unauthenticated rejection and cross-user connection rejection passed.
`scripts/verify-production.cjs` runs read-only checks inside API via stdin.
`scripts/verify-production-auth.cjs` verified actual HTTPS registration, credentials sign-in,
session API token and isolated access; it removed its temporary account afterward.
One live Supabase worker cycle ingested a successful run with no alert.
Repeating ingestion stored zero additional runs; SQL duplicate-run count was zero.
The temporary migration-rehearsal database was removed; backup files remain available.
Those initial checks did not close M3; the later M3 verification described above did.

Build fixes made during deployment: pin Docker pnpm to 9.15.9, use build-only auth placeholders
for Next.js compilation (real secrets remain runtime env), exclude db-data from Docker/Git,
and run additive migrations before current base schema indexes on existing databases.

## Local Runtime

Use `docker-compose.selfhost.yml` with `db`, `api`, `web`, and `worker`.
This session's PostgreSQL host port is **5434** because 5432 was occupied previously.
Pass the override consistently: omitting it can recreate the DB container with a conflicting port mapping.

```bash
POSTGRES_PORT=5434 docker compose --env-file .env.local -f docker-compose.selfhost.yml up -d --build
POSTGRES_PORT=5434 docker compose --env-file .env.local -f docker-compose.selfhost.yml ps
POSTGRES_PORT=5434 docker compose --env-file .env.local -f docker-compose.selfhost.yml logs --tail=100 api web worker
```

- Dashboard: `http://localhost:3000`.
- API: `http://localhost:3001`; health: `/health` and `/health/database`.
- Worker: `http://localhost:3003/health` and `/metrics` (JSON snapshots).
- Local PostgreSQL: `127.0.0.1:5434`; container PostgreSQL port: 5432.
- Persistent DB files: `./db-data`; never delete/reset them to repair migrations.
- `pnpm dev` starts web/API only; start `pnpm dev:worker` separately with appropriate environment.
- Worker monitoring normally runs every minute with per-connection retry/backoff; daily cleanup runs at 02:00 in the runtime timezone.
- Webhook dispatch runs independently every 15 seconds. Worker host port is now loopback-only.

Environment contract: `DATABASE_URL`, `ENCRYPTION_KEY`, `JWT_SECRET`, `NEXTAUTH_SECRET`,
`NEXTAUTH_URL`, `NEXT_PUBLIC_API_URL`, `ALLOWED_ORIGINS`, and worker configuration.
Use env examples for names, not real secrets. Next.js public API URL is a build argument; changing it requires rebuilding web.

## Recent CORS Fix

API containers run with `NODE_ENV=production`. Previously compose omitted `ALLOWED_ORIGINS`,
causing the API to default to hosted domains and reject local browser OPTIONS requests.
All compose files now pass an explicit allowlist; API matching normalizes trailing slashes.
Previous in-container preflight from `http://localhost:3000` returned 204 and the matching allow-origin header.
For custom domains/ports configure exact origins explicitly and recreate API.
Wildcard origin reflection was removed during M3; use exact origins.
The production compose default is also localhost-oriented, so hosted deployments require an explicit allowlist.

## Validation and Migration

```bash
pnpm install --frozen-lockfile
pnpm type-check
pnpm lint
pnpm test
pnpm build
pnpm db:migrate
POSTGRES_PORT=5434 SMOKE_BUILD=true KEEP_STACK_RUNNING=true pnpm smoke:compose
```

`pnpm db:migrate` uses the configured `DATABASE_URL`; verify its target before running.
Migrations: `001_runtime_integrity.sql`, `002_notifications.sql`,
`003_normalize_connection_config.sql`, `004_delivery_uniqueness.sql`.
M3 adds `005_webhook_reliability.sql` for leases, attempt history and encrypted-secret metadata.
The review adds `006_secure_ingestion_incidents.sql` for cursor/freshness state, stable identities and incidents.
Add new ordered migrations rather than assuming base schema edits upgrade an existing database.
Retain legacy encrypted-config reader compatibility until migration behavior is verified.

The smoke script is mutating: it runs migrations and inserts test users/connections/jobs/alerts.
It defaults to stopping the stack afterward unless `KEEP_STACK_RUNNING=true`.
Do not run it against production. Migration logging omits the database URL/password.
Expected local success marker: `COMPOSE_SMOKE_OK`.

## Production Topology

`docker-compose.prod.yml` adds landing and requires an external `proxy` network.
Documented domain mapping: `unifiedcron.com` -> landing:3002;
`dashboard.unifiedcron.com` -> web:3000; `api.unifiedcron.com` -> api:3001.
Docs site is intended for separate Vercel hosting at `docs.unifiedcron.com`.
Nginx Proxy Manager is the shared proxy, with verified routes for all three application domains.
Its old API custom CORS headers/OPTIONS bypass were removed durably from saved configuration and the generated file;
the API now owns CORS and public HTTPS preflight returns a single allow-origin header.
Use `ssh my-server` and `/srv/unifiedcron`; preserve `.env` and `db-data` there.
Build first, test migrations on a restored database copy, then migrate production and recreate application services.
Do not run the local compose smoke script against production.

## Working Rules

- Inspect `git status` first and preserve any existing uncommitted work.
- Do not reset, discard, or overwrite unrelated work. Create branches with the `codex/` prefix when needed.
- Never commit env secrets, `db-data` or the owner's private strategy notes; all are excluded by `.gitignore`.
- Derive API identity from verified tokens; never restore client-controlled `userId` tenancy.
- Keep API and worker config decryption and alert identity semantics aligned.
- Distinguish source implementation, historical local tests, current local runtime checks, and production verification in reports.
- Record newly validated milestone evidence and remaining gaps here; do not infer release readiness from scaffolding.
