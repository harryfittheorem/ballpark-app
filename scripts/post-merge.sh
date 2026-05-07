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

echo "[post-merge] check videos.mux_asset_id NOT NULL + UNIQUE invariant"
node scripts/check-mux-asset-id-constraint.mjs

# Re-deploy edge functions whenever their source has changed. Local edits to
# supabase/functions/* are NOT served by Supabase until they're pushed — a
# stale deploy causes the coach Record Video screen to fail with
# `Upload service returned status 404 [function_error]`.
if [ -d "supabase/functions" ]; then
  for fn in mux-create-upload; do
    if [ -f "supabase/functions/$fn/index.ts" ]; then
      echo "[post-merge] supabase functions deploy $fn"
      npx --yes supabase functions deploy "$fn" >/dev/null 2>&1 || \
        echo "[post-merge] WARN: deploy $fn failed (env not configured?); continuing"
    fi
  done
  if [ -f "supabase/functions/mux-webhook/index.ts" ]; then
    echo "[post-merge] supabase functions deploy mux-webhook --no-verify-jwt"
    npx --yes supabase functions deploy mux-webhook --no-verify-jwt >/dev/null 2>&1 || \
      echo "[post-merge] WARN: deploy mux-webhook failed (env not configured?); continuing"
  fi
fi

echo "[post-merge] done"
