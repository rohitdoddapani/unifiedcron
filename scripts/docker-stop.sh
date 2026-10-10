#!/bin/bash

# UnifiedCron Docker Stop Script
set -e

echo "🛑 Stopping UnifiedCron..."
COMPOSE_FILE=${COMPOSE_FILE:-docker-compose.selfhost.yml}
echo "📄 Using compose file: ${COMPOSE_FILE}"

# Stop Docker Compose services
docker compose -f "$COMPOSE_FILE" down

echo "✅ UnifiedCron stopped successfully"

# Optional: Remove volumes (uncomment if you want to delete data)
# echo "🗑️  Removing volumes..."
# docker compose down -v
# echo "✅ Volumes removed"
