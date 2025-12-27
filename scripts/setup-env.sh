#!/bin/bash
# Setup script to ensure .env.local is available in apps/web/

set -e

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
WEB_ENV="$ROOT_DIR/apps/web/.env.local"
ROOT_ENV="$ROOT_DIR/.env.local"

if [ ! -f "$ROOT_ENV" ]; then
  echo "❌ Error: .env.local not found in project root"
  echo "   Please create .env.local in the project root first"
  exit 1
fi

if [ -f "$WEB_ENV" ]; then
  echo "✓ apps/web/.env.local already exists"
  echo "  If you want to update it from root, run: cp $ROOT_ENV $WEB_ENV"
else
  echo "📋 Copying .env.local to apps/web/"
  cp "$ROOT_ENV" "$WEB_ENV"
  echo "✓ Created apps/web/.env.local"
  echo ""
  echo "💡 Tip: If you prefer a symlink instead, run:"
  echo "   ln -s ../../.env.local apps/web/.env.local"
fi

