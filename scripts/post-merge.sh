#!/bin/bash
# Post-merge setup for Ballpark.
# Runs automatically after every task merge. Idempotent + non-interactive.
set -e

echo "[post-merge] npm install --legacy-peer-deps"
npm install --legacy-peer-deps --no-audit --no-fund

if [ -d "supabase/migrations" ] && ls supabase/migrations/*.sql >/dev/null 2>&1; then
  echo "[post-merge] supabase db push (non-interactive)"
  npx --yes supabase db push --yes || {
    echo "[post-merge] WARN: supabase db push failed (may be no new migrations or env not configured); continuing"
  }
fi

if [ -f "src/types/database.ts" ]; then
  echo "[post-merge] regenerating Supabase types"
  npx --yes supabase gen types typescript --linked > src/types/database.ts.tmp 2>/dev/null \
    && mv src/types/database.ts.tmp src/types/database.ts \
    || {
      rm -f src/types/database.ts.tmp
      echo "[post-merge] WARN: gen types failed; leaving existing src/types/database.ts in place"
    }
fi

echo "[post-merge] done"
