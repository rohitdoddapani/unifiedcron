import { createHash, createHmac } from 'crypto';
import { getClient } from '@unifiedcron/database';
import { SupabasePushSchema, verifyPushSignature } from '@unifiedcron/shared';
import { ConnectionService } from './ConnectionService';

export class PushError extends Error {
  constructor(public status: number, message: string) { super(message); }
}
export class SupabasePushService {
  async receive(connectionId: string, body: Buffer, timestamp: string, signature: string) {
    const config = await new ConnectionService().getDecryptedConfig(connectionId);
    if (config?.mode !== 'push' || !config.pushKey || !verifyPushSignature(body,timestamp,signature,config.pushKey)) throw new PushError(401,'Invalid or expired push signature');
    const parsed = SupabasePushSchema.safeParse(JSON.parse(body.toString('utf8')));
    if (!parsed.success) throw new PushError(400,'Invalid telemetry payload');
    const payload = parsed.data;
    if (payload.projectRef !== config.projectRef || payload.sequence === '0') throw new PushError(400,'Wrong project or sequence');
    if (new Set(payload.jobs.map(job => job.jobid)).size !== payload.jobs.length || new Set(payload.runs.map(run => run.runid)).size !== payload.runs.length) throw new PushError(400,'Duplicate provider identities');
    const digest = createHash('sha256').update(body).digest('hex');
    const client = await getClient();
    try {
      await client.query('BEGIN');
      await client.query('INSERT INTO supabase_push_state ("connectionId") VALUES ($1) ON CONFLICT DO NOTHING',[connectionId]);
      const state = (await client.query('SELECT * FROM supabase_push_state WHERE "connectionId"=$1 FOR UPDATE',[connectionId])).rows[0];
      const old = (await client.query('SELECT digest FROM supabase_push_batches WHERE "connectionId"=$1 AND sequence=$2',[connectionId,payload.sequence])).rows[0];
      if (old) {
        if (old.digest !== digest) throw new PushError(409,'Sequence already contains different telemetry');
      } else {
        if (BigInt(payload.sequence) !== BigInt(state.receivedSequence)+1n) throw new PushError(409,'Unexpected sequence; retain the source checkpoint');
        const pending = (await client.query('SELECT count(*)::int AS n FROM supabase_push_batches WHERE "connectionId"=$1 AND "processedAt" IS NULL',[connectionId])).rows[0].n;
        if (pending >= 100) throw new PushError(429,'Worker inbox is full; retry later');
        await client.query('INSERT INTO supabase_push_batches ("connectionId",sequence,payload,digest) VALUES ($1,$2,$3::jsonb,$4)',[connectionId,payload.sequence,JSON.stringify(payload),digest]);
        await client.query('UPDATE supabase_push_state SET "receivedSequence"=$2,"lastReceivedAt"=NOW() WHERE "connectionId"=$1',[connectionId,payload.sequence]);
        await client.query(`INSERT INTO ingestion_state ("connectionId",stream) VALUES ($1,'supabase.runs') ON CONFLICT ("connectionId",stream) DO UPDATE SET "nextPollAt"=NOW()`,[connectionId]);
      }
      await client.query('COMMIT');
      return { success: true, receipt: createHmac('sha256',Buffer.from(config.pushKey,'hex')).update(`ack.${payload.sequence}.${digest}`).digest('hex') };
    } catch (error) { await client.query('ROLLBACK'); throw error; }
    finally { client.release(); }
  }
}
