# Webhook Notifications

Open **Notifications** in the dashboard to create, edit, pause, test, or delete a webhook.
Save the signing secret when creating the endpoint. It is shown once; list responses never expose it.
To rotate it, edit the endpoint and provide a new secret of 16-255 characters, then update your receiver.
New and legacy webhook secrets are encrypted at rest using the existing `ENCRYPTION_KEY`.
Keep that key unchanged during upgrades.

## Events and Verification

An active endpoint receives `alert.failure` events for failed runs owned by the endpoint's user.
Endpoints created after a failure do not receive that historical event.
The **Send test** action queues a `webhook.test` event through the same durable delivery pipeline.
The API returns HTTP 202 with a delivery ID; check delivery history for the result.

Headers:

- `x-unifiedcron-event`: `alert.failure` or `webhook.test`.
- `x-unifiedcron-delivery-id`: stable across retries. Use this to deduplicate effects.
- `x-unifiedcron-timestamp`: Unix milliseconds, refreshed for every attempt.
- `x-unifiedcron-signature`: lowercase hex HMAC-SHA256 of `timestamp + '.' + rawBody`.

Verify the raw request body before parsing or reserializing it. Reject old timestamps (for example,
more than five minutes) and compare signatures in constant time:

```js
const { createHmac, timingSafeEqual } = require('node:crypto');
function verify(secret, timestamp, signature, rawBody) {
  if (!/^\d+$/.test(timestamp) || Math.abs(Date.now() - Number(timestamp)) > 300000) return false;
  if (!/^[a-f0-9]{64}$/.test(signature)) return false;
  const expected = createHmac('sha256', secret).update(`${timestamp}.${rawBody}`).digest();
  return timingSafeEqual(expected, Buffer.from(signature, 'hex'));
}
```

Failure event payload:

```json
{
  "event": "alert.failure",
  "alertId": "uuid",
  "sourceRunId": "supabase:job-id:start-time",
  "createdAt": "2026-10-10T17:00:00.000Z",
  "job": { "id": "uuid", "name": "nightly-cleanup" },
  "details": { "jobRun": { "status": "failed", "message": "provider error" } }
}
```

Return any HTTP 2xx status to acknowledge. Redirects are not followed. All other responses,
network errors and timeouts count as failures. Response bodies stored in history are capped at 4 KiB.
Each request and DNS phase is bounded by ten seconds.

## Retries and Recovery

The worker checks deliveries every 15 seconds independently of five-minute Supabase monitoring.
Retry delays after failed attempts are **1, 5, 15, 30, and 60 minutes**, measured from completion
of the previous failed attempt. After the sixth unsuccessful attempt the delivery is terminally `failed`.
Polling can add approximately 15 seconds under normal load; a backlog may add more.

Database leases and row locks prevent concurrent workers from claiming the same delivery.
Each attempt has start/end time, outcome, HTTP status, capped response text and error details.
A crashed worker's lease expires after 120 seconds; recovery records the unknown outcome as a failed attempt
and follows the retry policy. Delivery is **at least once**, so receivers must deduplicate using delivery ID.
An outbox reconciliation step repairs a crash between alert creation and notification enqueueing.

Pause retains queued deliveries; resume allows the backlog to continue. Delete removes the endpoint
and its delivery/attempt history. Failed events remain visible until endpoint deletion or parent alert retention cleanup.
Job runs are retained for 30 days; alerts for 90 days, with associated deliveries removed by cascade.

## Destination Policy

HTTP(S) URLs without embedded credentials or fragments are supported; HTTPS is recommended.
Loopback, private, link-local, reserved and IPv4-mapped IPv6 destinations are blocked by default.
All DNS answers are checked and the connection is pinned to a checked address to resist DNS rebinding.
Set `WEBHOOK_ALLOW_PRIVATE_NETWORK=true` in both API and worker only when a trusted self-host installation
requires internal receivers. This opts into access to private destinations; keep it false for hosted deployments.

## API

All routes require the current user's bearer token; client-supplied `userId` is never used.

| Method | Route | Purpose |
| --- | --- | --- |
| GET | `/api/notifications/webhooks` | List own endpoints, without secrets |
| POST | `/api/notifications/webhooks` | Create; return signing secret once |
| PATCH | `/api/notifications/webhooks/:id` | Edit name, URL, active state or secret |
| DELETE | `/api/notifications/webhooks/:id` | Delete endpoint and history |
| POST | `/api/notifications/webhooks/:id/test` | Queue signed test event, HTTP 202 |
| GET | `/api/notifications/deliveries` | Filter by status/endpointId; limit 1-100, offset >= 0 |
| GET | `/api/notifications/deliveries/:id` | Delivery detail and per-attempt history |
| GET | `/api/notifications/metrics` | Per-user delivery status counts |

## Operations and Upgrade

Back up PostgreSQL and the server environment before updating. Build images before cutover.
Run `pnpm db:migrate` against the intended database or execute the new API image's migration runner.
Migration `005_webhook_reliability.sql` is additive: it introduces delivery leases, attempt history,
nullable alert references for test events, and encrypted-secret metadata. API startup converts legacy
plaintext webhook secrets transactionally. Worker readers remain compatible during transition.

Then recreate API/web/worker. Check worker `/health` and `/metrics`, API `/health/database`,
and `/health/metrics`. Worker database failures return HTTP 503; dispatch and monitoring status
are included in the worker snapshot. Worker port is bound to host loopback in Compose.
JSON logs include request IDs, durations, monitoring cycles and delivery IDs/outcomes, excluding signing secrets.

For validation use `pnpm test` for real transport/security tests. Set `TEST_DATABASE_URL` to an isolated
database whose name ends in `_test`, then run `pnpm test:integration`. The suite migrates twice and checks
ownership, retry schedule, concurrent dispatch, crashed leases, outbox repair and encryption compatibility.
Never point the integration suite or compose smoke script at production.

Rollback to saved API/web/worker images after preserving new data. Additive schema changes can remain.
Do not restore a pre-upgrade database over new production writes without an explicit recovery decision.
The old webhook worker cannot read encrypted secrets; a rollback must disable its webhook dispatch,
or restore compatible application code rather than blindly resuming the old sender.
