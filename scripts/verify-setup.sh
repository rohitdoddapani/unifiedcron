#!/bin/bash

# Verify UnifiedCron Setup for Local Development

echo "🔍 Verifying UnifiedCron Setup..."
echo ""

ERRORS=0

# Check Node.js version
echo "1. Checking Node.js version..."
NODE_VERSION=$(node -v | cut -d'v' -f2 | cut -d'.' -f1)
if [ "$NODE_VERSION" -ge 18 ]; then
    echo "   ✅ Node.js $(node -v)"
else
    echo "   ❌ Node.js 18+ required, found $(node -v)"
    ERRORS=$((ERRORS + 1))
fi

# Check pnpm
echo ""
echo "2. Checking pnpm..."
if command -v pnpm &> /dev/null; then
    echo "   ✅ pnpm $(pnpm -v)"
else
    echo "   ⚠️  pnpm not found, but npm can be used"
fi

# Check .env.local
echo ""
echo "3. Checking environment configuration..."
if [ -f ".env.local" ]; then
    echo "   ✅ .env.local exists"
    
    if grep -q "ENCRYPTION_KEY=" .env.local && ! grep -q "ENCRYPTION_KEY=replace_me" .env.local; then
        echo "   ✅ ENCRYPTION_KEY is set"
    else
        echo "   ❌ ENCRYPTION_KEY not set or using placeholder"
        ERRORS=$((ERRORS + 1))
    fi
    
    if grep -q "DATABASE_URL=" .env.local; then
        DB_URL=$(grep "DATABASE_URL=" .env.local | cut -d'=' -f2-)
        if [[ "$DB_URL" != *"user:pass"* ]]; then
            echo "   ✅ DATABASE_URL is set"
        else
            echo "   ⚠️  DATABASE_URL appears to use placeholder values"
        fi
    else
        echo "   ⚠️  DATABASE_URL not found"
    fi
else
    echo "   ❌ .env.local not found"
    echo "      Run: cp env.example .env.local"
    ERRORS=$((ERRORS + 1))
fi

# Check database
echo ""
echo "4. Checking database connection..."
if grep -q "DATABASE_URL=" .env.local; then
    DB_URL=$(grep "DATABASE_URL=" .env.local | cut -d'=' -f2-)
    # Extract connection details (simplified check)
    if psql "$DB_URL" -c "SELECT 1" &> /dev/null; then
        echo "   ✅ Database is accessible"
        
        # Check if schema exists
        if psql "$DB_URL" -c "SELECT EXISTS (SELECT FROM information_schema.tables WHERE table_name = 'connections')" -t | grep -q "t"; then
            echo "   ✅ Database schema exists"
        else
            echo "   ⚠️  Database schema not found - run migrations"
        fi
    else
        echo "   ⚠️  Could not connect to database"
        echo "      Verify DATABASE_URL in .env.local"
    fi
else
    echo "   ⚠️  Cannot check database - DATABASE_URL not set"
fi

# Check if services are running
echo ""
echo "5. Checking if services are running..."
if curl -s http://localhost:3001/health &> /dev/null; then
    echo "   ✅ API is running on port 3001"
else
    echo "   ⚠️  API is not running (this is OK if you haven't started it yet)"
fi

if curl -s http://localhost:3000 &> /dev/null; then
    echo "   ✅ Frontend is running on port 3000"
else
    echo "   ⚠️  Frontend is not running (this is OK if you haven't started it yet)"
fi

echo ""
echo "─────────────────────────────────────"
if [ $ERRORS -eq 0 ]; then
    echo "✅ Setup looks good! You can start with: pnpm dev"
else
    echo "❌ Found $ERRORS issue(s) that need to be fixed"
    echo ""
    echo "Quick fixes:"
    echo "  1. Create .env.local: cp env.example .env.local"
    echo "  2. Generate ENCRYPTION_KEY: openssl rand -base64 32"
    echo "  3. Update DATABASE_URL with your PostgreSQL connection string"
fi
echo ""
