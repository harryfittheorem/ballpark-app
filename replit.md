# Ballpark

A multi-tenant SaaS operating system for youth sports performance facility franchises, starting with an athlete-facing mobile app for kids and parents.

## Run & Operate

```bash
npm run dev          # expo start --tunnel (test on phone via Expo Go)
npm run typecheck    # tsc --noEmit
npm run lint         # eslint
```

**Environment Variables:**

- `EXPO_PUBLIC_SUPABASE_URL`
- `EXPO_PUBLIC_SUPABASE_ANON_KEY` (Supabase publishable key)
- `EXPO_PUBLIC_TENANT_SLUG=infinitehitting`
- `SUPABASE_SERVICE_ROLE_KEY` (Supabase secret key, server-side only)
- `EXPO_PUBLIC_AUTH_REDIRECT_HOST` (optional; e.g. `app.ballpark.com`. When set, signup confirmation emails redirect to `https://{host}/auth/callback` and `app.config.js` registers iOS associated domains + Android App Links for that host. When unset, falls back to the `ballpark://` custom scheme.)
- `RESEND_API_KEY` (Supabase Edge Function secret; never `EXPO_PUBLIC_*`. Set via `npx supabase secrets set RESEND_API_KEY=...`. Used by `send-coach-video-notification`.)
- `RESEND_FROM_EMAIL` (Supabase Edge Function secret; defaults to `onboarding@resend.dev` for dev. Set via `npx supabase secrets set RESEND_FROM_EMAIL=...`.)

Real testing occurs on a physical phone via Expo Go. Replit Deployments are not used; production ships through Expo EAS. `npm install` requires `--legacy-peer-deps`.

## Stack

- **Mobile:** React Native, Expo SDK 54, TypeScript (strict), React 19
- **Backend:** Supabase (Postgres, Auth, Storage, Realtime, Edge Functions)
- **Payments:** Stripe Connect
- **Video:** Mux
- **Email:** Resend
- **State Management:** Zustand (client), TanStack Query (server)
- **Forms:** React Hook Form, Zod
- **Styling:** StyleSheet, design tokens
- **Build Tool:** Expo EAS

## Where things live

- **Source Code:** `/src`
    - Screens: `/src/screens/{ScreenName}/` (ScreenName.tsx, styles.ts, types.ts, components/)
    - Components: `/src/components/{ui,layout,feature}/`
    - API: `/src/api/` (one file per resource)
    - State (Zustand): `/src/store`
    - Theme: `/src/theme/` (tokens.ts, fonts.ts, index.ts)
    - Supabase Client: `/src/lib/supabase.ts`
- **Database Schema:** `/supabase/migrations`
- **Supabase Edge Functions:** `/supabase/functions` (`mux-create-upload`, `mux-webhook`)
- **Supabase Seed Data:** `/supabase/seed`
- **Design Tokens:** `/src/theme/tokens.ts`
- **Database Types:** `/src/types/database.ts` (generated)

Path aliases (`@/*` → `src/*`) are configured in `tsconfig.json` and `babel.config.js`.

## Architecture decisions

-   **Tenant ID:** UUIDs are used for tenant identification; `slug` is a separate column for routing. Infinite Hitting's tenant UUID is `00000000-0000-0000-0000-000000000001`.
-   **JWT Custom Claims:** Supabase's Custom Access Token Hook (Postgres function) is used to inject custom claims into JWTs, specifically `app_role` instead of the reserved `role` claim.
-   **One Kid Per Family (v0.5):** The UI currently enforces one kid per family for simplicity, though the schema supports multiple for future expansion.
-   **Folder Structure:** The nested per-screen folder structure outlined in `ARCHITECTURE.md §9` is authoritative.
-   **Stripe Connect Onboarding:** Handled out-of-band via Stripe-hosted dashboards; the app only consumes the `stripe_account_id`.
-   **Coach Provisioning:** Coaches are admin-created via the Supabase Admin API with `raw_user_meta_data.app_role='coach'`; the `handle_new_user` trigger branches on `app_role` and inserts into `public.coaches` instead of `public.families`. There is no in-app coach signup screen. Use `scripts/provision-coach-mike.mjs` as the reference invocation.
-   **Mux Webhook:** `mux-webhook` Edge Function is deployed `--no-verify-jwt`; auth is the `Mux-Signature` HMAC over the raw body against `MUX_WEBHOOK_SECRET` (300s replay window). Idempotent: every UPDATE keys on the UNIQUE `videos.mux_asset_id` and never INSERTs. Unknown asset/upload ids return 503 so Mux retries with backoff; unhandled event types ack 200 ignored.
-   **Coach video notifications:** Push (Expo) + email (Resend) for a coach video are fired from inside `mux-webhook` on `video.asset.ready` once the row is updated to `status='ready'` AND `videos.purpose='coach_message'`. Both `send-push-notification` and `send-coach-video-notification` are invoked best-effort via `Promise.allSettled`; any failure is logged but never changes the 200 to Mux. The idempotent-replay path (Path C) intentionally does NOT fan out — only the first successful ready-update sends. They are NOT sent from `mux-create-upload` or from the client.
-   **device_tokens uniqueness:** `public.device_tokens` is `UNIQUE (user_id, expo_push_token)` — never a global unique on the token alone, so the same physical device can switch accounts (sibling on Expo Go, etc.) without a permanent 409. The client upsert path (`src/services/notifications.ts:upsertDeviceToken`) also DELETEs other rows for the same token belonging to a different user.
-   **HitTrax pipeline (v0.7 task #118):** Five Edge Functions split by trust boundary — `hittrax-associate` / `hittrax-disconnect` (parent JWT), `hittrax-poll` (service-role, pg_cron every 2 min), `hittrax-registration-complete` / `hittrax-forget` (`--no-verify-jwt`; HitTrax inbound auth is a constant-time PartnerID + APIKey check on URL params — there is no HMAC, no OAuth in v1.0). Idempotency: `swings UNIQUE(capture_source, capture_event_id)`, partial `sessions UNIQUE(capture_source, capture_session_id)`, `kid_capture_links UNIQUE(capture_source, third_party_user_id)` and `UNIQUE(kid_id, capture_source)`. PR award fires from `detect_swing_pr` AFTER INSERT trigger and writes `points_ledger reason='pr_hit'`, idempotent via partial `UNIQUE(reference_id) WHERE reason='pr_hit' AND reference_type='swing'`. The polling cursor (`last_polled_through`) advances **only** on successful UPSERT batch — failures leave it untouched so the next run retries the same window with a 30s safety slack on `EndDate`. Push fan-out is `Promise.allSettled` best-effort — never blocks the cursor. The HitTrax-issued per-user password lives in `kid_capture_links.third_party_user_password` and is NEVER returned to the client (`src/api/hittrax.ts` projects an explicit allow-list). Full runbook: `docs/HITTRAX_INTEGRATION.md`.

## Product

-   User authentication (signup, sign-in, sign-out — sign-out available on parent Me tab and coach home)
-   Kid registration for a family
-   Home dashboard with athlete stats, upcoming sessions, and quick actions
-   Booking system for private, group, and cage sessions with coaches
-   Displaying upcoming and past bookings
-   Coach → family video messaging: coach records/uploads via Mux, parent gets email + in-app card, full-screen playback marks viewed (v0.4 ✅ shipped 2026-05-05)
-   Earn tab with 4 sub-tabs (Rewards, Store, Ranks, Earn rules + history). Parents redeem rewards for points → server-issued 8-char redemption code displayed in-app and in Me → Orders. Live tenant leaderboard. +10 pts auto-credited when a coach marks a booking 'completed' (v0.5 ✅ shipped 2026-05-06).
-   Drill assignments (v0.6 ✅ shipped 2026-05-06): coach assigns a drill (title, notes, optional Mux drill video, duration, due date, point reward, default 25). Parent sees pending drills on Home + Work tab, taps "Mark as done" → +25 pts via SECURITY DEFINER RPC. Coach later reviews from a queue scoped to their own assignments with 1–5 stars + feedback. Drill vs coach-message uploads are tagged via `videos.purpose ∈ ('coach_message','drill')`, set by `mux-create-upload` from the client's `purpose` body param.

## Status

-   v0.1 Foundation, v0.2 Home, v0.3 Booking, v0.4 Messages, v0.5 Earn, **v0.6 Work** all shipped. Next: v0.7 per ROADMAP.

## Cross-tenant RLS audit (task #86, 2026-05-08)

-   Run `node scripts/audit-tenant-isolation.mjs 'AuditFixtures2026!'` to re-execute the 14-table × 4-user adversarial probe matrix (170 probes, 0 skipped after seeding). Exit 0 = PASS. One-time setup per environment: `node scripts/provision-audit-fixtures.mjs 'AuditFixtures2026!'` then `node scripts/seed-audit-rows.mjs`.
-   Full results, methodology, and migration SQL: `docs/TENANT_ISOLATION_AUDIT.md`.
-   `kids` policies (`kids_insert_own_family`, `kids_update_own_family`) now pin `families.tenant_id = JWT tenant_id` inside the families sub-select. Defence-in-depth — `public.kids` has no direct `tenant_id` column, so the pin must live in the join.

## v0.5 Deferred (intentional)

-   **Stripe Connect card checkout** for purchase-only / dual-priced store items. The Store tab today shows items with an Alert that points the parent at the front desk. Schema already supports it (`orders.payment_method='card'`, `amount_paid_cents`, `stripe_payment_intent_id`).
-   **QR codes** on redemption codes — codes are alphanumeric for now; QR rendering can be added later via `react-native-qrcode-svg`.
-   **Nightly leaderboard snapshot** — `Ranks` tab queries `kids` live (top 50 by `points_balance`); fine for one tenant, will need a snapshot table at scale.
-   **Assignment / PR triggers** — only the booking-completion trigger is wired; assignments and swing PRs ship in v0.6 / v0.7.

## User preferences

-   _Populate as you build_

## Gotchas

-   `npm install` requires `--legacy-peer-deps` (also: `npx expo install <pkg> -- --legacy-peer-deps`).
-   The Replit preview pane is not for mobile app testing; use Expo Go on a physical device.
-   Supabase email confirmation: signups pass `emailRedirectTo = ballpark:///auth/callback` (PKCE flow). The deep-link handler in `useAuth.tsx` exchanges the returned `?code=...` for a session. Add that URL to Supabase Auth → URL Configuration → Redirect URLs allow-list per environment.
-   Existing test sessions might hold stale JWTs after schema changes; sign out and sign back in to refresh tokens.
-   Tables created via raw SQL migrations may lack default GRANTs; explicit `GRANT` statements are required.
-   `err instanceof Error` is incorrect for Supabase `PostgrestError`/`AuthError`; use `errorMessage(err)` from `src/utils/error.ts`.
-   Metro must NOT watch `.local/` — the Replit platform constantly creates and removes dirs there (skills, tasks, logs) and Metro crashes with `ENOENT watch …` on bundle. Exclusions live in `metro.config.js` `resolver.blockList`; add any new platform-managed dir there, never under `src/`.
-   The `Expo dev (proxy)` workflow MUST be `outputType: "console"`, not `webview`. Metro is a packager, not a web app — a bare `GET /` from a browser/iframe yields `CommandError: Must specify "expo-platform" header or "platform" query parameter` and the Replit edge surfaces that as 502 in the canvas Mobile App iframe. Test only via Expo Go on a physical phone scanning the QR shown in the workflow console.
-   Editing a file under `supabase/functions/<name>/` does NOT change what Supabase serves — the runtime only knows about the last `npx supabase functions deploy <name>` push. Same gotcha applies to ALL nine Edge Functions (`mux-create-upload`, `mux-webhook`, `send-push-notification`, `send-coach-video-notification`, `hittrax-associate`, `hittrax-poll`, `hittrax-disconnect`, `hittrax-registration-complete`, `hittrax-forget`); a stale deploy of `send-coach-video-notification` will silently swallow Resend errors with the OLD code. Symptom for `mux-create-upload`: the coach Record Video flow shows `Upload failed — Upload service returned status 404 [function_error]`. Re-deploy with `npx supabase functions deploy <name>`; the three webhook-style functions (`mux-webhook`, `hittrax-registration-complete`, `hittrax-forget`) need `--no-verify-jwt` because their callers authenticate with non-JWT signatures. Secrets (`MUX_TOKEN_ID`, `MUX_TOKEN_SECRET`, `MUX_WEBHOOK_SECRET`, `RESEND_API_KEY`, `RESEND_FROM_EMAIL`, `HITTRAX_BASE_URL`, `HITTRAX_PARTNER_ID`, `HITTRAX_API_KEY`, `HITTRAX_CONTENT_TYPE`) live separately on the Supabase project and are set via `npx supabase secrets set KEY=...`. `scripts/post-merge.sh` re-deploys all nine automatically after every task merge.
-   HitTrax keys (`HITTRAX_PARTNER_ID`, `HITTRAX_API_KEY`, `HITTRAX_BASE_URL`) arrive 2026-05-09 — until then every HitTrax Edge Function returns `503 hittrax_not_configured` and the Me → HitTrax screen surfaces it as a friendly error. To exercise the full chain locally (sessions/swings/PR/points trigger, push fan-out), run `node scripts/replay-hittrax-fixture.mjs <kid_uuid>` against the canned `_shared/fixtures/hittrax-sample.json`.

## Pointers

-   **Full Project Context:** `CLAUDE.md`, `/docs` (PRD, DESIGN, ARCHITECTURE, ROADMAP, PROMPTS)
-   **Authoritative Architecture:** `ARCHITECTURE.md §9`
-   **Supabase Documentation:** [https://supabase.com/docs](https://supabase.com/docs)
-   **Expo Documentation:** [https://docs.expo.dev/](https://docs.expo.dev/)
-   **React Native Documentation:** [https://reactnative.dev/docs/](https://reactnative.dev/docs/)