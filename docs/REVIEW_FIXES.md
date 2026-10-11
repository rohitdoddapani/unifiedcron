# Review Follow-up: Supabase Safety and Ingestion

This technical follow-up is separate from the owner's private strategy notes.

## Implemented

- New Supabase connections use a dedicated PostgreSQL reader. The anon/PostgREST cron path is disabled.
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

The existing cloud project must run `docs/supabase-cleanup.sql` in Supabase SQL Editor.
An anon key cannot perform that administrative revocation. Deploying the application does not itself revoke
previously installed grants in a separate cloud database. Review/rotate any credentials that appeared in exposed commands.
Then install the reader role and update the existing connection using its pooler credentials and CA certificate.
The application verifies the actual permissions and TLS when that connection is submitted.

## Validation Scope

The 2026-10-10 release `72942f0` passed GitHub quality and compose-smoke checks, then deployed
to the owner's Hetzner installation. Migration 006 passed twice on a restored production copy
and once on production. Existing 4 users, 1 connection, 1 job and 89 runs were preserved.
All services passed health checks; public HTTPS, credentials sign-in, session token, ownership,
CORS and encrypted-config compatibility checks passed.
The owner's cloud legacy grants were revoked and verified in Supabase SQL Editor.
The secure reader is not yet installed/configured; that connection's live ingestion remains paused.
Other installations must still follow the owner-action instructions above.

The regression suite uses a real isolated PostgreSQL server with TLS and pg_cron-style RLS fixtures.
It checks permission denial, certificate verification, paging beyond 1,000 runs, unfinished updates, purge gaps,
rollback/replay, one incident during a failure storm, ordered recovery, identity preservation and public grant cleanup.
Cloud pooler login with this owner's reader is not verified until the owner installs/provides its credentials.

## Still Planned

Missed-run/duration alerts, project/workspace grouping and additional live provider integrations remain roadmap work.
Hosted-first positioning, pricing and OAuth scope choices remain owner decisions; this patch does not choose them.

## Connection Updates

A connection's project/database identity is immutable. Credential rotation and TLS CA updates are allowed,
but changing the upstream project requires creating a new connection so cached history and cursors are not mixed.
