import { PoolClient } from 'pg';
import { ParsedJob } from '@unifiedcron/shared';
import { getClient } from './client';

export async function syncSupabaseJobs(connectionId: string, project: string, jobs: ParsedJob[], existingClient?: PoolClient) {
  const client = existingClient ?? await getClient();
  let added = 0; let updated = 0;
  try {
    if (!existingClient) await client.query('BEGIN');
    const ids: string[] = [];
    for (const job of jobs) {
      const originId = String(job.metadata?.jobId ?? '');
      if (!/^\d+$/.test(originId)) throw new Error('Provider job ID is missing');
      ids.push(originId);
      const result = await client.query(`INSERT INTO jobs ("connectionId","originId",name,cron,platform,project,metadata)
        VALUES ($1,$2,$3,$4,'supabase',$5,$6::jsonb)
        ON CONFLICT ("connectionId","originId") DO UPDATE SET name=EXCLUDED.name,cron=EXCLUDED.cron,
          project=EXCLUDED.project, metadata=EXCLUDED.metadata, "lastSeenAt"=NOW(),"removedAt"=NULL
        RETURNING (xmax=0) AS inserted`,
      [connectionId, originId, job.name || `Job ${originId}`, job.cron, project,
        JSON.stringify({ jobId: originId, active: job.metadata?.active !== false })]);
      if (result.rows[0].inserted) added++; else updated++;
    }
    const removed = await client.query(`UPDATE jobs SET "removedAt"=COALESCE("removedAt",NOW())
      WHERE "connectionId"=$1 AND "supersededById" IS NULL AND NOT ("originId"=ANY($2::text[]))`, [connectionId, ids]);
    if (!existingClient) await client.query('COMMIT');
    return { added, updated, removed: removed.rowCount || 0, errors: [] as string[] };
  } catch (error) { if (!existingClient) await client.query('ROLLBACK'); throw error; }
  finally { if (!existingClient) client.release(); }
}
