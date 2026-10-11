export function supabasePushSetupSql(connectionId: string, projectRef: string, key: string, endpoint: string): string {
  if (!/^[a-f0-9-]{36}$/.test(connectionId) || !/^[a-z0-9]{20}$/.test(projectRef) || !/^[a-f0-9]{64}$/.test(key)) throw new Error('Invalid push setup');
  const url = new URL(endpoint);
  if (url.protocol !== 'https:' || url.username || url.password || url.hash || url.search) throw new Error('Push ingestion requires a public HTTPS API URL');
  const literal = (value: string) => "'" + value.replace(/'/g, "''") + "'";
  return `-- Run as postgres in this project's SQL Editor. Do not expose this schema through the Data API.
-- This script contains a signing key. Keep it private. No database password is required.
BEGIN;
DO $$ BEGIN
 IF current_user <> 'postgres' THEN RAISE EXCEPTION 'Run setup as postgres'; END IF;
 IF to_regprocedure('extensions.hmac(bytea,bytea,text)') IS NULL THEN RAISE EXCEPTION 'Enable pgcrypto in the extensions schema first'; END IF;
 IF to_regprocedure('cron.schedule(text,text,text)') IS NULL OR to_regclass('net._http_response') IS NULL THEN RAISE EXCEPTION 'Enable pg_cron and pg_net first'; END IF;
END $$;
CREATE SCHEMA IF NOT EXISTS unifiedcron_push;
REVOKE ALL ON SCHEMA unifiedcron_push FROM PUBLIC;
CREATE TABLE IF NOT EXISTS unifiedcron_push.state (
 id uuid PRIMARY KEY, project_ref text NOT NULL, signing_key text NOT NULL, endpoint text NOT NULL,
 sequence bigint NOT NULL DEFAULT 1, last_run_id bigint, initial_max bigint,
 pending bigint[] NOT NULL DEFAULT '{}', payload jsonb, next_pending bigint[],
 request_id bigint, sent_at timestamptz, cron_job_id bigint
);
REVOKE ALL ON ALL TABLES IN SCHEMA unifiedcron_push FROM PUBLIC;
INSERT INTO unifiedcron_push.state(id,project_ref,signing_key,endpoint)
 VALUES (${literal(connectionId)}::uuid,${literal(projectRef)},${literal(key)},${literal(endpoint)})
 ON CONFLICT (id) DO UPDATE SET signing_key=EXCLUDED.signing_key,endpoint=EXCLUDED.endpoint;
CREATE OR REPLACE FUNCTION unifiedcron_push.send(p_id uuid) RETURNS void
 LANGUAGE plpgsql SECURITY DEFINER SET search_path=pg_catalog AS $send$
DECLARE s unifiedcron_push.state%ROWTYPE; reply text; receipt text; expected text;
 lo bigint; hi bigint; floor_id bigint; next_id bigint; new_runs jsonb; refreshed jsonb;
 job_list jsonb; next_pending bigint[]; payload jsonb; stamp text; signature text; outgoing_id bigint;
BEGIN
 SELECT * INTO STRICT s FROM unifiedcron_push.state WHERE id=p_id FOR UPDATE;
 IF s.payload IS NOT NULL AND s.request_id IS NOT NULL THEN
  SELECT content INTO reply FROM net._http_response WHERE id=s.request_id AND status_code=200;
  IF reply IS NOT NULL THEN
   BEGIN receipt := reply::jsonb->>'receipt'; EXCEPTION WHEN OTHERS THEN receipt := NULL; END;
   expected := encode(extensions.hmac(convert_to('ack.'||s.sequence::text||'.'||encode(extensions.digest(convert_to(s.payload::text,'UTF8'),'sha256'),'hex'),'UTF8'),decode(s.signing_key,'hex'),'sha256'),'hex');
   IF receipt=expected THEN
    s.last_run_id := (s.payload->>'lastRunId')::bigint; s.pending := s.next_pending;
    s.sequence := s.sequence+1; s.payload := NULL; s.request_id := NULL;
   END IF;
  END IF;
 END IF;
 IF s.payload IS NOT NULL AND s.sent_at > clock_timestamp()-interval '2 minutes' THEN RETURN; END IF;
 IF s.payload IS NULL THEN
  SELECT min(runid),max(runid) INTO lo,hi FROM cron.job_run_details
   WHERE jobid NOT IN (SELECT cron_job_id FROM unifiedcron_push.state WHERE cron_job_id IS NOT NULL);
  IF s.last_run_id IS NULL THEN
   SELECT min(runid) INTO floor_id FROM (SELECT runid FROM cron.job_run_details
    WHERE (start_time >= now()-interval '7 days' OR start_time IS NULL)
    AND jobid NOT IN (SELECT cron_job_id FROM unifiedcron_push.state WHERE cron_job_id IS NOT NULL)
    ORDER BY runid DESC LIMIT 10000) recent;
   s.last_run_id := COALESCE(floor_id-1,hi,0); s.initial_max := COALESCE(hi,0);
  END IF;
  IF hi < s.last_run_id THEN RAISE EXCEPTION 'Upstream run IDs reset; operator review required'; END IF;
  SELECT COALESCE(jsonb_agg(jsonb_build_object('jobid',jobid::text,'name',left(COALESCE(jobname,'Job '||jobid::text),512),'schedule',left(schedule,512),'active',active) ORDER BY jobid),'[]') INTO job_list
   FROM cron.job WHERE jobid NOT IN (SELECT cron_job_id FROM unifiedcron_push.state WHERE cron_job_id IS NOT NULL);
  IF jsonb_array_length(job_list)>1000 THEN RAISE EXCEPTION 'Push discovery exceeds 1000 jobs; nothing truncated'; END IF;
  SELECT COALESCE(jsonb_agg(jsonb_build_object('runid',runid::text,'jobid',jobid::text,'status',status,'start_time',start_time,'end_time',end_time) ORDER BY runid),'[]'),COALESCE(max(runid),s.last_run_id)
   INTO new_runs,next_id FROM (SELECT * FROM cron.job_run_details WHERE runid>s.last_run_id
    AND jobid NOT IN (SELECT cron_job_id FROM unifiedcron_push.state WHERE cron_job_id IS NOT NULL)
    ORDER BY runid LIMIT 500) page;
  SELECT COALESCE(jsonb_agg(jsonb_build_object('runid',runid::text,'jobid',jobid::text,'status',status,'start_time',start_time,'end_time',end_time) ORDER BY runid),'[]') INTO refreshed
   FROM cron.job_run_details WHERE runid=ANY(s.pending[1:500]);
  SELECT COALESCE(array_agg(runid ORDER BY ord),'{}') INTO next_pending FROM (
   SELECT DISTINCT ON (runid) runid,ord FROM (
    SELECT v AS runid,ord FROM unnest(s.pending) WITH ORDINALITY AS x(v,ord) WHERE ord>500
    UNION ALL SELECT (v->>'runid')::bigint,100000+ord FROM jsonb_array_elements(refreshed||new_runs) WITH ORDINALITY AS x(v,ord)
     WHERE v->>'status' IN ('starting','running','sending','connecting')
   ) candidates ORDER BY runid,ord
  ) unique_pending;
  IF cardinality(next_pending)>100000 THEN RAISE EXCEPTION 'Too many unfinished runs'; END IF;
  payload := jsonb_build_object('version',1,'projectRef',s.project_ref,'sequence',s.sequence::text,
   'lastRunId',next_id::text,'minimumRunId',lo::text,'backfill',s.last_run_id<s.initial_max,'jobs',job_list,'runs',refreshed||new_runs);
  IF octet_length(payload::text)>1500000 THEN RAISE EXCEPTION 'Push exceeds payload limit'; END IF;
  s.payload := payload; s.next_pending := next_pending;
 END IF;
 stamp := floor(extract(epoch FROM clock_timestamp()))::bigint::text;
 signature := encode(extensions.hmac(convert_to(stamp||'.'||s.payload::text,'UTF8'),decode(s.signing_key,'hex'),'sha256'),'hex');
 outgoing_id := net.http_post(url:=s.endpoint,body:=s.payload,
  headers:=jsonb_build_object('Content-Type','application/json','x-unifiedcron-timestamp',stamp,'x-unifiedcron-signature',signature),timeout_milliseconds:=10000);
 UPDATE unifiedcron_push.state SET sequence=s.sequence,last_run_id=s.last_run_id,initial_max=s.initial_max,
  pending=s.pending,payload=s.payload,next_pending=s.next_pending,request_id=outgoing_id,sent_at=clock_timestamp() WHERE id=p_id;
END $send$;
REVOKE ALL ON FUNCTION unifiedcron_push.send(uuid) FROM PUBLIC;
DO $$ DECLARE r text; BEGIN
 FOR r IN SELECT rolname FROM pg_roles WHERE rolname<>current_user AND NOT rolsuper LOOP
   EXECUTE format('REVOKE ALL ON SCHEMA unifiedcron_push FROM %I',r);
   EXECUTE format('REVOKE ALL ON ALL TABLES IN SCHEMA unifiedcron_push FROM %I',r);
   EXECUTE format('REVOKE ALL ON FUNCTION unifiedcron_push.send(uuid) FROM %I',r);
 END LOOP;
END $$;
UPDATE unifiedcron_push.state SET cron_job_id=cron.schedule(${literal('unifiedcron-push-' + connectionId)},'* * * * *',${literal("SELECT unifiedcron_push.send('" + connectionId + "'::uuid);")}) WHERE id=${literal(connectionId)}::uuid;
COMMIT;
SELECT unifiedcron_push.send(${literal(connectionId)}::uuid);
-- No commands, database passwords or run messages are sent. Retry checkpoints advance only after a signed receipt.
`;
}
