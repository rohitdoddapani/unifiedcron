const {test,before,after}=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const {randomBytes,randomUUID}=require('node:crypto');
assert.ok(process.env.TEST_DATABASE_URL && new URL(process.env.TEST_DATABASE_URL).pathname.endsWith('_test'));
assert.ok(process.env.TEST_CA_CERTIFICATE,'Verified TLS test CA is required');
process.env.DATABASE_URL=process.env.TEST_DATABASE_URL;
process.env.NODE_ENV='production';process.env.ENCRYPTION_KEY='ingestion-test-key';process.env.JWT_SECRET='ingestion-test-jwt';
process.env.SUPABASE_ALLOW_CUSTOM_HOSTS='true';process.env.SUPABASE_ALLOW_PRIVATE_NETWORK='true';
const {query,migrate,closePool}=require('../packages/database/dist');
const {openSupabaseSource,postgresClientConfig}=require('../packages/integrations/dist');
const {supabaseSetupSql}=require('../packages/integrations/dist/supabase-setup');
const {Client}=require('../packages/integrations/node_modules/pg');
const {ConnectionService}=require('../apps/api/dist/services/ConnectionService');
const {JobService}=require('../apps/api/dist/services/JobService');
const {SupabaseIngestionService}=require('../apps/worker/dist/services/SupabaseIngestionService');
const {NotificationService}=require('../apps/worker/dist/services/NotificationService');
let owner,connection,config;
const ingestion=new SupabaseIngestionService();
const advance=()=>query('UPDATE ingestion_state SET "nextPollAt"=NOW() WHERE "connectionId"=$1',[connection.id]);
async function sync(){await advance();return ingestion.sync(connection);}

before(async()=>{
 await migrate();await migrate();
 await query(`CREATE SCHEMA cron;
  CREATE TABLE cron.job(jobid bigint PRIMARY KEY,jobname text,schedule text,command text,active boolean,username text);
  CREATE TABLE cron.job_run_details(runid bigint PRIMARY KEY,jobid bigint,status text,start_time timestamptz,end_time timestamptz,return_message text,username text);
  ALTER TABLE cron.job ENABLE ROW LEVEL SECURITY;CREATE POLICY job_owner ON cron.job USING(username=current_user);
  ALTER TABLE cron.job_run_details ENABLE ROW LEVEL SECURITY;CREATE POLICY run_owner ON cron.job_run_details USING(username=current_user);
  GRANT SELECT ON cron.job TO PUBLIC;
  CREATE ROLE anon;
  INSERT INTO cron.job VALUES(7,'original','* * * * *','SECRET COMMAND',true,'different-owner');`);
 const password=randomBytes(32).toString('hex');await query(supabaseSetupSql(password));
 const url=new URL(process.env.TEST_DATABASE_URL);url.username='unifiedcron_reader';url.password=password;
 config={mode:'postgres',connectionString:url.toString(),caCertificate:fs.readFileSync(process.env.TEST_CA_CERTIFICATE,'utf8')};
 owner=(await query('INSERT INTO users(email) VALUES($1) RETURNING id',[`${randomUUID()}@example.com`])).rows[0].id;
 connection=await new ConnectionService().createConnection({userId:owner,platform:'supabase',label:'Ingestion fixture',config});
});
after(async()=>{
 if(owner)await query('DELETE FROM users WHERE id=$1',[owner]);
 await query('DROP SCHEMA IF EXISTS unifiedcron CASCADE; DROP SCHEMA IF EXISTS cron CASCADE; DROP ROLE IF EXISTS unifiedcron_reader; REVOKE ALL ON SCHEMA public FROM anon; DROP ROLE IF EXISTS anon;');
 await closePool();
});

test('verified TLS and private column grants expose metadata across cron RLS without commands or writes',async()=>{
 const source=await openSupabaseSource(config);
 try {const jobs=await source.discover();assert.equal(jobs.length,1);assert.equal(jobs[0].metadata.jobId,'7');assert.equal(jobs[0].metadata.command,undefined);}
 finally {await source.close();}
 await assert.rejects(openSupabaseSource({...config,caCertificate:undefined}),/self-signed|certificate/);
 const client=new Client(await postgresClientConfig(config));await client.connect();
 try {
  await assert.rejects(client.query('SELECT command FROM cron.job LIMIT 0'),error=>error.code==='42501');
  await client.query('SET default_transaction_read_only=off');
  await assert.rejects(client.query("UPDATE unifiedcron.jobs SET active=false"),error=>error.code==='42501');
  await assert.rejects(client.query('SET ROLE anon'),error=>error.code==='42501');
 }finally{await client.end();}
 const privileged={...config,connectionString:process.env.TEST_DATABASE_URL};
 await assert.rejects(openSupabaseSource(privileged),/dedicated reader/);
 await query('GRANT UPDATE ON unifiedcron.jobs TO unifiedcron_reader');
 await assert.rejects(openSupabaseSource(config),/additional write/);
 await query('REVOKE UPDATE ON unifiedcron.jobs FROM unifiedcron_reader');
 await query("CREATE FUNCTION public.unsafe_reader_test() RETURNS integer LANGUAGE sql SECURITY DEFINER AS 'SELECT 1'");
 await assert.rejects(openSupabaseSource(config),/security-definer/);
 await query('DROP FUNCTION public.unsafe_reader_test()');
});

test('connection API verifies the reader, hides credentials and rejects legacy or cross-user changes',async()=>{
 const express=require('../apps/api/node_modules/express');
 const jwt=require('../apps/api/node_modules/jsonwebtoken');
 const {authenticate}=require('../apps/api/dist/middleware/auth');
 const {connectionsRouter}=require('../apps/api/dist/routes/connections');
 const {errorHandler}=require('../apps/api/dist/middleware/errorHandler');
 const app=express();app.use(express.json());app.use('/api/connections',authenticate,connectionsRouter);app.use(errorHandler);
 const server=app.listen(0,'127.0.0.1');await require('node:events').once(server,'listening');
 const base='http://127.0.0.1:'+server.address().port;
 async function request(path,method='GET',body,user=owner){const response=await fetch(base+path,{method,headers:{'Content-Type':'application/json',Authorization:'Bearer '+jwt.sign({userId:user},process.env.JWT_SECRET)},...(body?{body:JSON.stringify(body)}:{})});return {status:response.status,body:await response.json()};}
 try{
  assert.equal((await request('/api/connections','POST',{platform:'supabase',label:'Unsafe',config:{projectUrl:'https://example.supabase.co',anonKey:'public'}})).status,400);
  const created=await request('/api/connections','POST',{platform:'supabase',label:'Verified',config});
  assert.equal(created.status,201);assert.equal(created.body.data.config.connectionString,undefined);assert.equal(created.body.data.config.caCertificate,undefined);
  const detail=await request('/api/connections/'+created.body.data.id);assert.equal(detail.status,200);
  assert.equal(detail.body.data.config.connectionString,undefined);
  assert.equal((await request('/api/connections/'+created.body.data.id,'GET',undefined,randomUUID())).status,404);
  assert.equal((await request('/api/connections/'+created.body.data.id,'PUT',{config},randomUUID())).status,404);
  await request('/api/connections/'+created.body.data.id,'DELETE');
 }finally{server.closeAllConnections();await new Promise(resolve=>server.close(resolve));}
});

test('more than 1000 runs are paged, initial history is bounded, and rename/deletion keep identity and history',async()=>{
 await query(`INSERT INTO cron.job_run_details SELECT n,7,'succeeded',NOW()-INTERVAL '2 days'+n*INTERVAL '1 second',NOW(),NULL,'different-owner' FROM generate_series(1,1105) n`);
 await sync();
 const job=(await query('SELECT * FROM jobs WHERE "connectionId"=$1',[connection.id])).rows[0];
 assert.equal(job.originId,'7');assert.equal(Number((await query('SELECT count(*) FROM "jobRuns" WHERE "jobId"=$1',[job.id])).rows[0].count),1105);
 assert.equal((await query('SELECT cursor FROM ingestion_state WHERE "connectionId"=$1',[connection.id])).rows[0].cursor.lastRunId,'1105');
 await query("UPDATE cron.job SET jobname='renamed' WHERE jobid=7");await sync();
 assert.equal((await query('SELECT id,name FROM jobs WHERE "connectionId"=$1',[connection.id])).rows[0].id,job.id);
 assert.equal((await query('SELECT name FROM jobs WHERE id=$1',[job.id])).rows[0].name,'renamed');
 await query('DELETE FROM cron.job WHERE jobid=7');await sync();
 assert.ok((await query('SELECT "removedAt" FROM jobs WHERE id=$1',[job.id])).rows[0].removedAt);
 assert.equal((await new JobService().getJobRuns(job.id,owner)).length,50);
 await query("INSERT INTO cron.job VALUES(7,NULL,'* * * * *','SECRET COMMAND',true,'different-owner')");await sync();
 assert.equal((await query('SELECT name FROM jobs WHERE id=$1',[job.id])).rows[0].name,'Job 7');
});

test('unfinished statuses update in place; failure storms produce one incident and one open event; recovery ordering is safe',async()=>{
 const job=(await query('SELECT id FROM jobs WHERE "connectionId"=$1',[connection.id])).rows[0];
 const endpoint=(await query('INSERT INTO notification_endpoints("userId",name,url,secret) VALUES($1,\'Fixture\',\'https://example.com/receiver\',\'test-secret\') RETURNING id',[owner])).rows[0];
 await query(`INSERT INTO cron.job_run_details SELECT n,7,'failed',NOW()-INTERVAL '5 minutes'+(n-1106)*INTERVAL '1 second',NOW(),'failure','different-owner' FROM generate_series(1106,1165) n`);
 await sync();await sync();
 let alert=(await query("SELECT * FROM alerts WHERE \"jobId\"=$1 AND status='open'",[job.id])).rows[0];
 assert.equal(alert.details.failureCount,60);
 const notifications=new NotificationService();await notifications.reconcileAlerts();await notifications.reconcileAlerts();
 assert.equal(Number((await query('SELECT count(*) FROM notification_deliveries WHERE "alertId"=$1',[alert.id])).rows[0].count),1);
 await query(`INSERT INTO cron.job_run_details VALUES(1166,7,'starting',NOW(),NULL,NULL,'different-owner')`);await sync();
 assert.equal((await query('SELECT status FROM "jobRuns" WHERE "providerRunId"=\'1166\'')).rows[0].status,'running');
 await query("UPDATE cron.job_run_details SET status='succeeded',end_time=NOW() WHERE runid=1166");await sync();
 alert=(await query('SELECT * FROM alerts WHERE id=$1',[alert.id])).rows[0];assert.equal(alert.status,'resolved');
 await notifications.reconcileAlerts();
 assert.deepEqual((await query('SELECT event FROM notification_deliveries WHERE "alertId"=$1 ORDER BY event',[alert.id])).rows.map(x=>x.event),['alert.failure','alert.resolved']);
 // A late old failure must not reopen the recovered incident.
 await query("INSERT INTO cron.job_run_details VALUES(1167,7,'failed',NOW()-INTERVAL '1 day',NOW(),'late failure','different-owner')");await sync();
 assert.equal(Number((await query("SELECT count(*) FROM alerts WHERE \"jobId\"=$1 AND status='open'",[job.id])).rows[0].count),0);
 assert.equal(Number((await query('SELECT count(*) FROM "jobRuns" WHERE "providerRunId"=\'1166\'')).rows[0].count),1);
 await query('DELETE FROM notification_endpoints WHERE id=$1',[endpoint.id]);
});

test('purge gaps are recorded and page failures roll back both runs and cursor before replay',async()=>{
 await query("DELETE FROM cron.job_run_details; INSERT INTO cron.job_run_details VALUES(1200,7,'succeeded',NOW()+INTERVAL '1 second',NOW(),NULL,'different-owner')");await sync();
 assert.equal(Number((await query('SELECT count(*) FROM ingestion_gaps WHERE "connectionId"=$1',[connection.id])).rows[0].count),1);
 await query("INSERT INTO cron.job_run_details VALUES(1201,7,'failed',NOW()+INTERVAL '2 seconds',NOW(),NULL,'different-owner'),(1202,7,'invalid',NOW()+INTERVAL '3 seconds',NOW(),NULL,'different-owner')");
 await assert.rejects(sync(),/Unknown provider/);
 assert.equal((await query('SELECT cursor FROM ingestion_state WHERE "connectionId"=$1',[connection.id])).rows[0].cursor.lastRunId,'1200');
 assert.equal(Number((await query('SELECT count(*) FROM "jobRuns" WHERE "providerRunId"=\'1201\'')).rows[0].count),0);
 await query("UPDATE cron.job_run_details SET status='failed' WHERE runid=1202");await sync();
 assert.equal((await query('SELECT cursor FROM ingestion_state WHERE "connectionId"=$1',[connection.id])).rows[0].cursor.lastRunId,'1202');
 assert.equal(Number((await query('SELECT count(*) FROM "jobRuns" WHERE "providerRunId"=\'1201\'')).rows[0].count),1);
});

test('legacy public views and default PUBLIC function execution are revoked without deleting jobs',async()=>{
 await query(`CREATE VIEW public.cron_jobs_view AS SELECT * FROM cron.job; GRANT USAGE ON SCHEMA public TO anon;GRANT SELECT ON public.cron_jobs_view TO anon;
 CREATE FUNCTION public.get_latest_job_runs() RETURNS integer LANGUAGE sql SECURITY DEFINER AS 'SELECT 1'; GRANT EXECUTE ON FUNCTION public.get_latest_job_runs() TO anon;`);
 await query(fs.readFileSync(require('node:path').resolve(__dirname,'../docs/supabase-cleanup.sql'),'utf8'));
 assert.equal((await query("SELECT has_table_privilege('anon','public.cron_jobs_view','SELECT') AS access")).rows[0].access,false);
 assert.equal((await query("SELECT has_function_privilege('anon','public.get_latest_job_runs()','EXECUTE') AS access")).rows[0].access,false);
 assert.equal(Number((await query('SELECT count(*) FROM cron.job')).rows[0].count),1);
 await query('DROP VIEW public.cron_jobs_view; DROP FUNCTION public.get_latest_job_runs();');
});
