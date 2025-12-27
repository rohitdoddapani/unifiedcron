#!/bin/bash

# UnifiedCron Docker Start Script
set -e

echo "🚀 Starting UnifiedCron..."

# Check if .env file exists
if [ ! -f ".env" ]; then
    echo "⚠️  .env file not found. Creating from template..."
    if [ -f "docker-compose.env.example" ]; then
        cp docker-compose.env.example .env
        echo "✅ Created .env file from template"
        echo "⚠️  Please edit .env file with your configuration before continuing"
        exit 1
    else
        echo "❌ docker-compose.env.example not found"
        exit 1
    fi
fi

# Check if ENCRYPTION_KEY is set
if ! grep -q "ENCRYPTION_KEY=" .env || grep -q "ENCRYPTION_KEY=replace_me" .env; then
    echo "🔐 Generating encryption key..."
    ENCRYPTION_KEY=$(openssl rand -base64 32)
    
    if grep -q "ENCRYPTION_KEY=" .env; then
        sed -i.bak "s/ENCRYPTION_KEY=.*/ENCRYPTION_KEY=$ENCRYPTION_KEY/" .env
        rm .env.bak
    else
        echo "ENCRYPTION_KEY=$ENCRYPTION_KEY" >> .env
    fi
    
    echo "✅ Generated and set ENCRYPTION_KEY"
fi

# Start Docker Compose
echo "🐳 Starting Docker Compose services..."
docker compose up -d

# Wait for services to be healthy
echo "⏳ Waiting for services to be healthy..."
sleep 5

MAX_WAIT=60
WAITED=0
while [ $WAITED -lt $MAX_WAIT ]; do
    if curl -s http://localhost:3001/health > /dev/null 2>&1; then
        echo "✅ API is healthy"
        break
    fi
    echo "   Waiting for API... ($WAITED/$MAX_WAIT seconds)"
    sleep 2
    WAITED=$((WAITED + 2))
done

if [ $WAITED -ge $MAX_WAIT ]; then
    echo "⚠️  API did not become healthy within $MAX_WAIT seconds"
    echo "   Check logs with: docker compose logs api"
fi

# Display status
echo ""
echo "📊 Service Status:"
docker compose ps

echo ""
echo "🎉 UnifiedCron is starting up!"
echo ""
echo "📍 Access the application:"
echo "   Frontend: http://localhost:3000"
echo "   API:      http://localhost:3001"
echo "   Health:   http://localhost:3001/health"
echo ""
echo "📝 Useful commands:"
echo "   View logs:    docker compose logs -f"
echo "   Stop:         docker compose down"
echo "   Status:       docker compose ps"
echo ""
