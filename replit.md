# Ballpark — Replit Workspace Notes

Multi-tenant SaaS operating system for youth sports performance facility franchises. Anchor customer: **Infinite Hitting** (17-location youth baseball franchise). Currently building the **athlete-facing mobile app** (React Native + Expo) for kids and parents.

For full project context see `CLAUDE.md` and `/docs` (PRD, DESIGN, ARCHITECTURE, ROADMAP, PROMPTS).

---

## Tech Stack (locked)

- **Mobile:** React Native + Expo SDK 54, TypeScript strict mode, React 19
- **Backend:** Supabase (Postgres + Auth + Storage + Realtime + Edge Functions)
- **Payments:** Stripe Connect (v0.5)
- **Video:** Mux (v0.4)
- **Email:** Resend (v0.3)
- **State:** Zustand (client) + TanStack Query (server)
- **Forms:** React Hook Form + Zod
- **Styling:** StyleSheet + design tokens from `/src/theme/tokens.ts`
- **Builds:** Expo EAS (cloud — Replit cannot build native binaries)

---

## How to run

```bash
npm run dev          # expo start --tunnel  (test on phone via Expo Go)
npm run typecheck    # tsc --noEmit
npm run lint         # eslint
```

The Replit preview pane is **not** the target — this is a native mobile app. Real testing happens on a phone via Expo Go scanning the QR from `npm run dev` (tunnel mode). Replit Deployments are not used for this project; production ships through Expo EAS.

`npm install` requires `--legacy-peer-deps` due to a React 19 peer-dep declaration in some libs (lucide-react-native, react-navigation chain). Resolution works correctly at runtime.

---

## Environment

Secrets live in Replit `.replit` userenv (already configured):

- `EXPO_PUBLIC_SUPABASE_URL`
- `EXPO_PUBLIC_SUPABASE_ANON_KEY` — **publishable key** from the new Supabase API key system (starts with `sb_publishable_...`, not the legacy `eyJ...` JWT). The project has migrated its legacy JWT secret to JWT Signing Keys, so the old `anon` JWT is verify-only and no longer accepted as an API key. We kept the env-var name as `EXPO_PUBLIC_SUPABASE_ANON_KEY` for code stability — `supabase-js` accepts the publishable key in the same slot.
- `EXPO_PUBLIC_TENANT_SLUG=infinitehitting`
- `SUPABASE_SERVICE_ROLE_KEY` — **secret key** from the new key system (`sb_secret_...`). Server/admin-only; never bundle into the mobile app (no `EXPO_PUBLIC_` prefix). Used by `scripts/verify-auth-hook.mjs` to admin-create + clean up throwaway users so the smoke test runs end-to-end regardless of email-confirmation settings.

Server-side keys (Stripe secret, Mux, Resend, Twilio, Anthropic) live in Supabase Edge Functions secrets, **not** in the mobile app bundle. Only `EXPO_PUBLIC_*` vars are bundled into the app.

---

## Folder structure (authoritative: ARCHITECTURE.md §9)

```
/src
├── /screens/{Home,Work,Book,Earn,Me,Auth,Detail}/  # ScreenName.tsx + styles.ts + types.ts + components/
├── /components/{ui,layout,feature}/
├── /navigation
├── /api              # one file per resource
├── /hooks
├── /store            # Zustand
├── /theme            # tokens.ts, fonts.ts, index.ts
├── /utils
├── /types            # database.ts (generated) + domain.ts
└── /lib              # supabase.ts, stripe.ts, mux.ts
/supabase/{migrations,functions,seed}
```

Path aliases configured in both `tsconfig.json` and `babel.config.js` (via `babel-plugin-module-resolver`): `@/*` → `src/*`, plus per-folder aliases.

---

## Resolved doc decisions (May 2026 kickoff)

1. **Tenant ID:** UUIDs only. `slug` is a separate column for URL routing. Infinite Hitting tenant UUID is hardcoded in seed: `00000000-0000-0000-0000-000000000001`.
2. **JWT custom claims:** Use Supabase's **Custom Access Token Hook** (registered Postgres function under Auth → Hooks). A plain trigger on `auth.users` cannot inject JWT claims. ARCHITECTURE.md §4 was updated to reflect this.
3. **One kid per family in v0.5:** Enforced in UI only (AddKidScreen checks for existing kid → routes to MainTab). Schema supports many kids per family for future-proofing.
4. **Folder structure:** ARCHITECTURE.md §9 is authoritative (nested per-screen folders). CLAUDE.md was updated to point at it.
5. **Replit Deployments:** Not used. Mobile ships via EAS.
6. **Stripe Connect onboarding:** Out-of-band via Stripe-hosted Express dashboards. App just consumes `stripe_account_id` from the location record.

---

## Current status

- **Phase:** v0.3 — Booking System — Phase A + Phase B COMPLETE (Steps 3.1–3.8 MERGED 2026-05-05). Remaining v0.3 work: 3.9 (Home Upcoming Session pulls real data), 3.10 (Bookings list in Me tab).
- **Done (v0.1):** Expo + TypeScript scaffolding, theme tokens + fonts, Supabase schema + RLS + custom access token hook (with the `app_role` / GRANT fixes from Task #19), Supabase client (`src/lib/supabase.ts`, SecureStore-persisted session), auth API (`src/api/auth.ts`), AuthProvider + useFamily hooks, SignUp/SignIn/AddKid screens, sign-out escape hatch on AddKid, RootNavigator that gates between Auth → AddKid → MainTabs, 5-tab bottom nav (Home/Work/Book/Earn/Me) with placeholder screens.
- **Done (v0.2):** Form primitives (FormField/FormInput) + RHF + Zod migration on SignIn/SignUp/AddKid, TanStack Query data layer wrapping `useFamily`, Home tab scaffold + HomeHeader, and the 5 Home cards matching `/design/InfiniteHittingApp.jsx`: HeroCard (gold gradient kid identity), StatTilesRow (sessions/points/streak), CoachVideoCard (compact left-thumb), UpcomingSessionCard (compact eyebrow), QuickActionsRow. Step 2.10 polish locked in token-only sizing on Home.
- **Verified (v0.2 sign-off, 2026-05-05):** Full phone smoke pass on Expo Go — cold start, sign in/out/up, AddKid, all 5 Home cards render with correct data, force-quit persistence, tab switching across all 5 tabs, Me tab shows email/family + sign-out. `npm run typecheck` + `npm run lint` clean. `node scripts/verify-auth-hook.mjs` PASS (tenant_id/family_id/app_role injected; reserved `role` claim preserved at 'authenticated').
- **Done (v0.3 Step 3.1):** Bookings + sessions schema migration (`20260505050000_v03_bookings_schema.sql`) — added `session_types`, `coach_availability`, `bookings` tables with FK indexes, `updated_at` triggers (session_types + bookings), RLS enabled, tenant-pinned policies (parent CRUD over own family's bookings; coach SELECT for own assignments; SELECT-by-tenant on session_types + coach_availability), per-table GRANTs to `authenticated`, types regenerated. Code-review follow-up `20260505051000_harden_bookings_fk_tenant_pin.sql` extends the bookings INSERT/UPDATE WITH CHECK to verify `coach_id` / `location_id` / `session_type_id` rows belong to the JWT tenant — closes a cross-tenant FK smuggling vector. `npm run typecheck` + `npm run lint` clean. `verify-auth-hook` still PASS.
- **Done (v0.3 Step 3.2):** Bookings dev seed migration (`20260505060000_v03_bookings_seed.sql`) — drops `coaches.user_id NOT NULL` so admin-provisioned ("ghost") coaches can exist before signup (UNIQUE preserved; JWT-hook `WHERE user_id = auth.uid()` lookup remains safe with NULL); seeds Coach Mike (`...0201`) at Dallas N., 4 `session_types` (Private 30/60, Group, Cage at $45 / $85 / $35 / $25), and 3 `coach_availability` rows for Coach Mike on Tue/Thu/Sat 09:00–12:00. All inserts idempotent via stable UUIDs + `ON CONFLICT (id) DO NOTHING`. Remote verification: 1 coach / 4 session_types / 3 availability rows. Types regenerated (`coaches.Row.user_id: string | null`). All gates pass.
- **Done (v0.3 Step 3.8):** Booking confirmation closes Phase B. `SummarySection` now renders the resolved session type / formatted date / formatted start time (in the location timezone) / coach display name / USD price, with a primary `Confirm Booking` button. `createBooking()` in `src/api/bookings.ts` + `useCreateBooking` mutation hook (`src/screens/Book/hooks/useCreateBooking.ts`) insert into `public.bookings` with `status='confirmed'`, then invalidate `['day_bookings', ...]` and `['upcoming_bookings', ...]`. On success the BookScreen resets selection state, navigates to the Home tab, and a new lightweight `ToastProvider` (`src/components/ui/Toast.tsx`, mounted in `App.tsx`) surfaces "Session booked for {date} at {time}". On failure an inline error appears under the button with a Retry affordance (Supabase error message shown in dev only). All existing RLS / tenant-pin policies enforce the write. `npm run typecheck` + `npm run lint` clean.
- **Next milestone:** v0.3 Step 3.9 — Home tab Upcoming Session card pulls real `bookings` data, then 3.10 — Bookings list in Me tab.

### Scope discipline notes (Task #15 + Task #18 reverts; v0.1 closed)
Task #7 (multi-kid editing — KidForm, MeStackNavigator, EditKid/AddKid modals, avatar picker, `kid-avatars` storage bucket) was merged out of scope and reverted in Task #15. v0.1 stays at "one kid per family, single AddKid screen, Me tab is read-only with sign-out". Multi-kid editing is deferred to v0.6. The `kid-avatars` storage bucket + RLS policies were removed in `supabase/migrations/20260505030000_drop_kid_avatars_storage.sql` (drops the four `kid_avatars_*` policies, then deletes bucket objects + the bucket itself; the migration temporarily disables Supabase's `protect_objects_delete` / `protect_buckets_delete` triggers because those block direct SQL DELETE on `storage.*`). On the live remote DB the bucket was already removed out-of-band via the Storage REST API before the migration was finalized, so the SQL DELETEs ran as a no-op there; on a fresh `supabase db reset` the migration performs the full cleanup itself. `expo-image-picker` was removed from `package.json`.

Task #9 (email-confirmation "check your email" screen + 4s `signInWithPassword` polling loop + `resendSignUpConfirmation` API helper) was also merged out of scope and reverted in Task #18. The polling pattern was a workaround for not having proper deep-link auth handling. v0.1 stays at "signup → AuthProvider's `onAuthStateChange` listener flips RootNavigator forward → AddKid". Email confirmation + deep-link auth handling are deferred to v0.5+. If Supabase's "Confirm email" project setting is left ON, signup returns `{ session: null }` and the parent appears stuck on the SignUp screen with no error — that's the documented pre-#9 behavior; flip the setting OFF in the Supabase dashboard for v0.1 testing.

### Auth flow notes
- Signup passes `tenant_slug: 'infinitehitting'` in `options.data`; the Postgres `handle_new_user` trigger provisions a `families` row.
- A new parent lands on AddKid until they add their first kid (kid count drives the root nav switch).
- Session is persisted via `expo-secure-store` (web fallback: localStorage).
- `react-native-url-polyfill` is required by `@supabase/supabase-js` on RN.

### Task #19 fix notes
Two latent bugs were uncovered while debugging "Add Kid → Unknown error":
1. `custom_access_token_hook` was overwriting the JWT's reserved `role` claim with the application value (`'parent'` / `'coach'`). PostgREST consumes `role` as the Postgres role to `SET ROLE` into for each request — once we wrote `'parent'` there, every authenticated REST call returned `401 role "parent" does not exist`. Migration `20260505040800_rename_role_to_app_role_in_jwt.sql` renames the application claim to `app_role` and updates the two RLS policies that referenced it (`families_select_coach_stub`, `kids_select_coach_stub`). `verify-auth-hook.mjs` now also asserts `payload.role === 'authenticated'` so we can't regress.
2. Tables created via raw `CREATE TABLE` migrations don't inherit the default GRANTs Supabase Studio applies when you create tables through the dashboard. RLS runs *on top of* base table privileges, so without an explicit GRANT every query failed with `403 permission denied for table <name>`. Migration `20260505041500_grant_table_privileges_to_authenticated.sql` adds per-table grants matching the RLS scope (e.g. `kids` gets full CRUD; `families` gets SELECT+UPDATE only since INSERT is trigger-driven).
- Existing test sessions hold a stale JWT with the old broken claims. Sign out + sign back in to mint a fresh token after these migrations apply.
- Supabase error surfacing: `errorMessage(err)` in `src/utils/error.ts` is the canonical helper for catch blocks; `err instanceof Error` is wrong for PostgrestError/AuthError (plain objects).
