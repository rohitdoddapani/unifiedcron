# Secure Supabase Connection Setup

## Hosted Supabase: Signed Push (Recommended)

Hosted Supabase's managed `pg_net` privileges cannot be removed from a database login role.
Use **Hosted Supabase: signed push** in Connections instead of sharing a database login.
Enter the 20-character project reference from your Supabase dashboard URL and a display label.
For an existing connection, use **Switch to signed push** / **Switch to secure connection** to retain its history.
Create the connection, copy **sender SQL**, and run it as `postgres` in that same project's SQL Editor.
The source requires `pg_cron`, `pg_net`, and `pgcrypto` installed in the `extensions` schema.
Configure `INGEST_PUBLIC_URL` to your UnifiedCron installation's public HTTPS API origin first.
Local-only HTTP installations cannot receive cloud pushes; use an HTTPS-reachable test installation.

The script creates a private `unifiedcron_push` schema, source checkpoint/outbox, a restricted
SECURITY DEFINER sender and a one-minute cron job. It does not change managed `net` grants.
Other non-privileged roles cannot read the key or execute the sender. Database administrators remain trusted.
The signing key appears only in the authenticated setup script/private table and encrypted app config,
not in a cron command, request header or queued payload. Keep saved setup SQL private.
No database passwords, cron commands or free-form run messages are transmitted.

Requests use HMAC-SHA256 over `timestamp + '.' + original JSON bytes`, with a five-minute replay window.
Each connection has monotonically increasing batch sequences. The API durably queues authenticated batches;
the dedicated worker commits jobs/runs/incidents with the processed checkpoint. Retries are idempotent.
The API's acknowledgement is also signed: untrusted writes to `net._http_response` cannot forge acceptance.
Source checkpoints advance only after this receipt verifies; failed delivery retries after two minutes.
Metadata in the pg_net queue remains readable to database login roles, and those roles can disrupt its
delivery. This design protects integrity and avoids sharing broad credentials; it does not promise availability
against a database role that can modify managed queues. Never expose `unifiedcron_push` in the Data API.

First sync retains the seven-day / 10,000-run backfill bound. New runs page 500 per batch; up to 500
unfinished runs refresh per batch with rotation. Discovery is a full snapshot, capped at 1,000 jobs;
oversized snapshots fail explicitly rather than archiving truncated jobs. Initial historical failures
do not generate a notification storm. Freshness failures become visible after three minutes.
Use **Test** after installation, then wait for a worker cycle and check Jobs.
If installation fails, inspect the named `unifiedcron-push-<connection UUID>` cron job and its run history.
After deleting an app connection, unschedule its source cron job as well; otherwise it will keep retrying.
Do not drop pg_net or change its managed grants as a workaround.

## Direct PostgreSQL Reader (Restricted Installations Only)

UnifiedCron supports Supabase pg_cron today. Connect each project using a dedicated PostgreSQL reader,
not an anon or service-role API key. Supabase SQL Editor is part of the cloud dashboard; no local editor is required.

## 1. Revoke the former public setup

If you installed an older UnifiedCron version, run `docs/supabase-cleanup.sql` in that project's SQL Editor.
It revokes access to `public.cron_jobs_view`, `public.cron_job_run_logs` and `public.get_latest_job_runs()`
from PUBLIC/anon/authenticated. It does not remove cron jobs or history. This step requires project admin access;
UnifiedCron cannot revoke these grants using an anon key. Application updates alone do not close that exposure.
If cron commands included credentials and those interfaces were exposed, rotate the affected credentials.

## 2. Create the reader

In UnifiedCron, open Connections and choose Add Supabase Connection (or Switch to secure connection).
Expand Reader setup SQL and copy the generated script. It contains a unique reader password.
Run it as an administrator in Supabase SQL Editor. If this project already has a `unifiedcron_reader` role,
use its existing credentials or deliberately rotate the password; do not blindly rerun CREATE ROLE.

The equivalent template is `docs/supabase-setup.sql`; replace its password placeholder before running.
The role receives column-level SELECT on two administrator-owned views in the private `unifiedcron` schema:

- `jobs`: jobid, jobname, schedule, active.
- `runs`: runid, jobid, status, start_time, end_time, return_message.

The views are not granted to PUBLIC, anon, authenticated or service_role. Do not expose this schema through
PostgREST. `command` is never selected. Administrator-owned views are needed because pg_cron's RLS otherwise
hides jobs created by different database users. Use an administrator who can see the jobs you intend to monitor.

## 3. Use the session pooler connection string

In Supabase, click Connect and select the Session pooler (port 5432). Change its username to
`unifiedcron_reader.PROJECT_REF` and use the password from the reader setup. Direct connections use the username
`unifiedcron_reader`, but direct cloud database hosts may require IPv6. Do not submit the administrator connection.

```text
postgresql://unifiedcron_reader.PROJECT_REF:PASSWORD@aws-0-REGION.pooler.supabase.com:5432/postgres
```

URL-encode passwords with URI-reserved characters. Generated hexadecimal passwords need no special escaping.
Paste this string into UnifiedCron. If required, download the project's CA certificate from Database Settings
and paste its PEM contents into the optional certificate field. TLS and certificate/hostname verification are
always required; `sslmode=disable` and verification bypasses are not supported.

UnifiedCron checks role flags/memberships, metadata reads, inability to read `cron.job.command`, and accessible
write/security-definer grants. It refuses broad credentials or dangerous existing PUBLIC privileges.
Existing PUBLIC grants belong to the project: review them deliberately rather than revoking unrelated privileges blindly.
Passwords remain encrypted at rest and are not returned by connection list/detail APIs.

Cloud hosts are restricted to `db.*.supabase.co` and `*.pooler.supabase.com`, with DNS checked and pinned to prevent
private-network access. Trusted self-host installations can opt into custom hosts and private addresses using
`SUPABASE_ALLOW_CUSTOM_HOSTS=true` and `SUPABASE_ALLOW_PRIVATE_NETWORK=true`. TLS verification remains mandatory.
Never enable these exceptions on a public hosted instance without considering access to its internal services.

## 4. Verify discovery and freshness

Use Test to validate access and Discover jobs to refresh immediately. Worker discovery and cursor-based ingestion
also run automatically, normally once per minute. Credentials/grants can be revoked; errors and retry backoff
are shown per connection. Removing a job archives its identity while retaining cached history.

Initial backfill is bounded to recent history (seven days or at most 10,000 rows); subsequent polling pages
forward by runid and refreshes unfinished runs. Purge gaps are visible rather than presented as complete history.
Busy connections can remain in catch-up mode across cycles. A reset in upstream run IDs requires operator review.

## Troubleshooting

### Hosted projects with pg_net

The direct reader integration is currently incompatible with hosted projects whose managed `pg_net`
grants give every login role write access to `net.http_request_queue` and `net._http_response`.
The strict permission validator rejects this access deliberately. Hosted SQL Editor's `postgres` role
cannot revoke grants owned by `supabase_admin`; statements may appear successful while doing nothing.
Do not disable validation or repeatedly revoke the reader's direct grants: PUBLIC privileges still apply.
Use the signed-push method above instead. The reader permission check remains strict.
Do not drop `pg_net` as a quick fix: that removes queued requests/responses and stops Database Webhooks
and cron jobs depending on its HTTP functions. That requires a separate dependency review and approval.
See [Supabase's managed pg_net permission limitation](https://supabase.com/docs/guides/troubleshooting/revoking-access-to-pg_net-objects-has-no-effect-0bbc16).

- Permission denied on `unifiedcron`: run the private reader setup in the correct project.
- Reader can access commands / broad privileges: check cron schema usage, role memberships and existing PUBLIC grants.
- Empty discovery despite known jobs: confirm the view owner can see those jobs under pg_cron RLS.
- Certificate failure: use the project's CA certificate and the correct database/pooler hostname.
- Private address blocked: use the cloud pooler; enable custom/private exceptions only on a trusted self-host deployment.
- Legacy warning: revoke the old public interfaces and update the same connection with reader credentials.

References: [Supabase connection methods](https://supabase.com/docs/guides/database/connecting-to-postgres),
[verified TLS](https://supabase.com/docs/guides/platform/ssl-enforcement), and
[pg_cron RLS](https://github.com/citusdata/pg_cron).
