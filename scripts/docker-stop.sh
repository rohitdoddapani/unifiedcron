#!/bin/bash

# UnifiedCron Docker Stop Script
set -e

echo "🛑 Stopping UnifiedCron..."

# Stop Docker Compose services
docker compose down

echo "✅ UnifiedCron stopped successfully"

# Optional: Remove volumes (uncomment if you want to delete data)
# echo "🗑️  Removing volumes..."
# docker compose down -v
# echo "✅ Volumes removed"
