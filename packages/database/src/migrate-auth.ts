import { Client } from 'pg';
import { readFileSync } from 'fs';
import { join } from 'path';
import dotenv from 'dotenv';

// Load environment variables
dotenv.config({ path: join(__dirname, '../../../.env.local') });
dotenv.config({ path: join(__dirname, '../../../.env') });
dotenv.config();

async function waitForDatabase(connectionString: string, maxAttempts = 30): Promise<Client> {
  for (let i = 0; i < maxAttempts; i++) {
    try {
      const client = new Client({ connectionString });
      await client.connect();
      await client.query('SELECT 1');
      return client;
    } catch (error) {
      if (i === maxAttempts - 1) {
        throw new Error(`Failed to connect to database after ${maxAttempts} attempts: ${error}`);
      }
      await new Promise(resolve => setTimeout(resolve, 1000));
    }
  }
  throw new Error('Failed to connect to database');
}

async function checkAuthSchemaExists(client: Client): Promise<boolean> {
  try {
    const result = await client.query(`
      SELECT EXISTS (
        SELECT FROM information_schema.tables 
        WHERE table_schema = 'public' 
        AND table_name = 'sessions'
      )
    `);
    return result.rows[0].exists;
  } catch (error) {
    return false;
  }
}

async function migrateAuth() {
  const connectionString = process.env.DATABASE_URL || 'postgres://user:pass@localhost:5432/unifiedcron';
  let client: Client | null = null;

  try {
    // Wait for database to be ready
    client = await waitForDatabase(connectionString);

    // Check if auth schema already exists
    const authSchemaExists = await checkAuthSchemaExists(client);
    if (authSchemaExists) {
      console.log('📊 Authentication schema already exists, skipping migration');
      return;
    }

    console.log('📦 Adding authentication schema...');

    // Read and execute auth schema
    // When running from dist/, go up to src/ to find auth-schema.sql
    const schemaPath = join(__dirname, '../src/auth-schema.sql');
    const schema = readFileSync(schemaPath, 'utf8');
    
    await client.query(schema);
    console.log('✅ Authentication schema added successfully');

  } catch (error) {
    console.error('❌ Auth migration failed:', error);
    process.exit(1);
  } finally {
    if (client) {
      await client.end();
    }
  }
}

if (require.main === module) {
  migrateAuth();
}

export { migrateAuth };

