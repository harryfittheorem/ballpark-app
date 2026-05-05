# CLAUDE.md

This file is automatically read by AI assistants (Replit Agent, Claude Code) on every session. It provides essential context. **Read this first, then refer to `/docs` for deeper information.**

---

## What This Project Is

**Ballpark** is a multi-tenant SaaS operating system for youth sports performance facility franchises. The anchor customer is **Infinite Hitting**, a 17-location youth baseball franchise migrating off MindBody.

**The mission:** Replace MindBody as the operating system for youth sports facilities. Win on five wedges: kid-facing engagement, HitTrax integration, franchise-native architecture, gamification, and unified lead-to-member CRM.

**What we are building first (v0.1 - v0.5):** The athlete-facing mobile app for kids and parents. NOT the operations portal. NOT the AI layer. NOT the franchisor dashboard. Those come after the athlete app ships.

---

## Development Environment

This project lives on **Replit** as a shared multi-developer workspace.

- Multiple developers may be active at the same time
- Code, environment variables, and dev server are shared
- All work pushed to GitHub for backup, branching, and code review
- Expo dev server runs in Replit's container, exposed via tunnel mode for phone testing

---

## Tech Stack (LOCKED — do not deviate)

- **Mobile app:** React Native via Expo (TypeScript, strict mode)
- **Backend:** Supabase (Postgres + Auth + Storage + Edge Functions)
- **Payments:** Stripe Connect (Express accounts per location)
- **Video:** Mux (uploads, playback, analytics)
- **SMS:** Twilio
- **Email:** Resend
- **LLM:** Anthropic Claude API (Sonnet for most, Opus for parent reports)
- **State management:** Zustand for client state, TanStack Query for server state
- **Styling:** StyleSheet + design tokens from `/src/theme/tokens.ts` (do not introduce styled-components, Tailwind RN, or NativeWind)
- **Forms:** React Hook Form + Zod validation
- **Testing:** Jest for unit, Detox for E2E (deferred to v0.4+)
- **Builds:** Expo EAS for production builds (Replit can't build native binaries)

---

## Folder Structure

See `/docs/ARCHITECTURE.md` section 9 for the authoritative folder layout. Summary:

```
ballpark-app/
├── /src
│   ├── /screens          # one folder PER SCREEN: ScreenName.tsx + styles.ts + types.ts + components/
│   ├── /components       # globally reusable: /ui, /layout, /feature
│   ├── /navigation
│   ├── /api              # one file per resource (auth, bookings, home, ...)
│   ├── /hooks
│   ├── /store            # Zustand stores
│   ├── /theme            # tokens.ts, fonts.ts, index.ts
│   ├── /utils
│   ├── /types            # database.ts (generated) + domain.ts
│   └── /lib              # supabase.ts, stripe.ts, mux.ts
├── /supabase
│   ├── /migrations
│   ├── /functions
│   └── /seed
├── /docs
├── /design
├── /assets
├── App.tsx
├── app.json
├── .replit
├── replit.nix
└── package.json
```

Each screen lives in its own folder (e.g. `/src/screens/Home/HomeScreen.tsx`) with co-located `styles.ts`, `types.ts`, and a `components/` subfolder for screen-scoped components.

---

## Code Conventions

### TypeScript
- Strict mode always on. No `any` unless absolutely necessary, and document why.
- All component props are typed as interfaces, not types (easier to extend).
- Prefer named exports over default exports for components.

### Naming
- Files: kebab-case for utility files, PascalCase for component files (`UserCard.tsx`)
- Components: PascalCase (`UserCard`, not `userCard`)
- Functions: camelCase (`getUserById`)
- Constants: SCREAMING_SNAKE_CASE (`API_BASE_URL`)
- Database tables: snake_case (`session_swings`)
- API endpoints: kebab-case (`/api/session-swings`)

### Imports
- Absolute imports via path aliases (`@/components/Button`, not `../../components/Button`)
- Group order: React → third-party → internal absolute → relative → types → styles

### Components
- Functional components with hooks, never class components
- One component per file
- Co-locate styles in `styles.ts` next to the component
- Co-locate types in `types.ts` next to the component (or inline if small)

### Database
- Every table has `id` (uuid), `created_at`, `updated_at`
- Every record is scoped to `tenant_id` (franchise) where applicable
- Use Row Level Security (RLS) for all tables — no exceptions
- Use Supabase migrations for ALL schema changes — never modify live DB directly

---

## Key Commands (Replit-specific)

### In the Replit Shell

```bash
# Development — uses tunnel mode so phones can connect via Expo Go
npm run dev                 # Configured to run `npx expo start --tunnel`

# Or directly:
npx expo start --tunnel     # Tunnel mode (works for phones outside Replit's network)
npx expo start --lan        # LAN mode (only works if phone is on same network as Replit, usually doesn't)

# Database
npx supabase migration new <name>
npx supabase db push        # Push migrations to remote Supabase
npx supabase gen types typescript --linked > src/types/database.ts

# Testing
npm test                    # Unit tests
npm run typecheck           # TypeScript check (must pass before commit)
npm run lint                # ESLint check (must pass before commit)
```

### Environment Variables

In Replit, environment variables are set via **Tools → Secrets**, not `.env` files. The `.env.example` shows what keys to add.

To access in code:
```typescript
process.env.EXPO_PUBLIC_SUPABASE_URL  // Bundled into app, can be public
process.env.SUPABASE_SERVICE_KEY      // Server-side only, never bundled
```

Note: Expo only bundles env vars prefixed with `EXPO_PUBLIC_` into the app. Anything else is server-side (used by Edge Functions).

---

## ALWAYS Do This

1. **Read `/docs/PRD.md`** before working on any feature for the first time
2. **Read `/docs/DESIGN.md`** before building any UI component
3. **Reference `/design/InfiniteHittingApp.jsx`** for visual specs of the athlete app
4. **Use planning mode first** — show plan, wait for approval, then execute
5. **Write the database migration BEFORE the API endpoint BEFORE the UI**
6. **Match the prototype design EXACTLY** unless explicitly told to deviate
7. **Use design tokens from `/src/theme/tokens.ts`** — never hardcode colors, fonts, or spacing
8. **Run `npm run typecheck` before suggesting code is complete**
9. **Commit incrementally** with conventional commit messages (`feat:`, `fix:`, `chore:`)
10. **Verify Supabase RLS policies are in place** for any new table
11. **Check git branch before committing** — main branch should require PRs

---

## NEVER Do This

1. **NEVER hardcode credentials, API keys, or secrets** in code — use Replit Secrets
2. **NEVER skip TypeScript types** with `any` without explicit justification
3. **NEVER bypass RLS policies** by using the service role key in client code
4. **NEVER use AsyncStorage for sensitive data** — use Expo SecureStore
5. **NEVER make architectural decisions on the fly** — they belong in `/docs/ARCHITECTURE.md`
6. **NEVER introduce a new dependency** without checking if existing tools cover the need
7. **NEVER mix the operations portal code into the mobile app** — they're separate apps
8. **NEVER modify production database directly** — always use migrations
9. **NEVER deploy without running typecheck and lint locally first**
10. **NEVER guess at the design** — refer to the prototype files in `/design`
11. **NEVER force-push to shared branches** — coordinate with team

---

## Replit-Specific Workflow Notes

### Running the Expo dev server in shared workspace

Only ONE developer should run `npm run dev` at a time. If multiple people start it, you'll get port conflicts.

Convention: announce in team chat when starting/stopping dev server.

### Working with Replit Agent vs Claude Code

This project uses BOTH AI tools intentionally. Use them for different things:

**Replit Agent** (fast, integrated, good at scaffolding):
- "Set up a new Expo project with TypeScript"
- "Create a Supabase migration with these tables"
- "Add a new screen file with placeholder content"
- "Install these dependencies"
- "Run this command and tell me what happens"

**Claude Code in terminal** (precise, careful, follows conventions):
- "Refactor this component to match the prototype exactly"
- "Implement this feature according to /docs/PRD.md section X"
- "This code violates a convention from CLAUDE.md — fix it"
- "Read these files and propose a careful plan before writing code"

The pattern: Agent for skeleton → Claude Code for refinement. Don't have them edit the same file at the same time.

### Git workflow in shared Replit

- All real work happens in feature branches
- Push to GitHub frequently (every working state)
- Use PRs for code review before merging to main
- Replit's auto-save can create merge conflicts — discipline matters
- Pull from GitHub at the start of each work session

---

## Visual Reference Files (in `/design`)

These are JSX prototypes that define the visual design. They are NOT production code, but they are the source of truth for what every screen should look like:

- **`InfiniteHittingApp.jsx`** — Athlete mobile app (32 screens). PRIMARY REFERENCE for v0.1-v0.5.
- **`IHPortal.jsx`** — Operations portal (15 screens). Reference for later phases.
- **`AILayerMockup.jsx`** — AI layer scenarios. Reference only, not implementing yet.

When implementing a screen, open the corresponding component in `InfiniteHittingApp.jsx` and match it pixel-for-pixel using the actual production stack.

---

## Current Status

**Phase:** v0.3 — Booking System — Phase A COMPLETE (Steps 3.1 + 3.2 MERGED 2026-05-05). Phase B (API + screens) next.
**Anchor customer:** Infinite Hitting (17 locations)
**Target users:** Athletes (kids), Parents
**Active features:** v0.1 foundation + v0.2 Home Tab (5 cards, RHF/Zod forms, TanStack Query). v0.3 Step 3.1 added the booking schema (`session_types`, `coach_availability`, `bookings`) with FK indexes, `updated_at` triggers, RLS (parent CRUD over own family's bookings; coach SELECT; tenant-scoped SELECT on the catalogue tables), tenant pin on every write policy, per-table GRANTs. v0.3 Step 3.2 dropped `coaches.user_id NOT NULL` (admin-provisioned coaches) and seeded Coach Mike + 4 session_types + 3 Tue/Thu/Sat 09:00-12:00 availability windows — idempotent via stable UUIDs + `ON CONFLICT DO NOTHING`.
**Verified:** `npm run typecheck` + `npm run lint` clean. `node scripts/verify-auth-hook.mjs` PASS. Remote verification: 1 coach / 4 session_types / 3 availability rows present.
**Next milestone:** v0.3 Phase B — `/src/api/bookings.ts` + Book + BookConfirm screens + Resend email.

---

## When Stuck

1. Re-read `/docs/PRD.md` and `/docs/ARCHITECTURE.md`
2. Check `/docs/PROMPTS.md` for tested prompt patterns
3. Look at `/design/InfiniteHittingApp.jsx` for visual answers
4. Check Replit's logs panel for runtime errors
5. If still stuck, ask the human — don't guess

---

## Definition of Done (per feature)

A feature is "done" when:

- [ ] TypeScript compiles with zero errors
- [ ] ESLint passes with zero warnings
- [ ] All affected screens match `/design` prototype visually
- [ ] Database migration is reviewed and committed
- [ ] RLS policies are in place
- [ ] API contract documented in `/docs/API.md`
- [ ] Manual smoke test passes on Expo Go (real phone via tunnel)
- [ ] Code committed with descriptive message and pushed to GitHub
- [ ] Brief summary written to `/docs/CHANGELOG.md`
