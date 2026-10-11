# Review Follow-up: Supabase Safety and Ingestion

This technical follow-up is separate from the owner's private strategy notes.

## Implemented

- Hosted Supabase can use signed push instead of a database login. A private source sender/outbox
  sends only metadata, with HMAC-authenticated batches and acknowledgements; the dedicated worker
  consumes a bounded durable inbox. The managed pg_net grants and strict reader validation stay unchanged.
  Source SQL installation is an explicit owner action; code deployment alone does not activate this path.

- Direct connections require a dedicated PostgreSQL reader; hosted connections can use signed push. The anon/PostgREST cron path is disabled.
- Administrator-owned private views handle pg_cron's row-level security without exposing command.
- Column grants, verified TLS, checked/pinned DNS and default cloud-host restrictions limit access.
- Connection validation rejects privileged roles, memberships, command reads and accessible write/security-definer grants.
- Connection APIs do not return passwords, certificates or legacy keys. Existing connections retain their IDs/history and display a migration warning.
- Setup/cleanup documentation no longer recommends granting anonymous access. Cleanup revokes PUBLIC execution as well as named anon/authenticated grants.
- Ingestion pages numerically by runid, stores run changes and cursor checkpoints together, refreshes unfinished runs, and reports possible upstream purge gaps.
- First backfill is explicitly bounded to seven days / 10,000 rows. Backlog is visible; upstream ID resets require operator review.
- Discovery uses jobid, preserves unnamed/renamed identities, archives missing jobs, and refreshes automatically with polling/backoff.
- Failure storms update one open incident per job/type. Open and resolution notifications have separate idempotency keys. Old completions cannot resolve or reopen newer incidents.
- Error text is capped and pruned after seven days by daily maintenance. Only resolved incidents are eligible for age-based cleanup.
- Cron parsing supports steps/ranges and pg_cron intervals, with real timezone-aware next times.
- Vercel's internal parser now reads the documented crons array. Vercel remains unavailable as a live integration.
- Landing copy marks non-Supabase integrations, native email/Slack and preview/SDK features as planned.

## Required Owner Action

Any project that installed the former public interfaces must run `docs/supabase-cleanup.sql` in Supabase SQL Editor.
An anon key cannot perform that administrative revocation. Deploying the application does not itself revoke
previously installed grants in a separate cloud database. Review/rotate any credentials that appeared in exposed commands.
For hosted Supabase, update the connection to signed push and install its generated sender SQL.
Use a direct reader only on installations where its strict permission checks can pass.

## Validation Scope

Signed-push release `dd19b4a` passed 11 unit and 14 PostgreSQL integration tests plus both CI gates,
then deployed to Hetzner. Migration 007 was rehearsed twice and applied live with existing data intact.
Public HTTPS signed telemetry was processed by natural worker cycles, verifying retry dedupe and
failure-to-success incident recovery. Temporary smoke data was removed. Actual cloud sender installation
remains an owner action; these pipeline tests do not claim it is already running in Supabase.

The 2026-10-10 release `72942f0` passed GitHub quality and compose-smoke checks, then deployed
to the owner's Hetzner installation. Migration 006 passed twice on a restored production copy
and once on production. Existing 4 users, 1 connection, 1 job and 89 runs were preserved.
All services passed health checks; public HTTPS, credentials sign-in, session token, ownership,
CORS and encrypted-config compatibility checks passed.
The owner's cloud legacy grants were revoked and verified in Supabase SQL Editor.
Reader setup subsequently succeeded, but direct validation was blocked by hosted pg_net PUBLIC grants.
An owner-approved isolation attempt rolled back after verification failed; managed grants stayed unchanged.
Use signed push instead; live ingestion remains paused until the owner installs that connection's sender.
Other installations must still follow the owner-action instructions above.

The regression suite uses a real isolated PostgreSQL server with TLS and pg_cron-style RLS fixtures.
It checks permission denial, certificate verification, paging beyond 1,000 runs, unfinished updates, purge gaps,
rollback/replay, one incident during a failure storm, ordered recovery, identity preservation and public grant cleanup.
The owner's pooler authenticated with verified TLS, but failed the least-privilege check due to managed
pg_net grants. The replacement push path passed PostgreSQL producer fixtures; installing the actual
cloud sender remains an owner action. Do not equate simulated telemetry with live cloud monitoring.

## Still Planned

Missed-run/duration alerts, project/workspace grouping and additional live provider integrations remain roadmap work.
Hosted-first positioning, pricing and OAuth scope choices remain owner decisions; this patch does not choose them.

## Connection Updates

A connection's project/database identity is immutable. Credential rotation and TLS CA updates are allowed,
but changing the upstream project requires creating a new connection so cached history and cursors are not mixed.
