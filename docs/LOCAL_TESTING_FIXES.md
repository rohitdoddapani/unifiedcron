# Local Testing Fixes

This document explains what was fixed to enable local testing of the Supabase connection feature.

## Issues Fixed

### 1. API Not Starting - Missing ENCRYPTION_KEY

**Problem:** API was crashing on startup because it couldn't find `ENCRYPTION_KEY`.

**Fix:**
- Updated dotenv configuration to load `.env.local` from project root
- Added better error handling for missing environment variables

**Action Required:**
- Ensure `.env.local` exists in project root with `ENCRYPTION_KEY` set
- Generate key: `openssl rand -base64 32`

### 2. Connections Form Not Working

**Problem:** The form had a TODO comment and wasn't actually making API calls.

**Fix:**
- Created API client utility (`apps/web/src/lib/api.ts`)
- Implemented full API integration in connections page
- Added form state management
- Added loading states and error handling
- Added session-token based auth handling

### 3. Missing Auth Context Propagation

**Problem:** API identity was previously passed as `userId` in request params/body.

**Fix:**
- Removed `userId` request contracts for protected routes
- Enforced bearer-token auth on `/api/connections`, `/api/jobs`, and `/api/alerts`
- Updated frontend API client to use session-issued JWT access tokens

## How to Test

### Step 1: Verify Environment

1. Check `.env.local` exists:
   ```bash
   cat .env.local | grep ENCRYPTION_KEY
   ```

2. If missing or using placeholder, generate and set:
   ```bash
   openssl rand -base64 32
   # Copy output and add to .env.local
   ```

### Step 2: Ensure Database is Set Up

1. Check database exists:
   ```bash
   psql -l | grep unifiedcron
   ```

2. Run migrations if needed:
   ```bash
   cd packages/database
   pnpm build
   node dist/migrate.js
   ```

### Step 3: Start Servers

1. Start development servers:
   ```bash
   pnpm dev
   ```

2. Verify both are running:
   - Frontend: http://localhost:3000
   - API: http://localhost:3001/health

### Step 4: Test Supabase Connection

1. **Set up Supabase** (if not done):
   - Run SQL from `docs/supabase-setup.sql` in Supabase SQL Editor
   - Create the dedicated reader and obtain its session-pooler connection string

2. **Test in UnifiedCron**:
   - Go to http://localhost:3000/connections
   - Click "Add Supabase Connection"
   - Fill in:
     - Label: "Test Connection"
     - PostgreSQL connection string: Dedicated reader credentials
     - CA certificate: Project certificate if required
   - Click "Test & Connect"

3. **What should happen**:
   - Form shows "Connecting..." while submitting
   - Modal closes on success
   - Connection appears in the list
   - Error message shows if something fails

### Step 5: Verify Connection Works

1. **Check connection appears** in the connections list
2. **Test connection** using the Test button
3. **Refresh jobs** to discover cron jobs from Supabase

## Debugging

### If Form Still Doesn't Work

1. **Check browser console:**
   - Open Developer Tools (F12)
   - Look for JavaScript errors
   - Check Network tab for failed requests

2. **Check API is running:**
   ```bash
   curl http://localhost:3001/health
   ```

3. **Check API logs:**
   - Look at terminal where `pnpm dev` is running
   - Check for error messages

4. **Test API directly (authenticated endpoint):**
   ```bash
   curl http://localhost:3001/api/users/me \
     -H "Authorization: Bearer <jwt-token>"
   ```

### Common Error Messages

**"Failed to connect to API"**
- API is not running
- Check port 3001 is accessible
- Restart API server

**"Authentication required"**
- Session token is missing or expired
- Sign in again at `/auth/signin`
- Verify `JWT_SECRET` is set in `.env.local`

**"Failed to create connection"**
- Check API logs for detailed error
- Verify Supabase credentials are correct
- Check database is accessible

**Connection created but test fails**
- Supabase views might not be set up
- Run SQL from `docs/supabase-setup.sql`
- Verify Project URL and Anon Key

## Files Changed

- `apps/web/src/lib/api.ts` - New API client
- `apps/web/src/app/connections/page.tsx` - Full API integration
- `apps/api/src/routes/users.ts` - Authenticated user profile endpoint
- `apps/api/src/index.ts` - Better env loading
- `packages/database/src/migrate.ts` - Ordered migration framework with compatibility support

## Next Steps

After successful connection:
- Test job discovery (Refresh Jobs)
- View jobs in dashboard
- Test connection refresh
- Try deleting and re-adding connections
