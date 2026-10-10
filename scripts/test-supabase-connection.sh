#!/bin/bash
set -euo pipefail
if [[ $# -ne 0 || -z "${SUPABASE_READER_CONNECTION_STRING:-}" ]]; then
  echo 'Set SUPABASE_READER_CONNECTION_STRING securely in the environment; positional credentials and anon keys are no longer supported.'
  exit 1
fi
REPO_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
cd "$REPO_DIR"
pnpm --filter @unifiedcron/shared build
pnpm --filter @unifiedcron/integrations build
pnpm --filter @unifiedcron/integrations exec node -e "const fs=require('fs');const {validateSupabaseAccess}=require('./dist/supabase');validateSupabaseAccess({mode:'postgres',connectionString:process.env.SUPABASE_READER_CONNECTION_STRING,...(process.env.SUPABASE_CA_FILE?{caCertificate:fs.readFileSync(process.env.SUPABASE_CA_FILE,'utf8')}:{})}).then(()=>console.log('Verified TLS and scoped reader access')).catch(e=>{console.error(e.message);process.exit(1);});"
