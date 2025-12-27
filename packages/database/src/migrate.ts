import { Client } from 'pg';
import { readFileSync } from 'fs';
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

async function migrate() {
  const connectionString = process.env.DATABASE_URL || 'postgres://user:pass@localhost:5432/unifiedcron';
  let client: Client | null = null;

  try {
    // Wait for database to be ready (important for Docker Compose)
    client = await waitForDatabase(connectionString);

    // Check if schema already exists
    const schemaExists = await checkSchemaExists(client);
    if (schemaExists) {
      console.log('📊 Database schema already exists, skipping migration');
      return;
    }

    console.log('📦 Creating database schema...');

    // Read and execute schema
    // When running from dist/, go up to src/ to find schema.sql
    const schemaPath = join(__dirname, '../src/schema.sql');
    const schema = readFileSync(schemaPath, 'utf8');
    
    await client.query(schema);
    console.log('✅ Database schema created successfully');

    // Create a default user for development (always create if doesn't exist)
    const defaultUser = {
      email: 'admin@unifiedcron.com',
      name: 'Development Admin'
    };

    const userResult = await client.query(
      'INSERT INTO users (email, name) VALUES ($1, $2) ON CONFLICT (email) DO NOTHING RETURNING id',
      [defaultUser.email, defaultUser.name]
    );

    if (userResult.rows.length > 0) {
      console.log('✅ Default user created:', userResult.rows[0].id);
    } else {
      // User already exists, get the ID
      const existingUser = await client.query(
        'SELECT id FROM users WHERE email = $1',
        [defaultUser.email]
      );
      if (existingUser.rows.length > 0) {
        console.log('✅ Using existing default user:', existingUser.rows[0].id);
      }
    }

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
