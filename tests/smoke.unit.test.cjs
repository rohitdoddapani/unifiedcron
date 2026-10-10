const { test } = require('node:test');
const assert = require('node:assert/strict');
const { spawnSync } = require('node:child_process');
const path = require('node:path');

function check(env) {
  return spawnSync('bash', ['-c', `
    source "$1"
    compose() { printf '%s' "$CONTAINER_ID"; }
    docker() { if [[ "$INSPECT_ERROR" == true ]]; then return 1; fi; printf '%s' "$HEALTH_STATUS"; }
    compose_service_is_healthy db
  `, 'smoke-check', path.resolve(__dirname, '../scripts/smoke-lib.sh')], {
    env: { ...process.env, CONTAINER_ID: 'test-db', INSPECT_ERROR: 'false', ...env }, encoding: 'utf8',
  });
}

test('compose health check accepts only the exact Docker healthy status without ripgrep', () => {
  assert.equal(check({ HEALTH_STATUS: 'healthy' }).status, 0);
  for (const status of ['unhealthy', 'starting', '', 'exited']) {
    assert.equal(check({ HEALTH_STATUS: status }).status, 1, status);
  }
  assert.equal(check({ CONTAINER_ID: '', HEALTH_STATUS: 'healthy' }).status, 1);
  assert.equal(check({ INSPECT_ERROR: 'true', HEALTH_STATUS: 'healthy' }).status, 1);
});
