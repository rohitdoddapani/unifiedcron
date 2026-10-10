#!/bin/bash

# UnifiedCron Setup Script
echo "🚀 Setting up UnifiedCron..."

# Check if pnpm is installed
if ! command -v pnpm &> /dev/null; then
    echo "❌ pnpm is not installed. Please install it first:"
    echo "   npm install -g pnpm"
    exit 1
fi

# Check if Node.js version is 18+
NODE_VERSION=$(node -v | cut -d'v' -f2 | cut -d'.' -f1)
if [ "$NODE_VERSION" -lt 18 ]; then
    echo "❌ Node.js version 18 or higher is required. Current version: $(node -v)"
    exit 1
fi

echo "✅ Node.js version: $(node -v)"
echo "✅ pnpm version: $(pnpm -v)"

# Install dependencies
echo "📦 Installing dependencies..."
pnpm install

# Build packages
echo "🔨 Building packages..."
pnpm --filter @unifiedcron/shared build
pnpm --filter @unifiedcron/database build
pnpm --filter @unifiedcron/integrations build

# Check if .env.local exists
if [ ! -f ".env.local" ]; then
    echo "📝 Creating .env.local from template..."
    cp env.example .env.local
    echo "⚠️  Please edit .env.local with your configuration"
fi

# Check if DATABASE_URL is set
if ! grep -q "DATABASE_URL=" .env.local || grep -q "DATABASE_URL=postgres://user:pass@localhost:5432/unifiedcron" .env.local; then
    echo "⚠️  Please set your DATABASE_URL in .env.local"
fi

# Check if ENCRYPTION_KEY is set
if ! grep -q "ENCRYPTION_KEY=" .env.local || grep -q "ENCRYPTION_KEY=replace_me_with_32_bytes_key" .env.local; then
    echo "🔐 Generating encryption key..."
    ENCRYPTION_KEY=$(openssl rand -base64 32)
    
    # Update .env.local with the generated key
    if grep -q "ENCRYPTION_KEY=" .env.local; then
        sed -i.bak "s/ENCRYPTION_KEY=.*/ENCRYPTION_KEY=$ENCRYPTION_KEY/" .env.local
        rm .env.local.bak
    else
        echo "ENCRYPTION_KEY=$ENCRYPTION_KEY" >> .env.local
    fi
    
    echo "✅ Generated and set ENCRYPTION_KEY"
fi

if ! grep -q "JWT_SECRET=" .env.local || grep -q "JWT_SECRET=replace_me_with_32_bytes_key" .env.local; then
    JWT_SECRET=$(openssl rand -base64 32)
    if grep -q "JWT_SECRET=" .env.local; then
        sed -i.bak "s/JWT_SECRET=.*/JWT_SECRET=$JWT_SECRET/" .env.local
        rm .env.local.bak
    else
        echo "JWT_SECRET=$JWT_SECRET" >> .env.local
    fi
    echo "✅ Generated and set JWT_SECRET"
fi

if ! grep -q "NEXTAUTH_SECRET=" .env.local || grep -q "NEXTAUTH_SECRET=replace_me_with_32_bytes_secret" .env.local; then
    NEXTAUTH_SECRET=$(openssl rand -base64 32)
    if grep -q "NEXTAUTH_SECRET=" .env.local; then
        sed -i.bak "s/NEXTAUTH_SECRET=.*/NEXTAUTH_SECRET=$NEXTAUTH_SECRET/" .env.local
        rm .env.local.bak
    else
        echo "NEXTAUTH_SECRET=$NEXTAUTH_SECRET" >> .env.local
    fi
    echo "✅ Generated and set NEXTAUTH_SECRET"
fi

echo ""
echo "🎉 Setup complete!"
echo ""
echo "Next steps:"
echo "1. Set up your PostgreSQL database"
echo "2. Update .env.local with your DATABASE_URL"
echo "3. Run database migrations: pnpm db:migrate"
echo "4. Start development servers: pnpm dev"
echo ""
echo "For Supabase users:"
echo "1. Run the SQL in docs/supabase-setup.sql in your Supabase SQL editor"
echo "2. Add your Supabase project URL and anon key to .env.local"
echo ""
echo "Happy coding! 🚀"
