#!/bin/bash

# UnifiedCron Database Setup Script

set -e

echo "🗄️  Setting up PostgreSQL database for UnifiedCron..."
echo ""

# Check if PostgreSQL is installed
if ! command -v psql &> /dev/null; then
    echo "❌ PostgreSQL is not installed"
    echo "   Install with: brew install postgresql@15"
    exit 1
fi

echo "✅ PostgreSQL is installed"

# Start PostgreSQL service
echo ""
echo "📦 Starting PostgreSQL service..."
if brew services start postgresql@15 2>/dev/null || brew services start postgresql@14 2>/dev/null; then
    echo "✅ PostgreSQL service started"
    sleep 2 # Wait for service to be ready
else
    echo "⚠️  Could not start via Homebrew, trying manual start..."
    # Try to start manually if service doesn't work
    echo "   You may need to start PostgreSQL manually"
fi

# Wait for PostgreSQL to be ready
echo ""
echo "⏳ Waiting for PostgreSQL to be ready..."
for i in {1..10}; do
    if psql -U postgres -c "SELECT 1" &> /dev/null 2>&1 || psql -d postgres -c "SELECT 1" &> /dev/null 2>&1; then
        echo "✅ PostgreSQL is ready"
        break
    fi
    echo "   Attempt $i/10..."
    sleep 1
done

# Determine database user and connection method
DB_USER=""
DB_PASSWORD=""

# Try different connection methods
if psql -U postgres -c "SELECT 1" &> /dev/null 2>&1; then
    DB_USER="postgres"
    echo ""
    echo "Using user: postgres"
elif psql -U $(whoami) -c "SELECT 1" &> /dev/null 2>&1; then
    DB_USER=$(whoami)
    echo ""
    echo "Using user: $DB_USER"
else
    echo ""
    echo "❌ Could not connect to PostgreSQL"
    echo ""
    echo "Please ensure PostgreSQL is running:"
    echo "   brew services start postgresql@15"
    echo ""
    echo "Or start manually and try connecting:"
    echo "   psql -d postgres"
    exit 1
fi

# Check if database exists
echo ""
echo "🔍 Checking if database exists..."
if psql -U "$DB_USER" -lqt | cut -d \| -f 1 | grep -qw unifiedcron; then
    echo "✅ Database 'unifiedcron' already exists"
    echo ""
    read -p "Do you want to recreate it? (y/N): " -n 1 -r
    echo
    if [[ $REPLY =~ ^[Yy]$ ]]; then
        echo "🗑️  Dropping existing database..."
        psql -U "$DB_USER" -c "DROP DATABASE IF EXISTS unifiedcron;"
        echo "✅ Database dropped"
    else
        echo "ℹ️  Using existing database"
        echo ""
        echo "✅ Database setup complete!"
        echo ""
        echo "📝 Update your .env.local with:"
        echo "   DATABASE_URL=postgres://$DB_USER@localhost:5432/unifiedcron"
        exit 0
    fi
fi

# Create database
echo ""
echo "📦 Creating database 'unifiedcron'..."
if psql -U "$DB_USER" -c "CREATE DATABASE unifiedcron;"; then
    echo "✅ Database created successfully"
else
    echo "❌ Failed to create database"
    exit 1
fi

# Update .env.local
echo ""
echo "📝 Updating .env.local with database connection..."
if [ -f ".env.local" ]; then
    # Backup existing file
    cp .env.local .env.local.backup
    
    # Update DATABASE_URL
    if [[ "$OSTYPE" == "darwin"* ]]; then
        # macOS sed syntax
        sed -i.bak "s|DATABASE_URL=.*|DATABASE_URL=postgres://$DB_USER@localhost:5432/unifiedcron|" .env.local
        rm .env.local.bak 2>/dev/null || true
    else
        # Linux sed syntax
        sed -i "s|DATABASE_URL=.*|DATABASE_URL=postgres://$DB_USER@localhost:5432/unifiedcron|" .env.local
    fi
    
    echo "✅ Updated DATABASE_URL in .env.local"
else
    echo "⚠️  .env.local not found, creating it..."
    cat > .env.local << EOF
# Database
DATABASE_URL=postgres://$DB_USER@localhost:5432/unifiedcron

# Encryption key for secrets (32 bytes base64)
ENCRYPTION_KEY=$(openssl rand -base64 32)

# API Configuration
API_PORT=3001
NODE_ENV=development

# Frontend Configuration
NEXT_PUBLIC_API_URL=http://localhost:3001
EOF
    echo "✅ Created .env.local"
fi

echo ""
echo "🎉 Database setup complete!"
echo ""
echo "Next steps:"
echo "1. Run migrations: pnpm db:migrate"
echo "   Or: cd packages/database && pnpm build && node dist/migrate.js"
echo "2. Start the API: pnpm dev"
echo ""
