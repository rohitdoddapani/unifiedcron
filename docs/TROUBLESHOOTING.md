# Troubleshooting Guide

## Common Issues and Solutions

### API Won't Start - ENCRYPTION_KEY Error

**Error Message:**
```
Error: ENCRYPTION_KEY environment variable is required
```

**Solution:**

1. Check if `.env.local` exists in the project root:
   ```bash
   ls -la .env.local
   ```

2. If it doesn't exist, create it:
   ```bash
   cp env.example .env.local
   ```

3. Generate an encryption key:
   ```bash
   openssl rand -base64 32
   ```

4. Edit `.env.local` and set the ENCRYPTION_KEY:
   ```env
   ENCRYPTION_KEY=<paste the generated key here>
   ```

5. Restart the API server

**Note:** The API looks for `.env.local` in the project root directory.

### Form Submits But Nothing Happens

**Symptoms:**
- Clicking "Test & Connect" closes the modal
- No error message appears
- Connection doesn't appear in the list

**Possible Causes:**

1. **API is not running**
   - Check if API is accessible: http://localhost:3001/health
   - Check terminal for API errors
   - Verify API process is running

2. **CORS issues**
   - Check browser console for CORS errors
   - Verify `NEXT_PUBLIC_API_URL` is correct
   - Check API logs for CORS rejection

3. **API errors**
   - Check API terminal output for errors
   - Check browser Network tab for failed requests
   - Look at response status codes

**Solution:**

1. **Verify API is running:**
   ```bash
   curl http://localhost:3001/health
   ```
   Should return: `{"status":"ok",...}`

2. **Check browser console:**
   - Open Developer Tools (F12)
   - Go to Console tab
   - Look for error messages
   - Go to Network tab
   - Try submitting form again
   - Check the request to `/api/connections`
   - Look at the response

3. **Check API logs:**
   - Look at the terminal where `pnpm dev` is running
   - Check for error messages from the API

### Database Connection Errors

**Error Message:**
```
connection refused
ECONNREFUSED
```

**Solution:**

1. **Verify PostgreSQL is running:**
   ```bash
   pg_isready
   # or
   psql -U postgres -c "SELECT 1"
   ```

2. **Check DATABASE_URL in `.env.local`:**
   ```env
   DATABASE_URL=postgres://username:password@localhost:5432/unifiedcron
   ```

3. **Create the database if it doesn't exist:**
   ```bash
   createdb unifiedcron
   # or
   psql -U postgres -c "CREATE DATABASE unifiedcron;"
   ```

4. **Run migrations:**
   ```bash
   cd packages/database
   pnpm build
   node dist/migrate.js
   ```

### Frontend Can't Connect to API

**Symptoms:**
- Frontend loads but shows errors
- "Failed to fetch" errors in console
- API calls return errors

**Solution:**

1. **Verify API URL:**
   - Check `.env.local` has: `NEXT_PUBLIC_API_URL=http://localhost:3001`
   - Restart frontend after changing this

2. **Check API is accessible:**
   ```bash
   curl http://localhost:3001/health
   ```

3. **Check CORS settings:**
   - API should allow `http://localhost:3000`
   - Check API logs for CORS errors

4. **Verify ports:**
   - API should be on 3001
   - Frontend should be on 3000
   - Check for port conflicts: `lsof -i :3001`

### Connection Test Fails

**Symptoms:**
- Connection test returns error
- "Failed to connect to Supabase" message

**Solution:**

1. **Verify Supabase setup:**
   - Run SQL from `docs/supabase-setup.sql` in Supabase SQL Editor
   - Verify views exist: `cron_jobs_view` and `cron_job_run_logs`

2. **Check credentials:**
   - Project URL should be: `https://xxxxx.supabase.co`
   - Anonymous Key should start with: `eyJ...`
   - Verify credentials in Supabase dashboard

3. **Test connection manually:**
   ```bash
   # Use the test script
   ./scripts/test-supabase-connection.sh <project-url> <anon-key>
   ```

4. **Check API logs:**
   - Look for detailed error messages
   - Verify the request reaches Supabase

### No Jobs Discovered

**Symptoms:**
- Connection created successfully
- No jobs appear in dashboard

**Solution:**

1. **Verify you have cron jobs in Supabase:**
   ```sql
   SELECT * FROM cron.job WHERE active = true;
   ```

2. **Check views are accessible:**
   ```sql
   SELECT * FROM cron_jobs_view LIMIT 1;
   ```

3. **Refresh jobs manually:**
   - Go to Dashboard
   - Click "Refresh Jobs" on the connection
   - Check for errors

4. **Verify connection details:**
   - Re-test the connection
   - Check connection status

## Debug Checklist

Before asking for help, please check:

- [ ] `.env.local` exists and has `ENCRYPTION_KEY` set
- [ ] PostgreSQL is running and accessible
- [ ] Database exists and migrations have run
- [ ] API server is running (check http://localhost:3001/health)
- [ ] Frontend is running (check http://localhost:3000)
- [ ] Browser console shows no errors
- [ ] API logs show no errors
- [ ] Supabase views are created (run SQL setup)
- [ ] Supabase credentials are correct

## Getting More Help

1. **Check logs:**
   - API logs: Terminal running `pnpm dev`
   - Frontend logs: Browser console
   - Database logs: PostgreSQL logs

2. **Gather information:**
   - Error messages from console
   - API response codes from Network tab
   - Environment configuration (remove secrets)
   - Steps to reproduce

3. **Test individual components:**
   - Test API health endpoint
   - Test database connection
   - Test Supabase connection manually
   - Test API endpoints with curl

## Quick Fixes

### Reset Everything

1. Stop all processes (Ctrl+C)
2. Check and fix `.env.local`
3. Verify database is accessible
4. Restart: `pnpm dev`

### Clear Browser Cache

1. Hard refresh: Cmd+Shift+R (Mac) or Ctrl+Shift+R (Windows)
2. Or clear browser cache
3. Or open in incognito/private mode

### Restart Database

```bash
# If using local PostgreSQL
pg_ctl restart

# If using Docker
docker compose restart postgres
```
