# Quick Start Guide - Local Development

This guide will help you get UnifiedCron running locally for testing with Supabase.

## Prerequisites

- Node.js 18+
- pnpm (or npm)
- PostgreSQL running locally (or Docker)
- A Supabase project (cloud or local)

## Step 1: Set Up Environment Variables

1. **Copy the example environment file**:
   ```bash
   cp env.example .env.local
   ```

2. **Generate an encryption key**:
   ```bash
   openssl rand -base64 32
   ```
   Copy the output.

3. **Edit `.env.local`** and set:
   ```env
   DATABASE_URL=postgres://user:password@localhost:5432/unifiedcron
   ENCRYPTION_KEY=<paste the generated key here>
   API_PORT=3001
   NODE_ENV=development
   NEXT_PUBLIC_API_URL=http://localhost:3001
   ```

## Step 2: Set Up Database

**📚 For detailed database setup instructions, see [DATABASE_SETUP.md](./DATABASE_SETUP.md)**

Quick setup:
1. **Start PostgreSQL** (if not already running):
   ```bash
   brew services start postgresql@15
   # or
   brew services start postgresql@14
   ```

2. **Run the automated setup script**:
   ```bash
   ./scripts/setup-database.sh
   ```
   
   Or manually create the database and run migrations:
   ```bash
   # Create database
   psql -d postgres -c "CREATE DATABASE unifiedcron;"
   
   # Update DATABASE_URL in .env.local (the script does this automatically)
   # DATABASE_URL=postgres://$(whoami)@localhost:5432/unifiedcron
   
   # Run migrations:
   ```bash
   cd packages/database
   pnpm build
   cd ../..
   node packages/database/dist/migrate.js
   ```

   Or use the pnpm script (if configured):
   ```bash
   pnpm db:migrate
   ```

## Step 3: Start Development Servers

1. **Install dependencies** (if not already done):
   ```bash
   pnpm install
   ```

2. **Build shared packages**:
   ```bash
   pnpm --filter @unifiedcron/shared build
   pnpm --filter @unifiedcron/database build
   pnpm --filter @unifiedcron/integrations build
   ```

3. **Start the servers**:
   ```bash
   pnpm dev
   ```

   This starts:
   - Frontend at http://localhost:3000
   - API at http://localhost:3001

## Step 4: Set Up Supabase Connection

1. **In your Supabase project**, run the SQL from `docs/supabase-setup.sql`:
   - Go to SQL Editor in Supabase dashboard
   - Copy and paste the SQL
   - Run it

2. **Get your Supabase credentials**:
   - Project URL: Settings → API → Project URL
   - Anonymous Key: Settings → API → anon public key

3. **In UnifiedCron**:
   - Go to http://localhost:3000
   - Click "Connections" in the navigation
   - Click "Add Supabase Connection"
   - Enter:
     - Label: e.g., "Production Database"
     - Project URL: Your Supabase project URL
     - Anonymous Key: Your anon key
   - Click "Test & Connect"

## Troubleshooting

### API Won't Start

**Error: "ENCRYPTION_KEY environment variable is required"**

- Make sure `.env.local` exists in the root directory
- Verify `ENCRYPTION_KEY` is set in `.env.local`
- Restart the API server

### Database Connection Issues

**Error: "connection refused" or similar**

- Verify PostgreSQL is running: `pg_isready`
- Check DATABASE_URL in `.env.local` is correct
- Ensure database exists: `psql -l | grep unifiedcron`

### Frontend Can't Connect to API

**Error: "Failed to fetch" or connection errors**

- Verify API is running: Check http://localhost:3001/health
- Check browser console for CORS errors
- Verify `NEXT_PUBLIC_API_URL` in `.env.local` matches API port

### Form Submits But Nothing Happens

- Check browser console for errors
- Check API logs for errors
- Verify the API is running and accessible
- Try the health endpoint: http://localhost:3001/health

### Connection Test Fails

- Verify Supabase views are created (run SQL from `docs/supabase-setup.sql`)
- Check Project URL is correct (should end with `.supabase.co`)
- Verify Anonymous Key is correct (starts with `eyJ...`)
- Check API logs for detailed error messages

## Next Steps

Once connected:
- Go to Dashboard to see discovered jobs
- Click "Refresh Jobs" on a connection to discover cron jobs
- View job details and schedules

## Getting Help

- Check API logs: Look at the terminal where `pnpm dev` is running
- Check browser console: Open Developer Tools → Console
- Verify all services are running: Check both API and Web processes
