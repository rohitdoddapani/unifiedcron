#!/bin/bash

set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
source "$SCRIPT_DIR/smoke-lib.sh"

COMPOSE_FILE="${COMPOSE_FILE:-docker-compose.selfhost.yml}"
ENV_FILE="${ENV_FILE:-.env.local}"
SMOKE_BUILD="${SMOKE_BUILD:-true}"
KEEP_STACK_RUNNING="${KEEP_STACK_RUNNING:-false}"

if [[ -f "$ENV_FILE" ]]; then
  set -a
  # shellcheck disable=SC1090
  source "$ENV_FILE"
  set +a
fi

export POSTGRES_USER="${POSTGRES_USER:-unifiedcron}"
export POSTGRES_PASSWORD="${POSTGRES_PASSWORD:-unifiedcron}"
export POSTGRES_DB="${POSTGRES_DB:-unifiedcron}"
export POSTGRES_PORT="${POSTGRES_PORT:-5434}"
export API_PORT="${API_PORT:-3001}"
export WEB_PORT="${WEB_PORT:-3000}"
export WORKER_PORT="${WORKER_PORT:-3003}"
export NEXTAUTH_URL="${NEXTAUTH_URL:-http://localhost:${WEB_PORT}}"
export NEXT_PUBLIC_API_URL="${NEXT_PUBLIC_API_URL:-http://localhost:${API_PORT}}"
export JWT_SECRET="${JWT_SECRET:-smoke-jwt-secret}"
export NEXTAUTH_SECRET="${NEXTAUTH_SECRET:-smoke-nextauth-secret}"
export ENCRYPTION_KEY="${ENCRYPTION_KEY:-smoke-encryption-key}"

COMPOSE_ARGS=(-f "$COMPOSE_FILE")
if [[ -f "$ENV_FILE" ]]; then
  COMPOSE_ARGS=(--env-file "$ENV_FILE" "${COMPOSE_ARGS[@]}")
fi

compose() {
  docker compose "${COMPOSE_ARGS[@]}" "$@"
}

cleanup() {
  if [[ "$KEEP_STACK_RUNNING" != "true" ]]; then
    echo "Cleaning up compose stack..."
    compose down --remove-orphans >/dev/null 2>&1 || true
  fi
}
trap cleanup EXIT

wait_for_endpoint() {
  local name="$1"
  local url="$2"
  local timeout_seconds="${3:-180}"
  local elapsed=0

  while (( elapsed < timeout_seconds )); do
    if curl -fsS "$url" >/dev/null 2>&1; then
      echo "PASS ${name}: ${url}"
      return 0
    fi
    sleep 3
    elapsed=$((elapsed + 3))
  done

  echo "FAIL ${name}: ${url} (timeout after ${timeout_seconds}s)"
  return 1
}

wait_for_compose_health() {
  local service="$1"
  local timeout_seconds="${2:-180}"
  local elapsed=0

  while (( elapsed < timeout_seconds )); do
    if compose_service_is_healthy "$service"; then
      echo "PASS ${service}-container-health"
      return 0
    fi
    sleep 3
    elapsed=$((elapsed + 3))
  done

  echo "FAIL ${service} container did not become healthy after ${timeout_seconds}s"
  compose ps "$service" || true
  return 1
}

echo "Starting compose stack (${COMPOSE_FILE})..."
if [[ "$SMOKE_BUILD" == "true" ]]; then
  compose up -d --build db
else
  compose up -d db
fi

wait_for_compose_health "db" 120

export DATABASE_URL="postgres://${POSTGRES_USER}:${POSTGRES_PASSWORD}@localhost:${POSTGRES_PORT}/${POSTGRES_DB}"
echo "Running migrations with DATABASE_URL=${DATABASE_URL}"
pnpm db:migrate

if [[ "$SMOKE_BUILD" == "true" ]]; then
  compose up -d --build api worker web
else
  compose up -d api worker web
fi

wait_for_endpoint "api-health" "http://localhost:${API_PORT}/health" 240
wait_for_endpoint "db-health" "http://localhost:${API_PORT}/health/database" 240
wait_for_endpoint "worker-health" "http://localhost:${WORKER_PORT}/health" 240
wait_for_endpoint "web-health" "http://localhost:${WEB_PORT}" 300

wait_for_endpoint "db-health-post-migrate" "http://localhost:${API_PORT}/health/database" 120

WEB_TMP="$(mktemp)"
WEB_STATUS="$(curl -sS -o "$WEB_TMP" -w "%{http_code}" "http://localhost:${WEB_PORT}")"
echo "CHECK web-http-status=${WEB_STATUS}"
if [[ "$WEB_STATUS" != "200" ]]; then
  echo "FAIL web status expected 200"
  exit 1
fi

WEB_TITLE="$(node -e "const fs=require('fs'); const html=fs.readFileSync(process.argv[1],'utf8'); process.stdout.write((html.match(/<title>[^<]+<\/title>/)||[''])[0]);" "$WEB_TMP")"
echo "CHECK web-title=${WEB_TITLE}"

NEXTAUTH_TMP="$(mktemp)"
NEXTAUTH_STATUS="$(curl -sS -o "$NEXTAUTH_TMP" -w "%{http_code}" "http://localhost:${WEB_PORT}/api/auth/session")"
echo "CHECK nextauth-session-status=${NEXTAUTH_STATUS}"
if [[ "$NEXTAUTH_STATUS" != "200" ]]; then
  echo "FAIL /api/auth/session returned ${NEXTAUTH_STATUS}"
  cat "$NEXTAUTH_TMP"
  exit 1
fi

EMAIL="smoke.$(date +%s)@example.com"
REGISTER_PAYLOAD="{\"email\":\"${EMAIL}\",\"password\":\"SmokePass123!\",\"name\":\"Smoke User\"}"
REGISTER_TMP="$(mktemp)"
REGISTER_STATUS="$(curl -sS -o "$REGISTER_TMP" -w "%{http_code}" -X POST "http://localhost:${API_PORT}/api/auth/register" -H 'Content-Type: application/json' -d "$REGISTER_PAYLOAD")"
echo "CHECK register-status=${REGISTER_STATUS}"
if [[ "$REGISTER_STATUS" != "200" ]]; then
  echo "FAIL register endpoint returned ${REGISTER_STATUS}"
  cat "$REGISTER_TMP"
  exit 1
fi

TOKEN="$(node -e "const fs=require('fs'); const j=JSON.parse(fs.readFileSync(process.argv[1],'utf8')); process.stdout.write((j && j.data && j.data.token) || '');" "$REGISTER_TMP")"
if [[ -z "$TOKEN" ]]; then
  echo "FAIL register response missing token"
  cat "$REGISTER_TMP"
  exit 1
fi
echo "PASS auth-register-token"

ME_TMP="$(mktemp)"
ME_STATUS="$(curl -sS -o "$ME_TMP" -w "%{http_code}" "http://localhost:${API_PORT}/api/users/me" -H "Authorization: Bearer ${TOKEN}")"
echo "CHECK users-me-status=${ME_STATUS}"
if [[ "$ME_STATUS" != "200" ]]; then
  echo "FAIL /api/users/me returned ${ME_STATUS}"
  cat "$ME_TMP"
  exit 1
fi

WEBHOOKS_TMP="$(mktemp)"
WEBHOOKS_STATUS="$(curl -sS -o "$WEBHOOKS_TMP" -w "%{http_code}" "http://localhost:${API_PORT}/api/notifications/webhooks" -H "Authorization: Bearer ${TOKEN}")"
echo "CHECK webhooks-status=${WEBHOOKS_STATUS}"
if [[ "$WEBHOOKS_STATUS" != "200" ]]; then
  echo "FAIL /api/notifications/webhooks returned ${WEBHOOKS_STATUS}"
  cat "$WEBHOOKS_TMP"
  exit 1
fi

USER_ID="$(node -e "const fs=require('fs'); const j=JSON.parse(fs.readFileSync(process.argv[1],'utf8')); process.stdout.write((j && j.data && j.data.id) || '');" "$ME_TMP")"
if [[ -z "$USER_ID" ]]; then
  echo "FAIL /api/users/me response missing user id"
  cat "$ME_TMP"
  exit 1
fi

CONN_TMP="$(mktemp)"
CONN_STATUS="$(curl -sS -o "$CONN_TMP" -w "%{http_code}" -X POST "http://localhost:${API_PORT}/api/connections" -H 'Content-Type: application/json' -H "Authorization: Bearer ${TOKEN}" -d '{"platform":"supabase","label":"smoke-alert-lifecycle","config":{"projectUrl":"https://example.supabase.co","anonKey":"anon"}}')"
echo "CHECK connection-create-status=${CONN_STATUS}"
if [[ "$CONN_STATUS" != "201" ]]; then
  echo "FAIL /api/connections create returned ${CONN_STATUS}"
  cat "$CONN_TMP"
  exit 1
fi

CONNECTION_ID="$(node -e "const fs=require('fs'); const j=JSON.parse(fs.readFileSync(process.argv[1],'utf8')); process.stdout.write((j && j.data && j.data.id) || '');" "$CONN_TMP")"
if [[ -z "$CONNECTION_ID" ]]; then
  echo "FAIL /api/connections response missing id"
  cat "$CONN_TMP"
  exit 1
fi

JOB_ID="$(node -e "console.log(require('crypto').randomUUID())")"
ALERT_ID="$(node -e "console.log(require('crypto').randomUUID())")"
SOURCE_RUN_ID="smoke-lifecycle-$(date +%s)"

compose exec -T db psql -U "$POSTGRES_USER" -d "$POSTGRES_DB" \
  -v job_id="$JOB_ID" \
  -v connection_id="$CONNECTION_ID" \
  -v alert_id="$ALERT_ID" \
  -v source_run_id="$SOURCE_RUN_ID" \
  <<'SQL'
INSERT INTO jobs (id, "connectionId", "originId", name, cron, platform, project, metadata)
VALUES (:'job_id', :'connection_id', 'smoke-alert-lifecycle-job', 'smoke-alert-lifecycle-job', '* * * * *', 'supabase', 'smoke-project', '{}')
ON CONFLICT (id) DO NOTHING;

INSERT INTO alerts (id, "jobId", type, "sourceRunId", status, details)
VALUES (:'alert_id', :'job_id', 'failure', :'source_run_id', 'open', '{"jobRun":{"message":"smoke failure","sourceRunId":"smoke-seeded"}}')
ON CONFLICT (id) DO NOTHING;
SQL

OPEN_ALERTS_TMP="$(mktemp)"
OPEN_ALERTS_STATUS="$(curl -sS -o "$OPEN_ALERTS_TMP" -w "%{http_code}" "http://localhost:${API_PORT}/api/alerts?status=open" -H "Authorization: Bearer ${TOKEN}")"
echo "CHECK alerts-open-status=${OPEN_ALERTS_STATUS}"
if [[ "$OPEN_ALERTS_STATUS" != "200" ]]; then
  echo "FAIL /api/alerts?status=open returned ${OPEN_ALERTS_STATUS}"
  cat "$OPEN_ALERTS_TMP"
  exit 1
fi

node -e "const fs=require('fs'); const p=process.argv[1]; const id=process.argv[2]; const j=JSON.parse(fs.readFileSync(p,'utf8')); const list=(j&&j.data)||[]; if(!Array.isArray(list)||!list.some(a=>a.id===id&&a.status==='open')){console.error('FAIL alert not present in open filter'); process.exit(1);} console.log('PASS alerts-open-filter');" "$OPEN_ALERTS_TMP" "$ALERT_ID"

RESOLVE_TMP="$(mktemp)"
RESOLVE_REASON="smoke manual resolution"
RESOLVE_STATUS="$(curl -sS -o "$RESOLVE_TMP" -w "%{http_code}" -X PATCH "http://localhost:${API_PORT}/api/alerts/${ALERT_ID}/resolve" -H 'Content-Type: application/json' -H "Authorization: Bearer ${TOKEN}" -d "{\"reason\":\"${RESOLVE_REASON}\"}")"
echo "CHECK alert-resolve-status=${RESOLVE_STATUS}"
if [[ "$RESOLVE_STATUS" != "200" ]]; then
  echo "FAIL /api/alerts/:id/resolve returned ${RESOLVE_STATUS}"
  cat "$RESOLVE_TMP"
  exit 1
fi

node -e "const fs=require('fs'); const expected=process.argv[2]; const j=JSON.parse(fs.readFileSync(process.argv[1],'utf8')); const a=j&&j.data; const resolution=a&&a.details&&a.details.resolution; if(!a||a.status!=='resolved'||!a.resolvedAt){console.error('FAIL resolve response missing resolved lifecycle fields'); process.exit(1);} if(!resolution||resolution.source!=='manual'){console.error('FAIL resolve response missing manual resolution source'); process.exit(1);} if(!resolution.reason||resolution.reason!==expected){console.error('FAIL resolve response missing manual resolution reason'); process.exit(1);} console.log('PASS alerts-resolve-response');" "$RESOLVE_TMP" "$RESOLVE_REASON"

OPEN_AFTER_TMP="$(mktemp)"
OPEN_AFTER_STATUS="$(curl -sS -o "$OPEN_AFTER_TMP" -w "%{http_code}" "http://localhost:${API_PORT}/api/alerts?status=open" -H "Authorization: Bearer ${TOKEN}")"
echo "CHECK alerts-open-after-resolve-status=${OPEN_AFTER_STATUS}"
if [[ "$OPEN_AFTER_STATUS" != "200" ]]; then
  echo "FAIL /api/alerts?status=open (after resolve) returned ${OPEN_AFTER_STATUS}"
  cat "$OPEN_AFTER_TMP"
  exit 1
fi
node -e "const fs=require('fs'); const id=process.argv[2]; const j=JSON.parse(fs.readFileSync(process.argv[1],'utf8')); const list=(j&&j.data)||[]; if(Array.isArray(list)&&list.some(a=>a.id===id)){console.error('FAIL resolved alert still present in open filter'); process.exit(1);} console.log('PASS alerts-open-after-resolve');" "$OPEN_AFTER_TMP" "$ALERT_ID"

RESOLVED_TMP="$(mktemp)"
RESOLVED_STATUS="$(curl -sS -o "$RESOLVED_TMP" -w "%{http_code}" "http://localhost:${API_PORT}/api/alerts?status=resolved" -H "Authorization: Bearer ${TOKEN}")"
echo "CHECK alerts-resolved-status=${RESOLVED_STATUS}"
if [[ "$RESOLVED_STATUS" != "200" ]]; then
  echo "FAIL /api/alerts?status=resolved returned ${RESOLVED_STATUS}"
  cat "$RESOLVED_TMP"
  exit 1
fi
node -e "const fs=require('fs'); const id=process.argv[2]; const j=JSON.parse(fs.readFileSync(process.argv[1],'utf8')); const list=(j&&j.data)||[]; if(!Array.isArray(list)||!list.some(a=>a.id===id&&a.status==='resolved')){console.error('FAIL resolved alert missing from resolved filter'); process.exit(1);} console.log('PASS alerts-resolved-filter');" "$RESOLVED_TMP" "$ALERT_ID"

AUTO_ALERT_ID="$(node -e "console.log(require('crypto').randomUUID())")"
AUTO_SOURCE_RUN_ID="smoke-auto-success-$(date +%s)"

compose exec -T db psql -U "$POSTGRES_USER" -d "$POSTGRES_DB" \
  -v alert_id="$AUTO_ALERT_ID" \
  -v job_id="$JOB_ID" \
  -v source_run_id="$AUTO_SOURCE_RUN_ID" \
  <<'SQL'
INSERT INTO alerts (id, "jobId", type, "sourceRunId", status, details)
VALUES (:'alert_id', :'job_id', 'failure', :'source_run_id', 'open', '{"jobRun":{"message":"smoke auto success pending","sourceRunId":"smoke-auto-seeded"}}')
ON CONFLICT (id) DO NOTHING;
SQL

AUTO_RESOLVE_REASON="smoke auto-success resolution"
pnpm --filter worker exec ts-node -e "const { AlertService } = require('./src/services/AlertService'); (async () => { const svc = new AlertService(); const count = await svc.resolveOpenAlertsForJob(process.argv[1], { sourceRunId: process.argv[2], reason: process.argv[3] }); if (count < 1) { throw new Error('no open alerts resolved'); } console.log('PASS worker-auto-resolve'); })().catch((err) => { console.error(err); process.exit(1); });" "$JOB_ID" "$AUTO_SOURCE_RUN_ID" "$AUTO_RESOLVE_REASON"

RESOLVED_AFTER_AUTO_TMP="$(mktemp)"
RESOLVED_AFTER_AUTO_STATUS="$(curl -sS -o "$RESOLVED_AFTER_AUTO_TMP" -w "%{http_code}" "http://localhost:${API_PORT}/api/alerts?status=resolved" -H "Authorization: Bearer ${TOKEN}")"
echo "CHECK alerts-resolved-after-auto-status=${RESOLVED_AFTER_AUTO_STATUS}"
if [[ "$RESOLVED_AFTER_AUTO_STATUS" != "200" ]]; then
  echo "FAIL /api/alerts?status=resolved returned ${RESOLVED_AFTER_AUTO_STATUS} after worker auto resolve"
  cat "$RESOLVED_AFTER_AUTO_TMP"
  exit 1
fi

node -e "const fs=require('fs'); const id=process.argv[2]; const expectedReason=process.argv[3]; const expectedRun=process.argv[4]; const j=JSON.parse(fs.readFileSync(process.argv[1],'utf8')); const list=(j&&j.data)||[]; const target=Array.isArray(list)?list.find(a=>a.id===id):null; if(!target){console.error('FAIL auto-resolved alert missing from resolved filter'); process.exit(1);} const resolution=target.details&&target.details.resolution; if(!resolution||resolution.source!=='auto_success'){console.error('FAIL auto-resolved alert missing auto_success source'); process.exit(1);} if(resolution.reason!==expectedReason){console.error('FAIL auto-resolved alert reason mismatch'); process.exit(1);} if(resolution.sourceRunId!==expectedRun){console.error('FAIL auto-resolved alert sourceRunId mismatch'); process.exit(1);} console.log('PASS worker-auto-resolve-metadata');" "$RESOLVED_AFTER_AUTO_TMP" "$AUTO_ALERT_ID" "$AUTO_RESOLVE_REASON" "$AUTO_SOURCE_RUN_ID"

INVALID_ALERTS_STATUS="$(curl -sS -o /tmp/smoke_alerts_invalid_status.json -w "%{http_code}" "http://localhost:${API_PORT}/api/alerts?status=invalid" -H "Authorization: Bearer ${TOKEN}")"
echo "CHECK alerts-invalid-status-http=${INVALID_ALERTS_STATUS}"
if [[ "$INVALID_ALERTS_STATUS" != "400" ]]; then
  echo "FAIL /api/alerts accepted invalid status filter"
  cat /tmp/smoke_alerts_invalid_status.json
  exit 1
fi

echo "PASS compose-smoke"
echo "COMPOSE_SMOKE_OK"
