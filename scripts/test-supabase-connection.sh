#!/bin/bash

# UnifiedCron Supabase Connection Test Script
set -e

if [ -z "$1" ] || [ -z "$2" ]; then
    echo "Usage: $0 <project-url> <anon-key>"
    echo "Example: $0 https://xxxxx.supabase.co eyJ..."
    exit 1
fi

PROJECT_URL=$1
ANON_KEY=$2

echo "🧪 Testing Supabase connection..."
echo "   Project URL: $PROJECT_URL"
echo ""

# Test 1: Check if views exist
echo "1. Testing cron_jobs_view access..."
RESPONSE=$(curl -s -w "\n%{http_code}" \
    -H "apikey: $ANON_KEY" \
    -H "Authorization: Bearer $ANON_KEY" \
    "$PROJECT_URL/rest/v1/cron_jobs_view?select=count")

HTTP_CODE=$(echo "$RESPONSE" | tail -n1)
BODY=$(echo "$RESPONSE" | sed '$d')

if [ "$HTTP_CODE" -eq 200 ]; then
    echo "   ✅ cron_jobs_view is accessible"
else
    echo "   ❌ Failed to access cron_jobs_view (HTTP $HTTP_CODE)"
    echo "   Response: $BODY"
    echo ""
    echo "   💡 Make sure you've run the SQL setup script in your Supabase SQL Editor"
    exit 1
fi

# Test 2: Check job run logs view
echo ""
echo "2. Testing cron_job_run_logs access..."
RESPONSE=$(curl -s -w "\n%{http_code}" \
    -H "apikey: $ANON_KEY" \
    -H "Authorization: Bearer $ANON_KEY" \
    "$PROJECT_URL/rest/v1/cron_job_run_logs?select=count&limit=1")

HTTP_CODE=$(echo "$RESPONSE" | tail -n1)
BODY=$(echo "$RESPONSE" | sed '$d')

if [ "$HTTP_CODE" -eq 200 ]; then
    echo "   ✅ cron_job_run_logs is accessible"
else
    echo "   ❌ Failed to access cron_job_run_logs (HTTP $HTTP_CODE)"
    echo "   Response: $BODY"
    exit 1
fi

# Test 3: Get cron jobs count
echo ""
echo "3. Counting cron jobs..."
RESPONSE=$(curl -s \
    -H "apikey: $ANON_KEY" \
    -H "Authorization: Bearer $ANON_KEY" \
    "$PROJECT_URL/rest/v1/cron_jobs_view?select=jobid")

JOBS_COUNT=$(echo "$RESPONSE" | grep -o 'jobid' | wc -l | tr -d ' ')
echo "   Found $JOBS_COUNT active cron job(s)"

echo ""
echo "✅ All tests passed! Your Supabase connection is ready."
echo ""
echo "📝 Next steps:"
echo "   1. Add this connection in UnifiedCron"
echo "   2. Click 'Refresh Jobs' to discover your cron jobs"
