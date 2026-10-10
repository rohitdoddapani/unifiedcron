#!/bin/bash

# Check environment setup for UnifiedCron

echo "🔍 Checking UnifiedCron Environment Setup..."
echo ""

# Check .env.local exists
if [ ! -f ".env.local" ]; then
    echo "❌ .env.local file not found"
    echo "   Run: cp env.example .env.local"
    exit 1
else
    echo "✅ .env.local exists"
fi

# Check ENCRYPTION_KEY
if grep -q "ENCRYPTION_KEY=" .env.local; then
    ENCRYPTION_KEY=$(grep "ENCRYPTION_KEY=" .env.local | cut -d'=' -f2)
    if [ -z "$ENCRYPTION_KEY" ] || [ "$ENCRYPTION_KEY" = "replace_me_with_32_bytes_key" ]; then
        echo "⚠️  ENCRYPTION_KEY is not set or using placeholder"
        echo "   Generate one with: openssl rand -base64 32"
    else
        echo "✅ ENCRYPTION_KEY is set"
    fi
else
    echo "❌ ENCRYPTION_KEY not found in .env.local"
fi

# Check DATABASE_URL
if grep -q "DATABASE_URL=" .env.local; then
    DATABASE_URL=$(grep "DATABASE_URL=" .env.local | cut -d'=' -f2)
    if [[ "$DATABASE_URL" == *"user:pass"* ]] || [[ "$DATABASE_URL" == *"localhost:5432/unifiedcron"* ]]; then
        echo "⚠️  DATABASE_URL appears to use default/placeholder values"
        echo "   Update it with your actual PostgreSQL connection string"
    else
        echo "✅ DATABASE_URL is set"
    fi
else
    echo "❌ DATABASE_URL not found in .env.local"
fi

# Check API port
if grep -q "API_PORT=" .env.local; then
    echo "✅ API_PORT is set"
else
    echo "ℹ️  API_PORT not set, will default to 3001"
fi

# Check JWT_SECRET
if grep -q "JWT_SECRET=" .env.local; then
    JWT_SECRET=$(grep "JWT_SECRET=" .env.local | cut -d'=' -f2)
    if [ -z "$JWT_SECRET" ] || [[ "$JWT_SECRET" == replace_me* ]]; then
        echo "⚠️  JWT_SECRET is not set or using placeholder"
    else
        echo "✅ JWT_SECRET is set"
    fi
else
    echo "❌ JWT_SECRET not found in .env.local"
fi

# Check NEXTAUTH_SECRET
if grep -q "NEXTAUTH_SECRET=" .env.local; then
    NEXTAUTH_SECRET=$(grep "NEXTAUTH_SECRET=" .env.local | cut -d'=' -f2)
    if [ -z "$NEXTAUTH_SECRET" ] || [[ "$NEXTAUTH_SECRET" == replace_me* ]]; then
        echo "⚠️  NEXTAUTH_SECRET is not set or using placeholder"
    else
        echo "✅ NEXTAUTH_SECRET is set"
    fi
else
    echo "❌ NEXTAUTH_SECRET not found in .env.local"
fi

echo ""
echo "📝 To fix issues:"
echo "   1. Edit .env.local with your settings"
echo "   2. Generate ENCRYPTION_KEY: openssl rand -base64 32"
echo "   3. Generate JWT_SECRET and NEXTAUTH_SECRET: openssl rand -base64 32"
echo "   4. Set DATABASE_URL to your PostgreSQL connection string"
