# Secure Supabase Connection Setup

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

- Permission denied on `unifiedcron`: run the private reader setup in the correct project.
- Reader can access commands / broad privileges: check cron schema usage, role memberships and existing PUBLIC grants.
- Empty discovery despite known jobs: confirm the view owner can see those jobs under pg_cron RLS.
- Certificate failure: use the project's CA certificate and the correct database/pooler hostname.
- Private address blocked: use the cloud pooler; enable custom/private exceptions only on a trusted self-host deployment.
- Legacy warning: revoke the old public interfaces and update the same connection with reader credentials.

References: [Supabase connection methods](https://supabase.com/docs/guides/database/connecting-to-postgres),
[verified TLS](https://supabase.com/docs/guides/platform/ssl-enforcement), and
[pg_cron RLS](https://github.com/citusdata/pg_cron).
