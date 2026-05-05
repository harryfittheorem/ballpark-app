# Ballpark

> The operating system for youth sports performance facilities. Replacing MindBody for franchise-scale baseball training operators.

**Anchor customer:** Infinite Hitting (17 locations)
**Status:** v0.1 — Foundation
**Active scope:** Athlete mobile app (React Native + Expo)
**Development environment:** Replit (shared workspace)

---

## Quick Start

If this is your first time, see [DAY-1-SETUP.md](./DAY-1-SETUP.md).

If the project is already set up:

```bash
# Pull latest from GitHub
git pull

# Start Expo dev server with tunnel
npx expo start --tunnel

# Scan QR with Expo Go on your phone
```

---

## Project Structure

See [`/docs/ARCHITECTURE.md`](./docs/ARCHITECTURE.md) section 9 for the full folder structure.

Top-level:

```
ballpark-app/
├── /src              # React Native app source
├── /supabase         # database migrations & edge functions
├── /docs             # all project documentation
├── /design           # JSX prototype files (visual reference)
├── /assets           # images, fonts
├── App.tsx
├── CLAUDE.md         # AI assistant context (read first)
├── .replit           # Replit configuration
├── replit.nix        # Replit environment
└── package.json
```

---

## For New Developers (Including AI Assistants)

**Start here, in this order:**

1. **[CLAUDE.md](./CLAUDE.md)** — project context, conventions, what to do/not do
2. **[docs/PRD.md](./docs/PRD.md)** — product requirements, personas, scope
3. **[docs/DESIGN.md](./docs/DESIGN.md)** — visual design system
4. **[docs/ARCHITECTURE.md](./docs/ARCHITECTURE.md)** — technical decisions
5. **[docs/ROADMAP.md](./docs/ROADMAP.md)** — what to build in what order
6. **[docs/PROMPTS.md](./docs/PROMPTS.md)** — Replit Agent + Claude Code prompts

The visual prototypes in `/design` are the source of truth for UI. Match them exactly.

---

## Development Workflow

### Daily flow

```bash
# Morning
git pull                         # Get latest from GitHub
npx expo start --tunnel          # Start dev server in tunnel mode

# Make changes via Replit editor + Replit Agent + Claude Code
# Test on your phone via Expo Go (scan QR)

# Before committing
npm run typecheck
npm run lint
git add -A
git commit -m "feat: descriptive message"
git push                         # Push to GitHub for backup
```

### Working with AI tools

This project uses BOTH Replit Agent and Claude Code intentionally:

- **Replit Agent (sidebar)** → fast scaffolding, runs commands, big setup tasks
- **Claude Code (terminal)** → precise refinement, follows docs carefully, polishes code

See `/docs/PROMPTS.md` for the dual-tool workflow patterns.

### Working in shared workspace

- Only ONE developer should run `npx expo start --tunnel` at a time (port conflict)
- Announce in team chat when starting/stopping dev server
- Use feature branches for non-trivial work
- Push to GitHub frequently — Replit alone is not your backup

---

## Tech Stack

| Layer | Choice |
|---|---|
| Mobile | React Native + Expo (TypeScript) |
| Backend | Supabase (Postgres + Auth + Storage + Realtime) |
| Payments | Stripe Connect (Express) |
| Video | Mux |
| SMS | Twilio |
| Email | Resend |
| AI | Anthropic Claude API |
| Server state | TanStack Query |
| Client state | Zustand |
| Forms | React Hook Form + Zod |

These are LOCKED. See `/docs/ARCHITECTURE.md` for details.

---

## Environment Setup

In Replit, environment variables are set via **Tools → Secrets**, not `.env` files.

See `.env.example` for the list of variables to add.

---

## Common Commands

```bash
# Development
npx expo start --tunnel             # Start with tunnel (works for phones)
npx expo start --clear              # Clear cache and start

# Database
npx supabase migration new <name>
npx supabase db push                # Push to Supabase
npx supabase gen types typescript --linked > src/types/database.ts

# Quality checks
npm run typecheck
npm run lint
npm test

# Builds (when ready for production)
npx eas build --platform all --profile preview
npx eas submit --platform all
```

Note: EAS Build runs in the cloud (not Replit). Replit can't compile native iOS/Android apps.

---

## Project Status

**Phase:** v0.1 — Initial setup
**Active features:** None yet (bootstrapping)
**Next milestone:** First Expo build with auth working

See [`/docs/ROADMAP.md`](./docs/ROADMAP.md) for the full plan.

---

## Anti-Goals

These will be tempting but should NOT be tackled in v0.1-v0.5:

- AI Layer (SMS intelligence)
- Franchisor portal
- Owner dashboard with deep analytics
- Push notifications
- Sibling/multi-kid support
- HitTrax integration (mock until partnership confirmed)
- Localization

If you find yourself drifting toward these, redirect to the roadmap.

---

## Replit-Specific Notes

### Why Replit?
- Shared workspace for team collaboration
- Single environment configuration for all developers
- No "works on my machine" issues
- Built-in AI tools (Replit Agent)

### Known limitations
- Expo dev server runs in Replit container, accessed via tunnel mode (slower than local LAN)
- Native iOS/Android builds happen via Expo EAS in the cloud, not Replit
- Some debugging is harder without local simulator

### Cost
- Replit Core/Teams plan: $25-35/user/month
- Compute: scales with usage
- Realistic Phase 1 cost: $35-150/month depending on team size

---

## Contact

Project lead: Harry / MyAgencyOS
Anchor customer: Infinite Hitting
HitTrax partnership: in discussion

---

## License

Proprietary. © MyAgencyOS. All rights reserved.
