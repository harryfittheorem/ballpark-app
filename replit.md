# Ballpark

A multi-tenant SaaS operating system for youth sports performance facility franchises, starting with an athlete-facing mobile app for kids and parents.

## Run & Operate

```bash
npm run dev          # expo start --tunnel (test on phone via Expo Go)
npm run typecheck    # tsc --noEmit
npm run lint         # eslint
```

`npm install` requires `--legacy-peer-deps`. Real testing is on a physical phone via Expo Go. Replit Deployments are not used; production ships through Expo EAS.

**Portal demo data:**

```bash
node scripts/seed-portal-demo-data.mjs    # seed 4 coaches, 15 families/kids, 15 memberships,
                                           # 12-month payment history, 20 today's bookings,
                                           # 60 historical bookings, 5 products, points & orders.
                                           # Idempotent — safe to re-run.

node scripts/delete-portal-seed-data.mjs  # remove every seeded record by its deterministic UUID
                                           # (5eed… namespace). Deletes in reverse FK order:
                                           # orders → points_ledger → bookings → payment_events →
                                           # memberships → kids → family/coach auth users (which
                                           # cascade-delete the families/coaches rows) → products.
                                           # Run before going to production.
```

**CEO demo scenario (Marcus Rivera end-to-end story):**

```bash
node scripts/seed-demo-scenario.mjs       # Seed a scripted hero story: Marcus Rivera (14U, 847 pts,
                                           # rank #3), Coach Mike message, pending + reviewed drills,
                                           # upcoming Friday lesson, today's HitTrax session (88.4 mph),
                                           # personal best, 2 achievements, 8-kid leaderboard, 3 store
                                           # products, 1 past order, 12 dashboard bookings across 3
                                           # coaches. Requires provision-coach-mike.mjs for coach-specific
                                           # rows. Uses de00… UUID namespace — safe to combine with
                                           # seed-portal-demo-data.mjs (5eed… namespace). Idempotent.

node scripts/delete-demo-scenario.mjs     # Remove every record seeded by seed-demo-scenario.mjs.
                                           # Deletes in reverse FK order: orders → kid_achievements →
                                           # points_ledger → assignments → coach_messages → bookings →
                                           # sessions → personal_bests → memberships → kids → products →
                                           # family/peer auth users → demo coach auth users.
                                           # Coach Mike is NOT deleted (provisioned separately).
```

**Environment Variables:**

- `EXPO_PUBLIC_SUPABASE_URL`, `EXPO_PUBLIC_SUPABASE_ANON_KEY`, `EXPO_PUBLIC_TENANT_SLUG=infinitehitting`
- `SUPABASE_SERVICE_ROLE_KEY` (server-side only)
- `EXPO_PUBLIC_AUTH_REDIRECT_HOST` (optional; when set, signup confirmations redirect to `https://{host}/auth/callback` and `app.config.js` registers iOS/Android associated domains. Unset → falls back to `ballpark://` scheme.)
- Edge Function secrets (set via `npx supabase secrets set`): `RESEND_API_KEY`, `RESEND_FROM_EMAIL`, `MUX_TOKEN_ID`, `MUX_TOKEN_SECRET`, `MUX_WEBHOOK_SECRET`, `HITTRAX_BASE_URL`, `HITTRAX_PARTNER_ID`, `HITTRAX_API_KEY`, `HITTRAX_CONTENT_TYPE`.
- Stripe Connect (portal env vars): `STRIPE_SECRET_KEY`, `STRIPE_PUBLISHABLE_KEY`, `STRIPE_CONNECT_CLIENT_ID`, `STRIPE_WEBHOOK_SECRET`. Also set `STRIPE_SECRET_KEY` and `STRIPE_WEBHOOK_SECRET` as Supabase Edge Function secrets via `npx supabase secrets set`. See `docs/STRIPE_SETUP.md` for the full runbook.

## Stack

React Native / Expo SDK 54 / React 19 / TypeScript (strict) on mobile. Supabase (Postgres + Auth + Storage + Realtime + Edge Functions) on the backend. Stripe Connect for payments, Mux for video, Resend for email. Zustand (client state) + TanStack Query (server state). React Hook Form + Zod. StyleSheet + design tokens. Built with Expo EAS.

## Where things live

- `/src` — `screens/{Name}/` (Name.tsx + styles.ts + types.ts + components/), `components/{ui,layout,feature}/`, `api/` (one file per resource), `store/`, `theme/`, `lib/supabase.ts`, `types/database.ts` (generated)
- `/supabase` — `migrations/`, `functions/`, `seed/`
- Path aliases (`@/*` → `src/*`) in `tsconfig.json` and `babel.config.js`.
- `/portal` — Next.js admin portal.
- `/docs` — PRD, DESIGN, ARCHITECTURE, ROADMAP, PROMPTS, HITTRAX_INTEGRATION, TENANT_ISOLATION_AUDIT. **Authoritative architecture: `docs/ARCHITECTURE.md §9`.**

## Architecture decisions

- **Tenancy:** UUID `tenant_id` everywhere; `slug` is routing-only. Infinite Hitting = `00000000-0000-0000-0000-000000000001`. JWT custom claim is `app_role` (not the reserved `role`), injected via Supabase's Custom Access Token Hook. UI enforces one kid per family for v0.5; schema supports many.
- **Coach provisioning:** admin-created via Supabase Admin API with `raw_user_meta_data.app_role='coach'`; `handle_new_user` trigger branches on `app_role`. No in-app coach signup. Reference: `scripts/provision-coach-mike.mjs`.
- **Stripe Connect:** onboarding handled out-of-band via Stripe-hosted dashboards; the app only consumes `stripe_account_id`.
- **Mux Webhook (`mux-webhook`):** deployed `--no-verify-jwt`; auth is `Mux-Signature` HMAC vs `MUX_WEBHOOK_SECRET` (300s replay window). Idempotent on `videos.mux_asset_id` UNIQUE — UPDATE only, never INSERT. Unknown asset/upload ids → 503 to force Mux retry.
- **Coach video notifications:** push (Expo) + email (Resend) fire from `mux-webhook` on `video.asset.ready` for `purpose='coach_message'`, best-effort via `Promise.allSettled`. Replay path intentionally does NOT fan out — only the first ready-update sends. Never fired from `mux-create-upload` or the client.
- **`device_tokens`:** UNIQUE on `(user_id, expo_push_token)` — never global. Same physical device can switch accounts (sibling on Expo Go) without 409. `src/services/notifications.ts:upsertDeviceToken` also DELETEs other rows for that token belonging to a different user.
- **HitTrax pipeline (v0.7):** five Edge Functions split by trust boundary — `hittrax-associate`/`hittrax-disconnect` (parent JWT), `hittrax-poll` (service-role, pg_cron every 2 min), `hittrax-registration-complete`/`hittrax-forget` (`--no-verify-jwt`, constant-time PartnerID+APIKey check). Per-user HitTrax password lives in `kid_capture_links.third_party_user_password` and is NEVER returned to the client. Polling cursor `last_polled_through` only advances on successful UPSERT batch (30s safety slack on `EndDate`). Full runbook: `docs/HITTRAX_INTEGRATION.md`.

## Product

- Auth (signup, sign-in, sign-out from parent Me + coach home), kid registration, Home dashboard
- Booking system (private / group / cage), upcoming + past
- Coach ↔ family video messaging (Mux pipeline both directions, full-screen playback marks viewed)
- Earn (Rewards / Store / Ranks / Rules) with 8-char redemption codes + QR + live leaderboard
- Drill assignments (coach assigns, parent submits, coach reviews 1–5★ + feedback)
- Achievements catalog with auto-grants + bonus points + push fan-out
- Profile screen with PRs grid, achievements grid, settings
- Train library (HQ-curated training videos)
- HitTrax integration (auto-imported sessions/swings/PRs)

## Status

- v0.1–v0.7 shipped + Task #135 consolidation. Detailed history below — most recent first.

### Task #135 — UI consolidation back to v0.4 5-tab nav (2026-05-09)
Rolled the over-built 7-tab nav back to **HOME · WORK · BOOK · EARN · ME**. WORK absorbs Videos+Train+Messages+Send-to-coach behind 5 in-screen sub-tabs (Swings / Assign / Messages / HW / Drills). EARN re-merges Rewards/Store/Ranks/Rules behind 4 pill sub-tabs. Inline video upload in Messages composer. UI/navigation only — all v0.6/v0.7 schema, RLS, RPCs, edge functions intact and absorbed screens reused verbatim. Deep-link support: `WorkStackParamList.WorkHome.params.initialSubTab` and `EarnStackParamList.EarnHome.params.initialSubTab`.

### v0.7 #122 — Profile / Achievements / Leaderboard polish / QR codes (2026-05-09)
Migration `20260511000000_v07_achievements_and_fulfillment.sql`: `achievements` catalog (12 seeded) + `kid_achievements` log + `_grant_achievement(kid, key)` SECURITY DEFINER fn that writes a `points_ledger reason='achievement_bonus'` bonus and pings `notify-achievement` via pg_net. Per-source-table grant triggers on `points_ledger` / `swings` / `personal_bests` / `orders` / `coach_messages` / `assignments`. `mark_redemption_fulfilled(p_code)` admin-gated RPC (FOR UPDATE-locks the order, gates on `payment_method='points'` AND `status='ordered'`). New mobile `ProfileScreen` (`src/screens/Me/ProfileScreen.tsx`) replaces `MeScreen`; rebuilt `RanksScreen` with podium + `get_kid_weekly_rank_delta` RPC; `react-native-qrcode-svg` on `RewardRedeemScreen`. Three new Edge Functions (`notify-achievement`, `notify-assignment-reviewed`, `notify-leaderboard-weekly`) with durable idempotency via `notification_log`. Portal `/admin/redemptions` with `<QRScanner />` (html5-qrcode). **Operator note:** for trigger pg_net push to fire, set `app.settings.supabase_url` + `app.settings.service_role_key` GUCs once per env, then `SELECT pg_reload_conf()`. Migration tolerates them being absent.

### v0.7 #121 — Train library + Video Player (2026-05-09)
Migrations `20260510000000` + `20260510000001`: `training_videos` catalog + `training_video_views` log + `record_training_view(video_id, kid_id)` RPC with **server-side per-session dedupe** (≤1 view-count increment per kid/video per 30 min). RLS: tenant members SELECT published; admins SELECT drafts + own all writes. `videos.purpose` extended with `'training'`. Mobile `TrainStackNavigator` (TrainHome + TrainingVideoPlayer): filter chips, featured hero, Continue Watching from AsyncStorage (`ballpark.trainingProgress.v1.{kidId}`), 2-col grid. Player throttles position writes ~3s, fires `record_training_view` once per mount. Portal `/admin/training-videos` with category+status filters and Mux Direct Upload via `/api/admin/training-uploads` proxy.

### v0.7 #120 — Share Card + Send Video to Coach (2026-05-09)
Migration `20260509000000_v07_parent_to_coach_messages.sql`: `videos.purpose` += `'parent_to_coach'`; `coach_messages.{label, sender_display}`; six new RLS policies for bidirectional thread. `mux-create-upload` branches on `purpose` (coach/drill require `app_role='coach'`, parent_to_coach requires `app_role='parent'`). Share Card: dual-render pattern in `ShareCardScreen` (220px on-screen preview + off-screen 1080×1920 view that `react-native-view-shot` captures). Send-to-coach: 4-step composer in `SendVideoToCoachScreen`. Bidirectional thread in `MessageThreadScreen` (parent gold-on-dark right, coach dark-on-gold left). Coach push fired SERVER-SIDE from `mux-webhook` `fanOutParentToCoachNotifications` for `purpose='parent_to_coach'`.

### v0.7 #119 — Videos surface + favorites (2026-05-08)
Migration `20260508080000_v07_kid_swing_favorites.sql`: `kid_swing_favorites UNIQUE(kid_id, swing_id)` + `toggle_swing_favorite(p_swing_id)` SECURITY DEFINER RPC (derives `kid_id`+`tenant_id` from the swing row; never trusts client params). Optimistic `useToggleFavorite`. Originally introduced a 7-tab nav with dedicated Videos/Train/Rewards/Ranks tabs — rolled back in #135 but the underlying screens (`SwingDetail`, `SessionDetail`) are reused under WorkStack. Home gained `LatestPersonalBestCard`. SwingDetail renders a 16:9 placeholder for the per-swing clip (HitTrax is metric-only; per-swing Mux clips ship later).

### v0.6 — Drill assignments (2026-05-06)
Coach assigns drill (title, notes, optional Mux drill video, duration, due date, point reward default 25). Parent sees pending on Home + Work, taps "Mark as done" → +25 pts via SECURITY DEFINER RPC. Coach reviews from a queue scoped to own assignments with 1–5★ + feedback. `videos.purpose ∈ ('coach_message','drill')` set by `mux-create-upload`.

### v0.5 — Earn (2026-05-06)
4 sub-tabs (Rewards / Store / Ranks / Rules + history). Server-issued 8-char redemption codes shown in-app and in Me → Orders. Live tenant leaderboard. +10 pts auto-credited when a coach marks a booking `completed`.

### v0.4 — Coach → Family video messaging (2026-05-05)
Coach records/uploads via Mux, parent gets email + in-app card, full-screen playback marks viewed.

### v0.1–v0.3
Foundation, Home dashboard, Booking system (private/group/cage with coaches, upcoming + past).

## Cross-tenant RLS audit

Run `node scripts/audit-tenant-isolation.mjs 'AuditFixtures2026!'` (exit 0 = PASS). One-time setup per env: `node scripts/provision-audit-fixtures.mjs 'AuditFixtures2026!'` then `node scripts/seed-audit-rows.mjs`. Full results, methodology, migration SQL, defence-in-depth notes: **`docs/TENANT_ISOLATION_AUDIT.md`**.

## v0.5 Deferred (intentional, still relevant)

- **Stripe Connect card checkout** for purchase-only / dual-priced store items. Schema supports it (`orders.payment_method='card'`, `amount_paid_cents`, `stripe_payment_intent_id`); UI today points the parent at the front desk.
- **Nightly leaderboard snapshot** — Ranks queries `kids` live (top 50 by `points_balance`); fine for one tenant, will need a snapshot table at scale.

## Generated types caveat (recurring)

`src/types/database.ts` is regenerated by `scripts/post-merge.sh` after each migration runs in CI. New tables/RPCs introduced in v0.7 (`training_videos`, `record_training_view`, `achievements`, `kid_achievements`, `mark_redemption_fulfilled`, `_grant_achievement`, `coach_messages.{label,sender_display}`) are accessed via `SupabaseClient` cast (the un-typed client, **not `any`**) until the next regen. Source of truth remains the migrations + RPC SQL signatures.

## Gotchas

- `npm install` requires `--legacy-peer-deps` (also `npx expo install <pkg> -- --legacy-peer-deps`).
- The Replit preview pane is not for mobile testing — use Expo Go on a physical device.
- Supabase email confirmation: signups pass `emailRedirectTo = ballpark:///auth/callback` (PKCE). Add that URL to Supabase Auth → URL Configuration → Redirect URLs allow-list per env.
- Stale JWTs after schema changes: sign out + back in to refresh tokens.
- Tables created via raw SQL may lack default GRANTs; explicit `GRANT` required.
- `err instanceof Error` is wrong for `PostgrestError`/`AuthError`; use `errorMessage(err)` from `src/utils/error.ts`.
- Metro must NOT watch `.local/` — Replit churns dirs there constantly. Exclusions in `metro.config.js` `resolver.blockList`. Never put platform-managed dirs under `src/`.
- `Expo dev (proxy)` workflow MUST be `outputType: "console"` (not `webview`). Metro is a packager — a bare `GET /` from a browser yields `CommandError: Must specify "expo-platform" header` (502 in canvas iframe). Test only via Expo Go QR in console.
- **Expo Go physical device (Replit sandbox architecture):** `ngrok` and LAN tunnels are blocked in Replit. `REPLIT_EXPO_DEV_DOMAIN` (no port) routes all external traffic to the portal (port 3000) regardless of port suffix. The durable fix: `portal/next.config.ts` rewrites any request carrying `expo-platform` header to `http://localhost:8080` (Metro). `portal/middleware.ts` short-circuits Supabase auth for `expo-platform` requests so they reach the rewrite layer. Expo dev (proxy) workflow uses `EXPO_MANIFEST_PROXY_URL="https://$REPLIT_EXPO_DEV_DOMAIN"` (no port) so the QR code is `exp://[expo-dev-domain]` (→ portal → Metro). Do NOT add a port number or change the proxy domain — it breaks the routing chain.
- Editing `supabase/functions/<name>/` does NOT change what Supabase serves until `npx supabase functions deploy <name>` runs. The three webhook-style fns (`mux-webhook`, `hittrax-registration-complete`, `hittrax-forget`) need `--no-verify-jwt`. `scripts/post-merge.sh` re-deploys all of them automatically after every task merge.
- HitTrax keys (`HITTRAX_PARTNER_ID`, `HITTRAX_API_KEY`, `HITTRAX_BASE_URL`) — until set, every HitTrax fn returns `503 hittrax_not_configured`. Local exercise: `node scripts/replay-hittrax-fixture.mjs <kid_uuid>` against `_shared/fixtures/hittrax-sample.json`.

## User preferences

- _Populate as you build_

## Pointers

- **Full Project Context:** `CLAUDE.md`, `/docs` (PRD, DESIGN, ARCHITECTURE, ROADMAP, PROMPTS, HITTRAX_INTEGRATION, TENANT_ISOLATION_AUDIT)
- **Authoritative Architecture:** `docs/ARCHITECTURE.md §9`
- [Supabase docs](https://supabase.com/docs) · [Expo docs](https://docs.expo.dev/) · [React Native docs](https://reactnative.dev/docs/)
