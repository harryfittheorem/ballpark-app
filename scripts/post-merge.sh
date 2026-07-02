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
        # --use-api bundles server-side, bypassing local DNS restrictions
        # shellcheck disable=SC2086
        npx --yes supabase functions deploy "$fn" --use-api $extra_flags >/dev/null 2>&1 \
          && echo "[post-merge] deployed $fn" \
          || echo "[post-merge] WARN: deploy $fn failed (env not configured?); continuing"
      ) &
      PIDS+=($!)
    fi
  }

  # mux-create-upload is deployed explicitly (not via the silent deploy_fn) so
  # its deployment is verifiable: we log the source SHA-1 and the Supabase
  # project ID to stdout, making it easy to confirm the right binary is live.
  if [ -f "supabase/functions/mux-create-upload/index.ts" ]; then
    MUX_UPLOAD_SHA=$(sha1sum supabase/functions/mux-create-upload/index.ts | awk '{print $1}')
    echo "[post-merge] deploying mux-create-upload (source sha1=${MUX_UPLOAD_SHA})"
    (
      npx --yes supabase functions deploy mux-create-upload --use-api 2>&1 \
        && echo "[post-merge] mux-create-upload deployed OK (sha1=${MUX_UPLOAD_SHA})" \
        || echo "[post-merge] WARN: mux-create-upload deploy failed (sha1=${MUX_UPLOAD_SHA})"
    ) &
    PIDS+=($!)
  fi

  # Standard JWT-verified functions
  deploy_fn send-push-notification
  deploy_fn send-coach-video-notification
  deploy_fn hittrax-associate
  deploy_fn hittrax-create-account
  deploy_fn hittrax-kiosk-event
  deploy_fn hittrax-poll
  deploy_fn hittrax-disconnect
  deploy_fn account-delete
  deploy_fn notify-achievement
  deploy_fn notify-leaderboard-weekly
  deploy_fn notify-assignment-reviewed
  deploy_fn send-booking-reminders
  deploy_fn booking-confirmation
  deploy_fn stripe-create-payment-intent
  deploy_fn stripe-setup-intent
  deploy_fn stripe-create-subscription
  deploy_fn stripe-cancel-subscription
  deploy_fn save-payment-method
  deploy_fn pause-membership
  deploy_fn resume-membership
  deploy_fn request-membership-upgrade
  deploy_fn resume-paused-memberships
  deploy_fn process-membership-cancellations
  deploy_fn notify-cancel-requested
  deploy_fn notify-waiver-signed
  deploy_fn promote-waitlist

  # --no-verify-jwt: Mux / HitTrax / Stripe authenticate with their own schemes
  deploy_fn mux-webhook              "--no-verify-jwt"
  deploy_fn hittrax-registration-complete "--no-verify-jwt"
  deploy_fn hittrax-forget           "--no-verify-jwt"
  # HitTrax-spec canonical endpoint names (required for HitTrax to call us)
  deploy_fn CompleteHitTraxRegistration "--no-verify-jwt"
  deploy_fn ForgetHitTraxUser           "--no-verify-jwt"
  deploy_fn stripe-webhook           "--no-verify-jwt"

  # Wait for all background deploys to finish
  for pid in "${PIDS[@]}"; do
    wait "$pid" || true
  done

  echo "[post-merge] all edge function deploys complete"
fi

# Rebuild the portal so Next.js always serves code from the current source.
# portal/.next is cleared first to prevent stale server bundles from being served.
if [ -d "portal" ]; then
  echo "[post-merge] clearing portal/.next to remove any stale build cache"
  rm -rf portal/.next

  echo "[post-merge] rebuilding portal (cd portal && npm run build)"
  (cd portal && npm run build) && echo "[post-merge] portal build OK" \
    || echo "[post-merge] WARN: portal build failed; check portal source for errors"
fi

echo "[post-merge] done"
