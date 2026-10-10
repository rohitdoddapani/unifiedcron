import { Client } from 'pg';
import { readFileSync, readdirSync, existsSync } from 'fs';
import { join } from 'path';
import { config } from 'dotenv';
import { resolve } from 'path';

// Load environment variables from .env.local (development) or .env
const rootPath = resolve(__dirname, '../../..');
if (process.env.NODE_ENV === 'development' || !process.env.NODE_ENV) {
  config({ path: join(rootPath, '.env.local') });
}
config({ path: join(rootPath, '.env') });
config(); // Also try local .env file

async function sleep(ms: number): Promise<void> {
  return new Promise(resolve => setTimeout(resolve, ms));
}

async function waitForDatabase(connectionString: string, maxRetries = 30, retryDelay = 2000): Promise<Client> {
  for (let i = 0; i < maxRetries; i++) {
    const client = new Client({ connectionString });
    try {
      await client.connect();
      // Test the connection with a simple query
      await client.query('SELECT 1');
      console.log('✅ Database connection established');
      return client;
    } catch (error) {
      await client.end();
      if (i < maxRetries - 1) {
        console.log(`⏳ Waiting for database... (attempt ${i + 1}/${maxRetries})`);
        await sleep(retryDelay);
      } else {
        throw new Error(`Failed to connect to database after ${maxRetries} attempts: ${error instanceof Error ? error.message : 'Unknown error'}`);
      }
    }
  }
  throw new Error('Failed to connect to database');
}

async function checkSchemaExists(client: Client): Promise<boolean> {
  try {
    const result = await client.query(`
      SELECT EXISTS (
        SELECT FROM information_schema.tables 
        WHERE table_schema = 'public' 
        AND table_name = 'connections'
      );
    `);
    return result.rows[0].exists;
  } catch (error) {
    return false;
  }
}

async function ensureMigrationsTable(client: Client): Promise<void> {
  await client.query(`
    CREATE TABLE IF NOT EXISTS schema_migrations (
      id SERIAL PRIMARY KEY,
      name VARCHAR(255) NOT NULL UNIQUE,
      "appliedAt" TIMESTAMPTZ NOT NULL DEFAULT NOW()
    )
  `);
}

async function getAppliedMigrationNames(client: Client): Promise<Set<string>> {
  const result = await client.query('SELECT name FROM schema_migrations');
  return new Set(result.rows.map((row: { name: string }) => row.name));
}

async function applyMigration(client: Client, migrationName: string, sql: string): Promise<void> {
  await client.query('BEGIN');
  try {
    await client.query(sql);
    await client.query('INSERT INTO schema_migrations (name) VALUES ($1)', [migrationName]);
    await client.query('COMMIT');
    console.log(`✅ Applied migration: ${migrationName}`);
  } catch (error) {
    await client.query('ROLLBACK');
    throw error;
  }
}

async function applyOrderedMigrations(client: Client): Promise<void> {
  const migrationsDir = join(__dirname, '../src/migrations');
  if (!existsSync(migrationsDir)) {
    console.log('ℹ️ Migrations directory not found, skipping ordered migrations');
    return;
  }

  const migrationFiles = readdirSync(migrationsDir)
    .filter((file) => file.endsWith('.sql'))
    .sort();

  if (migrationFiles.length === 0) {
    console.log('ℹ️ No migration files found in packages/database/src/migrations');
    return;
  }

  const applied = await getAppliedMigrationNames(client);
  for (const file of migrationFiles) {
    if (applied.has(file)) {
      continue;
    }

    const sql = readFileSync(join(migrationsDir, file), 'utf8');
    await applyMigration(client, file, sql);
  }
}

async function applyBaseSchemas(client: Client): Promise<void> {
  const schemaPath = join(__dirname, '../src/schema.sql');
  const authSchemaPath = join(__dirname, '../src/auth-schema.sql');

  const schema = readFileSync(schemaPath, 'utf8');
  await client.query(schema);

  const authSchema = readFileSync(authSchemaPath, 'utf8');
  await client.query(authSchema);
}

async function migrate() {
  const connectionString = process.env.DATABASE_URL || 'postgres://user:pass@localhost:5432/unifiedcron';
  let client: Client | null = null;

  try {
    // Wait for database to be ready (important for Docker Compose)
    client = await waitForDatabase(connectionString);

    const schemaExists = await checkSchemaExists(client);
    if (!schemaExists) {
      console.log('📦 Creating initial database schema...');
    } else {
      console.log('📦 Ensuring schema and migrations are up to date...');
    }

    // Existing schemas need additive columns before the current base indexes.
    if (!schemaExists) {
      await applyBaseSchemas(client);
    }
    await ensureMigrationsTable(client);
    await applyOrderedMigrations(client);
    if (schemaExists) {
      await applyBaseSchemas(client);
    }
    console.log('✅ Database migration completed successfully');

  } catch (error) {
    console.error('❌ Migration failed:', error);
    process.exit(1);
  } finally {
    if (client) {
      await client.end();
    }
  }
}

if (require.main === module) {
  migrate();
}

export { migrate };
