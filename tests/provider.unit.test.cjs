const { test } = require('node:test');
const assert = require('node:assert/strict');
const { isValidCronExpression, getNextRunTime } = require('../packages/shared/dist');
const { parseVercelJson } = require('../packages/integrations/dist/vercel');
const { postgresClientConfig, isAllowedSupabaseHost, supabaseProjectIdentity } = require('../packages/integrations/dist/supabase');

test('cron steps, ranges, seconds intervals and timezone-aware next times are real', () => {
  for (const expression of ['*/5 * * * *','0 9 * * 1-5','0 */2 * * *','30 seconds','@daily']) assert.equal(isValidCronExpression(expression),true,expression);
  for (const expression of ['60 seconds','0 99 * * *','* * * *','not cron']) assert.equal(isValidCronExpression(expression),false,expression);
  assert.equal(getNextRunTime('*/5 * * * *',{currentDate:new Date('2026-10-10T00:01:00Z')}).toISOString(),'2026-10-10T00:05:00.000Z');
  assert.equal(getNextRunTime('0 9 * * 1-5',{currentDate:new Date('2026-10-09T15:00:00Z'),timezone:'America/Chicago'}).toISOString(),'2026-10-12T14:00:00.000Z');
  assert.equal(getNextRunTime('30 seconds',{currentDate:new Date('2026-10-10T00:00:00Z')}).toISOString(),'2026-10-10T00:00:30.000Z');
});

test('Vercel parser uses the documented crons array and does not invent function schedules', () => {
  assert.deepEqual(parseVercelJson('{"functions":{"api/test.js":{"schedule":"* * * * *"}}}'),[]);
  const jobs=parseVercelJson('{"crons":[{"path":"/api/daily","schedule":"0 1 * * *"},{"path":4,"schedule":"bad"}]}');
  assert.equal(jobs.length,1);assert.equal(jobs[0].name,'/api/daily');assert.equal(jobs[0].cron,'0 1 * * *');
});

test('Supabase rejects legacy credentials, custom hosts, private IPs and TLS disabling', async () => {
  assert.equal(isAllowedSupabaseHost('db.project.supabase.co'),true);
  assert.equal(isAllowedSupabaseHost('aws-0-us-east-1.pooler.supabase.com'),true);
  assert.equal(isAllowedSupabaseHost('db.project.supabase.co.attacker.test'),false);
  await assert.rejects(postgresClientConfig({projectUrl:'https://example.supabase.co',anonKey:'public'}),/Legacy/);
  await assert.rejects(postgresClientConfig({mode:'postgres',connectionString:'postgres://reader:pass@127.0.0.1/db'}),/Only Supabase/);
  await assert.rejects(postgresClientConfig({mode:'postgres',connectionString:'postgres://reader:pass@db.project.supabase.co/postgres?sslmode=disable'}),/TLS/);
});

test('project identity survives role/password and pooler/direct endpoint changes', () => {
  const legacy = supabaseProjectIdentity({projectUrl:'https://example.supabase.co',anonKey:'public'});
  const direct = supabaseProjectIdentity({mode:'postgres',connectionString:'postgres://reader:secret@db.example.supabase.co/postgres'});
  const pooler = supabaseProjectIdentity({mode:'postgres',connectionString:'postgres://reader.example:new-secret@aws-0-us-east-1.pooler.supabase.com:5432/postgres'});
  assert.equal(legacy,direct);assert.equal(pooler,direct);
  assert.notEqual(pooler,supabaseProjectIdentity({mode:'postgres',connectionString:'postgres://reader.other:secret@aws-0-us-east-1.pooler.supabase.com:5432/postgres'}));
});
