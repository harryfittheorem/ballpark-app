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
- **Supabase Edge Functions:** `/supabase/functions`
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

## Product

-   User authentication (signup, sign-in, sign-out)
-   Kid registration for a family
-   Home dashboard with athlete stats, upcoming sessions, and quick actions
-   Booking system for private, group, and cage sessions with coaches
-   Displaying upcoming and past bookings
-   Video messaging between coaches and families (v0.4+)

## User preferences

-   _Populate as you build_

## Gotchas

-   `npm install` requires `--legacy-peer-deps`.
-   The Replit preview pane is not for mobile app testing; use Expo Go on a physical device.
-   If Supabase email confirmation is enabled, signup will appear stuck; disable it in the Supabase dashboard for development.
-   Existing test sessions might hold stale JWTs after schema changes; sign out and sign back in to refresh tokens.
-   Tables created via raw SQL migrations may lack default GRANTs; explicit `GRANT` statements are required.
-   `err instanceof Error` is incorrect for Supabase `PostgrestError`/`AuthError`; use `errorMessage(err)` from `src/utils/error.ts`.

## Pointers

-   **Full Project Context:** `CLAUDE.md`, `/docs` (PRD, DESIGN, ARCHITECTURE, ROADMAP, PROMPTS)
-   **Authoritative Architecture:** `ARCHITECTURE.md §9`
-   **Supabase Documentation:** [https://supabase.com/docs](https://supabase.com/docs)
-   **Expo Documentation:** [https://docs.expo.dev/](https://docs.expo.dev/)
-   **React Native Documentation:** [https://reactnative.dev/docs/](https://reactnative.dev/docs/)