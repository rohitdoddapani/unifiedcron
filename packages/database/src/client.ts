import { Client, Pool, PoolClient } from 'pg';
import { logEvent } from '@unifiedcron/shared';

let pool: Pool | null = null;

export function getPool(): Pool {
  if (!pool) {
    pool = new Pool({
      connectionString: process.env.DATABASE_URL || 'postgres://user:pass@localhost:5432/unifiedcron',
      max: 20,
      idleTimeoutMillis: 30000,
      connectionTimeoutMillis: 2000,
    });

    pool.on('error', (err) => {
      logEvent('error', 'database.pool_error', { name: err.name });
      process.exit(-1);
    });
  }

  return pool;
}

export async function getClient(): Promise<PoolClient> {
  const pool = getPool();
  return await pool.connect();
}

export async function query(text: string, params?: any[]): Promise<any> {
  const pool = getPool();
  const start = Date.now();
  
  try {
    const res = await pool.query(text, params);
    const duration = Date.now() - start;
    logEvent('info', 'database.query', { durationMs: duration, rows: res.rowCount });
    return res;
  } catch (error) {
    logEvent('error', 'database.query_failed', { name: error instanceof Error ? error.name : 'Error' });
    throw error;
  }
}

export async function closePool(): Promise<void> {
  if (pool) {
    await pool.end();
    pool = null;
  }
}
