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
- `EXPO_PUBLIC_SUPABASE_ANON_KEY`
- `EXPO_PUBLIC_TENANT_SLUG=infinitehitting`

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

- **Phase:** v0.1 — Foundation & Auth
- **Done:** Expo + TypeScript scaffolding, all locked deps installed, folder structure, path aliases (tsconfig + babel), ESLint config, dark/gold app shell renders. Typecheck + lint clean.
- **Next:** v0.1 step 1.4 — theme tokens (`/src/theme/tokens.ts`, `fonts.ts`) and font loading in `App.tsx`. Then Supabase schema + RLS + auth screens + 5-tab navigation.
