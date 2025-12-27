# Database Setup Guide

This guide will help you set up PostgreSQL for UnifiedCron on your local machine.

## Prerequisites

- PostgreSQL installed (via Homebrew on macOS)
- Node.js and pnpm installed

## Quick Setup

### 1. Install PostgreSQL (if not already installed)

```bash
brew install postgresql@15
# or
brew install postgresql@14
```

### 2. Start PostgreSQL

```bash
# For PostgreSQL 15
brew services start postgresql@15

# For PostgreSQL 14
brew services start postgresql@14
```

To check if PostgreSQL is running:
```bash
psql -d postgres -c "SELECT version();"
```

### 3. Create the Database

Run the automated setup script:
```bash
./scripts/setup-database.sh
```

Or manually:
```bash
# Connect to PostgreSQL
psql -d postgres

# Create the database
CREATE DATABASE unifiedcron;

# Exit psql
\q
```

### 4. Configure Environment Variables

Ensure your `.env.local` file has the correct `DATABASE_URL`:

```bash
# For default PostgreSQL user (your macOS username)
DATABASE_URL=postgres://$(whoami)@localhost:5432/unifiedcron

# Or if you have a specific user/password
DATABASE_URL=postgres://username:password@localhost:5432/unifiedcron
```

The setup script will automatically update your `.env.local` file.

### 5. Run Migrations

```bash
cd packages/database
pnpm build
pnpm migrate
```

Or from the root:
```bash
cd packages/database && pnpm build && pnpm migrate
```

You should see:
```
✅ Database connection established
📦 Creating database schema...
✅ Database schema created successfully
✅ Default user created: <user-id>
```

## Verification

### Check Database Connection

```bash
psql -d unifiedcron -c "\dt"
```

You should see tables: `users`, `connections`, `jobs`, `jobRuns`, `alerts`.

### Check Tables

```bash
psql -d unifiedcron -c "SELECT table_name FROM information_schema.tables WHERE table_schema = 'public';"
```

### Check Default User

```bash
psql -d unifiedcron -c "SELECT id, email, name FROM users;"
```

## Common Issues

### PostgreSQL Not Running

**Error**: `connection to server on socket "/tmp/.s.PGSQL.5432" failed`

**Solution**:
```bash
brew services start postgresql@15
# Wait a few seconds for it to start
```

### Role Does Not Exist

**Error**: `role "user" does not exist`

**Solution**: Update your `DATABASE_URL` in `.env.local` to use your actual username:
```bash
DATABASE_URL=postgres://$(whoami)@localhost:5432/unifiedcron
```

### Permission Denied

**Error**: `permission denied for database`

**Solution**: Make sure you're using the correct PostgreSQL user. By default on macOS with Homebrew, you can use your system username.

### Migration Fails

If migrations fail, you can check the database state:
```bash
psql -d unifiedcron -c "SELECT tablename FROM pg_tables WHERE schemaname = 'public';"
```

If tables exist, the migration will skip creating them (idempotent).

## Manual Database Management

### Stop PostgreSQL

```bash
brew services stop postgresql@15
```

### Restart PostgreSQL

```bash
brew services restart postgresql@15
```

### Drop and Recreate Database

**⚠️ WARNING: This will delete all data!**

```bash
psql -d postgres -c "DROP DATABASE IF EXISTS unifiedcron;"
psql -d postgres -c "CREATE DATABASE unifiedcron;"
cd packages/database && pnpm migrate
```

### View Database Logs

```bash
tail -f /opt/homebrew/var/log/postgresql@15.log
# or for PostgreSQL 14
tail -f /opt/homebrew/var/log/postgresql@14.log
```

## Next Steps

After setting up the database:

1. Start the API server: `pnpm dev:api`
2. Start the web frontend: `pnpm dev:web`
3. Visit http://localhost:3000
4. Add a Supabase connection from the Connections page

## Docker Alternative

If you prefer using Docker instead of a local PostgreSQL installation, see [DOCKER_SETUP.md](./DOCKER_SETUP.md).

