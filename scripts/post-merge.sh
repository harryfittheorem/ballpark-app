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

# Re-deploy edge functions in parallel — each deploy is independent.
# Local edits to supabase/functions/* are NOT served by Supabase until pushed.
if [ -d "supabase/functions" ]; then
  echo "[post-merge] deploying edge functions (parallel)"
  PIDS=()

  deploy_fn() {
    local fn="$1"
    local extra_flags="${2:-}"
    if [ -f "supabase/functions/$fn/index.ts" ]; then
      (
        # shellcheck disable=SC2086
        npx --yes supabase functions deploy "$fn" $extra_flags >/dev/null 2>&1 \
          && echo "[post-merge] deployed $fn" \
          || echo "[post-merge] WARN: deploy $fn failed (env not configured?); continuing"
      ) &
      PIDS+=($!)
    fi
  }

  # Standard JWT-verified functions
  deploy_fn mux-create-upload
  deploy_fn send-push-notification
  deploy_fn send-coach-video-notification
  deploy_fn hittrax-associate
  deploy_fn hittrax-poll
  deploy_fn hittrax-disconnect
  deploy_fn account-delete
  deploy_fn notify-achievement
  deploy_fn notify-leaderboard-weekly
  deploy_fn notify-assignment-reviewed
  deploy_fn stripe-create-payment-intent
  deploy_fn stripe-setup-intent
  deploy_fn stripe-create-subscription
  deploy_fn stripe-cancel-subscription

  # --no-verify-jwt: Mux / HitTrax / Stripe authenticate with their own schemes
  deploy_fn mux-webhook              "--no-verify-jwt"
  deploy_fn hittrax-registration-complete "--no-verify-jwt"
  deploy_fn hittrax-forget           "--no-verify-jwt"
  deploy_fn stripe-webhook           "--no-verify-jwt"

  # Wait for all background deploys to finish
  for pid in "${PIDS[@]}"; do
    wait "$pid" || true
  done

  echo "[post-merge] all edge function deploys complete"
fi

echo "[post-merge] done"
