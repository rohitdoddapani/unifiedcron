import { Client, ClientConfig } from 'pg';
import { lookup } from 'dns/promises';
import { isIP } from 'net';
import { ConnectionConfig, isPublicWebhookAddress, ParsedJob } from '@unifiedcron/shared';

export interface SupabaseRun {
  runid: string; jobid: string; status: string; start_time: string | null;
  end_time: string | null; return_message: string | null;
}
export interface SupabaseSource {
  discover(): Promise<ParsedJob[]>;
  bounds(): Promise<{ min: string | null; max: string | null }>;
  backfillFloor(): Promise<string>;
  page(after: string, limit: number): Promise<SupabaseRun[]>;
  unfinished(ids: string[]): Promise<SupabaseRun[]>;
  close(): Promise<void>;
}

export function isAllowedSupabaseHost(hostname: string): boolean {
  return /^db\.[a-z0-9-]+\.supabase\.co$/i.test(hostname) || /^[a-z0-9-]+\.pooler\.supabase\.com$/i.test(hostname);
}

export function supabaseProjectIdentity(config: ConnectionConfig): string | null {
  try {
    if (config.mode !== 'postgres' && config.projectUrl) {
      const match = /^([a-z0-9-]+)\.supabase\.co$/i.exec(new URL(config.projectUrl).hostname);
      return match ? `cloud:${match[1].toLowerCase()}:postgres` : null;
    }
    if (!config.connectionString) return null;
    const url = new URL(config.connectionString);
    const direct = /^db\.([a-z0-9-]+)\.supabase\.co$/i.exec(url.hostname);
    const user = decodeURIComponent(url.username);
    const ref = direct?.[1] || (url.hostname.endsWith('.pooler.supabase.com') && user.includes('.') ? user.split('.').pop() : null);
    const database = decodeURIComponent(url.pathname.slice(1) || 'postgres');
    return ref ? `cloud:${ref.toLowerCase()}:${database}` : `${url.hostname}:${url.port || 5432}:${database}`;
  } catch { return null; }
}

export async function postgresClientConfig(config: ConnectionConfig): Promise<ClientConfig> {
  if (config.mode !== 'postgres' || !config.connectionString) throw migrationError();
  let url: URL;
  try { url = new URL(config.connectionString); } catch { throw new Error('Invalid PostgreSQL connection string'); }
  if (!['postgres:', 'postgresql:'].includes(url.protocol) || url.hash || !url.username || !url.password) throw new Error('Use a PostgreSQL connection string with dedicated reader credentials');
  const host = url.hostname.replace(/^\[|\]$/g, '');
  if (process.env.SUPABASE_ALLOW_CUSTOM_HOSTS !== 'true' && !isAllowedSupabaseHost(host)) throw new Error('Only Supabase database and pooler hosts are allowed');
  // URI SSL parameters never override the explicit verified TLS configuration below.
  if (url.searchParams.has('sslmode') && !['require', 'verify-ca', 'verify-full'].includes(url.searchParams.get('sslmode')!)) throw new Error('TLS is required');
  let timer: ReturnType<typeof setTimeout> | undefined;
  const addresses = isIP(host) ? [{ address: host, family: isIP(host) }] : await Promise.race([
    lookup(host, { all: true, verbatim: true }),
    new Promise<never>((_, reject) => { timer = setTimeout(() => reject(new Error('Database DNS lookup timed out')), 5000); }),
  ]).finally(() => clearTimeout(timer));
  if (!addresses.length || (process.env.SUPABASE_ALLOW_PRIVATE_NETWORK !== 'true' && addresses.some(item => !isPublicWebhookAddress(item.address)))) throw new Error('Private or reserved database addresses are disabled');
  const port = Number(url.port || 5432);
  if (![5432, 6543].includes(port) && process.env.SUPABASE_ALLOW_CUSTOM_HOSTS !== 'true') throw new Error('Unsupported Supabase database port');
  if (!Number.isInteger(port) || port < 1 || port > 65535) throw new Error('Invalid database port');
  return {
    host: addresses[0].address, port, user: decodeURIComponent(url.username), password: decodeURIComponent(url.password),
    database: decodeURIComponent(url.pathname.slice(1) || 'postgres'), application_name: 'UnifiedCron',
    ssl: { rejectUnauthorized: true, servername: host, ...(config.caCertificate ? { ca: config.caCertificate } : {}) },
    connectionTimeoutMillis: 8000, query_timeout: 5000,
  };
}

export function migrationError(): Error {
  const error = new Error('Legacy anon-key monitoring is disabled. Run the cleanup SQL and switch to a dedicated read-only PostgreSQL connection.');
  error.name = 'MigrationRequiredError'; return error;
}

export async function openSupabaseSource(config: ConnectionConfig): Promise<SupabaseSource> {
  const client = new Client(await postgresClientConfig(config));
  try {
    await client.connect();
    const roles = await client.query(`SELECT r.rolsuper, r.rolcreatedb, r.rolcreaterole, r.rolbypassrls,
      EXISTS (SELECT 1 FROM pg_auth_members WHERE member = r.oid) AS membership
      FROM pg_roles r WHERE r.rolname = current_user`);
    const role = roles.rows[0];
    if (!role || role.rolsuper || role.rolcreatedb || role.rolcreaterole || role.rolbypassrls || role.membership) throw new Error('Use the dedicated reader role, without privileged role memberships');
    const grants = (await client.query(`SELECT
      EXISTS (SELECT 1 FROM pg_class c JOIN pg_namespace n ON n.oid=c.relnamespace
        WHERE c.relkind IN ('r','p','v','f') AND n.nspname NOT LIKE 'pg_%' AND n.nspname<>'information_schema'
        AND has_schema_privilege(current_user,n.oid,'USAGE')
        AND (has_table_privilege(current_user,c.oid,'INSERT,UPDATE,DELETE,TRUNCATE')
          OR has_any_column_privilege(current_user,c.oid,'INSERT,UPDATE')))
        OR has_database_privilege(current_user,current_database(),'CREATE')
        OR EXISTS (SELECT 1 FROM pg_namespace n WHERE n.nspname NOT LIKE 'pg_%'
          AND n.nspname<>'information_schema' AND has_schema_privilege(current_user,n.oid,'CREATE')) AS writes,
      EXISTS (SELECT 1 FROM pg_proc p JOIN pg_namespace n ON n.oid=p.pronamespace
        WHERE p.prosecdef AND p.prorettype NOT IN ('trigger'::regtype,'event_trigger'::regtype)
        AND n.nspname NOT LIKE 'pg_%' AND n.nspname<>'information_schema'
        AND has_schema_privilege(current_user,n.oid,'USAGE')
        AND has_function_privilege(current_user,p.oid,'EXECUTE')) AS definers`)).rows[0];
    if (grants.writes || grants.definers) throw new Error('Reader has additional write or security-definer access through existing grants. Restrict those project privileges before connecting.');
    // The reader must not be able to read commands, even when no rows exist.
    try {
      await client.query('SELECT command FROM cron.job LIMIT 0');
      throw new Error('Reader can access cron commands. Revoke that privilege before connecting.');
    } catch (error) {
      if ((error as { code?: string }).code !== '42501') throw error;
    }
    await client.query('SELECT jobid, jobname, schedule, active FROM unifiedcron.jobs LIMIT 0');
    await client.query('SELECT runid, jobid, status, start_time, end_time, return_message FROM unifiedcron.runs LIMIT 0');
  } catch (error) { await client.end(); throw error; }
  return {
    async discover() {
      const result = await client.query('SELECT jobid, jobname, schedule, active FROM unifiedcron.jobs ORDER BY jobid');
      return result.rows.map(row => ({ name: row.jobname || `Job ${row.jobid}`, cron: row.schedule,
        metadata: { jobId: String(row.jobid), active: row.active } }));
    },
    async bounds() {
      const result = await client.query('SELECT min(runid)::text AS min, max(runid)::text AS max FROM unifiedcron.runs');
      return result.rows[0];
    },
    async backfillFloor() {
      const result = await client.query(`SELECT min(runid)::text AS first FROM (
        SELECT runid FROM unifiedcron.runs WHERE start_time >= NOW() - INTERVAL '7 days' OR start_time IS NULL
        ORDER BY runid DESC LIMIT 10000) recent`);
      if (result.rows[0].first) return (BigInt(result.rows[0].first) - 1n).toString();
      return (await client.query('SELECT max(runid)::text AS max FROM unifiedcron.runs')).rows[0].max || '0';
    },
    async page(after, limit) {
      return (await client.query(`SELECT runid::text, jobid::text, status, start_time, end_time,
        left(return_message, 4096) AS return_message FROM unifiedcron.runs r
        WHERE r.runid > $1::bigint ORDER BY r.runid LIMIT $2`, [after, limit])).rows;
    },
    async unfinished(ids) {
      if (!ids.length) return [];
      return (await client.query(`SELECT runid::text, jobid::text, status, start_time, end_time,
        left(return_message, 4096) AS return_message FROM unifiedcron.runs WHERE runid = ANY($1::bigint[])`, [ids])).rows;
    },
    close: () => client.end(),
  };
}

export async function fetchSupabaseCronJobs(config: ConnectionConfig): Promise<ParsedJob[]> {
  const source = await openSupabaseSource(config);
  try { return await source.discover(); } finally { await source.close(); }
}

export async function validateSupabaseAccess(config: ConnectionConfig): Promise<boolean> {
  const source = await openSupabaseSource(config);
  try { await source.discover(); return true; } finally { await source.close(); }
}
