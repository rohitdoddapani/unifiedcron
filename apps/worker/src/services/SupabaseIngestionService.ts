import { getClient, syncSupabaseJobs, PoolClient } from '@unifiedcron/database';
import { Connection, SupabasePushSchema } from '@unifiedcron/shared';
import { openSupabaseSource, SupabaseRun, SupabaseSource } from '@unifiedcron/integrations';

const STREAM = 'supabase.runs';
interface Cursor { lastRunId?: string; backfill?: boolean }
const running = new Set(['starting','running','sending','connecting']);
export function normalizedStatus(status: string): 'running' | 'failed' | 'succeeded' {
  if (running.has(status)) return 'running';
  if (status === 'failed' || status === 'succeeded') return status;
  throw new Error('Unknown provider run status');
}

export class SupabaseIngestionService {
  constructor(private openSource: (config: Connection['config']) => Promise<SupabaseSource> = openSupabaseSource) {}

  async sync(connection: Connection): Promise<{ runs: number; skipped?: boolean }> {
    if (connection.config.mode === 'push') return this.syncPush(connection);
    const client = await getClient();
    let source: SupabaseSource | undefined;
    let locked = false;
    try {
      locked = (await client.query('SELECT pg_try_advisory_lock(hashtext($1),hashtext($2)) AS locked', [STREAM, connection.id])).rows[0].locked;
      if (!locked) return { runs: 0, skipped: true };
      await client.query(`INSERT INTO ingestion_state ("connectionId",stream) VALUES ($1,$2) ON CONFLICT DO NOTHING`, [connection.id,STREAM]);
      const state = (await client.query('SELECT * FROM ingestion_state WHERE "connectionId"=$1 AND stream=$2', [connection.id,STREAM])).rows[0];
      if (new Date(state.nextPollAt).getTime() > Date.now()) return { runs: 0, skipped: true };
      source = await this.openSource(connection.config);
      const jobs = await source.discover();
      await syncSupabaseJobs(connection.id, connection.label, jobs, undefined);
      const bounds = await source.bounds();
      const cursor: Cursor = state.cursor;
      if (cursor.lastRunId && bounds.max && BigInt(bounds.max) < BigInt(cursor.lastRunId)) throw new Error('Upstream run IDs reset; operator review is required before resetting the cursor');
      if (!cursor.lastRunId) {
        cursor.lastRunId = await source.backfillFloor(); cursor.backfill = true;
        await client.query('UPDATE ingestion_state SET cursor=$3::jsonb WHERE "connectionId"=$1 AND stream=$2', [connection.id,STREAM,JSON.stringify(cursor)]);
      }
      if (bounds.min && BigInt(cursor.lastRunId) > 0n && BigInt(bounds.min) > BigInt(cursor.lastRunId) + 1n && !cursor.backfill) {
        await this.gap(client, connection.id, (BigInt(cursor.lastRunId) + 1n).toString(), (BigInt(bounds.min) - 1n).toString());
      }
      const pending = (await client.query(`SELECT jr."providerRunId" FROM "jobRuns" jr JOIN jobs j ON jr."jobId"=j.id
        WHERE j."connectionId"=$1 AND jr.status='running' AND jr."providerRunId" IS NOT NULL ORDER BY jr."startedAt"`, [connection.id])).rows;
      let total = 0;
      for (let offset=0; offset<pending.length; offset+=1000) {
        const refresh = await source.unfinished(pending.slice(offset,offset+1000).map(row => row.providerRunId));
        await client.query('BEGIN');
        try {
          await this.store(client, connection.id, refresh, !!cursor.backfill);
          await client.query('COMMIT');
        } catch (error) { await client.query('ROLLBACK'); throw error; }
        total += refresh.length;
      }
      let complete = false;
      let after = cursor.lastRunId;
      // A bounded cycle prevents one busy connection from monopolizing a worker.
      for (let page = 0; page < 10; page++) {
        const rows = await source.page(after, 1000);
        const next: string = rows.length ? rows[rows.length - 1].runid : after;
        await client.query('BEGIN');
        try {
          await this.store(client, connection.id, rows, !!cursor.backfill);
          await client.query(`UPDATE ingestion_state SET cursor=$3::jsonb, "lastSyncedAt"=NOW(),
            "lastError"=NULL,"consecutiveFailures"=0 WHERE "connectionId"=$1 AND stream=$2`,
          [connection.id,STREAM,JSON.stringify({ ...cursor, lastRunId: next })]);
          await client.query('COMMIT');
        } catch (error) { await client.query('ROLLBACK'); throw error; }
        cursor.lastRunId = next; after = next; total += rows.length;
        if (rows.length < 1000) { complete = true; break; }
      }
      if (complete && cursor.backfill) {
        cursor.backfill = false;
        await client.query('BEGIN');
        try {
          await client.query(`UPDATE alerts SET details=details || '{"backfill":false}'::jsonb
            WHERE status='open' AND "jobId" IN (SELECT id FROM jobs WHERE "connectionId"=$1 AND "removedAt" IS NULL)`, [connection.id]);
          await client.query('UPDATE ingestion_state SET cursor=$3::jsonb WHERE "connectionId"=$1 AND stream=$2', [connection.id,STREAM,JSON.stringify(cursor)]);
          await client.query('COMMIT');
        } catch (error) { await client.query('ROLLBACK'); throw error; }
      }
      await client.query(`UPDATE ingestion_state SET "nextPollAt"=NOW()+INTERVAL '60 seconds',
        cursor=cursor || jsonb_build_object('backlog',$3::boolean) WHERE "connectionId"=$1 AND stream=$2`, [connection.id,STREAM,!complete]);
      return { runs: total };
    } catch (error) {
      if (locked) await client.query(`UPDATE ingestion_state SET "lastErrorAt"=NOW(),"lastError"=$3,
        "consecutiveFailures"="consecutiveFailures"+1,
        "nextPollAt"=NOW()+LEAST(900,60*power(2,LEAST("consecutiveFailures",4))) * INTERVAL '1 second'
        WHERE "connectionId"=$1 AND stream=$2`, [connection.id,STREAM,error instanceof Error ? error.message.slice(0,512) : 'Ingestion failed']);
      throw error;
    } finally {
      if (source) await source.close().catch(() => undefined);
      try { if (locked) await client.query('SELECT pg_advisory_unlock(hashtext($1),hashtext($2))', [STREAM,connection.id]); }
      finally { client.release(); }
    }
  }

  private async syncPush(connection: Connection): Promise<{ runs: number; skipped?: boolean }> {
    const client = await getClient();
    let locked = false;
    let total = 0;
    try {
      locked = (await client.query('SELECT pg_try_advisory_lock(hashtext($1),hashtext($2)) AS locked',[STREAM,connection.id])).rows[0].locked;
      if (!locked) return {runs:0,skipped:true};
      await client.query('INSERT INTO ingestion_state ("connectionId",stream) VALUES ($1,$2) ON CONFLICT DO NOTHING',[connection.id,STREAM]);
      for (let i=0;i<10;i++) {
        const batch = (await client.query('SELECT * FROM supabase_push_batches WHERE "connectionId"=$1 AND "processedAt" IS NULL ORDER BY sequence LIMIT 1',[connection.id])).rows[0];
        if (!batch) break;
        const payload = SupabasePushSchema.parse(batch.payload);
        if (payload.projectRef !== connection.config.projectRef) throw new Error('Push project identity changed');
        await client.query('BEGIN');
        try {
          const state = (await client.query('SELECT * FROM supabase_push_state WHERE "connectionId"=$1 FOR UPDATE',[connection.id])).rows[0];
          if (BigInt(payload.sequence) !== BigInt(state.processedSequence)+1n) throw new Error('Push inbox sequence gap');
          const old = (await client.query('SELECT cursor FROM ingestion_state WHERE "connectionId"=$1 AND stream=$2 FOR UPDATE',[connection.id,STREAM])).rows[0].cursor;
          if (old.lastRunId && BigInt(payload.lastRunId)<BigInt(old.lastRunId)) throw new Error('Upstream run IDs reset; operator review required');
          if (!payload.backfill && old.lastRunId && payload.minimumRunId && BigInt(payload.minimumRunId)>BigInt(old.lastRunId)+1n) {
            await this.gap(client,connection.id,(BigInt(old.lastRunId)+1n).toString(),(BigInt(payload.minimumRunId)-1n).toString());
          }
          await syncSupabaseJobs(connection.id,connection.label,payload.jobs.map(job=>({name:job.name,cron:job.schedule,metadata:{jobId:job.jobid,active:job.active}})),client);
          await this.store(client,connection.id,payload.runs.map(run=>({...run,return_message:null})),payload.backfill);
          if (!payload.backfill) await client.query(`UPDATE alerts SET details=details || '{"backfill":false}'::jsonb
            WHERE status='open' AND "jobId" IN (SELECT id FROM jobs WHERE "connectionId"=$1 AND "removedAt" IS NULL)`,[connection.id]);
          await client.query('UPDATE supabase_push_batches SET "processedAt"=NOW() WHERE "connectionId"=$1 AND sequence=$2',[connection.id,payload.sequence]);
          await client.query('UPDATE supabase_push_state SET "processedSequence"=$2 WHERE "connectionId"=$1',[connection.id,payload.sequence]);
          await client.query(`UPDATE ingestion_state SET cursor=$3::jsonb,"lastSyncedAt"=NOW(),"lastError"=NULL,"consecutiveFailures"=0 WHERE "connectionId"=$1 AND stream=$2`,[connection.id,STREAM,JSON.stringify({lastRunId:payload.lastRunId,backfill:payload.backfill,sequence:payload.sequence})]);
          await client.query('COMMIT');
          total += payload.runs.length;
        } catch (error) { await client.query('ROLLBACK'); throw error; }
      }
      const freshness = (await client.query('SELECT "lastReceivedAt" FROM supabase_push_state WHERE "connectionId"=$1',[connection.id])).rows[0];
      if (!freshness?.lastReceivedAt || Date.now()-new Date(freshness.lastReceivedAt).getTime()>180000) throw new Error('Awaiting signed Supabase pushes; check the installed pg_cron sender and pg_net responses');
      await client.query(`UPDATE ingestion_state SET "nextPollAt"=NOW()+INTERVAL '60 seconds',cursor=cursor || jsonb_build_object('backlog',EXISTS(SELECT 1 FROM supabase_push_batches WHERE "connectionId"=$1 AND "processedAt" IS NULL)) WHERE "connectionId"=$1 AND stream=$2`,[connection.id,STREAM]);
      return {runs:total};
    } catch (error) {
      if (locked) await client.query(`UPDATE ingestion_state SET "lastErrorAt"=NOW(),"lastError"=$3,"consecutiveFailures"="consecutiveFailures"+1,"nextPollAt"=NOW()+INTERVAL '60 seconds' WHERE "connectionId"=$1 AND stream=$2`,[connection.id,STREAM,error instanceof Error ? error.message.slice(0,512) : 'Push ingestion failed']);
      throw error;
    } finally {
      try { if (locked) await client.query('SELECT pg_advisory_unlock(hashtext($1),hashtext($2))',[STREAM,connection.id]); }
      finally { client.release(); }
    }
  }

  private async gap(client: PoolClient, connectionId: string, from: string, to: string) {
    await client.query(`INSERT INTO ingestion_gaps ("connectionId",stream,"fromRunId","toRunId")
      VALUES ($1,$2,$3,$4) ON CONFLICT DO NOTHING`, [connectionId,STREAM,from,to]);
  }

  private async store(client: PoolClient, connectionId: string, rows: SupabaseRun[], backfill: boolean) {
    const ordered = [...rows].sort((a,b) => {
      const time = new Date(a.start_time || 0).getTime() - new Date(b.start_time || 0).getTime();
      return time || (BigInt(a.runid) < BigInt(b.runid) ? -1 : 1);
    });
    for (const run of ordered) {
      let job = (await client.query('SELECT * FROM jobs WHERE "connectionId"=$1 AND "originId"=$2 AND "supersededById" IS NULL FOR UPDATE', [connectionId,String(run.jobid)])).rows[0];
      if (!job) {
        // History may outlive discovery. Preserve it with an explicitly archived placeholder.
        job = (await client.query(`INSERT INTO jobs ("connectionId","originId",name,cron,platform,project,metadata,"removedAt")
          VALUES ($1,$2,$3,'unknown','supabase','Archived', $4::jsonb,NOW()) RETURNING *`,
        [connectionId,String(run.jobid),`Removed job ${run.jobid}`,JSON.stringify({jobId:String(run.jobid),active:false,scheduleUnknown:true})])).rows[0];
      }
      const status = normalizedStatus(run.status);
      const sourceRunId = `supabase:${run.runid}`;
      const started = run.start_time ? new Date(run.start_time) : new Date();
      if (Number.isNaN(started.getTime())) throw new Error('Invalid provider start time');
      if (run.start_time) await client.query(`UPDATE "jobRuns" SET "sourceRunId"=$3,"providerRunId"=$4
        WHERE "jobId"=$1 AND "startedAt"=$2 AND "providerRunId" IS NULL AND "sourceRunId" LIKE 'supabase:%:%'
        AND NOT EXISTS (SELECT 1 FROM "jobRuns" WHERE "jobId"=$1 AND "sourceRunId"=$3)`, [job.id,started,sourceRunId,run.runid]);
      const previous = (await client.query('SELECT status FROM "jobRuns" WHERE "jobId"=$1 AND "sourceRunId"=$2', [job.id,sourceRunId])).rows[0];
      await client.query(`INSERT INTO "jobRuns" ("jobId","sourceRunId","providerRunId",status,"startedAt","endedAt",message)
        VALUES ($1,$2,$3,$4,$5,$6,$7) ON CONFLICT ("jobId","sourceRunId") DO UPDATE SET status=EXCLUDED.status,
          "startedAt"=CASE WHEN $8::boolean THEN EXCLUDED."startedAt" ELSE "jobRuns"."startedAt" END,
          "endedAt"=EXCLUDED."endedAt",message=EXCLUDED.message,"updatedAt"=NOW()`,
      [job.id,sourceRunId,run.runid,status,started,run.end_time,run.return_message?.slice(0,4096) || null,!!run.start_time]);
      if (status === 'running' || previous?.status === status) continue;
      const latest = job.lastFinishedAt ? new Date(job.lastFinishedAt).getTime() : 0;
      // Late completion of an older run must not reopen or resolve a newer incident.
      if (started.getTime() < latest) continue;
      if (status === 'failed') {
        const open = (await client.query("SELECT * FROM alerts WHERE \"jobId\"=$1 AND type='failure' AND status='open' FOR UPDATE", [job.id])).rows[0];
        const details = { ...(open?.details || {}), backfill: open?.details?.backfill ?? backfill,
          failureCount: Number(open?.details?.failureCount || 0)+1,
          firstFailedRunId: open?.details?.firstFailedRunId || sourceRunId,
          firstFailedAt: open?.details?.firstFailedAt || started.toISOString(),
          lastFailedRunId: sourceRunId, lastFailedAt: started.toISOString(),
          jobRun: { sourceRunId, status, startTime: started.toISOString(), endTime: run.end_time, message: run.return_message?.slice(0,4096) || null } };
        if (open) await client.query('UPDATE alerts SET details=$2::jsonb,"updatedAt"=NOW() WHERE id=$1', [open.id,JSON.stringify(details)]);
        else await client.query(`INSERT INTO alerts ("jobId",type,"sourceRunId",details) VALUES ($1,'failure',$2,$3::jsonb)`, [job.id,sourceRunId,JSON.stringify(details)]);
      } else {
        await client.query(`UPDATE alerts SET status='resolved',"resolvedAt"=NOW(),"updatedAt"=NOW(),
          details=details || jsonb_build_object('resolution',jsonb_build_object('source','auto_success','sourceRunId',$2::text,
            'reason','Resolved by a newer successful run'),'resolved',true)
          WHERE "jobId"=$1 AND type='failure' AND status='open'
            AND COALESCE((details->>'lastFailedAt')::timestamptz,"createdAt") < $3`, [job.id,sourceRunId,started]);
      }
      await client.query('UPDATE jobs SET "lastFinishedAt"=$2,"lastFinishedStatus"=$3 WHERE id=$1', [job.id,started,status]);
    }
  }
}
